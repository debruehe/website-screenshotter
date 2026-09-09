const fs = require('fs')
const path = require('path')
const actualOs = jest.requireActual('os')

const mockHome = path.join(actualOs.tmpdir(), `wss-url-settings-test-${Date.now()}`)

jest.mock('os', () => ({ ...jest.requireActual('os'), homedir: () => mockHome }))

const urlSettings = require('../src/main/url-settings')
const settingsFile = path.join(mockHome, '.web-screenshotter', 'url-settings.json')

afterEach(() => {
  fs.rmSync(path.dirname(settingsFile), { recursive: true, force: true })
})

afterAll(() => {
  fs.rmSync(mockHome, { recursive: true, force: true })
})

test('stores capture settings separately for different subpages on one host', () => {
  urlSettings.setForUrl('https://example.com/work', { outputRoot: '/captures/work' })
  urlSettings.setForUrl('https://example.com/about', { outputRoot: '/captures/about' })

  expect(urlSettings.getForUrl('https://example.com/work')).toEqual({ outputRoot: '/captures/work' })
  expect(urlSettings.getForUrl('https://example.com/about')).toEqual({ outputRoot: '/captures/about' })
})

test('ignores URL fragments when looking up capture settings', () => {
  urlSettings.setForUrl('https://example.com/work#one', { outputRoot: '/captures/work' })

  expect(urlSettings.getForUrl('https://example.com/work#two')).toEqual({ outputRoot: '/captures/work' })
})

test('migrates legacy hostname-scoped settings to a full URL', () => {
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true })
  fs.writeFileSync(settingsFile, JSON.stringify({
    'example.com': { outputRoot: '/captures/legacy' }
  }))

  expect(urlSettings.getForUrl('https://example.com/work')).toEqual({ outputRoot: '/captures/legacy' })

  const stored = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
  expect(stored['example.com']).toBeUndefined()
  expect(stored['https://example.com/work']).toEqual({ outputRoot: '/captures/legacy' })
})
