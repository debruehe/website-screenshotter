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

  init() {
    const panel = document.getElementById('panel-queue')
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:15px">Queue</h2>
        <button id="q-clear" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 10px;border-radius:4px;cursor:pointer">Clear completed</button>
      </div>
      <div id="q-list"></div>
    `
    document.getElementById('q-clear').addEventListener('click', () => {
      this.jobs = this.jobs.filter(j => j.status === 'pending' || j.status === 'running')
      this.render()
    })
    document.getElementById('q-list').addEventListener('click', e => {
      const link = e.target.closest('[data-open-folder]')
      if (link) window.api.openFolder(link.dataset.openFolder)
    })
  },

  addJob(job) {
    this.jobs.unshift({ ...job, status: 'pending' })
    this.render()
    document.querySelector('[data-panel="queue"]').click()
  },

  handleUpdate(update) {
    const job = this.jobs.find(j => j.id === update.id)
    if (job) { Object.assign(job, update); this.render() }
    else { this.jobs.unshift(update); this.render() }
  },

  render() {
    const list = document.getElementById('q-list')
    if (!list) return
    if (!this.jobs.length) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No jobs yet</p>'
      return
    }
    list.innerHTML = this.jobs.map(j => {
      const statusBg = j.status === 'done' ? '#2a4a2a' : j.status === 'error' ? '#4a2a2a' : j.status === 'running' ? '#2a3a4a' : '#333'
      const statusColor = j.status === 'done' ? '#6a9f6a' : j.status === 'error' ? '#f96' : j.status === 'running' ? '#4f9cf9' : '#888'
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between">
            <span style="font-weight:500">${escHtml(j.url || '—')}</span>
            <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${statusBg};color:${statusColor}">${escHtml(j.status)}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${escHtml(j.device || '')} · ${escHtml(j.mode || '')}</div>
          ${j.error ? `<div style="color:#f96;font-size:11px;margin-top:4px">${escHtml(j.error)}</div>` : ''}
          ${j.outputFolder ? `<div data-open-folder="${escHtml(j.outputFolder)}" style="font-size:11px;color:var(--accent);cursor:pointer;margin-top:4px">Open folder →</div>` : ''}
        </div>
      `
    }).join('')
  }
}
