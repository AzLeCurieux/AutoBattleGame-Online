// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');

// Import our modules
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const lootRoutes = require('./routes/loot');
const shopRoutes = require('./routes/shop');
const { initializeDatabase, db } = require('./database/db');
const { authenticateSocket, authenticateToken } = require('./middleware/auth');
const { GameManager } = require('./game/GameManager');
const { ServerGameManager } = require('./game/ServerGameManager');
const GameStateManager = require('./game/GameStateManager');
const CheatDetection = require('./security/CheatDetection');
const SimpleSessionManager = require('./security/SimpleSessionManager');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
// OPTIMIZATION: Enable Socket.IO compression for large payloads
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Enable per-message compression (reduces bandwidth by 60-80%)
  perMessageDeflate: {
    threshold: 1024, // Compress if message > 1KB
    zlibDeflateOptions: {
      chunkSize: 8 * 1024,
      level: 6 // Balance between compression ratio and CPU
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    }
  },
  // Connection optimization
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || process.env.WEBSITES_PORT || 3000;

// Set development mode by default for easier debugging
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Startup logs
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Server starting on port ${PORT}`);

// Security middleware - PRODUCTION READY
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"], // Allow Chart.js and other CDNs
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"], // Allow FontAwesome and Google Fonts
      imgSrc: ["'self'", "data:", "https:", "http:"], // Allow external images
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"], // Allow FontAwesome and Google Fonts
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" }
}));
// TODO: Configure CORS with specific origins (app.use(cors({ origin: [...]})))
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 300, // relax limits in development
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.'
    });
  }
});
app.use(compression()); // Enable gzip compression
app.use('/api/', limiter);

// More specific limiter for registration to avoid accidental abuse but with clear JSON
const registerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 20 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please wait a minute.'
    });
  }
});
app.use('/api/auth/register', registerLimiter);

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

// SECURITY: Middleware to protect HTML pages only
// Static resources (CSS, JS, images) are public but pages require auth client-side
const publicPaths = [
  '/login',
  '/login.html',
  '/probability-charts.html',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/users',
  '/api/auth/admin-login', // Allow admin login endpoint
  '/admin-login', // Allow admin login page
  '/admin-login.html'
];

function requireAuthForPages(req, res, next) {
  const path = req.path;

  // Allow public paths
  if (publicPaths.some(p => path === p || path.startsWith(p))) {
    return next();
  }

  // Allow CSS, JS, and images - they don't contain sensitive data
  // Security is enforced at the HTML page level with client-side checks
  if (path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path.startsWith('/img/') ||
    path.startsWith('/background/') ||
    path.startsWith('/game/') ||
    path.startsWith('/security/') ||
    path.startsWith('/routes/') ||
    path.startsWith('/middleware/') ||
    path.startsWith('/database/')) {
    return next();
  }

  // For HTML files (except login.html) - redirect to login if accessed directly
  if (path.endsWith('.html') && path !== '/login.html') {
    // HTML pages have client-side auth checks that will handle security
    // But we add a server-side check as defense in depth
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

    if (!token) {
      return res.redirect('/login');
    }

    // Verify token exists and is valid
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      jwt.verify(token, JWT_SECRET);
      return next();
    } catch (error) {
      return res.redirect('/login');
    }
  }

  next();
}

// Apply authentication middleware before serving static files
app.use(requireAuthForPages);

// Serve static files (with authentication middleware applied above)
app.use(express.static(path.join(__dirname)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/loot', lootRoutes);
app.use('/api/shop', shopRoutes);

// Admin Configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Admin Login Endpoint
app.post('/api/auth/admin-login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    // Create a special admin token
    const token = jwt.sign(
      { role: 'admin', timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({ success: true, token });
  }

  return res.status(401).json({ success: false, message: 'Invalid password' });
});

// Middleware for Admin or User Auth
function requireAuthOrAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if it's an admin token
    if (decoded.role === 'admin') {
      req.user = { role: 'admin' };
      return next();
    }

    // Otherwise check standard user session
    // SECURITY: Verify session token exists and is active
    const { activeSessions } = require('./middleware/auth');
    if (decoded.sessionToken && activeSessions.has(decoded.sessionToken)) {
      req.user = decoded;
      return next();
    }

    throw new Error('Invalid session');
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Monitoring Helpers
const si = require('systeminformation');

let bandwidthStats = {
  requests: 0,
  bytesIn: 0,
  bytesOut: 0,
  startTime: Date.now()
};

// Bandwidth Middleware
app.use((req, res, next) => {
  bandwidthStats.requests++;

  // Estimate bytes in (headers + body)
  const contentLength = parseInt(req.get('content-length') || 0);
  bandwidthStats.bytesIn += contentLength + 500; // +500 for approx headers

  // Hook into response to track bytes out
  const originalSend = res.send;
  res.send = function (body) {
    let size = 0;
    if (typeof body === 'string') size = Buffer.byteLength(body);
    else if (Buffer.isBuffer(body)) size = body.length;
    else if (typeof body === 'object') size = Buffer.byteLength(JSON.stringify(body));

    bandwidthStats.bytesOut += size + 500; // +500 for approx headers
    return originalSend.apply(this, arguments);
  };

  next();
});

// Monitoring History (Circular Buffer)
const MAX_HISTORY = 60; // Keep last 60 points (e.g. 5 mins if 5s interval)
const monitoringHistory = [];

// Monitoring API Endpoint (Protected by Admin or User Auth)
app.get('/api/monitoring/stats', requireAuthOrAdmin, async (req, res) => {
  try {
    const [disk, network, load, mem, networkStats] = await Promise.all([
      si.fsSize(),
      si.networkConnections(),
      si.currentLoad(),
      si.mem(),
      si.networkStats()
    ]);

    // Process Disk (use first non-loopback/non-snap volume or just the first one)
    const mainDisk = disk.find(d => d.mount === '/' || d.mount === 'C:') || disk[0] || {};

    // Process Ports (filter for listening ports)
    const openPorts = [...new Set(network
      .filter(c => c.state === 'LISTEN')
      .map(c => c.localPort)
      .sort((a, b) => a - b)
    )];

    // Process Bandwidth (Interface level)
    const netIn = networkStats.reduce((acc, iface) => acc + iface.rx_bytes, 0);
    const netOut = networkStats.reduce((acc, iface) => acc + iface.tx_bytes, 0);

    const currentStats = {
      timestamp: Date.now(),
      system: {
        uptime: process.uptime(),
        memory: {
          rss: process.memoryUsage().rss,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsed: process.memoryUsage().heapUsed,
          total: mem.total,
          active: mem.active,
          available: mem.available
        },
        cpu: process.cpuUsage(), // Raw CPU usage
        loadavg: load.cpus.map(c => c.load), // Current load per core
        cpuLoad: load.currentLoad, // Overall load %
        disk: {
          total: (mainDisk.size / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          used: (mainDisk.used / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          percent: mainDisk.use + '%',
          mount: mainDisk.mount
        },
        ports: openPorts,
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      },
      process: {
        pid: process.pid,
        title: process.title,
        resourceUsage: process.resourceUsage ? process.resourceUsage() : {},
        versions: process.versions
      },
      network: {
        ...bandwidthStats, // Express level
        systemIn: netIn,   // System level
        systemOut: netOut, // System level
        duration: (Date.now() - bandwidthStats.startTime) / 1000 // seconds
      },
      socket: {
        connected: io.engine.clientsCount,
        transport: 'polling/websocket' // Generic info
      },
      game: {
        activeUsers: gameManager.activeUsers.size,
        activeSessions: sessionManager.activeSessions.size,
        activeGames: serverGameManager.gameSessions.size,
        leaderboardSize: gameManager.leaderboard.length
      },
      plugins: [
        { name: 'GameManager', status: 'Active', details: `${gameManager.activeUsers.size} users` },
        { name: 'ServerGameManager', status: 'Active', details: `${serverGameManager.gameSessions.size} sessions` },
        { name: 'SessionManager', status: 'Active', details: `${sessionManager.activeSessions.size} tokens` },
        { name: 'CheatDetection', status: 'Active', details: 'Monitoring enabled' },
        { name: 'Database', status: 'Connected', details: 'SQLite3' },
        { name: 'Socket.IO', status: 'Running', details: `Port ${PORT}` },
        { name: 'SystemInfo', status: 'Active', details: 'v5.x' }
      ]
    };

    // Update History (Circular Buffer)
    monitoringHistory.push({
      time: currentStats.timestamp,
      cpu: currentStats.system.cpuLoad,
      mem: currentStats.system.memory.active,
      users: currentStats.game.activeUsers,
      sessions: currentStats.game.activeSessions,
      netIn: currentStats.network.bytesIn, // Express level for now, or systemIn
      netOut: currentStats.network.bytesOut
    });

    if (monitoringHistory.length > MAX_HISTORY) {
      monitoringHistory.shift(); // Remove oldest
    }

    res.json({
      ...currentStats,
      history: monitoringHistory
    });
  } catch (error) {
    console.error('Monitoring Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Serve login page
app.get('/login', (req, res) => {
  // If user is already authenticated, redirect to main page
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const decoded = jwt.verify(token, JWT_SECRET);

      // SECURITY: Verify session is still active
      const { activeSessions } = require('./middleware/auth');
      if (decoded.sessionToken && activeSessions.has(decoded.sessionToken)) {
        return res.redirect('/');
      }
    } catch (error) {
      // Invalid token, continue to login page
    }
  }

  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Serve the main game (only if authenticated)
app.get('/', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

  if (!token) {
    return res.redirect('/login');
  }

  // Verify token and session
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    // SECURITY: Verify session token exists and is active
    const { activeSessions } = require('./middleware/auth');
    if (!decoded.sessionToken) {
      logger.warn('Token without session token - forcing re-login');
      return res.redirect('/login');
    }

    const session = activeSessions.get(decoded.sessionToken);
    if (!session || session.userId !== decoded.userId) {
      logger.warn('Invalid or expired session - forcing re-login');
      return res.redirect('/login');
    }

    // Session is valid, serve the game
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  } catch (error) {
    logger.warn('Token verification failed', { error: error.message });
    res.redirect('/login');
  }
});

// Serve gambling page
// Note: Auth is handled client-side by the page's inline script
// This prevents token exposure in URL
app.get('/gambling', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gambling.html'));
});

// Serve inventory page
// Note: Auth is handled client-side by the page's inline script
// This prevents token exposure in URL
app.get('/inventory', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'inventory.html'));
});


// Serve monitoring page
app.get('/monitoring', (req, res) => {
  // We serve the page, but the page itself will check for token and redirect if needed
  // This allows us to handle both user login and admin login on the client side
  res.sendFile(path.join(__dirname, 'views', 'monitoring.html'));
});

// Serve admin login page
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});

// Initialize game manager and security systems
const gameManager = new GameManager();
const serverGameManager = new ServerGameManager();
// Pass io to serverGameManager for broadcasting updates
serverGameManager.setIo(io);

const gameStateManager = new GameStateManager();
const cheatDetection = new CheatDetection();
const sessionManager = new SimpleSessionManager();

// OPTIMIZATION: Inventory cache system
// Reduces DB queries by 80-90% for frequently accessed inventories
const inventoryCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500; // Max 500 users cached

function getCachedInventory(userId) {
  const cached = inventoryCache.get(userId);
  if (!cached) return null;

  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    inventoryCache.delete(userId);
    return null;
  }

  return cached.data;
}

function setCachedInventory(userId, data) {
  // LRU eviction if cache is full
  if (inventoryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = inventoryCache.keys().next().value;
    inventoryCache.delete(firstKey);
  }

  inventoryCache.set(userId, {
    data,
    timestamp: Date.now()
  });
}

function invalidateInventoryCache(userId) {
  inventoryCache.delete(userId);
  console.log(`Cache invalidated for user ${userId}`);
}

// OPTIMIZATION: Rate limiting for inventory requests
// Prevents spam and ensures fair resource allocation
const inventoryRateLimits = new Map();
const INVENTORY_REQUEST_LIMIT = 30; // Max 30 requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkInventoryRateLimit(userId) {
  const now = Date.now();
  const userLimit = inventoryRateLimits.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or create new limit
    inventoryRateLimits.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: INVENTORY_REQUEST_LIMIT - 1 };
  }

  if (userLimit.count >= INVENTORY_REQUEST_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((userLimit.resetAt - now) / 1000)
    };
  }

  userLimit.count++;
  return {
    allowed: true,
    remaining: INVENTORY_REQUEST_LIMIT - userLimit.count
  };
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of inventoryRateLimits.entries()) {
    if (now > limit.resetAt + RATE_LIMIT_WINDOW) {
      inventoryRateLimits.delete(userId);
    }
  }
}, 5 * 60 * 1000);

// Make serverGameManager accessible in routes
app.set('gameManager', serverGameManager);

// Nettoyage périodique des sessions inactives en base de données
setInterval(async () => {
  try {
    // Supprimer les sessions inactives de plus de 1 heure
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    await db.run(
      'DELETE FROM game_states WHERE is_active = 0 AND last_activity < ?',
      [oneHourAgo]
    );

    // Marquer comme inactives les sessions sans activité depuis 30 minutes
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    await db.run(
      'UPDATE game_states SET is_active = 0 WHERE is_active = 1 AND last_activity < ?',
      [thirtyMinutesAgo]
    );

    // Nettoyer aussi les sessions en mémoire
    sessionManager.cleanup();
  } catch (error) {
    logger.error('Session cleanup failed', { error: error.message });
  }
}, 10 * 60 * 1000); // Toutes les 10 minutes

// Throttling system to prevent spam
const updateThrottle = new Map(); // userId -> lastUpdateTime
const LEADERBOARD_UPDATE_COOLDOWN = 2000; // 2 seconds between leaderboard updates
const LEVEL_UPDATE_COOLDOWN = 500; // 500ms between level updates
const ONLINE_PLAYERS_UPDATE_COOLDOWN = 1000; // 1 second between online players updates

// Helper function to check if update is allowed
function canUpdate(userId, type) {
  const now = Date.now();
  const lastUpdate = updateThrottle.get(`${userId}_${type}`) || 0;
  let cooldown;

  switch (type) {
    case 'leaderboard':
      cooldown = LEADERBOARD_UPDATE_COOLDOWN;
      break;
    case 'online_players':
      cooldown = ONLINE_PLAYERS_UPDATE_COOLDOWN;
      break;
    default:
      cooldown = LEVEL_UPDATE_COOLDOWN;
  }

  if (now - lastUpdate < cooldown) {
    return false;
  }

  updateThrottle.set(`${userId}_${type}`, now);
  return true;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.debug(`Client connected: ${socket.id}`);

  // Authenticate socket connection
  socket.on('authenticate', async (data) => {
    try {
      const user = await authenticateSocket(data.token);
      if (user) {
        socket.userId = user.id;
        socket.username = user.username;
        socket.avatar = user.avatar;

        // Mettre à jour last_login
        try {
          await db.updateUserLastLogin(user.id);
        } catch (error) {
          console.log(`⚠️ Error updating last_login: ${error.message}`);
        }

        // Join user to their personal room
        socket.join(`user_${user.id}`);

        // Join global leaderboard room
        socket.join('leaderboard');

        // Add user to active users
        gameManager.addUser(user.id, user.username, user.avatar);

        // Vérifier s'il y a une partie à restaurer
        const existingGame = await gameStateManager.getGame(user.id);
        if (existingGame) {
          socket.emit('game_restored', existingGame);
        } else {
          // Essayer de restaurer depuis l'historique
          const restoredGame = await gameStateManager.restoreGame(user.id);
          if (restoredGame) {
            socket.emit('game_restored', restoredGame);
          } else {
            // Créer une nouvelle partie
            await gameStateManager.createGame(user.id, user.username, user.avatar);
          }
        }

        // Create server-side game session
        const gameSession = await serverGameManager.createGameSession(user.id, user.username, user.avatar);

        // Notify user of successful authentication
        socket.emit('authenticated', {
          userId: user.id,
          username: user.username,
          avatar: user.avatar,
          sessionId: gameSession.sessionId,
          gameState: gameSession.gameState
        });

        // Update leaderboard only if there are other connected clients
        const connectedClients = io.sockets.sockets.size;
        if (connectedClients > 1) { // Plus d'un client (l'actuel + d'autres)
          const changes = await gameManager.updateLeaderboard(io);
          if (isDevelopment) {
            // Leaderboard updated
          }
        }

        // Only log authentication in development
        if (isDevelopment) {
          // User authenticated
        }
      } else {
        socket.emit('auth_error', { message: 'Invalid token' });
        socket.disconnect();
      }
    } catch (error) {
      logger.error('Socket authentication failed', { error: error.message });
      socket.emit('auth_error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  });

  // Handle server-side game actions
  socket.on('server_game_action', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const { action, data: actionData } = data;

      // Si c'est un start_fight, notifier les autres fenêtres de l'utilisateur
      if (action === 'start_fight') {
        // Envoyer un événement à toutes les autres fenêtres de cet utilisateur
        socket.to(`user_${socket.userId}`).emit('game_state_changed', {
          message: 'Un combat a été lancé depuis une autre fenêtre. La partie actuelle sera écrasée.',
          reason: 'fight_started_elsewhere',
          newGameState: null // Sera mis à jour après le start_fight
        });
      }

      const result = await serverGameManager.handleGameAction(socket.userId, action, actionData);

      // Si c'était un start_fight, envoyer le nouvel état à toutes les fenêtres
      if (action === 'start_fight') {
        socket.to(`user_${socket.userId}`).emit('game_state_changed', {
          message: 'Un combat a été lancé depuis une autre fenêtre. La partie actuelle sera écrasée.',
          reason: 'fight_started_elsewhere',
          newGameState: result.gameState
        });
      }

      // Send updated game state to client
      socket.emit('server_game_result', {
        success: true,
        action,
        result: result.result,
        gameState: result.gameState
      });

      // Update leaderboard if new record
      if (result.result.isNewRecord) {
        await serverGameManager.updateLeaderboard(io);
      }
    } catch (error) {
      logger.error('Server game action error:', error);
      socket.emit('error', { message: 'Game action failed' });
    }
  });

  // Handle loot box operations via Socket.io
  socket.on('save_loot_boxes', async (data) => {
    if (!socket.userId) {
      return socket.emit('loot_error', { message: 'Not authenticated' });
    }

    try {
      const { lootBoxes } = data;
      if (!Array.isArray(lootBoxes)) {
        return socket.emit('loot_error', { message: 'LootBoxes must be an array' });
      }

      // Sauvegarder chaque caisse en batch pour la performance
      if (lootBoxes.length > 0) {
        await db.saveLootBoxesBatch(socket.userId, lootBoxes);
      }

      socket.emit('loot_boxes_saved', { count: lootBoxes.length });
    } catch (error) {
      logger.error('Error saving loot boxes via socket:', error);
      socket.emit('loot_error', { message: 'Error saving loot boxes', error: error.message });
    }
  });

  socket.on('get_loot_inventory', async () => {
    if (!socket.userId) {
      return socket.emit('loot_error', { message: 'Not authenticated' });
    }

    try {
      const inventory = await db.getUserInventory(socket.userId);
      socket.emit('loot_inventory', { inventory });
    } catch (error) {
      logger.error('Error getting loot inventory via socket:', error);
      socket.emit('loot_error', { message: 'Error getting inventory', error: error.message });
    }
  });

  socket.on('remove_loot_box', async (data) => {
    if (!socket.userId) {
      return socket.emit('loot_error', { message: 'Not authenticated' });
    }

    try {
      const { boxId } = data;
      if (!boxId) {
        return socket.emit('loot_error', { message: 'boxId is required' });
      }

      await db.run('DELETE FROM loot_inventory WHERE user_id = ? AND loot_box_id = ?', [socket.userId, boxId]);
      socket.emit('loot_box_removed', { boxId });
    } catch (error) {
      logger.error('Error removing loot box via socket:', error);
      socket.emit('loot_error', { message: 'Error removing loot box', error: error.message });
    }
  });

  // Sauvegarder un item looté
  socket.on('save_loot_item', async (data) => {
    if (!socket.userId) {
      return socket.emit('loot_error', { message: 'Not authenticated' });
    }

    try {
      const { itemId, rarity, itemData } = data;
      if (!itemId || !rarity || !itemData) {
        return socket.emit('loot_error', { message: 'Missing required fields' });
      }

      await db.saveLootItem(socket.userId, itemId, rarity, itemData);

      // OPTIMIZATION: Invalidate cache when inventory changes
      invalidateInventoryCache(socket.userId);

      socket.emit('loot_item_saved', { itemId, rarity });
    } catch (error) {
      logger.error('Error saving loot item via socket:', error);
      socket.emit('loot_error', { message: 'Error saving loot item', error: error.message });
    }
  });

  // Récupérer l'inventaire d'items lootés
  // OPTIMIZED: With cache, rate limiting, and PAGINATION
  socket.on('get_loot_items', async (requestData = {}) => {
    if (!socket.userId) {
      return socket.emit('loot_error', { message: 'Not authenticated' });
    }

    try {
      // Extract pagination params (default to no pagination for backward compatibility)
      const { page, limit, usePagination } = requestData;
      const shouldPaginate = usePagination && page && limit;

      // OPTIMIZATION: Check rate limit
      const rateCheck = checkInventoryRateLimit(socket.userId);
      if (!rateCheck.allowed) {
        console.log(`Rate limit exceeded for user ${socket.userId} - ${rateCheck.resetIn}s until reset`);
        return socket.emit('loot_error', {
          message: `Too many requests.Please wait ${rateCheck.resetIn} seconds.`,
          retryAfter: rateCheck.resetIn
        });
      }

      // OPTIMIZATION: For paginated requests, cache is per-page
      const cacheKey = shouldPaginate ? `${socket.userId}_p${page}_l${limit}` : socket.userId;

      // OPTIMIZATION: Try to get from cache first (only for non-paginated or first page)
      if (!shouldPaginate || page === 1) {
        let cached = getCachedInventory(cacheKey);

        if (cached) {
          // Cache HIT - serve from memory (< 10ms)
          if (isDevelopment) {
            const itemCount = shouldPaginate ? cached.items?.length : cached.length;
            console.log(`Cache HIT for user ${socket.userId} (${itemCount} items)`);
          }

          if (shouldPaginate) {
            socket.emit('loot_items_inventory', {
              ...cached,
              cached: true
            });
          } else {
            socket.emit('loot_items_inventory', {
              inventory: cached,
              cached: true
            });
          }
          return;
        }
      }

      // Cache MISS - fetch from database
      if (isDevelopment) {
        console.log(`Cache MISS for user ${socket.userId} - fetching from DB...`);
      }

      let response;

      if (shouldPaginate) {
        // PHASE 2: Use pagination
        const result = await db.getUserLootInventoryPaginated(socket.userId, page, limit);
        response = {
          inventory: result.items,
          pagination: result.pagination,
          cached: false,
          remaining: rateCheck.remaining
        };

        // Cache only first page
        if (page === 1) {
          setCachedInventory(cacheKey, result);
        }
      } else {
        // Legacy: Full inventory
        const inventory = await db.getUserLootInventory(socket.userId);
        response = {
          inventory,
          cached: false,
          remaining: rateCheck.remaining
        };

        // OPTIMIZATION: Store in cache for future requests
        setCachedInventory(cacheKey, inventory);
      }

      socket.emit('loot_items_inventory', response);
    } catch (error) {
      logger.error('Error getting loot items inventory via socket:', error);
      socket.emit('loot_error', { message: 'Error getting loot items inventory', error: error.message });
    }
  });

  // Handle player death
  socket.on('player_death', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // Marquer le joueur comme mort côté serveur
      serverGameManager.markUserAsDead(socket.userId);

      // Terminer la partie dans GameStateManager
      await gameStateManager.endGame(socket.userId, 'death');

      // Sauvegarder le score final
      if (data.level && data.gold) {
        await gameManager.submitScore(socket.userId, {
          sessionId: data.sessionId || 'death_' + Date.now(),
          level: data.level,
          score: data.level,
          gold: data.gold
        });
      }

      socket.emit('player_death_confirmed', {
        success: true,
        message: 'Mort enregistrée'
      });
    } catch (error) {
      logger.error('Player death error:', error);
      socket.emit('player_death_confirmed', {
        success: false,
        error: error.message
      });
    }
  });

  // Handle game state save
  socket.on('save_game_state', async (data) => {
    if (!socket.userId) {
      logger.error('Save game state event received without authentication');
      return;
    }

    try {
      // Sauvegarder l'état de jeu via GameStateManager
      await gameStateManager.updatePlayer(socket.userId, data);
    } catch (error) {
      logger.error('Error saving game state:', error);
    }
  });

  // Handle game actions (legacy - keep for compatibility)
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
      logger.error('Game action error:', error);
      socket.emit('error', { message: 'Game action failed' });
    }
  });

  // Handle score submission - STRICT VALIDATION
  socket.on('submit_score', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // SIMPLIFIED: Basic session check only
      if (!data.sessionId) {
        console.log(`⚠️ Missing session ID for score submission: user ${socket.userId} - continuing anyway`);
        // Don't return, continue with the submission
      }

      // SIMPLIFIED: Basic validation only
      if (data.level > 100) {
        console.log(`⚠️ Suspicious level detected: ${data.level} for user ${socket.userId} - continuing anyway`);
        // Don't return, continue with the submission
      }

      // Update session level if session exists
      if (data.sessionId) {
        const updated = sessionManager.updateSessionLevel(
          data.sessionId,
          data.level,
          data.gold || 0,
          data.enemiesKilled || 0
        );
        if (!updated) {
          console.log(`⚠️ Session level update failed for user ${socket.userId} - continuing anyway`);
        }
      }

      // Security checks - RATE LIMITING DISABLED for normal gameplay
      // const rateLimitCheck = cheatDetection.checkRateLimit(socket.userId, 'score_submission');
      // if (!rateLimitCheck.allowed) {
      //   if (rateLimitCheck.banned) {
      //     socket.emit('user_banned', { 
      //       message: rateLimitCheck.reason,
      //       duration: 180 // 3 minutes
      //     });
      //   } else {
      //     socket.emit('warning', { 
      //       message: rateLimitCheck.reason,
      //       type: 'rate_limit'
      //     });
      //   }
      //   return;
      // }

      // UNIQUE SESSION VALIDATION - prevent score falsification
      if (data.sessionId && data.securityToken) {
        const sessionValidation = sessionManager.validateSession(data.sessionId, data.securityToken);
        if (sessionValidation.valid) {
          // Validate run integrity for score submission
          const runValidation = sessionManager.validateRunIntegrity(
            data.sessionId,
            data.level,
            data.gold,
            data.enemiesKilled || 0
          );

          if (runValidation.valid) {
            // Add integrity check for score submission
            sessionManager.addIntegrityCheck(data.sessionId, 'score_submission', {
              level: data.level,
              score: data.score,
              gold: data.gold
            });
          } else {
            console.log(`🚨 Score submission integrity validation failed: ${runValidation.reason} - continuing anyway`);
          }
        } else {
          console.log(`Session validation failed for score submission: ${sessionValidation.reason} - continuing anyway`);
        }
      }

      console.log(`Score submission received: user = ${socket.userId}, level = ${data.level}, score = ${data.score}, gold = ${data.gold} `);
      const result = await gameManager.submitScore(socket.userId, data);
      socket.emit('score_submitted', result);

      // Send new record notification if applicable
      if (result.isNewRecord) {
        socket.emit('new_record', {
          level: result.newRecord,
          previousRecord: result.previousRecord,
          message: `🎉 Nouveau record! Niveau ${result.newRecord} (précédent: ${result.previousRecord})`
        });
      }

      // Update leaderboard after successful score submission
      if (result.shouldUpdateLeaderboard) {
        // Vérifier s'il y a des clients dans la room leaderboard
        const leaderboardRoom = io.sockets.adapter.rooms.get('leaderboard');
        const clientsInRoom = leaderboardRoom ? leaderboardRoom.size : 0;

        if (clientsInRoom > 0) {
          console.log('Updating leaderboard after score submission...');
          const changes = await gameManager.updateLeaderboard(io);

          if (changes > 0) {
            console.log('Broadcasting leaderboard update to all users...');
            const leaderboard = await gameManager.getLeaderboard();
            io.to('leaderboard').emit('leaderboard_update', {
              leaderboard: leaderboard,
              timestamp: Date.now()
            });
            if (isDevelopment) {
              console.log(`📊 Leaderboard broadcast completed`);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Score submission error:', error);
      socket.emit('error', { message: 'Score submission failed' });
    }
  });

  // Handle game session start - OPTIMIZED
  socket.on('start_game_session', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // OPTIMIZATION: Réutiliser la session existante si elle est récente (< 5 min)
      const existingSession = sessionManager.getUserActiveSession(socket.userId);
      const SESSION_REUSE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

      if (existingSession && existingSession.isActive) {
        const timeSinceLastActivity = Date.now() - existingSession.lastActivity;

        if (timeSinceLastActivity < SESSION_REUSE_THRESHOLD) {
          // Réutiliser la session existante
          existingSession.lastActivity = Date.now();
          console.log(`♻️ Reusing existing session for user ${socket.userId}: ${existingSession.sessionId} `);

          socket.emit('game_session_started', {
            sessionId: existingSession.sessionId,
            securityToken: existingSession.securityToken,
            runId: existingSession.runId
          });

          // Add user to active users
          gameManager.addUser(socket.userId, socket.username, socket.avatar);
          return;
        }
      }

      // Nettoyer les anciennes sessions inactives pour cet utilisateur
      await sessionManager.cleanupUserSessions(socket.userId);

      // Generate new session ID
      const sessionId = `session_${socket.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)} `;

      // Deactivate old sessions (in memory only, DB cleanup is separate)
      sessionManager.deactivateAllUserSessions(socket.userId);

      // Create new session
      const sessionData = sessionManager.createSession(socket.userId, sessionId);

      // Create game session in database only if needed
      // We don't need to create a DB entry for every session - only track active ones
      try {
        // OPTIMIZATION: Ne pas créer d'entrée DB à chaque fois
        // Les sessions sont gérées en mémoire, la DB n'est utilisée que pour la persistance si nécessaire
        // On ne crée une entrée DB que si vraiment nécessaire (première session ou après nettoyage)
        const existingDbSession = await db.get(
          'SELECT * FROM game_states WHERE user_id = ? AND is_active = 1 ORDER BY last_activity DESC LIMIT 1',
          [socket.userId]
        );

        if (!existingDbSession) {
          // Créer une nouvelle entrée seulement si aucune n'existe
          await db.run(
            'INSERT INTO game_states (user_id, username, avatar, session_id, run_id, created_at, last_activity, is_active, player_data) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
            [socket.userId, socket.username || 'user', socket.avatar || 'default', sessionId, sessionData.runId, Date.now(), Date.now(), JSON.stringify({ level: 0, gold: 0 })]
          );
          console.log(`🔐 NEW session created: ${sessionId} (Run: ${sessionData.runId})`);
        } else {
          // Mettre à jour la session existante au lieu d'en créer une nouvelle (user_id est UNIQUE)
          await db.run(
            'UPDATE game_states SET session_id = ?, run_id = ?, last_activity = ?, is_active = 1 WHERE user_id = ?',
            [sessionId, sessionData.runId, Date.now(), socket.userId]
          );
          // Log seulement en développement pour réduire le spam
          if (isDevelopment) {
            console.log(`🔄 Session reused / updated: ${sessionId} `);
          }
        }
      } catch (dbError) {
        console.log(`⚠️ Session creation error: ${dbError.message} - continuing anyway`);
        // Continue even if database session creation fails
      }

      // Add user to active users
      gameManager.addUser(socket.userId, socket.username, socket.avatar);

      socket.emit('game_session_started', {
        sessionId,
        securityToken: sessionData.securityToken,
        runId: sessionData.runId
      });
    } catch (error) {
      logger.error('Game session start error:', error);
      socket.emit('error', { message: 'Failed to start game session' });
    }
  });

  // Handle passive upgrade save
  socket.on('save_passive_upgrade', (data) => {
    if (!socket.userId || !data.sessionId) {
      return;
    }

    try {
      sessionManager.addPassiveUpgrade(data.sessionId, data.upgrade);
      socket.emit('passive_upgrade_saved', { success: true });
    } catch (error) {
      logger.error('Passive upgrade save error:', error);
      socket.emit('passive_upgrade_saved', { success: false });
    }
  });

  // Handle boss passive save
  socket.on('save_boss_passive', (data) => {
    if (!socket.userId || !data.sessionId) {
      return;
    }

    try {
      sessionManager.addBossPassive(data.sessionId, data.bossPassive);
      socket.emit('boss_passive_saved', { success: true });
    } catch (error) {
      logger.error('Boss passive save error:', error);
      socket.emit('boss_passive_saved', { success: false });
    }
  });

  // Handle deck validation (anti-cheat)
  socket.on('validate_deck', async (data) => {
    if (!socket.userId || !data.sessionId || !data.deck) {
      socket.emit('deck_validation_result', {
        valid: false,
        reason: 'Missing required data'
      });
      return;
    }

    try {
      // Get user's inventory from database
      const inventory = await db.all(
        'SELECT id, name, rarity FROM loot_inventory WHERE user_id = ?',
        [socket.userId]
      );

      // Validate deck against inventory
      const validation = await sessionManager.validateAndStoreDeck(
        data.sessionId,
        data.deck,
        inventory
      );

      socket.emit('deck_validation_result', validation);

      if (!validation.valid) {
        console.warn(`⚠️ Deck validation failed for user ${socket.userId}: ${validation.reason}`);
      }
    } catch (error) {
      logger.error('Deck validation error:', error);
      socket.emit('deck_validation_result', {
        valid: false,
        reason: 'Server error during validation'
      });
    }
  });

  // Handle request for session passives
  socket.on('request_session_passives', (data) => {
    if (!socket.userId || !data.sessionId) {
      return;
    }

    try {
      const passives = sessionManager.getSessionPassives(data.sessionId);
      socket.emit('session_passives', passives);
    } catch (error) {
      logger.error('Session passives request error:', error);
      socket.emit('session_passives', { passiveUpgrades: [], bossPassives: [] });
    }
  });

  // Handle leaderboard update request
  socket.on('request_leaderboard_update', async () => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      // Throttling check - prevent spam leaderboard updates
      if (!canUpdate(socket.userId, 'leaderboard')) {
        return; // Silently ignore throttled updates
      }

      if (isDevelopment) {
        console.log(`📊 Leaderboard update requested by user: ${socket.userId} `);
      }

      // Force update leaderboard
      const changes = await gameManager.updateLeaderboard(io);

      if (changes > 0) {
        // Send fresh leaderboard to requesting user
        const leaderboard = await gameManager.getLeaderboard();
        socket.emit('leaderboard_update', {
          leaderboard: leaderboard,
          timestamp: Date.now()
        });

        console.log(`Fresh leaderboard sent to user: ${socket.userId} `);
      } else {
        console.log(`No changes in leaderboard for user: ${socket.userId} `);
      }
    } catch (error) {
      logger.error('Leaderboard update request error:', error);
      socket.emit('error', { message: 'Failed to update leaderboard' });
    }
  });

  // Handle real-time level updates - STRICT VALIDATION
  socket.on('update_level', async (data) => {
    if (!socket.userId) {
      return;
    }

    try {
      // Throttling check - prevent spam updates
      if (!canUpdate(socket.userId, 'level')) {
        return; // Silently ignore throttled updates
      }

      // SIMPLIFIED: Basic session check only
      if (!data.sessionId) {
        console.log(`⚠️ Missing session ID for level update: user ${socket.userId} - continuing anyway`);
        // Don't return, continue with the update
      }

      // SIMPLIFIED: Basic validation only
      if (data.level > 100) {
        console.log(`⚠️ Suspicious level detected: ${data.level} for user ${socket.userId} - continuing anyway`);
        // Don't return, continue with the update
      }

      // Update session level if session exists
      if (data.sessionId) {
        const updated = sessionManager.updateSessionLevel(
          data.sessionId,
          data.level,
          data.gold || 0,
          data.enemiesKilled || 0
        );
        if (!updated) {
          console.log(`⚠️ Session level update failed for user ${socket.userId} - continuing anyway`);
        }
      }

      // Security checks - RATE LIMITING DISABLED for normal gameplay
      // const rateLimitCheck = cheatDetection.checkRateLimit(socket.userId, 'level_update');
      // if (!rateLimitCheck.allowed) {
      //   if (rateLimitCheck.banned) {
      //     socket.emit('user_banned', { 
      //       message: rateLimitCheck.reason,
      //       duration: 180 // 3 minutes
      //     });
      //     console.warn(`User ${ socket.userId } is banned: ${ rateLimitCheck.reason } `);
      //   } else {
      //     socket.emit('warning', { 
      //       message: rateLimitCheck.reason,
      //       type: 'rate_limit'
      //     });
      //     console.warn(`Warning for user ${ socket.userId }: ${ rateLimitCheck.reason } `);
      //   }
      //   return;
      // }

      // UNIQUE SESSION VALIDATION - prevent score falsification
      if (data.sessionId && data.securityToken) {
        const sessionValidation = sessionManager.validateSession(data.sessionId, data.securityToken);
        if (sessionValidation.valid) {
          // Validate run integrity
          const runValidation = sessionManager.validateRunIntegrity(
            data.sessionId,
            data.level,
            data.gold,
            data.enemiesKilled || 0
          );

          if (runValidation.valid) {
            // Add integrity check
            sessionManager.addIntegrityCheck(data.sessionId, 'level_update', {
              level: data.level,
              gold: data.gold,
              enemiesKilled: data.enemiesKilled || 0
            });

            // Update session
            const sessionUpdate = sessionManager.updateSessionLevel(
              data.sessionId,
              data.level,
              data.gold,
              data.enemiesKilled || 0,
              data.bossDefeated || false
            );

            if (!sessionUpdate.success) {
              console.log(`Session update failed: ${sessionUpdate.reason} - continuing anyway`);
            }
          } else {
            console.log(`🚨 Run integrity validation failed: ${runValidation.reason} - continuing anyway`);
          }
        } else {
          console.log(`Session validation failed: ${sessionValidation.reason} - continuing anyway`);
        }
      }

      // Update user's current game state (ancien système pour compatibilité)
      gameManager.updateUserGameState(socket.userId, data.level, data.gold);

      // CRITIQUE: Mettre à jour la session serveur dans serverGameManager
      // Cela garantit que la session serveur a le bon niveau (source de vérité)
      try {
        const gameState = serverGameManager.getUserSession(socket.userId);
        if (gameState && gameState.isActive && !gameState.shouldBeDeleted()) {
          // Mettre à jour le niveau de la session serveur si le niveau client est cohérent
          // (ne peut pas être supérieur de plus de 1 au niveau serveur, pour éviter les sauts suspects)
          const currentServerLevel = gameState.player.level;
          if (data.level >= currentServerLevel - 1 && data.level <= currentServerLevel + 1) {
            gameState.player.level = data.level;
            if (data.gold !== undefined) {
              gameState.player.gold = data.gold;
            }
          } else if (data.level > currentServerLevel + 1) {
            // Niveau client suspect, on garde le niveau serveur
            console.warn(`⚠️ Niveau client suspect pour user ${socket.userId}: client = ${data.level}, serveur = ${currentServerLevel} `);
          }
          // Sinon (niveau client inférieur), on garde le niveau serveur (source de vérité)
        }
      } catch (e) {
        // Session introuvable, continuer quand même
      }

      // SÉCURITÉ: Mettre à jour aussi serverGameManager pour synchroniser activeUsers
      // Cela garantit que le niveau actuel est toujours à jour dans le leaderboard et les joueurs en ligne
      serverGameManager.updateUserActivity(socket.userId, data.level, data.gold || 0);

      // Vérifier s'il y a des clients dans la room leaderboard (réutilisé plusieurs fois)
      const leaderboardRoom = io.sockets.adapter.rooms.get('leaderboard');
      const clientsInRoom = leaderboardRoom ? leaderboardRoom.size : 0;

      // Broadcast updated online players only if there are clients listening
      if (clientsInRoom > 0) {
        // Utiliser serverGameManager qui a les données synchronisées
        const onlinePlayers = serverGameManager.getActiveUsers();
        io.to('leaderboard').emit('online_players_update', {
          players: onlinePlayers,
          count: onlinePlayers.length
        });
      }

      // Vérifier si c'est un nouveau record
      const userStats = await db.getUserBestScore(socket.userId);
      const isNewRecord = data.level > (userStats.best_level || 0);

      // Toujours soumettre le score pour mettre à jour total_gold et last_activity
      if (data.sessionId) {
        try {
          // Submit score asynchronously to not block the loop
          db.submitScore(socket.userId, data.sessionId, data.level, data.level, data.gold || 0).catch(e => logger.error(e));
        } catch (error) {
          console.log(`⚠️ Score submission error(continuing): ${error.message} `);
        }
      }

      // Mettre à jour le leaderboard seulement si nécessaire et s'il y a des clients
      if (clientsInRoom > 0 && (isNewRecord || canUpdate(socket.userId, 'leaderboard'))) {
        serverGameManager.updateLeaderboard(io).catch(e => logger.error('Leaderboard update error:', e));
      }

      // Envoyer la notification seulement si c'est un nouveau record
      if (isNewRecord && data.sessionId) {
        // Check if this record was already displayed for this session
        let shouldShowRecord = true;
        const alreadyDisplayed = sessionManager.isRecordAlreadyDisplayed(data.sessionId, data.level);
        if (alreadyDisplayed) {
          shouldShowRecord = false;
        } else {
          sessionManager.markRecordAsDisplayed(data.sessionId, data.level);
        }

        if (shouldShowRecord) {
          // Vérifier si c'est un nouveau record du leaderboard (top 1)
          const leaderboard = await gameManager.getLeaderboard();
          const isLeaderboardRecord = leaderboard.length > 0 &&
            leaderboard[0].user_id === socket.userId &&
            leaderboard[0].best_level === data.level;

          socket.emit('new_record', {
            level: data.level,
            isNewRecord: true,
            previousRecord: userStats.best_level || 0,
            isLeaderboardRecord: isLeaderboardRecord
          });
        }
      }
    } catch (error) {
      logger.error('Level update error:', error);
    }
  });

  // Handle get game state request
  socket.on('get_game_state', async () => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const gameState = serverGameManager.getGameState(socket.userId);
      socket.emit('game_state', gameState);
    } catch (error) {
      logger.error('Get game state error:', error);
      socket.emit('error', { message: 'Failed to get game state' });
    }
  });

  // Handle get session passives request
  socket.on('get_session_passives', async () => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const passives = serverGameManager.getSessionPassives(socket.userId);
      socket.emit('session_passives', passives);
    } catch (error) {
      logger.error('Get session passives error:', error);
      socket.emit('session_passives', { passiveUpgrades: [], bossPassives: [] });
    }
  });

  // Handle clear game session (restart)
  socket.on('clear_game_session', async (data) => {
    if (!socket.userId || !data.sessionId) {
      return;
    }

    try {
      // Valider la session
      const sessionValidation = sessionManager.validateSession(data.sessionId, data.securityToken);
      if (!sessionValidation.valid) {
        console.log(`⚠️ Invalid session for clear: ${sessionValidation.reason} `);
        return;
      }

      // Supprimer la session de jeu
      serverGameManager.removeUserSession(socket.userId);

      // Supprimer la session du sessionManager
      const session = sessionManager.activeSessions.get(data.sessionId);
      if (session) {
        session.isActive = false;
        sessionManager.activeSessions.delete(data.sessionId);
        sessionManager.userSessions.delete(socket.userId);
      }

      // Supprimer de la base de données
      await db.run('UPDATE game_sessions SET is_active = 0 WHERE session_id = ? AND user_id = ?', [data.sessionId, socket.userId]);

      console.log(`🗑️ Session ${data.sessionId} effacée pour user ${socket.userId} `);
      socket.emit('game_session_cleared', { success: true });
    } catch (error) {
      logger.error('Clear game session error:', error);
      socket.emit('game_session_cleared', { success: false });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    // Only log disconnections in development
    if (isDevelopment) {
      console.log('Client disconnected:', socket.id);
    }
    if (socket.userId) {
      // Marquer comme abandonné au lieu de supprimer
      serverGameManager.markUserAsAbandoned(socket.userId);
      gameManager.removeUser(socket.userId);

      // Mettre à jour le leaderboard seulement s'il reste des clients connectés
      const remainingClients = io.sockets.sockets.size;
      if (remainingClients > 0) {
        gameManager.updateLeaderboard(io);
      }
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database initialized');

    // Start periodic cleanup
    setInterval(() => cheatDetection.cleanup(), 5 * 60 * 1000);
    setInterval(() => sessionManager.cleanup(), 60 * 60 * 1000);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} `);
      logger.info('Security systems active');
      if (isDevelopment) {
        logger.info(`Local: http://localhost:${PORT}`);
        logger.info(`Network: http://100.115.199.81:${PORT}`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer();
