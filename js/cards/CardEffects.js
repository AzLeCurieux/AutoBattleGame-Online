/**
 * Système d'application des effets de cartes au combat
 */

class CardEffects {
    constructor(player, cardSystem) {
        this.player = player;
        this.cardSystem = cardSystem;
        this.activeEffects = {};
        this.comboCoun = 0;
        this.hasRevived = false;
        this.hitCount = 0;
    }

    applyDeckEffects() {
        const deck = this.cardSystem.getDeck();
        this.activeEffects = {};
        this.hasRevived = false;
        this.hitCount = 0;
        this.comboCount = 0;

        deck.forEach(card => {
            this.applyCardEffect(card);
        });
    }

    applyCardEffect(card) {
        const effect = card.effect;

        switch (effect.type) {
            case 'flat_damage':
                this.activeEffects.flatDamage = (this.activeEffects.flatDamage || 0) + effect.value;
                break;

            case 'flat_health':
                this.activeEffects.flatHealth = (this.activeEffects.flatHealth || 0) + effect.value;
                break;

            case 'flat_crit_chance':
                this.activeEffects.flatCritChance = (this.activeEffects.flatCritChance || 0) + effect.value;
                break;

            case 'flat_crit_damage':
                this.activeEffects.flatCritDamage = (this.activeEffects.flatCritDamage || 0) + effect.value;
                break;

            case 'percent_damage':
                this.activeEffects.percentDamage = (this.activeEffects.percentDamage || 0) + effect.value;
                break;

            case 'percent_health':
                this.activeEffects.percentHealth = (this.activeEffects.percentHealth || 0) + effect.value;
                break;

            case 'scaling_crit_chance':
                this.activeEffects.scalingCritChance = (this.activeEffects.scalingCritChance || 0) + effect.value;
                break;

            case 'heal_on_kill':
                this.activeEffects.healOnKill = effect.value;
                break;

            case 'damage_below_health':
                this.activeEffects.damageBelowHealth = effect.value;
                break;

            case 'lifesteal':
                this.activeEffects.lifesteal = (this.activeEffects.lifesteal || 0) + effect.value;
                break;

            case 'reflect_damage':
                this.activeEffects.reflectDamage = effect.value;
                break;

            case 'multi_strike':
                this.activeEffects.multiStrike = effect.value;
                break;

            case 'damage_reduction':
                this.activeEffects.damageReduction = effect.value;
                break;

            case 'execute':
                this.activeEffects.execute = effect.value;
                break;

            case 'combo_damage':
                this.activeEffects.comboDamage = effect.value;
                break;

            case 'revive':
                this.activeEffects.revive = effect.value;
                break;

            case 'attack_speed':
                this.activeEffects.attackSpeed = effect.value;
                break;



            case 'boss_damage':
                this.activeEffects.bossDamage = effect.value;
                break;

            case 'god_mode':
                this.activeEffects.godMode = effect.value;
                break;

            case 'multi_effect':
                effect.effects.forEach(e => {
                    this.applyCardEffect({ effect: e });
                });
                break;
        }
    }

    getModifiedDamage(baseDamage, enemy) {
        let damage = baseDamage;

        // Flat damage bonus
        if (this.activeEffects.flatDamage) {
            damage += this.activeEffects.flatDamage;
        }

        // Percent damage bonus
        if (this.activeEffects.percentDamage) {
            damage *= (1 + this.activeEffects.percentDamage / 100);
        }

        // Damage below health threshold
        if (this.activeEffects.damageBelowHealth) {
            const healthPercent = (this.player.getCurrentHealth() / this.player.getMaxHealth()) * 100;
            if (healthPercent < 50) {
                damage *= (1 + this.activeEffects.damageBelowHealth / 100);
            }
        }

        // Boss damage bonus
        if (this.activeEffects.bossDamage && enemy && enemy.isBoss) {
            damage *= (1 + this.activeEffects.bossDamage / 100);
        }

        // Combo damage
        if (this.activeEffects.comboDamage) {
            const comboBonus = Math.min(this.comboCount * this.activeEffects.comboDamage, 50);
            damage *= (1 + comboBonus / 100);
        }

        return Math.floor(damage);
    }

