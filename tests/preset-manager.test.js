const path = require('path')
const os = require('os')
const fs = require('fs')

process.env.STORE_DIR = path.join(os.tmpdir(), 'wss-preset-test-' + Date.now())

const pm = require('../src/main/preset-manager')

afterAll(() => {
  fs.rmSync(process.env.STORE_DIR, { recursive: true, force: true })
})

test('returns 5 built-in devices on first load', () => {
  const devices = pm.getDevices()
  expect(devices).toHaveLength(5)
  expect(devices.find(d => d.id === 'macbook-pro')).toBeDefined()
})

test('saves and retrieves a custom device', () => {
  pm.saveDevice({ id: 'test-device', name: 'Test', width: 800, height: 600 })
  const devices = pm.getDevices()
  expect(devices.find(d => d.id === 'test-device')).toBeDefined()
})

test('deletes a device', () => {
  pm.deleteDevice('test-device')
  const devices = pm.getDevices()
  expect(devices.find(d => d.id === 'test-device')).toBeUndefined()
})

test('saves and retrieves a job preset', () => {
  const job = { id: 'j1', name: 'Test Job', url: 'https://example.com', device: 'macbook-pro' }
  pm.saveJobPreset(job)
  const jobs = pm.getJobPresets()
  expect(jobs.find(j => j.id === 'j1')).toMatchObject({ url: 'https://example.com' })
})

test('deletes a job preset', () => {
  pm.deleteJobPreset('j1')
  expect(pm.getJobPresets().find(j => j.id === 'j1')).toBeUndefined()
})
