class AttackAnimation {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.attackTime = 400;
        this.attackTimeBetween = 600; // 1.5 * attackTime
        this.timeBetweenFights = 1200; // 3 * attackTime
        this.playerFighting = false;
        this.enemyIsAlive = true;
        this.timeline = null;
        this.upgrades = null;
    }

    startFight() {
        this.playerFighting = true;
        this.enemyIsAlive = true;
        
        this.player.triggerAtStartOfFight();
        
        // Premier cycle d'attaque : joueur puis ennemi
        this.startAttackCycle();
    }

    startAttackCycle() {
        // Cycle d'attaque : joueur attaque d'abord, puis ennemi
        if (!this.enemyIsAlive || this.player.isDead()) {
            this.stopFight();
            return;
        }
        
        // Le joueur attaque d'abord
        this.playerAttack();
        
        // Puis l'ennemi attaque après un délai
        setTimeout(() => {
            if (this.enemyIsAlive && !this.player.isDead()) {
                this.enemyAttack();
                
                // Programmer le prochain cycle après un délai
                setTimeout(() => {
                    this.startAttackCycle();
                }, this.timeBetweenFights);
            } else {
                this.stopFight();
            }
        }, this.attackTimeBetween);
    }

    playerAttack() {
        const playerElement = this.player.element;
        const enemyElement = this.enemy.element;
        
        // Animation d'attaque
        AnimationUtils.animateAttack(playerElement, enemyElement, () => {
            // Infliger les dégâts
            const damage = this.player.getPlayerDamage();
            this.enemy.takeDamage(damage, this.player.getDamageObject());
            
            // Jouer le son
            if (this.player.getDamageObject().isNewHitIsCrit()) {
                window.audioManager.play('crit');
            } else {
                window.audioManager.play('hit');
            }
            
            // Vérifier si l'ennemi est mort
            this.checkIfEnemyIsDead();
        });
    }

    enemyAttack() {
        const enemyElement = this.enemy.element;
        const playerElement = this.player.element;
        
        // Animation d'attaque
        AnimationUtils.animateAttack(enemyElement, playerElement, () => {
            // Infliger les dégâts
            const damage = this.enemy.getDamage();
            this.player.takeDamage(damage, this.enemy.getDamageObject());
            
            // Jouer le son
            window.audioManager.play('hit');
            
            // Vérifier si le joueur est mort
            if (this.player.isDead()) {
                console.log("Game lost!!!!");
                this.playerFighting = false;
                this.stopFight();
                this.player.removeFighter();
                
                // Notify game that player died
                if (window.game && window.game.onPlayerKilled) {
                    window.game.onPlayerKilled();
                }
            }
        });
    }

    stopFight() {
        this.playerFighting = false;
        if (this.timeline) {
            clearInterval(this.timeline);
            this.timeline = null;
        }
    }

    setPlayerFighting(fighting) {
        this.playerFighting = fighting;
    }

    isPlayerFighting() {
        return this.playerFighting;
    }

    isEnemyIsAlive() {
        return this.enemyIsAlive;
    }

    getEnemy() {
        return this.enemy;
    }

    checkIfEnemyIsDead() {
        if (this.enemy.isDead()) {
            const level = Level.getInstance();
            console.log("Enemy is dead! Current level:", level.getLevel());
            this.deleteEnemy();
            this.player.triggerAfterKillingEnemy();
            
            // Afficher les améliorations après un délai
            setTimeout(() => {
                console.log("Showing upgrades for level:", level.getLevel());
                if (!this.upgrades) {
                    this.upgrades = new Upgrades(this.player, document.body);
                }
                // Show upgrades for all levels
                // Only show upgrades if it's not a boss battle
                if (!level.levelIsABossBattle()) {
                    console.log("Showing normal upgrades");
                    this.upgrades.showUpgrades();
                } else {
                    console.log("Showing boss upgrades");
                    // For boss battles, BossUpgrades handles its own display
                    this.upgrades.bossUpgrades.showBossUpgrades();
                }
            }, 500);
        }
    }

    deleteEnemy() {
        if (this.playerFighting) {
            this.stopFight();
        }
        
        this.enemyIsAlive = false;
        this.enemy.removeFighter();
    }
}
