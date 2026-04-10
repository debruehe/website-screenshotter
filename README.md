# Web Screenshotter

Web Screenshotter is a macOS app for capturing high-quality, retina-resolution screenshots and scroll videos of websites. It opens a real browser (Google Chrome for Testing), loads your URL at exactly the device size you specify, and saves the result to your desktop — no browser extensions, no manual cropping.

---

## Your First Capture

1. Launch the app and go to the **Capture** panel.
2. Type or paste a URL into the address field (e.g. `example.com` — the `https://` is added automatically).
3. Pick a device from the **Device** dropdown.
4. Make sure **Screenshot** mode is selected and **Full page** is checked.
5. Click **Start**.

The app opens a browser in the background, loads the page, scrolls it to trigger any lazy-loaded content, then saves a full-height PNG to your output folder (default: `~/Desktop/WebScreenshots`). The console at the bottom of the window shows live progress.

---

## Screenshots

### Full page
Captures the entire page height as a single PNG. Scrollbars are hidden automatically.

### Viewport shots
Takes a series of screenshots at regular scroll positions, each the height of the device viewport. Useful when you want individual sections rather than one tall image. Scroll stops are configurable — see [Scroll Stops](#scroll-stops) below.

### Hero shot
Captures only the visible viewport at the very top of the page, with no scrolling. Use this for above-the-fold previews or thumbnails. The **Hero Wait** setting (default 15 s) lets animations and video backgrounds finish loading before the shot is taken.

### Manual mode
Enable **Manual mode** under the Screenshot options. The browser opens and you navigate freely. Press **Cmd+Y** anywhere to save a numbered screenshot of the current viewport. Press **Escape** when you're done. Each shot is saved sequentially (`--001.png`, `--002.png`, …) into the session folder.

---

## Scroll Videos

> **Before recording your first video, run the Crop Calibration in Settings.** Without it, the video frame may be offset and clip the top or bottom of the page. See [Crop Calibration](#crop-calibration) for instructions — it takes under a minute.

### Auto mode
The app opens the browser, waits for the hero content to load, then smoothly scrolls down the page while FFmpeg records the screen. When the bottom is reached, recording stops and the MP4 is saved.

**Scroll speed** — how long (in ms) each scroll movement takes. Lower = faster scroll.  
**Pause** — how long (in ms) to hold at each scroll stop before continuing.  
**Hero wait** — seconds to wait at the top of the page before scrolling begins.

#### Hover interactions
When enabled, instead of scrolling by fixed steps, the app finds every interactive element on the page (buttons, links, navigation items) and scrolls to each one in turn, hovering over it to reveal any hover states, dropdowns, or tooltips. This produces a video that looks like a guided walkthrough.

Press **Escape** at any time to stop a recording early — the video up to that point is saved.

### Manual recording
Enable **Manual recording** under the Video options. The browser opens and recording starts immediately. You control everything — scroll, click, navigate between pages. Press **Escape** to stop recording and save the video.

**Smooth cursor** — available in manual recording mode. Replaces the system cursor with a spring-physics animated cursor that moves more gracefully on screen. A subtle ripple effect is shown on every click.

---

## Capturing Multiple Pages

### Bulk URLs
Check **Bulk URLs** to reveal a text area. Paste one URL per line. The app captures each URL in sequence and saves results into separate subfolders within the session folder. This works for both screenshots and videos.

### Site crawl
Check **Crawl site** in the screenshot options. The app starts at your URL, discovers every internal link, and captures each page automatically. Set **Max pages** to limit how many pages are visited (default: 30). Results are saved into subfolders named after each page's URL path.

### Batch devices
Check **Batch** next to the device selector to reveal a list of all your device presets. Tick any combination and the entire job runs once per device, each in its own subfolder. Useful for generating desktop, tablet, and mobile captures in one go.

---

## Sites That Require a Login

### Session setup
Use this for sites that require a cookie-based login (most modern login forms).

1. Enter the URL and click **Setup Session**.
2. A browser window opens — log in as you normally would.
3. Once you're in, click the **✅ Save Session & Close** button that appears in the bottom-right corner of the browser.

The session (cookies and storage) is saved and reused automatically for all future captures of that domain. A green indicator appears in the Capture panel when a session is active. Click **Clear** to remove it.

### HTTP Basic Auth
For pages protected by a server-level password prompt (htaccess). Click **HTTP Auth**, enter the username and password, and they are saved securely for that domain. You won't need to enter them again.

---

## The Queue

Instead of starting a capture immediately, click **+ Queue** to add the current job to the Queue panel. You can add as many jobs as you like — different URLs, devices, or modes — then switch to the **Queue** panel and click **Capture Queue** to run them all in sequence.

Each job shows its status (pending, running, done, or error). Completed jobs can be opened directly in Finder from the queue. Click **Clear completed** to tidy the list.

---

## History

The **History** panel shows a thumbnail grid of every capture session. Each card displays the site hostname, device, mode, and date.

- **Finder** — opens the session folder in Finder.
- **ZIP** — compresses the entire session folder into a ZIP file saved alongside it.
- **×** — removes the entry from history (files on disk are not deleted).

---

## Advanced Options

### Scroll stops
Controls where the browser pauses during viewport-shot screenshots and auto-scroll videos.

- **Even steps** — scrolls by a fixed number of pixels at each stop (default: 1000 px).
- **Custom** — enter absolute scroll positions from the top of the page, separated by slashes (e.g. `0 / 800 / 2200 / 4000`). Useful for pages with specific section boundaries.

Scroll stop settings are saved per URL and per mode (screenshot vs. video), so switching between them restores your last-used values.

### CSS injection
Any CSS entered here is injected into every page before capture. Scrollbars are hidden by default. Use this to hide cookie banners, chat widgets, sticky headers, or anything else you don't want in the output.

### Dark mode
Sets the browser's color scheme preference to dark before capturing. Sites that respect `prefers-color-scheme` will render in their dark variant.

### Hero wait
Seconds to wait after the page loads before any capture or scroll begins. Increase this if hero animations, video backgrounds, or carousels haven't finished loading in time.

### Viewport extend
Adds extra pixels to the bottom of the browser viewport. Useful when a page has a fixed footer that overlaps content during scroll — extending the viewport keeps the footer from obscuring the recording area.

### Page name
An optional label for the session folder. If left blank, the folder name is derived from the URL and timestamp. Setting a name makes sessions easier to find in History and on disk.

---

## Settings

### Output folder
Where session folders are saved. Defaults to `~/Desktop/WebScreenshots`. Change this to any folder on your machine.

### Page load timeout
How long (in seconds) the app waits for a page to finish loading before proceeding. Increase this for slow or heavy pages (default: 30 s).

### Device presets
The list of devices available in the Capture panel. Each device has a name, width, and height. Edit any field and click **Save Settings** to update. Click **+ Add Device** to create a custom size. Devices can be deleted with the × button.

### Quiet Mode
Before starting a video recording, the app can quit distracting apps (Slack, Spotify, etc.) to avoid notification sounds or popups appearing in the recording. Enable **Quiet Mode** and list the apps to quit, one per line. Enable **Relaunch apps after recording** to have them reopen automatically when the recording ends.

### Crop Calibration
Videos are recorded by capturing the screen region occupied by the browser window. The exact pixel offset from the top of the screen must be known for the crop to be accurate. If the top of your video is cut off or has a gap, run the calibration:

1. Click **Calibrate…** in Settings.
2. A browser window and a floating red line appear on screen.
3. Drag the red line until its bottom edge aligns precisely with the top of the page content in the browser.
4. Click **Save Position**.

The calibrated offset is saved and used for all future recordings. Click **Reset to auto** to go back to automatic detection.
