# Web Screenshotter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS Electron app that captures retina screenshots and smooth scroll videos of websites for portfolio production.

**Architecture:** Electron app with a vanilla JS renderer and Node.js main process. Playwright drives Chromium for both headless screenshots and headed video capture. FFmpeg records the headed browser window via `avfoundation` and encodes H.264 MP4. IPC bridges the UI to all capture logic.

**Tech Stack:** Electron 28, Playwright 1.41, FFmpeg (`@ffmpeg-installer/ffmpeg`), `@duckduckgo/autoconsent`, `keytar` (macOS Keychain), `archiver` (ZIP), `uuid`, Jest (tests), `electron-builder` (packaging).

---

## File Map

```
website-screenshotter/
├── package.json
├── electron-builder.json
├── .gitignore
├── src/
│   ├── main/
│   │   ├── index.js               # Electron entry — creates BrowserWindow, registers IPC
│   │   ├── ipc-handlers.js        # Registers all IPC channels, routes to modules
│   │   ├── store.js               # App settings (output folder, timeout, ffmpeg path, quiet mode)
│   │   ├── preset-manager.js      # Device + job preset CRUD (presets.json)
│   │   ├── output-manager.js      # Folder creation, file naming, history.json, ZIP export
│   │   ├── auth-handler.js        # Basic auth + form-based auth
│   │   ├── crawler.js             # Same-domain URL discovery, 30-page cap
│   │   ├── section-analyzer.js    # In-page DOM analysis → scrollY stop list
│   │   ├── screenshot-engine.js   # Headless Playwright screenshot capture
│   │   ├── ffmpeg-helper.js       # avfoundation device index resolution, FFmpeg spawn
│   │   ├── video-engine.js        # Headed Playwright + FFmpeg video capture
│   │   ├── hover-engine.js        # CSSOM :hover scan + smooth cursor interaction
│   │   └── quiet-mode.js          # AppleScript quit/relaunch of app list
│   └── renderer/
│       ├── index.html             # App shell — sidebar + panel slots + log area
│       ├── app.js                 # Panel routing, IPC bridge, log stream
│       ├── panels/
│       │   ├── capture.js         # Capture panel: form state, validation, job build
│       │   ├── queue.js           # Queue panel: job list, status updates, drag reorder
│       │   ├── history.js         # History panel: thumbnail grid, re-run, ZIP, delete
│       │   └── settings.js        # Settings panel: folder picker, presets editor, quiet mode
│       ├── components/
│       │   └── log.js             # Log component: append lines, auto-scroll, clear
│       └── styles/
│           └── app.css            # All app styles
├── tests/
│   ├── crawler.test.js
│   ├── output-manager.test.js
│   ├── preset-manager.test.js
│   ├── auth-handler.test.js
│   └── section-analyzer.test.js
└── docs/
    └── superpowers/
        ├── specs/
        └── plans/
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `electron-builder.json`
- Create: `.gitignore`
- Create: `src/main/index.js`
- Create: `src/renderer/index.html`

- [ ] **Step 1: Initialize npm project**

```bash
cd /path/to/website-screenshotter
npm init -y
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install electron@28 playwright@1.41 @duckduckgo/autoconsent keytar @ffmpeg-installer/ffmpeg archiver uuid
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev jest electron-builder
```

- [ ] **Step 4: Write package.json scripts and Jest config**

Replace the generated `package.json` with:

```json
{
  "name": "web-screenshotter",
  "version": "1.0.0",
  "description": "macOS app for retina website screenshots and scroll videos",
  "main": "src/main/index.js",
  "scripts": {
    "start": "electron .",
    "test": "jest --testPathPattern=tests/",
    "build": "electron-builder --mac"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"]
  },
  "dependencies": {
    "electron": "^28.0.0",
    "playwright": "^1.41.0",
    "@duckduckgo/autoconsent": "^9.0.0",
    "keytar": "^7.9.0",
    "@ffmpeg-installer/ffmpeg": "^1.1.0",
    "archiver": "^6.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "electron-builder": "^24.0.0"
  }
}
```

- [ ] **Step 5: Write electron-builder.json**

```json
{
  "appId": "com.yourname.webscreenshotter",
  "productName": "Web Screenshotter",
  "mac": {
    "category": "public.app-category.productivity",
    "target": "dmg",
    "identity": null
  },
  "files": [
    "src/**/*",
    "node_modules/**/*"
  ],
  "extraResources": [
    {
      "from": "node_modules/@ffmpeg-installer/darwin-x64/ffmpeg",
      "to": "ffmpeg"
    }
  ]
}
```

- [ ] **Step 6: Write .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 7: Write the minimal Electron entry point**

`src/main/index.js`:
```js
const { app, BrowserWindow } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
```

- [ ] **Step 8: Write the minimal renderer shell**

`src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web Screenshotter</title>
  <link rel="stylesheet" href="styles/app.css">
</head>
<body>
  <div id="app">
    <aside id="sidebar">
      <nav>
        <button class="nav-btn active" data-panel="capture">📷 Capture</button>
        <button class="nav-btn" data-panel="queue">📋 Queue</button>
        <button class="nav-btn" data-panel="history">🕐 History</button>
        <button class="nav-btn" data-panel="settings">⚙️ Settings</button>
      </nav>
    </aside>
    <main id="content">
      <div id="panel-capture" class="panel active"></div>
      <div id="panel-queue" class="panel"></div>
      <div id="panel-history" class="panel"></div>
      <div id="panel-settings" class="panel"></div>
    </main>
  </div>
  <footer id="log-area">
    <div id="log-output"></div>
  </footer>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 9: Verify app launches**

```bash
npm start
```
Expected: Electron window opens with an empty shell. No errors in terminal.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron app with minimal shell"
```

---

## Task 2: IPC Preload Bridge

**Files:**
- Create: `src/main/preload.js`

The preload script safely exposes IPC to the renderer via `contextBridge`.

- [ ] **Step 1: Write preload.js**

`src/main/preload.js`:
```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Job control
  startCapture: (job) => ipcRenderer.invoke('capture:start', job),
  cancelJob: (jobId) => ipcRenderer.invoke('capture:cancel', jobId),

  // Presets
  getPresets: () => ipcRenderer.invoke('presets:get'),
  savePreset: (preset) => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (id) => ipcRenderer.invoke('presets:delete', id),
  getDevices: () => ipcRenderer.invoke('devices:get'),
  saveDevice: (device) => ipcRenderer.invoke('devices:save', device),
  deleteDevice: (id) => ipcRenderer.invoke('devices:delete', id),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('history:delete', id),
  exportZip: (sessionId) => ipcRenderer.invoke('history:zip', sessionId),
  openFolder: (folderPath) => ipcRenderer.invoke('fs:openFolder', folderPath),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Keychain
  savePassword: (ref, password) => ipcRenderer.invoke('keychain:save', ref, password),
  deletePassword: (ref) => ipcRenderer.invoke('keychain:delete', ref),

  // Events from main → renderer
  onLog: (cb) => ipcRenderer.on('log', (_, line) => cb(line)),
  onJobUpdate: (cb) => ipcRenderer.on('job:update', (_, update) => cb(update)),
  onSetupProgress: (cb) => ipcRenderer.on('setup:progress', (_, data) => cb(data))
})
```

- [ ] **Step 2: Update BrowserWindow to use preload**

In `src/main/index.js`, the preload path is already set to `path.join(__dirname, 'preload.js')` from Task 1. Verify it points to `src/main/preload.js`. ✓

- [ ] **Step 3: Verify**

```bash
npm start
```
Expected: App opens, no errors. Open DevTools (View → Toggle Developer Tools), confirm `window.api` exists and is an object.

- [ ] **Step 4: Commit**

```bash
git add src/main/preload.js
git commit -m "feat: add IPC preload bridge"
```

---

## Task 3: Store (App Settings)

**Files:**
- Create: `src/main/store.js`
- Test: `tests/store.test.js`

Reads/writes a `settings.json` in `~/Library/Application Support/WebScreenshotter/`.

- [ ] **Step 1: Write the failing test**

`tests/store.test.js`:
```js
const path = require('path')
const os = require('os')
const fs = require('fs')

// Point store to a temp dir for testing
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
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- tests/store.test.js
```
Expected: FAIL — `Cannot find module '../src/main/store'`

- [ ] **Step 3: Implement store.js**

`src/main/store.js`:
```js
const fs = require('fs')
const path = require('path')
const os = require('os')

const STORE_DIR = process.env.STORE_DIR ||
  path.join(os.homedir(), 'Library', 'Application Support', 'WebScreenshotter')
const SETTINGS_FILE = path.join(STORE_DIR, 'settings.json')

const DEFAULTS = {
  outputRoot: path.join(os.homedir(), 'Desktop', 'WebScreenshots'),
  pageLoadTimeout: 30,
  ffmpegPath: '',
  quietMode: false,
  quietModeApps: ['Slack', 'Spotify', 'Google Chrome', 'Mail', 'Safari'],
  quietModeRelaunch: true
}

function ensureDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true })
}

function getSettings() {
  ensureDir()
  if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveSettings(updates) {
  ensureDir()
  const current = getSettings()
  const next = { ...current, ...updates }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2))
  return next
}

module.exports = { getSettings, saveSettings }
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- tests/store.test.js
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/store.js tests/store.test.js
git commit -m "feat: add store module for app settings"
```

---

## Task 4: Preset Manager

**Files:**
- Create: `src/main/preset-manager.js`
- Test: `tests/preset-manager.test.js`

- [ ] **Step 1: Write the failing tests**

`tests/preset-manager.test.js`:
```js
const path = require('path')
const os = require('os')
const fs = require('fs')

process.env.STORE_DIR = path.join(os.tmpdir(), 'wss-preset-test-' + Date.now())

const pm = require('../src/main/preset-manager')

afterAll(() => {
  fs.rmSync(process.env.STORE_DIR, { recursive: true, force: true })
})

