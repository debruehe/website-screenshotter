# Mobile Emulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Playwright mobile emulation (`isMobile`, `hasTouch`) for all capture modes when `device.width < 1025`.

**Architecture:** Three identical two-line additions to `contextOptions` objects in two engine files. No schema changes, no new settings, no UI changes. The threshold `< 1025` includes iPhone (402px), iPad Portrait (768px), and iPad Landscape (1024px).

**Tech Stack:** Playwright (Chromium context options), Node.js

---

### Task 1: Add mobile emulation to all three Playwright context setups

**Files:**
- Modify: `src/main/video-engine.js:71-75` (contextOptions in `setupBrowser`)
- Modify: `src/main/screenshot-engine.js:84-88` (contextOptions in `captureScreenshots`)
- Modify: `src/main/screenshot-engine.js:232-236` (contextOptions in `captureScreenshotsManual`)

No test files exist for these engine modules (they require live browser instances), so verification is done by manual smoke test after the edit.

- [ ] **Step 1: Edit `video-engine.js` — `setupBrowser` contextOptions**

Find this block (lines ~71-75):

```js
  const contextOptions = {
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    colorScheme: job.darkMode ? 'dark' : 'light'
  }
```

Replace with:

```js
  const contextOptions = {
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    colorScheme: job.darkMode ? 'dark' : 'light'
  }
  if (device.width < 1025) {
    contextOptions.isMobile = true
    contextOptions.hasTouch = true
  }
```

- [ ] **Step 2: Edit `screenshot-engine.js` — `captureScreenshots` contextOptions**

Find this block (lines ~84-88):

```js
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }
```

Replace with:

```js
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }
    if (device.width < 1025) {
      contextOptions.isMobile = true
      contextOptions.hasTouch = true
    }
```

- [ ] **Step 3: Edit `screenshot-engine.js` — `captureScreenshotsManual` contextOptions**

Find this block (lines ~232-236):

```js
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }
```

Replace with:

```js
    const contextOptions = {
      viewport: { width: device.width, height: device.height + (job.viewportExtend || 0) },
      deviceScaleFactor: 2,
      colorScheme: job.darkMode ? 'dark' : 'light'
    }
    if (device.width < 1025) {
      contextOptions.isMobile = true
      contextOptions.hasTouch = true
    }
```

- [ ] **Step 4: Smoke test**

Start the app (`npm start`), select iPhone 17, take a screenshot of a responsive site (e.g. `apple.com`). Confirm the page renders in mobile layout (narrow mobile nav, hamburger menu, etc.) rather than the desktop layout.

- [ ] **Step 5: Commit**

```bash
git add src/main/video-engine.js src/main/screenshot-engine.js
git commit -m "feat: enable mobile emulation for devices with width < 1025px"
```
