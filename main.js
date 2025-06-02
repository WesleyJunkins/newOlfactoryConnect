const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const mqtt = require('mqtt')
const config = require('./config')

let mainWindow
let mqttClient = null

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile('index.html')

  // Log when the window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded successfully')
    // Automatically connect to MQTT broker when window is ready
    connectToMQTT()
  })
}

async function connectToMQTT() {
  try {
    console.log('Attempting to connect to MQTT broker...')
    console.log('Broker URL:', config.mqtt.brokerUrl)
    console.log('Username:', config.mqtt.username)
    
    if (mqttClient) {
      console.log('Existing client found, ending connection...')
      await mqttClient.end()
    }

    const connectionOptions = {
      ...config.mqtt.options,
      clientId: config.mqtt.clientId,
      username: config.mqtt.username,
      password: config.mqtt.password
    }

    console.log('Connection options:', connectionOptions)

    mqttClient = mqtt.connect(config.mqtt.brokerUrl, connectionOptions)

    mqttClient.on('connect', () => {
      console.log('Successfully connected to MQTT broker')
      mainWindow.webContents.send('mqtt:connected')
      // Subscribe to default topic if specified
      if (config.mqtt.defaultTopics.subscribe) {
        console.log('Subscribing to topic:', config.mqtt.defaultTopics.subscribe)
        mqttClient.subscribe(config.mqtt.defaultTopics.subscribe)
      }
    })

    mqttClient.on('error', (error) => {
      console.error('MQTT Error:', error)
    })

    mqttClient.on('disconnect', () => {
      console.log('Disconnected from MQTT broker')
      mainWindow.webContents.send('mqtt:disconnected')
    })

    mqttClient.on('message', (topic, message) => {
      console.log('Received message:', { topic, message: message.toString() })
      mainWindow.webContents.send('mqtt:message', {
        topic,
        message: message.toString()
      })
    })

    return true
  } catch (error) {
    console.error('MQTT connection error:', error)
    return false
  }
}

// MQTT handlers
ipcMain.handle('mqtt:connect', async () => {
  return connectToMQTT()
})

ipcMain.handle('mqtt:disconnect', async () => {
  if (mqttClient) {
    console.log('Disconnecting from MQTT broker...')
    await mqttClient.end()
    mqttClient = null
  }
  return true
})

ipcMain.handle('mqtt:subscribe', async (_, topic) => {
  if (mqttClient) {
    console.log('Subscribing to topic:', topic)
    mqttClient.subscribe(topic)
    return true
  }
  return false
})

ipcMain.handle('mqtt:unsubscribe', async (_, topic) => {
  if (mqttClient) {
    console.log('Unsubscribing from topic:', topic)
    mqttClient.unsubscribe(topic)
    return true
  }
  return false
})

ipcMain.handle('mqtt:publish', async (_, topic, message) => {
  if (mqttClient) {
    console.log('Publishing message:', { topic, message })
    mqttClient.publish(topic, message)
    return true
  }
  return false
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
