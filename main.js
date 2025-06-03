const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const mqtt = require('mqtt')
const config = require('./config')
const fs = require('fs')

let mainWindow
let mqttClient = null
let csvData = [] // Array to store the data temporarily
let isRecording = false // Flag to track recording state

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
      try {
        const data = JSON.parse(message.toString());
        console.log('Received sensor data:');
        console.log('Timestamp:', data.timestamp);
        console.log('Distance:', data.distance, 'units');
        console.log('Fan Speed:', data.fan_speed, '%');
        console.log('------------------------');
        
        // Only add data to our temporary storage if recording is active
        if (isRecording) {
          csvData.push({
            timestamp: data.timestamp,
            distance: data.distance,
            fan_speed: data.fan_speed
          });
          console.log('Current recording data points:', csvData.length);
        }
        
        mainWindow.webContents.send('mqtt:message', {
          topic,
          message: data
        });
      } catch (error) {
        console.error('Error parsing message:', error);
        console.log('Raw message:', message.toString());
      }
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

// Add new IPC handler for recording control
ipcMain.handle('toggle-recording', async (_, shouldRecord) => {
  console.log('Toggle recording:', shouldRecord ? 'Starting' : 'Stopping');
  console.log('Data points before toggle:', csvData.length);
  isRecording = shouldRecord;
  if (isRecording) {
    // Clear the data when starting a new recording
    csvData = [];
    console.log('Cleared data for new recording');
  }
  console.log('Data points after toggle:', csvData.length);
  
  // Send the current state to the renderer
  mainWindow.webContents.send('recording-state-changed', {
    isRecording,
    hasData: csvData.length > 0
  });
  
  return true;
});

// Add new IPC handler to check data state
ipcMain.handle('check-data-state', async () => {
  return {
    isRecording,
    hasData: csvData.length > 0
  };
});

// Modify the save-csv handler to check if we have recorded data
ipcMain.handle('save-csv', async () => {
  console.log('Attempting to save CSV with', csvData.length, 'data points');
  if (csvData.length === 0) {
    return { success: false, message: 'No recorded data to save' };
  }

  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Sensor Data',
      defaultPath: path.join(app.getPath('documents'), 'sensor_data.csv'),
      filters: [
        { name: 'CSV Files', extensions: ['csv'] }
      ]
    });

    if (!filePath) {
      return { success: false, message: 'Save cancelled' };
    }

    // Create CSV content
    const headers = 'Timestamp,Distance,Fan Speed\n';
    const rows = csvData.map(data => 
      `${data.timestamp},${data.distance},${data.fan_speed}`
    ).join('\n');
    const csvContent = headers + rows;

    // Write to file
    fs.writeFileSync(filePath, csvContent);
    console.log('Successfully wrote', csvData.length, 'data points to file');
    
    // Clear the data after successful save
    csvData = [];
    console.log('Cleared data after save');
    
    return { success: true, message: 'Data saved successfully' };
  } catch (error) {
    console.error('Error saving CSV:', error);
    return { success: false, message: 'Error saving file' };
  }
});

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
