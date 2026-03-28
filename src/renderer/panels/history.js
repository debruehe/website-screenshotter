window.historyPanel = {
  async init() {
    const panel = document.getElementById('panel-history')
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h2 style="font-size:15px">History</h2>
      </div>
      <div id="h-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px"></div>
    `
    await this.refresh()
  },

  async refresh() {
    const grid = document.getElementById('h-grid')
    if (!grid) return
    const history = await window.api.getHistory()
    if (!history.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px">No captures yet</p>'
      return
    }
    grid.innerHTML = history.map(entry => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        ${entry.thumbnailPath
          ? `<img src="${entry.thumbnailPath}" style="width:100%;height:110px;object-fit:cover;display:block">`
          : `<div style="width:100%;height:110px;background:#111;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:20px">${entry.mode === 'video' ? '🎬' : '📷'}</div>`
        }
        <div style="padding:10px">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${new URL(entry.url).hostname}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${entry.device} · ${entry.mode}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${new Date(entry.timestamp).toLocaleDateString()}</div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <button onclick="window.api.openFolder('${entry.outputFolder}')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">Finder</button>
            <button onclick="window.historyPanel.exportZip('${entry.outputFolder}')" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">ZIP</button>
            <button onclick="window.historyPanel.deleteEntry('${entry.id}')" style="background:none;border:1px solid var(--border);color:#f96;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px">×</button>
          </div>
        </div>
      </div>
    `).join('')
  },

  async exportZip(folder) {
    const zip = await window.api.exportZip(folder)
    alert(`ZIP saved: ${zip}`)
  },

  async deleteEntry(id) {
    if (!confirm('Delete this history entry?')) return
    await window.api.deleteHistoryEntry(id)
    await this.refresh()
  }
}
