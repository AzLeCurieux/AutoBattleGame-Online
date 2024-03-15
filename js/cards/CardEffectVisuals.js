/**
 * Gestion des animations visuelles pour les effets de cartes
 */

class CardEffectVisuals {
    constructor(player) {
        this.player = player;
        this.activeAuras = new Map();
    }

    /**
     * Afficher l'aura rouge (dégâts bonus sous 50% PV)
     */
    showLowHealthAura() {
        if (this.activeAuras.has('low-health')) return;

        const playerElement = this.player.element;
        if (!playerElement) return;

        const aura = document.createElement('div');
        aura.className = 'card-effect-aura red-aura';
        aura.style.cssText = `
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,50,50,0.3) 0%, rgba(255,50,50,0) 70%);
            box-shadow: 0 0 30px rgba(255,50,50,0.6), inset 0 0 30px rgba(255,50,50,0.3);
            animation: pulse-red 1.5s ease-in-out infinite;
            pointer-events: none;
            z-index: 1;
        `;

        playerElement.style.position = 'relative';
        playerElement.appendChild(aura);
        this.activeAuras.set('low-health', aura);

        console.log('🔴 Red aura activated');
    }

    /**
     * Masquer l'aura rouge
     */
    hideLowHealthAura() {
        const aura = this.activeAuras.get('low-health');
        if (aura && aura.parentNode) {
            aura.parentNode.removeChild(aura);
            this.activeAuras.delete('low-health');
            console.log('🔴 Red aura removed');
        }
    }

    /**
     * Animation de vol de vie (aura verte + texte heal)
     */
    showLifestealEffect(player, healAmount) {
        const playerElement = player.element;
        if (!playerElement) return;

        // Flash d'aura verte
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(50,255,50,0.5) 0%, rgba(50,255,50,0) 70%);
            box-shadow: 0 0 40px rgba(50,255,50,0.8);
            animation: fade-out-green 0.8s ease-out;
            pointer-events: none;
            z-index: 2;
        `;

        playerElement.style.position = 'relative';
        playerElement.appendChild(flash);

        setTimeout(() => {
            if (flash.parentNode) flash.parentNode.removeChild(flash);
        }, 800);

        // Texte de heal
        this.showFloatingText(playerElement, `+${healAmount}❤️`, '#50ff50');

        console.log('💚 Lifesteal effect shown');
    }

    /**
     * Animation de renvoi de dégâts
     */
    showReflectEffect(enemy, reflectAmount) {
        const enemyElement = enemy.element;
        const playerElement = this.player.element;

        if (!enemyElement || !playerElement) return;

        // 1. Effet d'épines sur le JOUEUR (source du renvoi)
        const thornsContainer = document.createElement('div');
        thornsContainer.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100%;
            height: 100%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 10;
        `;