test('returns 5 built-in devices on first load', () => {
  const devices = pm.getDevices()
  expect(devices).toHaveLength(5)
  expect(devices.find(d => d.id === 'macbook-pro')).toBeDefined()
})

test('saves and retrieves a custom device', () => {
  pm.saveDevice({ id: 'test-device', name: 'Test', width: 800, height: 600 })
  const devices = pm.getDevices()
  expect(devices.find(d => d.id === 'test-device')).toBeDefined()
})

test('deletes a device', () => {
  pm.deleteDevice('test-device')
  const devices = pm.getDevices()
  expect(devices.find(d => d.id === 'test-device')).toBeUndefined()
})

test('saves and retrieves a job preset', () => {
  const job = { id: 'j1', name: 'Test Job', url: 'https://example.com', device: 'macbook-pro' }
  pm.saveJobPreset(job)
  const jobs = pm.getJobPresets()
  expect(jobs.find(j => j.id === 'j1')).toMatchObject({ url: 'https://example.com' })
})

test('deletes a job preset', () => {
  pm.deleteJobPreset('j1')
  expect(pm.getJobPresets().find(j => j.id === 'j1')).toBeUndefined()
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -- tests/preset-manager.test.js
```
Expected: FAIL

- [ ] **Step 3: Implement preset-manager.js**

`src/main/preset-manager.js`:
```js
const fs = require('fs')
const path = require('path')
const os = require('os')

const STORE_DIR = process.env.STORE_DIR ||
  path.join(os.homedir(), 'Library', 'Application Support', 'WebScreenshotter')
const PRESETS_FILE = path.join(STORE_DIR, 'presets.json')

const BUILT_IN_DEVICES = [
  { id: 'full-hd', name: 'Full HD Desktop', width: 1920, height: 1080 },
  { id: 'macbook-pro', name: 'MacBook Pro', width: 1440, height: 900 },
  { id: 'ipad-portrait', name: 'iPad Portrait', width: 768, height: 1024 },
  { id: 'ipad-landscape', name: 'iPad Landscape', width: 1024, height: 768 },
  { id: 'iphone-16-pro', name: 'iPhone 16 Pro', width: 393, height: 852 }
]

function ensureDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true })
}

function load() {
  ensureDir()
  if (!fs.existsSync(PRESETS_FILE)) {
    return { devices: [...BUILT_IN_DEVICES], jobs: [] }
  }
  try {
    const data = JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'))
    return {
      devices: data.devices || [...BUILT_IN_DEVICES],
      jobs: data.jobs || []
    }
  } catch {
    return { devices: [...BUILT_IN_DEVICES], jobs: [] }
  }
}

function save(data) {
  ensureDir()
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(data, null, 2))
}

function getDevices() { return load().devices }

function saveDevice(device) {
  const data = load()
  const idx = data.devices.findIndex(d => d.id === device.id)
  if (idx >= 0) data.devices[idx] = device
  else data.devices.push(device)
  save(data)
}

function deleteDevice(id) {
  const data = load()
  data.devices = data.devices.filter(d => d.id !== id)
  save(data)
}

function getJobPresets() { return load().jobs }

function saveJobPreset(job) {
  const data = load()
  const idx = data.jobs.findIndex(j => j.id === job.id)
  if (idx >= 0) data.jobs[idx] = job
  else data.jobs.push(job)
  save(data)
}

function deleteJobPreset(id) {
  const data = load()
  data.jobs = data.jobs.filter(j => j.id !== id)
  save(data)
}

module.exports = { getDevices, saveDevice, deleteDevice, getJobPresets, saveJobPreset, deleteJobPreset }
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test -- tests/preset-manager.test.js
```
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/preset-manager.js tests/preset-manager.test.js
git commit -m "feat: add preset manager for devices and job configs"
```

---

## Task 5: Output Manager

**Files:**
- Create: `src/main/output-manager.js`
- Test: `tests/output-manager.test.js`

- [ ] **Step 1: Write failing tests**

`tests/output-manager.test.js`:
```js
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
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -- tests/output-manager.test.js
```

- [ ] **Step 3: Implement output-manager.js**

`src/main/output-manager.js`:
```js
const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')

const STORE_DIR = process.env.STORE_DIR ||
  path.join(os.homedir(), 'Library', 'Application Support', 'WebScreenshotter')
const HISTORY_FILE = path.join(STORE_DIR, 'history.json')

function ensureDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true })
}

function slugify(urlPath) {
  const cleaned = urlPath.replace(/^\/|\/$/g, '').replace(/\//g, '-')
  return cleaned || 'index'
}

function sessionFolderName(url, date, time, deviceId, isBatch) {
  const hostname = new URL(url).hostname
  if (isBatch) return `${hostname}_${date}_${time}`
  return `${hostname}_${date}_${time}_${deviceId}`
}

function createSessionFolder(outputRoot, folderName) {
  const folderPath = path.join(outputRoot, folderName)
  fs.mkdirSync(folderPath, { recursive: true })
  return folderPath
}

function screenshotFilename(urlPath, deviceId) {
  return `${slugify(urlPath)}--${deviceId}.png`
}

function videoFilename(deviceId) {
  return `scroll--${deviceId}.mp4`
}

function nowStamps() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16).replace(':', '-')
  return { date, time }
}

function getHistory() {
  ensureDir()
  if (!fs.existsSync(HISTORY_FILE)) return []
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) } catch { return [] }
}

function addHistoryEntry(entry) {
  ensureDir()
  const history = getHistory()
  history.unshift(entry)
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

function deleteHistoryEntry(id) {
  const history = getHistory().filter(e => e.id !== id)
  ensureDir()
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

function exportZip(sessionFolder) {
  return new Promise((resolve, reject) => {
    const zipPath = sessionFolder.replace(/\/?$/, '.zip')
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', () => resolve(zipPath))
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sessionFolder, path.basename(sessionFolder))
    archive.finalize()
  })
}

module.exports = {
  slugify, sessionFolderName, createSessionFolder,
  screenshotFilename, videoFilename, nowStamps,
  getHistory, addHistoryEntry, deleteHistoryEntry, exportZip
}
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test -- tests/output-manager.test.js
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/output-manager.js tests/output-manager.test.js
git commit -m "feat: add output manager for folder naming, history, and ZIP export"
```

---

## Task 6: Auth Handler

**Files:**
- Create: `src/main/auth-handler.js`
- Test: `tests/auth-handler.test.js`

The auth handler prepares a Playwright context/page for authenticated capture.

- [ ] **Step 1: Write failing test**

`tests/auth-handler.test.js`:
```js
const authHandler = require('../src/main/auth-handler')

test('returns null config for auth type "none"', () => {
  const config = authHandler.buildHttpCredentials({ type: 'none' })
  expect(config).toBeNull()
})

test('returns http credentials for auth type "basic"', () => {
  const config = authHandler.buildHttpCredentials({ type: 'basic', username: 'admin', password: 'secret' })
  expect(config).toEqual({ username: 'admin', password: 'secret' })
})

test('throws if form auth is missing required fields', () => {
  expect(() => authHandler.validateFormAuth({ type: 'form', formPasswordSelector: '' }))
    .toThrow('formPasswordSelector')
})

test('passes validation for complete form auth config', () => {
  expect(() => authHandler.validateFormAuth({
    type: 'form',
    formPasswordSelector: '#password',
    formSubmitSelector: 'button[type=submit]',
    password: 'secret'
  })).not.toThrow()
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -- tests/auth-handler.test.js
```

- [ ] **Step 3: Implement auth-handler.js**

`src/main/auth-handler.js`:
```js
/**
 * Builds httpCredentials config for Playwright context (Basic auth).
 * Returns null if auth type is not 'basic'.
 */
function buildHttpCredentials(authConfig) {
  if (!authConfig || authConfig.type !== 'basic') return null
  return { username: authConfig.username, password: authConfig.password }
}

/**
 * Validates form auth config — throws with a descriptive message if invalid.
 */
function validateFormAuth(authConfig) {
  if (!authConfig.formPasswordSelector) throw new Error('formPasswordSelector is required for form auth')
  if (!authConfig.formSubmitSelector) throw new Error('formSubmitSelector is required for form auth')
  if (!authConfig.password) throw new Error('password is required for form auth')
}

/**
 * Executes form-based login on a Playwright page.
 * Throws if login cannot be verified.
 */
async function performFormLogin(page, authConfig) {
  validateFormAuth(authConfig)
  await page.fill(authConfig.formPasswordSelector, authConfig.password)
  await page.click(authConfig.formSubmitSelector)
  await page.waitForNavigation({ timeout: 15000 }).catch(() => {})
  if (authConfig.postLoginUrlPattern) {
    const currentUrl = page.url()
    if (!currentUrl.includes(authConfig.postLoginUrlPattern)) {
      throw new Error(`Login failed — check selectors and credentials. Current URL: ${currentUrl}`)
    }
  }
}

module.exports = { buildHttpCredentials, validateFormAuth, performFormLogin }
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test -- tests/auth-handler.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/auth-handler.js tests/auth-handler.test.js
git commit -m "feat: add auth handler for basic and form-based login"
```

---

## Task 7: Crawler

**Files:**
- Create: `src/main/crawler.js`
- Test: `tests/crawler.test.js`

- [ ] **Step 1: Write failing tests**

