const SKIP_EXTENSIONS = ['.pdf', '.zip', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.webp', '.ico', '.woff', '.woff2']

function filterLinks(links, baseUrl, visited) {
  const baseHost = new URL(baseUrl).hostname
  const visitedBases = visited.map(u => {
    try { return new URL(u).origin + new URL(u).pathname } catch { return u }
  })

  return links.filter(link => {
    let parsed
    try { parsed = new URL(link) } catch { return false }

    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    if (parsed.hostname !== baseHost) return false
    if (SKIP_EXTENSIONS.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) return false

    const base = parsed.origin + parsed.pathname
    if (visitedBases.includes(base)) return false

    return true
  }).map(link => {
    const parsed = new URL(link)
    return parsed.origin + parsed.pathname + parsed.search
  })
}

async function discoverLinks(page, baseUrl) {
  const hrefs = await page.$$eval('a[href]', els =>
    els.map(el => el.href).filter(Boolean)
  )
  return [...new Set(hrefs)]
}

async function crawl(page, startUrl, maxPages = 30, onLog = () => {}) {
  const cap = Math.min(maxPages, 30)
  const queue = [startUrl]
  const visited = []

  while (queue.length > 0 && visited.length < cap) {
    const url = queue.shift()
    if (visited.includes(url)) continue
    visited.push(url)
    onLog(`Crawling: ${url}`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      const found = await discoverLinks(page, startUrl)
      const newLinks = filterLinks(found, startUrl, visited.concat(queue))
      queue.push(...newLinks)
      onLog(`Found ${newLinks.length} new links on ${url}`)
    } catch (err) {
      onLog(`Error crawling ${url}: ${err.message}`)
    }
  }

  return visited
}

module.exports = { filterLinks, discoverLinks, crawl, SKIP_EXTENSIONS }
