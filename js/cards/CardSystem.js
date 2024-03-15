/**
 * Système de cartes utilisant l'inventaire de loot
 */

class CardSystem {
    constructor() {
        this.allCards = []; // Sera rempli depuis l'inventaire
        this.playerDeck = []; // Max 5 cartes
        this.maxDeckSize = 5;
        this.cardEffectsMap = this.initializeDefaultEffects();
        this.cardQuantities = {}; // Map of cardId -> quantity owned

        // Initialiser les cartes immédiatement si la config est disponible
        if (window.LOOT_CONFIG) {
            this.loadCardsFromInventory();
        } else {
            // Sinon attendre que le DOM soit prêt (fallback)
            document.addEventListener('DOMContentLoaded', () => {
                if (window.LOOT_CONFIG) this.loadCardsFromInventory();
            });
        }

        this.loadDeck();
    }

    // Effets personnalisés par carte spécifique
    getCardSpecificEffects() {
        return {
            // CONSUMER GRADE - Effets de base
            'andres_everest': { type: 'damage_per_levels', value: 1, interval: 1, description: '+1 dégât par manche' },
            'aurelien_dofus': { type: 'flat_health', value: 250, description: '+250 PV maximum' },
            'axel_bruce_wayne': { type: 'flat_crit_chance', value: 2, description: '+2% chance critique' },
            'complet': { type: 'damage_reduction', value: 5, description: 'Réduit 5% des dégâts reçus' },
            'gagou_fornite': { type: 'percent_damage', value: 5, description: '+5% de dégâts' },
            'glamal_basket': { type: 'damage_per_levels', value: 7, interval: 7, description: '+7 dégâts tous les 7 niveaux' },
            'glamal_csgo': { type: 'flat_crit_damage', value: 5, description: '+5% dégâts critiques' },
            'glamal_neige': { type: 'percent_health', value: 5, description: '+5% PV maximum' },
            'ibra_kart': { type: 'gold_per_round', value: 1, description: '+1 or par manche' },
            'kilian_garden': { type: 'heal_on_kill', value: 5, chance: 20, description: 'Soigne 5% PV max sur kill (20% chance)' },
            'kilian_pokemon': { type: 'bonus_damage_chance', value: 30, chance: 6.67, description: '+30 dégâts (6.67% chance)' },
            'lucas_lucarton': { type: 'flat_health', value: 30, description: '+30 PV maximum' },
            'quentin_fish': { type: 'lifesteal_chance', value: 3, chance: 33, description: 'Vol de vie 3% (33% chance)' },

            // INDUSTRIAL GRADE - Effets intermédiaires
            'axel_batman': { type: 'damage_reduction', value: 8, description: 'Réduit 8% des dégâts reçus' },
            'axel_mugshot': { type: 'flat_crit_damage', value: 15, description: '+15% dégâts critiques' },
            'glamal_onsen': { type: 'heal_on_kill', value: 1.5, description: 'Soigne 1.5% PV max sur kill' },
            'glamal_pirate': { type: 'lifesteal_chance', value: 5, chance: 6.67, description: 'Vol de vie 5% (6.67% chance)' },
            'iut': { type: 'flat_health', value: 50, description: '+50 PV maximum' },
            'lucas_canada': { type: 'damage_lucas_sequence', value: 8, description: '+8% dégâts (suite Lucas)' },

            // MIL-SPEC - Effets avancés
            'aurelien_bob': { type: 'bonus_damage_chance', value: 150, chance: 10, description: '+150 dégâts (10% chance)' },
            'glamal_fiak': { type: 'damage_factorial_sequence', value: 10, description: '+10% dégâts (suite factorielle)' },
            'glamal_voiture': { type: 'attack_speed', value: 15, description: 'Attaque 15% plus vite' },
            'lucas_voiture': { type: 'combo_damage', value: 3, description: '+3% dégâts par hit (max 50%)' },
            'quentin_pokemon': { type: 'scaling_crit_per_loot', value: 0.3, description: '+0.3% critique par loot' },

            // RESTRICTED - Effets puissants
            'andres_boite': { type: 'reflect_damage', value: 15, description: 'Renvoie 15% des dégâts reçus' },
            'andres_urgence': { type: 'damage_below_health', value: 25, description: '+25% dégâts sous 50% PV' },
            'aurelien_maxeed': { type: 'percent_damage_chance', value: 20, chance: 33.33, description: '+20% dégâts (33% chance)' },
            'glamal_men_in_black': { type: 'flat_crit_chance', value: 5, description: '+5% critique' },
            'kilian_obelix': { type: 'damage_reduction', value: 15, description: 'Réduit 15% des dégâts reçus' },
            'kilian_red': { type: 'lifesteal', value: 10, description: 'Vol de vie 10% des dégâts' },

            // CLASSIFIED - Effets très puissants
            'all_nigg': { type: 'crit_per_empty_joker', value: 3, description: '+3% critique par emplacement joker vide' },
            'andres_m8': { type: 'boss_damage', value: 30, description: '+30% dégâts contre boss' },
            'aurelien_dragon': { type: 'damage_per_empty_joker', value: 8, description: '+8% dégâts par emplacement joker vide' },
            'glamal_location': { type: 'execute', value: 20, description: 'Kill instantané sous 20% PV' },
            'kilian_enceinte': { type: 'revive', value: 35, description: 'Revit avec 35% PV (1 fois)' },

            // COVERT - Effets légendaires
            'andres_tartinex': { type: 'damage_if_small_deck', value: 25, maxCards: 4, description: '+25% dégâts si 4 cartes ou moins' },
            'aurelien_lfi': { type: 'god_mode', value: 15, description: '15% chance d\'esquiver' },
            'axel_potion': { type: 'heal_on_kill', value: 15, description: 'Heal 15% sur kill' },
            'complet_grill': { type: 'reflect_damage', value: 25, description: 'Renvoie 25% des dégâts reçus' },
            'glamal_panart': {
                type: 'multi_effect', effects: [
                    { type: 'percent_damage', value: 150 },
                    { type: 'flat_crit_chance', value: -100 }
                ], description: '+150% dégâts, -100% critique'
            },
            'lucas_cheval': { type: 'crit_on_dodge', value: 100, description: '100% crit au prochain coup après esquive' },
            'lucas_dust': { type: 'execute', value: 25, description: 'Kill instantané sous 25% PV' },
            'quentin_drake': {
                type: 'multi_effect', effects: [
                    { type: 'boss_damage', value: 50 },
                    { type: 'flat_crit_chance', value: -50 }
                ], description: '+50% dégâts boss, -50% critique'
            },
            'quentin_nostonks': { type: 'damage_below_health', value: 50, description: '+50% dégâts sous 50% PV' },
            'quentin_potion': { type: 'heal_on_kill_per_gold', value: 0.3, max: 50, description: '+0.3% heal/kill par gold (max 50%)' },

            // MELEE/GOLD - Effets mythiques
            'andres_gold': { type: 'crit_per_gold', value: 1, description: '1 gold = 1% chance critique' },
            'aurelien_yellow_army': {
                type: 'multi_effect', effects: [
                    { type: 'boss_damage', value: 50 }
                ], description: '+50% dégâts boss'
            },
            'glamal_cs_gold': { type: 'double_base_damage_per_levels', value: 2, interval: 15, description: 'Double dégâts de base tous les 15 niveaux' },
            'lucas_totem': { type: 'revive_with_bonus_health', value: 100, bonusHealth: 50, description: 'Revit avec 100% PV + 50% PV permanent' },
            'quentin_sonic': { type: 'god_mode', value: 25, description: '+25% esquive' }
        };
    }

