/**
 * Interface de deck (Lecture seule pour la page principale)
 * Redesigned to merge with Loot Summary
 */

class DeckUI {
    constructor(cardSystem) {
        this.cardSystem = cardSystem;
        this.init();
    }

    init() {
        this.createDeckPreview();
        this.setupEventListeners();
        this.loadDeckFromStorage();
    }

    createDeckPreview() {
        console.log('DeckUI: Creating deck preview...');

        // We will inject this into the left-sidebar, specifically into 'deck-preview-container'
        // But we want to merge it visually with the loot summary if possible, or just style it to match.

        const container = document.getElementById('deck-preview-container');
        if (!container) {
            console.error('DeckUI: deck-preview-container not found!');
            return;
        }

        container.innerHTML = `
            <div class="squad-loot-panel">
                <!-- Header removed per user request -->
                
                <!-- Active Squad Section -->
                <div class="squad-section">
                    <div class="section-title">
                        <span>Escouade Active</span>
                    </div>
                    <div id="deck-preview-cards" class="mini-deck-grid">
                        <!-- Cards injected here -->
                        <div class="loading-spinner"></div>
                    </div>
                </div>

                <!-- Effects Summary Section -->
                <div id="deck-effects-recap" class="effects-section">
                    <!-- Effects injected here -->
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // No buttons to bind anymore (open-deck-btn removed)
        // Shop is accessed via boss battles
    }

    // Update deck display (called by CardSystem when deck changes)
    updateDeckDisplay() {
        if (this.cardSystem && this.cardSystem.playerDeck) {
            this.updatePreview(this.cardSystem.playerDeck);
        }
    }

    loadDeckFromStorage() {
        // Load deck from CardSystem (which loads from server)
        let deckIds = [];
        if (this.cardSystem && this.cardSystem.playerDeck) {
            deckIds = [...this.cardSystem.playerDeck];
        }

        // Update preview
        if (this.cardSystem) {
            this.cardSystem.playerDeck = deckIds;
            if (this.cardSystem.applyDeckEffects) {
                this.cardSystem.applyDeckEffects();
            }
        }

        this.updatePreview(deckIds);
    }

    updatePreview(deckIds) {
        if (!deckIds && this.cardSystem) {
            deckIds = this.cardSystem.playerDeck;
        }

        const container = document.getElementById('deck-preview-cards');
        const effectsContainer = document.getElementById('deck-effects-recap');

        if (!container) return;

        if (!deckIds || deckIds.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="
                    grid-column: 1/-1;
                    text-align: center;
                    padding: 20px 10px;
                    color: #666;
                    font-size: 12px;
                    opacity: 0.6;
                ">
                    Aucune carte
                </div>
            `;
            if (effectsContainer) effectsContainer.innerHTML = '';
            return;
        }

        // Render Cards (Mini versions)
        container.innerHTML = deckIds.map(cardId => {
            const card = this.cardSystem ? this.cardSystem.getCardById(cardId) : null;
            if (!card) return '';

            const color = this.cardSystem.getRarityColor(card.rarity);
            const image = card.image ? `/img/cartes/${card.image}` : null;

            return `
                <div class="mini-card" style="--rarity-color: ${color}" title="${card.name}">
                    <div class="mini-card-visual">
                        ${image ?
                    `<img src="${image}" alt="${card.name}">` :
                    `<span class="emoji">🎴</span>`
                }
                    </div>
                    <div class="mini-card-rarity-indicator"></div>
                </div>
            `;
        }).join('');

        // Render Effects Summary
        if (effectsContainer) {
            const effects = [];
            deckIds.forEach(cardId => {
                const card = this.cardSystem ? this.cardSystem.getCardById(cardId) : null;
                if (card && card.effect) {
                    effects.push({
                        desc: card.effect.description,
                        color: this.cardSystem.getRarityColor(card.rarity)
                    });
                }
            });

            if (effects.length > 0) {
                // Group similar effects or just list them cleanly
                effectsContainer.innerHTML = `
                    <div class="effects-list">
                        ${effects.map(e => `
                            <div class="effect-item">
                                <span class="effect-bullet" style="background-color: ${e.color}"></span>
                                <span class="effect-text">${e.desc}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                effectsContainer.innerHTML = '<div class="no-effects">Aucun effet actif</div>';
            }
        }
    }
}

window.DeckUI = DeckUI;
