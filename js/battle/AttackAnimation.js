class AttackAnimation {
    constructor(player, enemy) {
        this.player = player;
        this.enemy = enemy;
        this.attackTime = 400;
        this.attackTimeBetween = 600;
        this.timeBetweenFights = 1200;
        this.playerFighting = false;
        this.enemyIsAlive = true;
        this.timeline = null;
        this.upgrades = null;
        this.battleArea = document.getElementById('battle-area');
        this.combatZone = document.querySelector('.combat-zone');
        this.playerContainer = document.getElementById('player-area');
        this.enemyContainer = document.getElementById('enemy-area');
        this.squareSize = 50;
        this.minDistance = 0;
        this.currentTurnTimeout = null;

        // Gérer le redimensionnement de la fenêtre
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }

    handleResize() {
        // Si on n'est pas en combat, on repositionne les combattants correctement au centre
        if (!this.playerFighting) {
            this.initializePositions();
        } else {
            // Si on est en combat, on s'assure que les combattants restent dans la zone visible
            // Cela corrige le bug où les personnages ne bougent plus si la fenêtre est réduite
            this.ensureFightersInBounds();
        }
    }

    ensureFightersInBounds() {
        if (!this.playerContainer || !this.enemyContainer) return;

        // Récupérer les positions cibles actuelles (pour ne pas interrompre brusquement une transition valide)
        let pX = parseInt(this.playerContainer.style.left);
        let pY = parseInt(this.playerContainer.style.top);
        // Fallback sur la position réelle si pas de style défini
        if (isNaN(pX)) pX = this.playerContainer.offsetLeft;
        if (isNaN(pY)) pY = this.playerContainer.offsetTop;

        let eX = parseInt(this.enemyContainer.style.left);
        let eY = parseInt(this.enemyContainer.style.top);
        if (isNaN(eX)) eX = this.enemyContainer.offsetLeft;
        if (isNaN(eY)) eY = this.enemyContainer.offsetTop;

        // moveContainer va recalculer les bounds actuelles et appliquer le clamping (contrainte de zone)
        // Si un combattant était hors zone (ex: après réduction fenêtre), il sera ramené au bord
        this.moveContainer(this.playerContainer, pX, pY);
        this.moveContainer(this.enemyContainer, eX, eY);
    }

    startFight() {
        this.playerFighting = true;
        this.enemyIsAlive = true;

        // Rendre l'ennemi visible au début du combat
        if (this.enemy && this.enemy.element) {
            this.enemy.element.style.opacity = '1';
            this.enemy.element.style.visibility = 'visible';
        }
        if (this.enemyContainer) {
            this.enemyContainer.style.opacity = '1';
            this.enemyContainer.style.visibility = 'visible';
        }

        this.player.triggerAtStartOfFight();

        // Initialiser les positions et attendre un peu pour éviter le bug visuel du premier coup
        this.initializePositions();
        this._firstImpactDone = false;
        this.currentMover = this.playerContainer;
        this.currentTarget = this.enemyContainer;

        // Attendre que les positions soient bien appliquées avant de commencer l'animation
        setTimeout(() => {
            this.stepTurn();
        }, 50);
    }

    startAttackCycle() {
        if (!this.enemyIsAlive || this.player.isDead()) {
            this.stopFight();
            return;
        }
        this.playerAttack();
        setTimeout(() => {
            if (this.enemyIsAlive && !this.player.isDead()) {
                this.enemyAttack();
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
        this.animatePlayerMovement(playerElement, enemyElement, () => {
            const damage = this.player.getPlayerDamage();
            this.enemy.takeDamage(damage, this.player.getDamageObject());

            // Vérifier l'effet EXECUTE immédiatement après les dégâts
            if (window.cardEffectHandler) {
                window.cardEffectHandler.checkExecute(this.enemy);
            }

            if (this.player.getDamageObject().isNewHitIsCrit()) {
                window.audioManager.play('crit');
            } else {
                window.audioManager.play('hit');
            }
            this.checkIfEnemyIsDead();
            if (window.game && window.game.syncWithServer) {
                window.game.syncWithServer();
            }
            this.returnPlayerToPosition(playerElement);
        });
    }

    enemyAttack() {
        const enemyElement = this.enemy.element;
        const playerElement = this.player.element;
        this.animateEnemyMovement(enemyElement, playerElement, () => {
            const damage = this.enemy.getDamage();
            const damageObject = this.enemy.getDamageObject();
            this.player.takeDamage(damage, damageObject);
            window.audioManager.play('hit');
            if (this.player.isDead()) {
                this.playerFighting = false;
                this.stopFight();
                this.player.removeFighter();
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

            // Notifier le jeu que l'ennemi est tué (pour le loot, victoire, etc.)
            if (window.game && window.game.onEnemyKilled) {
                window.game.onEnemyKilled();
            }

            setTimeout(() => {
                if (!this.upgrades) {
                    this.upgrades = new Upgrades(this.player, document.body);
                }
                if (!level.levelIsABossBattle()) {
                    this.upgrades.showUpgrades();
                } else {
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
        const enemyElement = this.enemy.element;
        const enemyContainer = this.enemyContainer;
        if (enemyElement && enemyContainer) {
            // Animation de disparition
            enemyElement.classList.add('enemy-dying');
            enemyContainer.classList.add('enemy-dying');

            setTimeout(() => {
                this.repositionPlayerToCenterLeft();
            }, 100);

            // Faire disparaître complètement l'ennemi après l'animation
            setTimeout(() => {
                if (enemyElement) {
                    enemyElement.style.opacity = '0';
                    enemyElement.style.visibility = 'hidden';
                    enemyElement.style.display = 'none';
                }
                if (enemyContainer) {
                    enemyContainer.style.opacity = '0';
                    enemyContainer.style.visibility = 'hidden';
                }
                this.enemy.removeFighter();
            }, 500);
        } else {
            this.enemy.removeFighter();
        }
    }

    repositionPlayerToCenterLeft() {
        if (!this.playerContainer || !this.battleArea) return;
        const bounds = this.getBounds();
        const centerLeftX = bounds.offsetX + Math.floor(bounds.width * 0.25) - Math.floor(this.squareSize / 2);
        const centerY = bounds.offsetY + Math.floor(bounds.height / 2) - Math.floor(this.squareSize / 2);
        this.playerContainer.style.transition = 'left 0.5s ease-out, top 0.5s ease-out';
        this.moveContainer(this.playerContainer, centerLeftX, centerY);
    }

    animatePlayerMovement(playerElement, enemyElement, callback) {
        const approach = this.getApproachPosition(this.playerContainer, this.enemyContainer);
        this.moveContainer(this.playerContainer, approach.x, approach.y);
        setTimeout(() => { if (callback) callback(); }, 300);
    }

    returnPlayerToPosition(playerElement) {
        setTimeout(() => {
            playerElement.style.transform = 'translateY(-50%)';
            playerElement.style.zIndex = '10';
        }, 100);
    }

    animateEnemyMovement(enemyElement, playerElement, callback) {
        const approach = this.getApproachPosition(this.enemyContainer, this.playerContainer);
        this.moveContainer(this.enemyContainer, approach.x, approach.y);
        setTimeout(() => { if (callback) callback(); }, 300);
    }

    returnEnemyToPosition(enemyElement) {
        setTimeout(() => {
            if (this.enemy && this.enemy.initialPosition) {
                this.moveContainer(this.enemyContainer, this.enemy.initialPosition.x, this.enemy.initialPosition.y);
            }
        }, 100);
    }

    initializePositions() {
        if (!this.battleArea || !this.playerContainer || !this.enemyContainer) return;

        const bounds = this.getBounds();
        const centerX = bounds.offsetX + Math.floor(bounds.width / 2);
        const centerY = bounds.offsetY + Math.floor(bounds.height / 2);

        // Au début de chaque niveau : positions fixes
        // Joueur : centre gauche (25% de la largeur)
        // Ennemi : centre droite (75% de la largeur)
        const playerStartX = bounds.offsetX + Math.floor(bounds.width * 0.25) - Math.floor(this.squareSize / 2);
        const enemyStartX = bounds.offsetX + Math.floor(bounds.width * 0.75) - Math.floor(this.squareSize / 2);
        const startY = centerY - Math.floor(this.squareSize / 2);

        // Désactiver les transitions temporairement pour éviter le glitch
        this.playerContainer.style.transition = 'none';
        this.enemyContainer.style.transition = 'none';

        this.moveContainer(this.playerContainer, playerStartX, startY);
        this.moveContainer(this.enemyContainer, enemyStartX, startY);

        // Forcer un reflow pour appliquer les positions sans transition
        void this.playerContainer.offsetWidth;
        void this.enemyContainer.offsetWidth;

        // Réactiver les transitions après un court délai
        setTimeout(() => {
            this.playerContainer.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.6, 0.2, 1), left 0.3s cubic-bezier(0.2, 0.6, 0.2, 1), top 0.3s cubic-bezier(0.2, 0.6, 0.2, 1)';
            this.enemyContainer.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.6, 0.2, 1), left 0.3s cubic-bezier(0.2, 0.6, 0.2, 1), top 0.3s cubic-bezier(0.2, 0.6, 0.2, 1)';
        }, 50);

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
        // Réduire les marges pour des positions plus proches et naturelles
        const padX = Math.floor(width * 0.10); // Réduit de 15% à 10%
        const padY = Math.floor(height * 0.10); // Réduit de 20% à 10%
        let minX = offsetX + padX;
        let maxX = offsetX + width - padX - this.squareSize;
        const minY = offsetY + padY;
        const maxY = offsetY + height - padY - this.squareSize;

        // Réduire la zone d'apparition pour qu'ils soient plus proches du centre
        // Joueur : 35% à 45% de la largeur (au lieu de 45%)
        // Ennemi : 55% à 65% de la largeur (au lieu de 55%+)
        if (isPlayer) {
            minX = Math.max(minX, offsetX + Math.floor(width * 0.35));
            maxX = Math.min(maxX, offsetX + Math.floor(width * 0.45) - this.squareSize);
        } else {
            minX = Math.max(minX, offsetX + Math.floor(width * 0.55));
            maxX = Math.min(maxX, offsetX + Math.floor(width * 0.65) - this.squareSize);
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
        // Vérifier si les deux rectangles se superposent
        // Les carrés se superposent si la distance entre leurs centres est < squareSize
        const r1CenterX = r1.left + this.squareSize / 2;
        const r1CenterY = r1.top + this.squareSize / 2;
        const r2CenterX = r2.left + this.squareSize / 2;
        const r2CenterY = r2.top + this.squareSize / 2;
        const dx = Math.abs(r1CenterX - r2CenterX);
        const dy = Math.abs(r1CenterY - r2CenterY);
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Distance minimale = squareSize (50px) pour qu'ils se touchent, mais on veut qu'ils ne se superposent pas
        // Donc distance doit être >= squareSize
        return distance < this.squareSize;
    }

    getNonOverlappingPosition() {
        const bounds = this.getBounds();
        const centerY = bounds.offsetY + Math.floor(bounds.height / 2);

        // Les deux carrés commencent sur la même ligne horizontale, centrés verticalement
        const commonY = centerY - Math.floor(this.squareSize / 2);

        // Positionner le joueur à gauche et l'ennemi à droite, sur la même ligne
        const padX = Math.floor(bounds.width * 0.10);
        const playerMinX = bounds.offsetX + padX;
        const playerMaxX = bounds.offsetX + Math.floor(bounds.width * 0.45) - this.squareSize;
        const enemyMinX = bounds.offsetX + Math.floor(bounds.width * 0.55);
        const enemyMaxX = bounds.offsetX + bounds.width - padX - this.squareSize;

        let pos1, pos2;
        let tries = 0;
        // Distance minimale = squareSize exactement (50px) pour qu'ils se touchent mais ne se superposent pas
        const minDistance = this.squareSize;

        do {
            // Position X aléatoire pour chaque carré, mais Y identique (centré)
            pos1 = {
                x: Math.floor(playerMinX + Math.random() * Math.max(1, (playerMaxX - playerMinX))),
                y: commonY
            };
            pos2 = {
                x: Math.floor(enemyMinX + Math.random() * Math.max(1, (enemyMaxX - enemyMinX))),
                y: commonY
            };

            // Vérifier la distance horizontale entre les centres
            const r1CenterX = pos1.x + this.squareSize / 2;
            const r2CenterX = pos2.x + this.squareSize / 2;
            const dx = Math.abs(r2CenterX - r1CenterX);

            // S'assurer qu'ils ne se superposent pas (distance horizontale >= minDistance)
            // Comme ils sont sur la même ligne Y, on vérifie seulement la distance X
            // Distance doit être >= squareSize pour éviter la superposition
            if (dx >= minDistance) break;
            tries += 1;
        } while (tries < 100);

        return { pos1, pos2 };
    }

    getApproachPosition(moverContainer, targetContainer) {
        const arenaRect = this.battleArea.getBoundingClientRect();
        const moverRect = moverContainer.getBoundingClientRect();
        const targetRect = targetContainer.getBoundingClientRect();

        // Calculer le centre de chaque carré
        const moverCenterX = moverRect.left + moverRect.width / 2;
        const moverCenterY = moverRect.top + moverRect.height / 2;
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        // Calculer la direction et la distance
        const dx = targetCenterX - moverCenterX;
        const dy = targetCenterY - moverCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= 0) {
            // Si déjà au même endroit, ne pas bouger
            return { x: moverRect.left - arenaRect.left, y: moverRect.top - arenaRect.top };
        }

        // Calculer la position où les deux carrés se touchent exactement
        // La distance entre les centres doit être exactement squareSize (50px)
        // pour que les bords se touchent, mais jamais moins pour éviter la superposition
        const normalizedDx = dx / distance;
        const normalizedDy = dy / distance;

        // Position du centre du mover pour qu'il touche le target
        // Le centre du mover doit être à exactement squareSize de distance du centre du target
        // Garantir que la distance est toujours >= squareSize pour éviter la superposition
        const minDistance = this.squareSize; // Distance minimale = squareSize (ils se touchent)
        const approachCenterX = targetCenterX - normalizedDx * minDistance;
        const approachCenterY = targetCenterY - normalizedDy * minDistance;

        // Vérifier que les carrés ne se superposent pas
        // Si la distance actuelle est déjà < squareSize, ne pas se rapprocher davantage
        if (distance < this.squareSize) {
            // Garder la position actuelle pour éviter la superposition
            return { x: moverRect.left - arenaRect.left, y: moverRect.top - arenaRect.top };
        }

        // Convertir le centre en position du coin supérieur gauche
        const approachX = approachCenterX - this.squareSize / 2;
        const approachY = approachCenterY - this.squareSize / 2;

        // Vérification finale : s'assurer que la distance résultante est >= squareSize
        const finalMoverCenterX = approachX + this.squareSize / 2 + arenaRect.left;
        const finalMoverCenterY = approachY + this.squareSize / 2 + arenaRect.top;
        const finalDx = targetCenterX - finalMoverCenterX;
        const finalDy = targetCenterY - finalMoverCenterY;
        const finalDistance = Math.sqrt(finalDx * finalDx + finalDy * finalDy);

        // Si la distance finale serait < squareSize, ajuster pour garantir le contact sans superposition
        if (finalDistance < this.squareSize) {
            const adjustedNormalizedDx = finalDx / (finalDistance || 1);
            const adjustedNormalizedDy = finalDy / (finalDistance || 1);
            const adjustedCenterX = targetCenterX - adjustedNormalizedDx * this.squareSize;
            const adjustedCenterY = targetCenterY - adjustedNormalizedDy * this.squareSize;
            return {
                x: Math.floor(adjustedCenterX - this.squareSize / 2 - arenaRect.left),
                y: Math.floor(adjustedCenterY - this.squareSize / 2 - arenaRect.top)
            };
        }

        return {
            x: Math.floor(approachX - arenaRect.left),
            y: Math.floor(approachY - arenaRect.top)
        };
    }

    stepTurn() {
        if (!this.playerFighting || !this.playerContainer || !this.enemyContainer) return;
        const mover = this.currentMover;
        const target = this.currentTarget;

        // Pour le premier coup, s'assurer que les positions initiales sont bien appliquées
        if (!this._firstImpactDone) {
            // Forcer un reflow pour s'assurer que les positions sont appliquées
            void this.playerContainer.offsetWidth;
            void this.enemyContainer.offsetWidth;
        }

        // Phase d'attaque : Mouvement rapide et impactant
        mover.style.transition = 'left 0.2s cubic-bezier(0.22, 1, 0.36, 1), top 0.2s cubic-bezier(0.22, 1, 0.36, 1)';

        const approach = this.getApproachPosition(mover, target);
        this.moveContainer(mover, approach.x, approach.y);

        // Pour le premier coup, augmenter légèrement le délai pour éviter le bug visuel
        const delay = this._firstImpactDone ? 200 : 250;

        this.currentTurnTimeout = setTimeout(() => {
            this.player.element.classList.add('hit');
            this.enemy.element.classList.add('hit');
            this._firstImpactDone = true;
            if (mover === this.playerContainer) {
                const damage = this.player.getPlayerDamage();
                this.enemy.takeDamage(damage, this.player.getDamageObject());

                // Vérifier l'effet EXECUTE immédiatement après les dégâts
                if (window.cardEffectHandler) {
                    window.cardEffectHandler.checkExecute(this.enemy);
                }

                if (this.player.getDamageObject().isNewHitIsCrit()) {
                    window.audioManager.play('crit');
                } else {
                    window.audioManager.play('hit');
                }
                this.checkIfEnemyIsDead();
                if (!this.enemyIsAlive) {
                    // Si l'ennemi est mort (ex: execute), il ne doit pas riposter
                    return;
                }
            } else {
                const damage = this.enemy.getDamage();
                const dmgObj = this.enemy.getDamageObject();

                // Tenter l'esquive
                if (window.cardEffectHandler && window.cardEffectHandler.tryDodge()) {
                    // Esquive réussie : pas de dégâts, pas de son de hit
                } else {
                    this.player.takeDamage(damage, dmgObj);
                    window.audioManager.play('hit');
                    if (this.player.isDead()) {
                        // Tenter la résurrection avant de mourir
                        if (window.cardEffectHandler && window.cardEffectHandler.onResurrect()) {
                            console.log('🔥 Player resurrected! Fight continues.');
                            // Le combat continue normalement
                        } else {
                            this.stopFight();
                            this.player.removeFighter();
                            if (window.game && window.game.onPlayerKilled) {
                                window.game.onPlayerKilled();
                            }

                            // Réinitialiser les couleurs du fond aux valeurs de base
                            if (window.setShaderColors) {
                                window.setShaderColors(
                                    { r: 0.58, g: 0.07, b: 0.07 }, // Rouge par défaut
                                    { r: 0.15, g: 0.15, b: 0.15 }, // Gris foncé
                                    { r: 0.05, g: 0.05, b: 0.05 }  // Noir
                                );
                            }
                            return;
                        }
                    }
                }
            }
            setTimeout(() => {
                this.player.element.classList.remove('hit');
                this.enemy.element.classList.remove('hit');
                const positions = this.getNonOverlappingPosition();

                // Phase de retour : Mouvement plus fluide
                this.playerContainer.style.transition = 'left 0.4s ease-out, top 0.4s ease-out';
                this.enemyContainer.style.transition = 'left 0.4s ease-out, top 0.4s ease-out';

                this.moveContainer(this.playerContainer, positions.pos1.x, positions.pos1.y);
                this.moveContainer(this.enemyContainer, positions.pos2.x, positions.pos2.y);
                this.currentMover = (mover === this.playerContainer) ? this.enemyContainer : this.playerContainer;
                this.currentTarget = (this.currentMover === this.playerContainer) ? this.enemyContainer : this.playerContainer;
                this.currentTurnTimeout = setTimeout(() => this.stepTurn(), 500);
            }, 100);
        }, delay);
    }
}
