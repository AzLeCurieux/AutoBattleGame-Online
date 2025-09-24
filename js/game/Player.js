class Player extends Fighter {
    constructor() {
        super(1000, 200); // maxHealth, damage
        this.gold = 0;
        this.goldAmount = 1;
        this.criticalHitChance = 1;
        this.criticalHitDamagePercent = 50;
        this.bossUpgrades = [];
        this.element = document.getElementById('player');
        this.healthBar = document.getElementById('player-health-fill');
        this.healthText = document.getElementById('player-health-text');
        this.goldText = document.getElementById('gold-text');
        
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
        this.lowerCurrentHealth(damage);
        this.updateHealth();
        
        // Afficher les dégâts flottants
        AnimationUtils.showDamageText(this.element, damage);
        AnimationUtils.animateFighterHit(this.element);
        AnimationUtils.animateHealthBar(this.element.parentElement.querySelector('.health-bar'));
        
        return damage;
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
        return `Damage: ${this.getDamage()}\nHealth: ${this.currentHealth}/${this.maxHealth}\nCritical Hit chance: ${this.criticalHitChance}%\nCritical Hit damage: ${this.criticalHitDamagePercent}%`;
    }

    getPlayerDamage() {
        let damage = this.getDamage();
        
        const critChance = this.random.nextInt(100) + 1;
        if (critChance <= this.criticalHitChance) {
            damage = Math.floor(damage * (1 + this.criticalHitDamagePercent / 100));
            this.damage.nextHitIsCrit();
        }
        return damage;
    }

    upgradeCritDamage(upgrade) {
        this.criticalHitDamagePercent += upgrade;
    }

    upgradeCritChance(upgrade) {
        this.criticalHitChance += upgrade;
    }

    addBossUpgrade(bossUpgrade) {
        bossUpgrade.triggerWhenPicked();
        this.bossUpgrades.push(bossUpgrade);
        console.log("Boss upgrade added:", bossUpgrade);
    }

    triggerAtStartOfFight() {
        console.log(`Boss upgrades active: ${this.bossUpgrades.length}`);
    }

    triggerAfterKillingEnemy() {
        this.changeGoldAmount();
        
        // Réactiver le bouton camp
        const campBtn = document.getElementById('camp-btn');
        campBtn.disabled = false;
        
        // Déclencher les améliorations de boss (comme dans le code Java)
        console.log(`Triggering boss upgrades after killing enemy. Total upgrades: ${this.bossUpgrades.length}`);
        for (const bossUpgrade of this.bossUpgrades) {
            if (bossUpgrade.isEveryTurnTrigger()) {
                console.log("Triggering boss upgrade:", bossUpgrade);
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
        this.updateHealth();
        this.updateGoldAmount();
    }
}
