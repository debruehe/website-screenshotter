const authHandler = require('../src/main/auth-handler')

test('returns null config for auth type "none"', () => {
  const config = authHandler.buildHttpCredentials({ type: 'none' })
  expect(config).toBeNull()
})

test('returns http credentials for auth type "basic"', () => {
  const config = authHandler.buildHttpCredentials({ type: 'basic', username: 'admin', password: 'secret' })
  expect(config).toEqual({ username: 'admin', password: 'secret' })
})

test('throws if form auth is missing required fields', () => {
  expect(() => authHandler.validateFormAuth({ type: 'form', formPasswordSelector: '' }))
    .toThrow('formPasswordSelector')
})

test('passes validation for complete form auth config', () => {
  expect(() => authHandler.validateFormAuth({
    type: 'form',
    formPasswordSelector: '#password',
    formSubmitSelector: 'button[type=submit]',
    password: 'secret'
  })).not.toThrow()
})
