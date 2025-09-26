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
        // Positionner l'ennemi par left/top dans la moitié droite de l'arène
        const battleArea = document.getElementById('battle-area');
        const enemyContainer = document.getElementById('enemy-area');
        if (!battleArea || !enemyContainer) return;

        const battleRect = battleArea.getBoundingClientRect();
        const arenaW = battleRect.width;
        const arenaH = battleRect.height;
        const squareSize = 50;

        // Moitié droite, marges pour rester visibles
        const minX = Math.floor(arenaW / 2);
        const maxX = arenaW - squareSize;
        const minY = 0;
        const maxY = arenaH - squareSize;

        const randX = Math.floor(minX + Math.random() * Math.max(1, maxX - minX));
        const randY = Math.floor(minY + Math.random() * Math.max(1, maxY - minY));

        enemyContainer.style.position = 'absolute';
        enemyContainer.style.transition = 'left 0.3s linear, top 0.3s linear';
        enemyContainer.style.transform = '';
        enemyContainer.style.right = '';
        enemyContainer.style.left = randX + 'px';
        enemyContainer.style.top = randY + 'px';

        // Sauver position initiale relative à l'arène
        enemy.initialPosition = { x: randX, y: randY };

        // S'assurer que l'élément ennemi hérite bien (les barres suivent car dans le conteneur)
        enemy.element.style.left = '0px';
        enemy.element.style.top = '0px';
        enemy.element.style.transform = '';
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
