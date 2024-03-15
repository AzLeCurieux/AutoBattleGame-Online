/**
 * Système de modificateurs de cartes (inspiré de Balatro)
 * Foil, Holographic, Polychrome, Negative
 */

class CardModifiers {
    constructor() {
        // Définition des modificateurs avec leurs effets et probabilités
        this.modifiers = {
            'foil': {
                name: 'Foil',
                chance: 0.10, // 10% de chance
                priceMultiplier: 1.5,
                effects: {
                    flatDamage: 30
                },
                description: '+30 dégâts',
                cssClass: 'card-foil'
            },
            'holographic': {
                name: 'Holographic',
                chance: 0.08, // 8% de chance
                priceMultiplier: 1.8,
                effects: {
                    flatCritDamage: 5
                },
                description: '+5% dégâts critiques',
                cssClass: 'card-holographic'
            },
            'polychrome': {
                name: 'Polychrome',
                chance: 0.02, // 2% de chance (très rare)
                priceMultiplier: 2.5,
                effects: {
                    flatCritChance: 1.5
                },
                description: '+1.5% chance critique',
                cssClass: 'card-polychrome'
            },
            'negative': {
                name: 'Negative',
                chance: 0.01, // 1% de chance (très rare)
                priceMultiplier: 3.0,
                effects: {
                    bypassDeckLimit: true
                },
                description: 'Bypasse la limite de deck',
                cssClass: 'card-negative'
            }
        };
    }

    /**
     * Ajoute aléatoirement un modificateur à une carte
     * @param {Object} card - La carte à modifier
     * @returns {Object} La carte avec ou sans modificateur
     */
    applyRandomModifier(card) {
        // Ne pas modifier les cartes qui ont déjà un modificateur
        if (card.modifier) return card;

        const roll = Math.random();
        let cumulativeChance = 0;

        // Parcourir les modificateurs dans l'ordre (du plus rare au moins rare)
        const modifierKeys = ['negative', 'polychrome', 'holographic', 'foil'];

        for (const key of modifierKeys) {
            const modifier = this.modifiers[key];
            cumulativeChance += modifier.chance;

            if (roll < cumulativeChance) {
                // Appliquer ce modificateur
                return {
                    ...card,
                    modifier: {
                        type: key,
                        ...modifier
                    },
                    price: Math.ceil(card.price * modifier.priceMultiplier)
                };
            }
        }

        // Aucun modificateur appliqué
        return card;
    }

    /**
     * Applique les effets d'un modificateur dans CardEffectHandler
     * @param {Object} modifier - Le modificateur à appliquer
     * @param {Object} effectHandler - L'instance de CardEffectHandler
     */
    applyModifierEffects(modifier, effectHandler) {
        if (!modifier || !modifier.effects) return;

        const effects = modifier.effects;

        if (effects.flatDamage) {
            effectHandler.passiveEffects.flatDamage += effects.flatDamage;
            console.log(`✨ Modifier ${modifier.name}: +${effects.flatDamage} dégâts`);
        }

        if (effects.flatCritDamage) {
            effectHandler.passiveEffects.flatCritDamage += effects.flatCritDamage;
            console.log(`✨ Modifier ${modifier.name}: +${effects.flatCritDamage}% dégâts critiques`);
        }

        if (effects.flatCritChance) {
            effectHandler.passiveEffects.flatCritChance += effects.flatCritChance;
            console.log(`✨ Modifier ${modifier.name}: +${effects.flatCritChance}% chance critique`);
        }

        if (effects.bypassDeckLimit) {
            // Cet effet est géré ailleurs (dans le système de deck)
            console.log(`✨ Modifier ${modifier.name}: Bypasse la limite de deck`);
        }
    }

    /**
     * Compte le nombre de cartes "Negative" dans un deck
     * @param {Array} deck - Le deck de cartes
     * @returns {number} Nombre de cartes Negative
     */
    countNegativeCards(deck) {
        return deck.filter(card =>
            card.modifier && card.modifier.type === 'negative'
        ).length;
    }

    /**
     * Obtient la limite de deck ajustée en fonction des cartes Negative
     * @param {Array} deck - Le deck de cartes
     * @param {number} baseLimit - La limite de base (5 par défaut)
     * @returns {number} La limite ajustée
     */
    getAdjustedDeckLimit(deck, baseLimit = 5) {
        const negativeCount = this.countNegativeCards(deck);
        return baseLimit + negativeCount;
    }
}

// Créer une instance globale
window.cardModifiers = new CardModifiers();
