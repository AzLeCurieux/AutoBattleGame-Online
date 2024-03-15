/**
 * Gestionnaire principal des effets de cartes
 * Gère l'application, le suivi et les déclenchements des effets
 */

class CardEffectHandler {
    constructor(player, game) {
        this.player = player;
        this.game = game;
        this.cardSystem = game.cardSystem || window.cardSystem;

        // Effets actifs organisés par type
        this.passiveEffects = {
            flatDamage: 0,
            flatHealth: 0,
            flatCritChance: 0,
            flatCritDamage: 0,
            percentDamage: 0,
            percentHealth: 0,
            damageReduction: 0
        };

        this.conditionalEffects = {
            damageBelowHealth: 0,
            bossDamage: 0,
            damageLucasSequence: 0, // % dégâts bonus sur niveaux suite de Lucas
            damageFactorialSequence: 0, // % dégâts bonus sur niveaux factoriels
            percentDamageChance: 0, // % dégâts avec une chance
            percentDamageChanceValue: 0, // Valeur du % chance
            damageIfSmallDeck: 0, // % dégâts si petit deck
            damageIfSmallDeckMaxCards: 0 // Seuil de cartes pour activer
        };

        this.triggeredEffects = {
            lifesteal: 0,
            lifestealChance: 0, // % chance de trigger le lifesteal
            lifestealChanceValue: 0, // Valeur du lifesteal quand triggered
            reflectDamage: 0,
            healOnKill: 0,
            healOnKillChance: 0, // % chance de trigger le heal on kill
            healOnKillPerGold: 0, // % heal par gold possédé
            healOnKillPerGoldMax: 0, // Max % heal
            bonusDamageChance: 0, // % chance d'ajouter des dégâts bonus
            bonusDamageChanceValue: 0, // Valeur des dégâts bonus quand triggered
            multiStrike: 0,
            revive: 0,
            reviveBonusHealth: 0, // % PV permanent ajouté à la résurrection
            dodge: 0,
            critOnDodge: 0, // % crit bonus après esquive
            execute: 0, // Seuil de PV en % pour kill instantané
            critRampage: 0, // % crit par hit
            critRampageMax: 0, // Max % crit bonus
            goldPerRound: 0, // Or gagné par manche
            rampingDamage: 0, // Dégâts ajoutés par coup
            rampingDamageMax: 0 // Max de stacks de ramping damage
        };

        this.scalingEffects = {
            critPerUpgrade: 0,
            critPerLoot: 0, // % crit par caisse loot ouverte
            critPerGold: 0, // % crit par gold
            critPerEmptyJoker: 0, // % crit par emplacement joker vide
            damagePerEmptyJoker: 0, // % dégâts par emplacement joker vide
            damagePerLevels: 0, // Dégâts ajoutés par intervalle de niveaux
            damagePerLevelsInterval: 0, // Intervalle de niveaux (ex: tous les 7 niveaux)
            doubleBaseDamagePerLevels: 0, // Multiplicateur de base damage par intervalle
            doubleBaseDamagePerLevelsInterval: 0 // Intervalle de niveaux
        };

        this.combatState = {
            isBelowHalfHealth: false,
            hasLifestealActive: false,
            hasRevived: false,
            critRampageStacks: 0,
            rampingDamageStacks: 0, // Stacks accumulés de ramping damage
            hasDodgedLastAttack: false // Si le dernier coup a esquivé
        };

        this.currentDeckSize = 0; // Nombre de cartes dans le deck

        console.log('✨ CardEffectHandler: Initialized');
    }

    applyCardEffects(cards) {
        console.log('=== CardEffectHandler: Applying card effects ===');
        console.log('Cards:', cards.length);

        // Store current deck size for empty joker calculation
        this.currentDeckSize = cards.length;

        this.resetEffects();

        cards.forEach(card => {
            if (card && card.effect) {
                this.processCardEffect(card);
            }

            // Appliquer les effets des modificateurs
            if (card && card.modifier && window.cardModifiers) {
                window.cardModifiers.applyModifierEffects(card.modifier, this);
            }
        });

        this.applyPassiveEffects();

        console.log('Passive effects:', this.passiveEffects);
        console.log('Conditional effects:', this.conditionalEffects);
        console.log('Triggered effects:', this.triggeredEffects);
        console.log('Scaling effects:', this.scalingEffects);
    }

