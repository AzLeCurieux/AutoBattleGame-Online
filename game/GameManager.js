const { db } = require('../database/db');

// Set development mode by default for easier debugging
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

class GameManager {
  constructor() {
    this.activeUsers = new Map(); // userId -> user data
    this.gameSessions = new Map(); // sessionId -> session data
    this.leaderboard = [];
    this.lastLeaderboardUpdate = 0;
  }

  // Add user to active users
  addUser(userId, username, avatar) {
    this.activeUsers.set(userId, {
      userId,
      username,
      avatar,
      isOnline: true,
      lastActivity: Date.now(),
      currentLevel: 0,
      currentGold: 0
    });
  }

  // Update user's current game state
  updateUserGameState(userId, level, gold) {
    const user = this.activeUsers.get(userId);
    if (user) {
      user.currentLevel = level;
      user.currentGold = gold;
      user.lastActivity = Date.now();
    }
  }

  // Remove user from active users
  removeUser(userId) {
    this.activeUsers.delete(userId);
  }

  // Get active users
  getActiveUsers() {
    return Array.from(this.activeUsers.values());
  }

  // Get current leaderboard
  async getLeaderboard() {
    if (this.leaderboard.length === 0 || Date.now() - this.lastLeaderboardUpdate > 30000) {
      // Update if empty or older than 30 seconds
      await this.updateLeaderboard(null);
    }
    return this.leaderboard;
  }

  // Handle game action with anti-cheat
  async handleGameAction(userId, actionData) {
    try {
      const user = this.activeUsers.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update user activity
      user.lastActivity = Date.now();

      // Validate action based on game rules
      const validation = await this.validateGameAction(userId, actionData);
      
      if (!validation.isValid) {
        // Log suspicious activity
        await db.logSuspiciousActivity(userId, actionData.sessionId, actionData.action, {
          data: actionData,
          reason: validation.reason,
          timestamp: new Date().toISOString()
        });

        throw new Error(`Invalid game action: ${validation.reason}`);
      }

      // Process the action
      const result = await this.processGameAction(userId, actionData);

      return {
        success: true,
        result,
        scoreChanged: result.scoreChanged || false
      };

    } catch (error) {
      console.error('Game action error:', error);
      throw error;
    }
  }

  // Submit score with validation
  async submitScore(userId, scoreData) {
    try {
      const user = this.activeUsers.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if this is a new record first
      const userStats = await db.getUserBestScore(userId);
      const isNewRecord = !userStats.best_level || scoreData.level > userStats.best_level;

      // Only submit if it's a new record or if it's a real game session (not realtime)
      if (isNewRecord || !scoreData.sessionId.startsWith('realtime_')) {
        // Validate score only for real game sessions
        if (!scoreData.sessionId.startsWith('realtime_')) {
          const validation = await this.validateScore(userId, scoreData);
          
          if (!validation.isValid) {
            await db.logSuspiciousActivity(userId, scoreData.sessionId, 'score_submission', {
              data: scoreData,
              reason: validation.reason,
              timestamp: new Date().toISOString()
            });

            throw new Error(`Invalid score: ${validation.reason}`);
          }
        }

        // Submit score to database (score = level for leaderboard)
        console.log(`Submitting score to database: user=${userId}, level=${scoreData.level}, gold=${scoreData.gold || 0}`);
        await db.submitScore(
          userId,
          scoreData.sessionId,
          scoreData.level,
          scoreData.level, // Use level as score
          scoreData.gold || 0
        );

        // Update session only for real game sessions
        if (!scoreData.sessionId.startsWith('realtime_')) {
          await db.updateGameSession(scoreData.sessionId, {
            level_reached: Math.max(0, scoreData.level),
            gold_earned: scoreData.gold || 0
          });
        }
      }

      // Update user's current game state
      this.updateUserGameState(userId, scoreData.level, scoreData.gold || 0);

      console.log(`Score processed for user ${userId} with level ${scoreData.level}`);
      
      // Return result - leaderboard will be updated by server
      return {
        success: true,
        message: 'Score submitted successfully',
        isNewRecord: isNewRecord,
        previousRecord: userStats.best_level || 0,
        newRecord: scoreData.level,
        shouldUpdateLeaderboard: isNewRecord
      };

    } catch (error) {
      console.error('Score submission error:', error);
      throw error;
    }
  }

  // Update leaderboard and broadcast to all users
  async updateLeaderboard(io) {
    try {
      console.log('Starting leaderboard update...');
      
      // Update leaderboard in database
      const changes = await db.updateLeaderboard();
      console.log('Database leaderboard updated with', changes, 'changes');
      
      // Get updated leaderboard
      this.leaderboard = await db.getLeaderboard(50);
      this.lastLeaderboardUpdate = Date.now();
      console.log('Leaderboard data retrieved:', this.leaderboard.length, 'players');

      // Broadcast to all users in leaderboard room if io is available
      if (io) {
        io.to('leaderboard').emit('leaderboard_update', {
          leaderboard: this.leaderboard,
          timestamp: this.lastLeaderboardUpdate
        });

        // Also broadcast online players
        const onlinePlayers = this.getActiveUsers();
        io.to('leaderboard').emit('online_players_update', {
          players: onlinePlayers,
          count: onlinePlayers.length
        });
        
        console.log('Leaderboard broadcast completed');
      }

      return changes || 0;

    } catch (error) {
      console.error('Leaderboard update error:', error);
      return 0;
    }
  }

