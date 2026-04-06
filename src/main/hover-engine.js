// Custom cursor SVGs — hotspot at tip of arrow (10,7) and tip of finger (9,8)
const DEFAULT_CURSOR_SVG = `<svg height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(10 7)"><path d="m6.148 18.473 1.863-1.003 1.615-.839-2.568-4.816h4.332l-11.379-11.408v16.015l3.316-3.221z" fill="#fff"/><path d="m6.431 17 1.765-.941-2.775-5.202h3.604l-8.025-8.043v11.188l2.53-2.442z" fill="#000"/></g></svg>`

const HAND_CURSOR_SVG = `<svg height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" transform="translate(9 8)"><path d="m3.8852309 13.5522788c.15029277.1354048.25406355.2326609.57471053.5372549.31406586.2983172.46594413.439273.60482646.5572091.05791893.0487853.10729946.1792495.12686364.3731628.01609788.1595565.01049553.3375341-.0090192.5090254-.00674888.0593077-.01325791.1020883-.01698742.1224696-.04186639.2287942.13249226.4401222.36507344.4424801.20929712.0021219.37056581.00472.79741331.0123273.10679864.0019014.10679864.0019014.21395196.0037648 1.16029156.0199598 1.75290683.01448 2.1782236-.039003.45462139-.05716.92282087-.6061887 1.32754658-1.2951218.3429437.6096032.818651 1.2048784 1.2990136 1.282277.1525992.0243739.3372104.0319365.5511764.0270146.1595258-.0036697.328349-.0141847.4987188-.0294071.1284742-.0114791.2308379-.0230173.2919821-.0309462.2259121-.0292954.3737346-.2515956.31337-.4712558-.0130388-.0474468-.0339905-.1345046-.0551176-.2441066-.0244927-.1270617-.0421932-.2511642-.0502379-.3642189-.0051002-.0716765-.0061057-.1365707-.0028638-.1926702.0056365-.097781.007395-.1525378.0101327-.2790463.0010457-.0470941.0010457-.0470941.0024433-.0883088.0052898-.134881.0234093-.2629524.0820463-.5422232.0251901-.1212103.1472903-.3531692.3395862-.6402332.0572734-.0854992.1198813-.1747825.1869659-.2669588.127207-.1747861.2641214-.3514011.4010853-.5204043.0820457-.1012383.1454717-.1769623.1807968-.2180763.2962199-.424403.6120842-1.1191696.7281396-1.5253635.111416-.3904017.2005405-1.10937558.2553074-1.81604479.0300143-.40088807.0411211-.72405394.0411211-1.23097561.0000507-.08891816.0000507-.08891816.0002032-.16234685.0002858-.12025251.0003032-.16573976-.0000887-.22195195-.0010706-.15358041-.0055478-.30580145-.0203882-.6940256-.0319191-.81365149-.4778003-1.3396911-1.1348711-1.44115781-.5589865-.08632026-1.2393839.37795756-1.2393839.37795756s-.1514404-.5228127-.2537197-.6842075c-.1661957-.25934741-.5941748-.58982828-.9213451-.65421118-.3365014-.0653413-.7354024-.05811592-1.1017193.00667481-.3207944.05740454-.64034865.34382687-.82518751.65277182-.13223727.22039488-.00786932-.01169164-.14013104-.2396787-.1830552-.31402315-.60932935-.59522407-1.01524567-.67822294-.34396352-.07112559-.73801897-.04403625-1.09795562.06293793-.46304125.13836397-.53675291.49073282-.55516748.38984626-.06158674-.3382385-.06727482-.3160095-.105656-.55729603-.14258072-.89527436-.30213161-1.51473549-.54406219-2.05528331.01391678.0310773-.08860981-.20214701-.12592279-.28256779-.06461002-.13925416-.12910532-.2652956-.19999629-.38652204-.21850342-.37364978-.46891278-.65340904-.7830908-.81233894-.54561037-.27629378-1.3634177-.14183064-1.75105565.31064856-.38495968.44966797-.4491432 1.20149287-.3521966 2.13184003.03702376.36121263.16678627 1.02066144.28444961 1.50812387.04160602.1691894.07805979.32348903.14491578.60851331.01149723.04848415.01149723.04848415.02309483.09698036.05172236.21571896.09707607.39320067.15122332.5879629-.00568154-.02030261.09701461.344086.11888835.42472961.00727686.02691587.00727686.02691587.01448296.05395339.04082856.15377935.08074083.31959314.14309954.5963099.03412572.1521447.06742545.31468601.09999775.48699018.08883553.46993091.089274.37207374.00375852.27186198-.05907319-.06922522-.11463055-.13209255-.16830659-.19003644-.09976937-.10770214-.19148509-.19677225-.2785569-.2678141-.6343975-.51905295-1.02312991-.74839425-1.55681885-.79878106-.87541567-.08410158-1.70619803.53426712-1.83111632 1.36882761-.07682697.51169638-.05207639.74723271.18463583 1.19942735.13026223.24432805.35060714.53942202.76172732 1.04735429.02515953.031068.02515953.031068.05030428.06206416.50464537.62186746.55962098.69095396.67961467.86473786.32435479.4706845 1.1139501 1.8221455 1.25748612 2.0035872z" fill="#000"/><path d="m1.68266944 9.2716401c-.02488625-.03067752-.02488625-.03067752-.04970567-.06132555-.37729166-.46613768-.58418002-.74321015-.68156241-.9258495-.15281729-.29195235-.1611316-.37107459-.10605794-.73788601.06473349-.43247455.53181583-.78013371 1.01829549-.73339767.33660502.03178017.63068475.20527903 1.15339692.63295262.0565942.04617564.12482853.1124417.20288232.19670163.04616569.04983637.09513192.10524534.14800114.16720042.0794093.0930562.34702847.42052231.30761424.37286894.05814283.06991619.09971852.12407704.14721655.19045018.0941062.13434104.14705111.20894642.21874992.30454484-.0336171-.04487143.21473082.29843305.26732159.34863333.27859812.26593456.68203289.04195871.65675979-.31244785-.00421914-.05916537-.01812774-.12308431-.04717934-.23466885-.11487425-.81923739-.15505751-1.08218312-.24678252-1.56739907-.03407352-.18024544-.06905328-.35098727-.10521102-.5121905-.06435409-.28557213-.10635725-.46007245-.14994794-.62425526-.00774801-.02907063-.00774801-.02907063-.01552357-.05783095-.02300644-.08481964-.12725123-.45470311-.12030828-.42989063-.05134381-.18468043-.0945453-.35373996-.14431997-.56133562-.01130896-.04728909-.01130896-.04728909-.02259904-.09489949-.06649254-.28350912-.10387999-.44176072-.14606063-.6132721-.10998732-.45567652-.23425389-1.08719519-.2671036-1.40768017-.07546665-.72422018-.02339381-1.33418457.17582284-1.56688778.15554834-.1815673.59641015-.25405339.84271752-.12932486.16107512.0814814.32204278.26131571.47435101.521769.05764302.09857191.11172763.20426801.16708381.32357735.0335256.07225783.13292567.29837003.12172905.27336705.21032209.46992469.354801 1.03086841.48791736 1.86671535.03939531.24766201.08813662.52823537.15063928.87150416.01857903.10178746.01857903.10178746.03722922.20314381.30139226 1.63533599.27933797 1.51139381.28367122 1.64182468.01580667.47578071.71810567.4869267.74900255.01188722.00979855-.15065269.00630989-.2851661-.01107827-.67146517-.00245496-.05465243-.00245496-.05465243-.00481877-.10910149-.01521525-.35590459-.01433687-.56066672.00670546-.67705709.03834708-.21223125.22887-.4499778.40434754-.50241339.24641865-.07323589.51640341-.09179599.73269877-.04707051.20703808.0423346.44864736.20171736.51796318.32062499.08353628.14399789.15516008.36337367.21006107.63530456.04431149.21947986.07480439.45493493.0962536.70624261.00667352.0781897.01103024.13859819.01772256.23854675.00285005.04183594.00285005.04183594.00568968.07635213.00160285.01731471.00160285.01731471.00551199.04467336.00303535.01917374.00303535.01917374.01734216.06773608.00727602.13782339.00727602.13782339.56081544.18893151.16530264-.19982737.16530264-.19982737.16077268-.23486454.02708074-.1183491.04365279-.250265.06727822-.49813693.01508098-.16112409.02268576-.24033521.03157416-.32249887.036794-.34012028.0835164-.55621578.140511-.65120691.0707148-.11819408.3197845-.28280909.4314962-.30279961.2805348-.04961763.5886064-.0551978.8264635-.00901194.1077347.021202.3705429.22413969.4327499.32121002.1277282.20156171.2519621.8513817.3219188 1.49611734-.0110122.04228902-.0110122.04228902.1607163.28760404.5903408-.06730286.5903408-.06730286.5737568-.17389206.0155734-.03799147.0279666-.08191522.0455068-.15013809.0421947-.1597068.0701719-.25243998.1118273-.35635899.0288165-.07188915.0591935-.13335501.0903398-.18227881.120675-.18992919.4330876-.31896311.7070596-.2766556.2942545.0454396.4817569.26665023.4998934.72896761.0145423.38042999.0188438.52667972.0198445.67022961.0003693.0529684.0003531.09548963.0000723.21509672-.0001536.07391241-.0001536.07391241-.000205.16397385 0 .48892448-.010469.79353263-.0389535 1.17400348-.0506294.653266-.1361064 1.34281542-.228649 1.66708482-.094456.330596-.3764591.9508823-.5997469 1.2734975-.0158389.0153017-.0838055.0964468-.1706932.2036597-.1445918.1784155-.2892331.364998-.4248114.5512865-.0725632.099704-.140705.1968792-.2036767.2908847-.2436695.3637558-.4000227.6607868-.4506249.9042828-.0664376.3164194-.0901813.4842425-.0973169.666189-.0017426.0515155-.0017426.0515155-.0028439.1014735-.0025547.1180556-.0040857.165727-.0090621.2520573-.0052398.0906702-.0037444.1871795.0035093.2891187.0103883.145992.0000001.3454812.0000001.3454812s-.1266332-.0118299-.2678551-.0085813c-.1725177.0039685-.3159859-.0019087-.4151297-.0177442-.143046-.0230487-.5293508-.5064503-.7271506-.8830611-.3022704-.5764228-1.03604858-.5484427-1.33684295-.0394061-.27130191.4618137-.65965243.9172085-.77493336.9317029-.37460536.047106-.95471158.0524702-2.07175566.0332544-.10679478-.0018572-.10679478-.0018572-.21348729-.0037567-.42889761-.0076439-.41241496.0647655-.40363307-.0124079.02506967-.2203068.02222332-.1790312.00000011-.3992999-.03726222-.36933-.15125405-.6704984-.38877094-.8705429-.12286946-.1043424-.26983033-.2407345-.56500741-.5211097-.33722428-.3203411-.44283686-.4193233-.57299128-.5337266l-.80130455-.8907189c-.08795856-.1124788-.86002339-1.4339349-1.21248613-1.9454077-.13710846-.19857111-.18839645-.26302343-.71461353-.9114734zm9.50873056.0037599v3.459c0 .5.75.5.75 0v-3.459c0-.5-.75-.5-.75 0zm-2.03159602-.00057241.016 3.47300001c.00230346.4999947.7522955.4965395.74999204-.0034552l-.016-3.47299999c-.00230346-.4999947-.7522955-.49653951-.74999204.00345518zm-1.20911102 3.45357381-.021-3.42599996c-.00306475-.4999906-.75305066-.49539349-.74998592.00459712l.021 3.42600004c.00306475.4999906.75305066.4953935.74998592-.0045972z" fill="#fff"/></g></svg>`