    resetEffects() {
        Object.keys(this.passiveEffects).forEach(key => this.passiveEffects[key] = 0);
        Object.keys(this.conditionalEffects).forEach(key => this.conditionalEffects[key] = 0);
        Object.keys(this.triggeredEffects).forEach(key => this.triggeredEffects[key] = 0);
        Object.keys(this.scalingEffects).forEach(key => this.scalingEffects[key] = 0);

        // Reset combat state flags
        this.combatState.hasRevived = false;
        this.combatState.isBelowHalfHealth = false;
        this.combatState.hasRevived = false;
        this.combatState.isBelowHalfHealth = false;
        this.combatState.hasLifestealActive = false;
        this.combatState.critRampageStacks = 0;
        this.combatState.rampingDamageStacks = 0;
    }

    processCardEffect(card) {
        const effect = card.effect;
        console.log(`Processing card: ${card.name} (${effect.type})`);

        switch (effect.type) {
            case 'flat_damage':

                this.passiveEffects.flatDamage += effect.value;
                break;
            case 'flat_health':
                this.passiveEffects.flatHealth += effect.value;
                break;
            case 'flat_crit_chance':
                this.passiveEffects.flatCritChance += effect.value;
                break;
            case 'flat_crit_damage':
                this.passiveEffects.flatCritDamage += effect.value;
                break;
            case 'percent_damage':
                this.passiveEffects.percentDamage += effect.value;
                break;
            case 'percent_health':
                this.passiveEffects.percentHealth += effect.value;
                break;
            case 'damage_reduction':
                this.passiveEffects.damageReduction += effect.value;
                break;
            case 'damage_below_health':
                this.conditionalEffects.damageBelowHealth += effect.value;
                break;
            case 'boss_damage':
                this.conditionalEffects.bossDamage += effect.value;
                break;
            case 'lifesteal':
                this.triggeredEffects.lifesteal += effect.value;
                break;
            case 'lifesteal_chance':
                this.triggeredEffects.lifestealChance = effect.chance || 33;
                this.triggeredEffects.lifestealChanceValue += effect.value;
                break;
            case 'ramping_damage':
                this.triggeredEffects.rampingDamage = effect.value;
                this.triggeredEffects.rampingDamageMax = effect.max || 999999;
                break;
            case 'reflect_damage':
                this.triggeredEffects.reflectDamage += effect.value;
                break;
            case 'heal_on_kill':
                if (effect.chance) {
                    this.triggeredEffects.healOnKillChance = effect.chance;
                }
                this.triggeredEffects.healOnKill += effect.value;
                break;
            case 'bonus_damage_chance':
                this.triggeredEffects.bonusDamageChance = effect.chance || 0;
                this.triggeredEffects.bonusDamageChanceValue += effect.value;
                break;
            case 'multi_strike':
                this.triggeredEffects.multiStrike += effect.value;
                break;
            case 'revive':
                this.triggeredEffects.revive = effect.value;
                break;
            case 'revive_with_bonus_health':
                this.triggeredEffects.revive = effect.value;
                this.triggeredEffects.reviveBonusHealth = effect.bonusHealth || 0;
                break;
            case 'god_mode':
                this.triggeredEffects.dodge += effect.value;
                break;
            case 'execute':
                this.triggeredEffects.execute = Math.max(this.triggeredEffects.execute, effect.value);
                break;
            case 'crit_rampage':
                this.triggeredEffects.critRampage = effect.value;
                this.triggeredEffects.critRampageMax = effect.max || 50;
                break;
            case 'scaling_crit_chance':
                this.scalingEffects.critPerUpgrade += effect.value;
                break;
            case 'damage_per_levels':
                this.scalingEffects.damagePerLevels += effect.value;
                this.scalingEffects.damagePerLevelsInterval = effect.interval || 1;
                break;
            case 'gold_per_round':
                this.triggeredEffects.goldPerRound += effect.value;
                break;
            case 'damage_lucas_sequence':
                this.conditionalEffects.damageLucasSequence += effect.value;
                break;
            case 'damage_factorial_sequence':
                this.conditionalEffects.damageFactorialSequence += effect.value;
                break;
            case 'scaling_crit_per_loot':
                this.scalingEffects.critPerLoot += effect.value;
                break;
            case 'crit_per_empty_joker':
                this.scalingEffects.critPerEmptyJoker += effect.value;
                break;
            case 'damage_per_empty_joker':
                this.scalingEffects.damagePerEmptyJoker += effect.value;
                break;
            case 'percent_damage_chance':
                this.conditionalEffects.percentDamageChance = effect.chance || 0;
                this.conditionalEffects.percentDamageChanceValue += effect.value;
                break;
            case 'damage_if_small_deck':
                this.conditionalEffects.damageIfSmallDeck += effect.value;
                this.conditionalEffects.damageIfSmallDeckMaxCards = effect.maxCards || 4;
                break;
            case 'crit_on_dodge':
                this.triggeredEffects.critOnDodge = effect.value;
                break;
            case 'heal_on_kill_per_gold':
                this.triggeredEffects.healOnKillPerGold = effect.value;
                this.triggeredEffects.healOnKillPerGoldMax = effect.max || 50;
                break;
            case 'crit_per_gold':
                this.scalingEffects.critPerGold += effect.value;
                break;
            case 'double_base_damage_per_levels':
                this.scalingEffects.doubleBaseDamagePerLevels = effect.value;
                this.scalingEffects.doubleBaseDamagePerLevelsInterval = effect.interval || 1;
                break;
            case 'multi_effect':
                effect.effects.forEach(e => {
                    this.processCardEffect({ effect: e, name: card.name });
                });
                break;
            default:
                console.warn(`Unknown effect type: ${effect.type}`);
        }
    }

