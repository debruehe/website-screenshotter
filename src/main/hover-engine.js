/**
 * In-page script: scans CSSOM for :hover rules.
 * Returns array of { selector, baseSelector } for selectors with :hover.
 */
const HOVER_SCAN_SCRIPT = `
(function() {
  const hoverSelectors = new Set()
  try {
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule.selectorText && rule.selectorText.includes(':hover')) {
            const base = rule.selectorText.replace(/:hover.*/, '').trim()
            if (base) hoverSelectors.add(base)
          }
        })
      } catch (_) {} // cross-origin stylesheets
    })
  } catch (_) {}
  return Array.from(hoverSelectors)
})()
`

/**
 * Finds first visible element for each hover selector in current viewport.
 */
async function findHoverTargets(page, scrollY, viewportHeight) {
  const selectors = await page.evaluate(HOVER_SCAN_SCRIPT)
  const targets = []
  const seen = new Set()

  for (const selector of selectors) {
    // Derive a clean base selector (avoid duplicates)
    const base = selector.split(/[\s>+~]/)[0].replace(/::.*/, '')
    if (seen.has(base)) continue

    try {
      const el = await page.$(selector)
      if (!el) continue
      const box = await el.boundingBox()
      if (!box) continue

      // Only target elements visible in current viewport
      const elTop = box.y + scrollY
      if (elTop < scrollY || elTop > scrollY + viewportHeight) continue

      targets.push({ selector, box })
      seen.add(base)
    } catch (_) {}
  }

  return targets
}

/**
 * Smoothly moves cursor to an element, pauses, returns to center.
 */
async function interactHover(page, box, viewportWidth, viewportHeight, onLog) {
  const targetX = box.x + box.width / 2
  const targetY = box.y + box.height / 2
  const steps = 20

  if (typeof onLog === 'function') {
    onLog(`Hover: moving to element at (${Math.round(targetX)}, ${Math.round(targetY)})`)
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    await page.mouse.move(
      viewportWidth / 2 + (targetX - viewportWidth / 2) * eased,
      viewportHeight / 2 + (targetY - viewportHeight / 2) * eased
    )
    await page.waitForTimeout(400 / steps)
  }

  await page.waitForTimeout(1500)

  // Return to center
  await page.mouse.move(viewportWidth / 2, viewportHeight / 2)
}

/**
 * Runs hover interactions at current scroll position.
 */
async function runHoverInteractions(page, scrollY, device, onLog) {
  const targets = await findHoverTargets(page, scrollY, device.height)
  for (const { box } of targets) {
    await interactHover(page, box, device.width, device.height, onLog)
  }
}

module.exports = { runHoverInteractions }
