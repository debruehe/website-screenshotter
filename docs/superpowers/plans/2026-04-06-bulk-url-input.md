# Bulk URL Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Bulk URLs" toggle to the Capture panel so users can paste a newline-separated list of URLs to capture as one job, as an alternative to automatic site crawling.

**Architecture:** A new `bulkUrls: string[]` field is added to the job config. The renderer normalizes the textarea input into this array. Both `screenshot-engine` and `video-engine` check for `bulkUrls` before the existing crawl branch and iterate over the list, producing output files named with per-URL slugs. No new IPC channels, no new main-process modules.

**Tech Stack:** Electron (IPC + renderer), Playwright (screenshot/video capture), Vanilla JS (renderer UI), Jest (unit tests)

---

## File Map

| File | Change |
|---|---|
| `src/renderer/panels/capture.js` | Add bulk checkbox + textarea to HTML; wire toggle events; update `buildJob`, `_saveUrlSettings`, `loadUrlSettings` |
| `src/main/screenshot-engine.js` | Add `bulkUrls` branch before crawl; update sub-folder and name-slug logic to use list length instead of `job.crawl` flag |
| `src/main/video-engine.js` | Add `outputPathOverride` param to `startRecording`; add per-URL loop in `captureVideo`; add `slugify` to output-manager import |

---

## Task 1: Capture panel — add Bulk URLs HTML structure

**Files:**
- Modify: `src/renderer/panels/capture.js`

- [ ] **Step 1: Wrap the crawl options in a toggleable container**

In `capture.js`, inside the `init()` method's HTML template, find the Crawl `<div>` (the one with `id="cap-crawl"` and `id="cap-crawl-max"`). Wrap those elements in a new div:

```js
// Before (the inner crawl div, starting around the <div class="opt-stack" that contains cap-crawl):
                <div>
                  <div class="sub-hdr">Crawl</div>
                  <div class="opt-stack" style="gap:8px">
                    <label class="opt-label"><input type="checkbox" id="cap-crawl"><span>Crawl site</span></label>
                    <div class="row-flex" style="gap:6px;align-items:center">
                      <span class="txt-muted" style="font-size:12px">Max</span>
                      <div class="unit-input">
                        <input type="number" id="cap-crawl-max" value="30" min="1" max="100">
                        <span class="unit-label">pages</span>
                      </div>
                    </div>
                  </div>
                </div>

// After:
                <div>
                  <div class="sub-hdr">Crawl</div>
                  <div class="opt-stack" style="gap:8px">
                    <div id="cap-crawl-opts">
                      <label class="opt-label"><input type="checkbox" id="cap-crawl"><span>Crawl site</span></label>
                      <div class="row-flex" style="gap:6px;align-items:center">
                        <span class="txt-muted" style="font-size:12px">Max</span>
                        <div class="unit-input">
                          <input type="number" id="cap-crawl-max" value="30" min="1" max="100">
                          <span class="unit-label">pages</span>
                        </div>
                      </div>
                    </div>
                    <label class="opt-label"><input type="checkbox" id="cap-bulk"><span>Bulk URLs</span></label>
                    <textarea id="cap-bulk-urls" rows="6" placeholder="One URL per line&#10;https://example.com/about&#10;https://example.com/work" style="display:none;margin-top:4px;font-size:11px;font-family:monospace" spellcheck="false"></textarea>
                  </div>
                </div>
```

- [ ] **Step 2: Verify the HTML renders correctly**

