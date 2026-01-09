require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { connectDB } = require('./services/database');
const { redis } = require('./services/redis');
const pollRoutes = require('./routes/polls'); 
const { startSyncJob } = require('./services/sync'); 

const app = express();

const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.static(path.join(__dirname, '..')));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next(); 
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);  
  socket.on('join_poll', (pollId) => {
    console.log(`Client ${socket.id} joined poll:${pollId}`);
    socket.join(`poll:${pollId}`);    
    socket.emit('joined_poll', { 
      pollId,
      message: `Successfully joined poll ${pollId}` 
    });
  });
  
  //Client leaves a poll room
  socket.on('leave_poll', (pollId) => {
    console.log(`Client ${socket.id} left poll:${pollId}`);
    socket.leave(`poll:${pollId}`);
    
    socket.emit('left_poll', { 
      pollId,
      message: `Left poll ${pollId}` 
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});
app.set('io', io);

// Routes
app.use('/api', pollRoutes)

// app.get('/test-realtime.html', (req, res) => {
//   res.sendFile(__dirname + '/../test-realtime.html');
// });

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check if Redis is alive
    await redis.ping();
    
    const { getSyncStats } = require('./services/sync');
    const syncStats = getSyncStats();
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        mongodb: 'connected',
        websocket: 'active',
        sync: syncStats.lastRun ? 'active' : 'pending'
      },
      sync: syncStats
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

async function startServer() {
  try {
    await connectDB();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API: http://localhost:${PORT}/api`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      startSyncJob();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
startServer();

module.exports = { app, io, server };