const { ServerGameState } = require('./ServerGameState');
const { db } = require('../database/db');

/**
 * ServerGameManager - Gère toutes les sessions de jeu côté serveur
 * Chaque utilisateur a une session active avec son état de jeu complet
 */
class ServerGameManager {
  constructor() {
    this.gameSessions = new Map(); // sessionId -> ServerGameState
    this.userSessions = new Map(); // userId -> sessionId
    this.activeUsers = new Map(); // userId -> user data
    this.leaderboard = [];
    this.lastLeaderboardUpdate = 0;
    
    // Nettoyage périodique
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Toutes les minutes
  }

  /**
   * Créer une nouvelle session de jeu pour un utilisateur
   */
  createGameSession(userId, username, avatar) {
    // CORRECTION: Vérifier s'il y a déjà une session active pour cet utilisateur
    const existingSessionId = this.userSessions.get(userId);
    if (existingSessionId) {
      const existingSession = this.gameSessions.get(existingSessionId);
      if (existingSession && existingSession.isActive && !existingSession.shouldBeDeleted()) {
        // Restaurer la session existante
        console.log(`🔄 Restauration de la session existante: ${existingSessionId} pour user ${userId}`);
        existingSession.lastActivity = Date.now();
        
        // Mettre à jour les données utilisateur
        this.activeUsers.set(userId, {
          userId,
          username,
          avatar,
          isOnline: true,
          lastActivity: Date.now(),
          currentLevel: existingSession.player.level,
          currentGold: existingSession.player.gold
        });
        
        return { sessionId: existingSessionId, gameState: existingSession.getGameState() };
      } else {
        // Supprimer l'ancienne session si elle est morte/abandonnée
        this.removeUserSession(userId);
      }
    }
    
    // CORRECTION: Vérifier s'il y a d'autres sessions actives pour cet utilisateur
    for (const [sessionId, session] of this.gameSessions) {
      if (session.userId === userId && session.isActive && !session.shouldBeDeleted()) {
        console.log(`🔄 Session active trouvée: ${sessionId} pour user ${userId}`);
        session.lastActivity = Date.now();
        
        // Mettre à jour les données utilisateur
        this.activeUsers.set(userId, {
          userId,
          username,
          avatar,
          isOnline: true,
          lastActivity: Date.now(),
          currentLevel: session.player.level,
          currentGold: session.player.gold
        });
        
        // Mettre à jour la référence utilisateur
        this.userSessions.set(userId, sessionId);
        
        return { sessionId, gameState: session.getGameState() };
      }
    }
    
    // Créer une nouvelle session seulement si aucune session active
    const sessionId = `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const gameState = new ServerGameState(sessionId, userId);
    
    // Enregistrer la session
    this.gameSessions.set(sessionId, gameState);
    this.userSessions.set(userId, sessionId);
    
    // Ajouter l'utilisateur aux utilisateurs actifs
    this.activeUsers.set(userId, {
      userId,
      username,
      avatar,
      isOnline: true,
      lastActivity: Date.now(),
      currentLevel: 0,
      currentGold: 0
    });

    console.log(`🎮 Nouvelle session créée: ${sessionId} pour user ${userId}`);
    
    return {
      sessionId,
      gameState: gameState.getGameState()
    };
  }

  /**
   * Obtenir la session d'un utilisateur
   */
  getUserSession(userId) {
    const sessionId = this.userSessions.get(userId);
    if (!sessionId) return null;
    
    return this.gameSessions.get(sessionId);
  }

  /**
   * Désactiver la session d'un utilisateur
   */
  deactivateUserSession(userId) {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      const gameState = this.gameSessions.get(sessionId);
      if (gameState) {
        gameState.deactivate();
      }
      this.gameSessions.delete(sessionId);
    }
    this.userSessions.delete(userId);
  }

  /**
   * Supprimer un utilisateur
   */
  removeUser(userId) {
    this.deactivateUserSession(userId);
    this.activeUsers.delete(userId);
  }

  /**
   * Marquer un utilisateur comme mort
   */
  markUserAsDead(userId) {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      const gameState = this.gameSessions.get(sessionId);
      if (gameState) {
        gameState.markAsDead();
        console.log(`💀 Utilisateur ${userId} marqué comme mort`);
      }
    }
  }

  /**
   * Marquer un utilisateur comme abandonné
   */
  markUserAsAbandoned(userId) {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      const gameState = this.gameSessions.get(sessionId);
      if (gameState) {
        gameState.markAsAbandoned();
        console.log(`🚪 Utilisateur ${userId} marqué comme abandonné`);
      }
    }
  }

  /**
   * Supprimer une session utilisateur
   */
  removeUserSession(userId) {
    const sessionId = this.userSessions.get(userId);
    if (sessionId) {
      const gameState = this.gameSessions.get(sessionId);
      if (gameState) {
        gameState.deactivate();
      }
      this.gameSessions.delete(sessionId);
      this.userSessions.delete(userId);
      console.log(`🗑️ Session supprimée pour l'utilisateur ${userId}`);
    }
  }

  /**
   * Gérer une action de jeu
   */
  async handleGameAction(userId, action, data = {}) {
    const gameState = this.getUserSession(userId);
    if (!gameState) {
      throw new Error('Session de jeu introuvable');
    }

    if (!gameState.isValid()) {
      throw new Error('Session expirée');
    }

    let result;
    
    try {
      switch (action) {
        case 'start_fight':
          result = gameState.startFight();
          break;
          
        case 'stop_fight':
          result = gameState.stopFight();
          break;
          
        case 'attack':
          result = gameState.performAttack();
          break;
          
        case 'heal':
          result = gameState.heal();
          break;
          
        case 'upgrade':
          result = gameState.buyUpgrade(data.upgradeType);
          break;
          
        case 'save_passive':
          result = gameState.savePassiveUpgrade(data.upgrade);
          break;
          
        case 'save_boss_passive':
          result = gameState.saveBossPassive(data.bossPassive);
          break;
          
        default:
          throw new Error(`Action inconnue: ${action}`);
      }

      // Mettre à jour l'activité de l'utilisateur
      this.updateUserActivity(userId, gameState.player.level, gameState.player.gold);
      
      // Vérifier si c'est un nouveau record
      if (result.victory && result.levelUp) {
        const isNewRecord = await this.checkNewRecord(userId, result.newLevel);
        result.isNewRecord = isNewRecord;
      }

      return {
        success: true,
        action,
        result,
        gameState: gameState.getGameState()
      };

    } catch (error) {
      console.error(`Erreur action ${action} pour user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Obtenir l'état du jeu d'un utilisateur
   */
  getGameState(userId) {
    const gameState = this.getUserSession(userId);
    if (!gameState) {
      throw new Error('Session de jeu introuvable');
    }
    
    return gameState.getGameState();
  }

  /**
   * Obtenir les passifs de session d'un utilisateur
   */
  getSessionPassives(userId) {
    const gameState = this.getUserSession(userId);
    if (!gameState) {
      return { passiveUpgrades: [], bossPassives: [] };
    }
    
    return gameState.getSessionPassives();
  }

  /**
   * Mettre à jour l'activité d'un utilisateur
   */
  updateUserActivity(userId, level, gold) {
    const user = this.activeUsers.get(userId);
    if (user) {
      user.currentLevel = level;
      user.currentGold = gold;
      user.lastActivity = Date.now();
    }
  }

  /**
   * Vérifier si c'est un nouveau record
   */
  async checkNewRecord(userId, level) {
    try {
      const userStats = await db.getUserBestScore(userId);
      return !userStats.best_level || level > userStats.best_level;
    } catch (error) {
      console.error('Erreur vérification record:', error);
      return false;
    }
  }

  /**
   * Obtenir les utilisateurs actifs
   */
  getActiveUsers() {
    return Array.from(this.activeUsers.values());
  }

  /**
   * Mettre à jour le classement
   */
  async updateLeaderboard(io) {
    try {
      console.log('🔄 Mise à jour du classement...');
      
      // Mettre à jour le classement dans la base de données
      const changes = await db.updateLeaderboard();
      console.log(`📊 Classement mis à jour: ${changes} changements`);
      
      // Récupérer le nouveau classement
      this.leaderboard = await db.getLeaderboard(50);
      this.lastLeaderboardUpdate = Date.now();
      
      // Diffuser à tous les clients
      if (io) {
        io.to('leaderboard').emit('leaderboard_update', {
          leaderboard: this.leaderboard,
          timestamp: this.lastLeaderboardUpdate
        });

        // Diffuser aussi les joueurs en ligne
        const onlinePlayers = this.getActiveUsers();
        io.to('leaderboard').emit('online_players_update', {
          players: onlinePlayers,
          count: onlinePlayers.length
        });
        
        console.log('📡 Classement diffusé à tous les clients');
      }

      return changes || 0;

    } catch (error) {
      console.error('❌ Erreur mise à jour classement:', error);
      return 0;
    }
  }

  /**
   * Obtenir le classement actuel
   */
  getLeaderboard() {
    return this.leaderboard;
  }

  /**
   * Nettoyer les sessions inactives
   */
  cleanupInactiveSessions() {
    const now = Date.now();
    const inactiveThreshold = 300000; // 5 minutes
    
    let cleanedCount = 0;
    
    for (const [sessionId, gameState] of this.gameSessions) {
      if (!gameState.isValid() || (now - gameState.lastActivity) > inactiveThreshold) {
        console.log(`🧹 Nettoyage session inactive: ${sessionId}`);
        gameState.deactivate();
        this.gameSessions.delete(sessionId);
        
        // Supprimer aussi de userSessions
        for (const [userId, userSessionId] of this.userSessions) {
          if (userSessionId === sessionId) {
            this.userSessions.delete(userId);
            this.activeUsers.delete(userId);
            break;
          }
        }
        
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 ${cleanedCount} sessions inactives nettoyées`);
    }
  }

  /**
   * Obtenir les statistiques du serveur
   */
  getServerStats() {
    return {
      activeSessions: this.gameSessions.size,
      activeUsers: this.activeUsers.size,
      leaderboardSize: this.leaderboard.length,
      lastUpdate: this.lastLeaderboardUpdate
    };
  }
}

module.exports = { ServerGameManager };
