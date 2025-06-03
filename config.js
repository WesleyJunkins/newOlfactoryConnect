module.exports = {
    mqtt: {
        // Broker connection settings
        brokerUrl: 'wss://688c27c3f6514933b27cbc21d4bcb750.s1.eu.hivemq.cloud:8884/mqtt', // Your HiveMQ broker URL
        clientId: `electron-mqtt-${Math.random().toString(16).slice(3)}`, // Unique client ID
        username: 'Wesj1234+desktop', // Add your username if required
        password: 'Wesj1234+desktop', // Add your password if required
        
        // Default topics
        defaultTopics: {
            subscribe: 'pi/outbox',
        },
        
        // Connection options
        options: {
            clean: true, // Clean session
            reconnectPeriod: 1000, // Reconnect every 1 second
            connectTimeout: 30 * 1000, // 30 seconds
            rejectUnauthorized: false // Set to true if using SSL/TLS
        }
    }
} 