class Game {
    constructor() {
        this.player = new Player();
        this.enemy = null;
        this.level = Level.getInstance();
        this.attackAnimation = null;
        this.createEnemies = new CreateEnemies(this);
        this.uiController = new UIController(this);
        this.audioManager = new AudioManager();
        this.onlineManager = null; // Will be initialized by OnlineManager
        this.sessionId = null; // Initialize session ID
    this.passiveGainMessages = [];
        
        // Rendre l'audio manager global
        window.audioManager = this.audioManager;
        
        this.startGame();
    }
  addPassiveGainMessage(message) {
    if (!message) return;
    this.passiveGainMessages.push(message);
    // Keep only last 3
    if (this.passiveGainMessages.length > 3) {
      this.passiveGainMessages = this.passiveGainMessages.slice(-3);
    }
    if (window.onlineManager && window.onlineManager.renderPassiveGains) {
      window.onlineManager.renderPassiveGains();
    }
    // Auto-clear the oldest after 4s for rolling display
    setTimeout(() => {
      this.passiveGainMessages = this.passiveGainMessages.filter(m => m !== message);
      if (window.onlineManager && window.onlineManager.renderPassiveGains) {
        window.onlineManager.renderPassiveGains();
      }
    }, 4000);
  }

    startGame() {
        // Toujours initialiser le jeu côté client d'abord
        this.level.setLevel(0);
        this.player.deletePlayer();
        this.createEnemies.createSquareEnemy(false);
        this.updateUI();
        
        // Puis charger l'état depuis le serveur si connecté
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            this.loadGameFromServer();
            
            // Synchronisation automatique périodique
            this.startPeriodicSync();
        }
    }
    
    // Démarrer la synchronisation périodique
    startPeriodicSync() {
        // OPTIMISATION: Synchroniser moins fréquemment pour optimiser les performances
        setInterval(() => {
            if (this.onlineManager && this.onlineManager.isAuthenticated) {
                this.syncClientStateFromServer();
            }
        }, 30000); // Toutes les 30 secondes pour optimiser
        
        console.log('🔄 Synchronisation périodique démarrée (toutes les 30s)');
    }

    handleFightButton() {
        // Vérifier si le joueur est mort
        if (this.player.isDead()) {
            console.log("❌ Cannot fight: player is dead");
            return;
        }
        
        // Toujours utiliser la logique côté client pour les animations
        if (!this.attackAnimation) return;
        
        if (!this.attackAnimation.isPlayerFighting() && !this.attackAnimation.isEnemyIsAlive()) {
            this.createEnemies.createSquareEnemy(true);
        } else if (!this.attackAnimation.isPlayerFighting() && this.attackAnimation.isEnemyIsAlive()) {
            this.attackAnimation.startFight();
        }
        
        this.hideCamp();
        this.hideUpgrades();
        this.updateUI();
        
        // Synchroniser avec le serveur
        this.syncWithServer();
    }

    handleStopButton() {
        // Toujours utiliser la logique côté client
        if (this.attackAnimation) {
            this.attackAnimation.stopFight();
            this.attackAnimation.setPlayerFighting(false);
        }
        this.updateUI();
        
        // Synchroniser avec le serveur
        this.syncWithServer();
    }

    handleCampButton() {
        const campModal = document.getElementById('camp-modal');
        if (campModal.classList.contains('show')) {
            this.hideCamp();
        } else {
            this.showCamp();
        }
    }

    handleRestartButton() {
        // Submit current score before restarting
        this.submitOnlineScore();
        
        // Redémarrer complètement le jeu (comme dans le code Java)
        if (this.attackAnimation) {
            this.attackAnimation.deleteEnemy();
        }
        
        // Reset session ID for new game
        this.sessionId = null;
        // Réinitialiser complètement le joueur (vie pleine)
        this.player.deletePlayer();
        this.player.resetHealth();
        // Empêcher la sync serveur d'écraser la vie au tout début
        this.suppressSyncUntil = Date.now() + 1500;
        // Mettre à jour l'affichage immédiatement
        this.player.updateHealth();
        this.updateUI();
        // Redémarrer
        this.startGame();
    }

    handleHealButton() {
        // Toujours utiliser la logique côté client
        if (this.player.isDead()) {
            console.log("Cannot heal: player is dead");
            return;
        }
        
        if (this.player.getGold() >= 5) {
            this.player.changeGoldAmount(-5);
            this.player.resetHealth();
            this.audioManager.play('heal');
            this.updateUI();
            
            // CORRECTION: Synchroniser immédiatement avec le serveur
            this.syncWithServer();
            this.syncClientStateFromServer();
        }
    }

    showCamp() {
        this.uiController.showCamp();
    }

    hideCamp() {
        this.uiController.hideCamp();
    }

    hideUpgrades() {
        this.uiController.hideUpgrades();
    }

    isFighting() {
        return this.attackAnimation && this.attackAnimation.isPlayerFighting();
    }

    updateUI() {
        const isFighting = this.isFighting();
        const enemyAlive = this.attackAnimation && this.attackAnimation.isEnemyIsAlive();
        const canAffordHeal = this.player.getGold() >= 5 && !this.player.isDead();
        
        this.uiController.updateFightButton(isFighting, enemyAlive);
        this.uiController.updateStopButton(isFighting);
        this.uiController.updateCampButton(!isFighting);
        this.uiController.updateHealButton(canAffordHeal);
        
        // Mettre à jour l'affichage de la santé du joueur
        this.updatePlayerHealthDisplay();
        
        // Update online level in real-time
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            this.onlineManager.updateCurrentLevel(this.level.getLevel(), this.player.getGold());
        }
    }
    
    updatePlayerHealthDisplay() {
        const playerHealthText = document.getElementById('player-health-text');
        const playerHealthFill = document.getElementById('player-health-fill');
        
        if (playerHealthText) {
            playerHealthText.textContent = `${this.player.currentHealth} / ${this.player.maxHealth}`;
        }
        
        if (playerHealthFill) {
            const healthPercentage = (this.player.currentHealth / this.player.maxHealth) * 100;
            playerHealthFill.style.width = `${healthPercentage}%`;
        }
    }

    setAttackAnimation(attackAnimation) {
        this.attackAnimation = attackAnimation;
        this.updateUI();
        // Refresh passive gains view
        if (window.onlineManager && window.onlineManager.renderPassiveGains) {
            window.onlineManager.renderPassiveGains();
        }
    }

    onEnemyKilled() {
        // Le niveau est déjà incrémenté dans CreateEnemies.createSquareEnemy()
        this.updateUI();
        
        // Afficher un message de victoire
        this.uiController.showVictoryMessage();
        
        // Créer des particules
        AnimationUtils.createParticles(this.player.element, 8);
        
        // Synchroniser avec le serveur
        this.syncWithServer();
    }

    onPlayerKilled() {
        this.updateUI();
        this.uiController.showDefeatMessage();
        
        // Envoyer l'événement de mort au serveur
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            const deathData = {
                level: this.level.getLevel(),
                gold: this.player.getGold(),
                sessionId: this.sessionId
            };
            
            // Envoyer au serveur
            this.onlineManager.socket.emit('player_death', deathData);
        }
        
        // Submit score when player dies
        this.submitOnlineScore();
        
        // Synchroniser avec le serveur (en arrière-plan)
        this.syncWithServer();
    }

    onLevelUp() {
        // Soumettre le score tous les 5 niveaux
        if (this.level.getLevel() % 5 === 0) {
            this.submitOnlineScore();
        }
        
        // Synchroniser avec le serveur
        this.syncWithServer();
        
        // Log des niveaux importants
        if (this.level.getLevel() % 10 === 0) {
            console.log(`🎯 Niveau ${this.level.getLevel()} atteint!`);
        }
    }

    // Sauvegarde automatique - DÉSACTIVÉE (100% serveur)
    saveGame() {
        // Plus de sauvegarde locale - tout est côté serveur
    }

    loadGame() {
        // Plus de chargement local - tout est côté serveur
        return false;
    }

    // Sauvegarde automatique - DÉSACTIVÉE (100% serveur)
    startAutoSave() {
        // Plus de sauvegarde automatique locale
    }
    
    // Online session management
    async startOnlineSession() {
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            try {
                const sessionId = await this.onlineManager.startGameSession();
                this.sessionId = sessionId;
                console.log('Online session started:', this.sessionId);
            } catch (error) {
                console.error('Failed to start online session:', error);
            }
        }
    }
    
    // Submit score to online system
    submitOnlineScore() {
        if (this.onlineManager && this.onlineManager.isAuthenticated && this.sessionId) {
            const level = this.level.getLevel();
            
            // Always submit the current level - the server will handle if it's a better score
            this.onlineManager.submitScore(level, level, this.player.gold);
        }
    }
    
    // Set online manager reference
    setOnlineManager(onlineManager) {
        this.onlineManager = onlineManager;
    }

    // Handle server-side attack (called by AttackAnimation)
    handleServerAttack() {
        if (this.onlineManager && this.onlineManager.isUsingServerGameLogic()) {
            const serverClient = this.onlineManager.getServerGameClient();
            if (serverClient) {
                serverClient.attack();
                return true;
            }
        }
        return false;
    }

    // Méthodes serveur non utilisées (système serveur désactivé)

    // Synchroniser l'état avec le serveur (en arrière-plan)
    syncWithServer() {
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            // Vérifier que les valeurs sont valides avant d'envoyer
            const currentState = {
                level: Math.max(0, this.level.getLevel()),
                gold: Math.max(0, this.player.getGold()),
                maxHealth: Math.max(100, this.player.getMaxHealth()),
                currentHealth: Math.max(0, Math.min(this.player.getCurrentHealth(), this.player.getMaxHealth())),
                damage: Math.max(1, this.player.getDamage()),
                criticalHitChance: Math.max(0, this.player.criticalHitChance),
                criticalHitDamagePercent: Math.max(0, this.player.criticalHitDamagePercent),
                enemiesKilled: this.player.enemiesKilled || 0,
                bossDefeated: this.player.bossDefeated || false,
                passiveUpgrades: this.player.passiveUpgrades || [],
                bossPassives: this.player.bossPassives || []
            };
            
            // Envoyer au serveur pour validation (sans bloquer le gameplay)
            this.onlineManager.submitScore(currentState.level, currentState.level, currentState.gold);
            
            // Sauvegarder via GameStateManager
            this.onlineManager.socket.emit('save_game_state', currentState);
        }
    }

    // Charger l'état du jeu depuis le serveur
    async loadGameFromServer() {
        // CORRECTION: Charger depuis le serveur même si le système serveur est désactivé
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            const serverClient = this.onlineManager.getServerGameClient();
            if (serverClient) {
                try {
                    // Demander l'état actuel du serveur
                    serverClient.requestGameState();
                    console.log('🔄 État du jeu chargé depuis le serveur');
                    
                    // Attendre plusieurs fois pour s'assurer de la synchronisation
                    setTimeout(() => {
                        this.syncClientStateFromServer();
                    }, 500);
                    
                    setTimeout(() => {
                        this.syncClientStateFromServer();
                    }, 1500);
                    
                    setTimeout(() => {
                        this.syncClientStateFromServer();
                    }, 3000);
                } catch (error) {
                    console.error('❌ Erreur chargement serveur:', error);
                }
            }
        }
    }
    
    // Synchroniser l'état client avec le serveur (sans écraser l'état local)
    syncClientStateFromServer() {
        // CORRECTION: Synchroniser seulement si on a une session serveur active
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            const serverClient = this.onlineManager.getServerGameClient();
            if (serverClient && serverClient.getGameState()) {
                const serverState = serverClient.getGameState();
                
                // Synchroniser seulement si l'état serveur est valide
                if (serverState && serverState.player) {
                    const serverPlayer = serverState.player;
                    
                    // CORRECTION: Synchroniser seulement si les valeurs serveur sont plus élevées
                    if (serverPlayer.level !== undefined && serverPlayer.level > this.level.getLevel()) {
                        this.level.setLevel(serverPlayer.level);
                        console.log(`🔄 Niveau synchronisé depuis le serveur: ${serverPlayer.level}`);
                    }
                    
                    if (serverPlayer.gold !== undefined && serverPlayer.gold > this.player.getGold()) {
                        this.player.gold = serverPlayer.gold;
                        this.player.updateGoldAmount();
                        console.log(`🔄 Or synchronisé depuis le serveur: ${serverPlayer.gold}`);
                    }
                    
                    // Synchroniser la santé max (prendre la plus élevée)
                    if (serverPlayer.maxHealth !== undefined && serverPlayer.maxHealth > this.player.getMaxHealth()) {
                        this.player.maxHealth = serverPlayer.maxHealth;
                        this.player.currentHealth = Math.min(this.player.currentHealth, serverPlayer.maxHealth);
                        this.player.updateHealth();
                        console.log(`🔄 Santé max synchronisée: ${serverPlayer.maxHealth}`);
                    }
                    
                    // CORRECTION: Ne pas synchroniser la santé actuelle pour éviter le heal automatique
                    // La santé actuelle doit rester côté client pour le gameplay
                    // if (serverPlayer.currentHealth !== undefined && serverPlayer.currentHealth > this.player.getCurrentHealth()) {
                    //     this.player.currentHealth = Math.min(serverPlayer.currentHealth, this.player.getMaxHealth());
                    //     this.player.updateHealth();
                    //     console.log(`🔄 Santé actuelle synchronisée: ${this.player.currentHealth}`);
                    // }
                    
                    // Synchroniser les dégâts (prendre la plus élevée)
                    if (serverPlayer.damage !== undefined && serverPlayer.damage > this.player.getDamage()) {
                        this.player.damage.setDamage(serverPlayer.damage);
                        console.log(`🔄 Dégâts synchronisés: ${serverPlayer.damage}`);
                    }
                    
                    // Synchroniser les passifs
                    if (serverState.passiveUpgrades) {
                        this.player.passiveUpgrades = serverState.passiveUpgrades;
                    }
                    if (serverState.bossPassives) {
                        this.player.bossPassives = serverState.bossPassives;
                    }
                    
                    this.updateUI();
                    console.log('✅ État client synchronisé avec le serveur');
                }
            }
        }
    }

    // Démarrer un nouveau jeu
    startNewGame() {
        this.level.setLevel(0);
        this.player.deletePlayer();
        this.createEnemies.createSquareEnemy(false);
        this.updateUI();
    }

    // Valider une action côté serveur
    validateAction(action, data) {
        if (this.onlineManager && this.onlineManager.isServerValidationActive()) {
            const validator = this.onlineManager.getServerValidator();
            if (validator) {
                validator.validateAction(action, data);
            }
        }
    }

}