`tests/crawler.test.js`:
```js
const { filterLinks, SKIP_EXTENSIONS } = require('../src/main/crawler')

const BASE = 'https://example.com'

test('keeps same-hostname links', () => {
  const links = ['https://example.com/about', 'https://example.com/work']
  expect(filterLinks(links, BASE, [])).toEqual(links)
})

test('removes links from different hostname', () => {
  const links = ['https://other.com/page', 'https://example.com/valid']
  expect(filterLinks(links, BASE, [])).toEqual(['https://example.com/valid'])
})

test('removes subdomains', () => {
  const links = ['https://blog.example.com/post', 'https://example.com/home']
  expect(filterLinks(links, BASE, [])).toEqual(['https://example.com/home'])
})

test('removes already-visited URLs', () => {
  const links = ['https://example.com/about', 'https://example.com/new']
  expect(filterLinks(links, BASE, ['https://example.com/about'])).toEqual(['https://example.com/new'])
})

test('removes anchor variants of queued URLs', () => {
  const links = ['https://example.com/about#section', 'https://example.com/new']
  expect(filterLinks(links, BASE, ['https://example.com/about'])).toEqual(['https://example.com/new'])
})

test('removes non-HTTP links and file extensions', () => {
  const links = [
    'mailto:test@test.com',
    'https://example.com/file.pdf',
    'https://example.com/img.png',
    'https://example.com/valid'
  ]
  expect(filterLinks(links, BASE, [])).toEqual(['https://example.com/valid'])
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -- tests/crawler.test.js
```

- [ ] **Step 3: Implement crawler.js**

`src/main/crawler.js`:
```js
const SKIP_EXTENSIONS = ['.pdf', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.webp', '.ico', '.woff', '.woff2']

function filterLinks(links, baseUrl, visited) {
  const baseHost = new URL(baseUrl).hostname
  const visitedBases = visited.map(u => {
    try { return new URL(u).origin + new URL(u).pathname } catch { return u }
  })

  return links.filter(link => {
    let parsed
    try { parsed = new URL(link) } catch { return false }

    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    if (parsed.hostname !== baseHost) return false
    if (SKIP_EXTENSIONS.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) return false

    const base = parsed.origin + parsed.pathname
    if (visitedBases.includes(base)) return false

    return true
  }).map(link => {
    const parsed = new URL(link)
    return parsed.origin + parsed.pathname + parsed.search
  })
}

/**
 * Discovers all crawlable links on a Playwright page.
 */
async function discoverLinks(page, baseUrl) {
  const hrefs = await page.$$eval('a[href]', els =>
    els.map(el => el.href).filter(Boolean)
  )
  return [...new Set(hrefs)]
}

/**
 * Crawls a site starting from startUrl, up to maxPages.
 * Returns an ordered array of URLs to capture (includes startUrl).
 */
async function crawl(page, startUrl, maxPages = 30, onLog = () => {}) {
  const cap = Math.min(maxPages, 30)
  const queue = [startUrl]
  const visited = []

  while (queue.length > 0 && visited.length < cap) {
    const url = queue.shift()
    if (visited.includes(url)) continue
    visited.push(url)
    onLog(`Crawling: ${url}`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const found = await discoverLinks(page, startUrl)
      const newLinks = filterLinks(found, startUrl, visited.concat(queue))
      queue.push(...newLinks)
      onLog(`Found ${newLinks.length} new links on ${url}`)
    } catch (err) {
      onLog(`Error crawling ${url}: ${err.message}`)
    }
  }

  return visited
}

module.exports = { filterLinks, discoverLinks, crawl, SKIP_EXTENSIONS }
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test -- tests/crawler.test.js
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/crawler.js tests/crawler.test.js
git commit -m "feat: add crawler with same-domain filtering and 30-page cap"
```

---

## Task 8: Section Analyzer

**Files:**
- Create: `src/main/section-analyzer.js`
- Test: `tests/section-analyzer.test.js`

The section analyzer returns an in-page function string that is passed to `page.evaluate()`. We test the logic in isolation by running it in a mock DOM.

- [ ] **Step 1: Write failing test**

`tests/section-analyzer.test.js`:
```js
const { getSectionScrollStops } = require('../src/main/section-analyzer')

// Simulate a Playwright page with a mock evaluate
function mockPage(scrollHeight, sectionOffsets) {
  return {
    evaluate: async (fn, args) => fn(args)
  }
}

// We test the pure analysis function directly
const { analyzeSections } = require('../src/main/section-analyzer')

test('returns fixed steps when no sections found', () => {
  const stops = analyzeSections([], 900, 3000)
  expect(stops[0]).toBe(0)
  expect(stops).toContain(1000)
  expect(stops).toContain(2000)
})

test('returns section-based stops when sections found', () => {
  const sections = [
    { top: 0, height: 800 },
    { top: 900, height: 700 },
    { top: 1700, height: 600 }
  ]
  const stops = analyzeSections(sections, 900, 3000)
  expect(stops).toContain(0)
  expect(stops).toContain(900)
  expect(stops).toContain(1700)
})

test('filters sections shorter than threshold', () => {
  const sections = [
    { top: 0, height: 900 },
    { top: 100, height: 50 },  // too short
    { top: 1000, height: 800 }
  ]
  const stops = analyzeSections(sections, 900, 2000)
  expect(stops).not.toContain(100)
})

test('deduplicates stops within 100px', () => {
  const sections = [
    { top: 0, height: 900 },
    { top: 50, height: 900 },  // within 100px of 0
    { top: 1000, height: 900 }
  ]
  const stops = analyzeSections(sections, 900, 2000)
  const nearZero = stops.filter(s => s < 100)
  expect(nearZero).toHaveLength(1)
})
```

- [ ] **Step 2: Run — verify fails**

```bash
npm test -- tests/section-analyzer.test.js
```

- [ ] **Step 3: Implement section-analyzer.js**

`src/main/section-analyzer.js`:
```js
/**
 * Pure function — called both in tests and via page.evaluate().
 * Takes an array of {top, height} objects and returns scrollY stop points.
 */
function analyzeSections(sections, viewportHeight, scrollHeight) {
  const minHeight = Math.max(200, viewportHeight * 0.25)
  const qualified = sections.filter(s => s.height >= minHeight)

  if (qualified.length < 2) {
    // Fallback: fixed 1000px steps
    const stops = []
    for (let y = 0; y < scrollHeight; y += 1000) stops.push(y)
    return stops
  }

  // Deduplicate: remove any stop within 100px of a previous one
  const rawStops = qualified.map(s => Math.round(s.top))
  const deduped = rawStops.sort((a, b) => a - b).filter((stop, i, arr) => {
    if (i === 0) return true
    return stop - arr[i - 1] > 100
  })

  return deduped
}

/**
 * Runs in-page via page.evaluate() to extract section boundaries.
 * Returns array of {top, height} for qualifying elements.
 */
const IN_PAGE_SCRIPT = `
(function() {
  const selectors = 'section, article, [id], .section, [class*="section"]'
  const containers = ['main', '#app', '#root', '.container']
  const candidates = new Set()

  document.querySelectorAll(selectors).forEach(el => candidates.add(el))
  containers.forEach(sel => {
    const parent = document.querySelector(sel)
    if (parent) Array.from(parent.children).forEach(el => candidates.add(el))
  })

  return Array.from(candidates).map(el => {
    const rect = el.getBoundingClientRect()
    return {
      top: rect.top + window.scrollY,
      height: rect.height
    }
  })
})()
`

/**
 * Runs the section analysis on a Playwright page.
 * Returns a sorted array of scrollY stop points.
 */
async function getSectionScrollStops(page, viewportHeight) {
  const sections = await page.evaluate(IN_PAGE_SCRIPT)
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
  return analyzeSections(sections, viewportHeight, scrollHeight)
}

module.exports = { analyzeSections, getSectionScrollStops }
```

- [ ] **Step 4: Run — verify passes**

```bash
npm test -- tests/section-analyzer.test.js
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/main/section-analyzer.js tests/section-analyzer.test.js
git commit -m "feat: add section analyzer for scroll stop detection"
```

---

## Task 9: FFmpeg Helper

**Files:**
- Create: `src/main/ffmpeg-helper.js`

This module resolves the `avfoundation` screen device index at runtime and provides the FFmpeg spawn helper used by the video engine.

- [ ] **Step 1: Implement ffmpeg-helper.js**

No automated test (requires macOS display hardware). Test manually in Task 12.

`src/main/ffmpeg-helper.js`:
```js
const { spawn, spawnSync } = require('child_process')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')

function getFfmpegPath(override) {
  return override || ffmpegInstaller.path
}

/**
 * Queries avfoundation device list and returns the index of the first screen device.
 * Falls back to "0" if parsing fails.
 */
function resolveScreenDeviceIndex(ffmpegPath) {
  try {
    const result = spawnSync(ffmpegPath, ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''], {
      encoding: 'utf8',
      timeout: 5000
    })
    // Output goes to stderr
    const output = result.stderr || ''
    const lines = output.split('\n')
    // Look for lines like: [AVFoundation indev @ ...] [0] Capture screen 0
    for (const line of lines) {
      if (line.includes('Capture screen') || line.includes('screen')) {
        const match = line.match(/\[(\d+)\]/)
        if (match) return match[1]
      }
    }
  } catch (_) {}
  return '0'
}

/**
 * Builds the FFmpeg args for screen capture with crop.
 * @param {string} deviceIndex - avfoundation screen index
 * @param {number} width - viewport width in logical pixels
 * @param {number} height - viewport height in logical pixels
 * @param {number} scaleFactor - display scale factor (2 for Retina)
 * @param {string} outputPath - output MP4 path
 */
function buildCaptureArgs(deviceIndex, width, height, scaleFactor, outputPath) {
  const W = width * scaleFactor
  const H = height * scaleFactor
  const Y = 23 * scaleFactor  // offset for macOS menu bar
  return [
    '-f', 'avfoundation',
    '-capture_cursor', '0',
    '-framerate', '60',
    '-i', deviceIndex,
    '-vf', `crop=${W}:${H}:0:${Y}`,
    '-r', '60',
    '-vcodec', 'libx264',
    '-crf', '18',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    outputPath
  ]
}

/**
 * Spawns FFmpeg and returns the child process.
 * onLog receives stderr lines.
 */
function spawnFfmpeg(ffmpegPath, args, onLog) {
  const proc = spawn(ffmpegPath, args)
  proc.stderr.on('data', data => onLog(data.toString()))
  return proc
}

module.exports = { getFfmpegPath, resolveScreenDeviceIndex, buildCaptureArgs, spawnFfmpeg }
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ffmpeg-helper.js
git commit -m "feat: add FFmpeg helper for avfoundation index resolution and capture args"
```

