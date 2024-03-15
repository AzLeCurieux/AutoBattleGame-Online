class Upgrades {
    constructor(player, scene) {
        this.player = player;
        this.scene = scene;
        this.level = Level.getInstance();
        this.bossUpgrades = new BossUpgrades(scene, player);
        this.random = new Random();
        this.upgradeButtons = [];
    }

    showUpgrades() {
        // Vérifier si c'est un boss (comme dans le code Java)
        if (this.level.levelIsABossBattle()) {
            this.bossUpgrades.showBossUpgrades();
            console.log("Boss upgrade screen");
            return;
        }

        const upgradeModal = document.getElementById('upgrade-modal');
        const upgradeOptions = document.getElementById('upgrade-options');

        // Vider les options précédentes
        upgradeOptions.innerHTML = '';
        this.upgradeButtons = [];

        // PERFORMANCE: Use requestAnimationFrame to batch DOM operations
        requestAnimationFrame(() => {
            // Créer les améliorations normales (exactement comme dans le code Java)
            const healthUpgrade = 25 + this.random.nextInt(30);
            this.createUpgrade(`Health upgrade\n+${healthUpgrade}`, () => {
                this.player.upgradeMaxHealth(healthUpgrade);
                this.player.updateHealth();
                if (window.game && window.game.addHistoryEntry) {
                    window.game.addHistoryEntry('upgrade', `Vie max augmentée de +${healthUpgrade}`, '❤️');
                }
                this.closeUpgradeModal();
                if (window.game && window.game.attackAnimation && window.game.attackAnimation.resetPositionsCentered) {
                    window.game.attackAnimation.resetPositionsCentered();
                }
            });

            const damageUpgrade = 10 + this.random.nextInt(20);
            this.createUpgrade(`Damage upgrade\n+${damageUpgrade}`, () => {
                this.player.upgradeDamage(damageUpgrade);
                if (window.game && window.game.addHistoryEntry) {
                    window.game.addHistoryEntry('upgrade', `Dégâts augmentés de +${damageUpgrade}`, '⚔️');
                }
                this.closeUpgradeModal();
                if (window.game && window.game.attackAnimation && window.game.attackAnimation.resetPositionsCentered) {
                    window.game.attackAnimation.resetPositionsCentered();
                }
            });

            this.createUpgrade("Heal to full", () => {
                const oldHealth = this.player.currentHealth;
                this.player.resetHealth();
                if (window.game && window.game.addHistoryEntry) {
                    window.game.addHistoryEntry('heal', `Vie restaurée à ${this.player.maxHealth} (était ${oldHealth})`, '💚');
                }
                this.closeUpgradeModal();
                if (window.game && window.game.attackAnimation && window.game.attackAnimation.resetPositionsCentered) {
                    window.game.attackAnimation.resetPositionsCentered();
                }
            });

            this.createUpgrade("+3 gold", () => {
                this.player.changeGoldAmount(3);
                if (window.game && window.game.addHistoryEntry) {
                    window.game.addHistoryEntry('gold', `Or gagné: +3 (Total: ${this.player.gold})`, '💰');
                }
                this.closeUpgradeModal();
                if (window.game && window.game.attackAnimation && window.game.attackAnimation.resetPositionsCentered) {
                    window.game.attackAnimation.resetPositionsCentered();
                }
            });

            const criticalHitDamageUpgrade = this.random.nextInt(15) + 5;
            this.createUpgrade(`Critical Hit Damage\n+${criticalHitDamageUpgrade}%`, () => {
                this.player.upgradeCritDamage(criticalHitDamageUpgrade);
                if (window.game && window.game.addHistoryEntry) {
                    window.game.addHistoryEntry('upgrade', `Dégâts critiques augmentés de +${criticalHitDamageUpgrade}%`, '💥');
                }
                this.closeUpgradeModal();
                if (window.game && window.game.attackAnimation && window.game.attackAnimation.resetPositionsCentered) {
                    window.game.attackAnimation.resetPositionsCentered();
                }
            });

            const criticalHitChanceUpgrade = this.random.nextInt(5) + 2;
            this.createUpgrade(`Critical Hit Chance\n+${criticalHitChanceUpgrade}%`, () => {
                this.player.upgradeCritChance(criticalHitChanceUpgrade);
                // Incrémenter le compteur pour le passif "scaling_crit_chance"
                this.player.incrementUpgradeCount();

                if (window.game && window.game.addHistoryEntry) {
                    window.game.addHistoryEntry('upgrade', `Chance de critique augmentée de +${criticalHitChanceUpgrade}%`, '⚡');
                }
                this.closeUpgradeModal();
                if (window.game && window.game.attackAnimation && window.game.attackAnimation.resetPositionsCentered) {
                    window.game.attackAnimation.resetPositionsCentered();
                }
            });

            // Afficher 2 améliorations aléatoires
            this.showRandomUpgrades();
        });

        AnimationUtils.showModal(upgradeModal);
    }

    createUpgrade(upgradeText, callback) {
        const upgradeOption = document.createElement('div');
        upgradeOption.className = 'upgrade-option';

        // Optimisation : éviter les reflows complexes
        // Utiliser des classes CSS pour le layout au lieu de styles inline complexes si possible

        // Parser le texte pour extraire les informations
        const lines = upgradeText.split('\n');
        const title = lines[0];
        const description = lines[1] || '';
        const value = lines[2] || '';

        // Déterminer l'icône
        let icon = '⚡';
        if (title.includes('Health') || title.includes('Heal')) icon = '❤️';
        else if (title.includes('Damage')) icon = '⚔️';
        else if (title.includes('Critical') || title.includes('Crit')) icon = '💥';
        else if (title.includes('gold')) icon = '💰';
        else if (title.includes('Speed')) icon = '🏃';
        else if (title.includes('Defense')) icon = '🛡️';

        // Construction DOM sécurisée (pas de innerHTML avec données dynamiques)
        const wrapper = document.createElement('div');
        wrapper.className = 'upgrade-content-wrapper';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'upgrade-icon';
        iconSpan.textContent = icon;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'upgrade-info';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'upgrade-title';
        titleDiv.textContent = title;
        infoDiv.appendChild(titleDiv);

        if (description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'upgrade-description';
            descDiv.textContent = description;
            infoDiv.appendChild(descDiv);
        }

        if (value) {
            const valueDiv = document.createElement('div');
            valueDiv.className = 'upgrade-value';
            valueDiv.textContent = value;
            infoDiv.appendChild(valueDiv);
        }

        wrapper.appendChild(iconSpan);
        wrapper.appendChild(infoDiv);
        upgradeOption.appendChild(wrapper);

        // PERFORMANCE: Passive listener for better scrolling performance
        upgradeOption.addEventListener('click', () => {
            // Animation CSS simple via classe
            upgradeOption.classList.add('selected');

            // PERFORMANCE: Use requestAnimationFrame for smoother animation
            requestAnimationFrame(() => {
                setTimeout(() => {
                    callback();
                }, 150);
            });
        }, { passive: true });

        this.upgradeButtons.push(upgradeOption);
    }

    showRandomUpgrades() {
        const upgradeOptions = document.getElementById('upgrade-options');

        if (this.upgradeButtons.length <= 2) {
            // Si 2 options ou moins, afficher toutes
            this.upgradeButtons.forEach(option => {
                upgradeOptions.appendChild(option);
            });
            return;
        }

        // Sélectionner 2 options aléatoires différentes
        const selectedIndices = [];
        while (selectedIndices.length < 2) {
            const randomIndex = this.random.nextInt(this.upgradeButtons.length);
            if (!selectedIndices.includes(randomIndex)) {
                selectedIndices.push(randomIndex);
            }
        }

        selectedIndices.forEach(index => {
            upgradeOptions.appendChild(this.upgradeButtons[index]);
        });
    }

    closeUpgradeModal() {
        const upgradeModal = document.getElementById('upgrade-modal');
        AnimationUtils.hideModal(upgradeModal);

        // Mettre à jour l'UI pour permettre de cliquer sur Fight
        if (window.game) {
            window.game.updateUI();
        }
    }
}