Run the app with `npm start`. Open the Capture panel → Screenshot mode. Confirm:
- "Crawl site" checkbox and Max pages input are visible as before
- A new "Bulk URLs" checkbox appears below them
- No textarea is visible yet (it has `display:none`)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/panels/capture.js
git commit -m "feat: add bulk URLs checkbox and textarea to capture panel HTML"
```

---

## Task 2: Capture panel — wire toggle, buildJob, save/load

**Files:**
- Modify: `src/renderer/panels/capture.js`

- [ ] **Step 1: Add `_parseBulkUrls` method to `capturePanel`**

Add this method to the `capturePanel` object (anywhere alongside the other `_` methods):

```js
_parseBulkUrls(text) {
  return (text || '').split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.includes('://') ? s : 'https://' + s)
    .filter(s => { try { new URL(s); return true } catch { return false } })
},
```

- [ ] **Step 2: Add the toggle event listener in `bindEvents()`**

Add this block inside `bindEvents()`, after the existing "Batch toggle" block:

```js
// Bulk URLs toggle
document.getElementById('cap-bulk').addEventListener('change', e => {
  const isBulk = e.target.checked
  document.getElementById('cap-crawl-opts').style.display = isBulk ? 'none' : 'block'
  document.getElementById('cap-bulk-urls').style.display = isBulk ? 'block' : 'none'
  this._scheduleUrlSettingsSave()
})
```

- [ ] **Step 3: Add auto-fill anchor URL on textarea blur**

Add this block inside `bindEvents()`, after the bulk toggle listener:

```js
// Auto-fill anchor URL from first bulk URL on textarea blur
document.getElementById('cap-bulk-urls').addEventListener('blur', () => {
  const textarea = document.getElementById('cap-bulk-urls')
  const urlInput = document.getElementById('cap-url')
  if (!urlInput.value.trim()) {
    const first = this._parseBulkUrls(textarea.value)[0]
    if (first) urlInput.value = first
  }
  this._scheduleUrlSettingsSave()
})
```

- [ ] **Step 4: Add `cap-bulk` and `cap-bulk-urls` to `saveFields`**

In `bindEvents()`, find the `saveFields` array and add the two new IDs:

```js
// Before:
const saveFields = [
  'cap-page-name', 'cap-crawl', 'cap-crawl-max', 'cap-wait',
  'cap-css', 'cap-extend', 'cap-speed', 'cap-pause', 'cap-hover', 'cap-scr-manual', 'cap-smooth-cursor'
]

// After:
const saveFields = [
  'cap-page-name', 'cap-crawl', 'cap-crawl-max', 'cap-bulk', 'cap-bulk-urls', 'cap-wait',
  'cap-css', 'cap-extend', 'cap-speed', 'cap-pause', 'cap-hover', 'cap-scr-manual', 'cap-smooth-cursor'
]
```

- [ ] **Step 5: Update `buildJob()` to include `bulkUrls`**

In `buildJob()`, add `bulkUrls` to the returned object. The field should only contain URLs when bulk mode is checked:

```js
// Before (the crawl lines):
      crawl: document.getElementById('cap-crawl').checked,
      crawlMaxPages: parseInt(document.getElementById('cap-crawl-max').value) || 30,

// After:
      crawl: document.getElementById('cap-crawl').checked,
      crawlMaxPages: parseInt(document.getElementById('cap-crawl-max').value) || 30,
      bulkUrls: document.getElementById('cap-bulk').checked
        ? this._parseBulkUrls(document.getElementById('cap-bulk-urls').value)
        : [],
```

- [ ] **Step 6: Update `_saveUrlSettings()` to persist `bulkUrls`**

In `_saveUrlSettings()`, add two fields to the object passed to `window.api.saveUrlSettings`:

```js
// Before (the last two lines of the settings object):
      hoverInteractions: document.getElementById('cap-hover')?.checked ?? false,
      smoothCursor:      document.getElementById('cap-smooth-cursor')?.checked ?? false,

// After:
      hoverInteractions: document.getElementById('cap-hover')?.checked ?? false,
      smoothCursor:      document.getElementById('cap-smooth-cursor')?.checked ?? false,
      bulkMode:          document.getElementById('cap-bulk').checked,
      bulkUrls:          document.getElementById('cap-bulk-urls').value,