    applyPassiveEffects() {
        console.log('Applying passive effects...');

        const baseMaxHealth = this.player.maxHealth || 1000;
        const bonusHealth = this.passiveEffects.flatHealth + (baseMaxHealth * this.passiveEffects.percentHealth / 100);

        if (bonusHealth > 0) {
            const oldMax = this.player.maxHealth;
            this.player.maxHealth = Math.floor(baseMaxHealth + bonusHealth);
            console.log(`Max health: ${oldMax} → ${this.player.maxHealth} (+${Math.floor(bonusHealth)})`);

            const healthPercent = this.player.currentHealth / oldMax;
            this.player.currentHealth = Math.floor(this.player.maxHealth * healthPercent);
            this.player.updateHealth();
        }
    }

    getModifiedHealth(baseHealth) {
        const bonusHealth = this.passiveEffects.flatHealth + (baseHealth * this.passiveEffects.percentHealth / 100);
        return Math.floor(baseHealth + bonusHealth);
    }

    getModifiedDamage(baseDamage, enemy) {
        let damage = baseDamage;

        // Vérifier l'effet EXECUTE avant tout calcul de dégâts
        if (this.triggeredEffects.execute > 0 && enemy && enemy.currentHealth > 0) {
            const healthPercent = (enemy.currentHealth / enemy.maxHealth) * 100;

            if (healthPercent <= this.triggeredEffects.execute) {
                console.log(`💀 EXECUTE! Enemy HP (${healthPercent.toFixed(1)}%) < Threshold (${this.triggeredEffects.execute}%)`);

                // Déclencher l'effet visuel
                if (window.cardEffectVisuals) {
                    window.cardEffectVisuals.showExecuteEffect(enemy);
                }

                // Retourner suffisamment de dégâts pour tuer à coup sûr
                return enemy.currentHealth + 999999;
            }
        }

        damage += this.passiveEffects.flatDamage;

        // Double base damage per levels - Multiply base damage based on level
        if (this.scalingEffects.doubleBaseDamagePerLevels > 0 && this.scalingEffects.doubleBaseDamagePerLevelsInterval > 0) {
            const currentLevel = this.game.level.getLevel();
            const levelMultiplier = Math.floor(currentLevel / this.scalingEffects.doubleBaseDamagePerLevelsInterval);
            if (levelMultiplier > 0) {
                const multiplier = Math.pow(this.scalingEffects.doubleBaseDamagePerLevels, levelMultiplier);
                damage *= multiplier;
                console.log(`🔥 Double base damage: ×${multiplier} (Level ${currentLevel}, ${levelMultiplier} intervals × ${this.scalingEffects.doubleBaseDamagePerLevels})`);
            }
        }

        // Damage per levels - Add bonus damage based on level
        if (this.scalingEffects.damagePerLevels > 0 && this.scalingEffects.damagePerLevelsInterval > 0) {
            const currentLevel = this.game.level.getLevel();
            const levelMultiplier = Math.floor(currentLevel / this.scalingEffects.damagePerLevelsInterval);
            const bonusDamage = this.scalingEffects.damagePerLevels * levelMultiplier;
            damage += bonusDamage;

            if (bonusDamage > 0) {
                console.log(`📊 Damage per levels: +${bonusDamage} (Level ${currentLevel}, ${levelMultiplier} × ${this.scalingEffects.damagePerLevels} every ${this.scalingEffects.damagePerLevelsInterval} levels)`);
            }
        }

        // Bonus damage chance - Add bonus damage with a chance
        if (this.triggeredEffects.bonusDamageChance > 0 && this.triggeredEffects.bonusDamageChanceValue > 0) {
            const roll = Math.random() * 100;
            if (roll < this.triggeredEffects.bonusDamageChance) {
                damage += this.triggeredEffects.bonusDamageChanceValue;
                console.log(`💥 Bonus damage triggered! ${roll.toFixed(2)}% < ${this.triggeredEffects.bonusDamageChance}% - +${this.triggeredEffects.bonusDamageChanceValue} damage`);

                // Visual effect for bonus damage (if function exists)
                if (window.cardEffectVisuals && enemy && typeof window.cardEffectVisuals.showBonusDamageEffect === 'function') {
                    window.cardEffectVisuals.showBonusDamageEffect(enemy, this.triggeredEffects.bonusDamageChanceValue);
                }
            }
        }

        damage *= (1 + this.passiveEffects.percentDamage / 100);

        // Percent damage chance - Apply percent damage bonus with a chance
        if (this.conditionalEffects.percentDamageChance > 0 && this.conditionalEffects.percentDamageChanceValue > 0) {
            const roll = Math.random() * 100;
            if (roll < this.conditionalEffects.percentDamageChance) {
                damage *= (1 + this.conditionalEffects.percentDamageChanceValue / 100);
                console.log(`🎲 Percent damage chance triggered! ${roll.toFixed(2)}% < ${this.conditionalEffects.percentDamageChance}% - +${this.conditionalEffects.percentDamageChanceValue}%`);
            }
        }

        // Damage per empty joker slot
        if (this.scalingEffects.damagePerEmptyJoker > 0) {
            const emptySlots = this.getEmptyJokerSlots();
            if (emptySlots > 0) {
                const bonusPercent = this.scalingEffects.damagePerEmptyJoker * emptySlots;
                damage *= (1 + bonusPercent / 100);
                console.log(`🃏 Damage per empty joker: +${bonusPercent}% (${emptySlots} empty × ${this.scalingEffects.damagePerEmptyJoker}%)`);
            }
        }

        // Damage if small deck
        if (this.conditionalEffects.damageIfSmallDeck > 0) {
            const deckSize = this.currentDeckSize || 0;
            const maxCards = this.conditionalEffects.damageIfSmallDeckMaxCards;
            if (deckSize <= maxCards) {
                damage *= (1 + this.conditionalEffects.damageIfSmallDeck / 100);
                console.log(`🎴 Small deck bonus: +${this.conditionalEffects.damageIfSmallDeck}% (${deckSize} cards ≤ ${maxCards})`);
            }
        }

        if (this.conditionalEffects.damageBelowHealth > 0) {
            const healthPercent = (this.player.currentHealth / this.player.maxHealth) * 100;
            if (healthPercent < 50) {
                this.combatState.isBelowHalfHealth = true;
                damage *= (1 + this.conditionalEffects.damageBelowHealth / 100);
                console.log(`💪 Below 50% HP bonus: +${this.conditionalEffects.damageBelowHealth}%`);
            } else {
                this.combatState.isBelowHalfHealth = false;
            }
        }

        if (this.conditionalEffects.bossDamage > 0 && enemy && enemy.isBoss) {
            damage *= (1 + this.conditionalEffects.bossDamage / 100);
            console.log(`💀 Boss damage bonus: +${this.conditionalEffects.bossDamage}%`);
        }

        // Lucas sequence damage bonus
        if (this.conditionalEffects.damageLucasSequence > 0) {
            const currentLevel = this.game.level.getLevel();
            if (this.isLucasNumber(currentLevel)) {
                damage *= (1 + this.conditionalEffects.damageLucasSequence / 100);
                console.log(`🔢 Lucas sequence bonus (level ${currentLevel}): +${this.conditionalEffects.damageLucasSequence}%`);
            }
        }

        // Factorial sequence damage bonus
        if (this.conditionalEffects.damageFactorialSequence > 0) {
            const currentLevel = this.game.level.getLevel();
            if (this.isFactorialNumber(currentLevel)) {
                damage *= (1 + this.conditionalEffects.damageFactorialSequence / 100);
                console.log(`🔢 Factorial sequence bonus (level ${currentLevel}): +${this.conditionalEffects.damageFactorialSequence}%`);
            }
        }

        // Ramping damage - Add stacked damage
        if (this.triggeredEffects.rampingDamage > 0) {
            const bonusDamage = this.combatState.rampingDamageStacks * this.triggeredEffects.rampingDamage;
            damage += bonusDamage;

            if (bonusDamage > 0) {
                console.log(`📈 Ramping damage: +${bonusDamage} (${this.combatState.rampingDamageStacks} stacks × ${this.triggeredEffects.rampingDamage})`);
            }
        }

        return Math.floor(damage);
    }

