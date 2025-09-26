const crypto = require('crypto');

class SessionManager {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> session data
    this.userSessions = new Map(); // userId -> array of sessionIds
  }

  // Create new game session - UNIQUE PER USER
  createSession(userId, sessionId) {
    // Check if user already has an active session
    const existingSession = this.getUserActiveSession(userId);
    if (existingSession) {
      // Deactivate old session
      existingSession.isActive = false;
      console.log(`🔄 Deactivated old session for user ${userId}: ${existingSession.sessionId}`);
    }

    const now = Date.now();
    const runId = this.generateRunId(userId);
    const sessionData = {
      sessionId,
      userId,
      runId,
      createdAt: now,
      lastActivity: now,
      startLevel: 0,
      currentLevel: 0,
      maxLevelReached: 0,
      totalGold: 0,
      enemiesKilled: 0,
      bossesDefeated: 0,
      isActive: true,
      scoreHistory: [],
      levelHistory: [],
      securityToken: this.generateSecurityToken(userId, sessionId),
      sessionHash: this.generateSessionHash(userId, sessionId, now),
      integrityChecks: [],
      passiveUpgrades: [], // Store passive upgrades
      bossPassives: [], // Store boss passive upgrades
      displayedRecords: [] // Track displayed new records
    };

    this.activeSessions.set(sessionId, sessionData);
    
    // Track user sessions - only one active per user
    this.userSessions.set(userId, sessionId);

    console.log(`🔐 Created unique session for user ${userId}: ${sessionId} (Run: ${runId})`);
    return sessionData;
  }

  // Get user's active session
  getUserActiveSession(userId) {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.isActive) {
        return session;
      }
    }
    return null;
  }

  // Generate unique run ID
  generateRunId(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `run_${userId}_${timestamp}_${random}`;
  }

  // Generate session hash for integrity
  generateSessionHash(userId, sessionId, timestamp) {
    return crypto
      .createHmac('sha256', process.env.SECRET_KEY || 'default-secret')
      .update(`${userId}:${sessionId}:${timestamp}:${Math.random()}`)
      .digest('hex');
  }

  // Generate security token for session
  generateSecurityToken(userId, sessionId) {
    const timestamp = Date.now();
    const randomData = crypto.randomBytes(16).toString('hex');
    const data = `${userId}:${sessionId}:${timestamp}:${randomData}`;
    
    return crypto.createHmac('sha256', process.env.SECRET_KEY || 'default-secret')
                 .update(data)
                 .digest('hex');
  }

  // Validate session - STRICT
  validateSession(sessionId, securityToken) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (!session.isActive) {
      return { valid: false, reason: 'Session not active' };
    }

    if (session.securityToken !== securityToken) {
      return { valid: false, reason: 'Invalid security token' };
    }

    // Check if session is expired (24 hours)
    const now = Date.now();
    if (now - session.createdAt > 24 * 60 * 60 * 1000) {
      session.isActive = false;
      return { valid: false, reason: 'Session expired' };
    }

    // Check session age (max 2 hours)
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    if (Date.now() - session.createdAt > maxAge) {
      this.endSession(sessionId);
      return { valid: false, reason: 'Session expired' };
    }

    // Update last activity
    session.lastActivity = Date.now();
    return { valid: true, session };
  }

  // Update session with level progression
  updateSessionLevel(sessionId, newLevel, gold, enemiesKilled = 0, bossDefeated = false) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, reason: 'Session not found' };
    }

    const now = Date.now();
    const timeSinceLastLevel = now - (session.levelHistory[session.levelHistory.length - 1]?.timestamp || session.createdAt);
    
    // Validate level progression - ALLOW level decrease for game restarts
    // if (newLevel < session.currentLevel) {
    //   return { success: false, reason: 'Level cannot decrease' };
    // }

    // SIMPLE level jump validation - allow reasonable progression
    if (newLevel - session.currentLevel > 10) {
      return { success: false, reason: 'Level jump too large' };
    }

    // Update session data
    session.currentLevel = newLevel;
    session.maxLevelReached = Math.max(session.maxLevelReached, newLevel);
    session.totalGold += gold || 0;
    session.enemiesKilled += enemiesKilled;
    if (bossDefeated) session.bossesDefeated++;
    session.lastActivity = now;

    // Record level history
    session.levelHistory.push({
      level: newLevel,
      timestamp: now,
      gold: gold || 0,
      enemiesKilled,
      bossDefeated
    });

    // Keep only last 50 level records
    if (session.levelHistory.length > 50) {
      session.levelHistory = session.levelHistory.slice(-50);
    }

    console.log(`📊 Session ${sessionId} updated: Level ${newLevel}, Gold +${gold}`);
    return { success: true, session };
  }

  // Record score submission
  recordScoreSubmission(sessionId, level, score, gold) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, reason: 'Session not found' };
    }

    const now = Date.now();
    const scoreData = {
      level,
      score,
      gold,
      timestamp: now,
      sessionLevel: session.currentLevel,
      maxLevelReached: session.maxLevelReached
    };

    session.scoreHistory.push(scoreData);

    // Keep only last 20 score submissions
    if (session.scoreHistory.length > 20) {
      session.scoreHistory = session.scoreHistory.slice(-20);
    }

    console.log(`📈 Score recorded for session ${sessionId}: Level ${level}, Score ${score}`);
    return { success: true, scoreData };
  }

  // End session
  endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.endedAt = Date.now();
      
      // Remove from user sessions
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        const index = userSessions.indexOf(sessionId);
        if (index > -1) {
          userSessions.splice(index, 1);
        }
      }

      console.log(`🔚 Session ended: ${sessionId} for user ${session.userId}`);
      return session;
    }
    return null;
  }

  // Get session data
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  // Get user's active sessions
  getUserSessions(userId) {
    return this.userSessions.get(userId) || [];
  }

  // Clean up old sessions
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.createdAt > maxAge) {
        this.endSession(sessionId);
        this.activeSessions.delete(sessionId);
      }
    }
  }

  // Get session statistics
  getSessionStats(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      runId: session.runId,
      duration: Date.now() - session.createdAt,
      maxLevelReached: session.maxLevelReached,
      currentLevel: session.currentLevel,
      totalGold: session.totalGold,
      enemiesKilled: session.enemiesKilled,
      bossesDefeated: session.bossesDefeated,
      scoreSubmissions: session.scoreHistory.length,
      levelProgressions: session.levelHistory.length,
      isActive: session.isActive,
      integrityChecks: session.integrityChecks ? session.integrityChecks.length : 0
    };
  }

  // Validate session hash integrity
  validateSessionHash(session) {
    const expectedHash = this.generateSessionHash(
      session.userId, 
      session.sessionId, 
      session.createdAt
    );
    return session.sessionHash === expectedHash;
  }

  // Add integrity check to session
  addIntegrityCheck(sessionId, action, data) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      const check = {
        timestamp: Date.now(),
        action,
        data,
        hash: this.generateActionHash(action, data, sessionId)
      };
      session.integrityChecks.push(check);
      
      // Keep only last 100 checks to prevent memory issues
      if (session.integrityChecks.length > 100) {
        session.integrityChecks = session.integrityChecks.slice(-100);
      }
    }
  }

  // Generate action hash for integrity
  generateActionHash(action, data, sessionId) {
    return crypto
      .createHmac('sha256', process.env.SECRET_KEY || 'default-secret')
      .update(`${action}:${JSON.stringify(data)}:${sessionId}:${Date.now()}`)
      .digest('hex');
  }

  // Validate run integrity - RELAXED
  validateRunIntegrity(sessionId, level, gold, enemiesKilled) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    // Allow level to decrease (game restart)
    if (level < session.currentLevel) {
      // Reset session data for new run
      session.currentLevel = level;
      session.totalGold = gold;
      session.enemiesKilled = enemiesKilled;
      return { valid: true };
    }

    // RELAXED: Allow larger level jumps (max +5 per update)
    if (level > session.currentLevel + 5) {
      return { valid: false, reason: 'Level jump too large' };
    }

    // RELAXED: Allow gold to decrease (can happen during gameplay)
    if (level === session.currentLevel && gold < session.totalGold - 10) {
      return { valid: false, reason: 'Gold decrease too large' };
    }

    // RELAXED: Allow enemies killed to decrease (can happen on restart)
    if (enemiesKilled < session.enemiesKilled - 5) {
      return { valid: false, reason: 'Enemies killed decrease too large' };
    }

    return { valid: true };
  }

  // Add passive upgrade to session
  addPassiveUpgrade(sessionId, upgrade) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.passiveUpgrades.push({
        ...upgrade,
        timestamp: Date.now()
      });
      console.log(`📈 Passive upgrade added to session ${sessionId}: ${upgrade.name}`);
    }
  }

  // Add boss passive to session
  addBossPassive(sessionId, bossPassive) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.bossPassives.push({
        ...bossPassive,
        timestamp: Date.now()
      });
      console.log(`👑 Boss passive added to session ${sessionId}: ${bossPassive.name}`);
    }
  }

  // Get session passives
  getSessionPassives(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      return {
        passiveUpgrades: session.passiveUpgrades || [],
        bossPassives: session.bossPassives || []
      };
    }
    return { passiveUpgrades: [], bossPassives: [] };
  }

  // Check if new record was already displayed
  isRecordAlreadyDisplayed(sessionId, level) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      return session.displayedRecords.includes(level);
    }
    return false;
  }

  // Mark record as displayed
  markRecordAsDisplayed(sessionId, level) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (!session.displayedRecords.includes(level)) {
        session.displayedRecords.push(level);
        console.log(`🏆 Record marked as displayed for session ${sessionId}: level ${level}`);
      }
    }
  }

  // Deactivate all sessions for a user
  deactivateAllUserSessions(userId) {
    const userSessionId = this.userSessions.get(userId);
    if (userSessionId) {
      const session = this.activeSessions.get(userSessionId);
      if (session) {
        session.isActive = false;
        console.log(`🔄 Deactivated session for user ${userId}: ${userSessionId}`);
      }
      this.userSessions.delete(userId);
    }
    
    // Also deactivate any other sessions for this user
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        session.isActive = false;
        console.log(`🔄 Deactivated additional session for user ${userId}: ${sessionId}`);
      }
    }
  }
}

module.exports = SessionManager;
