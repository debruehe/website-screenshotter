const { chromium } = require('playwright')
const path = require('path')
const { screen, globalShortcut } = require('electron')
const authHandler = require('./auth-handler')
const { computeScrollStops } = require('./scroll-settings')
const { getStorageState } = require('./session-manager')
const { getForUrl: getHttpAuth } = require('./http-auth')
const { installVideoCaptureCss } = require('./video-capture-css')
const { TRANSLATION_DISABLED_ARGS, installTranslationSuppression } = require('./chromium-translate')

const { runHoverInteractions, injectFakeCursor, injectSmoothCursor, injectClickVisualizer, findAllHoverTargets, interactHover } = require('./hover-engine')
const { getFfmpegPath, resolveScreenDeviceIndex, buildCaptureArgs, spawnFfmpeg } = require('./ffmpeg-helper')
const { videoFilename, captureVideoFilename, deviceSlug } = require('./output-manager')

const BROWSER_ARGS = (width, height) => [
  `--window-position=0,23`,
  `--window-size=${width},${height}`,
  `--app=about:blank`,
  `--disable-infobars`,
  ...TRANSLATION_DISABLED_ARGS,
  `--disable-component-update`,
  `--no-first-run`
]

/**
 * Smooth scroll to targetY over a fixed duration (ms) with cubic ease-in-out.
 * Duration is fixed per segment regardless of distance, so the feel is consistent.
 */
