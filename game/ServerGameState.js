const { db } = require('../database/db');

/**
 * ServerGameState - Gère l'état complet du jeu côté serveur
 * Chaque session de jeu a son propre état isolé
 */
class ServerGameState {
  constructor(sessionId, userId) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.isActive = true;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.isDead = false; // Nouveau: état de mort
    this.isAbandoned = false; // Nouveau: état d'abandon
    
    // État du joueur (géré côté serveur) - Valeurs par défaut plus élevées
    this.player = {
      level: 0,
      gold: 0,
      maxHealth: 1000, // Augmenté de 100 à 1000
      currentHealth: 1000, // Augmenté de 100 à 1000
      damage: 200, // Augmenté de 10 à 200
      criticalHitChance: 0.01, // 1%
      criticalHitDamagePercent: 1.5, // 150%
      enemiesKilled: 0,
      bossDefeated: false
    };
    
    // État de l'ennemi actuel
    this.enemy = null;
    this.isFighting = false;
    this.fightStartTime = null;
    
    // Améliorations passives de la session
    this.passiveUpgrades = [];
    this.bossPassives = [];
    
    // Historique des actions pour validation
    this.actionHistory = [];
    
    console.log(`🎮 ServerGameState créé pour session ${sessionId}, user ${userId}`);
  }

  /**
   * Démarrer un nouveau combat
   */
  startFight() {
    if (this.isFighting) {
      return { success: false, message: 'Déjà en combat' };
    }

    // Créer un nouvel ennemi basé sur le niveau
    this.enemy = this.createEnemy();
    this.isFighting = true;
    this.fightStartTime = Date.now();
    
    this.logAction('start_fight', { enemyLevel: this.enemy.level });
    
    return {
      success: true,
      enemy: {
        level: this.enemy.level,
        health: this.enemy.health,
        maxHealth: this.enemy.maxHealth,
        damage: this.enemy.damage,
        isBoss: this.enemy.isBoss
      }
    };
  }

  /**
   * Arrêter le combat
   */
  stopFight() {
    if (!this.isFighting) {
      return { success: false, message: 'Pas en combat' };
    }

    this.isFighting = false;
    this.enemy = null;
    this.fightStartTime = null;
    
    this.logAction('stop_fight', {});
    
    return { success: true };
  }

  /**
   * Effectuer une attaque
   */
  performAttack() {
    if (!this.isFighting || !this.enemy) {
      return { success: false, message: 'Pas en combat' };
    }

    const attackResult = this.calculateAttack();
    
    // Appliquer les dégâts à l'ennemi
    this.enemy.health -= attackResult.damage;
    
    this.logAction('attack', {
      damage: attackResult.damage,
      isCritical: attackResult.isCritical,
      enemyHealth: this.enemy.health
    });

    // Vérifier si l'ennemi est mort
    if (this.enemy.health <= 0) {
      return this.handleEnemyDefeat();
    }

    // L'ennemi attaque en retour
    const enemyAttack = this.calculateEnemyAttack();
    this.player.currentHealth -= enemyAttack.damage;
    
    this.logAction('enemy_attack', {
      damage: enemyAttack.damage,
      playerHealth: this.player.currentHealth
    });

    // Vérifier si le joueur est mort
    if (this.player.currentHealth <= 0) {
      return this.handlePlayerDefeat();
    }

    return {
      success: true,
      attackResult,
      enemyAttack,
      gameState: this.getGameState()
    };
  }

  /**
   * Soigner le joueur
   */
  heal() {
    if (this.player.currentHealth >= this.player.maxHealth) {
      return { success: false, message: 'Santé déjà au maximum' };
    }

    const healCost = 5;
    if (this.player.gold < healCost) {
      return { success: false, message: 'Or insuffisant' };
    }

    this.player.gold -= healCost;
    this.player.currentHealth = this.player.maxHealth;
    
    this.logAction('heal', { cost: healCost, newHealth: this.player.currentHealth });
    
    return {
      success: true,
      message: 'Soigné avec succès',
      gameState: this.getGameState()
    };
  }

  /**
   * Acheter une amélioration
   */
  buyUpgrade(upgradeType) {
    const upgradeCosts = {
      health: 10,
      damage: 15,
      crit_chance: 20,
      crit_damage: 25
    };

    const cost = upgradeCosts[upgradeType];
    if (!cost) {
      return { success: false, message: 'Type d\'amélioration invalide' };
    }

    if (this.player.gold < cost) {
      return { success: false, message: 'Or insuffisant' };
    }

    this.player.gold -= cost;
    
    switch (upgradeType) {
      case 'health':
        this.player.maxHealth += 20;
        this.player.currentHealth += 20;
        break;
      case 'damage':
        this.player.damage += 5;
        break;
      case 'crit_chance':
        this.player.criticalHitChance = Math.min(0.5, this.player.criticalHitChance + 0.05);
        break;
      case 'crit_damage':
        this.player.criticalHitDamagePercent += 0.2;
        break;
    }

    this.logAction('upgrade', {
      type: upgradeType,
      cost: cost,
      newStats: {
        maxHealth: this.player.maxHealth,
        damage: this.player.damage,
        critChance: this.player.criticalHitChance,
        critDamage: this.player.criticalHitDamagePercent
      }
    });

    return {
      success: true,
      message: `Amélioration ${upgradeType} achetée`,
      gameState: this.getGameState()
    };
  }

  /**
   * Sauvegarder une amélioration passive
   */
  savePassiveUpgrade(upgrade) {
    this.passiveUpgrades.push({
      ...upgrade,
      timestamp: Date.now()
    });
    
    this.logAction('passive_upgrade', upgrade);
    return { success: true };
  }

  /**
   * Sauvegarder un passif de boss
   */
  saveBossPassive(bossPassive) {
    this.bossPassives.push({
      ...bossPassive,
      timestamp: Date.now()
    });
    
    this.logAction('boss_passive', bossPassive);
    return { success: true };
  }

  /**
   * Obtenir l'état actuel du jeu
   */
  getGameState() {
    return {
      player: { ...this.player },
      enemy: this.enemy ? { ...this.enemy } : null,
      isFighting: this.isFighting,
      sessionId: this.sessionId,
      level: this.player.level,
      gold: this.player.gold
    };
  }

  /**
   * Obtenir les passifs de la session
   */
  getSessionPassives() {
    return {
      passiveUpgrades: [...this.passiveUpgrades],
      bossPassives: [...this.bossPassives]
    };
  }

  /**
   * Créer un ennemi basé sur le niveau
   */
  createEnemy() {
    const level = this.player.level;
    const isBoss = level > 0 && level % 5 === 0; // Boss tous les 5 niveaux
    
    const baseHealth = isBoss ? 200 : 50;
    const baseDamage = isBoss ? 15 : 8;
    
    return {
      level: level,
      health: baseHealth + (level * 10),
      maxHealth: baseHealth + (level * 10),
      damage: baseDamage + (level * 2),
      isBoss: isBoss,
      goldReward: isBoss ? 20 : 5
    };
  }

  /**
   * Calculer les dégâts d'attaque du joueur
   */
  calculateAttack() {
    const baseDamage = this.player.damage;
    const isCritical = Math.random() < this.player.criticalHitChance;
    
    let damage = baseDamage;
    if (isCritical) {
      damage = Math.floor(baseDamage * this.player.criticalHitDamagePercent);
    }

    return {
      damage,
      isCritical,
      baseDamage
    };
  }

  /**
   * Calculer l'attaque de l'ennemi
   */
  calculateEnemyAttack() {
    if (!this.enemy) return { damage: 0 };
    
    return {
      damage: this.enemy.damage
    };
  }

  /**
   * Gérer la défaite de l'ennemi
   */
  handleEnemyDefeat() {
    this.isFighting = false;
    this.player.gold += this.enemy.goldReward;
    this.player.enemiesKilled++;
    
    // Vérifier si c'est un boss
    if (this.enemy.isBoss) {
      this.player.bossDefeated = true;
    }
    
    // Passer au niveau suivant
    this.player.level++;
    
    // Sauvegarder le score
    this.saveScore();
    
    this.logAction('enemy_defeated', {
      level: this.player.level,
      goldEarned: this.enemy.goldReward,
      isBoss: this.enemy.isBoss
    });

    const result = {
      success: true,
      victory: true,
      levelUp: true,
      newLevel: this.player.level,
      goldEarned: this.enemy.goldReward,
      isBoss: this.enemy.isBoss,
      gameState: this.getGameState()
    };

    this.enemy = null;
    return result;
  }

  /**
   * Gérer la défaite du joueur
   */
  handlePlayerDefeat() {
    this.isFighting = false;
    this.enemy = null;
    
    // Sauvegarder le score final
    this.saveScore();
    
    this.logAction('player_defeated', {
      finalLevel: this.player.level,
      finalGold: this.player.gold
    });

    return {
      success: true,
      defeat: true,
      finalLevel: this.player.level,
      finalGold: this.player.gold,
      gameState: this.getGameState()
    };
  }

  /**
   * Sauvegarder le score dans la base de données
   */
  async saveScore() {
    try {
      await db.submitScore(
        this.userId,
        this.sessionId,
        this.player.level,
        this.player.level, // score = level
        this.player.gold
      );
      
      await db.updateGameSession(this.sessionId, {
        level_reached: this.player.level,
        gold_earned: this.player.gold,
        enemies_killed: this.player.enemiesKilled,
        boss_defeated: this.player.bossDefeated
      });
      
      console.log(`💾 Score sauvegardé: user ${this.userId}, level ${this.player.level}, gold ${this.player.gold}`);
    } catch (error) {
      console.error('Erreur sauvegarde score:', error);
    }
  }

  /**
   * Enregistrer une action pour audit
   */
  logAction(action, data) {
    this.actionHistory.push({
      action,
      data,
      timestamp: Date.now()
    });
    
    this.lastActivity = Date.now();
    
    // Garder seulement les 100 dernières actions
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-100);
    }
  }

  /**
   * Vérifier si la session est valide
   */
  isValid() {
    return this.isActive && (Date.now() - this.lastActivity) < 300000; // 5 minutes d'inactivité max
  }

  /**
   * Désactiver la session
   */
  deactivate() {
    this.isActive = false;
    this.saveScore(); // Sauvegarder avant de désactiver
  }

  /**
   * Marquer le joueur comme mort
   */
  markAsDead() {
    this.isDead = true;
    this.isActive = false;
    this.isFighting = false;
    this.player.currentHealth = 0;
    console.log(`💀 Joueur marqué comme mort dans la session ${this.sessionId}`);
  }

  /**
   * Marquer la session comme abandonnée
   */
  markAsAbandoned() {
    this.isAbandoned = true;
    this.isActive = false;
    this.isFighting = false;
    console.log(`🚪 Session marquée comme abandonnée: ${this.sessionId}`);
  }

  /**
   * Vérifier si la session doit être supprimée
   */
  shouldBeDeleted() {
    return this.isDead || this.isAbandoned;
  }

  /**
   * Nettoyer les données anciennes
   */
  cleanup() {
    if (!this.isValid()) {
      this.deactivate();
      return true;
    }
    return false;
  }
}

module.exports = { ServerGameState };
