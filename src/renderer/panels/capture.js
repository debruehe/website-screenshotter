window.capturePanel = {
  init() {
    const panel = document.getElementById('panel-capture')
    panel.innerHTML = `
      <div class="field" style="display:flex;gap:8px">
        <input type="url" id="cap-url" placeholder="https://example.com" style="flex:1">
        <button class="primary" id="cap-start">▶ Start Capture</button>
      </div>

      <div class="field" style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <label>Device</label>
          <select id="cap-device"></select>
        </div>
        <label style="margin-top:16px;display:flex;align-items:center;gap:6px;color:var(--text)">
          <input type="checkbox" id="cap-batch"> Batch (multi-device)
        </label>
      </div>

      <div id="cap-batch-list" style="display:none" class="field"></div>

      <div class="section-header">Mode</div>
      <div class="radio-group field">
        <label><input type="radio" name="mode" value="screenshot" checked> Screenshot</label>
        <label><input type="radio" name="mode" value="video"> Video</label>
      </div>

      <div id="screenshot-opts">
        <div class="section-header">Screenshot Options</div>
        <div class="radio-group field">
          <label><input type="radio" name="scrtype" value="full-page" checked> Full page</label>
          <label><input type="radio" name="scrtype" value="single-viewport"> Single viewport</label>
        </div>
        <label><input type="checkbox" id="cap-crawl"> Recursive crawl</label>
        <div id="crawl-max-row" style="display:none;margin-top:8px">
          <label>Max pages</label>
          <input type="number" id="cap-crawl-max" value="30" min="1" max="30" style="width:80px">
        </div>
      </div>

      <div id="video-opts" style="display:none">
        <div class="section-header">Video Options</div>
        <div class="field">
          <label>Scroll speed</label>
          <div class="radio-group">
            <label><input type="radio" name="speed" value="slow"> Slow</label>
            <label><input type="radio" name="speed" value="medium" checked> Medium</label>
            <label><input type="radio" name="speed" value="fast"> Fast</label>
          </div>
        </div>
        <div class="field">
          <label><input type="checkbox" id="cap-section-scroll" checked> Section-aware scroll</label>
        </div>
        <div class="field">
          <label><input type="checkbox" id="cap-hover"> Hover interactions</label>
        </div>
        <div class="field" style="display:flex;gap:10px;align-items:center">
          <label style="white-space:nowrap">Viewport extend (px)</label>
          <input type="number" id="cap-extend" value="0" min="0" max="400" style="width:80px">
        </div>
      </div>

      <div class="section-header">Auth (optional)</div>
      <div class="field">
        <div class="radio-group">
          <label><input type="radio" name="auth" value="none" checked> None</label>
          <label><input type="radio" name="auth" value="basic"> Basic</label>
          <label><input type="radio" name="auth" value="form"> Form</label>
        </div>
      </div>
      <div id="auth-basic" style="display:none">
        <div class="field"><label>Username</label><input type="text" id="auth-user"></div>
        <div class="field"><label>Password</label><input type="password" id="auth-pass"></div>
      </div>
      <div id="auth-form" style="display:none">
        <div class="field"><label>Password field selector</label><input type="text" id="auth-pass-sel" placeholder="#password"></div>
        <div class="field"><label>Submit button selector</label><input type="text" id="auth-sub-sel" placeholder="button[type=submit]"></div>
        <div class="field"><label>Password</label><input type="password" id="auth-form-pass"></div>
        <div class="field"><label>Post-login URL pattern (optional)</label><input type="text" id="auth-post-url"></div>
      </div>

      <div class="section-header">CSS Injection</div>
      <div class="field">
        <div style="background:#111;border:1px solid var(--border);border-radius:4px;padding:8px;font-family:monospace;font-size:11px;color:#6a9f6a;margin-bottom:6px">
          * { scrollbar-width: none !important; }<br>
          *::-webkit-scrollbar { display: none !important; }<br>
          * { -webkit-tap-highlight-color: transparent !important; }
        </div>
        <textarea id="cap-css" rows="3" placeholder="Additional CSS..."></textarea>
      </div>

      <div style="display:flex;gap:16px">
        <div class="field" style="flex:1"><label>Hero wait (s)</label><input type="number" id="cap-wait" value="15" min="0" max="120"></div>
        <div class="field" style="flex:1">
          <label>Dark mode</label>
          <div class="radio-group" style="margin-top:6px">
            <label><input type="radio" name="dark" value="off" checked> Off</label>
            <label><input type="radio" name="dark" value="on"> On</label>
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

    // Batch list
    const batchList = document.getElementById('cap-batch-list')
    batchList.innerHTML = '<label style="color:var(--text-muted);font-size:11px">Select devices:</label>' +
      devices.map(d => `
        <label style="display:flex;align-items:center;gap:6px;color:var(--text);margin-top:6px">
          <input type="checkbox" class="batch-device" value="${d.id}"> ${d.name}
        </label>
      `).join('')
  },

  bindEvents() {
    // Mode toggle
    document.querySelectorAll('input[name="mode"]').forEach(r => {
      r.addEventListener('change', () => {
        const isVideo = r.value === 'video'
        document.getElementById('screenshot-opts').style.display = isVideo ? 'none' : 'block'
        document.getElementById('video-opts').style.display = isVideo ? 'block' : 'none'
      })
    })

    // Auth toggle
    document.querySelectorAll('input[name="auth"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('auth-basic').style.display = r.value === 'basic' ? 'block' : 'none'
        document.getElementById('auth-form').style.display = r.value === 'form' ? 'block' : 'none'
      })
    })

    // Crawl toggle
    document.getElementById('cap-crawl').addEventListener('change', e => {
      document.getElementById('crawl-max-row').style.display = e.target.checked ? 'block' : 'none'
    })

    // Batch toggle
    document.getElementById('cap-batch').addEventListener('change', e => {
      document.getElementById('cap-batch-list').style.display = e.target.checked ? 'block' : 'none'
      document.getElementById('cap-device').disabled = e.target.checked
    })

    // Start button
    document.getElementById('cap-start').addEventListener('click', () => this.startCapture())
  },

  buildJob() {
    const mode = document.querySelector('input[name="mode"]:checked').value
    const authType = document.querySelector('input[name="auth"]:checked').value
    const isBatch = document.getElementById('cap-batch').checked

    const auth = { type: authType }
    if (authType === 'basic') {
      auth.username = document.getElementById('auth-user').value
      auth.password = document.getElementById('auth-pass').value
    } else if (authType === 'form') {
      auth.formPasswordSelector = document.getElementById('auth-pass-sel').value
      auth.formSubmitSelector = document.getElementById('auth-sub-sel').value
      auth.password = document.getElementById('auth-form-pass').value
      auth.postLoginUrlPattern = document.getElementById('auth-post-url').value
    }

    return {
      url: document.getElementById('cap-url').value,
      device: document.getElementById('cap-device').value,
      batchDevices: isBatch
        ? Array.from(document.querySelectorAll('.batch-device:checked')).map(el => el.value)
        : [],
      mode,
      screenshotType: document.querySelector('input[name="scrtype"]:checked')?.value || 'full-page',
      crawl: document.getElementById('cap-crawl').checked,
      crawlMaxPages: parseInt(document.getElementById('cap-crawl-max').value) || 30,
      scrollSpeed: document.querySelector('input[name="speed"]:checked')?.value || 'medium',
      sectionAwareScroll: document.getElementById('cap-section-scroll')?.checked ?? true,
      hoverInteractions: document.getElementById('cap-hover')?.checked ?? false,
      viewportExtend: parseInt(document.getElementById('cap-extend').value) || 0,
      heroWaitSeconds: parseInt(document.getElementById('cap-wait').value) || 15,
      darkMode: document.querySelector('input[name="dark"]:checked')?.value === 'on',
      customCss: document.getElementById('cap-css').value,
      auth
    }
  },

  async startCapture() {
    const job = this.buildJob()
    if (!job.url) return alert('Please enter a URL')
    document.getElementById('cap-start').disabled = true
    document.getElementById('cap-start').textContent = '⏳ Capturing...'
    await window.api.startCapture(job)
    document.getElementById('cap-start').disabled = false
    document.getElementById('cap-start').textContent = '▶ Start Capture'
  }
}
