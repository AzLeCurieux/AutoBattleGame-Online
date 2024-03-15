const crypto = require('crypto');

class SimpleSessionManager {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> sessionData
    this.userSessions = new Map(); // userId -> sessionId
  }

  // Create new session - SIMPLE
  createSession(userId, sessionId) {
    // Deactivate any existing session for this user
    const existingSessionId = this.userSessions.get(userId);
    if (existingSessionId) {
      const existingSession = this.activeSessions.get(existingSessionId);
      if (existingSession) {
        existingSession.isActive = false;
        console.log(`🔄 Deactivated existing session for user ${userId}: ${existingSessionId}`);
      }
      this.userSessions.delete(userId);
    }

    const now = Date.now();
    const runId = `run_${userId}_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionData = {
      sessionId,
      userId,
      runId,
      createdAt: now,
      lastActivity: now,
      currentLevel: 0,
      maxLevelReached: 0,
      totalGold: 0,
      enemiesKilled: 0,
      isActive: true,
      securityToken: this.generateSecurityToken(userId, sessionId),
      passiveUpgrades: [],
      bossPassives: [],
      displayedRecords: [],
      integrityChecks: [] // CORRECTION: Initialiser le tableau des vérifications d'intégrité
    };

    this.activeSessions.set(sessionId, sessionData);
    this.userSessions.set(userId, sessionId);

    console.log(`🔐 Created simple session for user ${userId}: ${sessionId} (Run: ${runId})`);
    return sessionData;
  }

  // Generate security token
  generateSecurityToken(userId, sessionId) {
    return crypto.createHmac('sha256', process.env.SECRET_KEY || 'default-secret')
      .update(`${userId}:${sessionId}:${Date.now()}`)
      .digest('hex');
  }

  // Validate session - SIMPLE
  validateSession(sessionId, userId, securityToken) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (!session.isActive) {
      return { valid: false, reason: 'Session not active' };
    }

    // CORRECTION: Vérifier que la session appartient au bon utilisateur
    if (session.userId !== userId) {
      return { valid: false, reason: 'Session user mismatch' };
    }

    if (session.securityToken !== securityToken) {
      return { valid: false, reason: 'Invalid security token' };
    }

    // Check if session is expired (2 hours)
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    if (Date.now() - session.createdAt > maxAge) {
      session.isActive = false;
      return { valid: false, reason: 'Session expired' };
    }

    return { valid: true };
  }

  // Update session level - SIMPLE
  updateSessionLevel(sessionId, level, gold, enemiesKilled, bossDefeated = false) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return { success: false, reason: 'Session not found' };
    }

    // Allow level to decrease (game restart)
    if (level < session.currentLevel) {
      session.currentLevel = level;
      session.totalGold = gold;
      session.enemiesKilled = enemiesKilled;
      session.bossDefeated = bossDefeated;
      session.lastActivity = Date.now();
      return { success: true, reason: 'Level decreased (game restart)' };
    }

    // Allow reasonable level jumps (max +5)
    if (level > session.currentLevel + 5) {
      return { success: false, reason: 'Level jump too large' };
    }

    // Update session
    session.currentLevel = level;
    session.totalGold = gold;
    session.enemiesKilled = enemiesKilled;
    session.bossDefeated = bossDefeated;
    session.lastActivity = Date.now();

    if (level > session.maxLevelReached) {
      session.maxLevelReached = level;
    }

    return { success: true, reason: 'Session updated successfully' };
  }

  // Deactivate all sessions for a user (silently, no console spam)
  deactivateAllUserSessions(userId) {
    const userSessionId = this.userSessions.get(userId);
    if (userSessionId) {
      const session = this.activeSessions.get(userSessionId);
      if (session) {
        session.isActive = false;
      }
      this.userSessions.delete(userId);
    }
    
    // Also deactivate any other sessions for this user (silently)
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId && session.isActive) {
        session.isActive = false;
      }
    }
  }

  // Cleanup user sessions from database (async)
  async cleanupUserSessions(userId) {
    // This will be called from server.js with db access
    // For now, just mark old sessions as inactive in memory
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId && !session.isActive) {
        // Remove inactive sessions older than maxAge
        if (now - session.lastActivity > maxAge) {
          this.activeSessions.delete(sessionId);
        }
      }
    }
  }

  // Validate run integrity - SIMPLE
  validateRunIntegrity(sessionId, level, gold, enemiesKilled) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (!session.isActive) {
      return { valid: false, reason: 'Session not active' };
    }

    // Allow level to decrease (game restart)
    if (level < session.currentLevel) {
      return { valid: true }; // Game restart is allowed
    }

    // Allow reasonable level jumps (max +5)
    if (level > session.currentLevel + 5) {
      return { valid: false, reason: 'Level jump too large' };
    }

    // Allow reasonable gold increases
    if (gold < session.totalGold - 100) {
      return { valid: false, reason: 'Gold decrease too large' };
    }

    // Allow reasonable enemy kill increases
    if (enemiesKilled < session.enemiesKilled - 10) {
      return { valid: false, reason: 'Enemy kills decrease too large' };
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

  // Add integrity check - SIMPLE
  addIntegrityCheck(sessionId, checkType, data) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ Cannot add integrity check: session ${sessionId} not found`);
      return;
    }

    // Initialize integrity checks array if it doesn't exist
    if (!session.integrityChecks) {
      session.integrityChecks = [];
    }

    // Add the integrity check
    const integrityCheck = {
      type: checkType,
      data: data,
      timestamp: Date.now()
    };

    session.integrityChecks.push(integrityCheck);
    
    // Keep only the last 100 integrity checks to prevent memory issues
    if (session.integrityChecks.length > 100) {
      session.integrityChecks = session.integrityChecks.slice(-100);
    }

    console.log(`🔒 Integrity check added to session ${sessionId}: ${checkType}`);
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

  // End session
  endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.userSessions.delete(session.userId);
      console.log(`🔚 Session ended: ${sessionId}`);
    }
  }

  // Get active session for user
  getUserActiveSession(userId) {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      return this.activeSessions.get(sessionId);
    }
    return null;
  }

  // Cleanup inactive sessions (optimized, less verbose)
  cleanup() {
    const now = Date.now();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes
    
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.activeSessions) {
      if (!session.isActive || (now - session.lastActivity) > inactiveThreshold) {
        this.activeSessions.delete(sessionId);
        
        // Remove from userSessions
        for (const [userId, userSessionId] of this.userSessions) {
          if (userSessionId === sessionId) {
            this.userSessions.delete(userId);
            break;
          }
        }
        
        cleanedCount++;
      }
    }
    
    // Only log if significant cleanup happened
    if (cleanedCount > 10) {
      console.log(`🧹 Cleaned up ${cleanedCount} inactive sessions`);
    }
  }

  // Cleanup user sessions from database (async)
  async cleanupUserSessions(userId) {
    // This will be called from server.js with db access
    // For now, just mark old sessions as inactive in memory
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId && !session.isActive) {
        // Remove inactive sessions older than maxAge
        if (now - session.lastActivity > maxAge) {
          this.activeSessions.delete(sessionId);
        }
      }
    }
  }
}

module.exports = SimpleSessionManager;