        // Créer plusieurs piques
        for (let i = 0; i < 8; i++) {
            const spike = document.createElement('div');
            const angleDeg = i * 45;

            spike.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-bottom: 20px solid #aaffaa;
                --r: ${angleDeg}deg;
                transform: translate(-50%, -50%) rotate(var(--r)) translateY(-10px);
                opacity: 0;
                animation: spike-pop 0.4s ease-out forwards;
                filter: drop-shadow(0 0 2px #005500);
            `;
            thornsContainer.appendChild(spike);
        }

        playerElement.appendChild(thornsContainer);

        // Nettoyage épines
        setTimeout(() => {
            if (thornsContainer.parentNode) thornsContainer.remove();
        }, 400);

        // 2. Impact sur l'ENNEMI
        const impact = document.createElement('div');
        impact.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 4px solid #ff3333;
            background: radial-gradient(circle, rgba(255,50,50,0.4) 0%, rgba(255,0,0,0) 70%);
            transform: translate(-50%, -50%) scale(0);
            animation: reflect-impact 0.5s ease-out;
            pointer-events: none;
            z-index: 10;
        `;
        enemyElement.appendChild(impact);

        setTimeout(() => {
            if (impact.parentNode) impact.remove();
        }, 500);

        // Texte de dégâts renvoyés
        this.showFloatingText(enemyElement, `-${reflectAmount}`, '#ff5555');

        console.log('🛡️ Thorns effect shown');
    }

    /**
     * Animation de soins sur kill
     */
    showHealOnKillEffect(player, healAmount) {
        const playerElement = player.element;
        if (!playerElement) return;

        // Particules vertes montantes
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                const angle = (Math.PI * 2 * i) / 8;
                const distance = 30 + Math.random() * 20;

                particle.textContent = '✨';
                particle.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        font-size: 20px;
        color: #50ff50;
        transform: translate(-50%, -50%);
        animation: particle-rise 1s ease-out;
        pointer-events: none;
        z-index: 4;
        `;

                particle.style.setProperty('--angle', `${angle}rad`);
                particle.style.setProperty('--distance', `${distance}px`);

                playerElement.appendChild(particle);

                setTimeout(() => {
                    if (particle.parentNode) particle.parentNode.removeChild(particle);
                }, 1000);
            }, i * 50);
        }

        // Texte de heal
        this.showFloatingText(playerElement, `+${healAmount}❤️`, '#50ff50');

        console.log('✨ Heal on kill effect shown');
    }

    /**
     * Afficher un texte flottant
     */
    showFloatingText(element, text, color = '#ffffff') {
        const floatingText = document.createElement('div');
        floatingText.textContent = text;
        floatingText.style.cssText = `
        position: absolute;
        top: -20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 18px;
        font-weight: bold;
        color: ${color};
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        animation: float-up 1.5s ease-out;
        pointer-events: none;
        z-index: 5;
        `;

        element.style.position = 'relative';
        element.appendChild(floatingText);

        setTimeout(() => {
            if (floatingText.parentNode) floatingText.parentNode.removeChild(floatingText);
        }, 1500);
    }

    /**
     * Afficher ligne de dégâts bonus (rouge)
     */
    showBonusDamageLine(element, bonusDamage) {
        const damageLine = document.createElement('div');
        damageLine.textContent = `+${bonusDamage}`;
        damageLine.style.cssText = `
        position: absolute;
        top: 30px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 14px;
        font-weight: bold;
        color: #ff5050;
        text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8);
        animation: float-up 1s ease-out;
        pointer-events: none;
        z-index: 5;
        `;

        element.appendChild(damageLine);

        setTimeout(() => {
            if (damageLine.parentNode) damageLine.parentNode.removeChild(damageLine);
        }, 1000);
    }

    /**
     * Animation de réduction de dégâts (aura grise)
     */
    showDamageReductionEffect(target, amountReduced) {
        const element = target.element;
        if (!element) return;

        // Flash d'aura grise
        const flash = document.createElement('div');
        flash.style.cssText = `
        position: absolute;
        top: -10px;
        left: -10px;
        right: -10px;
        bottom: -10px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(200, 200, 200, 0.4) 0%, rgba(200, 200, 200, 0) 70%);
        box-shadow: 0 0 30px rgba(200, 200, 200, 0.5);
        animation: fade-out-gray 0.6s ease-out;
        pointer-events: none;
        z-index: 2;
        `;

        element.style.position = 'relative';
        element.appendChild(flash);

        setTimeout(() => {
            if (flash.parentNode) flash.parentNode.removeChild(flash);
        }, 600);

        // Texte de réduction (optionnel, peut-être trop de texte ?)
        // this.showFloatingText(element, `-${amountReduced}🛡️`, '#aaaaaa');
        console.log('🛡️ Damage reduction effect shown');
    }

    /**
     * Animation de résurrection (Phoenix)
     */
    showResurrectionEffect(player, healAmount) {
        const element = player.element;
        if (!element) return;

        // 1. Explosion de lumière
        const flash = document.createElement('div');
        flash.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: 200px;
        height: 200px;
        background: radial-gradient(circle, #fff 0%, rgba(255, 200, 50, 0.5) 40%, rgba(255, 100, 0, 0) 70%);
        transform: translate(-50%, -50%) scale(0);
        border-radius: 50%;
        animation: phoenix-flash 1s ease-out forwards;
        pointer-events: none;
        z-index: 10;
        `;
        element.style.position = 'relative';
        element.appendChild(flash);

