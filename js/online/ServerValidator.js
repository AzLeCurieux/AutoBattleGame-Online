/**
 * ServerValidator - Système de validation côté serveur en arrière-plan
 * Valide les actions du joueur sans interférer avec le gameplay
 */
class ServerValidator {
  constructor(onlineManager) {
    this.onlineManager = onlineManager;
    this.socket = onlineManager.socket;
    this.isActive = false;
    this.lastValidation = 0;
    this.validationCooldown = 2000; // 2 secondes entre les validations
    
    this.setupEventListeners();
  }

  /**
   * Configurer les écouteurs d'événements
   */
  setupEventListeners() {
    // Écouter les réponses de validation
    this.socket.on('server_validation_result', (data) => {
      this.handleValidationResult(data);
    });

    // Écouter les avertissements de sécurité
    this.socket.on('security_warning', (data) => {
      this.handleSecurityWarning(data);
    });
  }

  /**
   * Activer la validation
   */
  activate() {
    this.isActive = true;
    console.log('🔒 Validation côté serveur activée');
  }

  /**
   * Désactiver la validation
   */
  deactivate() {
    this.isActive = false;
    console.log('🔓 Validation côté serveur désactivée');
  }

  /**
   * Valider une action de jeu
   */
  validateAction(action, data) {
    if (!this.isActive) return;

    const now = Date.now();
    if (now - this.lastValidation < this.validationCooldown) {
      return; // Trop tôt pour une nouvelle validation
    }

    this.lastValidation = now;

    // Envoyer la validation au serveur
    this.socket.emit('validate_game_action', {
      action,
      data,
      timestamp: now
    });
  }

  /**
   * Valider l'état du joueur
   */
  validatePlayerState() {
    if (!this.isActive || !window.game) return;

    const player = window.game.player;
    const level = window.game.level;

    const playerState = {
      level: level.getLevel(),
      gold: player.getGold(),
      maxHealth: player.getMaxHealth(),
      currentHealth: player.getCurrentHealth(),
      damage: player.getDamage(),
      criticalHitChance: player.criticalHitChance,
      criticalHitDamagePercent: player.criticalHitDamagePercent
    };

    this.validateAction('player_state', playerState);
  }

  /**
   * Valider une action de combat
   */
  validateCombatAction(action, enemyData = null) {
    if (!this.isActive) return;

    const data = {
      playerLevel: window.game.level.getLevel(),
      playerGold: window.game.player.getGold(),
      timestamp: Date.now()
    };

    if (enemyData) {
      data.enemy = enemyData;
    }

    this.validateAction(`combat_${action}`, data);
  }

  /**
   * Valider une amélioration
   */
  validateUpgrade(upgradeType, cost) {
    if (!this.isActive) return;

    const data = {
      upgradeType,
      cost,
      playerGold: window.game.player.getGold(),
      timestamp: Date.now()
    };

    this.validateAction('upgrade', data);
  }

  /**
   * Valider un soin
   */
  validateHeal(cost) {
    if (!this.isActive) return;

    const data = {
      cost,
      playerGold: window.game.player.getGold(),
      playerHealth: window.game.player.getCurrentHealth(),
      playerMaxHealth: window.game.player.getMaxHealth(),
      timestamp: Date.now()
    };

    this.validateAction('heal', data);
  }

  /**
   * Gérer le résultat de validation
   */
  handleValidationResult(data) {
    if (data.valid) {
      // Validation réussie
      if (data.warning) {
        console.warn('⚠️ Avertissement de validation:', data.warning);
      }
    } else {
      // Validation échouée
      console.error('❌ Validation échouée:', data.reason);
      this.handleValidationFailure(data);
    }
  }

  /**
   * Gérer l'échec de validation
   */
  handleValidationFailure(data) {
    // Afficher un avertissement à l'utilisateur
    this.showValidationWarning(data.reason);
    
    // Optionnel : corriger l'état si nécessaire
    if (data.correction) {
      this.applyCorrection(data.correction);
    }
  }

  /**
   * Gérer un avertissement de sécurité
   */
  handleSecurityWarning(data) {
    console.warn('🚨 Avertissement de sécurité:', data.message);
    this.showSecurityWarning(data.message, data.type);
  }

  /**
   * Afficher un avertissement de validation
   */
  showValidationWarning(message) {
    const notification = document.createElement('div');
    notification.className = 'validation-warning';
    notification.innerHTML = `
      <div class="warning-content">
        <div class="warning-icon">⚠️</div>
        <div class="warning-text">
          <div class="warning-title">Validation</div>
          <div class="warning-message">${message}</div>
        </div>
        <button class="warning-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Afficher un avertissement de sécurité
   */
  showSecurityWarning(message, type) {
    const notification = document.createElement('div');
    notification.className = 'security-warning';
    notification.innerHTML = `
      <div class="warning-content">
        <div class="warning-icon">🚨</div>
        <div class="warning-text">
          <div class="warning-title">Sécurité</div>
          <div class="warning-message">${message}</div>
        </div>
        <button class="warning-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  }

  /**
   * Appliquer une correction
   */
  applyCorrection(correction) {
    if (!window.game) return;

    console.log('🔧 Application de correction:', correction);

    // Appliquer les corrections
    if (correction.gold !== undefined) {
      window.game.player.gold = correction.gold;
      window.game.player.updateGoldAmount();
    }

    if (correction.health !== undefined) {
      window.game.player.currentHealth = correction.health;
      window.game.player.updateHealth();
    }

    if (correction.level !== undefined) {
      window.game.level.setLevel(correction.level);
    }
  }

  /**
   * Démarrer la validation périodique
   */
  startPeriodicValidation() {
    if (!this.isActive) return;

    // Valider l'état du joueur toutes les 10 secondes
    setInterval(() => {
      this.validatePlayerState();
    }, 10000);
  }

  /**
   * Vérifier si la validation est active
   */
  isValidationActive() {
    return this.isActive;
  }
}

// Rendre ServerValidator global
window.ServerValidator = ServerValidator;
