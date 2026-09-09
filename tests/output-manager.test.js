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

test('always includes the URL subpage when a custom page name is present', () => {
  expect(om.capturePageSlug('https://example.com/work/project/', 'Campaign'))
    .toBe('campaign--work-project')
})

test('includes the subpage in non-bulk screenshot and video filenames', () => {
  const job = {
    url: 'https://example.com/work/project/',
    pageName: 'Campaign',
    bulkUrls: []
  }
  const device = { id: 'iphone-16-pro', name: 'iPhone 16 Pro' }

  expect(om.screenshotFilename(om.capturePageSlug(job.url, job.pageName), device.id))
    .toBe('campaign--work-project--iphone-16-pro.png')
  expect(om.captureVideoFilename({ job, device }))
    .toBe('scroll--campaign--work-project--iphone-16-pro.mp4')
})

test('uses a stable URL-specific slug for bulk captures', () => {
  const first = om.batchPageSlug('https://example.com/work?locale=en')
  const second = om.batchPageSlug('https://example.com/work?locale=de')

  expect(first).toMatch(/^work--[a-f0-9]{8}$/)
  expect(second).toMatch(/^work--[a-f0-9]{8}$/)
  expect(first).not.toBe(second)
})

test('uses a per-capture absolute output root with default fallback', () => {
  const settings = { outputRoot: '/default/captures' }

  expect(om.resolveOutputRoot({ outputRoot: '/chosen/captures' }, settings)).toBe('/chosen/captures')
  expect(om.resolveOutputRoot({ outputRoot: '' }, settings)).toBe('/default/captures')
  expect(om.resolveOutputRoot({}, settings)).toBe('/default/captures')
  expect(om.resolveOutputRoot({ outputRoot: 'relative/path' }, settings)).toBe('/default/captures')
})

test('reports that No recording video jobs do not produce capture files', () => {
  expect(om.captureProducesFiles({ mode: 'video', noRecording: true })).toBe(false)
  expect(om.captureProducesFiles({ mode: 'video', noRecording: false })).toBe(true)
  expect(om.captureProducesFiles({ mode: 'screenshot', noRecording: true })).toBe(true)
})
