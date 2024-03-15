/**
 * ServerGameClient - Client pour le système de jeu côté serveur
 * Communique avec le serveur pour toutes les actions de jeu
 */
class ServerGameClient {
  constructor(onlineManager) {
    this.onlineManager = onlineManager;
    this.socket = onlineManager.socket;
    this.gameState = null;
    this.sessionId = null;
    this.isConnected = false;
    
    this.setupEventListeners();
  }

  /**
   * Configurer les écouteurs d'événements
   */
  setupEventListeners() {
    // Écouter les résultats d'actions de jeu
    this.socket.on('server_game_result', (data) => {
      this.handleGameResult(data);
    });

    // Écouter les mises à jour d'état de jeu
    this.socket.on('game_state', (data) => {
      this.gameState = data;
      this.updateGameUI();
    });

    // Écouter les passifs de session
    this.socket.on('session_passives', (data) => {
      this.handleSessionPassives(data);
    });

    // Écouter les erreurs
    this.socket.on('error', (error) => {
      console.error('Server game error:', error);
      this.showError(error.message);
    });
  }

  /**
   * Initialiser la session de jeu côté serveur
   */
  initializeGameSession(sessionId, initialGameState) {
    this.sessionId = sessionId;
    this.gameState = initialGameState;
    this.isConnected = true;
    
    this.updateGameUI();
  }

  /**
   * Démarrer un combat
   */
  startFight() {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('server_game_action', {
      action: 'start_fight',
      data: {}
    });
  }

  /**
   * Arrêter le combat
   */
  stopFight() {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('server_game_action', {
      action: 'stop_fight',
      data: {}
    });
  }

  /**
   * Effectuer une attaque
   */
  attack() {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('server_game_action', {
      action: 'attack',
      data: {}
    });
  }

  /**
   * Soigner le joueur
   */
  heal() {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('server_game_action', {
      action: 'heal',
      data: {}
    });
  }

  /**
   * Acheter une amélioration
   */
  buyUpgrade(upgradeType) {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('server_game_action', {
      action: 'upgrade',
      data: { upgradeType }
    });
  }

  /**
   * Sauvegarder une amélioration passive
   */
  savePassiveUpgrade(upgrade) {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('server_game_action', {
      action: 'save_passive',
      data: { upgrade }
    });
  }

  /**
   * Sauvegarder un passif de boss
   */
  saveBossPassive(bossPassive) {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('server_game_action', {
      action: 'save_boss_passive',
      data: { bossPassive }
    });
  }

  /**
   * Demander l'état actuel du jeu
   */
  requestGameState() {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('get_game_state');
  }

  /**
   * Demander les passifs de session
   */
  requestSessionPassives() {
    if (!this.isConnected) {
      console.error('Pas connecté au serveur');
      return;
    }

    this.socket.emit('get_session_passives');
  }

  /**
   * Gérer les résultats d'actions de jeu
   */
  handleGameResult(data) {
    console.log('🎮 Résultat action:', data);
    
    if (data.success) {
      this.gameState = data.gameState;
      this.updateGameUI();
      
      // Gérer les résultats spécifiques
      if (data.result.victory) {
        this.handleVictory(data.result);
      } else if (data.result.defeat) {
        this.handleDefeat(data.result);
      } else if (data.result.message) {
        this.showMessage(data.result.message);
      }
      
      // Déclencher les animations côté client
      this.triggerClientAnimations(data);
    } else {
      this.showError(data.result.message || 'Action échouée');
    }
  }

  /**
   * Gérer la victoire
   */
  handleVictory(result) {
    console.log('🏆 Victoire!', result);
    
    if (result.levelUp) {
      this.showLevelUpNotification(result.newLevel);
    }
    
    if (result.isNewRecord) {
      this.showNewRecordNotification(result.newLevel);
    }
    
    // Créer des particules de victoire
    this.createVictoryParticles();
    
    // Gérer la fin de combat côté client
    this.handleCombatEnd();
  }

  /**
   * Gérer la défaite
   */
  handleDefeat(result) {
    console.log('💀 Défaite!', result);
    this.showDefeatMessage();
    
    // Gérer la fin de combat côté client
    this.handleCombatEnd();
  }

  /**
   * Gérer la fin de combat
   */
  handleCombatEnd() {
    if (window.game && window.game.attackAnimation) {
      // Arrêter l'animation de combat
      window.game.attackAnimation.stopFight();
      
      // Supprimer l'ennemi
      if (window.game.attackAnimation.enemy) {
        window.game.attackAnimation.deleteEnemy();
      }
      
      // Mettre à jour l'UI
      window.game.updateUI();
    }
  }

  /**
   * Gérer les passifs de session
   */
  handleSessionPassives(data) {
    
    // Notifier le jeu pour restaurer les passifs
    if (window.game && window.game.restoreSessionPassives) {
      window.game.restoreSessionPassives(data);
    }
  }

