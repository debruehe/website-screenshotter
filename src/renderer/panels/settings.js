window.settingsPanel = {
  async init() {
    const panel = document.getElementById('panel-settings')
    panel.innerHTML = `
      <h2 style="font-size:15px;margin-bottom:20px">Settings</h2>

      <div class="section-header">Output</div>
      <div class="field"><label>Output folder</label><input type="text" id="s-output" placeholder="~/Desktop/WebScreenshots"></div>

      <div class="section-header">Capture</div>
      <div class="field"><label>Page load timeout (s)</label><input type="number" id="s-timeout" value="30" min="5" max="120" style="width:100px"></div>
      <div class="field"><label>FFmpeg path (leave blank to use bundled)</label><input type="text" id="s-ffmpeg" placeholder="(bundled)"></div>

      <div class="section-header">Quiet Mode (Video)</div>
      <div class="field">
        <label style="display:flex;align-items:center;gap:8px;color:var(--text)">
          <input type="checkbox" id="s-quiet"> Enable Quiet Mode
        </label>
      </div>
      <div id="s-quiet-opts" style="display:none">
        <div class="field">
          <label>Apps to quit before recording (one per line)</label>
          <textarea id="s-apps" rows="5"></textarea>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;color:var(--text)">
            <input type="checkbox" id="s-relaunch"> Relaunch apps after recording
          </label>
        </div>
      </div>

      <div class="section-header">Device Presets</div>
      <div id="s-devices"></div>
      <button id="s-add-device" style="background:none;border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:4px;cursor:pointer;margin-top:8px">+ Add Device</button>

      <div style="margin-top:24px">
        <button class="primary" id="s-save">Save Settings</button>
      </div>
    `

    await this.load()
    this.bindEvents()
  },

  async load() {
    const s = await window.api.getSettings()
    document.getElementById('s-output').value = s.outputRoot || ''
    document.getElementById('s-timeout').value = s.pageLoadTimeout || 30
    document.getElementById('s-ffmpeg').value = s.ffmpegPath || ''
    document.getElementById('s-quiet').checked = s.quietMode || false
    document.getElementById('s-apps').value = (s.quietModeApps || []).join('\n')
    document.getElementById('s-relaunch').checked = s.quietModeRelaunch ?? true
    document.getElementById('s-quiet-opts').style.display = s.quietMode ? 'block' : 'none'
    await this.loadDevices()
  },

  async loadDevices() {
    const devices = await window.api.getDevices()
    document.getElementById('s-devices').innerHTML = devices.map(d => `
      <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
        <input type="text" value="${d.name}" data-did="${d.id}" data-field="name" style="flex:2">
        <input type="number" value="${d.width}" data-did="${d.id}" data-field="width" style="width:70px">
        <span style="color:var(--text-muted)">×</span>
        <input type="number" value="${d.height}" data-did="${d.id}" data-field="height" style="width:70px">
        <button onclick="window.settingsPanel.deleteDevice('${d.id}')" style="background:none;border:none;color:#f96;cursor:pointer;padding:0 4px">×</button>
      </div>
    `).join('')
  },

  async deleteDevice(id) {
    await window.api.deleteDevice(id)
    await this.loadDevices()
  },

  bindEvents() {
    document.getElementById('s-quiet').addEventListener('change', e => {
      document.getElementById('s-quiet-opts').style.display = e.target.checked ? 'block' : 'none'
    })

    document.getElementById('s-add-device').addEventListener('click', async () => {
      await window.api.saveDevice({ id: 'custom-' + Date.now(), name: 'Custom', width: 1280, height: 800 })
      await this.loadDevices()
    })

    document.getElementById('s-save').addEventListener('click', async () => {
      // Collect and save device edits — group inputs by device id
      const deviceMap = {}
      document.querySelectorAll('[data-did]').forEach(el => {
        const id = el.dataset.did
        if (!deviceMap[id]) deviceMap[id] = { id }
        deviceMap[id][el.dataset.field] = el.dataset.field === 'name' ? el.value : parseInt(el.value)
      })
      for (const device of Object.values(deviceMap)) {
        await window.api.saveDevice(device)
      }

      await window.api.saveSettings({
        outputRoot: document.getElementById('s-output').value,
        pageLoadTimeout: parseInt(document.getElementById('s-timeout').value),
        ffmpegPath: document.getElementById('s-ffmpeg').value,
        quietMode: document.getElementById('s-quiet').checked,
        quietModeApps: document.getElementById('s-apps').value.split('\n').filter(Boolean),
        quietModeRelaunch: document.getElementById('s-relaunch').checked
      })
      alert('Settings saved')
    })
  }
}
