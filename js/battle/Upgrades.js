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

        // Créer les améliorations normales (exactement comme dans le code Java)
        const healthUpgrade = 25 + this.random.nextInt(30);
        this.createUpgrade(`Health upgrade\n+${healthUpgrade}`, () => {
            this.player.upgradeMaxHealth(healthUpgrade);
            this.player.updateHealth();
            this.closeUpgradeModal();
        });

        const damageUpgrade = 10 + this.random.nextInt(20);
        this.createUpgrade(`Damage upgrade\n+${damageUpgrade}`, () => {
            this.player.upgradeDamage(damageUpgrade);
            this.closeUpgradeModal();
        });

        this.createUpgrade("Heal to full", () => {
            this.player.resetHealth();
            this.closeUpgradeModal();
        });

        this.createUpgrade("+3 gold", () => {
            this.player.changeGoldAmount(3);
            this.closeUpgradeModal();
        });

        const criticalHitDamageUpgrade = this.random.nextInt(15) + 5;
        this.createUpgrade(`Critical Hit Damage\n+${criticalHitDamageUpgrade}%`, () => {
            this.player.upgradeCritDamage(criticalHitDamageUpgrade);
            this.closeUpgradeModal();
        });

        const criticalHitChanceUpgrade = this.random.nextInt(5) + 2;
        this.createUpgrade(`Critical Hit Chance\n+${criticalHitChanceUpgrade}%`, () => {
            this.player.upgradeCritChance(criticalHitChanceUpgrade);
            this.closeUpgradeModal();
        });

        // Afficher 2 améliorations aléatoires
        this.showRandomUpgrades();
        AnimationUtils.showModal(upgradeModal);
    }

    createUpgrade(upgradeText, callback) {
        const upgradeOption = document.createElement('div');
        upgradeOption.className = 'upgrade-option';
        
        // Parser le texte pour extraire les informations
        const lines = upgradeText.split('\n');
        const title = lines[0];
        const description = lines[1] || '';
        const value = lines[2] || '';
        
        // Déterminer l'icône basée sur le type d'amélioration
        let icon = '⚡';
        if (title.includes('Health') || title.includes('Heal')) {
            icon = '❤️';
        } else if (title.includes('Damage')) {
            icon = '⚔️';
        } else if (title.includes('Critical') || title.includes('Crit')) {
            icon = '💥';
        } else if (title.includes('gold')) {
            icon = '💰';
        } else if (title.includes('Speed')) {
            icon = '🏃';
        } else if (title.includes('Defense')) {
            icon = '🛡️';
        }
        
        upgradeOption.innerHTML = `
            <span class="upgrade-icon">${icon}</span>
            <div class="upgrade-title">${title}</div>
            ${description ? `<div class="upgrade-description">${description}</div>` : ''}
            ${value ? `<div class="upgrade-value">${value}</div>` : ''}
        `;
        
        upgradeOption.addEventListener('click', () => {
            AnimationUtils.animateUpgradeOption(upgradeOption);
            callback();
        });
        
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
