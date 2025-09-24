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
        
        // Rendre l'audio manager global
        window.audioManager = this.audioManager;
        
        this.startGame();
    }

    startGame() {
        // Réinitialiser complètement le jeu (comme dans le code Java)
        this.level.setLevel(0);
        this.player.deletePlayer();
        this.createEnemies.createSquareEnemy(false);
        this.updateUI();
        
        // Start online game session if authenticated
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            this.startOnlineSession();
        }
    }

    handleFightButton() {
        if (!this.attackAnimation) return;
        
        if (!this.attackAnimation.isPlayerFighting() && !this.attackAnimation.isEnemyIsAlive()) {
            // Créer un nouvel ennemi et commencer le combat
            this.createEnemies.createSquareEnemy(true);
        } else if (!this.attackAnimation.isPlayerFighting() && this.attackAnimation.isEnemyIsAlive()) {
            // Continuer le combat existant
            this.attackAnimation.startFight();
        }
        
        this.hideCamp();
        this.hideUpgrades();
        this.updateUI();
    }

    handleStopButton() {
        if (this.attackAnimation) {
            this.attackAnimation.stopFight();
            this.attackAnimation.setPlayerFighting(false);
        }
        this.updateUI();
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
        this.startGame();
    }

    handleHealButton() {
        if (this.player.isDead()) {
            console.log("Cannot heal: player is dead");
            return;
        }
        
        if (this.player.getGold() >= 5) {
            this.player.changeGoldAmount(-5);
            this.player.resetHealth();
            this.audioManager.play('heal');
            this.updateUI();
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
        
        // Update online level in real-time
        if (this.onlineManager && this.onlineManager.isAuthenticated) {
            this.onlineManager.updateCurrentLevel(this.level.getLevel(), this.player.getGold());
        }
    }

    setAttackAnimation(attackAnimation) {
        this.attackAnimation = attackAnimation;
        this.updateUI();
    }

    onEnemyKilled() {
        // Le niveau est déjà incrémenté dans CreateEnemies.createSquareEnemy()
        this.updateUI();
        
        // Afficher un message de victoire
        this.uiController.showVictoryMessage();
        
        // Créer des particules
        AnimationUtils.createParticles(this.player.element, 8);
    }

    onPlayerKilled() {
        this.updateUI();
        this.uiController.showDefeatMessage();
        
        // Submit score when player dies
        this.submitOnlineScore();
    }

    onLevelUp() {
        // Submit score when leveling up (new record notification will be handled by server)
        this.submitOnlineScore();
    }

    // Sauvegarde automatique
    saveGame() {
        const saveData = {
            level: this.level.getLevel(),
            player: {
                gold: this.player.getGold(),
                maxHealth: this.player.getMaxHealth(),
                damage: this.player.getDamage(),
                criticalHitChance: this.player.criticalHitChance,
                criticalHitDamagePercent: this.player.criticalHitDamagePercent,
                currentHealth: this.player.getCurrentHealth()
            },
            timestamp: Date.now()
        };
        
        localStorage.setItem('autoBattleGame_save', JSON.stringify(saveData));
    }

    loadGame() {
        const saveData = localStorage.getItem('autoBattleGame_save');
        if (saveData) {
            try {
                const data = JSON.parse(saveData);
                
                // Vérifier si la sauvegarde n'est pas trop ancienne (7 jours)
                const daysSinceSave = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
                if (daysSinceSave > 7) {
                    console.log("Save file too old, starting fresh");
                    return false;
                }
                
                this.level.setLevel(data.level);
                this.player.gold = data.player.gold;
                this.player.maxHealth = data.player.maxHealth;
                this.player.damage.setDamage(data.player.damage);
                this.player.criticalHitChance = data.player.criticalHitChance;
                this.player.criticalHitDamagePercent = data.player.criticalHitDamagePercent;
                this.player.currentHealth = data.player.currentHealth;
                
                this.player.updateHealth();
                this.player.updateGoldAmount();
                this.updateUI();
                
                console.log("Game loaded successfully");
                return true;
            } catch (error) {
                console.error("Error loading save file:", error);
                return false;
            }
        }
        return false;
    }

    // Sauvegarde automatique toutes les 30 secondes
    startAutoSave() {
        setInterval(() => {
            this.saveGame();
        }, 30000);
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
}