    // Effets par défaut selon la rareté (fallback si pas d'effet spécifique)
    initializeDefaultEffects() {
        return {
            'consumer': {
                type: 'flat_damage',
                value: 5,
                description: '+5 dégâts de base'
            },
            'industrial': {
                type: 'flat_health',
                value: 30,
                description: '+30 PV maximum'
            },
            'milspec': {
                type: 'flat_crit_chance',
                value: 3,
                description: '+3% chance critique'
            },
            'restricted': {
                type: 'percent_damage',
                value: 10,
                description: '+10% de dégâts'
            },
            'classified': {
                type: 'scaling_crit_chance',
                value: 0.5,
                description: '+0.5% critique par upgrade de critique'
            },
            'covert': {
                type: 'lifesteal',
                value: 8,
                description: 'Vol de vie 8% des dégâts'
            },
            'melee': {
                type: 'multi_effect',
                effects: [
                    { type: 'percent_damage', value: 25 },
                    { type: 'flat_crit_chance', value: 10 }
                ],
                description: '+25% dégâts, +10% critique'
            }
        };
    }

    // Charger TOUTES les cartes depuis lootData
    loadCardsFromInventory() {
        try {
            // console.log('🎴 CardSystem: Chargement des cartes depuis LOOT_CONFIG...');

            // Vérifier si LOOT_CONFIG est disponible
            if (!window.LOOT_CONFIG || !window.LOOT_CONFIG.items) {
                console.error('🎴 CardSystem: LOOT_CONFIG non disponible!');
                return [];
            }

            // Créer des cartes pour tous les items de lootData
            this.allCards = [];

            for (const [itemId, itemData] of Object.entries(window.LOOT_CONFIG.items)) {
                const card = this.lootItemToCard({
                    id: itemId,
                    name: itemData.name || itemId,
                    rarity: itemData.rarity || 'consumer',
                    rarityName: itemData.rarityName || itemData.rarity,
                    image: itemData.image,
                    value: itemData.value || 0,
                    color: this.getRarityColor(itemData.rarity || 'consumer')
                });
                this.allCards.push(card);
            }

            // console.log('🎴 CardSystem: Cartes créées:', this.allCards.length);
            return this.allCards;
        } catch (error) {
            console.error('🎴 CardSystem: Erreur loadCardsFromInventory:', error);
            return [];
        }
    }

