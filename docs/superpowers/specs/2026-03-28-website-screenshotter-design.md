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
│  ┌──────────────┐         ┌──────────────────┐  │
│  │   Renderer   │◄──IPC──►│   Main Process   │  │
│  │  (HTML/CSS/  │         │   (Node.js)       │  │
│  │   Vanilla JS)│         │                  │  │
│  └──────────────┘         │  Playwright       │  │
│                           │  FFmpeg           │  │
│                           │  File System      │  │
│                           └──────────────────┘  │
└─────────────────────────────────────────────────┘
```

- Renderer sends jobs and receives streamed progress events via IPC
- All heavy lifting (Playwright, FFmpeg, file I/O) runs in the main process
- No external server — everything runs inside the app bundle
- FFmpeg bundled as a binary (`@ffmpeg-installer/ffmpeg`)
- Playwright Chromium downloaded on first launch with a progress modal

### First-launch experience
On first run, if Chromium is not yet installed, a full-window modal shows a progress bar and status message ("Downloading browser engine… 150 MB"). The app is not usable until this completes. Errors (no internet, disk space) are shown with a retry button.

---

## 3. Core Modules

### 3.1 `screenshot-engine`
- **Mode**: headless Playwright, `deviceScaleFactor: 2`
- **Full-page**: uses Playwright native `page.screenshot({ fullPage: true })` — no custom stitching
- **Single-viewport**: uses `page.screenshot({ fullPage: false })`
- **Pre-capture sequence**:
  1. Navigate to URL
  2. Run `auth-handler` if configured
  3. Inject default + custom CSS
  4. Run `@duckduckgo/autoconsent` to interact with and dismiss any cookie banner (silently, before capture)
  5. Wait 500ms for banner exit animation
  6. Wait configurable hero duration (default: 3s for screenshots, sufficient for most pages)
  7. Capture
- **Output**: PNG files named `<slug>--<device-id>.png`

### 3.2 `video-engine`

**Browser setup:**
- Launches headed (non-headless) Chromium via Playwright
- Window title set to `"WebScreenshotter-Capture"` (unique, used by FFmpeg to identify it)
- Window positioned at `{ x: 0, y: 23 }` (below macOS menu bar) on the primary display
- Viewport set to exact device dimensions (no retina scaling of the window — retina is handled by macOS display scaling for the recording)
- `deviceScaleFactor: 2` set in Playwright context so CSS pixels render at 2x

**Pre-capture sequence:**
1. Navigate to URL
2. Run `auth-handler` if configured
3. Inject default + custom CSS
4. FFmpeg begins recording (see below) — a 500ms delay before scroll begins ensures first frames are captured
5. `@duckduckgo/autoconsent` runs visibly on screen: cursor moves to the accept button, clicks it, banner animates out — all recorded
6. Wait 500ms for banner exit animation
7. Wait configurable hero duration (default: 15s, to allow hero videos to play)
8. `section-analyzer` builds scroll stop list
9. Scroll sequence begins (see below)
10. 1s pause after final scroll position
11. Main process sends SIGINT to FFmpeg to finalize the MP4

**FFmpeg capture command:**

`avfoundation` identifies inputs by index, not window title. The correct index for the primary display is resolved at runtime by running `ffmpeg -f avfoundation -list_devices true -i ""` and parsing its stderr output to find the first screen device (e.g., `"Capture screen 0"` → index `"0"`). This index is used for capture.

The Chromium window is always positioned at `{ x: 0, y: 23 }` with known device dimensions, so FFmpeg crops exactly to the viewport area using a crop filter. On Retina (HiDPI) displays, macOS screen coordinates are logical pixels but the physical pixel buffer is 2×, so all crop values are multiplied by the display's `devicePixelRatio` (2 on Retina).

```
ffmpeg -f avfoundation -capture_cursor 0 -framerate 60 -i "0"
       -vf "crop=W*dpr:H*dpr:0:23*dpr"
       -r 60 -vcodec libx264 -crf 18 -preset slow
       -pix_fmt yuv420p output.mp4