  // Validate game action
  async validateGameAction(userId, actionData) {
    const { action, sessionId, data } = actionData;

    // Check if session exists and belongs to user
    const session = await db.get(
      'SELECT * FROM game_sessions WHERE session_id = ? AND user_id = ? AND is_active = 1',
      [sessionId, userId]
    );

    if (!session) {
      return {
        isValid: false,
        reason: 'Invalid or inactive session'
      };
    }

    // Check for suspicious patterns
    const recentActions = await db.all(
      'SELECT * FROM cheat_logs WHERE user_id = ? AND timestamp > datetime("now", "-1 hour")',
      [userId]
    );

    if (recentActions.length > 5) {
      return {
        isValid: false,
        reason: 'Too many suspicious activities'
      };
    }

    // Validate specific actions
    switch (action) {
      case 'attack':
        return this.validateAttack(data);
      case 'upgrade':
        return this.validateUpgrade(data);
      case 'heal':
        return this.validateHeal(data);
      case 'level_up':
        return this.validateLevelUp(data);
      default:
        return {
          isValid: false,
          reason: 'Unknown action type'
        };
    }
  }

  // Validate attack action
  validateAttack(data) {
    if (!data.damage || data.damage < 0 || data.damage > 10000) {
      return {
        isValid: false,
        reason: 'Invalid damage value'
      };
    }
    return { isValid: true };
  }

  // Validate upgrade action
  validateUpgrade(data) {
    const validUpgrades = ['health', 'damage', 'crit_chance', 'crit_damage'];
    if (!data.upgrade || !validUpgrades.includes(data.upgrade)) {
      return {
        isValid: false,
        reason: 'Invalid upgrade type'
      };
    }
    return { isValid: true };
  }

  // Validate heal action
  validateHeal(data) {
    if (!data.heal || data.heal < 0 || data.heal > 1000) {
      return {
        isValid: false,
        reason: 'Invalid heal value'
      };
    }
    return { isValid: true };
  }

  // Validate level up action
  validateLevelUp(data) {
    if (!data.level || data.level < 1 || data.level > 1000) {
      return {
        isValid: false,
        reason: 'Invalid level value'
      };
    }
    return { isValid: true };
  }

  // Validate score submission - SIMPLE ANTI-CHEAT (prevent obvious cheating only)
  async validateScore(userId, scoreData) {
    const { level, score, gold } = scoreData;

    // Get user's previous best
    const userStats = await db.getUserBestScore(userId);
    
    // Only check for obvious cheating - allow reasonable progression
    if (userStats.best_level && level > userStats.best_level + 10) {
      return {
        isValid: false,
        reason: `Suspicious level jump from ${userStats.best_level} to ${level}`
      };
    }

    // Check for negative values
    if (level < 0 || score < 0 || gold < 0) {
      return {
        isValid: false,
        reason: 'Negative values not allowed'
      };
    }

    // Check for impossibly high values (only very high values)
    if (level > 10000 || score > 10000 || gold > 1000000) {
      return {
        isValid: false,
        reason: 'Values too high to be legitimate'
      };
    }

    // Check for reasonable values
    if (level < 0 || level > 1000) {
      return {
        isValid: false,
        reason: 'Level out of range'
      };
    }

    if (score < 0 || score > 1000) {
      return {
        isValid: false,
        reason: 'Score out of range'
      };
    }

    if (gold < 0 || gold > 100000) {
      return {
        isValid: false,
        reason: 'Gold out of range'
      };
    }

    return { isValid: true };
  }

  // Process game action
  async processGameAction(userId, actionData) {
    const { action, data } = actionData;

    switch (action) {
      case 'attack':
        return {
          damage: data.damage,
          critical: Math.random() < 0.1, // 10% crit chance
          scoreChanged: false
        };

      case 'upgrade':
        return {
          upgrade: data.upgrade,
          cost: this.getUpgradeCost(data.upgrade),
          scoreChanged: false
        };

      case 'heal':
        return {
          heal: data.heal,
          cost: data.heal * 0.1, // 0.1 gold per HP
          scoreChanged: false
        };

      case 'level_up':
        return {
          newLevel: data.level,
          scoreChanged: true
        };

      default:
        throw new Error('Unknown action type');
    }
  }

  // Get upgrade cost
  getUpgradeCost(upgradeType) {
    const costs = {
      health: 10,
      damage: 15,
      crit_chance: 20,
      crit_damage: 25
    };
    return costs[upgradeType] || 10;
  }


  // Get leaderboard
  getLeaderboard() {
    return this.leaderboard;
  }

  // Get user rank
  async getUserRank(userId) {
    const userRank = await db.get(
      'SELECT * FROM leaderboard WHERE user_id = ?',
      [userId]
    );
    return userRank;
  }

  // Get online players
  getOnlinePlayers() {
    return this.getActiveUsers();
  }

  // Clean up inactive users
  cleanupInactiveUsers() {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [userId, user] of this.activeUsers) {
      if (now - user.lastActivity > inactiveThreshold) {
        this.removeUser(userId);
        db.setUserOnline(userId, false);
      }
    }
  }
}

module.exports = { GameManager };