    getModifiedCritChance(baseCritChance) {
        let critChance = baseCritChance;
        critChance += this.passiveEffects.flatCritChance;

        if (this.scalingEffects.critPerUpgrade > 0) {
            // Utiliser le compteur global d'améliorations du joueur
            const upgradeCount = this.player.upgradeCount || 0;
            critChance += this.scalingEffects.critPerUpgrade * upgradeCount;
        }

        if (this.scalingEffects.critPerLoot > 0) {
            // Utiliser le compteur de caisses loot ouvertes du joueur
            const lootCount = this.player.lootBoxesOpened || 0;
            critChance += this.scalingEffects.critPerLoot * lootCount;
            if (lootCount > 0) {
                console.log(`📦 Crit per loot: +${(this.scalingEffects.critPerLoot * lootCount).toFixed(2)}% (${lootCount} loots × ${this.scalingEffects.critPerLoot}%)`);
            }
        }

        if (this.scalingEffects.critPerEmptyJoker > 0) {
            const emptySlots = this.getEmptyJokerSlots();
            if (emptySlots > 0) {
                const bonusCrit = this.scalingEffects.critPerEmptyJoker * emptySlots;
                critChance += bonusCrit;
                console.log(`🃏 Crit per empty joker: +${bonusCrit}% (${emptySlots} empty × ${this.scalingEffects.critPerEmptyJoker}%)`);
            }
        }

        if (this.scalingEffects.critPerGold > 0) {
            const goldAmount = this.player.gold || 0;
            if (goldAmount > 0) {
                const bonusCrit = this.scalingEffects.critPerGold * goldAmount;
                critChance += bonusCrit;
                console.log(`💰 Crit per gold: +${bonusCrit}% (${goldAmount} gold × ${this.scalingEffects.critPerGold}%)`);
            }
        }

        // Crit on dodge bonus
        if (this.triggeredEffects.critOnDodge > 0 && this.combatState.hasDodgedLastAttack) {
            critChance += this.triggeredEffects.critOnDodge;
            console.log(`🛡️ Crit on dodge: +${this.triggeredEffects.critOnDodge}% (after dodge)`);
            // Reset the flag after applying
            this.combatState.hasDodgedLastAttack = false;
        }

        // Crit Rampage bonus
        if (this.triggeredEffects.critRampage > 0) {
            const currentBonus = Math.min(
                this.combatState.critRampageStacks * this.triggeredEffects.critRampage,
                this.triggeredEffects.critRampageMax
            );
            critChance += currentBonus;
        }

        return Math.min(critChance, 100);
    }

