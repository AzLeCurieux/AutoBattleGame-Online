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
      criticalHitChance: 1, // 1% (valeur en pourcentage)
      criticalHitDamagePercent: 50, // 50% de bonus (donne 1.5x les dégâts)
      enemiesKilled: 0,
      bossDefeated: false,
      lootBoxesFound: 0 // Nouveau: suivi des caisses dropées
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
        // Ajouter le pourcentage (ex: +2% = +2)
        this.player.criticalHitChance = Math.min(50, this.player.criticalHitChance + (upgradeValue || 2));
        break;
      case 'crit_damage':
        // Ajouter le pourcentage (ex: +10% = +10)
        this.player.criticalHitDamagePercent += upgradeValue || 10;
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
    const isCritical = Math.random() < (this.player.criticalHitChance / 100);
    
    let damage = baseDamage;
    if (isCritical) {
      // Dégâts critiques : base + (base * pourcentage / 100)
      // Exemple: 200 dégâts de base, 50% crit = 200 * (1 + 50/100) = 200 * 1.5 = 300
      damage = Math.floor(baseDamage * (1 + this.player.criticalHitDamagePercent / 100));
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
    
    // Sauvegarder la progression (niveau)
    this.saveProgress();
    
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
    
    // Sauvegarder les stats finales
    this.saveFinalStats();
    
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
   * Incrémenter le nombre de caisses trouvées
   */
  incrementLootBoxesFound(count = 1) {
    this.player.lootBoxesFound += count;
    // Pas de sauvegarde immédiate pour les caisses, seulement à la fin
  }

  /**
   * Sauvegarder la progression (Niveau uniquement)
   */
  async saveProgress() {
    try {
      // On met à jour seulement le niveau dans la session pour le leaderboard en temps réel
      await db.updateGameSession(this.sessionId, {
        level_reached: this.player.level,
        enemies_killed: this.player.enemiesKilled,
        boss_defeated: this.player.bossDefeated
      });
      
      // On insère un score pour le leaderboard (basé sur le niveau)
      await db.submitScore(
        this.userId,
        this.sessionId,
        this.player.level,
        this.player.level, // score = level
        0 // On ne sauvegarde pas l'or ici pour ne pas fausser les stats si on utilisait SUM(scores.gold)
      );
    } catch (error) {
      console.error('Erreur sauvegarde progression:', error);
    }
  }

  /**
   * Sauvegarder les stats finales (Or, Caisses, Niveau final)
   */
  async saveFinalStats() {
    try {
      await db.updateGameSession(this.sessionId, {
        level_reached: this.player.level,
        gold_earned: this.player.gold, // Sauvegarde de l'or total de la session
        enemies_killed: this.player.enemiesKilled,
        boss_defeated: this.player.bossDefeated,
        loot_boxes_found: this.player.lootBoxesFound,
        end_time: new Date().toISOString(),
        is_active: 0
      });
      
      // Un dernier score pour la forme
      await db.submitScore(
        this.userId,
        this.sessionId,
        this.player.level,
        this.player.level,
        this.player.gold
      );
      
      console.log(`💾 Stats finales sauvegardées: user ${this.userId}, level ${this.player.level}, gold ${this.player.gold}, boxes ${this.player.lootBoxesFound}`);
    } catch (error) {
      console.error('Erreur sauvegarde stats finales:', error);
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
    this.saveFinalStats(); // Sauvegarder les stats finales avant de désactiver
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
