function element(overrides = {}) {
  return {
    value: '',
    checked: false,
    disabled: false,
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    ...overrides
  }
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const elements = {}

beforeAll(() => {
  global.window = { api: {} }
  global.document = {
    getElementById: id => elements[id] || (elements[id] = element()),
    querySelector: selector => {
      if (selector === '.mode-btn.active') return element({ dataset: { mode: 'video' } })
      if (selector === 'input[name="scrtype"]:checked') return element({ value: 'full-page' })
      if (selector === 'input[name="dark"]:checked') return element({ value: 'off' })
      if (selector === 'input[name="scroll-mode"]:checked') return element({ value: 'step' })
      return null
    },
    querySelectorAll: () => []
  }
  require('../src/renderer/panels/capture')
})

beforeEach(() => {
  for (const key of Object.keys(elements)) delete elements[key]
  Object.assign(elements, {
    'cap-url': element({ value: 'example.com/work' }),
    'cap-page-name': element({ value: 'Campaign' }),
    'cap-output-root': element({ value: '/captures/custom' }),
    'cap-device': element({ value: 'iphone-16-pro' }),
    'cap-batch': element(),
    'cap-crawl': element(),
    'cap-crawl-max': element({ value: '30' }),
    'cap-bulk': element(),
    'cap-bulk-urls': element(),
    'cap-speed': element({ value: '2000' }),
    'cap-pause': element({ value: '1500' }),
    'cap-scr-manual': element(),
    'cap-manual': element(),
    'cap-hover': element(),
    'cap-smooth-cursor': element(),
    'cap-no-recording': element({ checked: true }),
    'cap-extend': element(),
    'cap-wait': element({ value: '15' }),
    'cap-css': element(),
    'cap-batch-list': element(),
    'scroll-step': element({ value: '75' }),
    'scroll-custom': element()
  })
  window.api = {}
  window.capturePanel._urlSettingsLoadId = 0
  window.capturePanel._urlSettingsLoadPromise = null
  window.capturePanel._urlSettingsTimer = null
})

afterAll(() => {
  delete global.window
  delete global.document
})

test('includes the chosen output location in a capture job', () => {
  expect(window.capturePanel.buildJob()).toMatchObject({
    url: 'https://example.com/work',
    pageName: 'Campaign',
    outputRoot: '/captures/custom',
    noRecording: true
  })
})

test('persists No recording with the URL capture settings', () => {
  expect(window.capturePanel._collectUrlSettings()).toMatchObject({ noRecording: true })
})

test('restores No recording from URL capture settings', async () => {
  elements['cap-no-recording'].checked = false
  window.api.getUrlSettings = jest.fn().mockResolvedValue({ noRecording: true })

  await window.capturePanel.loadUrlSettings('https://example.com/work')

  expect(elements['cap-no-recording'].checked).toBe(true)
})

test('saves even scroll steps in viewport-height units', async () => {
  window.api.saveScrollSettings = jest.fn().mockResolvedValue(undefined)

  await window.capturePanel._saveScrollSettings()

  expect(window.api.saveScrollSettings).toHaveBeenCalledWith(
    'https://example.com/work',
    'video',
    { mode: 'step', stepVh: 75 }
  )
})

test('persists only the output location without overwriting stored page settings', async () => {
  window.api.getUrlSettings = jest.fn().mockResolvedValue({ pageName: 'Stored name', darkMode: true })
  window.api.saveUrlSettings = jest.fn().mockResolvedValue(undefined)

  await window.capturePanel._setOutputRoot('/captures/new')

  expect(window.api.saveUrlSettings).toHaveBeenCalledWith('https://example.com/work', {
    pageName: 'Stored name',
    darkMode: true,
    outputRoot: '/captures/new'
  })
})

test('does not let an older URL settings load overwrite the current subpage', async () => {
  const work = deferred()
  window.api.getUrlSettings = jest.fn(url => {
    if (url.endsWith('/work')) return work.promise
    return Promise.resolve({ outputRoot: '/captures/about' })
  })

  const oldLoad = window.capturePanel.loadUrlSettings('https://example.com/work')
  const currentLoad = window.capturePanel.loadUrlSettings('https://example.com/about')
  await currentLoad
  work.resolve({ outputRoot: '/captures/work' })
  await oldLoad

  expect(elements['cap-output-root'].value).toBe('/captures/about')
})
