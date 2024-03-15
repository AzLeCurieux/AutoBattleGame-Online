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

    // Mise à jour périodique du leaderboard (toutes les 10 secondes pour être réactif)
    setInterval(() => {
      // On a besoin de l'instance io, qui n'est pas stockée ici pour l'instant
      // On va devoir la passer ou la stocker
      if (this.io) {
        // Vérifier s'il y a des clients connectés avant de faire l'update
        const connectedClients = this.io.sockets.sockets.size;
        if (connectedClients > 0) {
          this.updateLeaderboard(this.io);
        }
      }
    }, 10000);
  }

  setIo(io) {
    this.io = io;
  }

  /**
   * Créer une nouvelle session de jeu pour un utilisateur
   */
  async createGameSession(userId, username, avatar) {
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

    // Tentative de récupération depuis la base de données (si serveur redémarré)
    try {
      // On cherche une session active récente (moins de 10 min)
      const recentSession = await db.get(
        'SELECT * FROM game_sessions WHERE user_id = ? AND is_active = 1 AND end_time IS NULL ORDER BY start_time DESC LIMIT 1',
        [userId]
      );

      if (recentSession) {
        const timeDiff = Date.now() - new Date(recentSession.start_time).getTime();
        // Si moins de 2 heures (pour être large), on restaure
        if (timeDiff < 7200000) {
           console.log(`🔄 Session DB trouvée: ${recentSession.session_id} pour user ${userId}, restauration...`);
           const sessionId = recentSession.session_id;
           const gameState = new ServerGameState(sessionId, userId);
           
           // Restaurer l'état
           gameState.player.level = recentSession.level_reached || 0;
           gameState.player.gold = recentSession.gold_earned || 0;
           gameState.player.enemiesKilled = recentSession.enemies_killed || 0;
           gameState.player.bossDefeated = recentSession.boss_defeated === 1;
           gameState.player.lootBoxesFound = recentSession.loot_boxes_found || 0;
           
           // Enregistrer la session
           this.gameSessions.set(sessionId, gameState);
           this.userSessions.set(userId, sessionId);
           
           this.activeUsers.set(userId, {
             userId,
             username,
             avatar,
             isOnline: true,
             lastActivity: Date.now(),
             currentLevel: gameState.player.level,
             currentGold: gameState.player.gold
           });
           
           return { sessionId, gameState: gameState.getGameState() };
        }
      }
    } catch (e) {
      console.error('Erreur récupération session DB:', e);
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

    // SÉCURITÉ: Validation du niveau avant l'action
    const currentLevel = gameState.player.level;
    const currentGold = gameState.player.gold;
    
    // Si l'action contient un niveau, valider qu'il est cohérent
    if (data.level !== undefined) {
      // Le niveau ne peut pas diminuer (sauf restart qui est géré séparément)
      if (data.level < currentLevel && action !== 'restart') {
        console.warn(`⚠️ Tentative suspecte: user ${userId} essaie de réduire son niveau de ${currentLevel} à ${data.level}`);
        throw new Error('Niveau invalide: ne peut pas diminuer');
      }
      
      // Le niveau ne peut pas augmenter de plus de 1 par action (sauf si c'est un level_up explicite)
      if (data.level > currentLevel + 1 && action !== 'level_up') {
        console.warn(`⚠️ Tentative suspecte: user ${userId} essaie de sauter de niveau ${currentLevel} à ${data.level}`);
        throw new Error('Niveau invalide: progression suspecte');
      }
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

      // SÉCURITÉ: Vérifier que le niveau après l'action est cohérent
      const newLevel = gameState.player.level;
      if (newLevel < currentLevel && action !== 'restart') {
        console.error(`🚨 ALERTE SÉCURITÉ: user ${userId} a un niveau qui a diminué de ${currentLevel} à ${newLevel} après ${action}`);
        // Ne pas bloquer, mais logger pour investigation
      }
      
      // Mettre à jour l'activité de l'utilisateur avec le niveau réel de la session
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
   * ROBUSTE: Utilise toujours la session serveur comme source de vérité
   */
  updateUserActivity(userId, level, gold) {
    // SOURCE DE VÉRITÉ: Récupérer le niveau depuis la session serveur
    const session = this.getUserSession(userId);
    if (!session || !session.isActive || session.shouldBeDeleted()) {
      // Pas de session active, on ne peut pas mettre à jour
      return;
    }
    
    // Utiliser le niveau de la session serveur (source de vérité), pas les données client
    const sessionLevel = session.player.level;
    const sessionGold = session.player.gold;
    
    // Récupérer ou créer l'utilisateur dans activeUsers
    let user = this.activeUsers.get(userId);
    if (!user) {
      // L'utilisateur n'est pas dans activeUsers, l'ajouter avec les données de la session
      // Note: username/avatar seront mis à jour au prochain createGameSession
      this.activeUsers.set(userId, {
        userId,
        username: `User_${userId}`, // Valeur temporaire
        avatar: 'default',
        isOnline: true,
        lastActivity: Date.now(),
        currentLevel: sessionLevel,
        currentGold: sessionGold
      });
      user = this.activeUsers.get(userId);
    }
    
    // SÉCURITÉ: Validation - le niveau client ne peut pas être supérieur au niveau serveur
    // (sauf si le serveur n'a pas encore été mis à jour, auquel cas on accepte une différence de 1)
    if (level > sessionLevel + 1) {
      console.warn(`⚠️ Niveau client suspect pour user ${userId}: client=${level}, serveur=${sessionLevel}`);
      // Utiliser le niveau serveur (source de vérité)
      user.currentLevel = sessionLevel;
      user.currentGold = sessionGold;
    } else {
      // Le niveau client est cohérent, on peut l'utiliser (mais on préfère le serveur)
      // On utilise le max entre client et serveur pour éviter les désynchronisations
      user.currentLevel = Math.max(level, sessionLevel);
      user.currentGold = Math.max(gold || 0, sessionGold);
    }
    
    user.lastActivity = Date.now();
  }

  /**
   * Synchroniser les utilisateurs actifs avec les sessions en cours
   * OPTIMISÉ: Met à jour uniquement les utilisateurs qui ont changé
   */
  syncActiveUsers() {
    let updated = 0;
    // Parcourir toutes les sessions actives et mettre à jour activeUsers
    for (const [sessionId, session] of this.gameSessions) {
      if (session.isActive && !session.shouldBeDeleted()) {
        const userId = session.userId;
        const user = this.activeUsers.get(userId);
        
        if (user) {
          // OPTIMISATION: Ne mettre à jour que si le niveau a changé
          const sessionLevel = session.player.level;
          const sessionGold = session.player.gold;
          
          if (user.currentLevel !== sessionLevel || user.currentGold !== sessionGold) {
            user.currentLevel = sessionLevel;
            user.currentGold = sessionGold;
            user.lastActivity = Date.now();
            updated++;
          }
        } else {
          // Si l'utilisateur n'est pas dans activeUsers, on ne peut pas le récupérer ici
          // car on n'a pas username/avatar. On attendra la prochaine authentification.
        }
      }
    }
    
    // Log uniquement si des mises à jour significatives
    if (updated > 5) {
      console.log(`🔄 ${updated} utilisateur(s) synchronisé(s) avec leurs sessions actives`);
    }
  }

  /**
   * Obtenir les utilisateurs actifs avec leurs niveaux actuels synchronisés
   * ROBUSTE: Garantit que le niveau vient toujours de la session active
   */
  getActiveUsers() {
    // Synchroniser avant de retourner pour avoir les niveaux à jour
    this.syncActiveUsers();
    
    // DOUBLE VÉRIFICATION: S'assurer que chaque utilisateur a le bon niveau depuis sa session
    const result = Array.from(this.activeUsers.values()).map(user => {
      const session = this.getUserSession(user.userId);
      if (session && session.isActive && !session.shouldBeDeleted()) {
        // Forcer la synchronisation du niveau depuis la session active
        const sessionLevel = session.player.level;
        const sessionGold = session.player.gold;
        
        // Si le niveau diffère, le corriger immédiatement
        if (user.currentLevel !== sessionLevel || user.currentGold !== sessionGold) {
          user.currentLevel = sessionLevel;
          user.currentGold = sessionGold;
          user.lastActivity = Date.now();
          
          // Log uniquement en cas de correction importante (différence > 1)
          if (Math.abs(user.currentLevel - sessionLevel) > 1) {
            console.log(`🔧 Correction niveau pour ${user.username}: ${user.currentLevel} -> ${sessionLevel}`);
          }
        }
      }
      return user;
    });
    
    return result;
  }

  /**
   * Mettre à jour le classement
   */
  async updateLeaderboard(io) {
    try {
      console.log('🔄 Mise à jour du classement...');
      
      // Synchroniser les utilisateurs actifs avant la mise à jour
      this.syncActiveUsers();
      
      // Mettre à jour le classement dans la base de données
      const changes = await db.updateLeaderboard();
      console.log(`📊 Classement mis à jour: ${changes} changements`);
      
      // Récupérer le nouveau classement
      this.leaderboard = await db.getLeaderboard(50);
      
      // Enrichir le leaderboard avec les niveaux actuels des sessions actives
      // Cela permet d'afficher le niveau en temps réel pour les joueurs connectés
      const activeUsersMap = new Map();
      for (const user of this.activeUsers.values()) {
        activeUsersMap.set(user.userId, user);
      }
      
      // Enrichir chaque entrée du leaderboard avec le niveau actuel si le joueur est en ligne
      this.leaderboard = this.leaderboard.map(player => {
        const activeUser = activeUsersMap.get(player.user_id);
        if (activeUser) {
          // Utiliser le niveau actuel de la session active (sécurisé car vient de la session serveur)
          return {
            ...player,
            currentLevel: activeUser.currentLevel || player.best_level
          };
        }
        // Si le joueur n'est pas en ligne, utiliser le meilleur niveau historique
        return {
          ...player,
          currentLevel: player.best_level
        };
      });
      
      this.lastLeaderboardUpdate = Date.now();
      
      // Diffuser à tous les clients
      if (io) {
        io.to('leaderboard').emit('leaderboard_update', {
          leaderboard: this.leaderboard,
          timestamp: this.lastLeaderboardUpdate
        });

        // Diffuser aussi les joueurs en ligne (avec niveaux synchronisés)
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
