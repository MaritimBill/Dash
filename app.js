const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MQTT Configuration
const MQTT_BROKER = 'mqtt://localhost:1883';
const MQTT_TOPICS = {
    MATLAB_DATA: 'pem/matlab/data',
    MATLAB_CONTROL: 'pem/matlab/control',
    ARDUINO_DATA: 'pem/arduino/data', 
    ARDUINO_CONTROL: 'pem/arduino/control',
    MPC_COMPARISON: 'pem/mpc/comparison'
};

// MQTT Client
let mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT broker');
    Object.values(MQTT_TOPICS).forEach(topic => {
        mqttClient.subscribe(topic);
    });
});

mqttClient.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        io.emit('mqtt-data', { topic, data });
        
        // Route to specific events
        if (topic.includes('matlab')) io.emit('matlab-update', data);
        if (topic.includes('arduino')) io.emit('arduino-update', data);
        if (topic.includes('mpc/comparison')) io.emit('mpc-comparison', data);
    } catch (error) {
        console.error('MQTT parse error:', error);
    }
});

// Socket.io for real-time web communication
io.on('connection', (socket) => {
    console.log('🔌 Web client connected');

    socket.on('control-command', (data) => {
        const topic = data.destination === 'matlab' ? MQTT_TOPICS.MATLAB_CONTROL : MQTT_TOPICS.ARDUINO_CONTROL;
        mqttClient.publish(topic, JSON.stringify(data));
    });

    socket.on('mpc-config', (config) => {
        mqttClient.publish(MQTT_TOPICS.MATLAB_CONTROL, JSON.stringify({
            type: 'mpc_config',
            config: config
        }));
    });

    socket.on('disconnect', () => {
        console.log('🔌 Web client disconnected');
    });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 PEM Dashboard running on http://localhost:${PORT}`);
});
