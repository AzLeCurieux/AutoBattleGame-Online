/**
 * Système de boutique de cartes (style Balatro)
 * S'ouvre automatiquement après chaque boss
 */

class CardShop {
    constructor() {
        this.shopCards = [];            // Cartes disponibles dans la boutique
        this.cardShopSize = 5;            // 5 cartes affichées
        this.sellBackRate = 0.7;        // Revente à 70% du prix d'achat

        // Prix basés sur Balatro (en or)
        this.pricesByRarity = {
            'consumer': 2,
            'industrial': 5,
            'milspec': 8,
            'restricted': 10,
            'classified': 15,
            'covert': 20,
            'melee': 30
        };

        // Probabilités Spectrum Case (niveau 70)
        this.spawnProbabilities = {
            'consumer': 0.26316,
            'industrial': 0.22632,
            'milspec': 0.21105,
            'restricted': 0.14684,
            'classified': 0.07895,
            'melee': 0.01958
        };

        // Initialiser les événements
        this.bindEvents();
    }

    bindEvents() {
        // Utiliser la délégation d'événements ou attendre que le DOM soit prêt
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'close-shop-btn') {
                console.log('🛒 Fermeture de la boutique via bouton...');
                this.closeShop();
                // On laisse le joueur cliquer sur Fight manuellement
            }

