class Enemy extends Fighter {
    constructor(health, damage, isBoss = false) {
        super(health, damage);
        this.isBoss = isBoss;
        this.element = document.getElementById('enemy');
        this.healthBar = document.getElementById('enemy-health-fill');
        this.healthText = document.getElementById('enemy-health-text');
        const enemyContainer = document.getElementById('enemy-area');
        
        // Retirer toutes les classes d'animation de mort avant de créer un nouvel ennemi
        if (this.element) {
            this.element.classList.remove('enemy-dying');
            // Forcer la réinitialisation en retirant l'animation et réinitialisant les styles
            this.element.style.animation = 'none';
            this.element.style.display = 'block';
            this.element.style.transform = 'scale(1)';
            // Ne pas forcer la visibilité ici, elle sera gérée par createSquareEnemy selon startFight
        }
        if (enemyContainer) {
            enemyContainer.classList.remove('enemy-dying');
            enemyContainer.style.animation = 'none';
            // Ne pas forcer la visibilité ici, elle sera gérée par createSquareEnemy selon startFight
        }
        
        // Ajuster la taille si c'est un boss
        if (isBoss) {
            this.element.classList.add('boss');
            this.element.classList.add('boss-glow');
        }
        
        this.updateHealth();
    }

    takeDamage(damage, damageObject) {
        this.lowerCurrentHealth(damage);
        
        // Afficher les dégâts flottants
        const isCrit = damageObject.isNewHitIsCrit();
        AnimationUtils.showDamageText(this.element, damage, isCrit);
        AnimationUtils.animateFighterHit(this.element);
        AnimationUtils.animateHealthBar(this.element.parentElement.querySelector('.health-bar'));
        
        if (isCrit) {
            damageObject.critDamageDone();
        }
        
        this.updateHealth();
        return damage;
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

    removeFighter() {
        // Animation de disparition
        this.element.style.opacity = '0';
        this.element.style.transform = 'scale(0)';
        
        setTimeout(() => {
            this.element.style.display = 'none';
            // Réinitialiser pour le prochain ennemi
            this.element.style.opacity = '1';
            this.element.style.transform = 'scale(1)';
            this.element.style.display = 'block';
            this.element.classList.remove('boss', 'boss-glow');
        }, 300);
    }

    deleteEnemy() {
        this.removeFighter();
    }
}