---

## Task 10: Screenshot Engine

**Files:**
- Create: `src/main/screenshot-engine.js`

Integration module — no unit test (requires live Playwright). Manually verified in Task 13.

- [ ] **Step 1: Implement screenshot-engine.js**

`src/main/screenshot-engine.js`:
```js
const { chromium } = require('playwright')
const path = require('path')
const authHandler = require('./auth-handler')
const { getSectionScrollStops } = require('./section-analyzer')

const DEFAULT_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
`

/**
 * Captures screenshots for a single URL (and optionally crawls).
 * @param {object} job - full job config
 * @param {object} device - { width, height, id }
 * @param {string} outputFolder - absolute folder path for this device
 * @param {function} onLog - log callback
 * @param {function} onFile - called with (filePath) for each saved file
 */
async function captureScreenshots(job, device, outputFolder, onLog, onFile) {
  const { outputManager } = require('./output-manager')
  const path = require('path')
  const fs = require('fs')

  const browser = await chromium.launch({ headless: true })
  const contextOptions = {
    viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
    deviceScaleFactor: 2,
    colorScheme: job.darkMode ? 'dark' : 'light'
  }

  const httpCreds = authHandler.buildHttpCredentials(job.auth)
  if (httpCreds) contextOptions.httpCredentials = httpCreds

  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()

  const urlsToCapture = [job.url]

  // Crawl if requested
  if (job.crawl) {
    onLog('Starting crawl...')
    const { crawl } = require('./crawler')
    const crawlPage = await context.newPage()
    if (job.auth?.type === 'form') {
      await crawlPage.goto(job.url, { waitUntil: 'domcontentloaded' })
      await authHandler.performFormLogin(crawlPage, { ...job.auth, password: job.auth._resolvedPassword })
    }
    const found = await crawl(crawlPage, job.url, job.crawlMaxPages || 30, onLog)
    await crawlPage.close()
    urlsToCapture.splice(0, urlsToCapture.length, ...found)
    onLog(`Crawl complete: ${found.length} pages`)
  }

  for (const url of urlsToCapture) {
    onLog(`Capturing: ${url}`)
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: (job.pageLoadTimeout || 30) * 1000 })

      // Form auth (first page only)
      if (job.auth?.type === 'form' && url === urlsToCapture[0]) {
        await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      }

      // Inject CSS
      await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

      // Auto-consent (silent for screenshots)
      try {
        const { autoConsent } = require('@duckduckgo/autoconsent/dist/autoconsent.playwright')
        await autoConsent(page)
      } catch (_) {}
      await page.waitForTimeout(500)

      // Hero wait
      await page.waitForTimeout((job.heroWaitSeconds ?? 3) * 1000)

      const urlPath = new URL(url).pathname
      const { screenshotFilename } = require('./output-manager')
      const filename = screenshotFilename(urlPath, device.id)
      const filePath = path.join(outputFolder, filename)

      await page.screenshot({
        path: filePath,
        fullPage: job.screenshotType === 'full-page'
      })

      onLog(`Saved: ${filename}`)
      onFile(filePath)
    } catch (err) {
      onLog(`Error capturing ${url}: ${err.message}`)
    }
  }

  await browser.close()
}

module.exports = { captureScreenshots }
```

- [ ] **Step 2: Commit**

```bash
git add src/main/screenshot-engine.js
git commit -m "feat: add screenshot engine with crawl, auth, autoconsent, and CSS injection"
```

---

## Task 11: Video Engine

**Files:**
- Create: `src/main/video-engine.js`
- Create: `src/main/hover-engine.js`
- Create: `src/main/quiet-mode.js`

- [ ] **Step 1: Implement quiet-mode.js**

`src/main/quiet-mode.js`:
```js
const { execSync, exec } = require('child_process')

function quitApp(appName) {
  try {
    execSync(`osascript -e 'tell application "${appName}" to quit'`, { timeout: 5000 })
    return true
  } catch (_) {
    return false
  }
}

function relaunchApp(appName) {
  exec(`open -a "${appName}"`)
}

/**
 * Quits all apps in the list. Returns array of app names that were successfully quit.
 */
function quietDown(appNames, onLog) {
  const quit = []
  for (const app of appNames) {
    if (quitApp(app)) {
      onLog(`Quiet mode: quit ${app}`)
      quit.push(app)
    }
  }
  return quit
}

/**
 * Relaunches previously-quit apps.
 */
function relaunchAll(appNames, onLog) {
  for (const app of appNames) {
    relaunchApp(app)
    onLog(`Quiet mode: relaunched ${app}`)
  }
}

module.exports = { quietDown, relaunchAll }
```

- [ ] **Step 2: Implement hover-engine.js**

`src/main/hover-engine.js`:
```js
/**
 * In-page script: scans CSSOM for :hover rules.
 * Returns array of { selector, baseSelector } for selectors with :hover.
 */
const HOVER_SCAN_SCRIPT = `
(function() {
  const hoverSelectors = new Set()
  try {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule.selectorText && rule.selectorText.includes(':hover')) {
            const base = rule.selectorText.replace(/:hover.*/, '').trim()
            if (base) hoverSelectors.add(base)
          }
        })
      } catch (_) {} // cross-origin stylesheets
    })
  } catch (_) {}
  return Array.from(hoverSelectors)
})()
`

/**
 * Finds first visible element for each hover selector in current viewport.
 */
async function findHoverTargets(page, scrollY, viewportHeight) {
  const selectors = await page.evaluate(HOVER_SCAN_SCRIPT)
  const targets = []
  const seen = new Set()

  for (const selector of selectors) {
    // Derive a clean base selector (avoid duplicates)
    const base = selector.split(/[\s>+~]/)[0].replace(/::.*/, '')
    if (seen.has(base)) continue

    try {
      const el = await page.$(selector)
      if (!el) continue
      const box = await el.boundingBox()
      if (!box) continue

      // Only target elements visible in current viewport
      const elTop = box.y + scrollY
      if (elTop < scrollY || elTop > scrollY + viewportHeight) continue

      targets.push({ selector, box })
      seen.add(base)
    } catch (_) {}
  }

  return targets
}

/**
 * Smoothly moves cursor to an element, pauses, returns to center.
 */
async function interactHover(page, box, viewportWidth, viewportHeight, onLog) {
  const targetX = box.x + box.width / 2
  const targetY = box.y + box.height / 2
  const steps = 20

  onLog(`Hover: moving to element at (${Math.round(targetX)}, ${Math.round(targetY)})`)

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    await page.mouse.move(
      viewportWidth / 2 + (targetX - viewportWidth / 2) * eased,
      viewportHeight / 2 + (targetY - viewportHeight / 2) * eased
    )
    await page.waitForTimeout(400 / steps)
  }

  await page.waitForTimeout(1500)

  // Return to center
  await page.mouse.move(viewportWidth / 2, viewportHeight / 2)
}

/**
 * Runs hover interactions at current scroll position.
 */
async function runHoverInteractions(page, scrollY, device, onLog) {
  const targets = await findHoverTargets(page, scrollY, device.height)
  for (const { box } of targets) {
    await interactHover(page, box, device.width, device.height, onLog)
  }
}

module.exports = { runHoverInteractions }
```

- [ ] **Step 3: Implement video-engine.js**

Note: the `videoFilename` import is used at the bottom of `captureVideo` — ensure it is in scope as shown.

`src/main/video-engine.js`:
```js
const { chromium } = require('playwright')
const path = require('path')
const { screen } = require('electron')
const authHandler = require('./auth-handler')
const { getSectionScrollStops } = require('./section-analyzer')
const { runHoverInteractions } = require('./hover-engine')
const { getFfmpegPath, resolveScreenDeviceIndex, buildCaptureArgs, spawnFfmpeg } = require('./ffmpeg-helper')
const { videoFilename } = require('./output-manager')

