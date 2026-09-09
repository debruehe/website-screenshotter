# Viewport Scroll Steps and External Recording Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Web Screenshotter 1.1.0 with viewport-relative scroll steps and a video workflow that can scroll without FFmpeg recording.

**Architecture:** Store new even-step values as `stepVh` and convert them to pixels inside `computeScrollStops`, while preserving legacy pixel `step` reads. Pass a persisted `noRecording` job flag from the Capture panel through IPC to the existing video engines; those engines keep browser/scroll behavior but conditionally skip all FFmpeg and file-output work.

**Tech Stack:** Electron, CommonJS JavaScript, Playwright, FFmpeg, Jest, electron-builder.

**Spec:** `docs/superpowers/specs/2026-09-09-vh-scroll-and-external-recording.md`

## Global Constraints

- `100vh` equals the active capture viewport height.
- Custom scroll positions remain pixel-based.
- Existing saved pixel steps remain readable.
- No-recording mode must not launch or resolve FFmpeg, create empty capture folders, or add history entries.
- Version both npm manifests as `1.1.0`.
- Build without signing.

---

### Task 1: Convert Even Steps to Viewport Height Units

**Files:**
- Modify: `src/main/scroll-settings.js`
- Modify: `src/renderer/panels/capture.js`
- Create: `tests/scroll-settings.test.js`
- Modify: `tests/capture-panel.test.js`

**Interfaces:**
- Consumes: `computeScrollStops(page, viewportHeight, url, captureMode)`.
- Produces: saved `{ mode: 'step', stepVh: number }` settings and pixel stop positions derived from viewport height.

- [x] Write a failing scroll-settings test saving `50vh` for an 800px viewport and expecting `[0, 400, 800, 1200, 1600, 1700]`.
- [x] Run `npx jest --runInBand tests/scroll-settings.test.js` and verify the test fails because `stepVh` is not interpreted.
- [x] Change the UI default to `100`, label it `vh / step`, save `stepVh`, load `stepVh` with a `100` fallback for legacy settings, and convert `stepVh * viewportHeight / 100` in `computeScrollStops`.
- [x] Run the focused scroll and Capture-panel tests and verify they pass.

### Task 2: Add No-Recording Video Workflow

**Files:**
- Modify: `src/renderer/panels/capture.js`
- Modify: `src/main/video-engine.js`
- Modify: `src/main/ipc-handlers.js`
- Create: `tests/video-no-recording.test.js`
- Modify: `tests/capture-panel.test.js`

**Interfaces:**
- Consumes: capture job field `noRecording: boolean`.
- Produces: normal automated/manual browser behavior with conditional `{ proc, outputPath }` creation only when recording is enabled.

- [x] Write a failing video-engine test that runs an automatic no-recording job and expects scrolling to complete without `spawnFfmpeg` or an output file.
- [x] Write failing Capture-panel expectations for `noRecording` job construction and URL-setting restoration.
- [x] Run the focused tests and verify they fail because the field and engine branch do not exist.
- [x] Add the checkbox, persistence, and job field; conditionally skip FFmpeg setup/start/stop/file callbacks in both video paths.
- [x] Skip output-folder creation and history insertion for no-recording video jobs in IPC.
- [x] Run focused tests and verify they pass.

### Task 3: Version and Documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

**Interfaces:**
- Produces: application version `1.1.0` and user-facing documentation matching the shipped controls.

- [x] Update both npm manifest versions to `1.1.0`.
- [x] Document `100vh` default steps, pixel-based custom stops, and the `No recording` workflow.
- [x] Verify `node -p "require('./package.json').version"` and the lockfile root version both print `1.1.0`.

### Task 4: Verify, Install, Commit, and Push

**Files:**
- Test: all changed source and test files.

**Interfaces:**
- Produces: unsigned installed app and synchronized local/remote `main` at one verified commit.

- [x] Run syntax checks, `git diff --check`, and `npm test -- --runInBand`.
- [x] Review the complete diff for requirement coverage and regressions.
- [x] Run `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build` and verify signing is skipped.
- [x] Back up and replace `/Applications/Web Screenshotter.app`, then compare built/installed `app.asar` hashes.
- [ ] Commit all source, tests, documentation, and version changes.
- [ ] Fetch, fast-forward-check, push `main`, sync `/Users/debruehe/Developer/website-screenshotter`, and verify remote `main` points to the new commit.