const DEFAULT_HOTSPOT = { x: 10, y: 7 }
const HAND_HOTSPOT    = { x: 9,  y: 8 }

/**
 * Injects the fake cursor div into the page (idempotent).
 */
async function injectFakeCursor(page) {
  await page.evaluate(({ defaultSvg, handSvg, defaultHotspot, handHotspot }) => {
    if (document.getElementById('__ws_cursor')) return
    window.__wsCursor = {
      defaultSvg, handSvg, defaultHotspot, handHotspot,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
    const el = document.createElement('div')
    el.id = '__ws_cursor'
    el.style.cssText = 'position:fixed;top:0;left:0;width:32px;height:32px;pointer-events:none;z-index:2147483647;display:none;opacity:1;will-change:transform'
    el.innerHTML = defaultSvg
    document.documentElement.appendChild(el)

    window.__wsMoveCursor = function(x, y, hotspot) {
      el.style.transform = `translate(${x - hotspot.x}px, ${y - hotspot.y}px)`
      window.__wsCursor.x = x
      window.__wsCursor.y = y
    }
    window.__wsSetCursorSvg = function(svg) { el.innerHTML = svg }
    window.__wsShowCursor = function(show) {
      if (show) {
        clearTimeout(el._fadeTimer)
        el.style.transition = ''
        el.style.opacity = '1'
        el.style.display = 'block'
      } else {
        el.style.transition = 'opacity 0.8s ease'
        el.style.opacity = '0'
        el._fadeTimer = setTimeout(() => { el.style.display = 'none'; el.style.transition = '' }, 850)
      }
    }
  }, { defaultSvg: DEFAULT_CURSOR_SVG, handSvg: HAND_CURSOR_SVG, defaultHotspot: DEFAULT_HOTSPOT, handHotspot: HAND_HOTSPOT })
}

/**
 * Animates the fake cursor from its current position to (toX, toY).
 * Switches to arrivalSvg near the end if provided.
 */
async function animateCursor(page, toX, toY, duration, arrivalSvg, arrivalHotspot) {
  await page.evaluate(({ toX, toY, duration, arrivalSvg, arrivalHotspot, defaultHotspot }) => {
    return new Promise(resolve => {
      const c = window.__wsCursor
      const fromX = c.x, fromY = c.y
      const startTime = performance.now()
      function step(now) {
        const t = Math.min((now - startTime) / duration, 1)
        const eased = (1 - Math.cos(Math.PI * t)) / 2
        const x = fromX + (toX - fromX) * eased
        const y = fromY + (toY - fromY) * eased
        const hotspot = (arrivalSvg && t > 0.85) ? arrivalHotspot : defaultHotspot
        if (arrivalSvg && t > 0.85 && !c._switched) {
          c._switched = true
          window.__wsSetCursorSvg(arrivalSvg)
        }
        window.__wsMoveCursor(x, y, hotspot)
        if (t < 1) requestAnimationFrame(step)
        else { c._switched = false; resolve() }
      }
      requestAnimationFrame(step)
    })
  }, { toX, toY, duration, arrivalSvg, arrivalHotspot, defaultHotspot: DEFAULT_HOTSPOT })
}

/**
 * Queries the page for ALL visible dropdown/submenu items near the given viewport position.
 * Called after hovering a nav item to find all opened dropdown children.
 * Returns items sorted top-to-bottom, left-to-right.
 */
async function findDropdownItems(page, viewportCenterX, viewportCenterY) {
  return page.evaluate(({ cx, cy }) => {
    const DROPDOWN_SELECTORS = [
      '[role="menu"] a', '[role="menu"] button', '[role="menuitem"]',
      '.dropdown-menu a', '.dropdown-item',
      '.sub-menu a', '.submenu a',
      'nav ul ul a', 'nav ul ul li', 'header ul ul a',
      '[class*="dropdown"] a', '[class*="flyout"] a', '[class*="megamenu"] a',
    ]
    const seen = new Set()
    const results = []
    for (const sel of DROPDOWN_SELECTORS) {
      let els
      try { els = Array.from(document.querySelectorAll(sel)) } catch { continue }
      for (const el of els) {
        if (seen.has(el)) continue
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') continue
        if (parseFloat(style.opacity) < 0.1) continue
        const rect = el.getBoundingClientRect()
        if (rect.width < 8 || rect.height < 8) continue
        if (rect.top < 0 || rect.bottom > window.innerHeight) continue
        // Must be reasonably close horizontally to the hovered nav item
        const elCX = rect.left + rect.width / 2
        if (Math.abs(elCX - cx) > 500) continue
        seen.add(el)
        results.push({
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height
        })
      }
    }
    results.sort((a, b) => a.y - b.y || a.x - b.x)
    return results
  }, { cx: viewportCenterX, cy: viewportCenterY })
}

/**
 * Interruptible wait: chunks into 100ms steps, stops early if isCancelled() returns true.
 */
async function waitMs(page, ms, isCancelled) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    if (isCancelled?.()) return
    await page.waitForTimeout(Math.min(100, ms - elapsed))
  }
}

