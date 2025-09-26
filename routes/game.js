const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
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
};

// Start new game session
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const sessionId = uuidv4();

    console.log(`Creating game session for user ${userId} with session ${sessionId}`);

    // Check if session already exists
    const existingSession = await db.get('SELECT * FROM game_sessions WHERE session_id = ?', [sessionId]);
    if (existingSession) {
      console.log(`Session ${sessionId} already exists, using existing session`);
      return res.json({
        success: true,
        data: {
          sessionId,
          message: 'Game session already exists'
        }
      });
    }

    // Create new game session
    await db.createGameSession(userId, sessionId);
    console.log(`Game session created successfully: ${sessionId}`);

    res.json({
      success: true,
      data: {
        sessionId,
        message: 'Game session started'
      }
    });

  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start game session',
      error: error.message
    });
  }
});

// Submit game action (with anti-cheat validation)
router.post('/action', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId, action, data } = req.body;

    if (!sessionId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and action are required'
      });
    }

    // Validate session belongs to user
    const session = await db.get(
      'SELECT * FROM game_sessions WHERE session_id = ? AND user_id = ? AND is_active = 1',
      [sessionId, userId]
    );

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive session'
      });
    }

    // Anti-cheat validation
    const validationResult = await validateGameAction(userId, sessionId, action, data);
    
    if (!validationResult.isValid) {
      // Log suspicious activity
      await db.logSuspiciousActivity(userId, sessionId, action, {
        data,
        reason: validationResult.reason,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid game action',
        reason: validationResult.reason
      });
    }

    // Process the action
    const result = await processGameAction(userId, sessionId, action, data);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Game action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process game action'
    });
  }
});

// Submit score
router.post('/score', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId, level, score, gold } = req.body;

    if (!sessionId || level === undefined || score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Session ID, level, and score are required'
      });
    }

    // Validate session
    const session = await db.get(
      'SELECT * FROM game_sessions WHERE session_id = ? AND user_id = ? AND is_active = 1',
      [sessionId, userId]
    );

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session'
      });
    }

    // Anti-cheat validation for score
    const scoreValidation = await validateScore(userId, sessionId, level, score, gold);
    
    if (!scoreValidation.isValid) {
      await db.logSuspiciousActivity(userId, sessionId, 'score_submission', {
        level,
        score,
        gold,
        reason: scoreValidation.reason,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        message: 'Invalid score submission',
        reason: scoreValidation.reason
      });
    }

    // Submit score
    await db.submitScore(userId, sessionId, level, score, gold || 0);

    // Update session
    await db.updateGameSession(sessionId, {
      level_reached: Math.max(session.level_reached, level),
      gold_earned: (session.gold_earned || 0) + (gold || 0)
    });

    res.json({
      success: true,
      message: 'Score submitted successfully'
    });

  } catch (error) {
    console.error('Score submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit score'
    });
  }
});

// End game session
router.post('/end', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Validate session
    const session = await db.get(
      'SELECT * FROM game_sessions WHERE session_id = ? AND user_id = ? AND is_active = 1',
      [sessionId, userId]
    );

    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session'
      });
    }

    // End session
    await db.endGameSession(sessionId);

    res.json({
      success: true,
      message: 'Game session ended'
    });

  } catch (error) {
    console.error('End game error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end game session'
    });
  }
});

// Get user's game history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;

    const history = await db.all(
      `SELECT 
        gs.session_id,
        gs.start_time,
        gs.end_time,
        gs.level_reached,
        gs.gold_earned,
        gs.enemies_killed,
        gs.boss_defeated,
        MAX(s.score) as best_score
      FROM game_sessions gs
      LEFT JOIN scores s ON gs.session_id = s.session_id
      WHERE gs.user_id = ?
      GROUP BY gs.session_id
      ORDER BY gs.start_time DESC
      LIMIT ?`,
      [userId, limit]
    );

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get game history'
    });
  }
});

// Anti-cheat validation functions
async function validateGameAction(userId, sessionId, action, data) {
  // Basic validation - can be expanded
  const validActions = ['attack', 'upgrade', 'heal', 'level_up'];
  
  if (!validActions.includes(action)) {
    return {
      isValid: false,
      reason: 'Invalid action type'
    };
  }

  // Check for suspicious patterns
  const recentActions = await db.all(
    'SELECT * FROM cheat_logs WHERE user_id = ? AND timestamp > datetime("now", "-1 hour")',
    [userId]
  );

  if (recentActions.length > 10) {
    return {
      isValid: false,
      reason: 'Too many suspicious activities'
    };
  }

  return { isValid: true };
}

async function validateScore(userId, sessionId, level, score, gold) {
  // Get user's previous best
  const userStats = await db.getUserBestScore(userId);
  
  // Check for impossible score jumps
  if (userStats.best_score && score > userStats.best_score * 2) {
    return {
      isValid: false,
      reason: 'Score increase too large'
    };
  }

  // Check for reasonable level progression
  if (level > 100) {
    return {
      isValid: false,
      reason: 'Level too high'
    };
  }

  // Check for reasonable score values
  if (score < 0 || score > 1000000) {
    return {
      isValid: false,
      reason: 'Score out of reasonable range'
    };
  }

  return { isValid: true };
}

async function processGameAction(userId, sessionId, action, data) {
  // Process different game actions
  switch (action) {
    case 'attack':
      return { success: true, damage: data.damage || 100 };
    case 'upgrade':
      return { success: true, upgrade: data.upgrade };
    case 'heal':
      return { success: true, heal: data.heal || 50 };
    case 'level_up':
      return { success: true, newLevel: data.level };
    default:
      return { success: false, message: 'Unknown action' };
  }
}

module.exports = router;
