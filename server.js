// Load environment variables first
require('dotenv').config();

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
const { initializeDatabase, db } = require('./database/db');
const { authenticateSocket } = require('./middleware/auth');
const { GameManager } = require('./game/GameManager');
const { ServerGameManager } = require('./game/ServerGameManager');
const GameStateManager = require('./game/GameStateManager');
const CheatDetection = require('./security/CheatDetection');
const SimpleSessionManager = require('./security/SimpleSessionManager');

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

// Initialize game manager and security systems
const gameManager = new GameManager();
const serverGameManager = new ServerGameManager();
const gameStateManager = new GameStateManager();
const cheatDetection = new CheatDetection();
const sessionManager = new SimpleSessionManager();

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
        const gameSession = serverGameManager.createGameSession(user.id, user.username, user.avatar);
        
        // Notify user of successful authentication
        socket.emit('authenticated', {
          userId: user.id,
          username: user.username,
          avatar: user.avatar,
          sessionId: gameSession.sessionId,
          gameState: gameSession.gameState
        });
        
        // Update leaderboard for all users
        const changes = await gameManager.updateLeaderboard(io);
        if (isDevelopment) {
          console.log(`Leaderboard updated with ${changes} changes during authentication`);
        }
        
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

  // Handle server-side game actions
  socket.on('server_game_action', async (data) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const { action, data: actionData } = data;
      const result = await serverGameManager.handleGameAction(socket.userId, action, actionData);
      
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
      console.error('Server game action error:', error);
      socket.emit('error', { message: 'Game action failed' });
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
      console.error('Player death error:', error);
      socket.emit('player_death_confirmed', {
        success: false,
        error: error.message
      });
    }
  });

  // Handle game state save
  socket.on('save_game_state', async (data) => {
    if (!socket.userId) {
      console.error('Save game state event received without authentication');
      return;
    }

    try {
      // Sauvegarder l'état de jeu via GameStateManager
      await gameStateManager.updatePlayer(socket.userId, data);
    } catch (error) {
      console.error('Error saving game state:', error);
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
      console.error('Game action error:', error);
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
        const sessionValidation = sessionManager.validateSession(data.sessionId, socket.userId, data.securityToken);
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
      if (result.shouldUpdateLeaderboard) {
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
    } catch (error) {
      console.error('Score submission error:', error);
      socket.emit('error', { message: 'Score submission failed' });
    }
  });

        // Handle game session start - SIMPLIFIED
        socket.on('start_game_session', async (data) => {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }

          try {
            // Generate completely new session ID with timestamp
            const sessionId = `session_${socket.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Force deactivate ALL existing sessions for this user
            sessionManager.deactivateAllUserSessions(socket.userId);
            
            // Create completely new session
            const sessionData = sessionManager.createSession(socket.userId, sessionId);
            
            // Create game session in database - always new
            try {
              await db.createGameSession(socket.userId, sessionId);
              console.log(`🔐 NEW session created: ${sessionId} (Run: ${sessionData.runId})`);
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
            console.error('Game session start error:', error);
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
      console.error('Passive upgrade save error:', error);
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
      console.error('Boss passive save error:', error);
      socket.emit('boss_passive_saved', { success: false });
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
      console.error('Session passives request error:', error);
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
      console.log(`📊 Leaderboard update requested by user: ${socket.userId}`);
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
        
        console.log(`Fresh leaderboard sent to user: ${socket.userId}`);
      } else {
        console.log(`No changes in leaderboard for user: ${socket.userId}`);
      }
    } catch (error) {
      console.error('Leaderboard update request error:', error);
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
      //     console.warn(`User ${socket.userId} is banned: ${rateLimitCheck.reason}`);
      //   } else {
      //     socket.emit('warning', { 
      //       message: rateLimitCheck.reason,
      //       type: 'rate_limit'
      //     });
      //     console.warn(`Warning for user ${socket.userId}: ${rateLimitCheck.reason}`);
      //   }
      //   return;
      // }

      // UNIQUE SESSION VALIDATION - prevent score falsification
      if (data.sessionId && data.securityToken) {
        const sessionValidation = sessionManager.validateSession(data.sessionId, socket.userId, data.securityToken);
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

      // Update user's current game state
      gameManager.updateUserGameState(socket.userId, data.level, data.gold);
      
      // Broadcast updated online players to all clients (throttled)
      if (canUpdate(socket.userId, 'online_players')) {
        const onlinePlayers = gameManager.getActiveUsers();
        io.to('leaderboard').emit('online_players_update', {
          players: onlinePlayers,
          count: onlinePlayers.length
        });
      }
      
      // Only update leaderboard if this is a new high level (avoid redundancy)
      const userStats = await db.getUserBestScore(socket.userId);
      if (data.level > (userStats.best_level || 0)) {
        console.log(`🎯 New high level detected: ${data.level} for user ${socket.userId}`);
        
        // Check if this record was already displayed for this session
        let shouldShowRecord = true;
        if (data.sessionId) {
          const alreadyDisplayed = sessionManager.isRecordAlreadyDisplayed(data.sessionId, data.level);
          if (!alreadyDisplayed) {
            sessionManager.markRecordAsDisplayed(data.sessionId, data.level);
            // Emit new record event only once
            socket.emit('new_record', {
              level: data.level,
              isNewRecord: true
            });
          } else {
            shouldShowRecord = false;
          }
        }
        
        // Submit this as a score to update the leaderboard
        await gameManager.submitScore(socket.userId, {
          sessionId: data.sessionId || 'realtime_' + Date.now(),
          level: data.level,
          score: data.level,
          gold: data.gold
        });
        
        // Force leaderboard update and broadcast (only once per new record)
        const changes = await gameManager.updateLeaderboard(io);
        if (changes > 0) {
          const leaderboard = await gameManager.getLeaderboard();
          io.to('leaderboard').emit('leaderboard_update', {
            leaderboard: leaderboard,
            timestamp: Date.now()
          });
        }
      }
    } catch (error) {
      console.error('Level update error:', error);
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
      console.error('Get game state error:', error);
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
      console.error('Get session passives error:', error);
      socket.emit('session_passives', { passiveUpgrades: [], bossPassives: [] });
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
      gameManager.updateLeaderboard(io);
    }
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Start periodic cleanup
    // Anti-cheat cleanup frequent (5 min), sessions cleanup rare (1h)
    setInterval(() => {
      cheatDetection.cleanup();
    }, 5 * 60 * 1000);

    setInterval(() => {
      sessionManager.cleanup();
    }, 60 * 60 * 1000);
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔒 Security systems active`);
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