/**
 * Moves fake cursor and Playwright mouse to a target element.
 * Handles dropdown detection for nav items.
 * opts.isCancelled — optional function returning true when Escape has been pressed.
 */
async function interactHover(page, box, viewportWidth, viewportHeight, onLog, opts = {}) {
  const { isCancelled } = opts
  const targetX = box.x + box.width / 2
  const targetY = box.y + box.height / 2
  const fromX = viewportWidth / 2
  const fromY = viewportHeight / 2

  const dist = Math.hypot(targetX - fromX, targetY - fromY)
  const travelMs = Math.max(400, dist * 1.0)

  if (typeof onLog === 'function') onLog(`Hover: moving to (${Math.round(targetX)}, ${Math.round(targetY)})`)

  await page.evaluate(() => window.__wsShowCursor(true))

  await Promise.all([
    animateCursor(page, targetX, targetY, travelMs, HAND_CURSOR_SVG, HAND_HOTSPOT),
    page.mouse.move(targetX, targetY, { steps: Math.round(travelMs / 20) })
  ])

  if (isCancelled?.()) { await page.evaluate(() => window.__wsShowCursor(false)); return }

  // If this is a nav item that may have a dropdown, wait then visit ALL visible items
  if (opts.checkDropdown) {
    await waitMs(page, 600, isCancelled)
    if (isCancelled?.()) { await page.evaluate(() => window.__wsShowCursor(false)); return }
    const currentScrollY = await page.evaluate(() => window.scrollY)
    const dropItems = await findDropdownItems(page, targetX, targetY)
    if (dropItems.length > 0) {
      if (typeof onLog === 'function') onLog(`Found ${dropItems.length} dropdown item(s)`)
      const scrollX = await page.evaluate(() => window.scrollX)
      for (const dropItem of dropItems) {
        if (isCancelled?.()) break
        const dropCX = (dropItem.x - scrollX) + dropItem.width / 2
        const dropCY = (dropItem.y - currentScrollY) + dropItem.height / 2
        await Promise.all([
          animateCursor(page, dropCX, dropCY, 300, HAND_CURSOR_SVG, HAND_HOTSPOT),
          page.mouse.move(dropCX, dropCY, { steps: 8 })
        ])
        await waitMs(page, 350, isCancelled)
      }
      if (!isCancelled?.()) await waitMs(page, 500, isCancelled) // linger on last item
    } else {
      await waitMs(page, 900, isCancelled)
    }
  } else {
    await waitMs(page, 1500, isCancelled)
  }

  if (isCancelled?.()) { await page.evaluate(() => window.__wsShowCursor(false)); return }

  // Return to center
  const returnMs = travelMs * 0.7
  await page.evaluate(({ svg }) => window.__wsSetCursorSvg(svg), { svg: DEFAULT_CURSOR_SVG })
  await Promise.all([
    animateCursor(page, fromX, fromY, returnMs, null, null),
    page.mouse.move(fromX, fromY, { steps: Math.round(returnMs / 20) })
  ])

  await page.evaluate(() => window.__wsShowCursor(false))
}

