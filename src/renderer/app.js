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

// First-launch setup progress
window.api.onSetupProgress(data => {
  const modal = document.getElementById('setup-modal')
  if (data.show === false) { modal.style.display = 'none'; return }
  modal.style.display = 'flex'
  if (data.status) document.getElementById('setup-status').textContent = data.status
  if (data.percent !== undefined) document.getElementById('setup-progress').style.width = data.percent + '%'
  if (data.error) document.getElementById('setup-retry').style.display = 'block'
})