```

Note: we save the raw textarea text (not the parsed array) so line breaks are preserved on reload.

- [ ] **Step 7: Update `loadUrlSettings()` to restore bulk state**

In `loadUrlSettings()`, add after the existing `smoothCursor` block (before the `// Sync batch/crawl visibility` comment):

```js
      if (s.bulkMode !== undefined) {
        document.getElementById('cap-bulk').checked = s.bulkMode
        document.getElementById('cap-crawl-opts').style.display = s.bulkMode ? 'none' : 'block'
        document.getElementById('cap-bulk-urls').style.display = s.bulkMode ? 'block' : 'none'
      }
      if (s.bulkUrls !== undefined)
        document.getElementById('cap-bulk-urls').value = s.bulkUrls
```

- [ ] **Step 8: Verify behavior manually**

Run `npm start`. In Screenshot mode:
1. Check "Bulk URLs" → "Crawl site" and max-pages input hide; textarea appears
2. Type `example.com/about` (no protocol) → tab away from textarea → `cap-url` should auto-fill with `https://example.com/about` if the URL field was empty
3. Leave URL field empty, type two URLs in textarea, click "Start" — confirm `buildJob()` returns `bulkUrls: ['https://...', 'https://...']` (add a temporary `console.log(JSON.stringify(this.buildJob()))` to verify, then remove it)
4. Enter a URL, switch to another URL, come back — bulk mode state and textarea content should be restored

- [ ] **Step 9: Commit**

```bash
git add src/renderer/panels/capture.js
git commit -m "feat: wire bulk URLs toggle, add to buildJob and url-settings persistence"
```

---

## Task 3: Screenshot engine — bulk URL branch

**Files:**
- Modify: `src/main/screenshot-engine.js`

- [ ] **Step 1: Add the bulk URL branch to `captureScreenshots`**

In `captureScreenshots`, find the URL resolution block (lines 104–119). Replace it:

```js
// Before:
    const urlsToCapture = [job.url]

    // Crawl if requested
    if (job.crawl) {
      onLog('Starting crawl...')
      const { crawl } = require('./crawler')
      const crawlPage = await context.newPage()
      if (job.auth?.type === 'form') {
        await crawlPage.goto(job.url, { waitUntil: 'domcontentloaded' })
        await authHandler.performFormLogin(crawlPage, { ...job.auth, password: job.auth._resolvedPassword })
      }
      const found = await crawl(crawlPage, job.url, job.crawlMaxPages || 30, onLog)
      await crawlPage.close()
      urlsToCapture.splice(0, urlsToCapture.length, ...found)
      onLog(`Crawl complete: ${found.length} pages`)
    }

// After:
    let urlsToCapture

    if (job.bulkUrls && job.bulkUrls.length > 0) {
      urlsToCapture = job.bulkUrls
      onLog(`Bulk mode: ${urlsToCapture.length} URL(s)`)
    } else if (job.crawl) {
      onLog('Starting crawl...')
      const { crawl } = require('./crawler')
      const crawlPage = await context.newPage()
      if (job.auth?.type === 'form') {
        await crawlPage.goto(job.url, { waitUntil: 'domcontentloaded' })
        await authHandler.performFormLogin(crawlPage, { ...job.auth, password: job.auth._resolvedPassword })
      }
      const found = await crawl(crawlPage, job.url, job.crawlMaxPages || 30, onLog)
      await crawlPage.close()
      urlsToCapture = found
      onLog(`Crawl complete: ${found.length} pages`)
    } else {
      urlsToCapture = [job.url]
    }
```

- [ ] **Step 2: Update sub-folder logic to use list length instead of `job.crawl` flag**

Find the per-page output folder block (around line 154). Replace:

```js
// Before:
        let pageOutputFolder = outputFolder
        if (job.crawl) {
          const pageSlug = slugify(urlPath)
          pageOutputFolder = path.join(outputFolder, pageSlug)
          fs.mkdirSync(pageOutputFolder, { recursive: true })
        }

        // Determine name slug: custom name for single-page captures, URL path for crawls
        const nameSlug = (!job.crawl && job.pageName)
          ? slugifyCustomName(job.pageName)
          : urlPath

// After:
        const isMultiPage = urlsToCapture.length > 1
        let pageOutputFolder = outputFolder
        if (isMultiPage) {
          const pageSlug = slugify(urlPath)
          pageOutputFolder = path.join(outputFolder, pageSlug)
          fs.mkdirSync(pageOutputFolder, { recursive: true })
        }

        // Use custom page name only for single-page captures; URL path for crawl/bulk
        const nameSlug = (!isMultiPage && job.pageName)
          ? slugifyCustomName(job.pageName)
          : urlPath
```

- [ ] **Step 3: Verify manually**

Run `npm start`. Enter a URL in bulk mode with 2–3 URLs (e.g. `https://example.com` lines). Start a screenshot capture. Confirm:
- Log shows "Bulk mode: N URL(s)" (not "Starting crawl...")
- Output folder contains a sub-folder per URL slug (e.g. `index/`, `about/`)
- Each sub-folder contains a correctly-named PNG
- Single-URL non-bulk mode still works as before (no sub-folder, pageName respected)

- [ ] **Step 4: Commit**

```bash
git add src/main/screenshot-engine.js
git commit -m "feat: add bulk URL branch to screenshot engine"
```

---

## Task 4: Video engine — bulk URL iteration

**Files:**
- Modify: `src/main/video-engine.js`

- [ ] **Step 1: Add `slugify` to the output-manager import**

At the top of `video-engine.js`, find the output-manager import (line 12):

```js
// Before:
const { videoFilename } = require('./output-manager')

// After:
const { videoFilename, slugify } = require('./output-manager')
```

- [ ] **Step 2: Add `outputPathOverride` parameter to `startRecording`**

`startRecording` currently builds its output path internally. Add an optional override so the bulk loop can supply a per-URL path.

Find the `startRecording` function signature and the `outputPath` line inside it:

```js
// Before (function signature):
async function startRecording(page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog, captureOptions = {}, isManual = false) {

// After:
async function startRecording(page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog, captureOptions = {}, isManual = false, outputPathOverride = null) {
```

Then, inside `startRecording`, find the line that builds `outputPath`:

```js
// Before:
  const outputPath = path.join(outputFolder, videoFilename(device.id, isManual))

// After:
  const outputPath = outputPathOverride || path.join(outputFolder, videoFilename(device.id, isManual))
```

- [ ] **Step 3: Add bulk URL loop to `captureVideo`**

In `captureVideo`, find the block after `setupBrowser` where `injectFakeCursor` and `startRecording` are called. Wrap the entire recording sequence in a bulk loop.

Replace the body of `captureVideo` after `const { page, close } = await setupBrowser(job, device, onLog)`:

