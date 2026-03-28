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
