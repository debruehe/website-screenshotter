const { ipcMain, shell, BrowserWindow, screen } = require('electron')
const { getForUrl: getScrollSettings, setForUrl: setScrollSettings } = require('./scroll-settings')
const { getForUrl: getHttpAuth, setForUrl: setHttpAuth } = require('./http-auth')
const { getForUrl: getUrlSettings, setForUrl: setUrlSettings } = require('./url-settings')
const { v4: uuidv4 } = require('uuid')
let keytar = null
try { keytar = require('keytar') } catch (_) {}
const store = require('./store')
const { getStorageState, hasSession, clearSession } = require('./session-manager')

let nice
try { nice = require('@napi-rs/nice') } catch (_) { nice = null }
const pm = require('./preset-manager')
const om = require('./output-manager')
const { captureScreenshots, captureScreenshotsManual } = require('./screenshot-engine')
const { captureVideo, captureVideoManual } = require('./video-engine')
const { quietDown, relaunchAll } = require('./quiet-mode')

const KEYCHAIN_SERVICE = 'WebScreenshotter'

// Active job cancellation tokens
const activeJobs = new Map()

function pad2(n) { return String(n).padStart(2, '0') }

function localTimeStamp() {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function sendLog(mainWindow, line) {
  const win = _mainWindow || mainWindow
  win.webContents.send('log', `[${localTimeStamp()}] ${line}`)
}

function sendJobUpdate(mainWindow, update) {
  const win = _mainWindow || mainWindow
  win.webContents.send('job:update', update)
}

let _mainWindow

function updateWindow(win) {
  _mainWindow = win
}

function register(mainWindow) {
  _mainWindow = mainWindow
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
    if (!keytar) return { error: 'Keychain unavailable' }
    await keytar.setPassword(KEYCHAIN_SERVICE, ref, password)
  })
  ipcMain.handle('keychain:delete', async (_, ref) => {
    if (!keytar) return { error: 'Keychain unavailable' }
    await keytar.deletePassword(KEYCHAIN_SERVICE, ref)
  })

  // Capture
  ipcMain.handle('capture:start', async (_, job) => {
    const jobId = job.id || uuidv4()
    const ac = new AbortController()
    activeJobs.set(jobId, ac)
    sendJobUpdate(mainWindow, { id: jobId, status: 'running' })
    if (nice) {
      // Lower nice value = higher priority. -10 is a significant boost without requiring root.
      try { nice.nice(-10) } catch (_) {}
    }
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
      job.auth._resolvedPassword = keytar ? (await keytar.getPassword(KEYCHAIN_SERVICE, job.auth.keychainRef) || '') : ''
    }

    const { date, time } = om.nowStamps()
    const quietApps = []

    if (job.mode === 'video' && settings.quietMode) {
      const quit = quietDown(settings.quietModeApps, log)
      quietApps.push(...quit)
    }

    try {
      for (const device of deviceList) {
        const heroSuffix = job.mode === 'screenshot' && job.screenshotType === 'hero' ? '_hero' : ''
        const baseName = job.pageName
          ? `${om.slugifyCustomName(job.pageName)}_${date}_${time}` + (isBatch ? '' : `_${device.id}`)
          : om.sessionFolderName(job.url || job.bulkUrls?.[0], date, time, device.id, isBatch)
        const folderName = baseName + heroSuffix
        const sessionFolder = isBatch
          ? om.createSessionFolder(settings.outputRoot, folderName + '/' + device.id)
          : om.createSessionFolder(settings.outputRoot, folderName)

        const files = []
        const onFile = (p) => files.push(p)

        if (job.mode === 'screenshot' && job.manualMode) {
          await captureScreenshotsManual(job, device, sessionFolder, log, onFile)
        } else if (job.mode === 'screenshot') {
          await captureScreenshots(job, device, sessionFolder, log, onFile, { signal: ac.signal })
        } else if (job.manualMode) {
          await captureVideoManual(job, device, sessionFolder, log, onFile, settings.ffmpegPath)
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
      log('Done.')
    } catch (err) {
      log(`Error: ${err.message}`)
      sendJobUpdate(mainWindow, { id: jobId, status: 'error', error: err.message })
    } finally {
      activeJobs.delete(jobId)
      if (quietApps.length && settings.quietModeRelaunch) {
        relaunchAll(quietApps, log)
      }
    }

    return { ok: true, jobId }
  })

  ipcMain.handle('capture:cancel', (_, jobId) => {
    if (jobId) {
      const ac = activeJobs.get(jobId)
      if (ac) { ac.abort(); sendLog(mainWindow, `Cancelling job ${jobId}…`) }
    } else {
      // Cancel all active jobs
      for (const [id, ac] of activeJobs) {
        ac.abort()
        sendLog(mainWindow, `Cancelling job ${id}…`)
      }
    }
  })

  // Session management (storageState — cookies saved from a manual browser session)
  ipcMain.handle('session:has', (_, { url }) => hasSession(url))

  ipcMain.handle('session:clear', (_, { url }) => {
    clearSession(url)
    const hostname = new URL(url).hostname
    sendLog(mainWindow, `Session cleared for ${hostname}`)
    return { ok: true }
  })

  ipcMain.handle('session:setup', async (_, { url }) => {
    const { chromium } = require('playwright')
    const path = require('path')
    const fs = require('fs')
    const { SESSION_DIR } = require('./session-manager')

    fs.mkdirSync(SESSION_DIR, { recursive: true })
    const hostname = new URL(url).hostname
    const outFile = path.join(SESSION_DIR, `${hostname}.json`)

    sendLog(mainWindow, `Browser opening for ${hostname} — accept cookies / log in, then click "Save Session & Close"`)

    const browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--disable-features=Translate,TranslateUI',
        '--disable-translate', '--lang=en-US'
      ]
    })

    browser.on('disconnected', () => {
      if (!saved) sendLog(mainWindow, 'Session browser disconnected')
    })

    // Use the default context via browser.newPage() — avoids context creation issues in Electron
    const page = await browser.newPage()
    const context = page.context()
    let saved = false

    // Expose the save function to the page
    await page.exposeFunction('__wsSaveSession', async () => {
      try {
        const state = await context.storageState()
        fs.writeFileSync(outFile, JSON.stringify(state, null, 2))
        saved = true
        sendLog(mainWindow, `Session saved for ${hostname}`)
      } catch (e) {
        sendLog(mainWindow, `Failed to save session: ${e.message}`)
      }
      try { await browser.close() } catch (_) {}
    })

    // Re-inject the floating Save button on every page load
    const injectSaveBtn = () => {
      page.evaluate(`
        (function() {
          if (document.getElementById('__wsSaveBtn')) return;
          var btn = document.createElement('button');
          btn.id = '__wsSaveBtn';
          btn.textContent = '\\u2705 Save Session & Close';
          btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:12px 20px;background:#4f9cf9;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-family:-apple-system,sans-serif';
          btn.addEventListener('click', function(){ window.__wsSaveSession(); });
          document.body.appendChild(btn);
        })()
      `).catch(() => {})
    }

    page.on('load', injectSaveBtn)

    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }) } catch (_) {}

    await new Promise(resolve => browser.on('disconnected', resolve))

    if (!saved) {
      sendLog(mainWindow, 'Browser closed without saving — use the "Save Session & Close" button next time')
    }

    return { ok: saved, hostname }
  })

  // Scroll settings (per-hostname)
  ipcMain.handle('scroll:get', (_, { url, mode }) => {
    try { return getScrollSettings(url, mode) } catch (_) { return null }
  })
  ipcMain.handle('scroll:set', (_, { url, mode, settings }) => {
    setScrollSettings(url, mode, settings)
    return { ok: true }
  })

  // Per-URL capture settings
  ipcMain.handle('urlsettings:get', (_, { url }) => {
    try { return getUrlSettings(url) } catch (_) { return null }
  })
  ipcMain.handle('urlsettings:set', (_, { url, settings }) => {
    setUrlSettings(url, settings)
    return { ok: true }
  })

  // HTTP Basic Auth (htaccess) per hostname
  ipcMain.handle('httpauth:get', (_, { url }) => {
    try { return getHttpAuth(url) } catch (_) { return null }
  })
  ipcMain.handle('httpauth:set', (_, { url, credentials }) => {
    setHttpAuth(url, credentials)
    return { ok: true }
  })

  // Crop calibration
  ipcMain.handle('calibrate:start', async () => {
    const { chromium } = require('playwright')
    const path = require('path')
    const display = screen.getPrimaryDisplay()
    const STRIP_H = 64

    // Open a headed browser so the user can see where page content starts
    const browser = await chromium.launch({
      headless: false,
      args: [
        '--window-position=0,23',
        '--window-size=1280,800',
        '--app=about:blank',
        '--disable-infobars',
        '--disable-features=Translate,TranslateUI',
        '--lang=en-US'
      ]
    })
    const page = await browser.newPage()
    await page.setContent(`
      <html><body style="background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;padding:40px 48px;color:#1d1d1f">
        <h2 style="font-size:22px;font-weight:600;margin-bottom:12px">Crop Calibration</h2>
        <p style="font-size:15px;color:#6e6e73;line-height:1.5">Drag the <span style="color:#ff3b30;font-weight:600">red line</span> on screen until it aligns with the very top of this text area, then click <strong>Save Position</strong>.</p>
      </body></html>
    `)
    await page.bringToFront()

    // Estimate initial Y: macOS menu bar (23px) + browser chrome
    await page.waitForTimeout(600)
    const rawChromeH = await page.evaluate(() => Math.max(0, window.outerHeight - window.innerHeight))
    const estimatedY = 23 + rawChromeH + 8  // logical pixels

    // Place strip so its bottom edge (the red line) sits at the estimated capture top
    const overlayY = Math.max(0, estimatedY - STRIP_H)

    const overlay = new BrowserWindow({
      x: 0,
      y: overlayY,
      width: display.bounds.width,
      height: STRIP_H,
      transparent: true,
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      focusable: true,
      resizable: false,
      movable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'calibration-preload.js')
      }
    })

    overlay.loadFile(path.join(__dirname, '../renderer/calibration.html'))
    overlay.setAlwaysOnTop(true, 'screen-saver')

    return new Promise(resolve => {
      const cleanup = (saved) => {
        // Remove listeners to avoid double-resolve
        ipcMain.removeAllListeners('calibrate:save')
        ipcMain.removeAllListeners('calibrate:cancel')
        try { overlay.close() } catch (_) {}
        browser.close().catch(() => {})
        resolve({ ok: saved })
      }

      ipcMain.once('calibrate:save', () => {
        const bounds = overlay.getBounds()
        // The red line is at the bottom of the strip
        const cropYLogical = bounds.y + STRIP_H
        store.saveSettings({ ...store.getSettings(), cropYOffset: cropYLogical })
        sendLog(mainWindow, `Crop calibrated: top of capture = ${cropYLogical}px (logical)`)
        cleanup(true)
      })

      ipcMain.once('calibrate:cancel', () => cleanup(false))
      overlay.once('closed', () => cleanup(false))
    })
  })

  ipcMain.handle('calibrate:reset', () => {
    const s = store.getSettings()
    delete s.cropYOffset
    store.saveSettings(s)
    sendLog(mainWindow, 'Crop offset reset to auto-detect')
    return { ok: true }
  })
}

module.exports = { register, updateWindow }
