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

        // Arena and containers
        this.battleArea = document.getElementById('battle-area');
        this.combatZone = document.querySelector('.combat-zone');
        this.playerContainer = document.getElementById('player-area');
        this.enemyContainer = document.getElementById('enemy-area');
        this.squareSize = 50;
        this.minDistance = 0;
        this.currentTurnTimeout = null;
    }

    startFight() {
        this.playerFighting = true;
        this.enemyIsAlive = true;
        
        this.player.triggerAtStartOfFight();
        
        // Initialiser des positions non superposées dans l'arène
        this.initializePositions();
        this._firstImpactDone = false;
        
        // Tour par tour: joueur puis ennemi
        this.currentMover = this.playerContainer;
        this.currentTarget = this.enemyContainer;
        this.stepTurn();
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
        
        // Animation de déplacement du joueur vers l'ennemi
        this.animatePlayerMovement(playerElement, enemyElement, () => {
            // Toujours gérer les dégâts côté client pour les animations
            const damage = this.player.getPlayerDamage();
            this.enemy.takeDamage(damage, this.player.getDamageObject());
            
            // Jouer le son d'impact
            if (this.player.getDamageObject().isNewHitIsCrit()) {
                window.audioManager.play('crit');
            } else {
                window.audioManager.play('hit');
            }
            
            // Vérifier si l'ennemi est mort
            this.checkIfEnemyIsDead();
            
            // Synchroniser avec le serveur
            if (window.game && window.game.syncWithServer) {
                window.game.syncWithServer();
            }
            
            // Retourner le joueur à sa position initiale
            this.returnPlayerToPosition(playerElement);
        });
    }

    enemyAttack() {
        const enemyElement = this.enemy.element;
        const playerElement = this.player.element;
        
        // Animation de déplacement de l'ennemi vers le joueur
        this.animateEnemyMovement(enemyElement, playerElement, () => {
            // Infliger les dégâts
            const damage = this.enemy.getDamage();
            const damageObject = this.enemy.getDamageObject();
            this.player.takeDamage(damage, damageObject);
            
            // Jouer le son d'impact
            window.audioManager.play('hit');
            
            // Vérifier si le joueur est mort
            if (this.player.isDead()) {
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
        if (this.currentTurnTimeout) {
            clearTimeout(this.currentTurnTimeout);
            this.currentTurnTimeout = null;
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
            this.deleteEnemy();
            this.player.triggerAfterKillingEnemy();
            
            // Afficher les améliorations après un délai
            setTimeout(() => {
                if (!this.upgrades) {
                    this.upgrades = new Upgrades(this.player, document.body);
                }
                // Show upgrades for all levels
                // Only show upgrades if it's not a boss battle
                if (!level.levelIsABossBattle()) {
                    this.upgrades.showUpgrades();
                } else {
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

    // Animation de déplacement du joueur vers l'ennemi (par positions absolues du conteneur)
    animatePlayerMovement(playerElement, enemyElement, callback) {
        const approach = this.getApproachPosition(this.playerContainer, this.enemyContainer);
        this.moveContainer(this.playerContainer, approach.x, approach.y);
        setTimeout(() => { if (callback) callback(); }, 300);
    }

    // Retourner le joueur à sa position initiale
    returnPlayerToPosition(playerElement) {
        // Animation de retour à la position initiale
        setTimeout(() => {
            playerElement.style.transform = 'translateY(-50%)';
            playerElement.style.zIndex = '10';
        }, 100);
    }

    // Animation de déplacement de l'ennemi vers le joueur (par positions absolues du conteneur)
    animateEnemyMovement(enemyElement, playerElement, callback) {
        const approach = this.getApproachPosition(this.enemyContainer, this.playerContainer);
        this.moveContainer(this.enemyContainer, approach.x, approach.y);
        setTimeout(() => { if (callback) callback(); }, 300);
    }

    // Retourner l'ennemi à sa position initiale
    returnEnemyToPosition(enemyElement) {
        setTimeout(() => {
            if (this.enemy && this.enemy.initialPosition) {
                this.moveContainer(this.enemyContainer, this.enemy.initialPosition.x, this.enemy.initialPosition.y);
            }
        }, 100);
    }

    // ----------------------
    // Nouveau système inspiré
    // ----------------------
    initializePositions() {
        if (!this.battleArea || !this.playerContainer || !this.enemyContainer) return;
        // S'assurer que les conteneurs sont bien positionnés relativement à l'arène
        this.playerContainer.style.position = 'absolute';
        this.enemyContainer.style.position = 'absolute';

        const positions = this.getNonOverlappingPosition();
        this.moveContainer(this.playerContainer, positions.pos1.x, positions.pos1.y);
        this.moveContainer(this.enemyContainer, positions.pos2.x, positions.pos2.y);

        // Transitions douces
        this.playerContainer.style.transition = 'left 0.3s linear, top 0.3s linear';
        this.enemyContainer.style.transition = 'left 0.3s linear, top 0.3s linear';

        // Anchor snap to center (guard against out-of-frame on load)
        const bounds = this.getBounds();
        const centerX = bounds.offsetX + Math.floor(bounds.width / 2);
        const centerY = bounds.offsetY + Math.floor(bounds.height / 2);
        // If any container is out of bounds, snap near center
        const ensureIn = (el) => {
            const r = el.getBoundingClientRect();
            const within = r.left >= bounds.battleRect.left && r.right <= bounds.battleRect.left + bounds.width && r.top >= bounds.battleRect.top && r.bottom <= bounds.battleRect.top + bounds.height;
            if (!within) {
                this.moveContainer(el, centerX - this.squareSize - 20, centerY - this.squareSize - 20);
            }
        };
        ensureIn(this.playerContainer);
        ensureIn(this.enemyContainer);
    }

    resetPositionsCentered() {
        // Exposé pour reset après sélection d'une amélioration
        this.initializePositions();
    }

    getBounds() {
        const battleRect = this.battleArea.getBoundingClientRect();
        const combatRect = this.combatZone ? this.combatZone.getBoundingClientRect() : battleRect;
        const offsetX = combatRect.left - battleRect.left;
        const offsetY = combatRect.top - battleRect.top;
        return { battleRect, combatRect, offsetX, offsetY, width: combatRect.width, height: combatRect.height };
    }

    getCenteredRandomPosition(isPlayer) {
        const { offsetX, offsetY, width, height } = this.getBounds();
        // Central band inside combat zone
        const padX = Math.floor(width * 0.15);
        const padY = Math.floor(height * 0.20);
        let minX = offsetX + padX;
        let maxX = offsetX + width - padX - this.squareSize;
        const minY = offsetY + padY;
        const maxY = offsetY + height - padY - this.squareSize;
        // Keep player on left-center, enemy on right-center
        if (isPlayer) {
            maxX = Math.min(maxX, offsetX + Math.floor(width * 0.45) - this.squareSize);
        } else {
            minX = Math.max(minX, offsetX + Math.floor(width * 0.55));
        }
        return {
            x: Math.floor(minX + Math.random() * Math.max(1, (maxX - minX))),
            y: Math.floor(minY + Math.random() * Math.max(1, (maxY - minY)))
        };
    }

    moveContainer(container, x, y) {
        const { offsetX, offsetY, width, height } = this.getBounds();
        const minX = offsetX;
        const minY = offsetY;
        const maxX = offsetX + width - this.squareSize;
        const maxY = offsetY + height - this.squareSize;
        const clampedX = Math.max(minX, Math.min(x, maxX));
        const clampedY = Math.max(minY, Math.min(y, maxY));
        container.style.left = `${clampedX}px`;
        container.style.top = `${clampedY}px`;
    }

    checkCollisionByRect(r1, r2) {
        return Math.abs(r1.left - r2.left) < this.squareSize && Math.abs(r1.top - r2.top) < this.squareSize;
    }

    getNonOverlappingPosition() {
        let pos1, pos2;
        const pCont = this.playerContainer;
        const eCont = this.enemyContainer;
        let tries = 0;
        do {
            pos1 = this.getCenteredRandomPosition(true);
            pos2 = this.getCenteredRandomPosition(false);
            // simulate rects
            const rect1 = { left: pos1.x, top: pos1.y };
            const rect2 = { left: pos2.x, top: pos2.y };
            if (!this.checkCollisionByRect(rect1, rect2)) break;
            tries += 1;
        } while (tries < 50);
        return { pos1, pos2 };
    }

    getApproachPosition(moverContainer, targetContainer) {
        const arenaRect = this.battleArea.getBoundingClientRect();
        const moverRect = moverContainer.getBoundingClientRect();
        const targetRect = targetContainer.getBoundingClientRect();
        const dx = targetRect.left - moverRect.left;
        const dy = targetRect.top - moverRect.top;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= 0) {
            return { x: moverRect.left - arenaRect.left, y: moverRect.top - arenaRect.top };
        }
        // Offset adaptatif pour ne pas frapper dans le vide
        // Si on est déjà très proche en X et Y, réduire l'offset
        // offset minimal au premier coup pour garantir contact
        let dynamicMin = this.minDistance;
        if (!this._firstImpactDone) {
            dynamicMin = 0;
        } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
            dynamicMin = 0;
        }
        const offset = this.squareSize + dynamicMin;
        const ratio = Math.max(0, (distance - offset) / distance);
        const approachX = moverRect.left + dx * ratio;
        const approachY = moverRect.top + dy * ratio;
        return {
            x: Math.floor(approachX - arenaRect.left),
            y: Math.floor(approachY - arenaRect.top)
        };
    }

    stepTurn() {
        if (!this.playerFighting || !this.playerContainer || !this.enemyContainer) return;
        const mover = this.currentMover;
        const target = this.currentTarget;

        // Déplacer le conteneur courant vers la cible
        const approach = this.getApproachPosition(mover, target);
        this.moveContainer(mover, approach.x, approach.y);

        // Impact après la transition
        this.currentTurnTimeout = setTimeout(() => {
            // Effet de choc (secousse) sur les carrés
            this.player.element.classList.add('hit');
            this.enemy.element.classList.add('hit');
            this._firstImpactDone = true;

            // Appliquer les dégâts
            if (mover === this.playerContainer) {
                const damage = this.player.getPlayerDamage();
                this.enemy.takeDamage(damage, this.player.getDamageObject());
                if (this.player.getDamageObject().isNewHitIsCrit()) {
                    window.audioManager.play('crit');
                } else {
                    window.audioManager.play('hit');
                }
                this.checkIfEnemyIsDead();
                if (!this.enemyIsAlive) {
                    return; // combat interrompu, l'ennemi est supprimé
                }
            } else {
                const damage = this.enemy.getDamage();
                const dmgObj = this.enemy.getDamageObject();
                this.player.takeDamage(damage, dmgObj);
                window.audioManager.play('hit');
                if (this.player.isDead()) {
                    this.stopFight();
                    this.player.removeFighter();
                    if (window.game && window.game.onPlayerKilled) {
                        window.game.onPlayerKilled();
                    }
                    return;
                }
            }

            // Fin de l'impact
            setTimeout(() => {
                this.player.element.classList.remove('hit');
                this.enemy.element.classList.remove('hit');

        // Repositionnement recentré (faible amplitude) pour le prochain tour
        const positions = this.getNonOverlappingPosition();
        this.moveContainer(this.playerContainer, positions.pos1.x, positions.pos1.y);
        this.moveContainer(this.enemyContainer, positions.pos2.x, positions.pos2.y);

                // Changer de tour
                this.currentMover = (mover === this.playerContainer) ? this.enemyContainer : this.playerContainer;
                this.currentTarget = (this.currentMover === this.playerContainer) ? this.enemyContainer : this.playerContainer;

                // Enchaîner le prochain tour
                this.currentTurnTimeout = setTimeout(() => this.stepTurn(), 500);
            }, 100);
        }, 300);
    }
}
