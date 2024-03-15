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
        this.history = []; // Historique des actions
        this.maxHistoryItems = 100; // Limite d'historique
        this.historyPreviewLines = 1; // Une seule ligne dans la prévisualisation
        this.syncDisabled = false; // Flag pour empêcher la synchronisation après restart
        this.lastKnownSessionId = null; // Dernière session connue pour détecter les changements

        // Rendre l'audio manager global
        window.audioManager = this.audioManager;

        // Callback pour les changements de niveau (met à jour le fond selon le niveau)
        this.onLevelUp = (previousLevel) => {
            const currentLevel = this.level.getLevel();
            if (window.updateBackgroundForLevel) {
                window.updateBackgroundForLevel(currentLevel);
            }
        };

        this.startGame();
    }
    addPassiveGainMessage(message) {
        if (!message) return;

        // Ajouter uniquement à l'historique (plus de pop-up)
        this.addHistoryEntry('passive', message, '💫');
    }

    // Ajouter une entrée à l'historique
    addHistoryEntry(type, message, icon = '📝') {
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const entry = {
            type,
            message,
            icon,
            time,
            timestamp: Date.now()
        };

        this.history.push(entry);

        // Limiter la taille de l'historique
        if (this.history.length > this.maxHistoryItems) {
            this.history = this.history.slice(-this.maxHistoryItems);
        }

        // Mettre à jour l'affichage
        this.updateHistoryPreview();
    }

    // Mettre à jour l'aperçu de l'historique
    updateHistoryPreview() {
        const previewEl = document.getElementById('history-last-lines');
        if (!previewEl) return;

        const lastLines = this.history.slice(-this.historyPreviewLines);

        if (lastLines.length === 0) {
            previewEl.innerHTML = '<span style="opacity: 0.5;">Aucun historique</span>';
            return;
        }

        previewEl.innerHTML = lastLines.map(entry =>
            `<div class="history-item ${entry.type}">
        <span class="icon">${entry.icon}</span>
        <span class="time">${entry.time}</span>
        <span>${entry.message}</span>
      </div>`
        ).join('');
    }

    // Afficher l'historique complet
    showFullHistory() {
        const modal = document.getElementById('history-modal');
        const listEl = document.getElementById('history-full-list');

        if (!modal || !listEl) return;

        if (this.history.length === 0) {
            listEl.innerHTML = '<div style="text-align: center; padding: 40px; opacity: 0.6;">Aucun historique disponible</div>';
        } else {
            listEl.innerHTML = this.history.map(entry =>
                `<div class="history-item ${entry.type}">
          <span class="icon">${entry.icon}</span>
          <span class="time">${entry.time}</span>
          <span>${entry.message}</span>
        </div>`
            ).join('');
        }

        AnimationUtils.showModal(modal);
    }

    // Effacer l'historique
    clearHistory() {
        this.history = [];
        this.updateHistoryPreview();
        const modal = document.getElementById('history-modal');
        if (modal) {
            AnimationUtils.hideModal(modal);
        }
    }

    startGame() {
        // Generate new run ID
        const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('current_run_id', runId);
        console.log('🎮 New run started:', runId);

        // Clear deck for new run (Balatro-style: build deck during run)
        if (window.cardSystem) {
            window.cardSystem.clearDeck();
            console.log('🎴 New run: Empty deck (build via shop)');
        }

        // Reset card effects
        if (window.cardEffectHandler) {
            window.cardEffectHandler.applyCardEffects([]);
        }

        // Toujours initialiser le jeu côté client d'abord
        this.level.setLevel(0);
        this.player.deletePlayer();
        this.createEnemies.createSquareEnemy(false);

        // Mettre à jour la dernière session connue
        if (this.onlineManager && this.onlineManager.sessionId) {
            this.lastKnownSessionId = this.onlineManager.sessionId;
        }

        // Mettre à jour les couleurs du fond selon le niveau de départ
        // Initialiser l'aperçu de l'historique

        // Initialiser l'aperçu de l'historique
        setTimeout(() => {
            this.addHistoryEntry('level', 'Partie démarrée', '🎮');
        }, 100);
        this.updateUI();

        // Pas de synchronisation - chaque session démarre au niveau de base
    }

    // Démarrer la synchronisation périodique (DÉSACTIVÉ)
    startPeriodicSync() {
        // Synchronisation désactivée - chaque session démarre au niveau de base
    }

    handleFightButton() {
        console.log('🎮 handleFightButton called');

        // Vérifier si le joueur est mort
        if (this.player.isDead()) {
            console.log("❌ Cannot fight: player is dead");
            return;
        }
        console.log('✅ Player is alive');

        // Toujours utiliser la logique côté client pour les animations
        if (!this.attackAnimation) {
            console.error('❌ No attackAnimation!');
            return;
        }
        console.log('✅ attackAnimation exists');

        // Remove pre-fight center lock
        const battle = document.getElementById('battle-area');
        if (battle) battle.classList.remove('prefight');

        console.log('🔍 attackAnimation state:', {
            isPlayerFighting: this.attackAnimation.isPlayerFighting(),
            isEnemyAlive: this.attackAnimation.isEnemyIsAlive()
        });

        if (!this.attackAnimation.isPlayerFighting() && !this.attackAnimation.isEnemyIsAlive()) {
            console.log('🆕 Creating new enemy and starting fight...');
            this.createEnemies.createSquareEnemy(true);
        } else if (!this.attackAnimation.isPlayerFighting() && this.attackAnimation.isEnemyIsAlive()) {
            console.log('▶️ Starting existing fight...');
            this.attackAnimation.startFight();
        } else {
            console.log('⚠️ Cannot start fight - already fighting or invalid state');
        }

        // Activer l'animation du fond quand le combat commence
        if (window.enableBackgroundAnimation) {
            window.enableBackgroundAnimation();
        }

        // Mettre à jour les couleurs du fond selon le niveau actuel
        if (window.updateBackgroundForLevel) {
            window.updateBackgroundForLevel(this.level.getLevel());
        }

        this.hideCamp();
        this.hideUpgrades();
        this.updateUI();

        // Pas de synchronisation - chaque session est indépendante
    }

    handleStopButton() {
        // Toujours utiliser la logique côté client
        if (this.attackAnimation) {
            this.attackAnimation.stopFight();
            this.attackAnimation.setPlayerFighting(false);
        }

        // Désactiver l'animation du fond quand le combat s'arrête
        if (window.disableBackgroundAnimation) {
            window.disableBackgroundAnimation();
        }

        this.updateUI();

        // Pas de synchronisation - chaque session est indépendante
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

        // Effacer la sauvegarde serveur et empêcher la synchronisation
        if (this.onlineManager) {
            this.onlineManager.clearGameSession();
            this.onlineManager.resetRecordNotification(); // Réinitialiser le flag de notification
            this.syncDisabled = true; // Empêcher toute synchronisation future
        }

        // Vider l'historique
        this.clearHistory();

        // Generate new run ID for restart
        const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('current_run_id', runId);
        console.log('🔄 Restart: New run ID:', runId);

        // Clear deck for new run (Balatro-style)
        if (window.cardSystem) {
            window.cardSystem.clearDeck();
            console.log('🎴 Restart: Empty deck (build via shop)');
        }

        // Reset card effects
        if (window.cardEffectHandler) {
            window.cardEffectHandler.applyCardEffects([]);
        }

        // Réinitialiser le compteur de loot de session
        if (window.lootBoxSystem) {
            window.lootBoxSystem.resetSessionLootCount();
        }

        // Redémarrer complètement le jeu (comme dans le code Java)
        if (this.attackAnimation) {
            this.attackAnimation.deleteEnemy();
        }

        // Reset session ID for new game
        this.sessionId = null;
        this.lastKnownSessionId = null;
        // Réinitialiser complètement le joueur (vie pleine)
        this.player.deletePlayer();
        this.player.resetHealth();
        // Empêcher la sync serveur d'écraser la vie au tout début
        this.suppressSyncUntil = Date.now() + 1500;
        // Mettre à jour l'affichage immédiatement
        this.player.updateHealth();
        this.updateUI();
        // Remettre la vue en pré-combat (carré joueur centré, ennemi masqué)
        const battle = document.getElementById('battle-area');
        if (battle) battle.classList.add('prefight');

        // Réinitialiser les couleurs du fond aux valeurs de base
        if (window.setShaderColors) {
            window.setShaderColors(
                { r: 0.58, g: 0.07, b: 0.07 }, // Rouge par défaut
                { r: 0.15, g: 0.15, b: 0.15 }, // Gris foncé
                { r: 0.05, g: 0.05, b: 0.05 }  // Noir
            );
        }

        // Redémarrer
        this.startGame();
    }

    handleHealButton() {
        // Toujours utiliser la logique côté client
        if (this.player.isDead()) {
            console.log("Cannot heal: player is dead");
            return;
        }

        const oldHealth = this.player.currentHealth;
        const cost = 5;

        if (this.player.getGold() >= cost) {
            this.player.changeGoldAmount(-cost);
            const newHealth = this.player.maxHealth;
            this.player.resetHealth();
            this.audioManager.play('heal');
            this.updateUI();

            // Ajouter à l'historique
            this.addHistoryEntry('heal', `Soin complet: ${oldHealth} → ${newHealth} (Coût: ${cost} or)`, '💚');

            // CORRECTION: Synchroniser immédiatement avec le serveur
            // Pas de synchronisation - chaque session est indépendante
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

        // Indication de Boss pour le prochain combat
        const levelText = document.getElementById('level-text');
        if (levelText) {
            // Vérifie si le prochain niveau est un boss (basé sur le niveau actuel)
            // levelIsABossBattlePreFight utilise (this.level + 1)
            if (this.level.levelIsABossBattlePreFight()) {
                // Utiliser innerHTML pour styliser le tag BOSS
                // On réutilise le format de Level.updateLevelDisplay mais avec l'ajout
                const nextLevelNum = (this.level.getLevel() + 1).toString().padStart(2, '0');
                levelText.innerHTML = `Level ${nextLevelNum} <span style="color: #ff4444; font-weight: bold; font-size: 0.8em; margin-left: 5px; text-shadow: 0 0 5px rgba(255, 0, 0, 0.5);">BOSS</span>`;
            } else {
                // Réinitialiser au format standard si ce n'est pas un boss
                // Note: Level.updateLevelDisplay le fait aussi, mais ici on surcharge pour le cas Boss
                // Si ce n'est pas un boss, Level.updateLevelDisplay s'en charge lors du nextLevel
                // Mais si on est en pause ou init, on veut être sûr.
                // Cependant, updateUI est appelé souvent.
                // Si on n'est pas boss, on laisse le texte standard (géré par Level.js ou ici si on veut forcer)
                // Pour éviter de clignoter ou perdre le format, on ne touche rien si pas boss, 
                // car Level.updateLevelDisplay définit le texte de base.
                // SAUF si le texte contient "BOSS" alors qu'il ne devrait plus.
                if (levelText.innerHTML.includes('BOSS')) {
                    const nextLevelNum = (this.level.getLevel() + 1).toString().padStart(2, '0');
                    levelText.textContent = `Level ${nextLevelNum}`;
                }
            }
        }

        // Update online level in real-time (toujours, même si la sync est désactivée)
        // Envoyer le niveau 0-indexed (le serveur l'affichera avec +1)
        // On veut toujours mettre à jour le niveau des joueurs en ligne, même sans synchronisation
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
        // Plus besoin de refresh passive gains, tout est dans l'historique
    }

    onEnemyKilled() {
        // Le niveau est déjà incrémenté dans CreateEnemies.createSquareEnemy()
        this.updateUI();

        // Afficher un message de victoire
        this.uiController.showVictoryMessage();

        // Créer des particules
        AnimationUtils.createParticles(this.player.element, 8);

        // Vérifier si c'est un boss (tous les 10 niveaux)
        const completedLevel = this.level.getLevel();
        const isBoss = completedLevel > 0 && completedLevel % 10 === 0;

        // Ouvrir la boutique après chaque boss
        if (isBoss && window.cardShop) {
            console.log(`🛒 Boss vaincu au niveau ${completedLevel}! Ouverture de la boutique...`);
            setTimeout(() => {
                this.handleStopButton(); // Mettre le jeu en pause
                window.cardShop.showShop();
            }, 2000); // 2 secondes après la victoire
        }

        // Vérifier si on doit recevoir du loot (après avoir battu un boss)
        if (window.lootBoxSystem) {
            // Le niveau interne correspond exactement au niveau qui vient d'être complété
            // car nextLevel() est appelé au DÉBUT du combat.
            // Ex: On est niveau 2 (Display 3). On lance le combat -> nextLevel() -> niveau 3.
            // On tue l'ennemi. getLevel() retourne 3. C'est bien le niveau 3 qu'on vient de finir.

            // On vérifie si le niveau actuel (qui vient d'être atteint après le kill) est un niveau de loot
            if (window.lootBoxSystem.isLootLevel(completedLevel)) {
                console.log(`🎁 Loot condition met for level ${completedLevel}`);
                // Petit délai pour laisser le temps de voir le message de victoire
                setTimeout(() => {
                    this.handleStopButton(); // S'assurer que le jeu est en pause
                    window.lootBoxSystem.triggerLootEvent(completedLevel);
                }, 1500);
            }
        }

        // Pas de synchronisation - chaque session est indépendante
    }

    onPlayerKilled() {
        this.updateUI();
        this.uiController.showDefeatMessage();

        // Clear run deck on death (Balatro-style: deck resets between runs)
        if (window.cardSystem) {
            console.log('💀 Player died - clearing run deck');
            window.cardSystem.clearDeck();
        }

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

        // Pas de synchronisation - chaque session est indépendante
    }

    onLevelUp(previousLevel = null) {
        const currentLevel = this.level.getLevel();

        // Soumettre le score tous les 5 niveaux
        if (currentLevel % 5 === 0) {
            this.submitOnlineScore();
        }

        // Mettre à jour l'UI pour envoyer le nouveau niveau en temps réel
        this.updateUI();

        // Log des niveaux importants
        if (currentLevel % 10 === 0) {
            console.log(`🎯 Niveau ${currentLevel} atteint!`);
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

    // Charger l'état du jeu depuis le serveur (DÉSACTIVÉ)
    async loadGameFromServer() {
        // Synchronisation désactivée - chaque session démarre au niveau de base
        return;
    }

    // Synchroniser l'état client avec le serveur (DÉSACTIVÉ)
    syncClientStateFromServer() {
        // Synchronisation désactivée - chaque session démarre au niveau de base
        return;
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

    // Restaurer les passifs de la session
    restoreSessionPassives(passives) {
        if (!passives) return;

        // Restaurer les passifs normaux
        if (passives.passiveUpgrades && Array.isArray(passives.passiveUpgrades)) {
            this.player.passiveUpgrades = passives.passiveUpgrades;
            console.log(`✅ ${passives.passiveUpgrades.length} passifs normaux restaurés`);
        }

        // Restaurer les passifs de boss
        if (passives.bossPassives && Array.isArray(passives.bossPassives)) {
            // Note: Les bossPassives sont des objets sérialisés, on ne peut pas restaurer les fonctions
            // Mais on peut restaurer les données pour l'affichage
            this.player.bossPassives = passives.bossPassives;
            console.log(`✅ ${passives.bossPassives.length} passifs de boss restaurés`);
        }

        // Mettre à jour l'affichage des passifs dans le camp
        if (this.uiController && this.uiController.generatePassiveList) {
            this.uiController.generatePassiveList();
        }
    }

}
