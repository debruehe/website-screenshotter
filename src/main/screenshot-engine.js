const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
const authHandler = require('./auth-handler')
const { computeScrollStops } = require('./scroll-settings')
const { getStorageState } = require('./session-manager')
const { getForUrl: getHttpAuth } = require('./http-auth')

const DEFAULT_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
`

const CHROMIUM_ARGS = [
  '--disable-features=Translate,TranslateUI',
  '--disable-translate',
  '--lang=en-US',
  '--no-sandbox',
  '--disable-setuid-sandbox'
]

/**
 * Scrolls the full page to trigger lazy-loaded images, then returns to top.
 */
async function triggerLazyLoad(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let scrollY = 0
      const step = 600
      const delay = 80
      function scroll() {
        window.scrollBy(0, step)
        scrollY += step
        if (scrollY < document.body.scrollHeight) {
          setTimeout(scroll, delay)
        } else {
          window.scrollTo(0, 0)
          setTimeout(resolve, 300)
        }
      }
      scroll()
    })
  })
}

/**
 * Slower pre-capture scroll to ensure all animations and intersection-observer
 * effects have triggered, then returns to top.
 */
async function preCaptureScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let scrollY = 0
      const step = 300
      const delay = 120
      function scroll() {
        window.scrollBy(0, step)
        scrollY += step
        if (scrollY < document.body.scrollHeight) {
          setTimeout(scroll, delay)
        } else {
          setTimeout(() => {
            window.scrollTo(0, 0)
            setTimeout(resolve, 500)
          }, 800)
        }
      }
      scroll()
    })
  })
}

/**
 * Captures screenshots for a single URL (and optionally crawls).
 * For 'full-page': one full-height screenshot.
 * For 'single-viewport': one viewport screenshot per section stop (multi-shot covering whole page).
 */
async function captureScreenshots(job, device, outputFolder, onLog, onFile, { signal } = {}) {
  const { screenshotFilename, slugify, slugifyCustomName } = require('./output-manager')

  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS })
  try {
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }

    const anchorUrl = job.url || (job.bulkUrls && job.bulkUrls[0]) || ''
    const savedHttpAuth = anchorUrl ? getHttpAuth(anchorUrl) : null
    const httpCreds = savedHttpAuth || authHandler.buildHttpCredentials(job.auth)
    if (httpCreds) contextOptions.httpCredentials = httpCreds

    const storageState = anchorUrl ? getStorageState(anchorUrl) : null
    if (storageState) {
      contextOptions.storageState = storageState
      onLog(`Using saved session for ${new URL(anchorUrl).hostname}`)
    }

    const context = await browser.newContext(contextOptions)

    const page = await context.newPage()

    let urlsToCapture

    if (job.bulkUrls && job.bulkUrls.length > 0) {
      urlsToCapture = job.bulkUrls
      onLog(`Bulk mode: ${urlsToCapture.length} URL(s)`)
    } else if (job.crawl) {
      onLog('Starting crawl...')
      const { crawl } = require('./crawler')
      const crawlPage = await context.newPage()
      if (job.auth?.type === 'form') {
        await crawlPage.goto(job.url, { waitUntil: 'domcontentloaded' })
        await authHandler.performFormLogin(crawlPage, { ...job.auth, password: job.auth._resolvedPassword })
      }
      const found = await crawl(crawlPage, job.url, job.crawlMaxPages || 30, onLog)
      await crawlPage.close()
      urlsToCapture = found
      onLog(`Crawl complete: ${found.length} pages`)
    } else {
      urlsToCapture = [job.url]
    }

    const totalPages = urlsToCapture.length
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const url = urlsToCapture[pageIdx]
      if (signal?.aborted) { onLog('Capture cancelled'); break }
      const progressPrefix = totalPages > 1 ? `[${pageIdx + 1}/${totalPages}] ` : ''
      onLog(`${progressPrefix}Capturing: ${url}`)
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: (job.pageLoadTimeout || 30) * 1000 })

        // Form auth (first page only, skipped if crawl already authenticated)
        if (job.auth?.type === 'form' && url === urlsToCapture[0] && !job.crawl) {
          await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        }

        // Inject CSS
        await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

        // For hero shots: no scrolling — capture the initial viewport as-is
        if (job.screenshotType !== 'hero') {
          // Fast scroll to trigger lazy-loaded images
          await triggerLazyLoad(page)
          // Slower scroll to ensure all animations have triggered
          await preCaptureScroll(page)
          await page.waitForTimeout(500)
        }

        // Hero wait
        await page.waitForTimeout((job.heroWaitSeconds ?? 3) * 1000)

        const urlPath = new URL(url).pathname

        // Determine output folder for this page (subfolders per page when crawling or bulk)
        const isMultiPage = urlsToCapture.length > 1
        let pageOutputFolder = outputFolder
        if (isMultiPage) {
          const pageSlug = slugify(urlPath)
          pageOutputFolder = path.join(outputFolder, pageSlug)
          fs.mkdirSync(pageOutputFolder, { recursive: true })
        }

        // Use custom page name only for single-page captures; URL path for crawl/bulk
        const nameSlug = (!isMultiPage && job.pageName)
          ? slugifyCustomName(job.pageName)
          : urlPath

        if (job.screenshotType === 'hero') {
          // Single viewport screenshot at the top of the page, no scrolling
          const filename = screenshotFilename(nameSlug, device.id)
          const filePath = path.join(pageOutputFolder, filename)
          await page.screenshot({ path: filePath, fullPage: false })
          onLog(`${progressPrefix}Saved: ${filename}`)
          onFile(filePath)
        } else if (job.screenshotType === 'full-page') {
          const filename = screenshotFilename(nameSlug, device.id)
          const filePath = path.join(pageOutputFolder, filename)
          await page.screenshot({ path: filePath, fullPage: true })
          onLog(`${progressPrefix}Saved: ${filename}`)
          onFile(filePath)
        } else {
          // Single-viewport multi-shot: screenshot at each section stop
          const stops = await computeScrollStops(page, device.height, url, 'screenshot')
          onLog(`Viewport stops: ${stops.join(', ')}`)

          for (let i = 0; i < stops.length; i++) {
            await page.evaluate(y => window.scrollTo(0, y), stops[i])
            await page.waitForTimeout(300)
            const baseName = screenshotFilename(nameSlug, device.id)
            // Insert stop index before extension: index--macbook-pro--1.png
            const filename = baseName.replace(/\.png$/, `--${i + 1}.png`)
            const filePath = path.join(pageOutputFolder, filename)
            await page.screenshot({ path: filePath, fullPage: false })
            onLog(`${progressPrefix}Saved: ${filename}`)
            onFile(filePath)
          }
        }
      } catch (err) {
        onLog(`Error capturing ${url}: ${err.message}`)
      }
    }
  } finally {
    try { await browser.close() } catch (_) {}
  }
}

/**
 * Manual screenshot mode: opens a headed browser, user navigates freely.
 * Cmd+P captures a numbered screenshot. Close browser or press Escape to end.
 */
async function captureScreenshotsManual(job, device, outputFolder, onLog, onFile) {
  const { screenshotFilename } = require('./output-manager')
  const { globalShortcut } = require('electron')

  const browser = await chromium.launch({
    headless: false,
    args: [
      ...CHROMIUM_ARGS,
      `--window-size=${device.width},${device.height}`,
      '--disable-infobars',
      '--app=about:blank',
      '--disable-component-update',
      '--no-first-run'
    ]
  })

  try {
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }

    const savedHttpAuth = getHttpAuth(job.url)
    const httpCreds = savedHttpAuth || authHandler.buildHttpCredentials(job.auth)
    if (httpCreds) contextOptions.httpCredentials = httpCreds

    const storageState = getStorageState(job.url)
    if (storageState) {
      contextOptions.storageState = storageState
      onLog(`Using saved session for ${new URL(job.url).hostname}`)
    }

    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()

    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
    await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })
    await page.bringToFront()

    onLog('Manual mode active — press Cmd+P to capture, Escape to finish.')

    let shotIndex = 0

    await new Promise(resolve => {
      const takeShot = async () => {
        shotIndex++
        try {
          const currentUrl = page.url()
          const urlPath = new URL(currentUrl).pathname
          const baseName = screenshotFilename(urlPath, device.id)
          const filename = baseName.replace(/\.png$/, `--${String(shotIndex).padStart(3, '0')}.png`)
          const filePath = path.join(outputFolder, filename)
          await page.screenshot({ path: filePath, fullPage: false })
          onLog(`Saved ${shotIndex}: ${filename}`)
          onFile(filePath)
        } catch (err) {
          onLog(`Screenshot error: ${err.message}`)
        }
      }

      globalShortcut.register('CommandOrControl+P', takeShot)
      globalShortcut.register('Escape', () => {
        globalShortcut.unregister('CommandOrControl+P')
        globalShortcut.unregister('Escape')
        resolve()
      })

      browser.on('disconnected', () => {
        try { globalShortcut.unregister('CommandOrControl+P') } catch (_) {}
        try { globalShortcut.unregister('Escape') } catch (_) {}
        resolve()
      })
    })

    onLog(`Manual session ended — ${shotIndex} screenshot(s) saved`)
  } finally {
    try { globalShortcut.unregister('CommandOrControl+P') } catch (_) {}
    try { globalShortcut.unregister('Escape') } catch (_) {}
    try { await browser.close() } catch (_) {}
  }
}

module.exports = { captureScreenshots, captureScreenshotsManual }
