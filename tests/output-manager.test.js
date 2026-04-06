const path = require('path')
const os = require('os')
const fs = require('fs')

const om = require('../src/main/output-manager')

const TEST_ROOT = path.join(os.tmpdir(), 'wss-output-test-' + Date.now())

afterAll(() => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true })
})

test('slugifies URL paths correctly', () => {
  expect(om.slugify('/')).toBe('index')
  expect(om.slugify('/about-us/')).toBe('about-us')
  expect(om.slugify('/work/project-name')).toBe('work-project-name')
})

test('builds session folder name — single device', () => {
  const name = om.sessionFolderName('https://example.com', '2026-03-28', '14-30', 'macbook-pro', false)
  expect(name).toBe('example.com_2026-03-28_14-30_macbook-pro')
})

test('builds session folder name — multi-device batch', () => {
  const name = om.sessionFolderName('https://example.com', '2026-03-28', '14-30', null, true)
  expect(name).toBe('example.com_2026-03-28_14-30')
})

test('creates output folder and returns path', () => {
  const folderPath = om.createSessionFolder(TEST_ROOT, 'example.com_2026-03-28_14-30_macbook-pro')
  expect(fs.existsSync(folderPath)).toBe(true)
})

test('builds screenshot filename', () => {
  expect(om.screenshotFilename('/about/', 'iphone-16-pro')).toBe('about--iphone-16-pro.png')
  expect(om.screenshotFilename('/', 'macbook-pro')).toBe('index--macbook-pro.png')
})

test('builds video filename', () => {
  expect(om.videoFilename('macbook-pro')).toBe('scroll--macbook-pro.mp4')
})