    getModifiedCritDamage(baseCritDamage) {
        return baseCritDamage + this.passiveEffects.flatCritDamage;
    }

    onAfterAttack(damage, enemy, isCrit) {
        console.log(`⚔️ After attack: ${damage} damage to enemy (Crit: ${isCrit})`);

        // Crit Rampage Logic
        if (isCrit && this.triggeredEffects.critRampage > 0) {
            // Calculer le crit total actuel
            const baseCrit = this.player.criticalHitChance || 0;
            const currentTotalCrit = this.getModifiedCritChance(baseCrit);
            const cap = this.triggeredEffects.critRampageMax || 50;

            // On ne continue que si on est en dessous du cap global
            if (currentTotalCrit < cap) {
                this.combatState.critRampageStacks++;

                // Recalculer pour l'affichage
                const newTotalCrit = this.getModifiedCritChance(baseCrit);
                const currentBonus = this.combatState.critRampageStacks * this.triggeredEffects.critRampage;

                console.log(`📈 Crit Rampage! Stacks: ${this.combatState.critRampageStacks} (Bonus: +${currentBonus}%, Total: ${newTotalCrit}%)`);

                // Mettre à jour l'UI (Camp stats) en temps réel
                if (this.game && this.game.uiController) {
                    this.game.uiController.updateCampStats();
                }

                if (window.cardEffectVisuals) {
                    // On affiche le bonus accumulé
                    window.cardEffectVisuals.showCritRampageEffect(this.player, this.triggeredEffects.critRampage, currentBonus);
                }
            }
        }

        if (this.triggeredEffects.lifesteal > 0) {
            const healAmount = Math.floor(damage * (this.triggeredEffects.lifesteal / 100));

            console.log(`💚 Lifesteal ${this.triggeredEffects.lifesteal}%: ${healAmount} HP from ${damage} damage`);

            // Toujours afficher, même à 0
            if (healAmount > 0) {
                this.player.heal(healAmount);
            }
            this.combatState.hasLifestealActive = true;

            // Animation visuelle - afficher même pour 0
            if (window.cardEffectVisuals) {
                window.cardEffectVisuals.showLifestealEffect(this.player, healAmount);
            }
        }

        // Lifesteal with chance (Quentin Fish nerf)
        if (this.triggeredEffects.lifestealChance > 0 && this.triggeredEffects.lifestealChanceValue > 0) {
            const roll = Math.random() * 100;

            if (roll < this.triggeredEffects.lifestealChance) {
                const healAmount = Math.floor(damage * (this.triggeredEffects.lifestealChanceValue / 100));

                console.log(`💚 Lifesteal PROC! (${roll.toFixed(1)}% < ${this.triggeredEffects.lifestealChance}%): ${healAmount} HP`);

                if (healAmount > 0) {
                    this.player.heal(healAmount);
                }

                // Animation visuelle
                if (window.cardEffectVisuals) {
                    window.cardEffectVisuals.showLifestealEffect(this.player, healAmount);
                }
            } else {
                console.log(`💔 Lifesteal MISS (${roll.toFixed(1)}% >= ${this.triggeredEffects.lifestealChance}%)`);
            }
        }

        // Ramping damage - Increment stacks after dealing damage
        if (this.triggeredEffects.rampingDamage > 0) {
            const maxStacks = this.triggeredEffects.rampingDamageMax / this.triggeredEffects.rampingDamage;

            if (this.combatState.rampingDamageStacks < maxStacks) {
                this.combatState.rampingDamageStacks++;
                console.log(`📈 Ramping damage stack gained! Stacks: ${this.combatState.rampingDamageStacks}/${maxStacks}`);
            }
        }

        return damage;
    }

