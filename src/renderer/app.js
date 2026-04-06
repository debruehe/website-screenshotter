// Panel routing
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active')
  })
})

// Log stream
window.api.onLog(line => window.logComponent.appendLog(line))

// Job status updates (for queue panel)
window.api.onJobUpdate(update => {
  if (window.queuePanel) window.queuePanel.handleUpdate(update)
  if (window.historyPanel) window.historyPanel.refresh()
})

// Init panels
window.capturePanel && window.capturePanel.init()
window.queuePanel && window.queuePanel.init()
window.historyPanel && window.historyPanel.init()
window.settingsPanel && window.settingsPanel.init()

// Console resize
;(function () {
  const handle  = document.getElementById('log-resize')
  const logArea = document.getElementById('log-area')
  let dragging = false, startY = 0, startH = 0

  handle.addEventListener('mousedown', e => {
    dragging = true
    startY = e.clientY
    startH = logArea.offsetHeight
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  })

  document.addEventListener('mousemove', e => {
    if (!dragging) return
    const delta = startY - e.clientY
    const newH = Math.max(40, Math.min(startH + delta, window.innerHeight - 160))
    logArea.style.height = newH + 'px'
  })

  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })
})()

// First-launch setup progress
window.api.onSetupProgress(data => {
  const modal = document.getElementById('setup-modal')
  if (data.show === false) { modal.style.display = 'none'; return }
  modal.style.display = 'flex'
  if (data.status) document.getElementById('setup-status').textContent = data.status
  if (data.percent !== undefined) document.getElementById('setup-progress').style.width = data.percent + '%'
  if (data.error) document.getElementById('setup-retry').style.display = 'block'
})
