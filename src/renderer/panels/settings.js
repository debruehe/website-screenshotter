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

      <div class="section-header">Video Crop Calibration</div>
      <div class="field">
        <label>Capture top Y offset (logical px)</label>
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <span id="s-crop-display" style="font-size:13px;color:var(--text-secondary)">Auto-detect</span>
          <button id="s-calibrate" class="btn-sm">Calibrate…</button>
          <button id="s-crop-reset" class="btn-sm btn-danger" style="display:none">Reset to auto</button>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Opens a browser with a draggable red line. Align it with the top of the page content, then click Save.</div>
      </div>

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

      <div class="section-header">Manual Mode Shortcuts</div>
      <div class="field">
        <label>Jump to next scroll stop</label>
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <div id="s-jump-key-display" tabindex="0" style="display:inline-flex;align-items:center;padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:var(--input-bg,var(--bg));color:var(--text);font-size:13px;min-width:100px;cursor:pointer;user-select:none" title="Click then press your shortcut key combination">Cmd+J</div>
          <input type="hidden" id="s-jump-key" value="CommandOrControl+J">
          <span style="font-size:11px;color:var(--text-muted)">Click to record shortcut</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">In manual screenshot/video mode, pressing this shortcut jumps to the next scroll stop and cycles through all configured stops.</div>
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
    this._refreshCropDisplay(s.cropYOffset)
    const jumpKey = s.manualScrollJumpKey || 'CommandOrControl+J'
    document.getElementById('s-jump-key').value = jumpKey
    document.getElementById('s-jump-key-display').textContent = this._formatAccelerator(jumpKey)
    await this.loadDevices()
  },

  _refreshCropDisplay(cropYOffset) {
    const display = document.getElementById('s-crop-display')
    const resetBtn = document.getElementById('s-crop-reset')
    if (cropYOffset !== undefined && cropYOffset !== null) {
      display.textContent = `${cropYOffset}px`
      display.style.color = 'var(--text)'
      resetBtn.style.display = 'inline-flex'
    } else {
      display.textContent = 'Auto-detect'
      display.style.color = 'var(--text-secondary)'
      resetBtn.style.display = 'none'
    }
  },

  _formatAccelerator(accel) {
    return accel.split('+').map(p => ({
      CommandOrControl: 'Cmd',
      Command: 'Cmd',
      Control: 'Ctrl',
      Shift: 'Shift',
      Alt: 'Alt'
    }[p] || p)).join('+')
  },

  _buildAccelerator(e) {
    const parts = []
    if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    const key = e.key
    if (['Meta', 'Control', 'Shift', 'Alt'].includes(key)) return null
    const keyMap = {
      ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
      Backspace: 'Backspace', Delete: 'Delete', Escape: 'Escape', Enter: 'Return', Tab: 'Tab'
    }
    const mapped = keyMap[key] || (key.length === 1 ? key.toUpperCase() : key)
    parts.push(mapped)
    return parts.length > 1 ? parts.join('+') : null
  },

  async loadDevices() {
    const devices = await window.api.getDevices()
    document.getElementById('s-devices').innerHTML = devices.map(d => `
      <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
        <input type="text" value="${d.name}" data-did="${d.id}" data-field="name" style="flex:2">
        <input type="number" value="${d.width}" data-did="${d.id}" data-field="width" style="width:70px">
        <span style="color:var(--text-muted)">×</span>
        <input type="number" value="${d.height}" data-did="${d.id}" data-field="height" style="width:70px">
        <button data-delete-device="${d.id}" style="background:none;border:none;color:#f96;cursor:pointer;padding:0 4px">×</button>
      </div>
    `).join('')
  },

  async deleteDevice(id) {
    await window.api.deleteDevice(id)
    await this.loadDevices()
  },

  bindEvents() {
    const keyDisplay = document.getElementById('s-jump-key-display')
    const keyInput = document.getElementById('s-jump-key')

    keyDisplay.addEventListener('click', () => {
      keyDisplay.dataset.recording = 'true'
      keyDisplay.textContent = 'Press shortcut…'
      keyDisplay.style.borderColor = 'var(--accent, #4a9eff)'
      keyDisplay.focus()
    })

    keyDisplay.addEventListener('keydown', e => {
      if (!keyDisplay.dataset.recording) return
      e.preventDefault()
      const accel = this._buildAccelerator(e)
      if (!accel) return
      keyInput.value = accel
      keyDisplay.textContent = this._formatAccelerator(accel)
      delete keyDisplay.dataset.recording
      keyDisplay.style.borderColor = ''
    })

    keyDisplay.addEventListener('blur', () => {
      if (keyDisplay.dataset.recording) {
        delete keyDisplay.dataset.recording
        keyDisplay.style.borderColor = ''
        keyDisplay.textContent = this._formatAccelerator(keyInput.value)
      }
    })

    document.getElementById('s-devices').addEventListener('click', e => {
      const btn = e.target.closest('[data-delete-device]')
      if (btn) this.deleteDevice(btn.dataset.deleteDevice)
    })

    document.getElementById('s-quiet').addEventListener('change', e => {
      document.getElementById('s-quiet-opts').style.display = e.target.checked ? 'block' : 'none'
    })

    document.getElementById('s-calibrate').addEventListener('click', async () => {
      const btn = document.getElementById('s-calibrate')
      btn.disabled = true
      btn.textContent = 'Opening…'
      const result = await window.api.startCalibration()
      btn.disabled = false
      btn.textContent = 'Calibrate…'
      if (result?.ok) {
        const s = await window.api.getSettings()
        this._refreshCropDisplay(s.cropYOffset)
      }
    })

    document.getElementById('s-crop-reset').addEventListener('click', async () => {
      await window.api.resetCropOffset()
      this._refreshCropDisplay(undefined)
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
        quietModeRelaunch: document.getElementById('s-relaunch').checked,
        manualScrollJumpKey: document.getElementById('s-jump-key').value
      })
      alert('Settings saved')
    })
  }
}
