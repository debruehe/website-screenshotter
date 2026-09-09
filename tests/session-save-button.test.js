const { chromium } = require('playwright')
const { installSessionSaveButton } = require('../src/main/session-save-button')

let browser

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
})

test('shows Save Session before a page finishes loading', async () => {
  const page = await browser.newPage()
  await page.route('https://session-button.test/never-finishes.png', () => new Promise(() => {}))
  await installSessionSaveButton(page)

  await page.goto(
    'data:text/html,<html><body><img src="https://session-button.test/never-finishes.png"></body></html>',
    { waitUntil: 'domcontentloaded' }
  )

  const button = page.locator('#__wsSaveBtn')
  await button.waitFor({ state: 'visible', timeout: 1000 })
  expect(await button.textContent()).toBe('✅ Save Session & Close')
  await page.close()
})
