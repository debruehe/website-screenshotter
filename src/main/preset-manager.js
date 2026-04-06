const fs = require('fs')
const path = require('path')
const os = require('os')

const STORE_DIR = process.env.STORE_DIR ||
  path.join(os.homedir(), 'Library', 'Application Support', 'WebScreenshotter')
const PRESETS_FILE = path.join(STORE_DIR, 'presets.json')

const BUILT_IN_DEVICES = [
  { id: 'full-hd', name: 'Full HD Desktop', width: 1920, height: 1080 },
  { id: 'macbook-air', name: 'MacBook Air', width: 1674, height: 1083 },
  { id: 'macbook-pro', name: 'MacBook Pro', width: 1440, height: 900 },
  { id: 'ipad-portrait', name: 'iPad Portrait', width: 768, height: 1024 },
  { id: 'ipad-landscape', name: 'iPad Landscape', width: 1024, height: 768 },
  { id: 'iphone-16-pro', name: 'iPhone 16 Pro', width: 393, height: 852 }
]

function ensureDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true })
}

function load() {
  ensureDir()
  if (!fs.existsSync(PRESETS_FILE)) {
    return { devices: [...BUILT_IN_DEVICES], jobs: [] }
  }
  try {
    const data = JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'))
    const devices = data.devices || [...BUILT_IN_DEVICES]
    // Inject any built-in devices that are missing (e.g. added in a newer version)
    let changed = false
    for (const builtin of BUILT_IN_DEVICES) {
      if (!devices.find(d => d.id === builtin.id)) {
        // Insert at the same position as in BUILT_IN_DEVICES
        const idx = BUILT_IN_DEVICES.indexOf(builtin)
        devices.splice(idx, 0, builtin)
        changed = true
      }
    }
    const result = { devices, jobs: data.jobs || [] }
    if (changed) save(result)
    return result
  } catch {
    return { devices: [...BUILT_IN_DEVICES], jobs: [] }
  }
}

function save(data) {
  ensureDir()
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(data, null, 2))
}

function getDevices() { return load().devices }

function saveDevice(device) {
  const data = load()
  const idx = data.devices.findIndex(d => d.id === device.id)
  if (idx >= 0) data.devices[idx] = device
  else data.devices.push(device)
  save(data)
}

function deleteDevice(id) {
  const data = load()
  data.devices = data.devices.filter(d => d.id !== id)
  save(data)
}

function getJobPresets() { return load().jobs }

function saveJobPreset(job) {
  const data = load()
  const idx = data.jobs.findIndex(j => j.id === job.id)
  if (idx >= 0) data.jobs[idx] = job
  else data.jobs.push(job)
  save(data)
}

function deleteJobPreset(id) {
  const data = load()
  data.jobs = data.jobs.filter(j => j.id !== id)
  save(data)
}

module.exports = { getDevices, saveDevice, deleteDevice, getJobPresets, saveJobPreset, deleteJobPreset }
