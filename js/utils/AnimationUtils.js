class AnimationUtils {
    static showDamageText(element, damage, isCrit = false) {
        const damageOverlay = document.getElementById('damage-overlay');
        const damageText = document.createElement('div');
        
        // Déterminer si c'est le joueur ou l'ennemi
        const isPlayer = element.id === 'player' || element.closest('#player-area');
        const isEnemy = element.id === 'enemy' || element.closest('#enemy-area');
        
        // Construire les classes CSS
        let className = 'damage-text';
        if (isCrit) {
            className += ' crit';
        }
        if (isPlayer) {
            className += ' player-damage';
        } else if (isEnemy) {
            className += ' enemy-damage';
        }
        
        damageText.className = className;
        damageText.textContent = damage;
        
        // Positionner le texte près de l'élément
        const rect = element.getBoundingClientRect();
        const randomOffsetX = (Math.random() - 0.5) * 40;
        const randomOffsetY = (Math.random() - 0.5) * 20;
        
        damageText.style.left = (rect.left + rect.width / 2 + randomOffsetX) + 'px';
        damageText.style.top = (rect.top + rect.height / 2 + randomOffsetY) + 'px';
        
        damageOverlay.appendChild(damageText);
        
        // Pour les critiques, ajouter un préfixe visuel (flash rouge)
        if (isCrit) {
            // Ajouter un effet de flash au moment du coup critique
            const flash = document.createElement('div');
            flash.style.cssText = `
                position: absolute;
                left: ${rect.left + rect.width / 2}px;
                top: ${rect.top + rect.height / 2}px;
                width: 120px;
                height: 120px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(255, 0, 0, 0.6), transparent 70%);
                pointer-events: none;
                z-index: 500;
                transform: translate(-50%, -50%);
                animation: critFlash 0.5s ease-out forwards;
            `;
            damageOverlay.appendChild(flash);
            
            setTimeout(() => {
                if (flash.parentNode) {
                    flash.parentNode.removeChild(flash);
                }
            }, 500);
        }
        
        // Ajouter l'animation
        damageText.classList.add('damage-floating');
        
        // Supprimer après l'animation (très rapide)
        setTimeout(() => {
            if (damageText.parentNode) {
                damageText.parentNode.removeChild(damageText);
            }
        }, isCrit ? 1000 : 400);
    }

    static animateAttack(attacker, target, callback) {
        // Trouver le conteneur parent (#battle-area) pour calculer les positions relatives
        const battleArea = document.getElementById('battle-area');
        if (!battleArea) {
            // Fallback si pas de battle-area
            if (callback) callback();
            return;
        }
        
        const battleRect = battleArea.getBoundingClientRect();
        const attackerRect = attacker.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        
        // Calculer les positions relatives au conteneur battle-area
        const attackerX = attackerRect.left - battleRect.left + attackerRect.width / 2;
        const attackerY = attackerRect.top - battleRect.top + attackerRect.height / 2;
        const targetX = targetRect.left - battleRect.left + targetRect.width / 2;
        const targetY = targetRect.top - battleRect.top + targetRect.height / 2;
        
        // Calculer la direction et la distance d'attaque (relatives)
        const deltaX = targetX - attackerX;
        const deltaY = targetY - attackerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const isPlayer = attacker.id === 'player';
        
        // Calculer les composantes X et Y pour l'animation (limitées à 40px max pour plus d'impact)
        const maxDistance = 40;
        const scale = distance > 0 ? Math.min(1, maxDistance / distance) : 0;
        const attackDeltaX = deltaX * scale;
        const attackDeltaY = deltaY * scale;
        
        // Ajouter la classe d'animation
        attacker.classList.add(isPlayer ? 'attacking' : 'enemy-attacking');
        
        // Définir les propriétés CSS pour l'animation
        if (isPlayer) {
            // Le joueur va vers l'ennemi
            attacker.style.setProperty('--attack-delta-x', attackDeltaX + 'px');
            attacker.style.setProperty('--attack-delta-y', attackDeltaY + 'px');
        } else {
            // L'ennemi va vers le joueur
            attacker.style.setProperty('--enemy-attack-delta-x', attackDeltaX + 'px');
            attacker.style.setProperty('--enemy-attack-delta-y', attackDeltaY + 'px');
        }
        
        // Appeler le callback au milieu de l'animation
        setTimeout(() => {
            if (callback) callback();
        }, 200);
        
        // Supprimer la classe après l'animation
        setTimeout(() => {
            attacker.classList.remove('attacking', 'enemy-attacking');
        }, 400);
    }

    static animateHealthBar(healthBar, isShake = true) {
        if (isShake) {
            healthBar.classList.add('health-bar-shake');
            setTimeout(() => {
                healthBar.classList.remove('health-bar-shake');
            }, 300);
        }
    }

    static animateFighterHit(fighter) {
        fighter.classList.add('fighter-hit');
        setTimeout(() => {
            fighter.classList.remove('fighter-hit');
        }, 200);
    }

    static animateHeal(fighter) {
        fighter.classList.add('heal-effect');
        setTimeout(() => {
            fighter.classList.remove('heal-effect');
        }, 600);
    }

    static showModal(modal) {
        // PERFORMANCE: Use requestAnimationFrame instead of forced reflow
        modal.classList.remove('modal-closing', 'fade-out-down');

        // PERFORMANCE: Use requestAnimationFrame for smoother animation
        requestAnimationFrame(() => {
            modal.classList.add('show', 'modal-slide-in');

            // Nettoyer après l'animation (réduit à 200ms)
            setTimeout(() => {
                modal.classList.remove('modal-slide-in');
            }, 200);
        });
    }

    static hideModal(modal) {
        // PERFORMANCE: Faster closing animation
        modal.classList.remove('modal-slide-in');

        // PERFORMANCE: Use requestAnimationFrame for smoother animation
        requestAnimationFrame(() => {
            // Désactiver immédiatement les interactions
            modal.style.pointerEvents = 'none';

            // Ajouter la classe de fermeture pour transition rapide
            modal.classList.add('modal-closing');

            // Retirer show immédiatement pour éviter le flash noir
            modal.classList.remove('show');

            // Nettoyer après la transition (réduit à 100ms)
            setTimeout(() => {
                modal.classList.remove('modal-closing', 'fade-out-down');
                modal.style.pointerEvents = '';
            }, 100);
        });
    }

    static animateButton(button) {
        button.classList.add('button-pulse');
        setTimeout(() => {
            button.classList.remove('button-pulse');
        }, 300);
    }

    static animateUpgradeOption(option) {
        option.classList.add('upgrade-glow');
        setTimeout(() => {
            option.classList.remove('upgrade-glow');
        }, 1000);
    }

    static animateLevelUp(levelElement) {
        levelElement.classList.add('level-up');
        setTimeout(() => {
            levelElement.classList.remove('level-up');
        }, 800);
    }

    static animateGoldGain(goldElement) {
        goldElement.classList.add('gold-gain');
        setTimeout(() => {
            goldElement.classList.remove('gold-gain');
        }, 500);
    }

    static animateVictory(element) {
        element.classList.add('victory-bounce');
        setTimeout(() => {
            element.classList.remove('victory-bounce');
        }, 1000);
    }

    static animateDefeat(element) {
        element.classList.add('defeat-shake');
        setTimeout(() => {
            element.classList.remove('defeat-shake');
        }, 500);
    }

    static createParticles(element, count = 5) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            const angle = (Math.PI * 2 * i) / count;
            const distance = 20 + Math.random() * 30;
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            
            document.body.appendChild(particle);
            
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 2000);
        }
    }

    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            element.style.opacity = Math.min(progress, 1);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    static fadeOut(element, duration = 300) {
        let start = null;
        const initialOpacity = parseFloat(getComputedStyle(element).opacity);
        
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            element.style.opacity = initialOpacity * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    }

    static slideIn(element, direction = 'up', duration = 300) {
        const directions = {
            up: { from: 'translateY(50px)', to: 'translateY(0)' },
            down: { from: 'translateY(-50px)', to: 'translateY(0)' },
            left: { from: 'translateX(50px)', to: 'translateX(0)' },
            right: { from: 'translateX(-50px)', to: 'translateX(0)' }
        };
        
        const dir = directions[direction] || directions.up;
        
        element.style.transform = dir.from;
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            element.style.transform = `translateX(${(1 - progress) * 50}px)`;
            element.style.opacity = Math.min(progress, 1);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
}