const DEFAULT_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
`

const SCROLL_SPEEDS = { slow: 2000, medium: 1200, fast: 700 } // ms per 1000px

/**
 * Eased scroll animation: moves from currentY to targetY using rAF-based cubic ease-in-out.
 */
async function smoothScrollTo(page, targetY, currentY, msPerPx) {
  const distance = Math.abs(targetY - currentY)
  const duration = (distance / 1000) * msPerPx
  await page.evaluate(({ targetY, duration }) => {
    return new Promise(resolve => {
      const startY = window.scrollY
      const startTime = performance.now()
      function step(now) {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        window.scrollTo(0, startY + (targetY - startY) * eased)
        if (t < 1) requestAnimationFrame(step)
        else resolve()
      }
      requestAnimationFrame(step)
    })
  }, { targetY, duration })
}

/**
 * Captures a scroll video of a single URL.
 */
async function captureVideo(job, device, outputFolder, onLog, onFile, ffmpegPathOverride) {
  const display = screen.getPrimaryDisplay()
  const scaleFactor = display.scaleFactor
  const ffmpegPath = getFfmpegPath(ffmpegPathOverride)
  const screenIndex = resolveScreenDeviceIndex(ffmpegPath)

  onLog(`Screen device index: ${screenIndex}, scale factor: ${scaleFactor}`)

  // Launch headed browser
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--window-position=0,23`,
      `--window-size=${device.width},${device.height + (job.viewportExtend || 0)}`,
      `--app=about:blank`,
      `--disable-infobars`
    ]
  })

  const contextOptions = {
    viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
    deviceScaleFactor: 2,
    colorScheme: job.darkMode ? 'dark' : 'light'
  }

  const httpCreds = authHandler.buildHttpCredentials(job.auth)
  if (httpCreds) contextOptions.httpCredentials = httpCreds

  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()

  // Navigate and auth
  await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
  if (job.auth?.type === 'form') {
    await authHandler.performFormLogin(page, { ...job.auth, password: job.auth._resolvedPassword })
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  }

  // Inject CSS
  await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

  // Start FFmpeg recording
  const outputPath = path.join(outputFolder, videoFilename(device.id))
  const args = buildCaptureArgs(screenIndex, device.width, device.height, scaleFactor, outputPath)
  const ffmpegProc = spawnFfmpeg(ffmpegPath, args, line => onLog(`FFmpeg: ${line}`))

  // Wait for FFmpeg to initialize
  await new Promise(r => setTimeout(r, 500))

  // Autoconsent visible on screen (recorded)
  try {
    const { autoConsent } = require('@duckduckgo/autoconsent/dist/autoconsent.playwright')
    await autoConsent(page)
    onLog('Cookie consent handled')
  } catch (_) {}
  await page.waitForTimeout(500)

  // Hero wait
  onLog(`Waiting ${job.heroWaitSeconds ?? 15}s for hero content...`)
  await page.waitForTimeout((job.heroWaitSeconds ?? 15) * 1000)

  // Get scroll stops
  const stops = await getSectionScrollStops(page, device.height)
  onLog(`Scroll stops: ${stops.join(', ')}`)

  const speedMs = SCROLL_SPEEDS[job.scrollSpeed || 'medium']
  let currentY = 0

  for (const targetY of stops) {
    if (targetY === currentY) continue
    onLog(`Scrolling to ${targetY}px`)
    await smoothScrollTo(page, targetY, currentY, speedMs)
    currentY = targetY

    // Hover interactions (optional)
    if (job.hoverInteractions) {
      await runHoverInteractions(page, currentY, device, onLog)
    }

    // Pause at this stop
    await page.waitForTimeout(1500)
  }

  // Final pause
  await page.waitForTimeout(1000)

  // Stop FFmpeg
  ffmpegProc.stdin.write('q')
  await new Promise(r => setTimeout(r, 2000))
  ffmpegProc.kill('SIGINT')

  await browser.close()

  onLog(`Video saved: ${videoFilename(device.id)}`)
  onFile(outputPath)
}

module.exports = { captureVideo }
```

- [ ] **Step 5: Commit**

```bash
git add src/main/video-engine.js src/main/hover-engine.js src/main/quiet-mode.js
git commit -m "feat: add video engine, hover engine, and quiet mode"
```

---

## Task 12: IPC Handlers

**Files:**
- Create: `src/main/ipc-handlers.js`

Registers all IPC channels. Routes incoming calls to the correct modules. Streams log output back to renderer.

- [ ] **Step 1: Implement ipc-handlers.js**

`src/main/ipc-handlers.js`:
```js
const { ipcMain, shell } = require('electron')
const { v4: uuidv4 } = require('uuid')
const keytar = require('keytar')
const store = require('./store')
const pm = require('./preset-manager')
const om = require('./output-manager')
const { captureScreenshots } = require('./screenshot-engine')
const { captureVideo } = require('./video-engine')
const { quietDown, relaunchAll } = require('./quiet-mode')

const KEYCHAIN_SERVICE = 'WebScreenshotter'

// Active job cancellation tokens
const activeJobs = new Map()

function sendLog(mainWindow, line) {
  mainWindow.webContents.send('log', `[${new Date().toISOString().slice(11, 19)}] ${line}`)
}

function sendJobUpdate(mainWindow, update) {
  mainWindow.webContents.send('job:update', update)
}

function register(mainWindow) {
  // Settings
  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:save', (_, settings) => store.saveSettings(settings))

  // Presets
  ipcMain.handle('presets:get', () => pm.getJobPresets())
  ipcMain.handle('presets:save', (_, preset) => pm.saveJobPreset(preset))
  ipcMain.handle('presets:delete', (_, id) => pm.deleteJobPreset(id))
  ipcMain.handle('devices:get', () => pm.getDevices())
  ipcMain.handle('devices:save', (_, device) => pm.saveDevice(device))
  ipcMain.handle('devices:delete', (_, id) => pm.deleteDevice(id))

  // History
  ipcMain.handle('history:get', () => om.getHistory())
  ipcMain.handle('history:delete', (_, id) => om.deleteHistoryEntry(id))
  ipcMain.handle('history:zip', async (_, sessionFolder) => {
    const zipPath = await om.exportZip(sessionFolder)
    return zipPath
  })
  ipcMain.handle('fs:openFolder', (_, folderPath) => shell.openPath(folderPath))

  // Keychain
  ipcMain.handle('keychain:save', async (_, ref, password) => {
    await keytar.setPassword(KEYCHAIN_SERVICE, ref, password)
  })
  ipcMain.handle('keychain:delete', async (_, ref) => {
    await keytar.deletePassword(KEYCHAIN_SERVICE, ref)
  })

  // Capture
  ipcMain.handle('capture:start', async (_, job) => {
    const jobId = job.id || uuidv4()
    sendJobUpdate(mainWindow, { id: jobId, status: 'running' })
    const log = (line) => sendLog(mainWindow, line)

    const settings = store.getSettings()
    const devices = pm.getDevices()
    const isBatch = job.batchDevices && job.batchDevices.length > 0
    const deviceList = isBatch
      ? devices.filter(d => job.batchDevices.includes(d.id))
      : [devices.find(d => d.id === job.device)]

    if (!deviceList.length || deviceList.includes(undefined)) {
      sendJobUpdate(mainWindow, { id: jobId, status: 'error', error: 'Device not found' })
      return { ok: false, error: 'Device not found' }
    }

    // Resolve password from Keychain
    if (job.auth?.keychainRef) {
      job.auth._resolvedPassword = await keytar.getPassword(KEYCHAIN_SERVICE, job.auth.keychainRef) || ''
    }

    const { date, time } = om.nowStamps()
    const quietApps = []

    if (job.mode === 'video' && settings.quietMode) {
      const quit = quietDown(settings.quietModeApps, log)
      quietApps.push(...quit)
    }

    try {
      for (const device of deviceList) {
        const folderName = om.sessionFolderName(job.url, date, time, device.id, isBatch)
        const sessionFolder = isBatch
          ? om.createSessionFolder(settings.outputRoot, folderName + '/' + device.id)
          : om.createSessionFolder(settings.outputRoot, folderName)

        const files = []
        const onFile = (p) => files.push(p)

        if (job.mode === 'screenshot') {
          await captureScreenshots(job, device, sessionFolder, log, onFile)
        } else {
          await captureVideo(job, device, sessionFolder, log, onFile, settings.ffmpegPath)
        }

        // Save history entry
        const thumbnail = files.find(f => f.endsWith('.png')) || ''
        om.addHistoryEntry({
          id: uuidv4(),
          url: job.url,
          device: device.id,
          mode: job.mode,
          timestamp: new Date().toISOString(),
          outputFolder: sessionFolder,
          thumbnailPath: thumbnail
        })

        sendJobUpdate(mainWindow, { id: jobId, status: 'done', outputFolder: sessionFolder })
      }
    } catch (err) {
      log(`Error: ${err.message}`)
      sendJobUpdate(mainWindow, { id: jobId, status: 'error', error: err.message })
    } finally {
      if (quietApps.length && settings.quietModeRelaunch) {
        relaunchAll(quietApps, log)
      }
    }

    return { ok: true }
  })

  ipcMain.handle('capture:cancel', (_, jobId) => {
    // Future: cancellation token support
    sendLog(mainWindow, `Cancel requested for job ${jobId} (not yet implemented)`)
  })
}

module.exports = { register }
```

- [ ] **Step 2: Register IPC in index.js**

Update `src/main/index.js`:
```js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const ipcHandlers = require('./ipc-handlers')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  ipcHandlers.register(mainWindow)
}

app.whenReady().then(async () => {
  // Ensure Playwright Chromium is installed
  const { execSync } = require('child_process')
  try { execSync('npx playwright install chromium', { stdio: 'pipe' }) } catch (_) {}
  createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc-handlers.js src/main/index.js
git commit -m "feat: register IPC handlers and wire capture pipeline to renderer"
```

---

## Task 13: Renderer — Styles + App Shell

**Files:**
- Create: `src/renderer/styles/app.css`
- Create: `src/renderer/app.js`
- Create: `src/renderer/components/log.js`

- [ ] **Step 1: Write app.css**

`src/renderer/styles/app.css`:
```css
:root {
  --bg: #1a1a1a;
  --surface: #242424;
  --border: #333;
  --accent: #4f9cf9;
  --text: #e0e0e0;
  --text-muted: #888;
  --radius: 6px;
  --sidebar-width: 140px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#app {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#sidebar {
  width: var(--sidebar-width);
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 20px 0;
  padding-top: 40px; /* space for traffic lights */
  flex-shrink: 0;
}

.nav-btn {
  display: block;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  border-left: 3px solid transparent;
}

.nav-btn.active {
  color: var(--text);
  border-left-color: var(--accent);
  background: rgba(79, 156, 249, 0.08);
}

#content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.panel { display: none; }
.panel.active { display: block; }

#log-area {
  height: 120px;
  background: #111;
  border-top: 1px solid var(--border);
  overflow-y: auto;
  padding: 8px 12px;
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  color: #6a9f6a;
}

input, select, textarea {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 7px 10px;
  font-size: 13px;
  width: 100%;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}

button.primary {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius);
  padding: 9px 18px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

button.primary:hover { filter: brightness(1.1); }

label { display: block; margin-bottom: 4px; color: var(--text-muted); font-size: 11px; }

.field { margin-bottom: 14px; }

.section-header {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 20px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.radio-group { display: flex; gap: 16px; }
.radio-group label { display: flex; align-items: center; gap: 5px; color: var(--text); font-size: 13px; }
```

- [ ] **Step 2: Write log.js**

`src/renderer/components/log.js`:
```js
const logEl = document.getElementById('log-output')

function appendLog(line) {
  const div = document.createElement('div')
  div.textContent = line
  logEl.appendChild(div)
  logEl.scrollTop = logEl.scrollHeight
  // Keep max 500 lines
  while (logEl.children.length > 500) logEl.removeChild(logEl.firstChild)
}

function clearLog() {
  logEl.innerHTML = ''
}

module.exports = { appendLog, clearLog }
```

- [ ] **Step 3: Write app.js (panel routing + IPC bridge)**

`src/renderer/app.js`:
```js
// Panel routing
const navBtns = document.querySelectorAll('.nav-btn')
const panels = document.querySelectorAll('.panel')

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'))
    panels.forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active')
  })
})

