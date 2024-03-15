const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../database/db');
const logger = require('../utils/logger');

// SECURITY: JWT_SECRET must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set. Server cannot start.');
}

// In-memory storage for active sessions with user context
// sessionToken -> { userId, username, ip, userAgent, createdAt, lastActivity }
const activeSessions = new Map();

// Helper: Generate session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Hash IP + UserAgent for comparison
function hashClientInfo(ip, userAgent) {
  return crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex');
}

// Helper: Validate session belongs to same client
function validateSessionClient(session, req) {
  const currentHash = hashClientInfo(
    req.ip || req.connection?.remoteAddress || 'unknown',
    req.headers['user-agent'] || 'unknown'
  );
  return session.clientHash === currentHash;
}

// Create new session for user (revokes old sessions)
async function createUserSession(userId, username, req) {
  // Revoke ALL existing sessions for this user (only one active session per user)
  for (const [sessionToken, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(sessionToken);
      logger.debug('Session revoked', { userId });
    }
  }

  // Create new session
  const sessionToken = generateSessionToken();
  const clientHash = hashClientInfo(
    req.ip || req.connection?.remoteAddress || 'unknown',
    req.headers['user-agent'] || 'unknown'
  );

  activeSessions.set(sessionToken, {
    userId,
    username,
    clientHash,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    createdAt: Date.now(),
    lastActivity: Date.now()
  });

  logger.info('Session created', { userId, username });
  return sessionToken;
}

// Revoke user session
function revokeUserSession(sessionToken) {
  const session = activeSessions.get(sessionToken);
  if (session) {
    activeSessions.delete(sessionToken);
    logger.debug('Session revoked');
    return true;
  }
  return false;
}

// Cleanup old sessions (called periodically)
function cleanupSessions() {
  const now = Date.now();
  const MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  const MAX_INACTIVITY = 24 * 60 * 60 * 1000; // 24 hours inactivity

  let cleaned = 0;
  for (const [sessionToken, session] of activeSessions.entries()) {
    if (now - session.createdAt > MAX_SESSION_AGE ||
        now - session.lastActivity > MAX_INACTIVITY) {
      activeSessions.delete(sessionToken);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info('Expired sessions cleaned', { count: cleaned });
  }
}

// Authenticate socket connection
async function authenticateSocket(token) {
  try {
    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserById(decoded.userId);

    if (!user) {
      return null;
    }

    // CRITICAL: Validate session token exists and is active
    if (decoded.sessionToken) {
      const session = activeSessions.get(decoded.sessionToken);
      if (!session || session.userId !== decoded.userId) {
        logger.warn('Invalid session token', { userId: decoded.userId });
        return null;
      }

      // Update session activity
      session.lastActivity = Date.now();
    }

    // Update user online status
    await db.setUserOnline(user.id, true);
    await db.updateUserLastLogin(user.id);

    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar
    };

  } catch (error) {
    logger.error('Socket authentication failed', { error: error.message });
    return null;
  }
}

// Authenticate HTTP request with strict session validation
function authenticateToken(req, res, next) {
  // Chercher le token dans les headers Authorization ou dans les query parameters
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // CRITICAL: Validate session token exists and is active
    if (decoded.sessionToken) {
      const session = activeSessions.get(decoded.sessionToken);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid'
        });
      }

      if (session.userId !== decoded.userId) {
        logger.warn('Session userId mismatch');
        return res.status(401).json({
          success: false,
          message: 'Invalid session'
        });
      }

      // CRITICAL: Validate request comes from same client (IP + User-Agent)
      if (!validateSessionClient(session, req)) {

        // Revoke the session immediately
        activeSessions.delete(decoded.sessionToken);

        return res.status(401).json({
          success: false,
          message: 'Session validation failed - possible session hijacking detected'
        });
      }

      // Update session activity
      session.lastActivity = Date.now();
    } else {
      // Old token without sessionToken - force re-login
      return res.status(401).json({
        success: false,
        message: 'Token format invalid - please login again'
      });
    }

    // Normaliser req.user pour avoir à la fois .id et .userId
    req.user = {
      ...decoded,
      id: decoded.userId // Ajouter .id pour compatibilité
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

// Optional authentication (doesn't fail if no token)
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Token is invalid, but we continue without user
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
}

// Rate limiting for authentication attempts
function createAuthRateLimit() {
  const attempts = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;

    if (!attempts.has(ip)) {
      attempts.set(ip, []);
    }

    const userAttempts = attempts.get(ip);
    
    // Remove old attempts
    const recentAttempts = userAttempts.filter(time => now - time < windowMs);
    attempts.set(ip, recentAttempts);

    if (recentAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
      });
    }

    // Add current attempt
    recentAttempts.push(now);
    attempts.set(ip, recentAttempts);

    next();
  };
}

// Validate user permissions
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await db.getUserById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // For now, we'll implement basic permission checking
      // In a real application, you'd have a more sophisticated permission system
      if (permission === 'admin' && user.username !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin permission required'
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check failed', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
}

// Log user activity
function logActivity(action) {
  return async (req, res, next) => {
    try {
      if (req.user) {
        await db.run(
          'INSERT INTO user_activity (user_id, action, ip_address, timestamp) VALUES (?, ?, ?, ?)',
          [req.user.userId, action, req.ip, new Date().toISOString()]
        );
      }
      next();
    } catch (error) {
      // Activity logging error silently ignored
      // Don't fail the request if logging fails
      next();
    }
  };
}

module.exports = {
  authenticateSocket,
  authenticateToken,
  optionalAuth,
  createAuthRateLimit,
  requirePermission,
  logActivity,
  createUserSession,
  revokeUserSession,
  cleanupSessions,
  activeSessions
};
