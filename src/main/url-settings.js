const path = require('path')
const fs = require('fs')
const os = require('os')

const URL_SETTINGS_FILE = path.join(os.homedir(), '.web-screenshotter', 'url-settings.json')

function loadAll() {
  try { return JSON.parse(fs.readFileSync(URL_SETTINGS_FILE, 'utf8')) } catch (_) { return {} }
}

function saveAll(settings) {
  fs.mkdirSync(path.dirname(URL_SETTINGS_FILE), { recursive: true })
  fs.writeFileSync(URL_SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

function urlKey(url) {
  const parsed = new URL(url)
  parsed.hash = ''
  return parsed.href
}

function getForUrl(url) {
  try {
    const parsed = new URL(url)
    const key = urlKey(url)
    const all = loadAll()
    if (Object.prototype.hasOwnProperty.call(all, key)) return all[key]

    // Migrate the old hostname-scoped value to the first full URL that loads it.
    if (Object.prototype.hasOwnProperty.call(all, parsed.hostname)) {
      const settings = all[parsed.hostname]
      delete all[parsed.hostname]
      all[key] = settings
      try { saveAll(all) } catch (_) {}
      return settings
    }
    return null
  } catch (_) { return null }
}

function setForUrl(url, settings) {
  try {
    const parsed = new URL(url)
    const all = loadAll()
    delete all[parsed.hostname]
    all[urlKey(url)] = settings
    saveAll(all)
  } catch (_) {}
}

module.exports = { getForUrl, setForUrl }
