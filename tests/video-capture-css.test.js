const { chromium } = require('playwright')
const { installVideoCaptureCss } = require('../src/main/video-capture-css')

let browser

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
})

test('applies tap-highlight suppression before DOMContentLoaded after navigation', async () => {
  const page = await browser.newPage()
  await installVideoCaptureCss(page, 'button { color: rgb(1, 2, 3) !important; }')

  await page.goto('data:text/html,<button id="target">Capture</button>')
  const first = await page.$eval('#target', element => ({
    tap: getComputedStyle(element).webkitTapHighlightColor,
    color: getComputedStyle(element).color,
    installed: Boolean(document.getElementById('__ws_video_capture_css'))
  }))

  await page.goto('data:text/html,<button id="target">Reloaded</button>')
  const second = await page.$eval('#target', element => ({
    tap: getComputedStyle(element).webkitTapHighlightColor,
    installed: Boolean(document.getElementById('__ws_video_capture_css'))
  }))

  expect(first.tap).toBe('rgba(0, 0, 0, 0)')
  expect(first.color).toBe('rgb(1, 2, 3)')
  expect(first.installed).toBe(true)
  expect(second.tap).toBe('rgba(0, 0, 0, 0)')
  expect(second.installed).toBe(true)
  await page.close()
})
