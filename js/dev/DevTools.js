/**
 * Dev Tools - Menu de développement pour tester les cartes
 * À RETIRER EN PRODUCTION
 */

// DEV MODE FLAG - Set to false in production
const DEV_MODE = true;

class DevTools {
    constructor() {
        if (!DEV_MODE) return;

        this.isOpen = false;
        this.panel = null;
        this.init();
    }

    init() {
        // Create dev panel HTML
        this.createPanel();

        // Listen for F2 key to toggle panel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                this.toggle();
            }
        });

        console.log('🛠️ Dev Tools loaded - Press F2 to open');
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'dev-tools-panel';
        panel.className = 'dev-tools-panel hidden';
        panel.innerHTML = `
            <div class="dev-tools-header">
                <h3>🛠️ Dev Tools - Card Tester</h3>
                <button class="dev-close-btn" onclick="window.devTools.toggle()">✕</button>
            </div>
            <div class="dev-tools-content">
                <div class="dev-current-deck">
                    <h4>Current Run Deck:</h4>
                    <div id="dev-deck-display" class="dev-deck-list"></div>
                </div>
                <div class="dev-card-search">
                    <input type="text" id="dev-search-input" placeholder="Search cards..." />
                </div>
                <div class="dev-cards-container" id="dev-cards-container">
                    <p class="dev-loading">Loading cards...</p>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        this.panel = panel;

        // Add search listener
        const searchInput = panel.querySelector('#dev-search-input');
        searchInput.addEventListener('input', (e) => {
            this.filterCards(e.target.value);
        });
    }

    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.panel.classList.remove('hidden');
            this.loadCards();
            this.updateDeckDisplay();
        } else {
            this.panel.classList.add('hidden');
        }
    }

    loadCards() {
        if (!window.LOOT_CONFIG || !window.LOOT_CONFIG.items) {
            console.error('LOOT_CONFIG not available');
            return;
        }

        const container = document.getElementById('dev-cards-container');
        container.innerHTML = '';

        // Group cards by rarity
        const cardsByRarity = {};
        for (const [itemId, itemData] of Object.entries(window.LOOT_CONFIG.items)) {
            const rarity = itemData.rarity || 'consumer';
            if (!cardsByRarity[rarity]) {
                cardsByRarity[rarity] = [];
            }
            cardsByRarity[rarity].push({ id: itemId, ...itemData });
        }

        // Display cards grouped by rarity
        const rarityOrder = ['consumer', 'industrial', 'milspec', 'restricted', 'classified', 'covert', 'melee'];

        for (const rarity of rarityOrder) {
            if (!cardsByRarity[rarity]) continue;

            const raritySection = document.createElement('div');
            raritySection.className = 'dev-rarity-section';
            raritySection.innerHTML = `<h5 class="dev-rarity-title">${rarity.toUpperCase()}</h5>`;

            const cardsGrid = document.createElement('div');
            cardsGrid.className = 'dev-cards-grid';

            cardsByRarity[rarity].forEach(card => {
                const cardEl = this.createCardElement(card);
                cardsGrid.appendChild(cardEl);
            });

            raritySection.appendChild(cardsGrid);
            container.appendChild(raritySection);
        }
    }

    createCardElement(card) {
        const cardEl = document.createElement('div');
        cardEl.className = 'dev-card-item';
        cardEl.dataset.cardId = card.id;
        cardEl.dataset.cardName = card.name.toLowerCase();
        cardEl.dataset.rarity = card.rarity;

        const color = this.getRarityColor(card.rarity);

        // Get card effect from CardSystem
        const effect = this.getCardEffect(card.id);
        const effectText = effect ? effect : 'No effect data';

        cardEl.innerHTML = `
            <div class="dev-card-preview" style="border-color: ${color}">
                <img src="/img/${card.image}" alt="${card.name}" onerror="this.style.display='none'">
            </div>
            <div class="dev-card-info">
                <div class="dev-card-name" style="color: ${color}">${card.name}</div>
                <div class="dev-card-rarity">${card.rarityName || card.rarity}</div>
                <div class="dev-card-effect">${effectText}</div>
            </div>
            <button class="dev-add-btn" onclick="window.devTools.addCardToDeck('${card.id}')">Add to Deck</button>
        `;

        return cardEl;
    }

    getCardEffect(cardId) {
        // Get card from CardSystem to access its effect
        if (!window.cardSystem) return null;

        const card = window.cardSystem.getCardById(cardId);
        if (!card || !card.effect) return null;

        const effect = card.effect;

        // Handle multi-effect cards
        if (effect.type === 'multi_effect' && effect.effects) {
            return effect.description || effect.effects.map(e => e.description || '').join(', ');
        }

        // Return single effect description
        return effect.description || `${effect.type}: ${effect.value}`;
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

    addCardToDeck(cardId) {
        if (!window.cardSystem) {
            console.error('Card system not available');
            return;
        }

        // DEV: Bypass normal restrictions
        const result = window.cardSystem.addToDeck(cardId);

        if (result.success) {
            console.log(`✅ Added ${cardId} to deck`);
            this.updateDeckDisplay();

            // Apply card effects immediately
            if (window.cardEffectHandler) {
                const deck = window.cardSystem.getDeck();
                window.cardEffectHandler.applyCardEffects(deck);
            }
        } else {
            console.warn(`⚠️ ${result.message}`);

            // If deck is full, just add anyway in dev mode
            if (result.message.includes('complet')) {
                window.cardSystem.playerDeck.push(cardId);
                window.cardSystem.saveDeck();
                console.log(`✅ Added ${cardId} to deck (dev mode - bypassed limit)`);
                this.updateDeckDisplay();

                if (window.cardEffectHandler) {
                    const deck = window.cardSystem.getDeck();
                    window.cardEffectHandler.applyCardEffects(deck);
                }
            }
        }
    }

    removeCardFromDeck(cardId) {
        if (!window.cardSystem) return;

        window.cardSystem.removeFromDeck(cardId);
        console.log(`❌ Removed ${cardId} from deck`);
        this.updateDeckDisplay();

        // Reapply card effects
        if (window.cardEffectHandler) {
            const deck = window.cardSystem.getDeck();
            window.cardEffectHandler.applyCardEffects(deck);
        }
    }

    updateDeckDisplay() {
        const deckDisplay = document.getElementById('dev-deck-display');
        if (!deckDisplay || !window.cardSystem) return;

        const deck = window.cardSystem.getDeck();

        if (deck.length === 0) {
            deckDisplay.innerHTML = '<p class="dev-empty">No cards in deck</p>';
            return;
        }

        deckDisplay.innerHTML = deck.map(card => {
            const effect = this.getCardEffect(card.id);
            return `
                <div class="dev-deck-card" style="border-color: ${this.getRarityColor(card.rarity)}">
                    <img src="/img/${card.image}" alt="${card.name}" onerror="this.style.display='none'">
                    <div class="dev-deck-card-info">
                        <span class="dev-deck-card-name">${card.name}</span>
                        <span class="dev-deck-card-effect">${effect || 'No effect'}</span>
                    </div>
                    <button class="dev-remove-btn" onclick="window.devTools.removeCardFromDeck('${card.id}')">×</button>
                </div>
            `;
        }).join('');
    }

    filterCards(searchTerm) {
        const cards = document.querySelectorAll('.dev-card-item');
        const term = searchTerm.toLowerCase();

        cards.forEach(card => {
            const name = card.dataset.cardName;
            const rarity = card.dataset.rarity;

            if (name.includes(term) || rarity.includes(term)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    clearDeck() {
        if (!window.cardSystem) return;

        window.cardSystem.clearDeck();
        console.log('🗑️ Deck cleared');
        this.updateDeckDisplay();

        // Reset card effects
        if (window.cardEffectHandler) {
            window.cardEffectHandler.applyCardEffects([]);
        }
    }
}

// Initialize dev tools only in DEV_MODE
if (DEV_MODE) {
    window.devTools = new DevTools();
}
