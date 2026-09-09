# Viewport Scroll Steps and External Recording Spec

## Goal

Release Web Screenshotter 1.1.0 with viewport-relative even scroll steps and an optional video workflow that performs browser setup and scrolling without launching FFmpeg.

## Requirements

- Even-step scroll settings use `vh`, where `100vh` equals the active capture viewport height.
- The default even step is `100vh`; custom absolute stop positions remain pixel-based.
- Existing saved pixel `step` settings remain readable until the user saves a new `stepVh` value.
- Video options include a `No recording` checkbox that is persisted per full URL and included in queued jobs.
- With `No recording` enabled, automatic and manual video workflows open and operate the browser normally but never resolve or launch FFmpeg and never report or add a video file.
- No-recording jobs do not create empty output/history entries.
- Existing screenshots and recorded-video behavior remain unchanged.
- The app version becomes `1.1.0` in both npm manifests.
- The README documents `vh` steps and the no-recording option.

## Verification

- Unit/integration tests prove `vh` conversion and prove the no-recording video path scrolls without starting FFmpeg or emitting a file.
- Renderer tests prove the option enters jobs and restores from saved URL settings.
- Full Jest suite, syntax checks, unsigned macOS build, installed-bundle hash comparison, and remote `main` verification must pass.