```js
  try {
    const isBulk = job.bulkUrls && job.bulkUrls.length > 0
    const urlsToRecord = isBulk ? job.bulkUrls : null

    if (isBulk) {
      // Bulk mode: one recording per URL, browser stays open between URLs
      for (let urlIdx = 0; urlIdx < urlsToRecord.length; urlIdx++) {
        const url = urlsToRecord[urlIdx]
        const prefix = `[${urlIdx + 1}/${urlsToRecord.length}] `

        onLog(`${prefix}Navigating to ${url}...`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
        await page.waitForTimeout(2000)
        await page.reload({ waitUntil: 'domcontentloaded', timeout: (job.pageLoadTimeout || 30) * 1000 })
        await page.addStyleTag({ content: DEFAULT_CSS + (job.customCss || '') })

        if (job.hoverInteractions) await injectFakeCursor(page)

        const slug = slugify(new URL(url).pathname)
        const outputFilename = `scroll--${slug}--${device.id}.mp4`
        const outputPath = path.join(outputFolder, outputFilename)

        const { proc } = await startRecording(
          page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog,
          {}, false, outputPath
        )

        let escapePressed = false
        const escapeHandler = () => {
          escapePressed = true
          try { globalShortcut.unregister('Escape') } catch (_) {}
          if (typeof onLog === 'function') onLog('Escape pressed — stopping recording early...')
        }
        try { globalShortcut.register('Escape', escapeHandler) } catch (_) {}

        try {
          await page.waitForTimeout(500)

          onLog(`${prefix}Waiting ${job.heroWaitSeconds ?? 15}s for hero content...`)
          const heroMs = (job.heroWaitSeconds ?? 15) * 1000
          for (let waited = 0; waited < heroMs && !escapePressed; waited += 200) {
            await page.waitForTimeout(Math.min(200, heroMs - waited))
          }

          const speedMs = job.scrollSpeed || 2000
          let currentY = 0

          if (job.hoverInteractions) {
            const allTargets = await findAllHoverTargets(page, onLog)
            for (const target of allTargets) {
              if (escapePressed) break
              const scrollHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
              const maxScroll = Math.max(0, scrollHeight - device.height)
              const idealScroll = target.pageY + target.height / 2 - device.height / 2
              const targetScrollY = Math.min(Math.max(0, idealScroll), maxScroll)
              if (Math.abs(targetScrollY - currentY) > 10) {
                onLog(`Scrolling to ${Math.round(targetScrollY)}px`)
                await smoothScrollTo(page, targetScrollY, speedMs)
                currentY = targetScrollY
                await page.waitForTimeout(400)
              }
              if (escapePressed) break
              const viewportBox = {
                x: target.pageX, y: target.pageY - currentY,
                width: target.width, height: target.height
              }
              await interactHover(page, viewportBox, device.width, device.height, onLog, {
                checkDropdown: target.mayHaveDropdown,
                isCancelled: () => escapePressed
              })
            }
          } else {
            const pageH = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
            onLog(`${prefix}Page height: ${pageH}px`)
            const stops = await computeScrollStops(page, device.height, url)
            onLog(`${prefix}Scroll stops (${stops.length}): ${stops.join(', ')}`)
            for (const targetY of stops) {
              if (escapePressed) break
              if (targetY === currentY) continue
              onLog(`Scrolling to ${targetY}px`)
              await smoothScrollTo(page, targetY, speedMs)
              currentY = targetY
              const pauseMs = job.scrollPause ?? 1500
              for (let paused = 0; paused < pauseMs && !escapePressed; paused += 200) {
                await page.waitForTimeout(Math.min(200, pauseMs - paused))
              }
            }
          }

          if (!escapePressed) await page.waitForTimeout(1000)
        } finally {
          try { globalShortcut.unregister('Escape') } catch (_) {}
          await stopRecording(proc, onLog)
        }

        onLog(`${prefix}Video saved: ${outputFilename}`)
        if (typeof onFile === 'function') onFile(outputPath)

        if (escapePressed) {
          onLog('Bulk recording stopped early by user.')
          break
        }
      }
    } else {
      // Single URL mode — existing behavior, unchanged
      if (job.hoverInteractions) await injectFakeCursor(page)

      const { proc, outputPath } = await startRecording(page, device, outputFolder, scaleFactor, screenIndex, ffmpegPath, onLog)

      let escapePressed = false
      const escapeHandler = () => {
        escapePressed = true
        try { globalShortcut.unregister('Escape') } catch (_) {}
        if (typeof onLog === 'function') onLog('Escape pressed — stopping recording early...')
      }
      try { globalShortcut.register('Escape', escapeHandler) } catch (_) {}

      try {
        await page.waitForTimeout(500)

        if (typeof onLog === 'function') onLog(`Waiting ${job.heroWaitSeconds ?? 15}s for hero content... (press Escape to stop early)`)
        const heroMs = (job.heroWaitSeconds ?? 15) * 1000
        for (let waited = 0; waited < heroMs && !escapePressed; waited += 200) {
          await page.waitForTimeout(Math.min(200, heroMs - waited))
        }

        const speedMs = job.scrollSpeed || 2000
        let currentY = 0

        if (job.hoverInteractions) {
          const allTargets = await findAllHoverTargets(page, onLog)

          for (const target of allTargets) {
            if (escapePressed) break
            const scrollHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
            const maxScroll = Math.max(0, scrollHeight - device.height)
            const idealScroll = target.pageY + target.height / 2 - device.height / 2
            const targetScrollY = Math.min(Math.max(0, idealScroll), maxScroll)

            if (Math.abs(targetScrollY - currentY) > 10) {
              if (typeof onLog === 'function') onLog(`Scrolling to ${Math.round(targetScrollY)}px`)
              await smoothScrollTo(page, targetScrollY, speedMs)
              currentY = targetScrollY
              await page.waitForTimeout(400)
            }

            if (escapePressed) break
            const viewportBox = {
              x: target.pageX,
              y: target.pageY - currentY,
              width: target.width,
              height: target.height
            }
            await interactHover(page, viewportBox, device.width, device.height, onLog, {
              checkDropdown: target.mayHaveDropdown,
              isCancelled: () => escapePressed
            })
          }
        } else {
          const pageH = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
          if (typeof onLog === 'function') onLog(`Page height: ${pageH}px, viewport: ${device.height}px, maxScroll: ${pageH - device.height}px`)
          const stops = await computeScrollStops(page, device.height, job.url)
          if (typeof onLog === 'function') onLog(`Scroll stops (${stops.length}): ${stops.join(', ')}`)

          for (const targetY of stops) {
            if (escapePressed) break
            if (targetY === currentY) continue
            if (typeof onLog === 'function') onLog(`Scrolling to ${targetY}px`)
            await smoothScrollTo(page, targetY, speedMs)
            currentY = targetY
            const pauseMs = job.scrollPause ?? 1500
            for (let paused = 0; paused < pauseMs && !escapePressed; paused += 200) {
              await page.waitForTimeout(Math.min(200, pauseMs - paused))
            }
          }
        }

        if (!escapePressed) await page.waitForTimeout(1000)
      } finally {
        try { globalShortcut.unregister('Escape') } catch (_) {}
        await stopRecording(proc, onLog)
      }

      if (typeof onLog === 'function') onLog(`Video saved: ${videoFilename(device.id)}`)
      if (typeof onFile === 'function') onFile(outputPath)
    }
  } finally {
    await close()
  }
```