```

Where `W` = device viewport width, `H` = device viewport height, `dpr` = display `devicePixelRatio` (queried via Electron's `screen.getPrimaryDisplay().scaleFactor` before recording starts).

**Retina resolution note:** On Retina/HiDPI displays (`scaleFactor = 2`), FFmpeg captures 2× physical pixels, so a 1440×900 viewport produces a 2880×1800 MP4 — true retina quality. On non-Retina displays (`scaleFactor = 1`), output is 1× resolution. This app is designed for Retina Mac use; non-Retina output is acceptable but not the primary target.

**Cursor visibility:** `-capture_cursor 0` hides the OS cursor from the screen recording. Playwright's `page.mouse.move()` moves the OS cursor internally (triggering CSS `:hover` states), but the cursor is not visible in the final video. The page's rendered hover styles are visible; the cursor is not.

**Scroll sequence:**
- `section-analyzer` returns an array of `[scrollY]` stop points
- Between each stop: scroll is animated using `page.evaluate()` with a `requestAnimationFrame`-based easing loop (ease-in-out cubic), running at the display's native framerate
- Scroll speed presets define the duration per 1000px of scroll distance:
  - Slow: 2000ms / 1000px
  - Medium: 1200ms / 1000px
  - Fast: 700ms / 1000px
- After arriving at each stop: pause duration is 1.5s (not configurable in v1)
- If `hover-engine` is enabled: hover interactions are executed at the current scroll position before the pause ends

**Output:** `scroll--<device-id>.mp4`

### 3.3 `section-analyzer`
- Runs in-page JS via `page.evaluate()`
- Queries: `section, article, [id], .section, [class*="section"]` and direct children of `main`, `#app`, `#root`, `.container`
- **Height filter**: element must be ≥ max(200px, 25% of viewport height) to qualify as a section boundary
- Deduplicates scroll positions within 100px of each other
- Returns `number[]` of `scrollY` values in ascending order
- Fallback: if fewer than 2 sections found, returns fixed steps of 1000px from 0 to `document.body.scrollHeight`

### 3.4 `hover-engine`
- Scans `document.styleSheets` for rules containing `:hover` pseudo-class
- Maps matching selectors to visible, in-viewport DOM elements at the current scroll position
- Groups by base selector (e.g., all `.btn` elements are one type) — visits the first visible instance only
- For each unique type: `page.mouse.move()` with 20 interpolation steps over 400ms (smooth path), pauses 1.5s, moves back to a neutral position (center of the current viewport)
- Runs after each scroll stop, before the pause timer
- Default: **off**

### 3.5 `crawler`
- Discovers all `<a href>` links via `page.$$eval('a[href]', ...)`
- **Domain filter**: strict match on `hostname` only — subdomains (e.g., `blog.example.com`) are excluded when crawling `example.com`
- Skips: non-HTTP(S) links, file extensions `.pdf .zip .jpg .png .gif .svg .mp4 .webp`, `#anchor` variants of already-queued URLs
- Hard system maximum: **30 pages**. `crawlMaxPages` in the job config sets a per-job limit of 1–30 (default 30). Users cannot exceed 30.
- Returns a de-duplicated, ordered URL queue

### 3.6 `auth-handler`
Two strategies:

**Basic (htaccess):** credentials passed via Playwright's `context.setHTTPCredentials({ username, password })` before navigation.

**Form-based (e.g. Shopify):** configurable per job:
- `formPasswordSelector`: CSS selector for the password input (e.g. `#password`)
- `formSubmitSelector`: CSS selector for the submit button (e.g. `button[type=submit]`)
- `postLoginUrlPattern`: optional URL substring to verify successful login (e.g. `/` or `/collections`)
- Sequence: navigate → fill password field → click submit → wait for navigation → verify URL contains `postLoginUrlPattern` (if set). If verification fails, abort with error "Login failed — check selectors and credentials."

Passwords stored in macOS Keychain via `keytar` npm package. JSON stores only a `keychainRef` UUID per job.

### 3.7 `preset-manager`
Manages two separate namespaces in `presets.json`:

**Device presets** — viewport dimensions + name. The 5 built-in presets are user-editable and deletable; new custom devices can be added.

**Job presets** — full saved job configurations (all fields). Named by the user. Loaded into the Capture panel on selection. These are separate from device presets in both storage and UI.

Built-in device presets:

| Name | Width | Height |
|---|---|---|
| Full HD Desktop | 1920 | 1080 |
| MacBook Pro | 1440 | 900 |
| iPad Portrait | 768 | 1024 |
| iPad Landscape | 1024 | 768 |
| iPhone 16 Pro | 393 | 852 |

### 3.8 `output-manager`
- Output root: `~/Desktop/WebScreenshots/` (configurable in Settings)
- **Single-device:** `<domain>_<YYYY-MM-DD>_<HH-MM>_<device-id>/`
- **Multi-device batch:** `<domain>_<YYYY-MM-DD>_<HH-MM>/<device-id>/`
- File naming: `<slug>--<device-id>.png`, `scroll--<device-id>.mp4`
- `<slug>` is derived from the URL path: `/about-us/` → `about-us`, root `/` → `index`
- Maintains `history.json`: one entry per session run, containing: `{ id, url, device, mode, timestamp, outputFolder, thumbnailPath }`
- **ZIP export**: triggered per session from History panel; bundles the entire session folder into `<folder-name>.zip` alongside the folder

