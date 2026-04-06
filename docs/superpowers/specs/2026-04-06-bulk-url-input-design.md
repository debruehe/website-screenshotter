# Bulk URL Input — Design Spec
_Date: 2026-04-06_

## Overview

Add a **Bulk URLs** mode to the Capture panel as an alternative to automatic site crawling. The user provides a newline-separated list of specific URLs; the app captures them all in one session, in the same order given. This is the third URL-resolution strategy alongside single-URL and recursive crawl.

---

## 1. UI Changes (Capture panel)

The Crawl section gains a second checkbox below the existing one:

```
Crawl: ☐ Crawl site    Max [ 30 ] pages
       ☐ Bulk URLs
```

**When Bulk URLs is checked:**
- "Crawl site" checkbox and max-pages input are hidden (mutually exclusive)
- A textarea appears below, full-width, ~6 lines tall
- Placeholder text:
  ```
  One URL per line
  https://example.com/about
  https://example.com/work
  ```
- The single URL field at the top remains visible and serves as the **session anchor** — used for output folder naming and the history panel display label. It can be filled manually or auto-filled from the first URL in the list on textarea blur.
- The Page name field behaves normally.

**When Bulk URLs is unchecked:**
- Textarea collapses, Crawl options return.

---

## 2. Data Model

One new field added to the job object:

```js
{
  // ...existing fields...
  bulkUrls: string[]  // empty array [] when not in bulk mode
}
```

- `crawl` boolean is preserved but ignored by the engine when `bulkUrls.length > 0`
- `url` continues to serve as the session anchor for naming and history
- `bulkUrls` is saved and loaded as part of job presets

**Input normalization (renderer, on submit):**
1. Split textarea on newlines
2. Trim whitespace, filter blank lines
3. Add `https://` if no protocol present
4. Filter out any remaining invalid URLs (dropped and logged to live log)
5. Assign cleaned array to `job.bulkUrls`

---

## 3. Engine Changes

### `screenshot-engine`

The URL resolution block in `captureScreenshots` gains a bulk branch:

```js
// Before (simplified):
if (job.crawl) {
  urls = await crawl(page, job.url, job.crawlMaxPages, log)
} else {
  urls = [job.url]
}

// After:
if (job.bulkUrls && job.bulkUrls.length > 0) {
  urls = job.bulkUrls
} else if (job.crawl) {
  urls = await crawl(page, job.url, job.crawlMaxPages, log)
} else {
  urls = [job.url]
}
```

### `video-engine`

Currently processes a single URL per job. Bulk support adds the same iteration: for each URL in `job.bulkUrls`, capture a scroll video. Output files named `scroll--<slug>--<device-id>.mp4` per URL, all written to the same session folder.

### Unchanged modules

- `crawler.js` — not touched
- `output-manager.js` — not touched (session folder naming uses `job.url` anchor as before)
- `ipc-handlers.js` — not touched

---

## 4. Edge Cases

| Case | Behavior |
|---|---|
| Bulk textarea is empty on submit | Falls back to single-URL mode using `job.url` |
| URL in list has no protocol | Auto-prefixed with `https://` |
| Invalid/unparseable URL | Silently dropped; logged to live log |
| Session anchor URL field is empty | First URL in bulk list used as fallback anchor |
| Bulk mode + manual mode both on | Manual mode takes precedence (existing behavior, bulk ignored) |