/**
 * Finds ALL interactive elements across the full page with page-absolute coordinates.
 * Uses direct DOM queries (links, buttons, nav items) instead of CSSOM scanning.
 * Returns targets sorted top-to-bottom, nav items prioritised, page items sampled.
 */
async function findAllHoverTargets(page, onLog) {
  const raw = await page.evaluate(() => {
    function isVisible(el) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 8 || rect.height < 8) return false
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.05
    }
    function getInfo(el, extra) {
      const rect = el.getBoundingClientRect()
      return {
        pageY: Math.round(rect.top + window.scrollY),
        pageX: Math.round(rect.left + window.scrollX),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        ...extra
      }
    }
    // Elements inside dropdown containers must NOT be in the initial target list —
    // they will be visited dynamically by findDropdownItems after their parent is hovered.
    function isInDropdownContainer(el) {
      return !!el.closest([
        '[role="menu"]', '.dropdown-menu', '.sub-menu', '.submenu',
        '[class*="dropdown-menu"]', '[class*="flyout"]', '[class*="megamenu"]'
      ].join(', '))
    }

    const seen = new Set()
    const navItems = []
    const pageItems = []

    // Nav / header TOP-LEVEL items only — nested items are handled by findDropdownItems
    // Exclude nav ul ul / header ul ul selectors (those are dropdown children, not triggers)
    const navEls = document.querySelectorAll([
      'nav a[href]', 'nav button', 'nav [role="button"]',
      'header a[href]', 'header button',
      '[role="navigation"] a[href]', '[role="navigation"] button',
      '[aria-haspopup]', '[data-toggle]', '[data-bs-toggle]',
      '[class*="nav"] > li > a', '[class*="nav"] > li > button',
      '[class*="menu"] > li > a', '[class*="menu"] > li > button'
    ].join(', '))

    for (const el of navEls) {
      if (seen.has(el) || !isVisible(el) || isInDropdownContainer(el)) continue
      seen.add(el)
      const parent = el.parentElement
      const mayHaveDropdown =
        el.hasAttribute('aria-haspopup') ||
        el.hasAttribute('data-toggle') ||
        el.hasAttribute('data-bs-toggle') ||
        (parent && parent.querySelector('ul, [role="menu"]') !== null)
      navItems.push(getInfo(el, { isNav: true, mayHaveDropdown }))
    }

    // General interactive elements — also exclude anything inside a dropdown container
    const generalEls = document.querySelectorAll(
      'a[href], button:not([disabled]), [role="button"]:not([disabled]), [role="tab"]'
    )
    for (const el of generalEls) {
      if (seen.has(el) || !isVisible(el) || isInDropdownContainer(el)) continue
      seen.add(el)
      pageItems.push(getInfo(el, { isNav: false, mayHaveDropdown: false }))
    }

    return { navItems, pageItems }
  })

  // Sample general page items: max 2 per 200px vertical zone
  const zoneCounts = {}
  const sampledPage = raw.pageItems.filter(t => {
    const zone = Math.floor(t.pageY / 200)
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1
    return zoneCounts[zone] <= 2
  })

  const all = [...raw.navItems, ...sampledPage]
  all.sort((a, b) => a.pageY - b.pageY)

  if (typeof onLog === 'function') {
    onLog(`Hover targets: ${raw.navItems.length} nav + ${sampledPage.length} page = ${all.length} total`)
  }
  return all
}

