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
  onSetupProgress: (cb) => ipcRenderer.on('setup:progress', (_, data) => cb(data)),

  // Session management
  setupSession: (url) => ipcRenderer.invoke('session:setup', { url }),
  clearSession: (url) => ipcRenderer.invoke('session:clear', { url }),
  hasSession: (url) => ipcRenderer.invoke('session:has', { url }),

  // Setup retry
  retrySetup: () => ipcRenderer.send('setup:retry'),

  // Scroll settings
  getScrollSettings: (url, mode) => ipcRenderer.invoke('scroll:get', { url, mode }),
  saveScrollSettings: (url, mode, settings) => ipcRenderer.invoke('scroll:set', { url, mode, settings }),

  // Per-URL capture settings
  getUrlSettings: (url) => ipcRenderer.invoke('urlsettings:get', { url }),
  saveUrlSettings: (url, settings) => ipcRenderer.invoke('urlsettings:set', { url, settings }),

  // HTTP Basic Auth
  getHttpAuth: (url) => ipcRenderer.invoke('httpauth:get', { url }),
  saveHttpAuth: (url, credentials) => ipcRenderer.invoke('httpauth:set', { url, credentials }),

  // Crop calibration
  startCalibration: () => ipcRenderer.invoke('calibrate:start'),
  resetCropOffset:  () => ipcRenderer.invoke('calibrate:reset'),
})