    // Convertir un item de loot en carte
    lootItemToCard(lootItem) {
        const customEffect = this.getCardCustomEffect(lootItem.id);

        // Priorité: custom effect > specific card effect > rarity default effect
        const specificEffects = this.getCardSpecificEffects();
        const specificEffect = specificEffects[lootItem.id];
        const defaultEffect = this.cardEffectsMap[lootItem.rarity] || this.cardEffectsMap['consumer'];

        return {
            id: lootItem.id,
            name: lootItem.name,
            rarity: lootItem.rarity,
            rarityName: lootItem.rarityName,
            image: lootItem.image,
            value: lootItem.value,
            color: lootItem.color,
            effect: customEffect || specificEffect || defaultEffect,
            level: 0 // Les cartes de l'inventaire sont toujours disponibles
        };
    }

    // Récupérer l'effet personnalisé d'une carte (stocké dans localStorage)
    getCardCustomEffect(cardId) {
        const customEffects = JSON.parse(localStorage.getItem('card_custom_effects') || '{}');
        return customEffects[cardId];
    }

    // Sauvegarder un effet personnalisé pour une carte
    saveCardCustomEffect(cardId, effect) {
        const customEffects = JSON.parse(localStorage.getItem('card_custom_effects') || '{}');
        customEffects[cardId] = effect;
        localStorage.setItem('card_custom_effects', JSON.stringify(customEffects));

        // Mettre à jour la carte dans allCards
        const card = this.allCards.find(c => c.id === cardId);
        if (card) {
            card.effect = effect;
        }
    }

    getRarityColor(rarity) {
        const colors = {
            'consumer': '#b0c3d9',
            'industrial': '#5e98d9',
            'milspec': '#4b69ff',
            'restricted': '#8a3883',
            'classified': '#e506bc',
            'covert': '#eb4b4b',
            'melee': '#e4ae39'
        };
        return colors[rarity] || '#ffffff';
    }

    getCardsForLevel(level) {
        // Maintenant toutes les cartes de l'inventaire sont disponibles
        console.log('🎴 CardSystem.getCardsForLevel:', this.allCards.length, 'cartes dans allCards');
        return this.allCards;
    }

