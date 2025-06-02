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
    connect: (brokerUrl) => ipcRenderer.invoke('mqtt:connect', brokerUrl),
    disconnect: () => ipcRenderer.invoke('mqtt:disconnect'),
    subscribe: (topic) => ipcRenderer.invoke('mqtt:subscribe', topic),
    unsubscribe: (topic) => ipcRenderer.invoke('mqtt:unsubscribe', topic),
    publish: (topic, message) => ipcRenderer.invoke('mqtt:publish', topic, message),
    onMessage: (callback) => ipcRenderer.on('mqtt:message', (_, data) => callback(data)),
    onConnect: (callback) => ipcRenderer.on('mqtt:connected', () => callback()),
    onDisconnect: (callback) => ipcRenderer.on('mqtt:disconnected', () => callback())
  }
)