/**
 * Runs hover interactions at current scroll position (used during normal scroll stops).
 */
async function runHoverInteractions(page, scrollY, device, onLog) {
  const allTargets = await findAllHoverTargets(page, onLog)
  // Only interact with targets visible in current viewport
  for (const target of allTargets) {
    const viewportY = target.pageY - scrollY
    if (viewportY < 0 || viewportY > device.height) continue
    const box = { x: target.pageX, y: viewportY, width: target.width, height: target.height }
    if (typeof onLog === 'function') onLog(`Hovering: ${target.isNav ? '[nav] ' : ''}${target.width}×${target.height} at (${Math.round(target.pageX)}, ${Math.round(target.pageY)})`)
    await interactHover(page, box, device.width, device.height, onLog, { checkDropdown: target.mayHaveDropdown })
  }
}

/**
 * Injects a smooth cursor for manual recording using Catmull-Rom path
 * interpolation. Instead of spring physics (which causes post-stop wiggle),
 * this samples the real cursor at ~30 fps, then the fake cursor runs along
 * the Catmull-Rom spline through those samples — producing genuinely smooth
 * curves through erratic movement with zero oscillation at rest.
 *
 * Also detects clickable elements under the cursor and swaps to the hand SVG.
 * Re-injects on page navigation automatically.
 */
