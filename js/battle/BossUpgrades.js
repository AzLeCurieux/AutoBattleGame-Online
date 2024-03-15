class BossUpgrades {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.random = new Random();
        this.bossUpgradeButtons = [];
    }

    showBossUpgrades() {
        const upgradeModal = document.getElementById('upgrade-modal');
        const upgradeOptions = document.getElementById('upgrade-options');
        
        // Vider les options précédentes
        upgradeOptions.innerHTML = '';
        this.bossUpgradeButtons = [];

        // Créer les améliorations de boss (exactement comme dans le code Java)
        const healUpgrade = new BossUpgrade(true);
        healUpgrade.triggerEveryTurn = () => {
            this.player.heal(Math.floor(this.player.getMaxHealth() * 0.1));
            console.log("Healed 10% of max health");
            if (window.game && window.game.addPassiveGainMessage) {
                window.game.addPassiveGainMessage(`Passif: Soin +10%`);
            }
        };
        healUpgrade.triggerWhenPicked = () => {
            this.closeBossUpgradeModal();
        };
        this.createUpgrade("Heal 10% of max health\nat end of every round", healUpgrade);

        const damageUpgrade = new BossUpgrade(true);
        damageUpgrade.triggerEveryTurn = () => {
            this.player.upgradeDamage(10);
            console.log("Damage Upgrade + 10");
            if (window.game && window.game.addPassiveGainMessage) {
                window.game.addPassiveGainMessage(`Passif: Dégâts +10`);
            }
        };
        damageUpgrade.triggerWhenPicked = () => {
            this.closeBossUpgradeModal();
        };
        this.createUpgrade("Get +10 damage\nat the end of every round", damageUpgrade);

        const healthUpgrade = new BossUpgrade(true);
        healthUpgrade.triggerEveryTurn = () => {
            this.player.upgradeMaxHealth(25);
            this.player.updateHealth();
            console.log("Health Upgrade + 25");
            if (window.game && window.game.addPassiveGainMessage) {
                window.game.addPassiveGainMessage(`Passif: PV +25`);
            }
        };
        healthUpgrade.triggerWhenPicked = () => {
            this.closeBossUpgradeModal();
        };
        this.createUpgrade("Get +25 max Health\nat the end of every round", healthUpgrade);

        // Afficher 2 améliorations aléatoires (comme dans le code Java)
        this.showRandomBossUpgrades();
        AnimationUtils.showModal(upgradeModal);
    }

    createUpgrade(upgradeText, bossUpgrade) {
        const upgradeOption = document.createElement('div');
        upgradeOption.className = 'upgrade-option';
        
        // Parser le texte pour extraire les informations
        const lines = upgradeText.split('\n');
        const title = lines[0];
        const description = lines[1] || '';
        const value = lines[2] || '';
        
        // Déterminer l'icône basée sur le type d'amélioration boss
        let icon = '👑';
        if (title.includes('Health') || title.includes('Heal')) {
            icon = '❤️';
        } else if (title.includes('damage') || title.includes('Damage')) {
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
        
        // Construction DOM sécurisée
        const iconSpan = document.createElement('span');
        iconSpan.className = 'upgrade-icon';
        iconSpan.textContent = icon;
        upgradeOption.appendChild(iconSpan);

        const titleDiv = document.createElement('div');
        titleDiv.className = 'upgrade-title';
        titleDiv.textContent = title;
        upgradeOption.appendChild(titleDiv);

        if (description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'upgrade-description';
            descDiv.textContent = description;
            upgradeOption.appendChild(descDiv);
        }

        if (value) {
            const valueDiv = document.createElement('div');
            valueDiv.className = 'upgrade-value';
            valueDiv.textContent = value;
            upgradeOption.appendChild(valueDiv);
        }
        
        upgradeOption.addEventListener('click', () => {
            this.player.addBossUpgrade(bossUpgrade);
            AnimationUtils.animateUpgradeOption(upgradeOption);
            
            // Ajouter à l'historique
            if (window.game && window.game.addHistoryEntry) {
                window.game.addHistoryEntry('upgrade', `Amélioration BOSS: ${title}`, icon);
            }
            
            this.closeBossUpgradeModal();
            if (window.game && window.game.attackAnimation && window.game.attackAnimation.resetPositionsCentered) {
                window.game.attackAnimation.resetPositionsCentered();
            }
        });
        
        this.bossUpgradeButtons.push(upgradeOption);
    }

    showRandomBossUpgrades() {
        const upgradeOptions = document.getElementById('upgrade-options');
        
        if (this.bossUpgradeButtons.length < 2) {
            // Si moins de 2 options, afficher toutes
            this.bossUpgradeButtons.forEach(option => {
                upgradeOptions.appendChild(option);
            });
            return;
        }

        // Sélectionner 2 options aléatoires différentes (comme dans le code Java)
        let number1 = this.random.nextInt(this.bossUpgradeButtons.length);
        let number2 = this.random.nextInt(this.bossUpgradeButtons.length);
        
        while (number1 === number2) {
            number2 = this.random.nextInt(this.bossUpgradeButtons.length);
        }

        upgradeOptions.appendChild(this.bossUpgradeButtons[number1]);
        upgradeOptions.appendChild(this.bossUpgradeButtons[number2]);
    }

    closeBossUpgradeModal() {
        const upgradeModal = document.getElementById('upgrade-modal');
        AnimationUtils.hideModal(upgradeModal);
        
        // Mettre à jour l'UI pour permettre de cliquer sur Fight
        if (window.game) {
            window.game.updateUI();
        }
    }
}