// Log stream from main process
window.api.onLog(line => {
  const logEl = document.getElementById('log-output')
  const div = document.createElement('div')
  div.textContent = line
  logEl.appendChild(div)
  logEl.scrollTop = logEl.scrollHeight
  while (logEl.children.length > 500) logEl.removeChild(logEl.firstChild)
})

// Load panels
const capturePanel = require('./panels/capture')
const queuePanel = require('./panels/queue')
const historyPanel = require('./panels/history')
const settingsPanel = require('./panels/settings')

capturePanel.init()
queuePanel.init()
historyPanel.init()
settingsPanel.init()
```

Note: Since the renderer uses `require()`, update the BrowserWindow to allow it, OR use ES modules with type="module" in the HTML. Simplest: add `nodeIntegration: false` stays, but load scripts as regular `<script>` tags, not `require()`. Update `app.js` to use vanilla module pattern without `require()`:

Replace `app.js` with a version that uses inline panel initialization without `require()`. Load each panel script via `<script>` tags in `index.html`:

Updated `src/renderer/index.html` footer:
```html
  <script src="components/log.js"></script>
  <script src="panels/capture.js"></script>
  <script src="panels/queue.js"></script>
  <script src="panels/history.js"></script>
  <script src="panels/settings.js"></script>
  <script src="app.js"></script>
```

Updated `app.js` (no require):
```js
// Panel routing
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active')
  })
})

// Log stream
window.api.onLog(line => {
  const logEl = document.getElementById('log-output')
  const div = document.createElement('div')
  div.textContent = line
  logEl.appendChild(div)
  logEl.scrollTop = logEl.scrollHeight
  while (logEl.children.length > 500) logEl.removeChild(logEl.firstChild)
})

// Job status updates (for queue panel)
window.api.onJobUpdate(update => {
  if (window.queuePanel) window.queuePanel.handleUpdate(update)
  if (window.historyPanel) window.historyPanel.refresh()
})

// Init panels
window.capturePanel && window.capturePanel.init()
window.queuePanel && window.queuePanel.init()
window.historyPanel && window.historyPanel.init()
window.settingsPanel && window.settingsPanel.init()
```

- [ ] **Step 4: Verify app opens with styles**

```bash
npm start
```
Expected: App opens with dark sidebar, nav buttons styled, log area at bottom.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/styles/app.css src/renderer/app.js src/renderer/components/ src/renderer/index.html
git commit -m "feat: add renderer shell, styles, log component, and panel routing"
```

---

## Task 14: Capture Panel UI

**Files:**
- Create: `src/renderer/panels/capture.js`

- [ ] **Step 1: Implement capture.js**

`src/renderer/panels/capture.js`:
```js
window.capturePanel = {
  init() {
    const panel = document.getElementById('panel-capture')
    panel.innerHTML = `
      <div class="field" style="display:flex;gap:8px">
        <input type="url" id="cap-url" placeholder="https://example.com" style="flex:1">
        <button class="primary" id="cap-start">▶ Start Capture</button>
      </div>

      <div class="field" style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <label>Device</label>
          <select id="cap-device"></select>
        </div>
        <label style="margin-top:16px;display:flex;align-items:center;gap:6px;color:var(--text)">
          <input type="checkbox" id="cap-batch"> Batch (multi-device)
        </label>
      </div>

      <div id="cap-batch-list" style="display:none" class="field"></div>

      <div class="section-header">Mode</div>
      <div class="radio-group field">
        <label><input type="radio" name="mode" value="screenshot" checked> Screenshot</label>
        <label><input type="radio" name="mode" value="video"> Video</label>
      </div>

      <div id="screenshot-opts">
        <div class="section-header">Screenshot Options</div>
        <div class="radio-group field">
          <label><input type="radio" name="scrtype" value="full-page" checked> Full page</label>
          <label><input type="radio" name="scrtype" value="single-viewport"> Single viewport</label>
        </div>
        <label><input type="checkbox" id="cap-crawl"> Recursive crawl</label>
        <div id="crawl-max-row" style="display:none;margin-top:8px">
          <label>Max pages</label>
          <input type="number" id="cap-crawl-max" value="30" min="1" max="30" style="width:80px">
        </div>
      </div>

      <div id="video-opts" style="display:none">
        <div class="section-header">Video Options</div>
        <div class="field">
          <label>Scroll speed</label>
          <div class="radio-group">
            <label><input type="radio" name="speed" value="slow"> Slow</label>
            <label><input type="radio" name="speed" value="medium" checked> Medium</label>
            <label><input type="radio" name="speed" value="fast"> Fast</label>
          </div>
        </div>
        <div class="field">
          <label><input type="checkbox" id="cap-section-scroll" checked> Section-aware scroll</label>
        </div>
        <div class="field">
          <label><input type="checkbox" id="cap-hover"> Hover interactions</label>
        </div>
        <div class="field" style="display:flex;gap:10px;align-items:center">
          <label style="white-space:nowrap">Viewport extend (px)</label>
          <input type="number" id="cap-extend" value="0" min="0" max="400" style="width:80px">
        </div>
      </div>

      <div class="section-header">Auth (optional)</div>
      <div class="field">
        <div class="radio-group">
          <label><input type="radio" name="auth" value="none" checked> None</label>
          <label><input type="radio" name="auth" value="basic"> Basic</label>
          <label><input type="radio" name="auth" value="form"> Form</label>
        </div>
      </div>
      <div id="auth-basic" style="display:none;gap:8px;display:none">
        <div class="field"><label>Username</label><input type="text" id="auth-user"></div>
        <div class="field"><label>Password</label><input type="password" id="auth-pass"></div>
      </div>
      <div id="auth-form" style="display:none">
        <div class="field"><label>Password field selector</label><input type="text" id="auth-pass-sel" placeholder="#password"></div>
        <div class="field"><label>Submit button selector</label><input type="text" id="auth-sub-sel" placeholder="button[type=submit]"></div>
        <div class="field"><label>Password</label><input type="password" id="auth-form-pass"></div>
        <div class="field"><label>Post-login URL pattern (optional)</label><input type="text" id="auth-post-url"></div>
      </div>

      <div class="section-header">CSS Injection</div>
      <div class="field">
        <div style="background:#111;border:1px solid var(--border);border-radius:4px;padding:8px;font-family:monospace;font-size:11px;color:#6a9f6a;margin-bottom:6px">
          * { scrollbar-width: none !important; }<br>
          *::-webkit-scrollbar { display: none !important; }<br>
          * { -webkit-tap-highlight-color: transparent !important; }
        </div>
        <textarea id="cap-css" rows="3" placeholder="Additional CSS..."></textarea>
      </div>

      <div style="display:flex;gap:16px">
        <div class="field" style="flex:1"><label>Hero wait (s)</label><input type="number" id="cap-wait" value="15" min="0" max="120"></div>
        <div class="field" style="flex:1">
          <label>Dark mode</label>
          <div class="radio-group" style="margin-top:6px">
            <label><input type="radio" name="dark" value="off" checked> Off</label>
            <label><input type="radio" name="dark" value="on"> On</label>
          </div>
        </div>
      </div>
    `

    this.loadDevices()
    this.bindEvents()
  },

  async loadDevices() {
    const devices = await window.api.getDevices()
    const sel = document.getElementById('cap-device')
    sel.innerHTML = devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('')

    // Batch list
    const batchList = document.getElementById('cap-batch-list')
    batchList.innerHTML = '<label style="color:var(--text-muted);font-size:11px">Select devices:</label>' +
      devices.map(d => `
        <label style="display:flex;align-items:center;gap:6px;color:var(--text);margin-top:6px">
          <input type="checkbox" class="batch-device" value="${d.id}"> ${d.name}
        </label>
      `).join('')
  },

  bindEvents() {
    // Mode toggle
    document.querySelectorAll('input[name="mode"]').forEach(r => {
      r.addEventListener('change', () => {
        const isVideo = r.value === 'video'
        document.getElementById('screenshot-opts').style.display = isVideo ? 'none' : 'block'
        document.getElementById('video-opts').style.display = isVideo ? 'block' : 'none'
      })
    })

    // Auth toggle
    document.querySelectorAll('input[name="auth"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('auth-basic').style.display = r.value === 'basic' ? 'block' : 'none'
        document.getElementById('auth-form').style.display = r.value === 'form' ? 'block' : 'none'
      })
    })

    // Crawl toggle
    document.getElementById('cap-crawl').addEventListener('change', e => {
      document.getElementById('crawl-max-row').style.display = e.target.checked ? 'block' : 'none'
    })

    // Batch toggle
    document.getElementById('cap-batch').addEventListener('change', e => {
      document.getElementById('cap-batch-list').style.display = e.target.checked ? 'block' : 'none'
      document.getElementById('cap-device').disabled = e.target.checked
    })

    // Start button
    document.getElementById('cap-start').addEventListener('click', () => this.startCapture())
  },

  buildJob() {
    const mode = document.querySelector('input[name="mode"]:checked').value
    const authType = document.querySelector('input[name="auth"]:checked').value
    const isBatch = document.getElementById('cap-batch').checked

    const auth = { type: authType }
    if (authType === 'basic') {
      auth.username = document.getElementById('auth-user').value
      auth.password = document.getElementById('auth-pass').value
    } else if (authType === 'form') {
      auth.formPasswordSelector = document.getElementById('auth-pass-sel').value
      auth.formSubmitSelector = document.getElementById('auth-sub-sel').value
      auth.password = document.getElementById('auth-form-pass').value
      auth.postLoginUrlPattern = document.getElementById('auth-post-url').value
    }

    return {
      url: document.getElementById('cap-url').value,
      device: document.getElementById('cap-device').value,
      batchDevices: isBatch
        ? Array.from(document.querySelectorAll('.batch-device:checked')).map(el => el.value)
        : [],
      mode,
      screenshotType: document.querySelector('input[name="scrtype"]:checked')?.value || 'full-page',
      crawl: document.getElementById('cap-crawl').checked,
      crawlMaxPages: parseInt(document.getElementById('cap-crawl-max').value) || 30,
      scrollSpeed: document.querySelector('input[name="speed"]:checked')?.value || 'medium',
      sectionAwareScroll: document.getElementById('cap-section-scroll')?.checked ?? true,
      hoverInteractions: document.getElementById('cap-hover')?.checked ?? false,
      viewportExtend: parseInt(document.getElementById('cap-extend').value) || 0,
      heroWaitSeconds: parseInt(document.getElementById('cap-wait').value) || 15,
      darkMode: document.querySelector('input[name="dark"]:checked')?.value === 'on',
      customCss: document.getElementById('cap-css').value,
      auth
    }
  },

  async startCapture() {
    const job = this.buildJob()
    if (!job.url) return alert('Please enter a URL')
    document.getElementById('cap-start').disabled = true
    document.getElementById('cap-start').textContent = '⏳ Capturing...'
    await window.api.startCapture(job)
    document.getElementById('cap-start').disabled = false
    document.getElementById('cap-start').textContent = '▶ Start Capture'
  }
}
```