    onTakeDamage(incomingDamage, attacker) {
        let damage = incomingDamage;

        if (this.triggeredEffects.reflectDamage > 0 && attacker) {
            const reflectAmount = Math.floor(incomingDamage * (this.triggeredEffects.reflectDamage / 100));
            if (reflectAmount > 0 && attacker.takeDamage) {
                // Créer un objet de dégâts fictif pour éviter le crash
                const mockDamageObject = {
                    isNewHitIsCrit: () => false,
                    critDamageDone: () => { }
                };
                attacker.takeDamage(reflectAmount, mockDamageObject);
                console.log(`🛡️ Reflect damage: ${reflectAmount} to enemy`);

                if (window.cardEffectVisuals) {
                    window.cardEffectVisuals.showReflectEffect(attacker, reflectAmount);
                }
            }
        }

        // Apply damage reduction
        if (this.passiveEffects.damageReduction > 0) {
            const reduction = Math.floor(damage * (this.passiveEffects.damageReduction / 100));
            if (reduction > 0) {
                damage -= reduction;
                console.log(`🛡️ Damage reduced by ${this.passiveEffects.damageReduction}%: -${reduction} (${damage} remaining)`);

                if (window.cardEffectVisuals) {
                    window.cardEffectVisuals.showDamageReductionEffect(this.player, reduction);
                }
            }
        }

        return damage;
    }

