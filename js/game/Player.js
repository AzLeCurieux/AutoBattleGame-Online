class Player extends Fighter {
    constructor() {
        super(1000, 200); // maxHealth, damage
        this.gold = 0;
        this.goldAmount = 1;
        this.criticalHitChance = 1;
        this.criticalHitDamagePercent = 50;
        this.bossUpgrades = [];
        this.passiveUpgrades = [];
        this.bossPassives = [];
        this.upgradeCount = 0;
        this.lootBoxesOpened = 0; // Compteur de caisses loot ouvertes
        this.element = document.getElementById('player');
        this.healthBar = document.getElementById('player-health-fill');
        this.healthText = document.getElementById('player-health-text');
        this.goldText = document.getElementById('gold-text');

        // DEV: God mode for testing
        this.godMode = false;

        this.updateHealth();
        this.updateGoldAmount();
    }

    getGold() {
        return this.gold;
    }

    changeGoldAmount(amount = this.goldAmount) {
        this.gold += amount;
        this.updateGoldAmount();
        AnimationUtils.animateGoldGain(this.goldText);
    }

    takeDamage(damage, damageObject) {
        // DEV: God mode prevents all damage
        if (this.godMode) {
            console.log('🛡️ GOD MODE: Damage blocked');
            AnimationUtils.showDamageText(this.element, 0, false);
            return 0;
        }

        let finalDamage = damage;

        // Apply card effects damage reduction and reflection
        if (window.cardEffectHandler && window.game && window.game.enemy) {
            finalDamage = window.cardEffectHandler.onTakeDamage(damage, window.game.enemy);
        }

        this.lowerCurrentHealth(finalDamage);
        this.updateHealth();

        // Afficher les dégâts flottants
        const isCrit = damageObject && damageObject.isNewHitIsCrit ? damageObject.isNewHitIsCrit() : false;
        AnimationUtils.showDamageText(this.element, finalDamage, isCrit);
        AnimationUtils.animateFighterHit(this.element);
        AnimationUtils.animateHealthBar(this.element.parentElement.querySelector('.health-bar'));

        return finalDamage;
    }

    // DEV: Toggle god mode
    toggleGodMode() {
        this.godMode = !this.godMode;
        console.log(`🛡️ GOD MODE: ${this.godMode ? 'ENABLED' : 'DISABLED'}`);
        return this.godMode;
    }

    heal(healAmount) {
        const realHealAmount = healAmount;
        if (this.currentHealth + healAmount < this.maxHealth) {
            this.changeCurrentHealth(healAmount);
        } else {
            this.resetHealth();
        }
        this.updateHealth();
        AnimationUtils.animateHeal(this.element);
    }

    updateHealth() {
        const healthPercentage = (this.currentHealth / this.maxHealth) * 100;
        this.healthBar.style.width = healthPercentage + '%';
        this.healthText.textContent = `${this.currentHealth} / ${this.maxHealth}`;

        // Changer la couleur de la barre selon la santé
        if (healthPercentage > 60) {
            this.healthBar.style.background = 'linear-gradient(90deg, #44ff44, #88ff88)';
        } else if (healthPercentage > 30) {
            this.healthBar.style.background = 'linear-gradient(90deg, #ffaa44, #ffcc66)';
        } else {
            this.healthBar.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
        }
    }

    updateGoldAmount() {
        this.goldText.textContent = `Gold: ${this.gold}`;
    }

    getStats() {
        const baseDamage = this.getDamage();
        const baseHealth = this.maxHealth;
        const baseCritChance = this.criticalHitChance;
        const baseCritDamage = this.criticalHitDamagePercent;

        // Get modified values from card effects
        let finalDamage = baseDamage;
        let finalHealth = baseHealth;
        let finalCritChance = baseCritChance;
        let finalCritDamage = baseCritDamage;

        if (window.cardEffectHandler) {
            finalDamage = window.cardEffectHandler.getModifiedDamage(baseDamage);
            finalHealth = window.cardEffectHandler.getModifiedHealth(baseHealth);
            finalCritChance = window.cardEffectHandler.getModifiedCritChance(baseCritChance);
            finalCritDamage = window.cardEffectHandler.getModifiedCritDamage(baseCritDamage);
        }

        return `Damage: ${finalDamage} (${baseDamage})\nHealth: ${this.currentHealth}/${finalHealth}\nCritical Hit chance: ${finalCritChance}% (${baseCritChance}%)\nCritical Hit damage: ${finalCritDamage}% (${baseCritDamage}%)`;
    }

    getPlayerDamage() {
        // Get enemy from game instance - this is crucial for card effects
        const enemy = (window.game && window.game.enemy) || (this.game && this.game.enemy) || null;
        let baseDamage = this.getDamage();

        // Apply card effects to damage (including conditional bonuses)
        if (window.cardEffectHandler) {
            baseDamage = window.cardEffectHandler.getModifiedDamage(baseDamage, enemy);
        }

        let damage = baseDamage;

        // Get modified crit chance and damage
        let critChance = this.criticalHitChance;
        let critDamagePercent = this.criticalHitDamagePercent;

        if (window.cardEffectHandler) {
            critChance = window.cardEffectHandler.getModifiedCritChance(this.criticalHitChance);
            critDamagePercent = window.cardEffectHandler.getModifiedCritDamage(this.criticalHitDamagePercent);
        }

        const critRoll = this.random.nextInt(100) + 1;
        const isCrit = critRoll <= critChance;

        if (isCrit) {
            damage = Math.floor(damage * (1 + critDamagePercent / 100));
            this.damage.nextHitIsCrit();
        }

        console.log(`🎯 Final damage calculated: ${damage}`);
        console.log(`🔍 Checking card effects - Handler exists: ${!!window.cardEffectHandler}, Enemy exists: ${!!enemy}`);
        if (enemy) {
            console.log(`👾 Enemy details:`, enemy.constructor.name, `HP: ${enemy.currentHealth}/${enemy.maxHealth}`);
        }

        // IMPORTANT: Apply on-hit effects AFTER calculating final damage
        if (window.cardEffectHandler && enemy) {
            console.log(`✅ Calling onAfterAttack with damage ${damage}`);
            window.cardEffectHandler.onAfterAttack(damage, enemy, isCrit);
        } else {
            console.warn(`❌ NOT calling onAfterAttack - Handler: ${!!window.cardEffectHandler}, Enemy: ${!!enemy}`);
        }

        // Show visual effects for low health bonus
        if (window.cardEffectHandler && window.cardEffectHandler.combatState.isBelowHalfHealth) {
            if (window.cardEffectVisuals) {
                window.cardEffectVisuals.showLowHealthAura();
            }
        } else {
            if (window.cardEffectVisuals) {
                window.cardEffectVisuals.hideLowHealthAura();
            }
        }

        return damage;
    }

    upgradeCritDamage(upgrade) {
        this.criticalHitDamagePercent += upgrade;
    }

    upgradeCritChance(upgrade) {
        this.criticalHitChance += upgrade;
    }

    incrementUpgradeCount() {
        this.upgradeCount++;
        console.log(`📈 Player upgrade count: ${this.upgradeCount}`);

        // Notify card effect handler if needed
        if (window.cardEffectHandler) {
            // Force update of stats display
            if (window.game && window.game.uiController) {
                window.game.uiController.updateCampStats();
            }
        }
    }

    incrementLootBoxCount() {
        this.lootBoxesOpened++;
        console.log(`📦 Player loot boxes opened: ${this.lootBoxesOpened}`);

        // Notify card effect handler if needed
        if (window.cardEffectHandler) {
            // Force update of stats display
            if (window.game && window.game.uiController) {
                window.game.uiController.updateCampStats();
            }
        }
    }

    addBossUpgrade(bossUpgrade) {
        bossUpgrade.triggerWhenPicked();
        this.bossUpgrades.push(bossUpgrade);

        // Sauvegarder le passif sur le serveur
        if (window.game && window.game.onlineManager) {
            // Créer un objet sérialisable pour le passif
            const bossPassiveData = {
                type: bossUpgrade.type || 'boss',
                description: bossUpgrade.description || '',
                timestamp: Date.now()
            };
            window.game.onlineManager.saveBossPassive(bossPassiveData);
        }
    }

    triggerAtStartOfFight() {
    }

    triggerAfterKillingEnemy() {
        const goldEarned = this.goldAmount;
        this.changeGoldAmount();

        // Trigger card effects on kill
        if (window.cardEffectHandler && window.game && window.game.enemy) {
            window.cardEffectHandler.onKillEnemy(window.game.enemy);
        }

        // Ajouter à l'historique
        if (window.game && window.game.addHistoryEntry) {
            window.game.addHistoryEntry('gold', `Or gagné: +${goldEarned} (Total: ${this.gold})`, '💰');
        }

        // Réactiver le bouton camp
        const campBtn = document.getElementById('camp-btn');
        campBtn.disabled = false;

        // Déclencher les améliorations de boss (comme dans le code Java)
        for (const bossUpgrade of this.bossUpgrades) {
            if (bossUpgrade.isEveryTurnTrigger()) {
                bossUpgrade.triggerEveryTurn();
            }
        }
    }

    removeFighter() {
        // Le joueur ne peut pas être supprimé
        console.log("Player cannot be removed");
    }

    deletePlayer() {
        // Réinitialiser le joueur complètement (comme dans le code Java)
        this.maxHealth = 1000;
        this.currentHealth = this.maxHealth;
        this.damage.setDamage(200);
        this.gold = 0;
        this.criticalHitChance = 1;
        this.criticalHitDamagePercent = 50;
        this.bossUpgrades = [];
        this.upgradeCount = 0;
        this.lootBoxesOpened = 0;
        this.updateHealth();
        this.updateGoldAmount();
    }
}
