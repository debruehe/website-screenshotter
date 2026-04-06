const path = require('path')
const fs = require('fs')
const os = require('os')

const URL_SETTINGS_FILE = path.join(os.homedir(), '.web-screenshotter', 'url-settings.json')

function loadAll() {
  try { return JSON.parse(fs.readFileSync(URL_SETTINGS_FILE, 'utf8')) } catch (_) { return {} }
}

function getForUrl(url) {
  try {
    const hostname = new URL(url).hostname
    return loadAll()[hostname] || null
  } catch (_) { return null }
}

function setForUrl(url, settings) {
  try {
    const hostname = new URL(url).hostname
    const all = loadAll()
    all[hostname] = settings
    fs.mkdirSync(path.dirname(URL_SETTINGS_FILE), { recursive: true })
    fs.writeFileSync(URL_SETTINGS_FILE, JSON.stringify(all, null, 2))
  } catch (_) {}
}

module.exports = { getForUrl, setForUrl }