    onKillEnemy(enemy) {
        console.log('💀 Enemy killed');

        if (this.triggeredEffects.healOnKill > 0) {
            // Check if there's a chance requirement
            let shouldHeal = true;
            if (this.triggeredEffects.healOnKillChance > 0) {
                const roll = Math.random() * 100;
                shouldHeal = roll < this.triggeredEffects.healOnKillChance;
                console.log(`🎲 Heal on kill chance: ${roll.toFixed(1)}% vs ${this.triggeredEffects.healOnKillChance}% - ${shouldHeal ? 'SUCCESS' : 'FAILED'}`);
            }

            if (shouldHeal) {
                const healAmount = Math.floor(this.player.maxHealth * (this.triggeredEffects.healOnKill / 100));
                if (healAmount > 0) {
                    this.player.heal(healAmount);
                    console.log(`❤️ Heal on kill: ${healAmount} HP`);

                    if (window.cardEffectVisuals) {
                        window.cardEffectVisuals.showHealOnKillEffect(this.player, healAmount);
                    }
                }
            }
        }

        // Heal on kill per gold
        if (this.triggeredEffects.healOnKillPerGold > 0) {
            const goldAmount = this.player.gold || 0;
            const healPercent = Math.min(
                this.triggeredEffects.healOnKillPerGold * goldAmount,
                this.triggeredEffects.healOnKillPerGoldMax
            );

            if (healPercent > 0) {
                const healAmount = Math.floor(this.player.maxHealth * (healPercent / 100));
                if (healAmount > 0) {
                    this.player.heal(healAmount);
                    console.log(`💰❤️ Heal on kill per gold: ${healAmount} HP (${healPercent.toFixed(1)}% from ${goldAmount} gold)`);

                    if (window.cardEffectVisuals) {
                        window.cardEffectVisuals.showHealOnKillEffect(this.player, healAmount);
                    }
                }
            }
        }

        // Gold per round (each enemy kill = 1 round)
        if (this.triggeredEffects.goldPerRound > 0) {
            const goldAmount = this.triggeredEffects.goldPerRound;
            if (this.player.changeGoldAmount) {
                this.player.changeGoldAmount(goldAmount);
                console.log(`💰 Gold per round: +${goldAmount} gold`);

                // Add to history
                if (window.game && window.game.addHistoryEntry) {
                    window.game.addHistoryEntry('gold', `+${goldAmount} or (Ibra Kart)`, '💰');
                }
            }
        }
    }

    canResurrect() {
        return this.triggeredEffects.revive > 0 && !this.combatState.hasRevived;
    }