- [ ] **Step 2: Verify capture panel renders**

```bash
npm start
```
Expected: Capture panel shows URL field, device selector, all options. Mode toggle switches between screenshot/video options.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/panels/capture.js
git commit -m "feat: add capture panel UI with all job configuration fields"
```

---

## Task 15: Queue, History, and Settings Panels

**Files:**
- Create: `src/renderer/panels/queue.js`
- Create: `src/renderer/panels/history.js`
- Create: `src/renderer/panels/settings.js`

- [ ] **Step 1: Implement queue.js**

`src/renderer/panels/queue.js`:
```js
window.queuePanel = {
  jobs: [],

  init() {
    const panel = document.getElementById('panel-queue')
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:15px">Queue</h2>
        <button id="q-clear" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:4px;cursor:pointer">Clear completed</button>
      </div>
      <div id="q-list"></div>
    `
    document.getElementById('q-clear').addEventListener('click', () => {
      this.jobs = this.jobs.filter(j => j.status === 'pending' || j.status === 'running')
      this.render()
    })
  },

  addJob(job) {
    this.jobs.unshift({ ...job, status: 'pending' })
    this.render()
    // Switch to queue panel
    document.querySelector('[data-panel="queue"]').click()
  },

  handleUpdate(update) {
    const job = this.jobs.find(j => j.id === update.id)
    if (job) { Object.assign(job, update); this.render() }
    else { this.jobs.unshift(update); this.render() }
  },

  render() {
    const list = document.getElementById('q-list')
    if (!list) return
    if (!this.jobs.length) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No jobs yet</p>'
      return
    }
    list.innerHTML = this.jobs.map(j => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between">
          <span style="font-weight:500">${j.url || '—'}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${
            j.status === 'done' ? '#2a4a2a' : j.status === 'error' ? '#4a2a2a' : j.status === 'running' ? '#2a3a4a' : '#333'
          };color:${
            j.status === 'done' ? '#6a9f6a' : j.status === 'error' ? '#f96' : j.status === 'running' ? '#4f9cf9' : '#888'
          }">${j.status}</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${j.device || ''} · ${j.mode || ''}</div>
        ${j.error ? `<div style="color:#f96;font-size:11px;margin-top:4px">${j.error}</div>` : ''}
        ${j.outputFolder ? `<div style="font-size:11px;color:var(--accent);cursor:pointer;margin-top:4px" onclick="window.api.openFolder('${j.outputFolder}')">Open folder →</div>` : ''}
      </div>
    `).join('')
  }
}
```

- [ ] **Step 2: Implement history.js**

`src/renderer/panels/history.js`:
```js
window.historyPanel = {
  async init() {
    const panel = document.getElementById('panel-history')
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:15px">History</h2>
      </div>
      <div id="h-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px"></div>
    `
    await this.refresh()
  },

  async refresh() {
    const grid = document.getElementById('h-grid')
    if (!grid) return
    const history = await window.api.getHistory()
    if (!history.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px">No captures yet</p>'
      return
    }
    grid.innerHTML = history.map(entry => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        ${entry.thumbnailPath
          ? `<img src="${entry.thumbnailPath}" style="width:100%;height:110px;object-fit:cover;display:block">`
          : `<div style="width:100%;height:110px;background:#111;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:20px">${entry.mode === 'video' ? '🎬' : '📷'}</div>`
        }
        <div style="padding:10px">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${new URL(entry.url).hostname}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${entry.device} · ${entry.mode}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${new Date(entry.timestamp).toLocaleDateString()}</div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <button onclick="window.api.openFolder('${entry.outputFolder}')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">Finder</button>
            <button onclick="window.historyPanel.exportZip('${entry.outputFolder}')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">ZIP</button>
            <button onclick="window.historyPanel.deleteEntry('${entry.id}')" style="background:none;border:1px solid var(--border);color:#f96;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">×</button>
          </div>
        </div>
      </div>
    `).join('')
  },

  async exportZip(folder) {
    const zip = await window.api.exportZip(folder)
    alert(`ZIP saved: ${zip}`)
  },

  async deleteEntry(id) {
    if (!confirm('Delete this history entry?')) return
    await window.api.deleteHistoryEntry(id)
    await this.refresh()
  }
}
```

- [ ] **Step 3: Implement settings.js**

`src/renderer/panels/settings.js`:
```js
window.settingsPanel = {
  async init() {
    const panel = document.getElementById('panel-settings')
    panel.innerHTML = `
      <h2 style="font-size:15px;margin-bottom:20px">Settings</h2>

      <div class="section-header">Output</div>
      <div class="field"><label>Output folder</label><input type="text" id="s-output" placeholder="~/Desktop/WebScreenshots"></div>

      <div class="section-header">Capture</div>
      <div class="field"><label>Page load timeout (s)</label><input type="number" id="s-timeout" value="30" min="5" max="120" style="width:100px"></div>
      <div class="field"><label>FFmpeg path (leave blank to use bundled)</label><input type="text" id="s-ffmpeg" placeholder="(bundled)"></div>

      <div class="section-header">Quiet Mode (Video)</div>
      <div class="field">
        <label style="display:flex;align-items:center;gap:8px;color:var(--text)">
          <input type="checkbox" id="s-quiet"> Enable Quiet Mode
        </label>
      </div>
      <div id="s-quiet-opts" style="display:none">
        <div class="field">
          <label>Apps to quit before recording (one per line)</label>
          <textarea id="s-apps" rows="5"></textarea>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;color:var(--text)">
            <input type="checkbox" id="s-relaunch"> Relaunch apps after recording
          </label>
        </div>
      </div>

      <div class="section-header">Device Presets</div>
      <div id="s-devices"></div>
      <button id="s-add-device" style="background:none;border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:4px;cursor:pointer;margin-top:8px">+ Add Device</button>

      <div style="margin-top:24px">
        <button class="primary" id="s-save">Save Settings</button>
      </div>
    `

    await this.load()
    this.bindEvents()
  },

  async load() {
    const s = await window.api.getSettings()
    document.getElementById('s-output').value = s.outputRoot || ''
    document.getElementById('s-timeout').value = s.pageLoadTimeout || 30
    document.getElementById('s-ffmpeg').value = s.ffmpegPath || ''
    document.getElementById('s-quiet').checked = s.quietMode || false
    document.getElementById('s-apps').value = (s.quietModeApps || []).join('\n')
    document.getElementById('s-relaunch').checked = s.quietModeRelaunch ?? true
    document.getElementById('s-quiet-opts').style.display = s.quietMode ? 'block' : 'none'
    await this.loadDevices()
  },

  async loadDevices() {
    const devices = await window.api.getDevices()
    document.getElementById('s-devices').innerHTML = devices.map(d => `
      <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
        <input type="text" value="${d.name}" data-did="${d.id}" data-field="name" style="flex:2">
        <input type="number" value="${d.width}" data-did="${d.id}" data-field="width" style="width:70px">
        <span style="color:var(--text-muted)">×</span>
        <input type="number" value="${d.height}" data-did="${d.id}" data-field="height" style="width:70px">
        <button onclick="window.settingsPanel.deleteDevice('${d.id}')" style="background:none;border:none;color:#f96;cursor:pointer;padding:0 4px">×</button>
      </div>
    `).join('')
  },

  async deleteDevice(id) {
    await window.api.deleteDevice(id)
    await this.loadDevices()
  },

  bindEvents() {
    document.getElementById('s-quiet').addEventListener('change', e => {
      document.getElementById('s-quiet-opts').style.display = e.target.checked ? 'block' : 'none'
    })

    document.getElementById('s-add-device').addEventListener('click', async () => {
      const { v4: uuidv4 } = { v4: () => Math.random().toString(36).slice(2) }
      await window.api.saveDevice({ id: 'custom-' + Date.now(), name: 'Custom', width: 1280, height: 800 })
      await this.loadDevices()
    })

    document.getElementById('s-save').addEventListener('click', async () => {
      // Collect and save device edits — group inputs by device id
      const deviceMap = {}
      document.querySelectorAll('[data-did]').forEach(el => {
        const id = el.dataset.did
        if (!deviceMap[id]) deviceMap[id] = { id }
        deviceMap[id][el.dataset.field] = el.dataset.field === 'name' ? el.value : parseInt(el.value)
      })
      for (const device of Object.values(deviceMap)) {
        await window.api.saveDevice(device)
      }

      await window.api.saveSettings({
        outputRoot: document.getElementById('s-output').value,
        pageLoadTimeout: parseInt(document.getElementById('s-timeout').value),
        ffmpegPath: document.getElementById('s-ffmpeg').value,
        quietMode: document.getElementById('s-quiet').checked,
        quietModeApps: document.getElementById('s-apps').value.split('\n').filter(Boolean),
        quietModeRelaunch: document.getElementById('s-relaunch').checked
      })
      alert('Settings saved')
    })
  }
}
```

- [ ] **Step 4: Verify all panels render**

```bash
npm start
```
Expected: All four panels render correctly. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/panels/
git commit -m "feat: add queue, history, and settings panels"
```

