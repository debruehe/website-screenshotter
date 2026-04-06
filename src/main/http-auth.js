const path = require('path')
const fs = require('fs')
const os = require('os')

const AUTH_FILE = path.join(os.homedir(), '.web-screenshotter', 'http-auth.json')

function loadAll() {
  try { return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) } catch (_) { return {} }
}

function getForUrl(url) {
  try {
    const hostname = new URL(url).hostname
    return loadAll()[hostname] || null
  } catch (_) { return null }
}

function setForUrl(url, credentials) {
  try {
    const hostname = new URL(url).hostname
    const all = loadAll()
    if (credentials && (credentials.username || credentials.password)) {
      all[hostname] = credentials
    } else {
      delete all[hostname]
    }
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
    fs.writeFileSync(AUTH_FILE, JSON.stringify(all, null, 2))
  } catch (_) {}
}

module.exports = { getForUrl, setForUrl }