        // 3. Particules de feu
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * 50;

                particle.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: 8px;
        height: 8px;
        background: #ffaa00;
        border-radius: 50%;
        box-shadow: 0 0 10px #ff4400;
        transform: translate(-50%, -50%);
        animation: fire-particle 1s ease-out forwards;
        pointer-events: none;
        z-index: 9;
        `;

                // Custom properties pour l'animation
                particle.style.setProperty('--tx', `${Math.cos(angle) * 100}px`);
                particle.style.setProperty('--ty', `${Math.sin(angle) * 100 - 100}px`);

                element.appendChild(particle);

                setTimeout(() => particle.remove(), 1000);
            }, i * 50);
        }

        // Nettoyage
        setTimeout(() => {
            if (flash.parentNode) flash.remove();
        }, 2000);

        // Texte
        setTimeout(() => {
            this.showFloatingText(element, `PHOENIX REBIRTH!`, '#ffaa00');
            this.showFloatingText(element, `+${healAmount} HP`, '#50ff50');
        }, 500);
    }

    /**
     * Animation d'esquive (Effet fantôme / Matrix)
     */
    showDodgeEffect(player) {
        const element = player.element;
        if (!element) return;

        // Créer un clone pour l'effet de traînée (ghost)
        const ghost = element.cloneNode(true);
        const rect = element.getBoundingClientRect();

        // Nettoyer le clone (enlever les IDs pour éviter les conflits)
        ghost.id = '';
        ghost.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        opacity: 0.5;
        filter: blur(2px) grayscale(100%);
        transform: translateX(0);
        transition: all 0.5s ease-out;
        pointer-events: none;
        z-index: 5;
        `;

        document.body.appendChild(ghost);

        // Animation du joueur (décalage rapide)
        element.style.transform = 'translateX(-30px) skewX(-10deg)';
        element.style.filter = 'blur(1px)';
        element.style.transition = 'transform 0.1s, filter 0.1s';

        // Animation du fantôme
        requestAnimationFrame(() => {
            ghost.style.transform = 'translateX(50px)';
            ghost.style.opacity = '0';
            ghost.style.filter = 'blur(10px) grayscale(100%)';
        });

        // Retour à la normale
        setTimeout(() => {
            element.style.transform = '';
            element.style.filter = '';

            // Texte "DODGE"
            this.showFloatingText(element, 'MISS', '#cccccc');
        }, 200);

