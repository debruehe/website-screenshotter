const path = require('path')
const fs = require('fs')
const os = require('os')

const SESSION_DIR = path.join(os.homedir(), '.web-screenshotter', 'sessions')

function sessionFile(url) {
  const hostname = new URL(url).hostname
  return path.join(SESSION_DIR, `${hostname}.json`)
}

function getStorageState(url) {
  try {
    const p = sessionFile(url)
    return fs.existsSync(p) ? p : null
  } catch (_) { return null }
}

function hasSession(url) {
  try { return fs.existsSync(sessionFile(url)) } catch (_) { return false }
}

function clearSession(url) {
  try {
    const p = sessionFile(url)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch (_) {}
}

module.exports = { getStorageState, hasSession, clearSession, SESSION_DIR }
