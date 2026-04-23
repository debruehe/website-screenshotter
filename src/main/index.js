const { app, BrowserWindow } = require('electron')
const path = require('path')
const ipcHandlers = require('./ipc-handlers')

// Playwright throws TargetClosedError as unhandled rejections from internal event emitters
// when the browser closes while page operations are in flight. Suppress them.
process.on('unhandledRejection', (reason) => {
  if (reason?.name === 'TargetClosedError') return
})

let mainWindow
let ipcRegistered = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    icon: path.join(__dirname, '../../assets/icon.icns'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  if (!ipcRegistered) {
    ipcHandlers.register(mainWindow)
    ipcRegistered = true
  } else {
    ipcHandlers.updateWindow(mainWindow)
  }
}

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

    const progressListener = data => {
      const line = data.toString()
      const match = line.match(/(\d+)%/)
      if (match) mainWindow.webContents.send('setup:progress', { percent: parseInt(match[1]) })
      mainWindow.webContents.send('setup:progress', { status: line.trim() })
    }
    proc.stdout && proc.stdout.on('data', progressListener)
    proc.stderr && proc.stderr.on('data', progressListener)

    proc.on('error', () => {
      mainWindow.webContents.send('setup:progress', { error: true, status: 'Download failed. Check your internet connection.' })
    })
    proc.on('close', code => {
      if (code === 0) {
        mainWindow.webContents.send('setup:progress', { show: false })
      } else {
        mainWindow.webContents.send('setup:progress', { error: true, status: 'Download failed. Check your internet connection.' })
      }
    })
  }

  let installRunning = false
  const { ipcMain } = require('electron')
  ipcMain.on('setup:retry', () => {
    if (installRunning) return
    installRunning = true
    const proc = execFile('node', [
      path.join(require.resolve('playwright/package.json'), '../../cli.js'),
      'install', 'chromium'
    ])
    mainWindow.webContents.send('setup:progress', { show: true, status: 'Retrying download…', percent: 0 })
    const retryListener = data => {
      const line = data.toString()
      const match = line.match(/(\d+)%/)
      if (match) mainWindow.webContents.send('setup:progress', { percent: parseInt(match[1]) })
      mainWindow.webContents.send('setup:progress', { status: line.trim() })
    }
    proc.stdout && proc.stdout.on('data', retryListener)
    proc.stderr && proc.stderr.on('data', retryListener)
    proc.on('error', () => {
      installRunning = false
      mainWindow.webContents.send('setup:progress', { error: true, status: 'Download failed. Check your internet connection.' })
    })
    proc.on('close', code => {
      installRunning = false
      if (code === 0) mainWindow.webContents.send('setup:progress', { show: false })
      else mainWindow.webContents.send('setup:progress', { error: true, status: 'Download failed. Check your internet connection.' })
    })
  })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
