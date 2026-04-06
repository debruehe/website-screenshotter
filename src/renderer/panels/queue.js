function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

window.queuePanel = {
  jobs: [],
  _running: false,

  init() {
    const panel = document.getElementById('panel-queue')
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:15px">Queue</h2>
        <div style="display:flex;gap:8px">
          <button id="q-capture" class="primary" style="font-size:12px;padding:6px 14px">Capture Queue</button>
          <button id="q-clear" class="btn-sm">Clear completed</button>
        </div>
      </div>
      <div id="q-list"></div>
    `
    document.getElementById('q-clear').addEventListener('click', () => {
      this.jobs = this.jobs.filter(j => j.status === 'pending' || j.status === 'running')
      this.render()
    })
    document.getElementById('q-capture').addEventListener('click', () => this.captureQueue())
    document.getElementById('q-list').addEventListener('click', e => {
      const link = e.target.closest('[data-open-folder]')
      if (link) window.api.openFolder(link.dataset.openFolder)
      const removeBtn = e.target.closest('[data-remove-job]')
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.removeJob)
        if (this.jobs[idx] && this.jobs[idx].status === 'pending') {
          this.jobs.splice(idx, 1)
          this.render()
        }
      }
    })
  },

  addJob(job) {
    this.jobs.push({ ...job, status: 'pending' })
    this.render()
    // Switch to queue panel
    document.querySelector('[data-panel="queue"]').click()
  },

  async captureQueue() {
    if (this._running) return
    const pending = this.jobs.filter(j => j.status === 'pending')
    if (!pending.length) return

    this._running = true
    const btn = document.getElementById('q-capture')
    btn.disabled = true
    btn.textContent = 'Running…'

    for (const job of pending) {
      if (!this._running) break
      job.status = 'running'
      this.render()
      try {
        await window.api.startCapture(job)
        job.status = 'done'
      } catch (err) {
        job.status = 'error'
        job.error = err.message || 'Unknown error'
      }
      this.render()
    }

    this._running = false
    btn.disabled = false
    btn.textContent = 'Capture Queue'
  },

  handleUpdate(update) {
    const job = this.jobs.find(j => j.id === update.id)
    if (job) { Object.assign(job, update); this.render() }
  },

  render() {
    const list = document.getElementById('q-list')
    if (!list) return
    if (!this.jobs.length) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No jobs in queue. Use "+ Queue" in the Capture panel to add jobs.</p>'
      return
    }
    list.innerHTML = this.jobs.map((j, idx) => {
      const statusBg = j.status === 'done' ? '#2a4a2a' : j.status === 'error' ? '#4a2a2a' : j.status === 'running' ? '#2a3a4a' : '#333'
      const statusColor = j.status === 'done' ? '#6a9f6a' : j.status === 'error' ? '#f96' : j.status === 'running' ? '#4f9cf9' : '#888'
      let hostname = j.url
      try { hostname = new URL(j.url).hostname } catch (_) {}
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:500">${escHtml(hostname)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${statusBg};color:${statusColor}">${escHtml(j.status)}</span>
              ${j.status === 'pending' ? `<button data-remove-job="${idx}" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" title="Remove">&times;</button>` : ''}
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${escHtml(j.device || '')} · ${escHtml(j.mode || '')}</div>
          ${j.error ? `<div style="color:#f96;font-size:11px;margin-top:4px">${escHtml(j.error)}</div>` : ''}
          ${j.outputFolder ? `<div data-open-folder="${escHtml(j.outputFolder)}" style="font-size:11px;color:var(--accent);cursor:pointer;margin-top:4px">Open folder</div>` : ''}
        </div>
      `
    }).join('')
  }
}
