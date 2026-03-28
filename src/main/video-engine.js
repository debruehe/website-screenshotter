const { chromium } = require('playwright')
const path = require('path')
const { screen, globalShortcut } = require('electron')
const authHandler = require('./auth-handler')
const { computeScrollStops } = require('./scroll-settings')
const { getStorageState } = require('./session-manager')
const { getForUrl: getHttpAuth } = require('./http-auth')

const { runHoverInteractions, injectFakeCursor, findAllHoverTargets, interactHover } = require('./hover-engine')
const { getFfmpegPath, resolveScreenDeviceIndex, buildCaptureArgs, spawnFfmpeg } = require('./ffmpeg-helper')
const { videoFilename } = require('./output-manager')

const DEFAULT_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
`


const BROWSER_ARGS = (width, height) => [
  `--window-position=0,23`,
  `--window-size=${width},${height}`,
  `--app=about:blank`,
  `--disable-infobars`,
  `--disable-features=Translate,TranslateUI`,
  `--disable-translate`,
  `--lang=en-US`
]

/**
 * Eased scroll animation: quartic ease-in-out for a cinematic deceleration.
 */
async function smoothScrollTo(page, targetY, currentY, msPerPx) {
  const distance = Math.abs(targetY - currentY)
  const duration = (distance / 1000) * msPerPx
  await page.evaluate(({ targetY, duration }) => {
    return new Promise(resolve => {
      const startY = window.scrollY
      const startTime = performance.now()
      function step(now) {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)
        const eased = t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2
        window.scrollTo(0, startY + (targetY - startY) * eased)
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  }, { targetY, duration })
}

/**
 * Shared browser + page setup used by both capture modes.
 * Uses chromium.launch() + --app=about:blank for a minimal window (no tab/address bar),
 * which is critical for correct FFmpeg crop Y offset calculation.
 * Returns { page, close } — callers must call close() in their finally block.
 */
async function setupBrowser(job, device, onLog) {
  const w = device.width
  const h = device.height + (job.viewportExtend || 0)

  const browser = await chromium.launch({
    headless: false,
    args: BROWSER_ARGS(w, h)
  })

  const contextOptions = {
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    colorScheme: job.darkMode ? 'dark' : 'light'
  }

  // Per-URL HTTP Basic Auth takes precedence over job-level auth
  const savedHttpAuth = getHttpAuth(job.url)
  const httpCreds = savedHttpAuth || authHandler.buildHttpCredentials(job.auth)
  if (httpCreds) contextOptions.httpCredentials = httpCreds

  const storageState = getStorageState(job.url)
  if (storageState) {
    contextOptions.storageState = storageState
    if (typeof onLog === 'function') onLog(`Using saved session for ${new URL(job.url).hostname}`)
  }

  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()

  await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
  if (job.auth?.type === 'form') {
    await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  // Wait 2s then reload to clear any browser overlays before recording
  if (typeof onLog === 'function') onLog('Waiting 2s then reloading for clean opening frame...')
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })

  await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

  return { page, close: async () => { try { await browser.close() } catch (_) {} } }
}

/**
 * Starts FFmpeg and returns { proc, outputPath }.
 * @param {object} captureOptions - passed to buildCaptureArgs (captureCursor, realtime)
 */
async function startRecording(page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog, captureOptions = {}) {
  const browserChromeH = await page.evaluate(() => Math.max(0, window.outerHeight - window.innerHeight)) + 8
  if (typeof onLog === 'function') onLog(`Browser chrome height: ${browserChromeH}px (incl. 8px offset)`)

  const outputPath = path.join(outputFolder, videoFilename(device.id))
  const args = buildCaptureArgs(screenIndex, device.width, device.height, scaleFactor, outputPath, browserChromeH, captureOptions)

  if (typeof onLog === 'function') onLog('Starting FFmpeg screen capture...')
  if (typeof onLog === 'function') onLog('⚠️  If no video is produced, grant Screen Recording permission to Electron in System Settings → Privacy & Security.')

  const proc = spawnFfmpeg(ffmpegPath, args, line => {
    if (typeof onLog === 'function') onLog(`FFmpeg: ${line}`)
  })

  await new Promise(r => setTimeout(r, 1500))
  return { proc, outputPath }
}

/**
 * Stops FFmpeg gracefully.
 */
async function stopRecording(proc) {
  if (proc.stdin && !proc.stdin.destroyed) {
    proc.stdin.write('q')
    await new Promise(r => setTimeout(r, 2000))
  }
  proc.kill('SIGINT')
}

/**
 * Captures a scroll video. When hoverInteractions is enabled, ignores scroll stops
 * and instead scrolls automatically to each hoverable element.
 */
async function captureVideo(job, device, outputFolder, onLog, onFile, ffmpegPathOverride) {
  const display = screen.getPrimaryDisplay()
  const scaleFactor = display.scaleFactor
  const ffmpegPath = getFfmpegPath(ffmpegPathOverride)
  const screenIndex = resolveScreenDeviceIndex(ffmpegPath)

  if (typeof onLog === 'function') onLog(`Screen device index: ${screenIndex}, scale factor: ${scaleFactor}`)

  const { page, close } = await setupBrowser(job, device, onLog)

  try {
    if (job.hoverInteractions) await injectFakeCursor(page)

    const { proc, outputPath } = await startRecording(page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog)

    try {
      await page.waitForTimeout(500)

      if (typeof onLog === 'function') onLog(`Waiting ${job.heroWaitSeconds ?? 15}s for hero content...`)
      await page.waitForTimeout((job.heroWaitSeconds ?? 15) * 1000)

      const speedMs = job.scrollSpeed || 2000
      let currentY = 0

      if (job.hoverInteractions) {
        // Hover-driven scroll: visit each interactive element in order
        const allTargets = await findAllHoverTargets(page, onLog)

        for (const target of allTargets) {
          const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
          const maxScroll = Math.max(0, scrollHeight - device.height)
          const idealScroll = target.pageY + target.height / 2 - device.height / 2
          const targetScrollY = Math.min(Math.max(0, idealScroll), maxScroll)

          if (Math.abs(targetScrollY - currentY) > 10) {
            if (typeof onLog === 'function') onLog(`Scrolling to ${Math.round(targetScrollY)}px`)
            await smoothScrollTo(page, targetScrollY, currentY, speedMs)
            currentY = targetScrollY
            await page.waitForTimeout(400)
          }

          const viewportBox = {
            x: target.pageX,
            y: target.pageY - currentY,
            width: target.width,
            height: target.height
          }
          await interactHover(page, viewportBox, device.width, device.height, onLog, {
            checkDropdown: target.mayHaveDropdown
          })
        }
      } else {
        // Normal scroll-stop mode
        const stops = await computeScrollStops(page, device.height, job.url)
        if (typeof onLog === 'function') onLog(`Scroll stops: ${stops.join(', ')}`)

        for (const targetY of stops) {
          if (targetY === currentY) continue
          if (typeof onLog === 'function') onLog(`Scrolling to ${targetY}px`)
          await smoothScrollTo(page, targetY, currentY, speedMs)
          currentY = targetY
          await page.waitForTimeout(job.scrollPause ?? 1500)
        }
      }

      await page.waitForTimeout(1000)
    } finally {
      await stopRecording(proc)
    }

    if (typeof onLog === 'function') onLog(`Video saved: ${videoFilename(device.id)}`)
    if (typeof onFile === 'function') onFile(outputPath)
  } finally {
    await close()
  }
}

/**
 * Manual recording: browser opens, FFmpeg starts, user does whatever they want.
 * Press Escape to stop the recording and save the video.
 */
async function captureVideoManual(job, device, outputFolder, onLog, onFile, ffmpegPathOverride) {
  const display = screen.getPrimaryDisplay()
  const scaleFactor = display.scaleFactor
  const ffmpegPath = getFfmpegPath(ffmpegPathOverride)
  const screenIndex = resolveScreenDeviceIndex(ffmpegPath)

  if (typeof onLog === 'function') onLog(`Screen device index: ${screenIndex}, scale factor: ${scaleFactor}`)

  const { page, close } = await setupBrowser(job, device, onLog)

  try {
    // Bring browser window to front so it receives OS mouse/keyboard events
    await page.bringToFront()

    const { proc, outputPath } = await startRecording(
      page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog,
      { captureCursor: true }
    )

    if (typeof onLog === 'function') onLog('Manual recording active — press Escape to stop and save.')

    try {
      // Wait for Escape key via global shortcut
      await new Promise(resolve => {
        globalShortcut.register('Escape', () => {
          globalShortcut.unregister('Escape')
          resolve()
        })
      })
      if (typeof onLog === 'function') onLog('Escape pressed — stopping recording...')
    } finally {
      // Ensure shortcut is always unregistered even if something else throws
      try { globalShortcut.unregister('Escape') } catch (_) {}
      await stopRecording(proc)
    }

    if (typeof onLog === 'function') onLog(`Video saved: ${videoFilename(device.id)}`)
    if (typeof onFile === 'function') onFile(outputPath)
  } finally {
    await close()
  }
}

module.exports = { captureVideo, captureVideoManual }