async function injectSmoothCursor(page) {
  const script = ({ arrowSvg, handSvg, ax, ay, hx, hy }) => {
    if (document.getElementById('__ws_smooth_cursor')) return

    // Hide OS cursor
    const style = document.createElement('style')
    style.id = '__ws_cursor_hide'
    style.textContent = '*, *::before, *::after { cursor: none !important; }'
    document.head.appendChild(style)

    // Fake cursor element
    const el = document.createElement('div')
    el.id = '__ws_smooth_cursor'
    el.style.cssText = 'position:fixed;top:0;left:0;width:32px;height:32px;pointer-events:none;z-index:2147483647;will-change:transform;display:none'
    el.innerHTML = arrowSvg
    document.documentElement.appendChild(el)

    // --- Catmull-Rom spline helper ---
    function cr(p0, p1, p2, p3, t) {
      return 0.5 * (
        2 * p1 +
        (-p0 + p2) * t +
        (2*p0 - 5*p1 + 4*p2 - p3) * t * t +
        (-p0 + 3*p1 - 3*p2 + p3) * t * t * t
      )
    }

    // --- State ---
    const SAMPLE_MS  = 33    // ~30fps sampling of real cursor
    const LAG        = 1.8   // Display this many samples behind latest (smoothness)
    const MAX_SAMPLES = 14

    let rx = 0, ry = 0       // Live real cursor position
    let sx = 0, sy = 0       // Smoothed display position
    let samples    = []
    let trimCount  = 0       // How many samples shifted off the front
    let displayT   = 0       // Fractional index in global sample space
    let lastSample = 0
    let lastFrame  = performance.now()
    let active     = false
    let isHand     = false

    document.addEventListener('mousemove', e => {
      rx = e.clientX; ry = e.clientY
      if (!active) {
        sx = rx; sy = ry
        samples    = [{ x: rx, y: ry }]
        trimCount  = 0
        displayT   = 0
        lastSample = performance.now()
        active     = true
        el.style.display = 'block'
      }
    }, { passive: true })

    // --- Hand cursor detection ---
    function updateCursorShape() {
      const under = document.elementFromPoint(sx, sy)
      let hand = false
      let node = under
      while (node && node !== document.documentElement) {
        const tag = node.tagName && node.tagName.toLowerCase()
        if (['a','button','select','input','textarea','label','summary'].includes(tag)) { hand = true; break }
        if (window.getComputedStyle(node).cursor === 'pointer') { hand = true; break }
        node = node.parentElement
      }
      if (hand !== isHand) {
        isHand = hand
        el.innerHTML = hand ? handSvg : arrowSvg
      }
    }

    ;(function tick(now) {
      const dt = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

      if (active) {
        // Periodic sample
        if (now - lastSample >= SAMPLE_MS) {
          samples.push({ x: rx, y: ry })
          lastSample = now
          while (samples.length > MAX_SAMPLES) {
            samples.shift()
            trimCount++
            if (displayT < trimCount) displayT = trimCount
          }
        }

        if (samples.length >= 2) {
          // Advance displayT toward (latest sample − LAG), slightly faster than
          // sample rate so the cursor catches up after fast bursts
          const targetT = trimCount + samples.length - 1 - LAG
          const speed   = (1000 / SAMPLE_MS) * 1.5   // samples per second
          if (displayT < targetT) displayT = Math.min(displayT + speed * dt, targetT)

          // Map global displayT to local array index
          const localT = displayT - trimCount
          const idx    = Math.min(Math.floor(localT), samples.length - 2)
          const t      = localT - idx
          const i0 = Math.max(0, idx - 1)
          const i1 = idx
          const i2 = Math.min(samples.length - 1, idx + 1)
          const i3 = Math.min(samples.length - 1, idx + 2)

          sx = cr(samples[i0].x, samples[i1].x, samples[i2].x, samples[i3].x, t)
          sy = cr(samples[i0].y, samples[i1].y, samples[i2].y, samples[i3].y, t)
        } else if (samples.length === 1) {
          sx = samples[0].x; sy = samples[0].y
        }

        updateCursorShape()
        const hotX = isHand ? hx : ax
        const hotY = isHand ? hy : ay
        el.style.transform = `translate(${sx - hotX}px,${sy - hotY}px)`
      }

      requestAnimationFrame(tick)
    })(performance.now())
  }

  const args = {
    arrowSvg: DEFAULT_CURSOR_SVG, handSvg: HAND_CURSOR_SVG,
    ax: DEFAULT_HOTSPOT.x, ay: DEFAULT_HOTSPOT.y,
    hx: HAND_HOTSPOT.x,   hy: HAND_HOTSPOT.y
  }

  await page.evaluate(script, args)
  page.on('load', async () => {
    try { await page.evaluate(script, args) } catch (_) {}
  })
}

