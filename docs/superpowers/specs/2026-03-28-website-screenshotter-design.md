# Web Screenshotter — Design Spec
_Date: 2026-03-28_

## Overview

A macOS desktop app for web design portfolio production. Given a URL, it captures high-quality retina screenshots and smooth scroll videos of websites, ready for After Effects import and portfolio presentation. Built with Electron + Playwright + FFmpeg.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron (ad-hoc signed, no Apple Developer subscription required) |
| Browser automation | Playwright (bundled Chromium, downloaded on first launch) |
| Video encoding | FFmpeg (bundled binary, no user install required) |
| UI | Vanilla HTML/CSS/JS (no framework) |
| IPC | Electron IPC (renderer ↔ main process) |
| Storage | JSON files in `~/Library/Application Support/WebScreenshotter/` |
| Secrets | macOS Keychain (auth passwords, never stored in plaintext) |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│                  Electron App                   │
│                                                 │
│  ┌──────────────┐         ┌──────────────────┐  │
│  │   Renderer   │◄──IPC──►│   Main Process   │  │
│  │  (HTML/CSS/  │         │   (Node.js)       │  │
│  │   Vanilla JS)│         │                  │  │
│  └──────────────┘         │  ┌────────────┐  │  │
│                           │  │ Playwright │  │  │
│                           │  └────────────┘  │  │
│                           │  ┌────────────┐  │  │
│                           │  │   FFmpeg   │  │  │
│                           │  └────────────┘  │  │
│                           │  ┌────────────┐  │  │
│                           │  │ File System│  │  │
│                           │  └────────────┘  │  │
│                           └──────────────────┘  │
└─────────────────────────────────────────────────┘
```

- Renderer sends jobs and receives streamed progress events via IPC
- All heavy lifting (Playwright, FFmpeg, file I/O) runs in the main process
- No external server — everything runs inside the app bundle

---

## 3. Core Modules

### 3.1 `screenshot-engine`
- Playwright with `deviceScaleFactor: 2` (retina)
- Modes: single-viewport or full-page (auto-stitched)
- Pre-capture: auto-accept cookies (via autoconsent), inject default CSS
- Returns PNG files named `<slug>--<device-id>.png`

### 3.2 `video-engine`
- Launches headed Chromium at a precise off-screen position (does not interfere with user's work)
- Pre-capture: auto-accept cookies visibly on screen (recorded as part of video), inject default CSS
- Waits for page load + configurable hero wait (default 15s)
- Runs `section-analyzer` to build scroll stop list
- Optionally runs `hover-engine` during scroll
- FFmpeg `avfoundation` captures the Chromium window at 60fps
- Encodes H.264 MP4 at CRF 18 (visually near-lossless, After Effects compatible)
- Output: `scroll--<device-id>.mp4`

### 3.3 `section-analyzer`
- Runs in-page JS via Playwright
- Queries `<section>`, `<article>`, `[id]` elements and large block containers
- Filters by height (must be meaningful — not tiny fragments)
- Returns ordered list of `scrollY` positions so each stop lands a section top flush with the viewport
- Falls back to fixed 1000px scroll steps if no sections are detected

### 3.4 `hover-engine`
- Scans all stylesheets via CSSOM (`document.styleSheets`) for rules containing `:hover`
- Maps selectors to visible DOM elements
- Groups by selector/class — visits each *type* once, skips duplicates
- During scroll: when a hover-enabled element enters viewport, `page.mouse.move()` interpolates cursor smoothly to element, pauses ~1.5s, moves away, scroll resumes
- Toggled per capture — default: **off**

### 3.5 `crawler`
- Discovers all `<a href>` links on a page
- Filters: same domain only, HTML pages only (skips PDFs, images, downloads), deduplicates `#anchor` variants
- Hard cap: 30 pages
- Returns an ordered queue of URLs

