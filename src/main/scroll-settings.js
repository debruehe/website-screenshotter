const path = require('path')
const fs = require('fs')
const os = require('os')

const SCROLL_FILE = path.join(os.homedir(), '.web-screenshotter', 'scroll-settings.json')

function loadAll() {
  try { return JSON.parse(fs.readFileSync(SCROLL_FILE, 'utf8')) } catch (_) { return {} }
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
    fs.mkdirSync(path.dirname(SCROLL_FILE), { recursive: true })
    fs.writeFileSync(SCROLL_FILE, JSON.stringify(all, null, 2))
  } catch (_) {}
}

/**
 * Computes absolute scroll stop Y-positions for a page.
 * Step mode: stops at 0, step, 2*step, … up to maxScroll.
 * Custom mode: user-supplied absolute positions, clamped to maxScroll.
 */
async function computeScrollStops(page, viewportHeight, url) {
  const settings = getForUrl(url)
  const scrollHeight = await page.evaluate(() =>
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
  )
  const maxScroll = Math.max(0, scrollHeight - viewportHeight)

  if (settings?.mode === 'custom' && settings.positions?.length > 0) {
    const stops = settings.positions
      .filter(p => typeof p === 'number' && p >= 0)
      .map(p => Math.min(p, maxScroll))
    if (!stops.includes(0)) stops.unshift(0)
    if (stops[stops.length - 1] < maxScroll) stops.push(maxScroll)
    return [...new Set(stops)].sort((a, b) => a - b)
  }

  const step = settings?.step || 1000
  const stops = []
  for (let y = 0; y <= maxScroll; y += step) stops.push(y)
  if (stops.length === 0 || stops[stops.length - 1] < maxScroll) stops.push(maxScroll)
  return stops
}

module.exports = { getForUrl, setForUrl, computeScrollStops }