---

## 4. Default CSS Injection

Applied to every capture (screenshot and video). Pre-populated locked lines in the UI; user free-text area appends below:

```css
/* Hide scrollbars */
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }

/* Remove tap highlight */
* { -webkit-tap-highlight-color: transparent !important; }
```

Cookie banners are handled via `@duckduckgo/autoconsent` — the library interacts with the real consent UI rather than hiding it with CSS.

### Viewport extension
The `viewportExtend` job field (integer, pixels, default 0) pushes the browser's status bar (link-hover preview in bottom-left) below the visible capture area.

**Implementation:**
- Playwright viewport is set to `{ width: device.width, height: device.height + viewportExtend }`
- For **screenshots**: `page.screenshot({ fullPage: false })` captures the full extended height. The extra pixels are visible at the bottom. User crops in post if desired. (Full-page screenshots are unaffected — they already capture full document height.)
- For **video**: the FFmpeg `crop` filter uses only `device.height` (not `device.height + viewportExtend`) as the crop height. The browser window is taller than the recording area, so the status bar is rendered below the recorded rectangle and never appears in the video.
- Recommended value: 40–60px (sufficient to push the ~20px status bar out of frame with margin).

---

## 5. UI Layout

Single-window app, sidebar navigation with four panels. Live log always visible at bottom of content area.

### Capture panel
```
[ URL input field                    ] [ Save as preset ▾ ] [ + Add to Queue ]

Device:  [ iPhone 16 Pro          ▼ ]  [ Manage Devices ]
         ☐ Batch: select multiple devices

Mode:    ○ Screenshot   ● Video

── Screenshot options ──────────────────────────────────────
  Type:  ○ Single viewport   ● Full page
  Crawl: ○ Single page   ○ Recursive  Max pages: [ 30 ]

── Video options ────────────────────────────────────────────
  Scroll speed:          ○ Slow   ● Medium   ○ Fast
  Section-aware scroll:  ● On   ○ Off
  Hover interactions:    ○ On   ● Off
  Viewport extend (px):  [ 0 ]

── Auth (optional) ──────────────────────────────────────────
  Type:  ● None   ○ Basic   ○ Form
  Basic:  [ username ]  [ password ]
  Form:   [ password selector ]  [ submit selector ]  [ password ]
          Post-login URL pattern (optional): [ /  ]

── CSS injection ────────────────────────────────────────────
  [locked] * { scrollbar-width: none !important; }
  [locked] *::-webkit-scrollbar { display: none !important; }
  [locked] * { -webkit-tap-highlight-color: transparent !important; }
  [ free-text area for additional CSS ]

Hero wait (s):  [ 15 ]      Dark mode:  ○ On   ● Off

                        [ ▶ Start Capture ]

────────────────────────────────────────────────────────────
▸ Live log output
```

"Save as preset" dropdown: "Save as new preset…" (prompts for name) or shows existing presets to overwrite.

Batch mode: reveals a checklist of all device presets; multiple can be selected simultaneously.

### Queue panel
- List of pending/running/done/failed jobs
- Each row: URL, device(s), mode, status badge, progress indicator
- Actions per row: Cancel (if pending/running), Re-run, Remove
- Drag to reorder pending jobs
- "Clear completed" button

### History panel
- Thumbnail grid, newest first
- Each card: domain, device, date, mode icon
- Card actions: Open in Finder, Re-run (loads settings back into Capture panel), Export ZIP, Delete
- Sessions with errors shown with a warning indicator

### Settings panel
- **Output folder**: path picker, defaults to `~/Desktop/WebScreenshots/`
- **Page load timeout**: number input (default 30s)
- **FFmpeg path override**: text field (leave blank to use bundled binary)
- **Device presets**: editable list with add/edit/delete
- **Quiet Mode**:
  - Toggle: on/off
  - Editable list of apps to quit before recording (default: Slack, Spotify, Google Chrome, Mail, Safari)
  - Toggle: relaunch apps after recording (default: on)

---

## 6. Data Model