async function smoothScrollTo(page, targetY, durationMs) {
  await page.evaluate(({ targetY, durationMs }) => {
    return new Promise(resolve => {
      const startY = window.scrollY
      const startTime = performance.now()
      function step(now) {
        const elapsed = now - startTime
        const t = Math.min(elapsed / durationMs, 1)
        // Cubic ease-in-out
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        document.documentElement.scrollTop = startY + (targetY - startY) * eased
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  }, { targetY, durationMs })
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

  if (device.width < 1025) {
    contextOptions.isMobile = true
    contextOptions.hasTouch = true
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
  await installTranslationSuppression(context)
  const page = await context.newPage()

  if (device.width < 1025) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' })
  }

  await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
  if (job.auth?.type === 'form') {
    await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  // Wait 2s then reload to clear any browser overlays before recording
  if (typeof onLog === 'function') onLog('Waiting 2s then reloading for clean opening frame...')
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })

  // Dismiss browser UI overlays (e.g. translation bar) via a JS-level click.
  // Using evaluate avoids Playwright's mouse input pipeline which can deadlock
  // when touch-from-mouse emulation is active on mobile contexts.
  await page.waitForTimeout(400)
  await page.evaluate(() => document.documentElement.click())

  await installVideoCaptureCss(page, job.customCss)

  return { page, close: async () => { try { await browser.close() } catch (_) {} } }
}

/**
 * Starts FFmpeg and returns { proc, outputPath }.
 * @param {object} captureOptions - passed to buildCaptureArgs (captureCursor, realtime)
 */
async function startRecording(page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog, captureOptions = {}, isManual = false, outputPathOverride = null) {
  const store = require('./store')
  const { cropYOffset } = store.getSettings()

  const browserChromeH = await page.evaluate(() => Math.max(0, window.outerHeight - window.innerHeight)) + 8

  if (cropYOffset !== undefined) {
    if (typeof onLog === 'function') onLog(`Using calibrated crop Y: ${cropYOffset}px (logical)`)
  } else {
    if (typeof onLog === 'function') onLog(`Auto-detected browser chrome: ${browserChromeH}px — run Calibrate in Settings for precision`)
  }

  const outputPath = outputPathOverride || path.join(outputFolder, videoFilename(deviceSlug(device), isManual))
  const args = buildCaptureArgs(screenIndex, device.width, device.height, scaleFactor, outputPath, browserChromeH, {
    ...captureOptions,
    cropYOffset
  })

  if (typeof onLog === 'function') onLog('Starting FFmpeg screen capture...')
  if (typeof onLog === 'function') onLog('⚠️  If no video is produced, grant Screen Recording permission to Electron in System Settings → Privacy & Security.')

  const proc = spawnFfmpeg(ffmpegPath, args, line => {
    if (typeof onLog === 'function') onLog(`FFmpeg: ${line}`)
  })

  await new Promise(r => setTimeout(r, 1500))
  return { proc, outputPath }
}

/**
 * Stops FFmpeg gracefully and waits for it to fully exit and flush the MP4.
 * Sends 'q' to stdin for a clean shutdown, force-kills after 5s if needed.
 */
async function stopRecording(proc, onLog) {
  if (typeof onLog === 'function') onLog('Stopping recording…')
  await new Promise(resolve => {
    proc.once('close', resolve)
    // End stdin with 'q' — both queues the quit command and closes the pipe,
    // which signals EOF to FFmpeg (belt-and-suspenders graceful shutdown)
    if (proc.stdin && !proc.stdin.destroyed) {
      try { proc.stdin.end('q') } catch (_) {}
    }
    // Force kill after 8s if FFmpeg hasn't exited
    const timer = setTimeout(() => {
      if (typeof onLog === 'function') onLog('FFmpeg did not exit gracefully, force-killing…')
      try { proc.kill('SIGKILL') } catch (_) {}
    }, 8000)
    proc.once('close', () => clearTimeout(timer))
  })
  if (typeof onLog === 'function') onLog('Recording stopped.')
}

/**
 * Captures a scroll video. When hoverInteractions is enabled, ignores scroll stops
 * and instead scrolls automatically to each hoverable element.
 */
async function captureVideo(job, device, outputFolder, onLog, onFile, ffmpegPathOverride) {
  const shouldRecord = !job.noRecording
  let scaleFactor = null
  let ffmpegPath = null
  let screenIndex = null
  if (shouldRecord) {
    scaleFactor = screen.getPrimaryDisplay().scaleFactor
    ffmpegPath = getFfmpegPath(ffmpegPathOverride)
    screenIndex = resolveScreenDeviceIndex(ffmpegPath)
    if (typeof onLog === 'function') onLog(`Screen device index: ${screenIndex}, scale factor: ${scaleFactor}`)
  } else if (typeof onLog === 'function') {
    onLog('No recording enabled — running the browser and scroll workflow without FFmpeg.')
  }

  const { page, close } = await setupBrowser(job, device, onLog)

  try {
    const isBulk = job.bulkUrls && job.bulkUrls.length > 0
    // In bulk mode, setupBrowser navigated to job.url as a warm-up; the bulk loop
    // re-navigates to each URL in turn, so that initial navigation is effectively discarded.
    const urlsToRecord = isBulk ? job.bulkUrls : null

    if (isBulk) {
      // Bulk mode: one recording per URL, browser stays open between URLs
      for (let urlIdx = 0; urlIdx < urlsToRecord.length; urlIdx++) {
        const url = urlsToRecord[urlIdx]
        const prefix = `[${urlIdx + 1}/${urlsToRecord.length}] `

        if (typeof onLog === 'function') onLog(`${prefix}Navigating to ${url}...`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
        await page.waitForTimeout(2000)
        await page.reload({ waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
        if (job.hoverInteractions) await injectFakeCursor(page)

        const outputFilename = shouldRecord ? captureVideoFilename({ job, device, url }) : null
        const outputPath = shouldRecord ? path.join(outputFolder, outputFilename) : null
        let proc = null
        if (shouldRecord) {
          ;({ proc } = await startRecording(
            page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog,
            {}, false, outputPath
          ))
        }

        let escapePressed = false
        const escapeHandler = () => {
          escapePressed = true
          try { globalShortcut.unregister('Escape') } catch (_) {}
          if (typeof onLog === 'function') {
            onLog(shouldRecord
              ? 'Escape pressed — stopping recording early...'
              : 'Escape pressed — stopping browser workflow early...')
          }
        }
        try { globalShortcut.register('Escape', escapeHandler) } catch (err) {
          if (typeof onLog === 'function') onLog(`Warning: could not register Escape shortcut: ${err.message}`)
        }

        try {
          await page.waitForTimeout(500)

          if (typeof onLog === 'function') onLog(`${prefix}Waiting ${job.heroWaitSeconds ?? 15}s for hero content...`)
          const heroMs = (job.heroWaitSeconds ?? 15) * 1000
          for (let waited = 0; waited < heroMs && !escapePressed; waited += 200) {
            await page.waitForTimeout(Math.min(200, heroMs - waited))
          }

          const speedMs = job.scrollSpeed || 2000
          let currentY = 0

          if (job.hoverInteractions) {
            const allTargets = await findAllHoverTargets(page, onLog)
            for (const target of allTargets) {
              if (escapePressed) break
              const scrollHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
              const maxScroll = Math.max(0, scrollHeight - device.height)
              const idealScroll = target.pageY + target.height / 2 - device.height / 2
              const targetScrollY = Math.min(Math.max(0, idealScroll), maxScroll)
              if (Math.abs(targetScrollY - currentY) > 10) {
                if (typeof onLog === 'function') onLog(`Scrolling to ${Math.round(targetScrollY)}px`)
                await smoothScrollTo(page, targetScrollY, speedMs)
                currentY = targetScrollY
                await page.waitForTimeout(400)
              }
              if (escapePressed) break
              const viewportBox = {
                x: target.pageX, y: target.pageY - currentY,
                width: target.width, height: target.height
              }
              await interactHover(page, viewportBox, device.width, device.height, onLog, {
                checkDropdown: target.mayHaveDropdown,
                isCancelled: () => escapePressed
              })
            }
          } else {
            const pageH = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
            if (typeof onLog === 'function') onLog(`${prefix}Page height: ${pageH}px`)
            const stops = await computeScrollStops(page, device.height, url, 'video')
            if (typeof onLog === 'function') onLog(`${prefix}Scroll stops (${stops.length}): ${stops.join(', ')}`)
            for (const targetY of stops) {
              if (escapePressed) break
              if (targetY === currentY) continue
              if (typeof onLog === 'function') onLog(`Scrolling to ${targetY}px`)
              await smoothScrollTo(page, targetY, speedMs)
              currentY = targetY
              const pauseMs = job.scrollPause ?? 1500
              for (let paused = 0; paused < pauseMs && !escapePressed; paused += 200) {
                await page.waitForTimeout(Math.min(200, pauseMs - paused))
              }
            }
          }

          if (!escapePressed) await page.waitForTimeout(1000)
        } finally {
          try { globalShortcut.unregister('Escape') } catch (_) {}
          if (proc) await stopRecording(proc, onLog)
        }

        if (shouldRecord) {
          if (typeof onLog === 'function') onLog(`${prefix}Video saved: ${outputFilename}`)
          if (typeof onFile === 'function') onFile(outputPath)
        } else if (typeof onLog === 'function') {
          onLog(`${prefix}Scroll workflow complete (No recording).`)
        }

        if (escapePressed) {
          if (typeof onLog === 'function') {
            onLog(shouldRecord
              ? 'Bulk recording stopped early by user.'
              : 'Bulk browser workflow stopped early by user.')
          }
          break
        }
      }
    } else {
      // Single-URL mode.
      if (job.hoverInteractions) await injectFakeCursor(page)

      let proc = null
      let outputPath = null
      if (shouldRecord) {
        const outputFilename = captureVideoFilename({ job, device })
        const outputPathOverride = path.join(outputFolder, outputFilename)
        ;({ proc, outputPath } = await startRecording(
          page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog,
          {}, false, outputPathOverride
        ))
      }

      let escapePressed = false
      const escapeHandler = () => {
        escapePressed = true
        try { globalShortcut.unregister('Escape') } catch (_) {}
        if (typeof onLog === 'function') {
          onLog(shouldRecord
            ? 'Escape pressed — stopping recording early...'
            : 'Escape pressed — stopping browser workflow early...')
        }
      }
      try { globalShortcut.register('Escape', escapeHandler) } catch (_) {}

      try {
        await page.waitForTimeout(500)

        if (typeof onLog === 'function') onLog(`Waiting ${job.heroWaitSeconds ?? 15}s for hero content... (press Escape to stop early)`)
        const heroMs = (job.heroWaitSeconds ?? 15) * 1000
        for (let waited = 0; waited < heroMs && !escapePressed; waited += 200) {
          await page.waitForTimeout(Math.min(200, heroMs - waited))
        }

        const speedMs = job.scrollSpeed || 2000
        let currentY = 0

        if (job.hoverInteractions) {
          const allTargets = await findAllHoverTargets(page, onLog)

          for (const target of allTargets) {
            if (escapePressed) break
            const scrollHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
            const maxScroll = Math.max(0, scrollHeight - device.height)
            const idealScroll = target.pageY + target.height / 2 - device.height / 2
            const targetScrollY = Math.min(Math.max(0, idealScroll), maxScroll)

            if (Math.abs(targetScrollY - currentY) > 10) {
              if (typeof onLog === 'function') onLog(`Scrolling to ${Math.round(targetScrollY)}px`)
              await smoothScrollTo(page, targetScrollY, speedMs)
              currentY = targetScrollY
              await page.waitForTimeout(400)
            }

            if (escapePressed) break
            const viewportBox = {
              x: target.pageX,
              y: target.pageY - currentY,
              width: target.width,
              height: target.height
            }
            await interactHover(page, viewportBox, device.width, device.height, onLog, {
              checkDropdown: target.mayHaveDropdown,
              isCancelled: () => escapePressed
            })
          }
        } else {
          const pageH = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
          if (typeof onLog === 'function') onLog(`Page height: ${pageH}px, viewport: ${device.height}px, maxScroll: ${pageH - device.height}px`)
          const stops = await computeScrollStops(page, device.height, job.url, 'video')
          if (typeof onLog === 'function') onLog(`Scroll stops (${stops.length}): ${stops.join(', ')}`)

          for (const targetY of stops) {
            if (escapePressed) break
            if (targetY === currentY) continue
            if (typeof onLog === 'function') onLog(`Scrolling to ${targetY}px`)
            await smoothScrollTo(page, targetY, speedMs)
            currentY = targetY
            const pauseMs = job.scrollPause ?? 1500
            for (let paused = 0; paused < pauseMs && !escapePressed; paused += 200) {
              await page.waitForTimeout(Math.min(200, pauseMs - paused))
            }
          }
        }

        if (!escapePressed) await page.waitForTimeout(1000)
      } finally {
        try { globalShortcut.unregister('Escape') } catch (_) {}
        if (proc) await stopRecording(proc, onLog)
      }

      if (shouldRecord) {
        if (typeof onLog === 'function') onLog(`Video saved: ${path.basename(outputPath)}`)
        if (typeof onFile === 'function') onFile(outputPath)
      } else if (typeof onLog === 'function') {
        onLog('Scroll workflow complete (No recording).')
      }
    }
  } finally {
    await close()
  }
}

/**
 * Manual video workflow: browser opens and the user navigates freely.
 * FFmpeg recording is optional; Escape finishes the workflow.
 */
async function captureVideoManual(job, device, outputFolder, onLog, onFile, ffmpegPathOverride) {
  const shouldRecord = !job.noRecording
  let scaleFactor = null
  let ffmpegPath = null
  let screenIndex = null
  if (shouldRecord) {
    scaleFactor = screen.getPrimaryDisplay().scaleFactor
    ffmpegPath = getFfmpegPath(ffmpegPathOverride)
    screenIndex = resolveScreenDeviceIndex(ffmpegPath)
    if (typeof onLog === 'function') onLog(`Screen device index: ${screenIndex}, scale factor: ${scaleFactor}`)
  } else if (typeof onLog === 'function') {
    onLog('No recording enabled — running the manual browser workflow without FFmpeg.')
  }

  const { page, close } = await setupBrowser(job, device, onLog)

  try {
    // Bring browser window to front so it receives OS mouse/keyboard events
    await page.bringToFront()

    // Smooth cursor: inject spring-physics fake cursor and hide OS cursor so
    // the real cursor doesn't appear doubled in the recording
    if (job.smoothCursor) {
      await injectSmoothCursor(page)
      if (typeof onLog === 'function') onLog('Smooth cursor active.')
    }

    // Click visualizer: subtle white ripple on every click, for all manual recordings
    await injectClickVisualizer(page)

    let proc = null
    let outputPath = null
    if (shouldRecord) {
      const outputFilename = captureVideoFilename({ job, device, isManual: true })
      const outputPathOverride = path.join(outputFolder, outputFilename)
      ;({ proc, outputPath } = await startRecording(
        page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog,
        { captureCursor: !job.smoothCursor }, true, outputPathOverride
      ))
    }

    const store = require('./store')
    const settings = store.getSettings()
    const jumpKey = settings.manualScrollJumpKey || 'CommandOrControl+J'

    const viewportHeight = device.height + (job.viewportExtend || 0)
    const scrollStops = await computeScrollStops(page, viewportHeight, job.url, 'video')
    let jumpIndex = 0

    if (typeof onLog === 'function') {
      const action = shouldRecord ? 'stop and save' : 'close the browser workflow'
      onLog(`Manual video workflow active — press ${jumpKey} to jump to next scroll stop, Escape to ${action}.`)
    }
    if (scrollStops.length > 1 && typeof onLog === 'function') onLog(`Scroll stops: ${scrollStops.map(s => s + 'px').join(', ')}`)

    const doJump = async () => {
      jumpIndex = (jumpIndex + 1) % scrollStops.length
      const targetY = scrollStops[jumpIndex]
      await smoothScrollTo(page, targetY, 600)
      if (typeof onLog === 'function') onLog(`Jumped to stop ${jumpIndex + 1}/${scrollStops.length}: ${targetY}px`)
    }

    try {
      await new Promise(resolve => {
        globalShortcut.register(jumpKey, doJump)
        globalShortcut.register('Escape', () => {
          try { globalShortcut.unregister(jumpKey) } catch (_) {}
          globalShortcut.unregister('Escape')
          resolve()
        })
      })
      if (typeof onLog === 'function') {
        onLog(shouldRecord
          ? 'Escape pressed — stopping recording...'
          : 'Escape pressed — closing browser workflow...')
      }
    } finally {
      try { globalShortcut.unregister(jumpKey) } catch (_) {}
      try { globalShortcut.unregister('Escape') } catch (_) {}
      if (proc) await stopRecording(proc, onLog)
    }

    if (shouldRecord) {
      if (typeof onLog === 'function') onLog(`Video saved: ${path.basename(outputPath)}`)
      if (typeof onFile === 'function') onFile(outputPath)
    } else if (typeof onLog === 'function') {
      onLog('Manual browser workflow complete (No recording).')
    }
  } finally {
    await close()
  }
}

module.exports = { captureVideo, captureVideoManual }
