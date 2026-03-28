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
