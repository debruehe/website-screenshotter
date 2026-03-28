const { chromium } = require('playwright')
const path = require('path')
const authHandler = require('./auth-handler')
const { getSectionScrollStops } = require('./section-analyzer')

const DEFAULT_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
`

/**
 * Captures screenshots for a single URL (and optionally crawls).
 * @param {object} job - full job config
 * @param {object} device - { width, height, id }
 * @param {string} outputFolder - absolute folder path for this device
 * @param {function} onLog - log callback
 * @param {function} onFile - called with (filePath) for each saved file
 */
async function captureScreenshots(job, device, outputFolder, onLog, onFile) {
  const { screenshotFilename } = require('./output-manager')
  const fs = require('fs')

  const browser = await chromium.launch({ headless: true })
  const contextOptions = {
    viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
    deviceScaleFactor: 2,
    colorScheme: job.darkMode ? 'dark' : 'light'
  }

  const httpCreds = authHandler.buildHttpCredentials(job.auth)
  if (httpCreds) contextOptions.httpCredentials = httpCreds

  const context = await browser.newContext(contextOptions)
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

      // Form auth (first page only)
      if (job.auth?.type === 'form' && url === urlsToCapture[0]) {
        await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      }

      // Inject CSS
      await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

      // Auto-consent (silent for screenshots)
      try {
        const { autoConsent } = require('@duckduckgo/autoconsent/dist/autoconsent.playwright')
        await autoConsent(page)
      } catch (_) {}
      await page.waitForTimeout(500)

      // Hero wait
      await page.waitForTimeout((job.heroWaitSeconds ?? 3) * 1000)

      const urlPath = new URL(url).pathname
      const filename = screenshotFilename(urlPath, device.id)
      const filePath = path.join(outputFolder, filename)

      await page.screenshot({
        path: filePath,
        fullPage: job.screenshotType === 'full-page'
      })

      onLog(`Saved: ${filename}`)
      onFile(filePath)
    } catch (err) {
      onLog(`Error capturing ${url}: ${err.message}`)
    }
  }

  await browser.close()
}

module.exports = { captureScreenshots }