### 3.6 `auth-handler`
Two strategies, selected per job:
- **Basic (htaccess)**: credentials passed via Playwright's `httpCredentials` option
- **Form-based (e.g. Shopify)**: configurable CSS selector for password field + submit button; fills and submits before capture; verifies post-login state before proceeding
- Auth failure aborts the job with a clear error message (does not silently capture the login page)
- Passwords stored in macOS Keychain; JSON stores a reference key only

### 3.7 `preset-manager`
- Reads/writes `~/Library/Application Support/WebScreenshotter/presets.json`
- Manages device presets and saved job presets

**Built-in device presets (user-editable):**

| Name | Width | Height |
|---|---|---|
| Full HD Desktop | 1920 | 1080 |
| MacBook Pro | 1440 | 900 |
| iPad Portrait | 768 | 1024 |
| iPad Landscape | 1024 | 768 |
| iPhone 16 Pro | 393 | 852 |

### 3.8 `output-manager`
- Creates output folders under configurable root (default: `~/Desktop/WebScreenshots/`)
- Naming: `<domain>_<YYYY-MM-DD>_<HH-MM>_<device-id>/` for single-device
- Multi-device batch: `<domain>_<YYYY-MM-DD>_<HH-MM>/macbook-pro/`, `.../iphone-16-pro/` etc.
- Maintains `~/Library/Application Support/WebScreenshotter/history.json` (thumbnail path + timestamp per run)
- ZIP export: bundles session folder on demand

---

## 4. Default CSS Injection

Applied to every capture (screenshot and video). Pre-populated in UI, locked lines + free-text area for user additions:

```css
/* Hide scrollbars */
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }

/* Remove tap highlight */
* { -webkit-tap-highlight-color: transparent !important; }
```

Cookie banners are handled via `@duckduckgo/autoconsent` (real interaction), not CSS hiding.

---

## 5. UI Layout

Single-window app, sidebar navigation:

```
┌─────────────────────────────────────────────────────────┐
│  ● ● ●   Web Screenshotter                              │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  📷 Capture  │  [ URL input field          ] [+ Add to Queue]│
│          │                                              │
│  📋 Queue │  Device:  [iPhone 16 Pro ▼]  [Manage Presets]  │
│          │                                              │
│  🕐 History  │  Mode:  ○ Screenshot  ● Video               │
│          │                                              │
│  ⚙️ Settings │  ── Screenshot options ──────────────────   │
│          │  Type: ○ Single viewport  ● Full page        │
│          │  Crawl: ○ Single page  ○ Recursive (max 30)  │
│          │                                              │
│          │  ── Video options ────────────────────────   │
│          │  Speed: ○ Slow  ● Medium  ○ Fast             │
│          │  Section-aware scroll: ● On  ○ Off           │
│          │  Hover interactions:   ○ On  ● Off           │
│          │  Viewport extend (px): [____]                │
│          │                                              │
│          │  ── Auth (optional) ──────────────────────   │
│          │  Type: ○ None  ○ Basic  ○ Form               │
│          │  [user] [pass] / [selector] [pass]           │
│          │                                              │
│          │  ── CSS Injection ────────────────────────   │
│          │  [locked defaults + free-text area]          │
│          │                                              │
│          │  Custom wait (s): [15]   Dark mode: ○ On ● Off│
│          │                                              │
│          │         [ ▶ Start Capture ]                  │
│          │                                              │
│          ├──────────────────────────────────────────────┤
│          │  ▸ Live log / progress stream                │
└──────────┴──────────────────────────────────────────────┘
```

**Queue panel** — pending jobs with status (waiting / running / done / error), reorderable, each row shows URL + device + mode.

**History panel** — thumbnail grid of past captures. Click to open output folder in Finder or re-run with same settings.

**Settings panel** — output folder picker, FFmpeg path override, default scroll behavior, device preset management, Quiet Mode app list.

**Live log** — always visible at bottom, streams real-time output from Playwright and FFmpeg.

---

## 6. Data Model