/**
 * Injects a subtle click ripple visualizer for manual recordings.
 * On every mousedown a white ring expands from the click point and fades out.
 * Works on any background via a white ring + dark hairline shadow.
 * Re-injects on page navigation.
 */
async function injectClickVisualizer(page) {
  const script = () => {
    if (document.getElementById('__ws_click_viz_style')) return

    const style = document.createElement('style')
    style.id = '__ws_click_viz_style'
    style.textContent = `
      @keyframes __ws_ripple {
        0%   { transform: translate(-50%,-50%) scale(0.15); opacity: 1; }
        100% { transform: translate(-50%,-50%) scale(1);    opacity: 0; }
      }
      .__ws_ripple {
        position: fixed;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.95);
        box-shadow: 0 0 0 1.5px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(0,0,0,0.06);
        pointer-events: none;
        z-index: 2147483647;
        animation: __ws_ripple 0.42s cubic-bezier(0.15,0,0.35,1) forwards;
      }
    `
    document.head.appendChild(style)

    document.addEventListener('mousedown', e => {
      const el = document.createElement('div')
      el.className = '__ws_ripple'
      el.style.left = e.clientX + 'px'
      el.style.top = e.clientY + 'px'
      document.documentElement.appendChild(el)
      el.addEventListener('animationend', () => el.remove())
    }, { passive: true })
  }

  await page.evaluate(script)
  page.on('load', async () => {
    try { await page.evaluate(script) } catch (_) {}
  })
}

module.exports = { runHoverInteractions, injectFakeCursor, injectSmoothCursor, injectClickVisualizer, findAllHoverTargets, interactHover }