        // Nettoyage du fantôme
        setTimeout(() => {
            if (ghost.parentNode) ghost.remove();
        }, 500);
    }

    /**
     * Animation d'exécution (Kill instantané)
     */
    showExecuteEffect(enemy) {
        const element = enemy.element;
        if (!element) return;

        // 1. Flash rouge intense sur l'ennemi
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 0, 0, 0.8);
            mix-blend-mode: overlay;
            animation: execute-flash 0.5s ease-out forwards;
            pointer-events: none;
            z-index: 10;
        `;
        element.style.position = 'relative';
        element.appendChild(flash);

        // 2. Symbole de crâne ou croix
        const symbol = document.createElement('div');
        symbol.textContent = '☠️';
        symbol.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            font-size: 80px;
            filter: drop-shadow(0 0 10px red);
            animation: execute-symbol 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            pointer-events: none;
            z-index: 11;
        `;
        element.appendChild(symbol);

        // 3. Effet de "coupure" (ligne diagonale)
        const slash = document.createElement('div');
        slash.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 150%;
            height: 4px;
            background: #fff;
            box-shadow: 0 0 10px #ff0000, 0 0 20px #ff0000;
            transform: translate(-50%, -50%) rotate(-45deg) scaleX(0);
            animation: execute-slash 0.3s ease-out forwards;
            pointer-events: none;
            z-index: 12;
        `;
        element.appendChild(slash);

        // Texte "EXECUTE!"
        setTimeout(() => {
            this.showFloatingText(element, 'EXECUTE!', '#ff0000');
        }, 200);

        // Tremblement de l'ennemi
        element.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';

        // Nettoyage
        setTimeout(() => {
            if (flash.parentNode) flash.remove();
            if (symbol.parentNode) symbol.remove();
            if (slash.parentNode) slash.remove();
            element.style.animation = ''; // Reset animation
        }, 1000);
    }
    /**
     * Animation de Crit Rampage (+2% Crit)
     */
    showCritRampageEffect(player, amount, totalBonus) {
        const element = player.element;
        if (!element) return;

        // Texte flottant jaune/orange
        let text = `+${amount}% Crit!`;
        if (totalBonus !== undefined) {
            text += ` (Total ${totalBonus}%)`;
        }

        this.showFloatingText(element, text, '#ffaa00');

        // Petit flash jaune
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100%;
            height: 100%;
            transform: translate(-50%, -50%);
            background: radial-gradient(circle, rgba(255, 170, 0, 0.4) 0%, rgba(255, 170, 0, 0) 70%);
            border-radius: 50%;
            animation: fade-out-gray 0.5s ease-out; /* Réutilisation de l'anim fade-out */
            pointer-events: none;
            z-index: 3;
        `;

        element.style.position = 'relative';
        element.appendChild(flash);

        setTimeout(() => {
            if (flash.parentNode) flash.remove();
        }, 500);
    }
}

// Ajouter les animations CSS nécessaires
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse-red {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
    }

    @keyframes fade-out-green {
        0% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.5); }
    }

    @keyframes fade-out-gray {
        0% { opacity: 0.8; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.3); }
    }

    @keyframes phoenix-flash {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
        50% { transform: translate(-50%, -50%) scale(2); opacity: 0.8; }
        100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }

    @keyframes phoenix-rise {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        100% { transform: translate(-50%, -60%) scale(1.5); opacity: 0; }
    }

    @keyframes fire-particle {
        0% { transform: translate(-50%, -50%); opacity: 1; }
        100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))); opacity: 0; }
    }

    @keyframes spike-pop {
        0% { transform: translate(-50%, -50%) rotate(var(--r)) translateY(0); opacity: 0; }
        50% { transform: translate(-50%, -50%) rotate(var(--r)) translateY(-30px); opacity: 1; }
        100% { transform: translate(-50%, -50%) rotate(var(--r)) translateY(-40px); opacity: 0; }
    }

    @keyframes reflect-impact {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-width: 10px; }
        100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; border-width: 0px; }
    }

    @keyframes particle-rise {
        0% { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
        100% { opacity: 0; transform: translate(-50%, -50%) translateY(-80px); }
    }

    @keyframes float-up {
        0% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
    }

    @keyframes execute-flash {
        0% { opacity: 0; }
        20% { opacity: 1; }
        100% { opacity: 0; }
    }

    @keyframes execute-symbol {
        0% { transform: translate(-50%, -50%) scale(0) rotate(-180deg); opacity: 0; }
        60% { transform: translate(-50%, -50%) scale(1.2) rotate(0deg); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0; }
    }

    @keyframes execute-slash {
        0% { transform: translate(-50%, -50%) rotate(-45deg) scaleX(0); opacity: 0.8; }
        50% { transform: translate(-50%, -50%) rotate(-45deg) scaleX(1); opacity: 1; }
        100% { transform: translate(-50%, -50%) rotate(-45deg) scaleX(1); opacity: 0; }
    }

    @keyframes shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
        40%, 60% { transform: translate3d(4px, 0, 0); }
    }
`;
document.head.appendChild(style);

window.CardEffectVisuals = CardEffectVisuals;
