const { chromium } = require('playwright')
const {
  TRANSLATION_DISABLED_ARGS,
  installTranslationSuppression
} = require('../src/main/chromium-translate')

let browser

beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
})

afterAll(async () => {
  await browser?.close()
})

test('uses Chromium flags that disable Translate', () => {
  expect(TRANSLATION_DISABLED_ARGS).toContain('--disable-features=Translate,TranslateUI')
  expect(TRANSLATION_DISABLED_ARGS).toContain('--disable-translate')
})

test('marks reloaded pages as non-translatable before DOMContentLoaded', async () => {
  const context = await browser.newContext()
  await installTranslationSuppression(context)
  const page = await context.newPage()

  for (const label of ['First', 'Reloaded']) {
    await page.goto(`data:text/html,<html><head><title>${label}</title></head><body>${label}</body></html>`)
    const state = await page.evaluate(() => ({
      className: document.documentElement.className,
      translate: document.documentElement.getAttribute('translate'),
      metas: document.querySelectorAll('meta[name="google"][content="notranslate"]').length
    }))
    expect(state.className.split(/\s+/)).toContain('notranslate')
    expect(state.translate).toBe('no')
    expect(state.metas).toBe(1)
  }

  await context.close()
})

test('suppresses translation in pages created after installation', async () => {
  const context = await browser.newContext()
  await installTranslationSuppression(context)
  const page = await context.newPage()
  await page.goto('data:text/html,<html><head><meta name="google" content="notranslate"></head><body>Popup</body></html>')

  expect(await page.locator('meta[name="google"][content="notranslate"]').count()).toBe(1)
  expect(await page.locator('html').getAttribute('translate')).toBe('no')
  await context.close()
})
