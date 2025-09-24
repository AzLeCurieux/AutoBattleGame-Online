class CreateEnemies {
    constructor(game) {
        this.game = game;
        this.random = new Random();
        this.startHealth = 400;
        this.startDamage = 100;
    }

    createSquareEnemy(startFight) {
        const attackTime = 400;
        const maxHealth = this.healthGrowth(this.startHealth);
        const damage = this.damageGrowth(this.startDamage);
        const level = this.game.level;

        let newEnemy;
        
        if (level.levelIsABossBattlePreFight()) {
            // Créer un boss
            newEnemy = new Enemy(maxHealth * 2, Math.floor(damage * 1.25), true);
            console.log("Boss enemy created!");
        } else {
            // Créer un ennemi normal
            newEnemy = new Enemy(maxHealth, damage, false);
        }

        // Positionner l'ennemi dans une zone aléatoire autour du joueur
        this.positionEnemyRandomly(newEnemy);

        const attackAnimation = new AttackAnimation(this.game.player, newEnemy);
        
        if (startFight) {
            attackAnimation.startFight();
            level.nextLevel();
            
            // Notify game that level increased
            if (this.game.onLevelUp) {
                this.game.onLevelUp();
            }
        } else {
            attackAnimation.setPlayerFighting(false);
        }
        
        this.game.setAttackAnimation(attackAnimation);
        return attackAnimation;
    }

    positionEnemyRandomly(enemy) {
        // Positionner l'ennemi dans la zone enemy-area (comme au début)
        // L'ennemi sera positionné par le CSS de #enemy-area
        enemy.element.style.position = 'relative';
        enemy.element.style.left = 'auto';
        enemy.element.style.top = 'auto';
        enemy.element.style.zIndex = '10';
        
        // La barre de vie sera positionnée par le CSS normal
        const healthBar = enemy.element.parentElement.querySelector('.health-bar');
        
        if (healthBar) {
            healthBar.style.position = 'relative';
            healthBar.style.left = 'auto';
            healthBar.style.top = 'auto';
            healthBar.style.zIndex = '11';
        }
        
        console.log('Enemy positioned in enemy-area (default CSS positioning)');
    }

    damageGrowth(startDamage) {
        const level = this.game.level.getLevel();
        return Math.floor(2 * level + startDamage * Math.pow(1.02, level));
    }

    healthGrowth(startHealth) {
        const level = this.game.level.getLevel();
        return Math.floor(startHealth + 10 * level * Math.pow(1.05, level));
    }
}