  /**
   * Mettre à jour l'interface utilisateur
   */
  updateGameUI() {
    if (!this.gameState) return;

    // Mettre à jour les informations du joueur
    this.updatePlayerInfo();
    
    // Mettre à jour l'état de combat
    this.updateFightState();
    
    // Mettre à jour les boutons
    this.updateButtons();
    
    // Synchroniser l'état côté client avec le serveur
    this.syncClientState();
  }

  /**
   * Mettre à jour les informations du joueur
   */
  updatePlayerInfo() {
    const player = this.gameState.player;
    
    // Mettre à jour le niveau
    const levelElement = document.getElementById('level');
    if (levelElement) {
      levelElement.textContent = player.level;
    }
    
    // Mettre à jour l'or
    const goldElement = document.getElementById('gold');
    if (goldElement) {
      goldElement.textContent = player.gold;
    }
    
    // Mettre à jour la santé
    const healthElement = document.getElementById('health');
    if (healthElement) {
      healthElement.textContent = `${player.currentHealth}/${player.maxHealth}`;
    }
    
    // Mettre à jour les dégâts
    const damageElement = document.getElementById('damage');
    if (damageElement) {
      damageElement.textContent = player.damage;
    }
  }

  /**
   * Mettre à jour l'état de combat
   */
  updateFightState() {
    const enemy = this.gameState.enemy;
    const isFighting = this.gameState.isFighting;
    
    if (enemy && isFighting) {
      // Mettre à jour les informations de l'ennemi
      const enemyHealthElement = document.getElementById('enemy-health');
      if (enemyHealthElement) {
        enemyHealthElement.textContent = `${enemy.health}/${enemy.maxHealth}`;
      }
      
      const enemyLevelElement = document.getElementById('enemy-level');
      if (enemyLevelElement) {
        enemyLevelElement.textContent = enemy.level;
      }
    }
  }

  /**
   * Mettre à jour les boutons
   */
  updateButtons() {
    const player = this.gameState.player;
    const isFighting = this.gameState.isFighting;
    const enemy = this.gameState.enemy;
    
    // Bouton de combat
    const fightButton = document.getElementById('fight-button');
    if (fightButton) {
      fightButton.disabled = isFighting;
      fightButton.textContent = isFighting ? 'En combat...' : 'Combattre';
    }
    
    // Bouton d'arrêt
    const stopButton = document.getElementById('stop-button');
    if (stopButton) {
      stopButton.disabled = !isFighting;
    }
    
    // Bouton de soin
    const healButton = document.getElementById('heal-button');
    if (healButton) {
      healButton.disabled = player.gold < 5 || player.currentHealth >= player.maxHealth;
    }
  }

