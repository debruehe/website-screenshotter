const { spawn, spawnSync } = require('child_process')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')

function getFfmpegPath(override) {
  return override || ffmpegInstaller.path
}

/**
 * Queries avfoundation device list and returns the index of the first screen device.
 * Falls back to "0" if parsing fails.
 */
function resolveScreenDeviceIndex(ffmpegPath) {
  try {
    // Empty input path is intentional: FFmpeg lists devices then exits non-zero; we only need stderr.
    const result = spawnSync(ffmpegPath, ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''], {
      encoding: 'utf8',
      timeout: 5000
    })
    // Output goes to stderr
    const output = result.stderr || ''
    const lines = output.split('\n')
    // Look for lines like: [AVFoundation indev @ ...] [0] Capture screen 0
    for (const line of lines) {
      // 'Capture screen' is the canonical avfoundation screen device name
      if (line.includes('Capture screen')) {
        const match = line.match(/\[(\d+)\]/)
        if (match) return match[1]
      }
    }
  } catch (_) {}
  return '0'
}

/**
 * Builds the FFmpeg args for screen capture with crop.
 * @param {string} deviceIndex - avfoundation screen index
 * @param {number} width - viewport width in logical pixels
 * @param {number} height - viewport height in logical pixels
 * @param {number} scaleFactor - display scale factor (2 for Retina)
 * @param {string} outputPath - output MP4 path
 */
function buildCaptureArgs(deviceIndex, width, height, scaleFactor, outputPath) {
  const W = width * scaleFactor
  const H = height * scaleFactor
  const Y = 23 * scaleFactor  // offset for macOS menu bar
  return [
    '-f', 'avfoundation',
    '-capture_cursor', '0',
    '-framerate', '60',
    '-i', deviceIndex,
    '-vf', `crop=${W}:${H}:0:${Y}`,
    '-r', '60',
    '-vcodec', 'libx264',
    '-crf', '18',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    outputPath
  ]
}

/**
 * Spawns FFmpeg and returns the child process.
 * onLog receives stderr lines.
 */
function spawnFfmpeg(ffmpegPath, args, onLog) {
  const proc = spawn(ffmpegPath, args)
  if (typeof onLog === 'function') {
    proc.stderr.on('data', data => onLog(data.toString()))
  }
  proc.on('error', err => { if (typeof onLog === 'function') onLog(`FFmpeg spawn error: ${err.message}`) })
  return proc
}

module.exports = { getFfmpegPath, resolveScreenDeviceIndex, buildCaptureArgs, spawnFfmpeg }
