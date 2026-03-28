const fs = require('fs')
const path = require('path')
const os = require('os')
const archiver = require('archiver')

const STORE_DIR = process.env.STORE_DIR ||
  path.join(os.homedir(), 'Library', 'Application Support', 'WebScreenshotter')
const HISTORY_FILE = path.join(STORE_DIR, 'history.json')

function ensureDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true })
}

function slugify(urlPath) {
  const cleaned = urlPath.replace(/^\/|\/$/g, '').replace(/\//g, '-')
  return cleaned || 'index'
}

function sessionFolderName(url, date, time, deviceId, isBatch) {
  const hostname = new URL(url).hostname
  if (isBatch) return `${hostname}_${date}_${time}`
  return `${hostname}_${date}_${time}_${deviceId}`
}

function createSessionFolder(outputRoot, folderName) {
  const folderPath = path.join(outputRoot, folderName)
  fs.mkdirSync(folderPath, { recursive: true })
  return folderPath
}

function screenshotFilename(urlPath, deviceId) {
  return `${slugify(urlPath)}--${deviceId}.png`
}

function videoFilename(deviceId) {
  return `scroll--${deviceId}.mp4`
}

function nowStamps() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toISOString().slice(11, 16).replace(':', '-')
  return { date, time }
}

function getHistory() {
  ensureDir()
  if (!fs.existsSync(HISTORY_FILE)) return []
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) } catch { return [] }
}

function addHistoryEntry(entry) {
  ensureDir()
  const history = getHistory()
  history.unshift(entry)
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

function deleteHistoryEntry(id) {
  const history = getHistory().filter(e => e.id !== id)
  ensureDir()
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

function exportZip(sessionFolder) {
  return new Promise((resolve, reject) => {
    const zipPath = sessionFolder.replace(/\/?$/, '.zip')
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    output.on('close', () => resolve(zipPath))
    archive.on('error', reject)
    archive.pipe(output)
    archive.directory(sessionFolder, path.basename(sessionFolder))
    archive.finalize()
  })
}

module.exports = {
  slugify, sessionFolderName, createSessionFolder,
  screenshotFilename, videoFilename, nowStamps,
  getHistory, addHistoryEntry, deleteHistoryEntry, exportZip
}