    addToDeck(cardId) {
        if (this.playerDeck.length >= this.maxDeckSize) {
            return { success: false, message: 'Deck complet (max 5 cartes)' };
        }

        if (this.playerDeck.includes(cardId)) {
            return { success: false, message: 'Carte déjà dans le deck' };
        }

        this.playerDeck.push(cardId);
        this.saveDeck();
        return { success: true };
    }

    removeFromDeck(cardId) {
        const index = this.playerDeck.indexOf(cardId);
        if (index > -1) {
            this.playerDeck.splice(index, 1);
            this.saveDeck();
            return { success: true };
        }
        return { success: false };
    }

    clearDeck() {
        console.log('🧹 Clearing run deck...');
        this.playerDeck = [];

        // Clean up old run_deck entries from sessionStorage
        this.cleanupOldRunDecks();

        this.saveDeck();

        // Update UI if DeckUI exists
        if (window.deckUI) {
            window.deckUI.updateDeckDisplay();
        }
    }

    // Clean up old run_deck entries from sessionStorage (keep only current)
    cleanupOldRunDecks() {
        const currentSessionId = sessionStorage.getItem('current_run_id') || 'current_run';
        const currentKey = `run_deck_${currentSessionId}`;

        // Find and remove all old run_deck keys
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('run_deck_') && key !== currentKey) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
            console.log('🧹 Removed old deck:', key);
        });
    }

    getDeck() {
        return this.playerDeck.map(id => this.allCards.find(card => card.id === id)).filter(card => card);
    }

    saveDeck() {
        // Use session-specific storage for run deck (temporary)
        const sessionId = sessionStorage.getItem('current_run_id') || 'current_run';
        sessionStorage.setItem(`run_deck_${sessionId}`, JSON.stringify(this.playerDeck));

        // Update UI
        if (window.deckUI) {
            window.deckUI.updateDeckDisplay();
        }
    }

    loadDeck() {
        // Load from session-specific storage (temporary for this run)
        const sessionId = sessionStorage.getItem('current_run_id') || 'current_run';
        const saved = sessionStorage.getItem(`run_deck_${sessionId}`);
        if (saved) {
            this.playerDeck = JSON.parse(saved);
        } else {
            // Start with empty deck for new run
            this.playerDeck = [];
        }
    }

    getCardById(id) {
        return this.allCards.find(card => card.id === id);
    }

    // NEW: Load card quantities from server inventory  
    async loadCardQuantities() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const response = await fetch('/api/loot/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return;

            const inventory = await response.json();
            this.cardQuantities = {};

            // Count occurrences of each card ID
            for (const item of inventory) {
                const cardId = item.id;
                this.cardQuantities[cardId] = (this.cardQuantities[cardId] || 0) + 1;
            }

            console.log('🎴 Card quantities loaded:', this.cardQuantities);
        } catch (e) {
            console.error('Error loading card quantities:', e);
        }
    }

    // Get quantity of a specific card owned
    getCardQuantity(cardId) {
        return this.cardQuantities[cardId] || 0;
    }

    // Check if user has enough cards to equip the deck
    canEquipDeck(deck) {
        const usage = {};

        for (const cardId of deck) {
            usage[cardId] = (usage[cardId] || 0) + 1;
        }

        for (const [cardId, count] of Object.entries(usage)) {
            const owned = this.getCardQuantity(cardId);
            if (count > owned) {
                return {
                    valid: false,
                    message: `Vous ne possédez que ${owned}x ${this.getCardById(cardId)?.name || cardId}`
                };
            }
        }

        return { valid: true };
    }

    // Get available quantity for a card (owned - already equipped)
    getAvailableQuantity(cardId) {
        const owned = this.getCardQuantity(cardId);
        const equipped = this.playerDeck.filter(id => id === cardId).length;
        return Math.max(0, owned - equipped);
    }
}

// Rendre disponible globalement
window.CardSystem = CardSystem;