### `presets.json`
```json
{
  "devices": [
    { "id": "full-hd", "name": "Full HD Desktop", "width": 1920, "height": 1080 },
    { "id": "macbook-pro", "name": "MacBook Pro", "width": 1440, "height": 900 },
    { "id": "ipad-portrait", "name": "iPad Portrait", "width": 768, "height": 1024 },
    { "id": "ipad-landscape", "name": "iPad Landscape", "width": 1024, "height": 768 },
    { "id": "iphone-16-pro", "name": "iPhone 16 Pro", "width": 393, "height": 852 }
  ],
  "jobs": [
    {
      "id": "uuid",
      "name": "Client A – Full Site",
      "url": "https://example.com",
      "device": "macbook-pro",
      "batchDevices": [],
      "mode": "screenshot",
      "screenshotType": "full-page",
      "crawl": true,
      "crawlMaxPages": 30,
      "auth": {
        "type": "form",
        "keychainRef": "key-uuid",
        "formPasswordSelector": "#password",
        "formSubmitSelector": "button[type=submit]",
        "postLoginUrlPattern": "/"
      },
      "scrollSpeed": "medium",
      "sectionAwareScroll": true,
      "hoverInteractions": false,
      "viewportExtend": 0,
      "heroWaitSeconds": 15,
      "darkMode": false,
      "customCss": ""
    }
  ]
}
```

### Output folder structure
```
~/Desktop/WebScreenshots/

# Single device:
└── example.com_2026-03-28_14-30_macbook-pro/
    ├── index--macbook-pro.png
    ├── about--macbook-pro.png
    ├── work--macbook-pro.png
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

- **Per-job failures** do not stop the queue — failed jobs marked red with reason, re-runnable individually
- **Crawler** skips non-HTML links, anchor duplicates, logs every skipped URL to the live log
- **Page load timeout**: 30s default (configurable in Settings); capture proceeds with whatever has rendered
- **FFmpeg**: bundled binary used automatically; Settings panel allows custom path override
- **Auth failure**: job aborted immediately with message "Login failed — check selectors and credentials." Never silently captures a login page.
- **Headed browser window** for video: positioned at `{x:0, y:23}` on primary display, in front of other windows but behind any user-raised windows. A small floating status badge ("● Recording") appears in the top-right of the screen during capture. User should not interact with the Chromium window during recording.
- **First-launch Chromium download failure**: retry button shown, app remains in setup state.

---

## 8. Performance — Recording Quality Mode

### Automatic (always on)
When any capture begins, the app sets Node.js and spawned child processes (FFmpeg, Chromium) to macOS `QOS_CLASS_USER_INTERACTIVE` via the `@napi-rs/nice` native addon. This is best-effort — no root access required. Priority elevation is not guaranteed on all configurations but improves scheduling on Apple Silicon in typical use.

`nice -n -20` is **not** used (requires root on macOS and would silently fail). QoS classes are the correct macOS mechanism.

### Quiet Mode (optional, toggled in Settings)
Before recording starts:
- Gracefully quits a user-configurable list of apps via AppleScript `tell application "X" to quit`
- Apps save their state (this is not a force-kill)
- Default list: Slack, Spotify, Google Chrome, Mail, Safari
- After recording finishes: relaunches any app that was quit via `open -a "AppName"`
- Quiet Mode applies to video recording only (screenshots are fast enough to not require it)

---

## 9. Feature Summary

| Feature | Included |
|---|---|
| Retina (2x) screenshots — PNG | ✓ |
| Full-page screenshot (Playwright native) | ✓ |
| Single-viewport screenshot | ✓ |
| Recursive crawl (same domain, max 30 pages) | ✓ |
| 60fps H.264 MP4 video | ✓ |
| Section-aware scroll stops | ✓ |
| Ease-in-out scroll animation | ✓ |
| Hover state interactions in video | ✓ (optional, default off) |
| Auto-accept cookie banners (autoconsent) | ✓ |
| Cookie accept visible and recorded in video | ✓ |
| Hide scrollbars + tap highlight (CSS, default on) | ✓ |
| Custom CSS injection per job | ✓ |
| Dark mode emulation (`colorScheme: dark`) | ✓ |
| HTTP Basic auth (htaccess) | ✓ |
| Form-based auth (Shopify etc.) | ✓ |
| Device presets — 5 built-in, user-editable | ✓ |
| Saved job presets (full config, named) | ✓ |
| Batch queue | ✓ |
| Multi-device batch capture | ✓ |
| Capture history with thumbnails | ✓ |
| ZIP export per session (from History panel) | ✓ |
| Process QoS priority boost (automatic) | ✓ |
| Quiet Mode (graceful app quit before video) | ✓ (optional) |
| Viewport height extension | ✓ |
| Configurable hero wait duration | ✓ |
| Configurable page load timeout | ✓ |
| Passwords in macOS Keychain | ✓ |
| Live log / progress stream | ✓ |
| First-launch Chromium download with progress UI | ✓ |
