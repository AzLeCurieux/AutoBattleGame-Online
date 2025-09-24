const jwt = require('jsonwebtoken');
const { db } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

    // Update user online status
    await db.setUserOnline(user.id, true);
    await db.updateUserLastLogin(user.id);

    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar
    };

  } catch (error) {
    console.error('Socket authentication error:', error);
    return null;
  }
}

// Authenticate HTTP request
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
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
      console.error('Permission check error:', error);
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
      console.error('Activity logging error:', error);
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
  logActivity
};
