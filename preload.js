const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Add any methods you want to expose to the renderer process here
    // For example:
    // send: (channel, data) => {
    //   ipcRenderer.send(channel, data)
    // }
  }
)

contextBridge.exposeInMainWorld(
  'mqtt', {
    onConnect: (callback) => ipcRenderer.on('mqtt:connected', callback),
    onDisconnect: (callback) => ipcRenderer.on('mqtt:disconnected', callback),
    onError: (callback) => ipcRenderer.on('mqtt:error', (_, error) => callback(error)),
    onMessage: (callback) => ipcRenderer.on('mqtt:message', (_, data) => callback(data)),
    connect: () => ipcRenderer.invoke('mqtt:connect'),
    disconnect: () => ipcRenderer.invoke('mqtt:disconnect'),
    subscribe: (topic) => ipcRenderer.invoke('mqtt:subscribe', topic),
    unsubscribe: (topic) => ipcRenderer.invoke('mqtt:unsubscribe', topic),
    publish: (topic, message) => ipcRenderer.invoke('mqtt:publish', topic, message),
    saveCSV: () => ipcRenderer.invoke('save-csv'),
    toggleRecording: (shouldRecord) => ipcRenderer.invoke('toggle-recording', shouldRecord),
    onRecordingStateChange: (callback) => ipcRenderer.on('recording-state-changed', (_, state) => callback(state)),
    checkDataState: () => ipcRenderer.invoke('check-data-state')
  }
)
