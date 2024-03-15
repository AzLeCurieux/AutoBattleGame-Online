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

        // Nettoyer les classes d'animation de mort du conteneur ennemi avant de créer un nouvel ennemi
        const enemyContainer = document.getElementById('enemy-area');
        const enemyElement = document.getElementById('enemy');
        if (enemyContainer) {
            enemyContainer.classList.remove('enemy-dying');
            // Réinitialiser la visibilité pour le faire réapparaître
            enemyContainer.style.opacity = '1';
            enemyContainer.style.visibility = 'visible';
            enemyContainer.style.display = 'block';
        }
        if (enemyElement) {
            enemyElement.classList.remove('enemy-dying');
            // Réinitialiser la visibilité pour le faire réapparaître
            enemyElement.style.opacity = '1';
            enemyElement.style.visibility = 'visible';
            enemyElement.style.display = 'block';
        }

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

        // Masquer l'ennemi si le combat ne démarre pas immédiatement
        if (!startFight) {
            if (enemyContainer) {
                enemyContainer.style.opacity = '0';
                enemyContainer.style.visibility = 'hidden';
            }
            if (enemyElement) {
                enemyElement.style.opacity = '0';
                enemyElement.style.visibility = 'hidden';
            }
        }

        const attackAnimation = new AttackAnimation(this.game.player, newEnemy);

        // IMPORTANT: Set enemy in game instance so card effects can access it
        this.game.enemy = newEnemy;
        console.log(`🎯 Enemy created and set in game.enemy:`, !!this.game.enemy);

        // CRITICAL: Always set attackAnimation even if not starting fight immediately
        this.game.setAttackAnimation(attackAnimation);
        console.log(`✅ attackAnimation set on game`);

        if (startFight) {
            // 🛡️ ANTI-CHEAT: Validation désactivée temporairement
            // La validation se fait déjà au chargement de la page
            // TODO: Réimplémenter la validation pré-combat sans bloquer

            /*
            if (window.validateDeckBeforeFight) {
                console.log('🛡️ Vérification du deck avant combat...');
                window.validateDeckBeforeFight().catch(err => {
                    console.warn('⚠️ Erreur validation:', err);
                });
            }
            */

            // Démarrer le combat directement
            this.startValidatedFight(enemyContainer, enemyElement, attackAnimation, level);
        }

        return attackAnimation;
    }

    startValidatedFight(enemyContainer, enemyElement, attackAnimation, level) {
        // Rendre l'ennemi visible avant de démarrer le combat (réapparition)
        if (enemyContainer) {
            enemyContainer.style.opacity = '1';
            enemyContainer.style.visibility = 'visible';
            enemyContainer.style.display = 'block';
        }
        if (enemyElement) {
            enemyElement.style.opacity = '1';
            enemyElement.style.visibility = 'visible';
            enemyElement.style.display = 'block';
        }

        attackAnimation.startFight();
        const previousLevel = level.getLevel();
        level.nextLevel();

        // Notify game that level increased
        if (this.game.onLevelUp) {
            this.game.onLevelUp(previousLevel);
        }
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
        // Désactiver la transition initialement pour éviter le glitch
        enemyContainer.style.transition = 'none';
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

        // Forcer un reflow
        void enemyContainer.offsetWidth;

        // Réactiver la transition si nécessaire plus tard
        setTimeout(() => {
            if (enemyContainer) enemyContainer.style.transition = 'left 0.3s linear, top 0.3s linear';
        }, 50);
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
