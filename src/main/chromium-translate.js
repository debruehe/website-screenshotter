const TRANSLATION_DISABLED_ARGS = [
  '--disable-features=Translate,TranslateUI',
  '--disable-translate',
  '--lang=en-US',
  '--accept-lang=en-US,en'
]

function markDocumentAsNotranslate() {
  const apply = () => {
    const root = document.documentElement
    const head = document.head
    if (!root || !head) return false

    root.classList.add('notranslate')
    root.setAttribute('translate', 'no')

    let meta = document.querySelector('meta[name="google"][content="notranslate"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'google')
      meta.setAttribute('content', 'notranslate')
      head.prepend(meta)
    }
    return true
  }

  if (!apply()) {
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect()
    })
    observer.observe(document, { childList: true, subtree: true })
  }
}

async function installTranslationSuppression(context) {
  context.on('page', page => {
    page.evaluate(markDocumentAsNotranslate).catch(() => {})
  })
  await context.addInitScript(markDocumentAsNotranslate)
  await Promise.all(context.pages().map(currentPage => currentPage.evaluate(markDocumentAsNotranslate)))
}

module.exports = { TRANSLATION_DISABLED_ARGS, installTranslationSuppression }