    onResurrect() {
        if (!this.canResurrect()) return false;

        // Apply permanent health bonus if applicable
        if (this.triggeredEffects.reviveBonusHealth > 0) {
            const bonusHealth = Math.floor(this.player.maxHealth * (this.triggeredEffects.reviveBonusHealth / 100));
            this.player.maxHealth += bonusHealth;
            console.log(`💪 PERMANENT HEALTH BONUS: +${bonusHealth} HP (${this.triggeredEffects.reviveBonusHealth}%)`);
        }

        const revivePercent = this.triggeredEffects.revive;
        const reviveHealth = Math.floor(this.player.maxHealth * (revivePercent / 100));

        // Marquer comme utilisé
        this.combatState.hasRevived = true;

        // Soigner le joueur
        this.player.currentHealth = reviveHealth;
        this.player.updateHealth();

        console.log(`🔥 PHOENIX: Player resurrected with ${reviveHealth} HP(${revivePercent} %)`);

        // Animation visuelle
        if (window.cardEffectVisuals) {
            window.cardEffectVisuals.showResurrectionEffect(this.player, reviveHealth);
        }

        // Ajouter à l'historique
        if (window.game && window.game.addHistoryEntry) {
            const bonusText = this.triggeredEffects.reviveBonusHealth > 0 ? ` +${this.triggeredEffects.reviveBonusHealth}% PV max permanent` : '';
            window.game.addHistoryEntry('revive', `Résurrection avec ${reviveHealth} PV!${bonusText}`, '🔥');
        }

        return true;
    }

    tryDodge() {
        if (this.triggeredEffects.dodge > 0) {
            const roll = Math.random() * 100;
            if (roll < this.triggeredEffects.dodge) {
                console.log(`💨 Dodged!(Chance: ${this.triggeredEffects.dodge} %, Roll: ${roll.toFixed(1)})`);

                // Set flag for crit on dodge effect
                this.combatState.hasDodgedLastAttack = true;

                if (window.cardEffectVisuals) {
                    window.cardEffectVisuals.showDodgeEffect(this.player);
                }
                return true;
            }
        }
        return false;
    }


    checkExecute(enemy) {
        if (this.triggeredEffects.execute > 0 && enemy && enemy.currentHealth > 0) {
            const healthPercent = (enemy.currentHealth / enemy.maxHealth) * 100;

            if (healthPercent <= this.triggeredEffects.execute) {
                console.log(`💀 EXECUTE TRIGGERED! Enemy HP(${healthPercent.toFixed(1)} %) <= Threshold(${this.triggeredEffects.execute} %)`);

                // Déclencher l'effet visuel
                if (window.cardEffectVisuals) {
                    window.cardEffectVisuals.showExecuteEffect(enemy);
                }

                // Tuer l'ennemi instantanément
                // On utilise une valeur massive pour garantir la mort
                // On passe un objet mock pour éviter les erreurs si takeDamage attend des params
                enemy.takeDamage(enemy.currentHealth + 999999, { isNewHitIsCrit: () => false });
                return true;
            }
        }
        return false;
    }

    // Helper: Get number of empty joker slots in deck
    getEmptyJokerSlots() {
        const MAX_DECK_SIZE = 5; // Maximum deck size
        const currentSize = this.currentDeckSize || 0;
        return Math.max(0, MAX_DECK_SIZE - currentSize);
    }

    // Helper: Check if a number is in the Lucas sequence
    // Lucas sequence: 2, 1, 3, 4, 7, 11, 18, 29, 47, 76, 123...
    isLucasNumber(n) {
        if (n < 0) return false;

        // Generate Lucas numbers up to n
        let a = 2, b = 1;
        if (n === a || n === b) return true;

        for (let i = 2; i < 100; i++) {
            let next = a + b;
            if (next === n) return true;
            if (next > n) return false;
            a = b;
            b = next;
        }
        return false;
    }

    // Helper: Check if a number is a factorial
    // Factorial sequence: 1, 2, 6, 24, 120, 720...
    isFactorialNumber(n) {
        if (n < 1) return false;
        if (n === 1) return true;

        let factorial = 1;
        for (let i = 2; i <= 20; i++) {
            factorial *= i;
            if (factorial === n) return true;
            if (factorial > n) return false;
        }
        return false;
    }
}

window.CardEffectHandler = CardEffectHandler;
