const fs = require('fs')
const path = require('path')
const actualOs = jest.requireActual('os')

const mockHome = path.join(actualOs.tmpdir(), `wss-scroll-settings-test-${Date.now()}`)

jest.mock('os', () => ({ ...jest.requireActual('os'), homedir: () => mockHome }))

const scrollSettings = require('../src/main/scroll-settings')

const pageWithHeight = scrollHeight => ({
  evaluate: jest.fn().mockResolvedValue(scrollHeight)
})

afterEach(() => {
  fs.rmSync(path.join(mockHome, '.web-screenshotter'), { recursive: true, force: true })
})

afterAll(() => {
  fs.rmSync(mockHome, { recursive: true, force: true })
})

test('converts viewport-height steps into absolute pixel stops', async () => {
  const url = 'https://example.com/work'
  scrollSettings.setForUrl(url, 'video', { mode: 'step', stepVh: 50 })

  const stops = await scrollSettings.computeScrollStops(pageWithHeight(2500), 800, url, 'video')

  expect(stops).toEqual([0, 400, 800, 1200, 1600, 1700])
})

test('keeps legacy pixel step settings readable', async () => {
  const url = 'https://example.com/legacy'
  scrollSettings.setForUrl(url, 'video', { mode: 'step', step: 500 })

  const stops = await scrollSettings.computeScrollStops(pageWithHeight(1800), 800, url, 'video')

  expect(stops).toEqual([0, 500, 1000])
})
