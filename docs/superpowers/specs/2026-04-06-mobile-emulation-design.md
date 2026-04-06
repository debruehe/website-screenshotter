# Mobile Emulation Design

**Date:** 2026-04-06

## Goal

Enable proper mobile emulation (touch events, mobile user agent, viewport meta tag support) for all capture modes when using a device with width < 1025px.

## Background

Currently, Playwright context options set `viewport` and `deviceScaleFactor` but do not enable mobile emulation flags. This means pages render as narrow desktop sites rather than true mobile sites — touch events don't fire and sites that check user agent or viewport meta tags may render in desktop mode.

## Design

### Trigger condition

Any device with `device.width < 1025` is treated as a mobile/tablet device. This threshold includes:
- iPhone (402px)
- iPad Portrait (768px)
- iPad Landscape (1024px)

Desktop devices (1280px, 1674px, 1920px, etc.) are unaffected.

### Changes

Add `isMobile: true` and `hasTouch: true` to `contextOptions` whenever `device.width < 1025`. This applies to:

1. **`src/main/video-engine.js`** → `setupBrowser()` — covers both auto scroll video and manual recording
2. **`src/main/screenshot-engine.js`** → context setup for auto screenshots (~line 84)
3. **`src/main/screenshot-engine.js`** → context setup for manual screenshots (~line 232)

### What Playwright does with these flags

- Sets a mobile user agent automatically
- Respects `<meta name="viewport">` tags so responsive sites render in mobile layout
- Routes pointer events as touch events instead of mouse clicks

### What does NOT change

- `cropYOffset` / calibration — unchanged. In `--app` mode (no address bar), the browser chrome height is the same for all window sizes, so no separate mobile calibration is needed.
- Device definitions in `presets.json` — no schema change.
- All other context options (`deviceScaleFactor`, `colorScheme`, auth, storage state) — unchanged.

## Implementation

Three minimal edits, one commit.

```js
// Pattern to add in each contextOptions block:
if (device.width < 1025) {
  contextOptions.isMobile = true
  contextOptions.hasTouch = true
}
```
