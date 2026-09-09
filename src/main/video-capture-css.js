const VIDEO_CAPTURE_CSS = `
* { scrollbar-width: none !important; }
*::-webkit-scrollbar { display: none !important; }
* { -webkit-tap-highlight-color: transparent !important; }
html, body, * { scroll-behavior: auto !important; }
`

async function installVideoCaptureCss(page, customCss = '') {
  const content = VIDEO_CAPTURE_CSS + customCss

  await page.addInitScript(({ css, styleId }) => {
    const inject = () => {
      if (!document.documentElement) return false
      if (document.getElementById(styleId)) return true

      const style = document.createElement('style')
      style.id = styleId
      style.textContent = css
      ;(document.head || document.documentElement).appendChild(style)
      return true
    }

    if (!inject()) {
      const observer = new MutationObserver(() => {
        if (inject()) observer.disconnect()
      })
      observer.observe(document, { childList: true })
    }
  }, { css: content, styleId: '__ws_video_capture_css' })

  await page.addStyleTag({ content })
}

module.exports = { installVideoCaptureCss }
