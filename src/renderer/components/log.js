window.logComponent = {
  appendLog(line) {
    const logEl = document.getElementById('log-output')
    if (!logEl) return
    const div = document.createElement('div')
    div.textContent = line
    logEl.appendChild(div)
    requestAnimationFrame(() => { logEl.scrollTop = logEl.scrollHeight })
    // Keep max 500 lines
    while (logEl.children.length > 500) logEl.removeChild(logEl.firstChild)
  },
  clearLog() {
    const logEl = document.getElementById('log-output')
    if (logEl) logEl.innerHTML = ''
  }
}
