class AnimationUtils {
    static showDamageText(element, damage, isCrit = false) {
        const damageOverlay = document.getElementById('damage-overlay');
        const damageText = document.createElement('div');
        
        damageText.className = `damage-text ${isCrit ? 'crit' : ''}`;
        damageText.textContent = damage;
        
        // Positionner le texte près de l'élément
        const rect = element.getBoundingClientRect();
        const randomOffsetX = (Math.random() - 0.5) * 40;
        const randomOffsetY = (Math.random() - 0.5) * 20;
        
        damageText.style.left = (rect.left + rect.width / 2 + randomOffsetX) + 'px';
        damageText.style.top = (rect.top + rect.height / 2 + randomOffsetY) + 'px';
        
        damageOverlay.appendChild(damageText);
        
        // Ajouter l'animation
        damageText.classList.add('damage-floating');
        
        // Supprimer après l'animation
        setTimeout(() => {
            if (damageText.parentNode) {
                damageText.parentNode.removeChild(damageText);
            }
        }, isCrit ? 2000 : 1500);
    }

    static animateAttack(attacker, target, callback) {
        const attackerRect = attacker.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        
        // Calculer la direction et la distance d'attaque
        const deltaX = targetRect.left - attackerRect.left;
        const deltaY = targetRect.top - attackerRect.top;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const isPlayer = attacker.id === 'player';
        
        // Calculer les composantes X et Y pour l'animation (limitées à 30px max)
        const maxDistance = 30;
        const scale = Math.min(1, maxDistance / distance);
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
        modal.classList.add('show', 'modal-slide-in');
        setTimeout(() => {
            modal.classList.remove('modal-slide-in');
        }, 500);
    }

    static hideModal(modal) {
        modal.classList.add('fade-out-down');
        setTimeout(() => {
            modal.classList.remove('show', 'fade-out-down');
        }, 400);
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
