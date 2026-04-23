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
  quietModeRelaunch: true,
  manualScrollJumpKey: 'CommandOrControl+J'
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
