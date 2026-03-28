const { chromium } = require('playwright')
const path = require('path')
const authHandler = require('./auth-handler')
const { getSectionScrollStops } = require('./section-analyzer')

const DEFAULT_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
`

// Path to the autoconsent browser-side init script
const AUTOCONSENT_SCRIPT = require.resolve('@duckduckgo/autoconsent/dist/autoconsent.playwright.js')

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
 * Captures screenshots for a single URL (and optionally crawls).
 * For 'full-page': one full-height screenshot.
 * For 'single-viewport': one viewport screenshot per section stop (multi-shot covering whole page).
 */
async function captureScreenshots(job, device, outputFolder, onLog, onFile) {
  const { screenshotFilename } = require('./output-manager')

  const browser = await chromium.launch({ headless: true })
  try {
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }

    const httpCreds = authHandler.buildHttpCredentials(job.auth)
    if (httpCreds) contextOptions.httpCredentials = httpCreds

    const context = await browser.newContext(contextOptions)

    // Inject autoconsent as init script — runs in page context automatically
    try { await context.addInitScript({ path: AUTOCONSENT_SCRIPT }) } catch (_) {}

    const page = await context.newPage()

    const urlsToCapture = [job.url]

    // Crawl if requested
    if (job.crawl) {
      onLog('Starting crawl...')
      const { crawl } = require('./crawler')
      const crawlPage = await context.newPage()
      if (job.auth?.type === 'form') {
        await crawlPage.goto(job.url, { waitUntil: 'domcontentloaded' })
        await authHandler.performFormLogin(crawlPage, { ...job.auth, password: job.auth._resolvedPassword })
      }
      const found = await crawl(crawlPage, job.url, job.crawlMaxPages || 30, onLog)
      await crawlPage.close()
      urlsToCapture.splice(0, urlsToCapture.length, ...found)
      onLog(`Crawl complete: ${found.length} pages`)
    }

    for (const url of urlsToCapture) {
      onLog(`Capturing: ${url}`)
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: (job.pageLoadTimeout || 30) * 1000 })

        // Form auth (first page only, skipped if crawl already authenticated)
        if (job.auth?.type === 'form' && url === urlsToCapture[0] && !job.crawl) {
          await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        }

        // Inject CSS
        await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

        // Give autoconsent init script time to handle any cookie banner
        await page.waitForTimeout(1500)

        // Scroll page to trigger lazy-loaded images, then return to top
        await triggerLazyLoad(page)
        await page.waitForTimeout(500)

        // Hero wait
        await page.waitForTimeout((job.heroWaitSeconds ?? 3) * 1000)

        const urlPath = new URL(url).pathname

        if (job.screenshotType === 'full-page') {
          const filename = screenshotFilename(urlPath, device.id)
          const filePath = path.join(outputFolder, filename)
          await page.screenshot({ path: filePath, fullPage: true })
          onLog(`Saved: ${filename}`)
          onFile(filePath)
        } else {
          // Single-viewport multi-shot: screenshot at each section stop
          const stops = await getSectionScrollStops(page, device.height)
          onLog(`Viewport stops: ${stops.join(', ')}`)

          for (let i = 0; i < stops.length; i++) {
            await page.evaluate(y => window.scrollTo(0, y), stops[i])
            await page.waitForTimeout(300)
            const baseName = screenshotFilename(urlPath, device.id)
            // Insert stop index before extension: index--macbook-pro--1.png
            const filename = baseName.replace(/\.png$/, `--${i + 1}.png`)
            const filePath = path.join(outputFolder, filename)
            await page.screenshot({ path: filePath, fullPage: false })
            onLog(`Saved: ${filename}`)
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

module.exports = { captureScreenshots }