  /**
   * Afficher une notification de montée de niveau
   */
  showLevelUpNotification(level) {
    const notification = document.createElement('div');
    notification.className = 'level-up-notification';
    notification.innerHTML = `
      <div class="level-up-content">
        <div class="level-up-icon">🎉</div>
        <div class="level-up-text">Niveau ${level} atteint !</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 500);
    }, 3000);
  }

  /**
   * Afficher une notification de nouveau record
   */
  showNewRecordNotification(level) {
    const notification = document.createElement('div');
    notification.className = 'record-notification';
    notification.innerHTML = `
      <div class="record-content">
        <div class="record-icon">🏆</div>
        <div class="record-text">
          <div class="record-title">NOUVEAU RECORD !</div>
          <div class="record-details">Niveau ${level} atteint !</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 500);
    }, 5000);
  }

  /**
   * Afficher un message de défaite
   */
  showDefeatMessage() {
    const notification = document.createElement('div');
    notification.className = 'defeat-notification';
    notification.innerHTML = `
      <div class="defeat-content">
        <div class="defeat-icon">💀</div>
        <div class="defeat-text">Défaite !</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 500);
    }, 3000);
  }

  /**
   * Créer des particules de victoire
   */
  createVictoryParticles() {
    // Utiliser AnimationUtils si disponible
    if (window.AnimationUtils && window.AnimationUtils.createParticles) {
      const playerElement = document.getElementById('player');
      if (playerElement) {
        window.AnimationUtils.createParticles(playerElement, 8);
      }
    }
  }

  /**
   * Afficher un message
   */
  showMessage(message) {
    console.log('📢 Message:', message);
    // Implémenter l'affichage de message si nécessaire
  }

  /**
   * Afficher une erreur
   */
  showError(message) {
    console.error('❌ Erreur:', message);
    // Implémenter l'affichage d'erreur si nécessaire
  }

  /**
   * Obtenir l'état actuel du jeu
   */
  getGameState() {
    return this.gameState;
  }

  /**
   * Déclencher les animations côté client
   */
  triggerClientAnimations(data) {
    const { action, result } = data;
    
    switch (action) {
      case 'start_fight':
        this.triggerStartFightAnimation(result);
        break;
        
      case 'attack':
        this.triggerAttackAnimation(result);
        break;
        
      case 'heal':
        this.triggerHealAnimation(result);
        break;
        
      case 'upgrade':
        this.triggerUpgradeAnimation(result);
        break;
    }
  }

  /**
   * Déclencher l'animation de début de combat
   */
  triggerStartFightAnimation(result) {
    if (result.enemy && window.game && window.game.attackAnimation) {
      // Créer un ennemi côté client pour les animations
      const enemy = window.game.createEnemies.createSquareEnemy(false);
      if (enemy) {
        // Mettre à jour les stats de l'ennemi avec les données serveur
        enemy.health = result.enemy.health;
        enemy.maxHealth = result.enemy.maxHealth;
        enemy.damage = result.enemy.damage;
        enemy.level = result.enemy.level;
        enemy.isBoss = result.enemy.isBoss;
        
        // Démarrer l'animation de combat
        window.game.attackAnimation.startFight();
      }
    }
  }

  /**
   * Déclencher l'animation d'attaque
   */
  triggerAttackAnimation(result) {
    if (window.game && window.game.attackAnimation && window.game.attackAnimation.isPlayerFighting()) {
      // Déclencher l'attaque côté client
      window.game.attackAnimation.playerAttack();
      
      // Mettre à jour les stats après l'attaque
      if (result.attackResult) {
        // Mettre à jour la santé de l'ennemi
        if (window.game.attackAnimation.enemy) {
          window.game.attackAnimation.enemy.health = result.attackResult.enemyHealth || window.game.attackAnimation.enemy.health;
        }
        
        // Mettre à jour la santé du joueur
        if (result.enemyAttack) {
          window.game.player.currentHealth = result.enemyAttack.playerHealth || window.game.player.currentHealth;
        }
      }
    }
  }

  /**
   * Déclencher l'animation de soin
   */
  triggerHealAnimation(result) {
    if (window.game && window.game.player) {
      // Animation de soin
      window.game.player.resetHealth();
      
      // Son de soin
      if (window.audioManager) {
        window.audioManager.play('heal');
      }
    }
  }

  /**
   * Déclencher l'animation d'amélioration
   */
  triggerUpgradeAnimation(result) {
    // Animation d'amélioration
    if (window.AnimationUtils) {
      const upgradeElement = document.querySelector('.upgrade-option');
      if (upgradeElement) {
        window.AnimationUtils.animateUpgradeOption(upgradeElement);
      }
    }
  }

  /**
   * Synchroniser l'état côté client avec le serveur
   */
  syncClientState() {
    if (!this.gameState || !window.game) return;
    // Ne pas écraser l'état local juste après un restart local
    if (window.game.suppressSyncUntil && Date.now() < window.game.suppressSyncUntil) {
      return;
    }
    
    const player = this.gameState.player;
    
    
    // Synchroniser le joueur côté client
    if (window.game.player) {
      // CORRECTION: Toujours synchroniser le niveau
      if (player.level !== undefined && player.level >= 0) {
        window.game.player.gold = player.gold;
        window.game.player.maxHealth = player.maxHealth;
        window.game.player.currentHealth = player.currentHealth;
        window.game.player.damage.setDamage(player.damage);
        window.game.player.criticalHitChance = player.criticalHitChance;
        window.game.player.criticalHitDamagePercent = player.criticalHitDamagePercent;
        
        // Mettre à jour l'affichage
        window.game.player.updateHealth();
        window.game.player.updateGoldAmount();
        
      }
      
      // Synchroniser les passifs
      if (this.gameState.passiveUpgrades) {
        window.game.player.passiveUpgrades = this.gameState.passiveUpgrades;
      }
      if (this.gameState.bossPassives) {
        window.game.player.bossPassives = this.gameState.bossPassives;
      }
    }
    
    // CORRECTION: Toujours synchroniser le niveau
    if (window.game.level && player.level !== undefined && player.level >= 0) {
      window.game.level.setLevel(player.level);
    }
    
    // Synchroniser l'ennemi si en combat
    if (this.gameState.isFighting && this.gameState.enemy && window.game.attackAnimation && window.game.attackAnimation.enemy) {
      const enemy = window.game.attackAnimation.enemy;
      const serverEnemy = this.gameState.enemy;
      
      enemy.health = serverEnemy.health;
      enemy.maxHealth = serverEnemy.maxHealth;
      enemy.damage = serverEnemy.damage;
      enemy.level = serverEnemy.level;
      enemy.isBoss = serverEnemy.isBoss;
      
      // Mettre à jour l'affichage de la santé de l'ennemi
      enemy.updateHealth();
    }
    
    // Mettre à jour l'UI
    window.game.updateUI();
  }

  /**
   * Vérifier si connecté
   */
  isConnectedToServer() {
    return this.isConnected;
  }
}

// Rendre ServerGameClient global
window.ServerGameClient = ServerGameClient;



