const { chromium } = require('playwright')
const path = require('path')
const { screen } = require('electron')
const authHandler = require('./auth-handler')
const { getSectionScrollStops } = require('./section-analyzer')

// Path to the autoconsent browser-side init script
const AUTOCONSENT_SCRIPT = require.resolve('@duckduckgo/autoconsent/dist/autoconsent.playwright.js')
const { runHoverInteractions } = require('./hover-engine')
const { getFfmpegPath, resolveScreenDeviceIndex, buildCaptureArgs, spawnFfmpeg } = require('./ffmpeg-helper')
const { videoFilename } = require('./output-manager')

const DEFAULT_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
`

const SCROLL_SPEEDS = { slow: 2000, medium: 1200, fast: 700 } // ms per 1000px

/**
 * Eased scroll animation: moves from currentY to targetY using rAF-based cubic ease-in-out.
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
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        window.scrollTo(0, startY + (targetY - startY) * eased)
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  }, { targetY, duration })
}

/**
 * Captures a scroll video of a single URL.
 */
async function captureVideo(job, device, outputFolder, onLog, onFile, ffmpegPathOverride) {
  const display = screen.getPrimaryDisplay()
  const scaleFactor = display.scaleFactor
  const ffmpegPath = getFfmpegPath(ffmpegPathOverride)
  const screenIndex = resolveScreenDeviceIndex(ffmpegPath)

  if (typeof onLog === 'function') {
    onLog(`Screen device index: ${screenIndex}, scale factor: ${scaleFactor}`)
  }

  // Launch headed browser
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--window-position=0,23`,
      `--window-size=${device.width},${device.height + (job.viewportExtend || 0)}`,
      `--app=about:blank`,
      `--disable-infobars`
    ]
  })

  try {
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }

    const httpCreds = authHandler.buildHttpCredentials(job.auth)
    if (httpCreds) contextOptions.httpCredentials = httpCreds

    const context = await browser.newContext(contextOptions)

    // Inject autoconsent as init script — consent banner handled visibly in recording
    try { await context.addInitScript({ path: AUTOCONSENT_SCRIPT }) } catch (_) {}

    const page = await context.newPage()

    // Navigate and auth
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
    if (job.auth?.type === 'form') {
      await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
      await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }

    // Inject CSS
    await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

    // Start FFmpeg recording
    const outputPath = path.join(outputFolder, videoFilename(device.id))
    const args = buildCaptureArgs(screenIndex, device.width, device.height, scaleFactor, outputPath)

    if (typeof onLog === 'function') onLog('Starting FFmpeg screen capture...')
    if (typeof onLog === 'function') onLog('⚠️  If no video is produced, grant Screen Recording permission to Electron in System Settings → Privacy & Security.')

    const ffmpegProc = spawnFfmpeg(ffmpegPath, args, line => {
      if (typeof onLog === 'function') onLog(`FFmpeg: ${line}`)
    })

    // Wait for FFmpeg to initialize and autoconsent to run
    await new Promise(r => setTimeout(r, 1500))
    if (typeof onLog === 'function') onLog('Cookie consent handled (via init script)')
    await page.waitForTimeout(500)

    // Hero wait
    if (typeof onLog === 'function') {
      onLog(`Waiting ${job.heroWaitSeconds ?? 15}s for hero content...`)
    }
    await page.waitForTimeout((job.heroWaitSeconds ?? 15) * 1000)

    // Get scroll stops
    const stops = await getSectionScrollStops(page, device.height)
    if (typeof onLog === 'function') {
      onLog(`Scroll stops: ${stops.join(', ')}`)
    }

    const speedMs = SCROLL_SPEEDS[job.scrollSpeed || 'medium']
    let currentY = 0

    for (const targetY of stops) {
      if (targetY === currentY) continue
      if (typeof onLog === 'function') onLog(`Scrolling to ${targetY}px`)
      await smoothScrollTo(page, targetY, currentY, speedMs)
      currentY = targetY

      // Hover interactions (optional)
      if (job.hoverInteractions) {
        await runHoverInteractions(page, currentY, device, onLog)
      }

      // Pause at this stop
      await page.waitForTimeout(1500)
    }

    // Final pause
    await page.waitForTimeout(1000)

    // Stop FFmpeg
    if (ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
      ffmpegProc.stdin.write('q')
      await new Promise(r => setTimeout(r, 2000))
    }
    ffmpegProc.kill('SIGINT')

    if (typeof onLog === 'function') onLog(`Video saved: ${videoFilename(device.id)}`)
    if (typeof onFile === 'function') onFile(outputPath)
  } finally {
    // Suppress TargetClosedError — browser close can interrupt pending page.evaluate callbacks
    try { await browser.close() } catch (_) {}
  }
}

module.exports = { captureVideo }
