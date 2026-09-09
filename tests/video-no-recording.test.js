let mockScrollY = 0

const mockPage = {
  goto: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn().mockResolvedValue(undefined),
  waitForTimeout: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn(async (fn, value) => {
    if (value && typeof value.targetY === 'number') {
      mockScrollY = value.targetY
      return undefined
    }
    if (fn.toString().includes('scrollHeight')) return 1600
    return undefined
  })
}

const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage)
}

const mockBrowser = {
  newContext: jest.fn().mockResolvedValue(mockContext),
  close: jest.fn().mockResolvedValue(undefined)
}

const mockGetFfmpegPath = jest.fn(() => {
  throw new Error('FFmpeg must not be resolved in No recording mode')
})
const mockResolveScreenDeviceIndex = jest.fn(() => {
  throw new Error('Screen capture device must not be resolved in No recording mode')
})
const mockSpawnFfmpeg = jest.fn(() => {
  throw new Error('FFmpeg must not start in No recording mode')
})

jest.mock('playwright', () => ({
  chromium: { launch: jest.fn().mockResolvedValue(mockBrowser) }
}))
jest.mock('electron', () => ({
  screen: { getPrimaryDisplay: jest.fn(() => ({ scaleFactor: 2 })) },
  globalShortcut: {
    register: jest.fn(() => true),
    unregister: jest.fn()
  }
}), { virtual: true })
jest.mock('../src/main/scroll-settings', () => ({
  computeScrollStops: jest.fn().mockResolvedValue([0, 800])
}))
jest.mock('../src/main/session-manager', () => ({ getStorageState: jest.fn(() => null) }))
jest.mock('../src/main/http-auth', () => ({ getForUrl: jest.fn(() => null) }))
jest.mock('../src/main/auth-handler', () => ({ buildHttpCredentials: jest.fn(() => null) }))
jest.mock('../src/main/video-capture-css', () => ({ installVideoCaptureCss: jest.fn() }))
jest.mock('../src/main/chromium-translate', () => ({
  TRANSLATION_DISABLED_ARGS: [],
  installTranslationSuppression: jest.fn()
}))
jest.mock('../src/main/hover-engine', () => ({
  runHoverInteractions: jest.fn(),
  injectFakeCursor: jest.fn(),
  injectSmoothCursor: jest.fn(),
  injectClickVisualizer: jest.fn(),
  findAllHoverTargets: jest.fn().mockResolvedValue([]),
  interactHover: jest.fn()
}))
jest.mock('../src/main/ffmpeg-helper', () => ({
  getFfmpegPath: mockGetFfmpegPath,
  resolveScreenDeviceIndex: mockResolveScreenDeviceIndex,
  buildCaptureArgs: jest.fn(),
  spawnFfmpeg: mockSpawnFfmpeg
}))

const { captureVideo } = require('../src/main/video-engine')

beforeEach(() => {
  mockScrollY = 0
  jest.clearAllMocks()
})

test('scrolls the browser without resolving FFmpeg or emitting a video file', async () => {
  const logs = []
  const onFile = jest.fn()

  await captureVideo({
    url: 'data:text/html,<main>Page</main>',
    bulkUrls: [],
    noRecording: true,
    heroWaitSeconds: 0,
    scrollPause: 0,
    scrollSpeed: 1,
    darkMode: false,
    viewportExtend: 0,
    hoverInteractions: false,
    customCss: '',
    auth: { type: 'none' }
  }, {
    id: 'desktop',
    name: 'Desktop',
    width: 1440,
    height: 800
  }, null, line => logs.push(line), onFile)

  expect(mockScrollY).toBe(800)
  expect(logs.join('\n')).toContain('No recording')
  expect(mockGetFfmpegPath).not.toHaveBeenCalled()
  expect(mockResolveScreenDeviceIndex).not.toHaveBeenCalled()
  expect(mockSpawnFfmpeg).not.toHaveBeenCalled()
  expect(onFile).not.toHaveBeenCalled()
})
