const crypto = require('crypto');

class CheatDetection {
  constructor() {
    this.sessionTokens = new Map(); // sessionId -> token data
    this.userSessions = new Map(); // userId -> active sessions
    this.rateLimits = new Map(); // userId -> rate limit data
    this.suspiciousActivity = new Map(); // userId -> suspicious actions
    this.userWarnings = new Map(); // userId -> warning count
    this.bannedUsers = new Map(); // userId -> ban data
  }

  // Generate secure session token
  generateSessionToken(userId, sessionId) {
    const timestamp = Date.now();
    const randomData = crypto.randomBytes(16).toString('hex');
    const data = `${userId}:${sessionId}:${timestamp}:${randomData}`;
    const token = crypto.createHmac('sha256', process.env.SECRET_KEY || 'default-secret')
                      .update(data)
                      .digest('hex');
    
    this.sessionTokens.set(sessionId, {
      userId,
      token,
      timestamp,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      scoreSubmissions: 0,
      levelUpdates: 0
    });

    return token;
  }

  // Verify session token
  verifySessionToken(sessionId, token) {
    const sessionData = this.sessionTokens.get(sessionId);
    if (!sessionData) {
      return { valid: false, reason: 'Session not found' };
    }

    // Check if token matches
    if (sessionData.token !== token) {
      return { valid: false, reason: 'Invalid token' };
    }

    // Check if session is not too old (24 hours max)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - sessionData.createdAt > maxAge) {
      this.sessionTokens.delete(sessionId);
      return { valid: false, reason: 'Session expired' };
    }