    getModifiedHealth(baseHealth) {
        let health = baseHealth;

        // Flat health bonus
        if (this.activeEffects.flatHealth) {
            health += this.activeEffects.flatHealth;
        }

        // Percent health bonus
        if (this.activeEffects.percentHealth) {
            health *= (1 + this.activeEffects.percentHealth / 100);
        }

        return Math.floor(health);
    }

    getModifiedCritChance(baseCritChance, critUpgrades) {
        let critChance = baseCritChance;

        // Flat crit chance bonus
        if (this.activeEffects.flatCritChance) {
            critChance += this.activeEffects.flatCritChance;
        }


        return Math.min(critChance, 100);
    }

    getModifiedCritDamage(baseCritDamage) {
        let critDamage = baseCritDamage;

        if (this.activeEffects.flatCritDamage) {
            critDamage += this.activeEffects.flatCritDamage;
        }

        return critDamage;
    }

    getAttackSpeedMultiplier() {
        if (this.activeEffects.attackSpeed) {
            return 1 - (this.activeEffects.attackSpeed / 100);
        }
        return 1;
    }

    onHit(damage, enemy) {
        this.hitCount++;
        this.comboCount++;

        let totalDamage = damage;

        // Multi-strike chance
        if (this.activeEffects.multiStrike) {
            const chance = this.activeEffects.multiStrike;
            if (Math.random() * 100 < chance) {
                totalDamage *= 2;
                console.log('💥 Multi-Strike! Double damage!');
            }
        }

        // Lifesteal
        if (this.activeEffects.lifesteal && this.player) {
            const healAmount = Math.floor(totalDamage * (this.activeEffects.lifesteal / 100));
            this.player.heal(healAmount);
        }

        // Execute
        if (this.activeEffects.execute && enemy) {
            const healthPercent = (enemy.getCurrentHealth() / enemy.getMaxHealth()) * 100;
            if (healthPercent < this.activeEffects.execute) {
                enemy.takeDamage(enemy.getCurrentHealth());
                console.log('⚡ Execute! Instant kill!');
            }
        }

        return totalDamage;
    }

    onTakeDamage(incomingDamage) {
        let damage = incomingDamage;

        // Reset combo on taking damage
        this.comboCount = 0;

        // God mode (chance to dodge)
        if (this.activeEffects.godMode) {
            if (Math.random() * 100 < this.activeEffects.godMode) {
                console.log('✨ God Mode! Damage dodged!');
                return 0;
            }
        }

        // Damage reduction
        if (this.activeEffects.damageReduction) {
            damage *= (1 - this.activeEffects.damageReduction / 100);
        }

        // Reflect damage
        if (this.activeEffects.reflectDamage && window.game && window.game.enemy) {
            const reflectAmount = Math.floor(incomingDamage * (this.activeEffects.reflectDamage / 100));
            window.game.enemy.takeDamage(reflectAmount);
            console.log(`🛡️ Reflected ${reflectAmount} damage!`);
        }

        return Math.floor(damage);
    }

    onKill() {
        // Heal on kill
        if (this.activeEffects.healOnKill && this.player) {
            const healAmount = Math.floor(this.player.getMaxHealth() * (this.activeEffects.healOnKill / 100));
            this.player.heal(healAmount);
            console.log(`❤️ Healed ${healAmount} HP on kill!`);
        }
    }

    onDeath() {
        // Revive
        if (this.activeEffects.revive && !this.hasRevived && this.player) {
            const reviveHealth = Math.floor(this.player.getMaxHealth() * (this.activeEffects.revive / 100));
            this.player.revive(reviveHealth);
            this.hasRevived = true;
            console.log(`🔥 Phoenix! Revived with ${reviveHealth} HP!`);
            return true;
        }
        return false;
    }

    reset() {
        this.hitCount = 0;
        this.comboCount = 0;
        this.hasRevived = false;
    }
}

window.CardEffects = CardEffects;