### `presets.json`
```json
{
  "devices": [
    { "id": "full-hd", "name": "Full HD Desktop", "width": 1920, "height": 1080 }
  ],
  "jobs": [
    {
      "id": "uuid",
      "name": "Client A – Full Site",
      "url": "https://example.com",
      "device": "macbook-pro",
      "mode": "screenshot",
      "screenshotType": "full-page",
      "crawl": true,
      "crawlMaxPages": 30,
      "auth": { "type": "basic", "keychainRef": "key-uuid" },
      "scrollSpeed": "medium",
      "sectionAwareScroll": true,
      "hoverInteractions": false,
      "viewportExtend": 0,
      "darkMode": false,
      "customCss": "",
      "customWaitSeconds": 15
    }
  ]
}
```

### Output folder structure
```
~/Desktop/WebScreenshots/
└── example.com_2026-03-28_14-30_macbook-pro/
    ├── index--macbook-pro.png
    ├── about--macbook-pro.png
    └── scroll--macbook-pro.mp4

# Multi-device batch:
└── example.com_2026-03-28_14-30/
    ├── macbook-pro/
    │   ├── index--macbook-pro.png
    │   └── scroll--macbook-pro.mp4
    └── iphone-16-pro/
        ├── index--iphone-16-pro.png
        └── scroll--iphone-16-pro.mp4
```

---

## 7. Error Handling

- **Per-job failures** do not stop the queue — failed jobs are marked red with reason, re-runnable individually
- **Crawler** skips non-HTML links, `#anchor` duplicates, logs every skipped URL
- **Page load timeout** — 30s default, capture proceeds with whatever rendered; configurable in Settings
- **FFmpeg** — bundled binary used automatically; Settings panel allows custom path override if needed
- **Auth failure** — job aborted with clear message; does not silently capture login page
- **Headed browser window** — positioned off-screen during video capture; floating status badge confirms recording in progress

---

## 8. Performance — Recording Quality Mode

### 8.1 Automatic (always on)
When recording starts, the app:
- Sets Node.js/FFmpeg/Chromium processes to macOS `QOS_CLASS_USER_INTERACTIVE`
- Applies `nice -n -20` to elevate process priority
- No user action required; sufficient on Apple Silicon Macs

### 8.2 Quiet Mode (optional toggle in Settings)
Before recording begins:
- Gracefully quits a user-configurable list of resource-hungry apps via AppleScript `quit` (not force-kill — apps save state)
- Default list: Slack, Spotify, Chrome, Mail, Safari
- After recording finishes: relaunches the apps that were quit
- Toggle per capture session

---

## 9. Feature Summary

| Feature | Included |
|---|---|
| Retina (2x) screenshots | ✓ |
| Full-page screenshot (stitched) | ✓ |
| Single-viewport screenshot | ✓ |
| Recursive crawl (same domain, max 30 pages) | ✓ |
| 60fps H.264 MP4 video | ✓ |
| Section-aware scroll stops | ✓ |
| Hover state interactions in video | ✓ (optional, default off) |
| Auto-accept cookie banners | ✓ |
| Hide scrollbars + tap highlight (CSS) | ✓ (default on) |
| Custom CSS injection | ✓ |
| Dark mode emulation | ✓ |
| HTTP Basic auth (htaccess) | ✓ |
| Form-based auth (Shopify etc.) | ✓ |
| Device presets (5 built-in, user-editable) | ✓ |
| Saved job presets | ✓ |
| Batch queue | ✓ |
| Multi-device batch capture | ✓ |
| Capture history with thumbnails | ✓ |
| ZIP export | ✓ |
| Process priority boost (auto) | ✓ |
| Quiet Mode (graceful app quit before record) | ✓ (optional) |
| Viewport height extension | ✓ |
| Configurable hero wait duration | ✓ |
| Passwords in macOS Keychain | ✓ |
| Live log / progress stream | ✓ |
