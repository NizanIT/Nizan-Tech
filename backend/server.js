require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
const allowedOrigins = [
  'https://nizan-tech.vercel.app',
  'https://nizan-tech.onrender.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5000'
];

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] }
});

// Store io in app for route access
app.set('io', io);

// Connect DB
connectDB();

// 🔍 Request Logger (To debug Vercel -> Render connection)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin || 'No Origin'}`);
  next();
});

// Middleware
app.use(cors({ 
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'), false);
    }
  }, 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});
// Serve static frontend
app.use(express.static('../frontend'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/employee', require('./routes/employee'));
app.use('/api/timeblock', require('./routes/timeblock'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// 🔍 Connection Test Route (To verify MongoDB Atlas connection)
app.get('/api/test-db', async (req, res) => {
  try {
    const status = mongoose.connection.readyState === 1 ? 'Healthy ✅' : 'Disconnected ❌';
    res.json({ 
      success: true, 
      database: status, 
      env: process.env.NODE_ENV,
      time: new Date() 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Socket.IO
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // User joins their own room by userId
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined room`);
  });

  // Admins join 'admin' room
  socket.on('joinAdmin', () => {
    socket.join('admin');
    console.log(`👑 Admin joined admin room`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// 🛡️ Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
    path: req.url
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
