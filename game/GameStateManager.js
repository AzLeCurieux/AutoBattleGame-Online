/**
 * Gestionnaire d'état de jeu avec base de données
 * Utilise la base de données pour la persistance
 */

const { db } = require('../database/db');

class GameStateManager {
  constructor() {
    this.cleanupInterval = null;
    // Désactivé: nettoyage fréquent. On ne nettoie que sur mort/abandon,
    // ou via un balayage peu fréquent (1h).
    this.startCleanupTimer();
  }

  // Démarrer le timer de nettoyage
  startCleanupTimer() {
    // Balayage peu fréquent: 1h
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveGames();
    }, 60 * 60 * 1000);
  }

  // Arrêter le timer de nettoyage
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Créer une nouvelle partie
  async createGame(userId, username, avatar) {
    const gameState = {
      userId,
      username,
      avatar,
      sessionId: `session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      runId: `run_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
      player: {
        level: 0,
        gold: 0,
        maxHealth: 1000,
        currentHealth: 1000,
        damage: 200,
        criticalHitChance: 0.01,
        criticalHitDamagePercent: 1.5,
        enemiesKilled: 0,
        bossDefeated: false
      },
      passiveUpgrades: [],
      bossPassives: []
    };

    // Sauvegarder en base de données
    await this.saveGameStateToDB(gameState);
    
    return gameState;
  }

  // Récupérer une partie existante depuis la base de données
  async getGame(userId) {
    try {
      const gameState = await db.get(
        'SELECT * FROM game_states WHERE user_id = ? AND is_active = 1',
        [userId]
      );
      
      if (gameState) {
        return {
          userId: gameState.user_id,
          username: gameState.username,
          avatar: gameState.avatar,
          sessionId: gameState.session_id,
          runId: gameState.run_id,
          createdAt: gameState.created_at,
          lastActivity: gameState.last_activity,
          isActive: gameState.is_active,
          player: JSON.parse(gameState.player_data),
          passiveUpgrades: JSON.parse(gameState.passive_upgrades || '[]'),
          bossPassives: JSON.parse(gameState.boss_passives || '[]')
        };
      }
      return null;
    } catch (error) {
      console.error('Erreur récupération partie:', error);
      return null;
    }
  }

  // Restaurer une partie après rafraîchissement de page
  async restoreGame(userId) {
    try {
      const gameState = await this.getGame(userId);
      if (!gameState) {
        return null;
      }

      // Vérifier que la partie n'est pas trop ancienne (2h max)
      const maxAge = 2 * 60 * 60 * 1000;
      if (Date.now() - gameState.createdAt > maxAge) {
        await this.endGame(userId, 'expired');
        return null;
      }

      // Mettre à jour l'activité
      gameState.lastActivity = Date.now();
      await this.saveGameStateToDB(gameState);
      
      return gameState;
    } catch (error) {
      console.error('Erreur restauration partie:', error);
      return null;
    }
  }

  // Sauvegarder l'état de jeu en base de données
  async saveGameStateToDB(gameState) {
    try {
      await db.run(`
        INSERT OR REPLACE INTO game_states 
        (user_id, username, avatar, session_id, run_id, created_at, last_activity, is_active, player_data, passive_upgrades, boss_passives)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        gameState.userId,
        gameState.username,
        gameState.avatar,
        gameState.sessionId,
        gameState.runId,
        gameState.createdAt,
        gameState.lastActivity,
        gameState.isActive ? 1 : 0,
        JSON.stringify(gameState.player),
        JSON.stringify(gameState.passiveUpgrades),
        JSON.stringify(gameState.bossPassives)
      ]);
    } catch (error) {
      console.error('Erreur sauvegarde partie:', error);
    }
  }

  // Mettre à jour l'état de jeu
  async updateGameState(userId, updates) {
    try {
      const gameState = await this.getGame(userId);
      if (!gameState) return false;

      // Mettre à jour les propriétés
      Object.assign(gameState, updates);
      gameState.lastActivity = Date.now();

      // Sauvegarder en base de données
      await this.saveGameStateToDB(gameState);
      return true;
    } catch (error) {
      console.error('Erreur mise à jour état:', error);
      return false;
    }
  }

  // Mettre à jour le joueur
  async updatePlayer(userId, playerUpdates) {
    try {
      const gameState = await this.getGame(userId);
      if (!gameState) return false;

      Object.assign(gameState.player, playerUpdates);
      gameState.lastActivity = Date.now();
      
      // Sauvegarder en base de données
      await this.saveGameStateToDB(gameState);
      return true;
    } catch (error) {
      console.error('Erreur mise à jour joueur:', error);
      return false;
    }
  }

  // Ajouter une amélioration passive
  async addPassiveUpgrade(userId, upgrade) {
    try {
      const gameState = await this.getGame(userId);
      if (!gameState) return false;

      gameState.passiveUpgrades.push({
        ...upgrade,
        timestamp: Date.now()
      });
      gameState.lastActivity = Date.now();
      
      // Sauvegarder en base de données
      await this.saveGameStateToDB(gameState);
      return true;
    } catch (error) {
      console.error('Erreur ajout amélioration passive:', error);
      return false;
    }
  }

  // Ajouter une amélioration de boss
  async addBossPassive(userId, bossPassive) {
    try {
      const gameState = await this.getGame(userId);
      if (!gameState) return false;

      gameState.bossPassives.push({
        ...bossPassive,
        timestamp: Date.now()
      });
      gameState.lastActivity = Date.now();
      
      // Sauvegarder en base de données
      await this.saveGameStateToDB(gameState);
      return true;
    } catch (error) {
      console.error('Erreur ajout amélioration boss:', error);
      return false;
    }
  }

  // Marquer la partie comme terminée
  async endGame(userId, reason = 'completed') {
    try {
      await db.run(
        'UPDATE game_states SET is_active = 0, ended_at = ?, end_reason = ? WHERE user_id = ?',
        [Date.now(), reason, userId]
      );
      
      return true;
    } catch (error) {
      console.error('Erreur fin de partie:', error);
      return false;
    }
  }

  // Nettoyer les parties inactives
  async cleanupInactiveGames() {
    try {
      // Politique douce: on ne force pas les runs à s'arrêter avant 24h d'inactivité
      const maxInactivity = 24 * 60 * 60 * 1000; // 24 heures
      const cutoffTime = Date.now() - maxInactivity;
      await db.run(
        'UPDATE game_states SET is_active = 0, end_reason = ? WHERE last_activity < ? AND is_active = 1',
        ['inactive', cutoffTime]
      );
    } catch (error) {
      console.error('Erreur nettoyage parties:', error);
    }
  }

  // Obtenir toutes les parties actives
  async getActiveGames() {
    try {
      const games = await db.all('SELECT * FROM game_states WHERE is_active = 1');
      return games.map(game => ({
        userId: game.user_id,
        username: game.username,
        avatar: game.avatar,
        sessionId: game.session_id,
        runId: game.run_id,
        createdAt: game.created_at,
        lastActivity: game.last_activity,
        isActive: game.is_active,
        player: JSON.parse(game.player_data),
        passiveUpgrades: JSON.parse(game.passive_upgrades || '[]'),
        bossPassives: JSON.parse(game.boss_passives || '[]')
      }));
    } catch (error) {
      console.error('Erreur récupération parties actives:', error);
      return [];
    }
  }

  // Obtenir le nombre de parties actives
  async getActiveGameCount() {
    try {
      const result = await db.get('SELECT COUNT(*) as count FROM game_states WHERE is_active = 1');
      return result.count;
    } catch (error) {
      console.error('Erreur comptage parties:', error);
      return 0;
    }
  }
}

module.exports = GameStateManager;
