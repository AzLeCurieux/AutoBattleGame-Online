class UIController {
    constructor(game) {
        this.game = game;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Bouton Fight
        const fightBtn = document.getElementById('fight-btn');
        fightBtn.addEventListener('click', () => {
            window.audioManager.play('button');
            AnimationUtils.animateButton(fightBtn);
            this.game.handleFightButton();
        });

        // Bouton Stop
        const stopBtn = document.getElementById('stop-btn');
        stopBtn.addEventListener('click', () => {
            window.audioManager.play('button');
            AnimationUtils.animateButton(stopBtn);
            this.game.handleStopButton();
        });

        // Bouton Camp
        const campBtn = document.getElementById('camp-btn');
        campBtn.addEventListener('click', () => {
            window.audioManager.play('button');
            AnimationUtils.animateButton(campBtn);
            this.game.handleCampButton();
        });

        // Bouton Restart
        const restartBtn = document.getElementById('restart-btn');
        restartBtn.addEventListener('click', () => {
            window.audioManager.play('button');
            AnimationUtils.animateButton(restartBtn);
            this.game.handleRestartButton();
        });

        // Bouton Heal dans le camp
        const healBtn = document.getElementById('heal-btn');
        healBtn.addEventListener('click', () => {
            window.audioManager.play('button');
            AnimationUtils.animateButton(healBtn);
            this.game.handleHealButton();
        });

        // Bouton Passifs dans le camp
        const passiveInfoBtn = document.getElementById('passive-info-btn');
        passiveInfoBtn.addEventListener('click', () => {
            window.audioManager.play('button');
            AnimationUtils.animateButton(passiveInfoBtn);
            this.showPassiveInfo();
        });

        // Bouton Fermer pour les passifs
        const closePassiveInfoBtn = document.getElementById('close-passive-info');
        closePassiveInfoBtn.addEventListener('click', () => {
            window.audioManager.play('button');
            this.hidePassiveInfo();
        });

        // Fermer les modales en cliquant à l'extérieur
        const campModal = document.getElementById('camp-modal');
        const upgradeModal = document.getElementById('upgrade-modal');
        
        campModal.addEventListener('click', (e) => {
            if (e.target === campModal) {
                this.game.hideCamp();
            }
        });

        upgradeModal.addEventListener('click', (e) => {
            if (e.target === upgradeModal) {
                // Ne pas fermer automatiquement les améliorations
            }
        });

        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    if (!this.game.isFighting()) {
                        this.game.handleFightButton();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.game.handleStopButton();
                    break;
                case 'c':
                case 'C':
                    e.preventDefault();
                    this.game.handleCampButton();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.game.handleRestartButton();
                    break;
            }
        });
    }

    showCamp() {
        const campModal = document.getElementById('camp-modal');
        
        // Mettre à jour les stats avec le nouveau design
        this.updateCampStats();
        
        AnimationUtils.showModal(campModal);
    }

    hideCamp() {
        const campModal = document.getElementById('camp-modal');
        AnimationUtils.hideModal(campModal);
    }

    showUpgrades() {
        const upgradeModal = document.getElementById('upgrade-modal');
        AnimationUtils.showModal(upgradeModal);
    }

    hideUpgrades() {
        const upgradeModal = document.getElementById('upgrade-modal');
        AnimationUtils.hideModal(upgradeModal);
    }

    // Afficher la fenêtre des passifs
    showPassiveInfo() {
        const passiveModal = document.getElementById('passive-info-modal');
        const passiveList = document.getElementById('passive-list');
        
        // Générer la liste des passifs
        this.generatePassiveList(passiveList);
        
        AnimationUtils.showModal(passiveModal);
    }

    // Masquer la fenêtre des passifs
    hidePassiveInfo() {
        const passiveModal = document.getElementById('passive-info-modal');
        AnimationUtils.hideModal(passiveModal);
    }

    // Générer la liste des passifs
    generatePassiveList(container) {
        const player = this.game.player;
        const bossUpgrades = player.bossUpgrades || [];
        
        if (bossUpgrades.length === 0) {
            container.innerHTML = `
                <div class="no-passives">
                    <div class="icon">💫</div>
                    <div>Aucune amélioration passive active</div>
                    <div style="font-size: 12px; margin-top: 10px; opacity: 0.7;">
                        Les améliorations de boss deviennent des passifs permanents
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = bossUpgrades.map((upgrade, index) => {
            let icon = '💫';
            let name = 'Amélioration Passive';
            let description = 'Effet permanent actif';

            // Déterminer l'icône et la description basée sur le type d'upgrade
            if (upgrade.triggerEveryTurn) {
                if (upgrade.triggerEveryTurn.toString().includes('heal')) {
                    icon = '❤️';
                    name = 'Régénération';
                    description = 'Restaure 10% de la vie max chaque tour';
                } else if (upgrade.triggerEveryTurn.toString().includes('upgradeDamage')) {
                    icon = '⚔️';
                    name = 'Croissance des Dégâts';
                    description = '+10 dégâts de base chaque tour';
                } else if (upgrade.triggerEveryTurn.toString().includes('upgradeMaxHealth')) {
                    icon = '🛡️';
                    name = 'Croissance de la Vie';
                    description = '+25 vie max chaque tour';
                }
            }

            return `
                <div class="passive-item">
                    <div class="passive-icon">${icon}</div>
                    <div class="passive-details">
                        <div class="passive-name">${name}</div>
                        <div class="passive-description">${description}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Mettre à jour les stats du camp
    updateCampStats() {
        const player = this.game.player;
        const level = this.game.level;
        
        // Mettre à jour les éléments de stats
        document.getElementById('stat-damage').textContent = player.damage.getDamage();
        document.getElementById('stat-health').textContent = `${player.currentHealth} / ${player.maxHealth}`;
        document.getElementById('stat-crit-chance').textContent = `${player.criticalHitChance}%`;
        document.getElementById('stat-crit-damage').textContent = `${player.criticalHitDamagePercent}%`;
        document.getElementById('stat-gold').textContent = player.gold;
        document.getElementById('stat-level').textContent = level.getLevel() + 1;
    }

    updateFightButton(isFighting, enemyAlive) {
        const fightBtn = document.getElementById('fight-btn');
        
        if (isFighting) {
            fightBtn.textContent = 'Fighting...';
            fightBtn.disabled = true;
        } else if (enemyAlive) {
            fightBtn.textContent = 'Fight';
            fightBtn.disabled = false;
        } else {
            fightBtn.textContent = 'Fight';
            fightBtn.disabled = false;
        }
    }

    updateStopButton(isFighting) {
        const stopBtn = document.getElementById('stop-btn');
        stopBtn.disabled = !isFighting;
    }

    updateCampButton(enabled) {
        const campBtn = document.getElementById('camp-btn');
        campBtn.disabled = !enabled;
    }

    updateHealButton(canAfford) {
        const healBtn = document.getElementById('heal-btn');
        const isDead = this.game.player.isDead();
        
        healBtn.disabled = !canAfford;
        
        if (isDead) {
            healBtn.style.opacity = '0.3';
            healBtn.title = 'Vous devez d\'abord redémarrer le jeu';
        } else if (canAfford) {
            healBtn.style.opacity = '1';
            healBtn.title = 'Soigne complètement (5 or)';
        } else {
            healBtn.style.opacity = '0.5';
            healBtn.title = 'Pas assez d\'or (5 or requis)';
        }
    }

    showVictoryMessage() {
        // Créer un message de victoire temporaire
        const victoryMsg = document.createElement('div');
        victoryMsg.textContent = 'VICTORY!';
        victoryMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            font-weight: bold;
            color: #ffd700;
            text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
            z-index: 2000;
            pointer-events: none;
        `;
        
        document.body.appendChild(victoryMsg);
        AnimationUtils.animateVictory(victoryMsg);
        
        setTimeout(() => {
            if (victoryMsg.parentNode) {
                victoryMsg.parentNode.removeChild(victoryMsg);
            }
        }, 2000);
    }

    showDefeatMessage() {
        // Créer un message de défaite temporaire
        const defeatMsg = document.createElement('div');
        defeatMsg.textContent = 'DEFEAT!';
        defeatMsg.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            font-weight: bold;
            color: #ff4444;
            text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
            z-index: 2000;
            pointer-events: none;
        `;
        
        document.body.appendChild(defeatMsg);
        AnimationUtils.animateDefeat(defeatMsg);
        
        setTimeout(() => {
            if (defeatMsg.parentNode) {
                defeatMsg.parentNode.removeChild(defeatMsg);
            }
        }, 2000);
    }

    showLevelUpMessage() {
        // Créer un message de niveau supérieur
        const levelUpMsg = document.createElement('div');
        levelUpMsg.textContent = 'LEVEL UP!';
        levelUpMsg.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 36px;
            font-weight: bold;
            color: #1e90ff;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            z-index: 2000;
            pointer-events: none;
        `;
        
        document.body.appendChild(levelUpMsg);
        AnimationUtils.animateLevelUp(levelUpMsg);
        
        setTimeout(() => {
            if (levelUpMsg.parentNode) {
                levelUpMsg.parentNode.removeChild(levelUpMsg);
            }
        }, 1500);
    }
}
