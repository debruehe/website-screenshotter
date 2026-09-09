function ensureSessionSaveButton() {
  const buttonId = '__wsSaveBtn'

  const inject = () => {
    if (!document.body || document.getElementById(buttonId)) return

    const button = document.createElement('button')
    button.id = buttonId
    button.textContent = '✅ Save Session & Close'
    button.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:12px 20px;background:#4f9cf9;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-family:-apple-system,sans-serif'
    button.addEventListener('click', () => globalThis.__wsSaveSession())
    document.body.appendChild(button)
  }

  const start = () => {
    inject()
    if (globalThis.__wsSaveButtonObserver) return
    const observer = new MutationObserver(inject)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    globalThis.__wsSaveButtonObserver = observer
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }
}

async function installSessionSaveButton(page) {
  await page.addInitScript(ensureSessionSaveButton)
  await page.evaluate(ensureSessionSaveButton)
}

module.exports = { installSessionSaveButton }
