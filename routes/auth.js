const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Validation middleware
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Change username - allowed once per 7 days (account identifier)
const validateChangeUsername = [
  body('newUsername')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
];

// Update avatar validation: allow preset keywords or http(s) URL
const AVATAR_PRESETS = ['default', 'red', 'green', 'yellow', 'purple', 'orange'];
const validateAvatarUpdate = [
  body('avatar')
    .trim()
    .custom((val) => {
      if (!val) return false;
      if (AVATAR_PRESETS.includes(val)) return true;
      try {
        const u = new URL(val);
        return (u.protocol === 'http:' || u.protocol === 'https:') && (u.hostname && u.hostname.length <= 253);
      } catch (_) { return false; }
    })
    .withMessage('Invalid avatar. Use a preset (default/red/green/yellow/purple/orange) or a valid http(s) URL')
];

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, avatar } = req.body;

    // Check if user already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Check if email already exists (optional)
    if (email) {
      const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Create new user
    const userId = await db.createUser(username, email || null, password);
    // Optional avatar URL on registration (sanitized)
    if (avatar && typeof avatar === 'string') {
      try {
        const url = new URL(avatar);
        if (['http:', 'https:'].includes(url.protocol) && url.hostname.length <= 253) {
          await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);
        }
      } catch (_) { /* ignore invalid URL */ }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId, username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        userId,
        username,
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Get user from database
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await db.updateUserLastLogin(user.id);
    await db.setUserOnline(user.id, true);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.id,
        username: user.username,
        displayName: user.display_name || null,
        avatar: user.avatar,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.getUserById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user stats
    const stats = await db.getUserBestScore(user.id);
    const gamesPlayed = await db.get(
      'SELECT COUNT(*) as count FROM game_sessions WHERE user_id = ?',
      [user.id]
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name || null,
        avatar: user.avatar,
        bestScore: stats.best_score || 0,
        bestLevel: stats.best_level || 0,
        gamesPlayed: gamesPlayed.count || 0,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Update user avatar
router.put('/avatar', validateAvatarUpdate, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const { avatar } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, decoded.userId]);

    res.json({
      success: true,
      message: 'Avatar updated successfully'
    });

  } catch (error) {
    console.error('Avatar update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Also support POST for avatar update (same validation & auth)
router.post('/avatar', validateAvatarUpdate, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const { avatar } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, decoded.userId]);
    return res.json({ success: true, message: 'Avatar updated successfully' });
  } catch (error) {
    console.error('Avatar update error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    await db.setUserOnline(decoded.userId, false);

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change username endpoint
// Set display name (nickname) - allowed once per 7 days, separate from username
const validateDisplayName = [
  body('displayName')
    .trim()
    .isLength({ min: 3, max: 24 })
    .withMessage('Display name must be between 3 and 24 characters')
    .matches(/^[\p{L}0-9_\-\s]+$/u)
    .withMessage('Display name can contain letters, numbers, spaces, _ and - only')
];

router.put('/username', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Username change feature is disabled' });
});

// New endpoint: change display name (nickname visible in UI/leaderboard only)
router.put('/display-name', async (req, res) => {
  return res.status(410).json({ success: false, message: 'Display name feature is disabled' });
});

module.exports = router;
