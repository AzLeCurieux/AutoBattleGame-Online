const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import our modules
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const { initializeDatabase } = require('./database/db');
const { authenticateSocket } = require('./middleware/auth');
const { GameManager } = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || process.env.WEBSITES_PORT || 3000;

// Set development mode by default for easier debugging
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Log environment info
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🚀 Port: ${PORT}`);

// Security middleware - relaxed for development
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Add headers to allow mixed content
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Explicit routes for CSS and JS files
app.get('/css/*', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.sendFile(path.join(__dirname, req.path));
});

app.get('/js/*', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.sendFile(path.join(__dirname, req.path));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve the main game (only if authenticated)
app.get('/', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    return res.redirect('/login');
  }
  
  // Verify token
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    jwt.verify(token, JWT_SECRET);
    res.sendFile(path.join(__dirname, 'index.html'));
  } catch (error) {
    res.redirect('/login');
  }
});

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Initialize game manager
const gameManager = new GameManager();

// Socket.io connection handling
io.on('connection', (socket) => {
  // Only log connections in development
  if (isDevelopment) {
    console.log('New client connected:', socket.id);
  }

  // Authenticate socket connection
  socket.on('authenticate', async (data) => {
    try {
      const user = await authenticateSocket(data.token);
      if (user) {
        socket.userId = user.id;
        socket.username = user.username;
        socket.avatar = user.avatar;
        
        // Join user to their personal room
        socket.join(`user_${user.id}`);
        
        // Join global leaderboard room
        socket.join('leaderboard');
        
        // Add user to active users
        gameManager.addUser(user.id, user.username, user.avatar);
        
        // Notify user of successful authentication
        socket.emit('authenticated', {
          userId: user.id,
          username: user.username,
          avatar: user.avatar
        });
        
        // Update leaderboard for all users
        gameManager.updateLeaderboard(io);
        
        // Only log authentication in development
        if (isDevelopment) {
          console.log(`User ${user.username} authenticated`);
        }
      } else {
        socket.emit('auth_error', { message: 'Invalid token' });
        socket.disconnect();
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  });

  // Handle game actions
  socket.on('game_action', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const result = await gameManager.handleGameAction(socket.userId, data);
      socket.emit('game_result', result);
      
      // Update leaderboard if score changed
      if (result.scoreChanged) {
        gameManager.updateLeaderboard(io);
      }
    } catch (error) {
      console.error('Game action error:', error);
      socket.emit('error', { message: 'Game action failed' });
    }
  });

  // Handle score submission
  socket.on('submit_score', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      console.log(`Score submission received: user=${socket.userId}, level=${data.level}, score=${data.score}, gold=${data.gold}`);
      const result = await gameManager.submitScore(socket.userId, data);
      socket.emit('score_submitted', result);
      
      // Send new record notification if applicable
      if (result.isNewRecord) {
        socket.emit('new_record', {
          level: result.newRecord,
          previousRecord: result.previousRecord,
          message: `🎉 Nouveau record ! Niveau ${result.newRecord} (précédent: ${result.previousRecord})`
        });
      }
      
      // Update leaderboard after successful score submission
      console.log('Updating leaderboard after score submission...');
      await gameManager.updateLeaderboard(io);
    } catch (error) {
      console.error('Score submission error:', error);
      socket.emit('error', { message: 'Score submission failed' });
    }
  });

  // Handle real-time level updates
  socket.on('update_level', async (data) => {
    if (!socket.userId) {
      return;
    }

    try {
      // Update user's current game state
      gameManager.updateUserGameState(socket.userId, data.level, data.gold);
      
      // Broadcast updated online players to all clients
      const onlinePlayers = gameManager.getActiveUsers();
      io.to('leaderboard').emit('online_players_update', {
        players: onlinePlayers,
        count: onlinePlayers.length
      });
    } catch (error) {
      console.error('Level update error:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    // Only log disconnections in development
    if (isDevelopment) {
      console.log('Client disconnected:', socket.id);
    }
    if (socket.userId) {
      gameManager.removeUser(socket.userId);
      gameManager.updateLeaderboard(io);
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      if (isDevelopment) {
        console.log(`🎮 Game available at http://localhost:${PORT}`);
        console.log(`🌐 Tailscale access: http://100.115.199.81:${PORT}`);
        console.log(`📱 Share this Tailscale URL with your friends!`);
      } else {
        console.log(`🌐 Production server ready on port ${PORT}`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
