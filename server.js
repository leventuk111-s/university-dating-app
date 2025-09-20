const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const matchRoutes = require('./routes/match');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://maps.googleapis.com",
        "https://maps.gstatic.com"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
        "https://*.googleusercontent.com",
        "https://university-dating-app.onrender.com"
      ],
      connectSrc: [
        "'self'", 
        "https://maps.googleapis.com"
      ]
    }
  }
}));
app.use(cors({
  origin: [
    'https://university-dating-app.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug route to check uploads directory
app.get('/debug/uploads', (req, res) => {
  const fs = require('fs');
  const uploadsPath = path.join(__dirname, 'uploads', 'photos');
  
  try {
    const files = fs.readdirSync(uploadsPath);
    res.json({
      uploadsPath,
      files,
      count: files.length
    });
  } catch (error) {
    res.json({
      error: error.message,
      uploadsPath
    });
  }
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/university-dating';
console.log('🔗 Connecting to MongoDB...');
console.log('📍 Database type:', MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
  console.log('🗄️ Database ready for connections');
})
.catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  if (MONGODB_URI.includes('mongodb+srv')) {
    console.log('💡 Atlas connection tips:');
    console.log('   - Check your username/password');
    console.log('   - Verify network access (0.0.0.0/0)');
    console.log('   - Ensure cluster is running');
  } else {
    console.log('💡 Local MongoDB tips:');
    console.log('   - Start MongoDB: mongod');
    console.log('   - Check if MongoDB is running on port 27017');
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/chat', chatRoutes);

// Serve main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  socket.on('send-message', (data) => {
    socket.to(data.chatId).emit('receive-message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Serve the main HTML file for email verification route
app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all handler: send back the main HTML file for any non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
