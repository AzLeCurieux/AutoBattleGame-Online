class UIController {
    constructor(game) {
        this.game = game;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Bouton Fight
        const fightBtn = document.getElementById('fight-btn');
        if (!fightBtn) {
            console.error('❌ Fight button not found!');
            return;
        }

        console.log('✅ Fight button found, attaching listener');
        fightBtn.addEventListener('click', () => {
            console.log('🥊 Fight button clicked!');
            window.audioManager.play('button');
            AnimationUtils.animateButton(fightBtn);

            // Reconnexion automatique si AFK
            if (window.onlineManager) {
                window.onlineManager.ensureConnection();
            }

            // Cacher la roulette de loot box si elle est visible
            if (window.lootBoxSystem && typeof window.lootBoxSystem.hideWheel === 'function') {
                window.lootBoxSystem.hideWheel();
            }

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

        // Bouton Gambling
        const gamblingBtn = document.getElementById('gambling-btn');
        if (gamblingBtn) {
            gamblingBtn.addEventListener('click', () => {
                window.audioManager.play('button');
                AnimationUtils.animateButton(gamblingBtn);
                // SECURITY: Never put token in URL - it will be read from localStorage on the new page
                window.location.href = '/gambling';
            });
        }

        // Bouton Inventaire et Deck sont gérés directement dans le HTML via onclick
        // pour éviter les problèmes de déconnexion liés aux listeners complexes


        // Le bouton passifs n'est plus nécessaire, les passifs sont intégrés dans le camp
        // (Le bouton a été retiré du HTML)

        // Bouton historique
        const historyToggleBtn = document.getElementById('history-toggle-btn');
        const historyPreview = document.getElementById('history-last-lines');
        if (historyToggleBtn) {
            historyToggleBtn.addEventListener('click', () => {
                window.audioManager.play('button');
                this.game.showFullHistory();
            });
        }
        if (historyPreview) {
            historyPreview.addEventListener('click', () => {
                window.audioManager.play('button');
                this.game.showFullHistory();
            });
        }

        // Boutons de fermeture de l'historique
        const historyClose = document.getElementById('history-close');
        const historyClose2 = document.getElementById('history-close2');
        const historyClear = document.getElementById('history-clear');

        if (historyClose) {
            historyClose.addEventListener('click', () => {
                window.audioManager.play('button');
                AnimationUtils.hideModal(document.getElementById('history-modal'));
            });
        }
        if (historyClose2) {
            historyClose2.addEventListener('click', () => {
                window.audioManager.play('button');
                AnimationUtils.hideModal(document.getElementById('history-modal'));
            });
        }
        if (historyClear) {
            historyClear.addEventListener('click', () => {
                window.audioManager.play('button');
                if (confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
                    this.game.clearHistory();
                }
            });
        }

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
            switch (e.key) {
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
        const campPassiveList = document.getElementById('camp-passive-list');

        // Mettre à jour les stats avec le nouveau design
        this.updateCampStats();

        // Générer la liste des passifs directement dans le camp
        if (campPassiveList) {
            this.generatePassiveList(campPassiveList);
        }

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
        if (!container) return;

        const player = this.game.player;
        // Utiliser bossUpgrades (objets avec fonctions) ou bossPassives (données sérialisées)
        const bossUpgrades = player.bossUpgrades || [];
        const bossPassives = player.bossPassives || [];

        // Combiner les deux sources (bossUpgrades pour les fonctions, bossPassives pour les données)
        const allPassives = [...bossUpgrades];

        // Ajouter les passifs depuis bossPassives (données sérialisées)
        bossPassives.forEach(passive => {
            // Vérifier si ce passif n'est pas déjà dans bossUpgrades
            const exists = bossUpgrades.some(upgrade => {
                // Comparer par type ou description
                if (passive.type) return upgrade.type === passive.type;
                if (passive.description) {
                    const upgradeStr = upgrade.triggerEveryTurn ? upgrade.triggerEveryTurn.toString() : '';
                    return upgradeStr.includes(passive.description);
                }
                return false;
            });

            if (!exists) {
                // Créer un objet minimal pour l'affichage
                allPassives.push({
                    type: passive.type || 'boss',
                    description: passive.description || '',
                    triggerEveryTurn: null // Fonction non disponible depuis sérialisation
                });
            }
        });

        if (allPassives.length === 0) {
            container.innerHTML = `
                <div class="no-passives">
                    <div class="icon">💫</div>
                    <div>Aucune amélioration passive active</div>
                    <div style="font-size: 11px; margin-top: 6px; opacity: 0.6;">
                        Les améliorations de boss deviennent des passifs permanents
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = allPassives.map((upgrade, index) => {
            let icon = '💫';
            let name = 'Amélioration Passive';
            let description = 'Effet permanent actif';

            // Déterminer l'icône et la description basée sur le type d'upgrade
            if (upgrade.triggerEveryTurn) {
                const upgradeStr = upgrade.triggerEveryTurn.toString();
                if (upgradeStr.includes('heal')) {
                    icon = '❤️';
                    name = 'Régénération';
                    description = 'Restaure 10% de la vie max chaque tour';
                } else if (upgradeStr.includes('upgradeDamage')) {
                    icon = '⚔️';
                    name = 'Croissance des Dégâts';
                    description = '+10 dégâts de base chaque tour';
                } else if (upgradeStr.includes('upgradeMaxHealth')) {
                    icon = '🛡️';
                    name = 'Croissance de la Vie';
                    description = '+25 vie max chaque tour';
                }
            } else if (upgrade.description) {
                // Utiliser les données sérialisées
                const desc = upgrade.description.toLowerCase();
                if (desc.includes('heal') || desc.includes('soin') || desc.includes('régénération')) {
                    icon = '❤️';
                    name = 'Régénération';
                    description = 'Restaure 10% de la vie max chaque tour';
                } else if (desc.includes('damage') || desc.includes('dégât')) {
                    icon = '⚔️';
                    name = 'Croissance des Dégâts';
                    description = '+10 dégâts de base chaque tour';
                } else if (desc.includes('health') || desc.includes('vie') || desc.includes('max health')) {
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

        // Stats de base
        const baseDamage = player.damage.getDamage();
        const baseHealth = player.maxHealth;
        const baseCritChance = player.criticalHitChance;
        const baseCritDamage = player.criticalHitDamagePercent;

        // Stats avec bonus des cartes
        let finalDamage = baseDamage;
        let finalHealth = baseHealth;
        let finalCritChance = baseCritChance;
        let finalCritDamage = baseCritDamage;

        if (window.cardEffectHandler) {
            finalDamage = window.cardEffectHandler.getModifiedDamage(baseDamage, null);
            finalHealth = player.maxHealth; // Déjà appliqué dans applyPassiveEffects
            finalCritChance = window.cardEffectHandler.getModifiedCritChance(baseCritChance);
            finalCritDamage = window.cardEffectHandler.getModifiedCritDamage(baseCritDamage);
        }

        // Calculer les bonus
        const damageBonus = finalDamage - baseDamage;
        const healthBonus = finalHealth - baseHealth;
        const critChanceBonus = finalCritChance - baseCritChance;
        const critDamageBonus = finalCritDamage - baseCritDamage;

        // Mettre à jour les éléments de stats avec bonus
        const damageEl = document.getElementById('stat-damage');
        const healthEl = document.getElementById('stat-health');
        const critChanceEl = document.getElementById('stat-crit-chance');
        const critDamageEl = document.getElementById('stat-crit-damage');

        // Afficher avec bonus si présent
        if (damageBonus > 0) {
            damageEl.innerHTML = `${finalDamage} <span style="color: #4CAF50; font-size: 0.85em;">(+${damageBonus})</span>`;
        } else {
            damageEl.textContent = finalDamage;
        }

        if (healthBonus > 0) {
            healthEl.innerHTML = `${player.currentHealth} / ${finalHealth} <span style="color: #4CAF50; font-size: 0.85em;">(+${healthBonus})</span>`;
        } else {
            healthEl.textContent = `${player.currentHealth} / ${finalHealth}`;
        }

        if (critChanceBonus > 0) {
            critChanceEl.innerHTML = `${finalCritChance.toFixed(1)}% <span style="color: #4CAF50; font-size: 0.85em;">(+${critChanceBonus.toFixed(1)}%)</span>`;
        } else {
            critChanceEl.textContent = `${finalCritChance}%`;
        }

        if (critDamageBonus > 0) {
            critDamageEl.innerHTML = `${finalCritDamage}% <span style="color: #4CAF50; font-size: 0.85em;">(+${critDamageBonus}%)</span>`;
        } else {
            critDamageEl.textContent = `${finalCritDamage}%`;
        }

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
        // Plus de message de victoire animé ("VICTORY!") pour optimiser
        // On peut éventuellement jouer un son ou juste faire une petite notification discrète si besoin
        // Mais la demande explicite est de retirer l'animation

        // Si on veut garder une trace visuelle minimale, on peut flasher brièvement l'écran ou le bord
        // mais pour l'instant on retire complètement l'élément DOM animé.
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