    // Update last activity
    sessionData.lastActivity = Date.now();
    return { valid: true, sessionData };
  }

  // Check if user is banned
  isUserBanned(userId) {
    const banData = this.bannedUsers.get(userId);
    if (!banData) return { banned: false };

    const now = Date.now();
    if (now < banData.until) {
      const remainingTime = Math.ceil((banData.until - now) / 1000);
      return { 
        banned: true, 
        reason: banData.reason,
        remainingTime: remainingTime,
        message: `Vous êtes temporairement banni pour ${remainingTime} secondes. Raison: ${banData.reason}`
      };
    } else {
      // Ban expired, remove it
      this.bannedUsers.delete(userId);
      return { banned: false };
    }
  }

  // Rate limiting for score submissions
  checkRateLimit(userId, action) {
    // Check if user is banned first
    const banCheck = this.isUserBanned(userId);
    if (banCheck.banned) {
      return { allowed: false, reason: banCheck.message, banned: true };
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxActions = {
      'score_submission': 5, // Max 5 score submissions per minute
      'level_update': 20,    // Max 20 level updates per minute
      'game_action': 30      // Max 30 game actions per minute
    };

    if (!this.rateLimits.has(userId)) {
      this.rateLimits.set(userId, {
        score_submission: [],
        level_update: [],
        game_action: []
      });
    }

    const userLimits = this.rateLimits.get(userId);
    const actionHistory = userLimits[action] || [];
    
    // Remove old entries outside the window
    const recentActions = actionHistory.filter(timestamp => now - timestamp < windowMs);
    
    // Check if limit exceeded
    if (recentActions.length >= maxActions[action]) {
      this.handleRateLimitViolation(userId, action, recentActions.length, maxActions[action]);
      return { allowed: false, reason: `Rate limit exceeded for ${action}` };
    }

    // Add current action
    recentActions.push(now);
    userLimits[action] = recentActions;
    
    return { allowed: true };
  }

  // Validate score progression
  validateScoreProgression(userId, newLevel, previousLevel, timeElapsed) {
    // Check for impossible level jumps
    const maxLevelJump = 3; // Max 3 levels at once
    if (newLevel - previousLevel > maxLevelJump) {
      this.flagSuspiciousActivity(userId, 'Impossible level jump', {
        previousLevel,
        newLevel,
        jump: newLevel - previousLevel
      });
      return { valid: false, reason: 'Level jump too large' };
    }

    // Check for too fast progression
    const minTimePerLevel = 5000; // 5 seconds minimum per level
    if (timeElapsed < minTimePerLevel && newLevel > previousLevel) {
      this.flagSuspiciousActivity(userId, 'Too fast level progression', {
        previousLevel,
        newLevel,
        timeElapsed
      });
      return { valid: false, reason: 'Level progression too fast' };
    }

    // Check for negative progression (shouldn't happen)
    if (newLevel < previousLevel) {
      this.flagSuspiciousActivity(userId, 'Negative level progression', {
        previousLevel,
        newLevel
      });
      return { valid: false, reason: 'Level cannot decrease' };
    }

    return { valid: true };
  }

  // Validate session integrity
  validateSessionIntegrity(sessionId, userId, expectedData) {
    const sessionData = this.sessionTokens.get(sessionId);
    if (!sessionData) {
      return { valid: false, reason: 'Session not found' };
    }

    // Check if session belongs to user
    if (sessionData.userId !== userId) {
      this.flagSuspiciousActivity(userId, 'Session hijacking attempt', {
        sessionId,
        expectedUserId: userId,
        actualUserId: sessionData.userId
      });
      return { valid: false, reason: 'Session hijacking detected' };
    }

    // Check session activity patterns
    const now = Date.now();
    const timeSinceLastActivity = now - sessionData.lastActivity;
    
    // If too much time passed without activity, session might be stale
    if (timeSinceLastActivity > 300000) { // 5 minutes
      this.flagSuspiciousActivity(userId, 'Stale session activity', {
        sessionId,
        timeSinceLastActivity
      });
      return { valid: false, reason: 'Session too stale' };
    }

    return { valid: true, sessionData };
  }

  // Handle rate limit violation with warnings
  handleRateLimitViolation(userId, action, count, limit) {
    // Get current warning count
    const currentWarnings = this.userWarnings.get(userId) || 0;
    const newWarningCount = currentWarnings + 1;

    this.userWarnings.set(userId, newWarningCount);

    // Log the violation
    console.warn(`⚠️ Rate limit violation for user ${userId}:`, {
      action,
      count,
      limit,
      warningCount: newWarningCount,
      timestamp: new Date().toISOString()
    });

    // If this is the first violation, just warn
    if (newWarningCount === 1) {
      console.log(`📢 First warning for user ${userId}: Rate limit exceeded for ${action}`);
      return { 
        action: 'warning', 
        message: `⚠️ Attention: Vous avez dépassé la limite de ${action}. Premier avertissement.`,
        warningCount: newWarningCount
      };
    }

    // If this is the second violation, warn more seriously
    if (newWarningCount === 2) {
      console.log(`📢 Second warning for user ${userId}: Rate limit exceeded for ${action}`);
      return { 
        action: 'warning', 
        message: `⚠️ Attention: Deuxième avertissement pour ${action}. Un bannissement temporaire suivra si vous continuez.`,
        warningCount: newWarningCount
      };
    }

    // If this is the third violation or more, ban for 3 minutes
    if (newWarningCount >= 3) {
      const banDuration = 3 * 60 * 1000; // 3 minutes
      const banUntil = Date.now() + banDuration;
      
      this.bannedUsers.set(userId, {
        reason: `Rate limit exceeded for ${action} (${newWarningCount} violations)`,
        until: banUntil,
        action: action,
        violationCount: newWarningCount
      });

      console.error(`🔒 User ${userId} temporarily banned for 3 minutes due to repeated rate limit violations`);
      
      // Reset warning count after ban
      this.userWarnings.delete(userId);
      
      return { 
        action: 'banned', 
        message: `🔒 Vous êtes temporairement banni pour 3 minutes. Raison: Trop de violations de limite pour ${action}.`,
        banDuration: 180, // 3 minutes in seconds
        warningCount: newWarningCount
      };
    }

    return { action: 'warning', warningCount: newWarningCount };
  }

  // Flag suspicious activity
  flagSuspiciousActivity(userId, reason, data) {
    if (!this.suspiciousActivity.has(userId)) {
      this.suspiciousActivity.set(userId, []);
    }

    const suspiciousData = {
      timestamp: Date.now(),
      reason,
      data,
      ip: data.ip || 'unknown'
    };

    this.suspiciousActivity.get(userId).push(suspiciousData);

    // Log suspicious activity
    console.warn(`🚨 Suspicious activity detected for user ${userId}:`, {
      reason,
      data,
      timestamp: new Date().toISOString()
    });

    // Get current warning count
    const currentWarnings = this.userWarnings.get(userId) || 0;
    const newWarningCount = currentWarnings + 1;
    this.userWarnings.set(userId, newWarningCount);

    // If too many suspicious activities, temporarily ban user
    const userSuspiciousActivities = this.suspiciousActivity.get(userId);
    if (userSuspiciousActivities.length > 5) { // Reduced from 10 to 5
      const banDuration = 3 * 60 * 1000; // 3 minutes
      const banUntil = Date.now() + banDuration;
      
      this.bannedUsers.set(userId, {
        reason: 'Excessive suspicious activity',
        until: banUntil,
        activityCount: userSuspiciousActivities.length
      });

      console.error(`🔒 User ${userId} temporarily banned for 3 minutes due to excessive suspicious activity`);
      
      // Reset warning count after ban
      this.userWarnings.delete(userId);
      
      return { 
        banned: true, 
        reason: 'Excessive suspicious activity',
        banDuration: 180
      };
    }

    return { flagged: true, warningCount: newWarningCount };
  }

  // Clean up old data
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old sessions
    for (const [sessionId, sessionData] of this.sessionTokens.entries()) {
      if (now - sessionData.createdAt > maxAge) {
        this.sessionTokens.delete(sessionId);
      }
    }

    // Clean up old rate limits
    for (const [userId, limits] of this.rateLimits.entries()) {
      for (const action in limits) {
        limits[action] = limits[action].filter(timestamp => now - timestamp < 60000);
      }
    }

    // Clean up old suspicious activities
    for (const [userId, activities] of this.suspiciousActivity.entries()) {
      const recentActivities = activities.filter(activity => 
        now - activity.timestamp < maxAge
      );
      if (recentActivities.length === 0) {
        this.suspiciousActivity.delete(userId);
      } else {
        this.suspiciousActivity.set(userId, recentActivities);
      }
    }

    // Clean up expired bans
    for (const [userId, banData] of this.bannedUsers.entries()) {
      if (now >= banData.until) {
        this.bannedUsers.delete(userId);
        console.log(`🔓 Ban expired for user ${userId}`);
      }
    }

    // Clean up old warnings (reset after 1 hour of no activity)
    const warningResetTime = 60 * 60 * 1000; // 1 hour
    for (const [userId, warningCount] of this.userWarnings.entries()) {
      // If user has no recent suspicious activity, reset warnings
      const activities = this.suspiciousActivity.get(userId) || [];
      const recentActivities = activities.filter(activity => 
        now - activity.timestamp < warningResetTime
      );
      
      if (recentActivities.length === 0) {
        this.userWarnings.delete(userId);
        console.log(`🔄 Warnings reset for user ${userId} (no recent activity)`);
      }
    }
  }

  // Get user security status
  getUserSecurityStatus(userId) {
    const suspiciousActivities = this.suspiciousActivity.get(userId) || [];
    const rateLimits = this.rateLimits.get(userId) || {};
    const warningCount = this.userWarnings.get(userId) || 0;
    const banStatus = this.isUserBanned(userId);
    
    return {
      suspiciousActivityCount: suspiciousActivities.length,
      recentSuspiciousActivities: suspiciousActivities.slice(-5),
      rateLimitStatus: Object.keys(rateLimits).reduce((acc, action) => {
        acc[action] = rateLimits[action].length;
        return acc;
      }, {}),
      warningCount: warningCount,
      isFlagged: suspiciousActivities.length > 3,
      isBanned: banStatus.banned,
      banInfo: banStatus.banned ? {
        reason: banStatus.reason,
        remainingTime: banStatus.remainingTime
      } : null
    };
  }
}

module.exports = CheatDetection;
