const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('calibrate', {
  save:   () => ipcRenderer.send('calibrate:save'),
  cancel: () => ipcRenderer.send('calibrate:cancel')
})
