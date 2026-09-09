const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
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

function slugifyCustomName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page'
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

const MAX_PAGE_SLUG_BYTES = 120
const MAX_DEVICE_SLUG_BYTES = 100

function shortHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8)
}

function truncateUtf8(value, maxBytes) {
  let result = ''
  for (const char of value) {
    if (Buffer.byteLength(result + char) > maxBytes) break
    result += char
  }
  return result
}

function boundedSlug(slug, identity, maxBytes, alwaysHash = false) {
  if (!alwaysHash && Buffer.byteLength(slug) <= maxBytes) return slug
  const suffix = `--${shortHash(identity)}`
  return truncateUtf8(slug, maxBytes - Buffer.byteLength(suffix)) + suffix
}

function boundedPageSlug(slug, identity = slug, alwaysHash = false) {
  return boundedSlug(slug, identity, MAX_PAGE_SLUG_BYTES, alwaysHash)
}

function deviceSlug(device) {
  if (!device.id.startsWith('custom-')) return device.id
  const slug = slugifyCustomName(device.name)
  return boundedSlug(slug, `${device.id}:${device.name}`, MAX_DEVICE_SLUG_BYTES)
}

function batchPageSlug(url) {
  const parsed = new URL(url)
  return boundedPageSlug(slugify(parsed.pathname), parsed.href, true)
}

function capturePageSlug(url, pageName = '') {
  const pathname = new URL(url).pathname
  const subpage = slugify(pathname)
  if (!pageName) return boundedPageSlug(subpage, pathname)
  return boundedPageSlug(
    `${slugifyCustomName(pageName)}--${subpage}`,
    `${pageName}:${pathname}`
  )
}

function screenshotFilename(urlPath, deviceId) {
  const pageSlug = boundedPageSlug(slugify(urlPath), urlPath)
  return `${pageSlug}--${deviceId}.png`
}

function videoFilename(deviceId, isManual, urlPath) {
  const pagePart = urlPath
    ? `--${boundedPageSlug(slugify(urlPath), urlPath)}`
    : ''
  return isManual
    ? `scroll--manual${pagePart}--${deviceId}.mp4`
    : `scroll${pagePart}--${deviceId}.mp4`
}

function captureVideoFilename({ job, device, isManual = false, url = job.url }) {
  const pageSlug = job.bulkUrls && job.bulkUrls.length > 0
    ? batchPageSlug(url)
    : capturePageSlug(url, job.pageName)
  return videoFilename(deviceSlug(device), isManual, pageSlug)
}

function resolveOutputRoot(job, settings) {
  const override = job.outputRoot
  if (typeof override !== 'string' || !override.trim() || !path.isAbsolute(override)) {
    return settings.outputRoot
  }
  return override
}

function pad2(n) { return String(n).padStart(2, '0') }

function nowStamps() {
  const now = new Date()
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  const time = `${pad2(now.getHours())}-${pad2(now.getMinutes())}`
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
  slugify, slugifyCustomName, deviceSlug, batchPageSlug, capturePageSlug, sessionFolderName, createSessionFolder,
  screenshotFilename, videoFilename, captureVideoFilename, resolveOutputRoot, nowStamps,
  getHistory, addHistoryEntry, deleteHistoryEntry, exportZip
}