---

## Task 16: First-Launch Chromium Download UX

**Files:**
- Modify: `src/main/index.js`
- Create: `src/renderer/setup-modal.html` (displayed as a blocking overlay)

- [ ] **Step 1: Add setup overlay to index.html**

Add to `src/renderer/index.html` before `</body>`:
```html
<div id="setup-modal" style="display:none;position:fixed;inset:0;background:var(--bg);z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">
  <div style="font-size:18px;font-weight:500">Setting up Web Screenshotter</div>
  <div id="setup-status" style="color:var(--text-muted);font-size:13px">Downloading browser engine...</div>
  <div style="width:300px;height:6px;background:#333;border-radius:3px">
    <div id="setup-progress" style="height:100%;background:var(--accent);border-radius:3px;width:0%;transition:width 0.3s"></div>
  </div>
  <button id="setup-retry" class="primary" style="display:none" onclick="window.api.retrySetup()">Retry</button>
</div>
```

- [ ] **Step 2: Update index.js to handle Chromium install with progress events**

Replace the `app.whenReady()` block in `src/main/index.js`:
```js
app.whenReady().then(async () => {
  createWindow()

  // Check if Playwright Chromium needs installation
  const { execFile } = require('child_process')
  const path = require('path')

  function isChromiumInstalled() {
    try {
      const { chromium } = require('playwright')
      return !!chromium.executablePath()
    } catch {
      return false
    }
  }

  if (!isChromiumInstalled()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('setup:progress', { show: true, status: 'Downloading browser engine…', percent: 0 })
    })

    const proc = execFile('node', [
      path.join(require.resolve('playwright/package.json'), '../../cli.js'),
      'install', 'chromium'
    ])

    proc.stderr.on('data', data => {
      const line = data.toString()
      const match = line.match(/(\d+)%/)
      if (match) {
        mainWindow.webContents.send('setup:progress', { percent: parseInt(match[1]) })
      }
      mainWindow.webContents.send('setup:progress', { status: line.trim() })
    })

    proc.on('close', code => {
      if (code === 0) {
        mainWindow.webContents.send('setup:progress', { show: false })
      } else {
        mainWindow.webContents.send('setup:progress', { error: true, status: 'Download failed. Check your internet connection.' })
      }
    })
  }
})
```

- [ ] **Step 3: Add setup modal logic to app.js**

Append to `src/renderer/app.js`:
```js
window.api.onSetupProgress(data => {
  const modal = document.getElementById('setup-modal')
  if (data.show === false) { modal.style.display = 'none'; return }
  modal.style.display = 'flex'
  if (data.status) document.getElementById('setup-status').textContent = data.status
  if (data.percent !== undefined) document.getElementById('setup-progress').style.width = data.percent + '%'
  if (data.error) document.getElementById('setup-retry').style.display = 'block'
})
```

- [ ] **Step 4: Add retrySetup to preload.js**

Add to the `contextBridge.exposeInMainWorld` object in `src/main/preload.js`:
```js
retrySetup: () => ipcRenderer.send('setup:retry')
```

- [ ] **Step 5: Register retry handler in index.js**

Add inside `app.whenReady().then(async () => { ... })` after `createWindow()`:
```js
const { ipcMain } = require('electron')
ipcMain.on('setup:retry', () => {
  // Re-trigger Chromium install
  const proc = execFile('node', [
    path.join(require.resolve('playwright/package.json'), '../../cli.js'),
    'install', 'chromium'
  ])
  mainWindow.webContents.send('setup:progress', { show: true, status: 'Retrying download…', percent: 0 })
  proc.stderr.on('data', data => {
    const line = data.toString()
    const match = line.match(/(\d+)%/)
    if (match) mainWindow.webContents.send('setup:progress', { percent: parseInt(match[1]) })
    mainWindow.webContents.send('setup:progress', { status: line.trim() })
  })
  proc.on('close', code => {
    if (code === 0) mainWindow.webContents.send('setup:progress', { show: false })
    else mainWindow.webContents.send('setup:progress', { error: true, status: 'Download failed. Check your internet connection.' })
  })
})
```

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js src/renderer/index.html src/renderer/app.js src/main/preload.js
git commit -m "feat: add first-launch Chromium download progress UI with retry"
```

---

## Task 17: QoS Priority Boost

**Files:**
- Modify: `src/main/ipc-handlers.js`

Sets macOS `QOS_CLASS_USER_INTERACTIVE` on the Node.js process at capture start. Uses the `@napi-rs/nice` package. Best-effort — fails silently if unavailable.

- [ ] **Step 1: Install @napi-rs/nice**

```bash
npm install @napi-rs/nice
npx electron-rebuild -f -w @napi-rs/nice
```

- [ ] **Step 2: Add priority boost call to ipc-handlers.js**

At the top of `src/main/ipc-handlers.js`, add:
```js
let nice
try { nice = require('@napi-rs/nice') } catch (_) { nice = null }
```

Inside the `capture:start` handler, immediately after `sendJobUpdate(mainWindow, { id: jobId, status: 'running' })`, add:
```js
if (nice) {
  try { nice.setThreadPriority(nice.ThreadPriority.TimeCritical) } catch (_) {}
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc-handlers.js package.json package-lock.json
git commit -m "feat: add best-effort QoS priority boost for capture processes"
```

---

## Task 19: Integration Test — Screenshot Capture

Manual verification steps (no automated test due to Playwright + live network requirement).

- [ ] **Step 1: Launch the app**

```bash
npm start
```

- [ ] **Step 2: Capture a screenshot**
  1. Enter `https://example.com` in the URL field
  2. Select `MacBook Pro` device
  3. Select `Screenshot` mode, `Full page`
  4. Click `▶ Start Capture`
  5. Watch the live log

Expected: Log shows navigation, autoconsent, hero wait, capture. A file `index--macbook-pro.png` appears in `~/Desktop/WebScreenshots/`.

- [ ] **Step 3: Verify output**
  - File exists at expected path
  - Image is 2880×? pixels (2x retina width for 1440px viewport)
  - No scrollbar visible in image

- [ ] **Step 4: Check History panel**

Switch to History panel. Expected: thumbnail card appears for the capture.

---

## Task 20: Integration Test — Video Capture

- [ ] **Step 1: Test video capture**
  1. Enter `https://example.com`
  2. Select `MacBook Pro`, `Video` mode
  3. Set hero wait to `3` seconds (for faster testing)
  4. Click Start

Expected: Chromium window appears at top-left of screen. Log shows FFmpeg starting, scroll sequence, stops. A `scroll--macbook-pro.mp4` is produced.

- [ ] **Step 2: Verify video**
  - Open in QuickTime. Should be smooth, dark-background Chromium window at 2x.
  - No scrollbar visible
  - Scroll is smooth with ease-in-out
  - File is reasonable size (not GB-scale)

- [ ] **Step 3: Test with a real portfolio site**

  Enter a real client site URL with a long page. Verify:
  - Section-aware scroll stops at section boundaries
  - Video shows full page scrolled end-to-end

---

## Task 21: Run Full Test Suite + Final Commit

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected: All unit tests PASS (crawler, output-manager, preset-manager, auth-handler, section-analyzer, store).

- [ ] **Step 2: Fix any failures**

If tests fail, diagnose and fix before proceeding.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Web Screenshotter v1.0 — screenshots, video, queue, history, settings"
```

---

## Task 22: Build and Package

- [ ] **Step 1: Ad-hoc sign for local use**

```bash
npm run build
```

Expected: `dist/Web Screenshotter.dmg` created.

- [ ] **Step 2: Install from DMG**

Open the DMG, drag to Applications. Right-click → Open (bypass Gatekeeper for unsigned app).

- [ ] **Step 3: Smoke test installed app**

Verify the installed app launches, Chromium installs (if needed), and a test screenshot capture completes successfully.

- [ ] **Step 4: Final tag**

```bash
git tag v1.0.0
```

---

## Notes for Implementer

**Autoconsent import:** `@duckduckgo/autoconsent` exports may vary by version. If `autoConsent` isn't directly importable from the main package, try:
```js
const autoconsent = require('@duckduckgo/autoconsent')
// Use autoconsent.default or autoconsent.run() depending on version
```
Check the package's README after installation.

**Keytar on Apple Silicon:** `keytar` is a native module. After `npm install`, run:
```bash
npx electron-rebuild -f -w keytar
```
to rebuild it for the correct Electron ABI.

**FFmpeg avfoundation screen permissions:** On first use, macOS will prompt for Screen Recording permission. The user must grant this in System Preferences → Privacy & Security → Screen Recording. The app should catch the FFmpeg error and prompt the user if permission is denied.

**Playwright headed mode on macOS:** The headed Chromium window may show macOS permission prompts for camera/microphone on some sites. Playwright can dismiss these with `context.grantPermissions([])` — no permissions needed for screen capture.
