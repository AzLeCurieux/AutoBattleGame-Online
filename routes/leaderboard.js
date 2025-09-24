const express = require('express');
const { db } = require('../database/db');

const router = express.Router();

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const leaderboard = await db.all(
      'SELECT * FROM leaderboard ORDER BY rank_position LIMIT ? OFFSET ?',
      [limit, offset]
    );

    res.json({
      success: true,
      data: {
        leaderboard,
        total: leaderboard.length,
        limit,
        offset
      }
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard'
    });
  }
});

// Get top players
router.get('/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const topPlayers = await db.all(
      'SELECT * FROM leaderboard ORDER BY rank_position LIMIT ?',
      [limit]
    );

    res.json({
      success: true,
      data: topPlayers
    });

  } catch (error) {
    console.error('Get top players error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top players'
    });
  }
});

// Get user's rank
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const userRank = await db.get(
      'SELECT * FROM leaderboard WHERE user_id = ?',
      [userId]
    );

    if (!userRank) {
      return res.status(404).json({
        success: false,
        message: 'User not found in leaderboard'
      });
    }

    res.json({
      success: true,
      data: userRank
    });

  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user rank'
    });
  }
});

// Get online players
router.get('/online', async (req, res) => {
  try {
    const onlinePlayers = await db.all(
      `SELECT 
        u.id,
        u.username,
        u.avatar,
        u.last_login,
        lb.best_score,
        lb.best_level,
        lb.rank_position
      FROM users u
      LEFT JOIN leaderboard lb ON u.id = lb.user_id
      WHERE u.is_online = 1
      ORDER BY lb.best_score DESC`
    );

    res.json({
      success: true,
      data: {
        onlinePlayers,
        count: onlinePlayers.length
      }
    });

  } catch (error) {
    console.error('Get online players error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get online players'
    });
  }
});

// Get leaderboard by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    let orderBy;
    switch (category) {
      case 'score':
        orderBy = 'best_score DESC';
        break;
      case 'level':
        orderBy = 'best_level DESC';
        break;
      case 'gold':
        orderBy = 'total_gold DESC';
        break;
      case 'games':
        orderBy = 'games_played DESC';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
    }

    const leaderboard = await db.all(
      `SELECT * FROM leaderboard ORDER BY ${orderBy} LIMIT ?`,
      [limit]
    );

    res.json({
      success: true,
      data: {
        category,
        leaderboard
      }
    });

  } catch (error) {
    console.error('Get category leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get category leaderboard'
    });
  }
});

// Update leaderboard (admin only)
router.post('/update', async (req, res) => {
  try {
    // In a real application, you'd check for admin permissions here
    await db.updateLeaderboard();

    res.json({
      success: true,
      message: 'Leaderboard updated successfully'
    });

  } catch (error) {
    console.error('Update leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update leaderboard'
    });
  }
});

// Get leaderboard statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_players,
        AVG(best_score) as avg_score,
        MAX(best_score) as max_score,
        AVG(best_level) as avg_level,
        MAX(best_level) as max_level,
        SUM(total_gold) as total_gold_earned,
        SUM(games_played) as total_games_played
      FROM leaderboard
    `);

    const topPlayer = await db.get(
      'SELECT username, best_score, best_level FROM leaderboard ORDER BY rank_position LIMIT 1'
    );

    res.json({
      success: true,
      data: {
        ...stats,
        topPlayer
      }
    });

  } catch (error) {
    console.error('Get leaderboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard statistics'
    });
  }
});

module.exports = router;
