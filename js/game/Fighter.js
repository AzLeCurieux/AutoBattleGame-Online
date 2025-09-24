class Fighter {
    constructor(maxHealth, damage) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.damage = new Damage(damage);
        this.random = new Random();
    }

    getMaxHealth() {
        return this.maxHealth;
    }

    getCurrentHealth() {
        return this.currentHealth;
    }

    getDamage() {
        return this.damage.getDamage();
    }

    getDamageObject() {
        return this.damage;
    }

    resetHealth() {
        this.currentHealth = this.maxHealth;
        this.updateHealth();
    }

    lowerCurrentHealth(damage) {
        this.currentHealth -= damage;
        if (this.currentHealth < 0) {
            this.currentHealth = 0;
        }
    }

    changeCurrentHealth(healAmount) {
        this.currentHealth += healAmount;
        if (this.currentHealth > this.maxHealth) {
            this.currentHealth = this.maxHealth;
        }
    }

    isDead() {
        return this.currentHealth <= 0;
    }

    upgradeMaxHealth(upgradeAmount) {
        this.maxHealth += upgradeAmount;
    }

    upgradeDamage(upgradeAmount) {
        this.damage.increaseDamage(upgradeAmount);
    }

    // Méthodes abstraites à implémenter dans les classes filles
    takeDamage(damage, damageObject) {
        throw new Error("takeDamage must be implemented by subclass");
    }

    removeFighter() {
        throw new Error("removeFighter must be implemented by subclass");
    }

    updateHealth() {
        throw new Error("updateHealth must be implemented by subclass");
    }
}