            // Handle sell button clicks
            const sellBtn = e.target.closest('.sell-btn[data-action="sell"]');
            if (sellBtn) {
                e.stopPropagation();
                const cardId = sellBtn.getAttribute('data-card-id');
                if (cardId) {
                    this.handleSellCard(cardId);
                }
            }
        });
    }

    async generateShopOffers() {
        console.log('🛒 Génération des offres de boutique...');

        // 1. Cartes débloquées (inventaire global)
        let availableCards = await this.getPlayerInventory();

        // 2. Exclure les cartes déjà dans le deck
        const currentDeck = window.cardSystem?.getDeck() || [];
        const ownedCardIds = new Set(currentDeck.map(c => c.id));

        // Filtrer: garder seulement celles qu'on n'a PAS
        availableCards = availableCards.filter(card => !ownedCardIds.has(card.id));

        console.log(`📦 ${availableCards.length} cartes disponibles pour la boutique (hors deck)`);

        if (availableCards.length === 0) {
            console.warn('⚠️ Aucune carte disponible (toutes possédées ou aucune débloquée)');
            this.shopCards = [];
            return this.shopCards;
        }

        // 3. Sélectionner des cartes uniques
        this.shopCards = [];
        const selectedIds = new Set();

        // Essayer de remplir la boutique (max 5 ou nb cartes dispos)
        const shopSize = Math.min(this.cardShopSize, availableCards.length);
        let attempts = 0;

        while (this.shopCards.length < shopSize && attempts < 50) {
            attempts++;

            const rarity = this.selectRarityByProbability();
            // Filtrer par rareté ET non sélectionnée
            const candidates = availableCards.filter(c =>
                c.rarity === rarity && !selectedIds.has(c.id)
            );

            if (candidates.length > 0) {
                let card = candidates[Math.floor(Math.random() * candidates.length)];
                card = {
                    ...card,
                    price: this.pricesByRarity[card.rarity]
                };

                // Appliquer aléatoirement un modificateur
                if (window.cardModifiers) {
                    card = window.cardModifiers.applyRandomModifier(card);
                }

                this.shopCards.push(card);
                selectedIds.add(card.id);
            } else {
                // Fallback: prendre n'importe quelle carte non sélectionnée (si rareté pas dispo)
                const fallbackCandidates = availableCards.filter(c => !selectedIds.has(c.id));
                if (fallbackCandidates.length > 0) {
                    let card = fallbackCandidates[Math.floor(Math.random() * fallbackCandidates.length)];
                    card = {
                        ...card,
                        price: this.pricesByRarity[card.rarity]
                    };

                    // Appliquer aléatoirement un modificateur
                    if (window.cardModifiers) {
                        card = window.cardModifiers.applyRandomModifier(card);
                    }

                    this.shopCards.push(card);
                    selectedIds.add(card.id);
                }
            }
        }

        console.log(`✅ ${this.shopCards.length} cartes générées`);
        return this.shopCards;
    }

    async getPlayerInventory() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return [];

            // 1. Tenter de récupérer les vraies cartes (items)
            const itemsResponse = await fetch('/api/loot/items', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            let uniqueCards = [];
            const seenIds = new Set();

            if (itemsResponse.ok) {
                const lootItems = await itemsResponse.json();
                console.log('📦 Items de loot (cartes):', lootItems.length);

                lootItems.forEach(lootItem => {
                    const actualCardId = String(lootItem.id).trim();
                    // console.log(`🔍 Checking item: ${ actualCardId } `);

                    if (!actualCardId || seenIds.has(actualCardId)) return;
                    seenIds.add(actualCardId);

                    if (window.LOOT_CONFIG && window.LOOT_CONFIG.items) {
                        const cardData = window.LOOT_CONFIG.items[actualCardId];

                        if (!cardData) {
                            console.warn(`⚠️ Item ${actualCardId} not found in LOOT_CONFIG`);
                            return;
                        }

                        if (cardData && window.cardSystem) {
                            const fullCard = window.cardSystem.lootItemToCard({
                                id: actualCardId,
                                name: cardData.name,
                                rarity: cardData.rarity,
                                rarityName: cardData.rarityName,
                                image: cardData.image,
                                value: cardData.value
                            });
                            uniqueCards.push(fullCard);
                        }
                    } else {
                        console.error('❌ LOOT_CONFIG.items missing!');
                    }
                });
            }

            // 2. Si aucune carte trouvée, vérifier les loot boxes (fallback pour compatibilité)
            if (uniqueCards.length === 0) {
                console.log('⚠️ Aucune carte réelle trouvée, vérification des loot boxes...');
                const boxesResponse = await fetch('/api/loot/inventory', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (boxesResponse.ok) {
                    const boxes = await boxesResponse.json();
                    console.log('📦 Loot boxes trouvées:', boxes.length);

                    // Pour chaque rareté de box possédée, ajouter une carte aléatoire de cette rareté depuis LOOT_CONFIG
                    const raritiesOwned = [...new Set(boxes.map(b => b.rarity))];

                    if (window.LOOT_CONFIG && window.LOOT_CONFIG.items) {
                        const allCards = Object.values(window.LOOT_CONFIG.items);

                        raritiesOwned.forEach(rarity => {
                            const possibleCards = allCards.filter(c => c.rarity === rarity);
                            if (possibleCards.length > 0) {
                                // On en prend jusqu'à 3 différentes pour avoir du choix
                                const count = Math.min(3, possibleCards.length);
                                for (let i = 0; i < count; i++) {
                                    const randomCard = possibleCards[Math.floor(Math.random() * possibleCards.length)];
                                    if (!seenIds.has(randomCard.id)) {
                                        seenIds.add(randomCard.id);
                                        if (window.cardSystem) {
                                            const fullCard = window.cardSystem.lootItemToCard(randomCard);
                                            uniqueCards.push(fullCard);
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }

            console.log(`✅ ${uniqueCards.length} cartes chargées pour la boutique`);
            return uniqueCards;
        } catch (error) {
            console.error('❌ Erreur inventory:', error);
            return [];
        }
    }

    selectRarityByProbability() {
        const random = Math.random();
        let cumulative = 0;

        for (const rarity of Object.keys(this.spawnProbabilities)) {
            cumulative += this.spawnProbabilities[rarity];
            if (random <= cumulative) return rarity;
        }

        return 'consumer';
    }

    selectRandomCardFromRarity(rarity, unlockedCards) {
        const cardsOfRarity = unlockedCards.filter(c => c.rarity === rarity);

        if (cardsOfRarity.length === 0) {
            return this.fallbackToLowerRarity(rarity, unlockedCards);
        }

        return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
    }

    fallbackToLowerRarity(rarity, unlockedCards) {
        const rarityOrder = ['melee', 'covert', 'classified', 'restricted', 'milspec', 'industrial', 'consumer'];
        const currentIndex = rarityOrder.indexOf(rarity);

        for (let i = currentIndex + 1; i < rarityOrder.length; i++) {
            const cards = unlockedCards.filter(c => c.rarity === rarityOrder[i]);
            if (cards.length > 0) {
                return cards[Math.floor(Math.random() * cards.length)];
            }
        }

        if (unlockedCards.length > 0) {
            return unlockedCards[Math.floor(Math.random() * unlockedCards.length)];
        }

        return null;
    }

    async buyCard(cardId, playerGold) {
        const card = this.shopCards.find(c => c.id === cardId);
        if (!card) return { success: false, message: 'Carte non trouvée' };
        if (playerGold < card.price) return { success: false, message: 'Or insuffisant' };

        const currentDeck = window.cardSystem?.playerDeck || [];

        // Calculer la limite de deck (5 + nombre de cartes Negative)
        let deckLimit = 5;
        if (window.cardModifiers) {
            deckLimit = window.cardModifiers.getAdjustedDeckLimit(currentDeck, 5);
        }

        // Vérifier si on peut ajouter la carte (sauf si c'est une carte Negative)
        const isNegativeCard = card.modifier && card.modifier.type === 'negative';
        if (currentDeck.length >= deckLimit && !isNegativeCard) {
            return { success: false, message: `Deck complet (${currentDeck.length}/${deckLimit})` };
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/shop/buy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    cardId: cardId,
                    cardPrice: card.price,
                    playerGold: playerGold
                })
            });

            const result = await response.json();
            if (!result.success) return { success: false, message: result.message };

            if (window.cardSystem) {
                window.cardSystem.addToDeck(cardId);
                window.cardSystem.saveDeck();
            }

            if (window.game?.player) {
                window.game.player.changeGoldAmount(-card.price);
            }

            this.shopCards = this.shopCards.filter(c => c.id !== cardId);

            if (window.cardEffectHandler && window.cardSystem) {
                window.cardEffectHandler.applyCardEffects(window.cardSystem.getDeck());
            }

            return { success: true, goldSpent: card.price };

        } catch (error) {
            console.error('❌ Erreur achat:', error);
            return { success: false, message: 'Erreur de connexion' };
        }
    }

    async sellCard(cardId) {
        // First check if card is in the current deck
        const deck = window.cardSystem?.getDeck() || [];
        let card = deck.find(c => c && c.id === cardId);

        // If not in deck, try to find it in allCards (fallback)
        if (!card) {
            card = window.cardSystem?.getCardById(cardId);
        }

        if (!card) {
            console.error('❌ Card not found in deck or inventory:', cardId);
            return { success: false, message: 'Carte non trouvée dans le deck' };
        }

        const sellPrice = Math.floor(this.pricesByRarity[card.rarity] * this.sellBackRate);

        console.log(`💰 Selling card - ID: ${cardId}, Rarity: ${card.rarity}, Price: ${sellPrice}`);

        if (isNaN(sellPrice) || sellPrice === undefined) {
            console.error(`❌ Invalid sell price - Rarity: ${card.rarity}, Price: ${sellPrice}`);
            return { success: false, message: 'Prix de vente invalide' };
        }

        try {
            const token = localStorage.getItem('auth_token');
            const body = {
                cardId: cardId,
                sellPrice: sellPrice
            };

            console.log(`📤 Sending: cardId="${cardId}", sellPrice=${sellPrice} (type: ${typeof sellPrice})`);

            const response = await fetch('/api/shop/sell', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            console.log(`📥 Response status: ${response.status}`);

            const result = await response.json();
            console.log(`📥 Response:`, result);
            console.log(`📥 Success: ${result.success}, Message: ${result.message}`);

            if (!result.success) {
                console.error(`❌ Sell failed: ${result.message}`);
                return { success: false, message: result.message };
            }

            if (window.cardSystem) {
                window.cardSystem.removeFromDeck(cardId);
                window.cardSystem.saveDeck();
            }

            if (window.game?.player) {
                window.game.player.changeGoldAmount(sellPrice);
            }

            if (window.cardEffectHandler && window.cardSystem) {
                window.cardEffectHandler.applyCardEffects(window.cardSystem.getDeck());
            }

            return { success: true, goldGained: sellPrice };

        } catch (error) {
            console.error('❌ Erreur vente:', error);
            return { success: false, message: 'Erreur de connexion' };
        }
    }

    async showShop() {
        console.log('🛒 Ouverture boutique...');
        await this.generateShopOffers();

        const modal = document.getElementById('shop-modal');
        if (!modal) return;

        this.updateShopDisplay();

        if (window.AnimationUtils?.showModal) {
            window.AnimationUtils.showModal(modal);
        } else {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
    }

    closeShop() {
        const modal = document.getElementById('shop-modal');
        if (!modal) return;

        if (window.AnimationUtils?.hideModal) {
            window.AnimationUtils.hideModal(modal);
        } else {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }

    updateShopDisplay() {
        const goldElement = document.getElementById('shop-gold-amount');
        if (goldElement && window.game?.player) {
            goldElement.textContent = window.game.player.getGold();
        }

        this.displayShopCards();
        this.displayDeckCards();
    }

    displayShopCards() {
        const container = document.getElementById('shop-cards-grid');
        if (!container) return;

        if (this.shopCards.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #aaa;">Aucune carte disponible</div>';
            return;
        }

        const playerGold = window.game?.player?.getGold() || 0;

        container.innerHTML = this.shopCards.map(card => {
            const canAfford = playerGold >= card.price;
            const color = this.getRarityColor(card.rarity);
            const effectDesc = card.effect?.description || '';

            // Modificateur
            const modifierClass = card.modifier ? card.modifier.cssClass : '';
            const modifierBadge = card.modifier ? `<div class="card-modifier-badge">${card.modifier.name}</div>` : '';
            const modifierDesc = card.modifier ? `<div style="font-size: 10px; color: #ffdd00; margin-top: 3px;">✨ ${card.modifier.description}</div>` : '';

            return `
                <div class="shop-card ${canAfford ? '' : 'cannot-afford'} ${modifierClass}"
                     style="--rarity-color: ${color};"
                     onclick="window.cardShop.handleBuyCard('${card.id}')">
                    ${modifierBadge}
                    <div class="shop-card-price">${card.price} 💰</div>
                    <div style="margin: 10px 0;">
                        ${card.image ? `<img src="/img/cartes/${card.image}" style="max-width: 100%; border-radius: 5px;">` : '🎴'}
                    </div>
                    <div class="card-name" style="font-weight: bold; margin: 5px 0;">${card.name || card.id}</div>
                    <div style="color: ${color}; font-size: 11px;">${card.rarityName || card.rarity.toUpperCase()}</div>
                    <div class="card-effect" style="font-size: 10px; color: #aaa; padding: 5px;">${effectDesc}</div>
                    ${modifierDesc}
                </div>
            `;
        }).join('');
    }

    displayDeckCards() {
        const container = document.getElementById('shop-deck-grid');
        const countElement = document.getElementById('deck-count-shop');

        if (!window.cardSystem) return;

        const deck = window.cardSystem.getDeck();

        // Calculer la limite de deck ajustée
        let deckLimit = 5;
        if (window.cardModifiers) {
            deckLimit = window.cardModifiers.getAdjustedDeckLimit(deck, 5);
        }

        if (countElement) countElement.textContent = `${deck.length}/${deckLimit}`;
        if (!container) return;

        if (deck.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #aaa;">Aucune carte dans votre deck</div>';
            return;
        }

        container.innerHTML = deck.map(card => {
            const color = this.getRarityColor(card.rarity);
            let sellPrice = Math.floor(this.pricesByRarity[card.rarity] * this.sellBackRate);

            // Ajuster le prix de vente si la carte a un modificateur
            if (card.modifier && card.modifier.priceMultiplier) {
                sellPrice = Math.floor(sellPrice * card.modifier.priceMultiplier);
            }

            const effectDesc = card.effect?.description || '';

            // Modificateur
            const modifierClass = card.modifier ? card.modifier.cssClass : '';
            const modifierBadge = card.modifier ? `<div class="card-modifier-badge">${card.modifier.name}</div>` : '';
            const modifierDesc = card.modifier ? `<div style="font-size: 10px; color: #ffdd00; margin-top: 3px;">✨ ${card.modifier.description}</div>` : '';

            return `
                <div class="deck-card-shop ${modifierClass}" style="--rarity-color: ${color}; border: 2px solid ${color}; border-radius: 8px; padding: 10px; position: relative; background: rgba(255,255,255,0.05);">
                    ${modifierBadge}
                    <div style="margin: 10px 0;">
                        ${card.image ? `<img src="/img/cartes/${card.image}" style="max-width: 100%; border-radius: 5px;">` : '🎴'}
                    </div>
                    <div class="card-name" style="font-weight: bold; margin: 5px 0;">${card.name || card.id}</div>
                    <div style="color: ${color}; font-size: 11px;">${card.rarityName || card.rarity.toUpperCase()}</div>
                    <div class="card-effect" style="font-size: 10px; color: #aaa; padding: 5px;">${effectDesc}</div>
                    ${modifierDesc}

                    <button class="sell-btn" data-card-id="${card.id}" data-action="sell">
                        Vendre <span class="sell-price">${sellPrice} 💰</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    async handleBuyCard(cardId) {
        if (!window.game?.player) return alert('❌ Erreur: Jeu non initialisé');

        const result = await this.buyCard(cardId, window.game.player.getGold());

        if (result.success) {
            if (window.AnimationUtils) AnimationUtils.createParticles(document.getElementById('shop-modal'), 5);
            this.updateShopDisplay();
            this.showNotification(`✅ Carte achetée pour ${result.goldSpent} or !`);
        } else {
            this.showNotification(`❌ ${result.message}`, 'error');
        }
    }

    async handleSellCard(cardId) {
        const result = await this.sellCard(cardId);

        if (result.success) {
            console.log(`✅ Card sold successfully! Gold gained: ${result.goldGained}`);

            // Update shop display (regenerate offers and deck)
            this.updateShopDisplay();

            // Update player gold display
            if (window.game) {
                window.game.updateUI();
            }

            this.showNotification(`💰 Carte vendue pour ${result.goldGained} or !`);
        } else {
            this.showNotification(`❌ ${result.message}`, 'error');
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

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.style.cssText = `
position: fixed;
top: 20px;
right: 20px;
padding: 15px 25px;
background: ${type === 'error' ? '#e74c3c' : '#2ecc71'};
color: white;
border - radius: 8px;
font - size: 14px;
font - weight: bold;
z - index: 10001;
box - shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }
}

// Créer l'instance globale
window.cardShop = new CardShop();
