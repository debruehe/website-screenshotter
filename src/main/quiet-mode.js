const { execSync, exec } = require('child_process')

function quitApp(appName) {
  try {
    execSync(`osascript -e 'tell application "${appName}" to quit'`, { timeout: 5000 })
    return true
  } catch (_) {
    return false
  }
}

function relaunchApp(appName) {
  exec(`open -a "${appName}"`)
}

/**
 * Quits all apps in the list. Returns array of app names that were successfully quit.
 */
function quietDown(appNames, onLog) {
  const quit = []
  for (const app of appNames) {
    if (quitApp(app)) {
      if (typeof onLog === 'function') onLog(`Quiet mode: quit ${app}`)
      quit.push(app)
    }
  }
  return quit
}

/**
 * Relaunches previously-quit apps.
 */
function relaunchAll(appNames, onLog) {
  for (const app of appNames) {
    relaunchApp(app)
    if (typeof onLog === 'function') onLog(`Quiet mode: relaunched ${app}`)
  }
}

module.exports = { quietDown, relaunchAll }