- [ ] **Step 4: Verify manually**

Run `npm start`. Switch to Video mode. Enable Bulk URLs, enter 2 URLs on separate lines. Click Start. Confirm:
- Log shows `[1/2] Navigating to ...` and `[2/2] Navigating to ...`
- Two separate MP4 files are saved, named `scroll--<slug>--<device-id>.mp4` for each URL
- Single-URL video mode still works as before (one file named `scroll--<device-id>.mp4`)

- [ ] **Step 5: Commit**

```bash
git add src/main/video-engine.js
git commit -m "feat: add bulk URL iteration to video engine"
```

---

## Final Manual Smoke Test

- [ ] **Screenshot + bulk**: 3 URLs, full-page mode → 3 sub-folders with PNGs ✓
- [ ] **Screenshot + bulk, single URL**: 1 URL in bulk list → no sub-folder, file in root of session folder ✓
- [ ] **Screenshot + single URL (non-bulk)**: pageName respected, no sub-folder ✓
- [ ] **Screenshot + crawl (non-bulk)**: crawl still works unchanged ✓
- [ ] **Video + bulk**: 2 URLs → 2 MP4 files with URL slugs ✓
- [ ] **Video + single URL (non-bulk)**: single `scroll--<device>.mp4` as before ✓
- [ ] **Bulk URLs toggle → uncheck → Crawl options reappear** ✓
- [ ] **Reload URL settings for a domain with saved bulk state → bulk mode and textarea restored** ✓
- [ ] **Empty bulk textarea → job falls back to `job.url` anchor** ✓
