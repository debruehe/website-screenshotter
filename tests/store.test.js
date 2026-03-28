const path = require('path')
const os = require('os')
const fs = require('fs')

process.env.STORE_DIR = path.join(os.tmpdir(), 'wss-test-' + Date.now())

const store = require('../src/main/store')

afterAll(() => {
  fs.rmSync(process.env.STORE_DIR, { recursive: true, force: true })
})

test('returns defaults when no settings file exists', () => {
  const s = store.getSettings()
  expect(s.outputRoot).toContain('WebScreenshots')
  expect(s.pageLoadTimeout).toBe(30)
  expect(s.quietMode).toBe(false)
})

test('saves and reloads settings', () => {
  store.saveSettings({ outputRoot: '/tmp/test', pageLoadTimeout: 60 })
  const s = store.getSettings()
  expect(s.outputRoot).toBe('/tmp/test')
  expect(s.pageLoadTimeout).toBe(60)
})
