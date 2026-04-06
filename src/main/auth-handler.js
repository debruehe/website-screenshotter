function buildHttpCredentials(authConfig) {
  if (!authConfig || authConfig.type !== 'basic') return null
  return { username: authConfig.username, password: authConfig.password }
}

function validateFormAuth(authConfig) {
  if (!authConfig.formPasswordSelector) throw new Error('formPasswordSelector is required for form auth')
  if (!authConfig.formSubmitSelector) throw new Error('formSubmitSelector is required for form auth')
  if (!authConfig.password) throw new Error('password is required for form auth')
}

async function performFormLogin(page, authConfig) {
  validateFormAuth(authConfig)
  await page.fill(authConfig.formPasswordSelector, authConfig.password)
  await page.click(authConfig.formSubmitSelector)
  await page.waitForNavigation({ timeout: 15000 }).catch(() => {})
  if (authConfig.postLoginUrlPattern) {
    const currentUrl = page.url()
    if (!currentUrl.includes(authConfig.postLoginUrlPattern)) {
      throw new Error(`Login failed — check selectors and credentials. Current URL: ${currentUrl}`)
    }
  }
}

module.exports = { buildHttpCredentials, validateFormAuth, performFormLogin }
