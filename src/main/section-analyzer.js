function analyzeSections(sections, viewportHeight, scrollHeight) {
  const minHeight = Math.max(200, viewportHeight * 0.25)
  const qualified = sections.filter(s => s.height >= minHeight)

  if (qualified.length < 2) {
    const stops = []
    for (let y = 0; y < scrollHeight; y += 1000) stops.push(y)
    return stops
  }

  const rawStops = qualified.map(s => Math.round(s.top))
  const deduped = rawStops.sort((a, b) => a - b).filter((stop, i, arr) => {
    if (i === 0) return true
    return stop - arr[i - 1] > 100
  })

  return deduped
}

const IN_PAGE_SCRIPT = `
(function() {
  const selectors = 'section, article, [id], .section, [class*="section"]'
  const containers = ['main', '#app', '#root', '.container']
  const candidates = new Set()

  document.querySelectorAll(selectors).forEach(el => candidates.add(el))
  containers.forEach(sel => {
    const parent = document.querySelector(sel)
    if (parent) Array.from(parent.children).forEach(el => candidates.add(el))
  })

  return Array.from(candidates).map(el => {
    const rect = el.getBoundingClientRect()
    return {
      top: rect.top + window.scrollY,
      height: rect.height
    }
  })
})()
`

async function getSectionScrollStops(page, viewportHeight) {
  const sections = await page.evaluate(IN_PAGE_SCRIPT)
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
  return analyzeSections(sections, viewportHeight, scrollHeight)
}

module.exports = { analyzeSections, getSectionScrollStops }
