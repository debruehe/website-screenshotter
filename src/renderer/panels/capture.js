window.capturePanel = {
  _scrollSaveTimer: null,

  init() {
    const panel = document.getElementById('panel-capture')
    panel.innerHTML = `
      <div class="pf">

        <div class="pf-section pf-url-section">
          <div class="url-row">
            <input type="text" id="cap-url" placeholder="example.com" autocomplete="off" spellcheck="false" style="flex:1">
            <button class="primary" id="cap-start">▶ Start</button>
          </div>
          <div class="session-bar">
            <button id="cap-session-btn" class="btn-sm"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.25"/><path d="M6.5 6.5 10 10M8 8.5l1.5 1.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>Setup Session</button>
            <span id="cap-session-status" class="txt-muted" style="font-size:11px">No saved session</span>
            <button id="cap-session-clear" class="btn-sm btn-danger" style="display:none">✕ Clear</button>
          </div>
          <div class="session-bar" style="margin-top:7px">
            <button id="cap-auth-toggle" class="btn-sm"><svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="5.5" width="9" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.25"/><path d="M3 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>HTTP Auth</button>
            <span id="cap-auth-status" class="txt-muted" style="font-size:11px"></span>
          </div>
          <div id="cap-auth-fields" style="display:none;margin-top:8px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <input type="text" id="cap-auth-user" placeholder="Username" autocomplete="off" spellcheck="false">
              <input type="password" id="cap-auth-pass" placeholder="Password" autocomplete="off">
            </div>
          </div>
        </div>

        <div class="pf-section">
          <div class="pf-hdr">Device</div>
          <div class="row-flex" style="gap:12px;align-items:center">
            <select id="cap-device" style="flex:1"></select>
            <label class="opt-label"><input type="checkbox" id="cap-batch"><span>Batch</span></label>
          </div>
          <div id="cap-batch-list" style="display:none;margin-top:10px"></div>
        </div>

        <div class="pf-section">
          <div class="mode-seg">
            <button class="mode-btn active" data-mode="screenshot">Screenshot</button>
            <button class="mode-btn" data-mode="video">Video</button>
          </div>

          <div id="screenshot-opts" class="mode-panel">
            <div class="mode-grid">
              <div>
                <div class="sub-hdr">Capture type</div>
                <div class="opt-stack" style="gap:6px">
                  <label class="opt-label"><input type="radio" name="scrtype" value="full-page" checked><span>Full page</span></label>
                  <label class="opt-label"><input type="radio" name="scrtype" value="single-viewport"><span>Viewport shots</span></label>
                </div>
              </div>
              <div>
                <div class="sub-hdr">Crawl</div>
                <div class="opt-stack" style="gap:8px">
                  <label class="opt-label"><input type="checkbox" id="cap-crawl"><span>Crawl site</span></label>
                  <div class="row-flex" style="gap:6px;align-items:center">
                    <span class="txt-muted" style="font-size:12px">Max</span>
                    <input type="number" id="cap-crawl-max" value="30" min="1" max="100" class="num-input">
                    <span class="txt-muted">pages</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="video-opts" class="mode-panel" style="display:none">
            <div style="margin-bottom:12px">
              <label class="opt-label"><input type="checkbox" id="cap-manual"><span>Manual recording</span></label>
              <div id="cap-manual-hint" class="txt-muted" style="font-size:11px;margin-top:5px;padding-left:19px;display:none">Browser opens and recording starts. Do whatever you want, then press <strong style="color:var(--text)">Esc</strong> to stop and save.</div>
            </div>
            <div id="video-auto-opts">
              <div class="mode-grid">
                <div>
                  <div class="sub-hdr">Scroll speed</div>
                  <div class="opt-stack" style="gap:8px">
                    <div class="row-flex" style="gap:6px;align-items:center">
                      <input type="number" id="cap-speed" value="2000" min="200" max="9999" class="num-input" style="width:72px">
                      <span class="txt-muted">ms / 1000px</span>
                    </div>
                    <div class="row-flex" style="gap:6px;align-items:center">
                      <input type="number" id="cap-pause" value="1500" min="0" max="9999" class="num-input" style="width:72px">
                      <span class="txt-muted">ms pause</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div class="sub-hdr">Options</div>
                  <div class="opt-stack" style="gap:8px">
                    <label class="opt-label"><input type="checkbox" id="cap-hover"><span>Hover interactions</span></label>
                    <div class="row-flex" style="gap:6px;align-items:center">
                      <span class="txt-muted" style="font-size:12px">Extend viewport</span>
                      <input type="number" id="cap-extend" value="0" min="0" max="400" class="num-input">
                      <span class="txt-muted">px</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="pf-section">
          <div class="pf-hdr">Scroll Stops</div>
          <div class="opt-stack" style="gap:9px">
            <div class="row-flex" style="gap:10px;align-items:center">
              <label class="opt-label" style="min-width:96px"><input type="radio" name="scroll-mode" value="step" checked><span>Even steps</span></label>
              <input type="number" id="scroll-step" value="1000" min="100" max="9999" class="num-input">
              <span class="txt-muted">px per step</span>
            </div>
            <div class="row-flex" style="gap:10px;align-items:center">
              <label class="opt-label" style="min-width:96px"><input type="radio" name="scroll-mode" value="custom"><span>Custom</span></label>
              <input type="text" id="scroll-custom" placeholder="0 / 1000 / 2500 / 4000" class="scroll-positions-input" disabled>
            </div>
            <div id="scroll-hint" class="txt-muted" style="font-size:11px;padding-left:106px">Scroll down by this amount at each stop</div>
          </div>
        </div>

        <div class="pf-section">
          <div class="pf-hdr">CSS Injection</div>
          <div class="css-defaults-block">* { scrollbar-width: none !important; }<br>*::-webkit-scrollbar { display: none !important; }</div>
          <textarea id="cap-css" rows="2" placeholder="Additional CSS…" style="margin-top:6px"></textarea>
        </div>

        <div class="pf-section" style="border-bottom:none">
          <div class="row-flex" style="gap:32px">
            <div>
              <div class="pf-hdr">Hero Wait</div>
              <div class="row-flex" style="gap:6px;align-items:center">
                <input type="number" id="cap-wait" value="15" min="0" max="120" class="num-input">
                <span class="txt-muted">seconds</span>
              </div>
            </div>
            <div>
              <div class="pf-hdr">Appearance</div>
              <div class="opt-row">
                <label class="opt-label"><input type="radio" name="dark" value="off" checked><span>Light</span></label>
                <label class="opt-label"><input type="radio" name="dark" value="on"><span>Dark</span></label>
              </div>
            </div>
          </div>
        </div>

      </div>
    `
    this.loadDevices()
    this.bindEvents()
  },

  async loadDevices() {
    const devices = await window.api.getDevices()
    const sel = document.getElementById('cap-device')
    sel.innerHTML = devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('')
    const batchList = document.getElementById('cap-batch-list')
    batchList.innerHTML = devices.map(d => `
      <label class="opt-label" style="margin-bottom:6px">
        <input type="checkbox" class="batch-device" value="${d.id}">
        <span>${d.name}</span>
      </label>
    `).join('')
  },

  bindEvents() {
    // Mode segmented control
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const isVideo = btn.dataset.mode === 'video'
        document.getElementById('screenshot-opts').style.display = isVideo ? 'none' : 'block'
        document.getElementById('video-opts').style.display = isVideo ? 'block' : 'none'
      })
    })

    // Batch toggle
    document.getElementById('cap-batch').addEventListener('change', e => {
      document.getElementById('cap-batch-list').style.display = e.target.checked ? 'block' : 'none'
      document.getElementById('cap-device').disabled = e.target.checked
    })

    // Scroll mode toggle
    document.querySelectorAll('input[name="scroll-mode"]').forEach(r => {
      r.addEventListener('change', () => {
        const isCustom = r.value === 'custom'
        document.getElementById('scroll-step').disabled = isCustom
        document.getElementById('scroll-custom').disabled = !isCustom
        document.getElementById('scroll-hint').textContent = isCustom
          ? 'Absolute scroll positions from top, slash-separated (e.g. 0 / 1000 / 2500 / 4000)'
          : 'Scroll down by this amount at each stop'
        this._scheduleScrollSave()
      })
    })

    // Auto-save scroll settings on change
    document.getElementById('scroll-step').addEventListener('input', () => this._scheduleScrollSave())
    document.getElementById('scroll-custom').addEventListener('input', () => this._scheduleScrollSave())

    // HTTP Auth toggle
    document.getElementById('cap-auth-toggle').addEventListener('click', () => {
      const fields = document.getElementById('cap-auth-fields')
      const isOpen = fields.style.display !== 'none'
      fields.style.display = isOpen ? 'none' : 'grid'
    })

    // HTTP Auth save on input change (debounced)
    let authSaveTimer = null
    const scheduleAuthSave = () => {
      clearTimeout(authSaveTimer)
      authSaveTimer = setTimeout(() => this._saveHttpAuth(), 600)
    }
    document.getElementById('cap-auth-user').addEventListener('input', scheduleAuthSave)
    document.getElementById('cap-auth-pass').addEventListener('input', scheduleAuthSave)

    // URL blur: auto-prefix https://, load scroll settings + session + auth
    document.getElementById('cap-url').addEventListener('blur', () => {
      const input = document.getElementById('cap-url')
      let v = input.value.trim()
      if (v && !v.includes('://')) {
        v = 'https://' + v
        input.value = v
      }
      this.refreshSessionStatus()
      this.loadScrollSettings(v)
      this.loadHttpAuth(v)
    })

    document.getElementById('cap-url').addEventListener('input', () => {
      this.refreshSessionStatus()
    })

    // Session buttons
    document.getElementById('cap-session-btn').addEventListener('click', async () => {
      const url = this._normalizeUrl(document.getElementById('cap-url').value)
      if (!url) return alert('Enter a URL first')
      const btn = document.getElementById('cap-session-btn')
      btn.disabled = true
      btn.textContent = 'Opening…'
      await window.api.setupSession(url)
      btn.disabled = false
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.25"/><path d="M6.5 6.5 10 10M8 8.5l1.5 1.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>Setup Session'
      this.refreshSessionStatus()
    })

    document.getElementById('cap-session-clear').addEventListener('click', async () => {
      const url = this._normalizeUrl(document.getElementById('cap-url').value)
      if (!url) return
      await window.api.clearSession(url)
      this.refreshSessionStatus()
    })

    // Manual mode toggle
    document.getElementById('cap-manual').addEventListener('change', e => {
      const isManual = e.target.checked
      document.getElementById('video-auto-opts').style.display = isManual ? 'none' : 'block'
      document.getElementById('cap-manual-hint').style.display = isManual ? 'block' : 'none'
    })

    // Start
    document.getElementById('cap-start').addEventListener('click', () => this.startCapture())
  },

  _normalizeUrl(val) {
    const v = (val || '').trim()
    if (!v) return ''
    return v.includes('://') ? v : 'https://' + v
  },

  _scheduleScrollSave() {
    clearTimeout(this._scrollSaveTimer)
    this._scrollSaveTimer = setTimeout(() => this._saveScrollSettings(), 600)
  },

  async _saveScrollSettings() {
    const url = this._normalizeUrl(document.getElementById('cap-url').value)
    if (!url) return
    const mode = document.querySelector('input[name="scroll-mode"]:checked').value
    const settings = mode === 'step'
      ? { mode: 'step', step: parseInt(document.getElementById('scroll-step').value) || 1000 }
      : { mode: 'custom', positions: this._parsePositions(document.getElementById('scroll-custom').value) }
    await window.api.saveScrollSettings(url, settings)
  },

  _parsePositions(text) {
    return (text || '').split(/[\s/,]+/).map(s => parseInt(s)).filter(n => !isNaN(n) && n >= 0)
  },

  async loadScrollSettings(url) {
    if (!url) return
    try {
      const s = await window.api.getScrollSettings(url)
      if (!s) return
      if (s.mode === 'custom') {
        document.querySelector('input[name="scroll-mode"][value="custom"]').checked = true
        document.getElementById('scroll-step').disabled = true
        document.getElementById('scroll-custom').disabled = false
        document.getElementById('scroll-custom').value = (s.positions || []).join(' / ')
        document.getElementById('scroll-hint').textContent = 'Absolute scroll positions from top, slash-separated'
      } else {
        document.querySelector('input[name="scroll-mode"][value="step"]').checked = true
        document.getElementById('scroll-step').disabled = false
        document.getElementById('scroll-custom').disabled = true
        if (s.step) document.getElementById('scroll-step').value = s.step
      }
    } catch (_) {}
  },

  async refreshSessionStatus() {
    const url = this._normalizeUrl(document.getElementById('cap-url').value)
    const statusEl = document.getElementById('cap-session-status')
    const clearBtn = document.getElementById('cap-session-clear')
    try {
      const hostname = new URL(url).hostname
      const has = await window.api.hasSession(url)
      if (has) {
        statusEl.textContent = `Session: ${hostname}`
        statusEl.style.color = '#6a9f6a'
        clearBtn.style.display = 'inline-flex'
      } else {
        statusEl.textContent = 'No saved session'
        statusEl.style.color = 'var(--text-muted)'
        clearBtn.style.display = 'none'
      }
    } catch (_) {
      statusEl.textContent = 'No saved session'
      statusEl.style.color = 'var(--text-muted)'
      clearBtn.style.display = 'none'
    }
  },

  buildJob() {
    const mode = document.querySelector('.mode-btn.active').dataset.mode
    const isBatch = document.getElementById('cap-batch').checked
    const url = this._normalizeUrl(document.getElementById('cap-url').value)

    return {
      url,
      device: document.getElementById('cap-device').value,
      batchDevices: isBatch
        ? Array.from(document.querySelectorAll('.batch-device:checked')).map(el => el.value)
        : [],
      mode,
      screenshotType: document.querySelector('input[name="scrtype"]:checked')?.value || 'full-page',
      crawl: document.getElementById('cap-crawl').checked,
      crawlMaxPages: parseInt(document.getElementById('cap-crawl-max').value) || 30,
      scrollSpeed: parseInt(document.getElementById('cap-speed')?.value) || 2000,
      scrollPause: parseInt(document.getElementById('cap-pause')?.value) ?? 1500,
      manualMode: document.getElementById('cap-manual')?.checked ?? false,
      hoverInteractions: document.getElementById('cap-hover')?.checked ?? false,
      viewportExtend: parseInt(document.getElementById('cap-extend').value) || 0,
      heroWaitSeconds: parseInt(document.getElementById('cap-wait').value) || 15,
      darkMode: document.querySelector('input[name="dark"]:checked')?.value === 'on',
      customCss: document.getElementById('cap-css').value,
      auth: { type: 'none' }
    }
  },

  async loadHttpAuth(url) {
    if (!url) return
    try {
      const auth = await window.api.getHttpAuth(url)
      const statusEl = document.getElementById('cap-auth-status')
      if (auth && auth.username) {
        document.getElementById('cap-auth-user').value = auth.username
        document.getElementById('cap-auth-pass').value = auth.password || ''
        statusEl.textContent = auth.username
        statusEl.style.color = '#6a9f6a'
      } else {
        document.getElementById('cap-auth-user').value = ''
        document.getElementById('cap-auth-pass').value = ''
        statusEl.textContent = ''
      }
    } catch (_) {}
  },

  async _saveHttpAuth() {
    const url = this._normalizeUrl(document.getElementById('cap-url').value)
    if (!url) return
    const username = document.getElementById('cap-auth-user').value.trim()
    const password = document.getElementById('cap-auth-pass').value
    const statusEl = document.getElementById('cap-auth-status')
    if (username) {
      await window.api.saveHttpAuth(url, { username, password })
      statusEl.textContent = username
      statusEl.style.color = '#6a9f6a'
    } else {
      await window.api.saveHttpAuth(url, null)
      statusEl.textContent = ''
    }
  },

  async startCapture() {
    const job = this.buildJob()
    if (!job.url) return alert('Please enter a URL')
    // Save current scroll settings before starting
    await this._saveScrollSettings()
    const btn = document.getElementById('cap-start')
    btn.disabled = true
    btn.textContent = '⏳ Capturing…'
    try {
      await window.api.startCapture(job)
    } finally {
      btn.disabled = false
      btn.textContent = '▶ Start'
    }
  }
}
