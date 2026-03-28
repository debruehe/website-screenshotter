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
