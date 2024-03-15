/**
 * Page d'inventaire pour afficher les items lootés
 */

class InventoryPage {
    constructor() {
        this.currentInventory = [];
        this.currentFilter = 'all';
        this.rarityColors = {};
        this.currentPage = 1;
        this.itemsPerPage = 20; // Modifié à 20 items par page
        this.cardSystem = null;
        this.init();
    }

    async init() {
        console.log('InventoryPage: init started');

        // Utiliser l'instance globale de CardSystem (créée dans main.js)
        // OU créer une nouvelle instance si pas de page principale
        if (window.cardSystem) {
            this.cardSystem = window.cardSystem;
        } else if (window.CardSystem) {
            this.cardSystem = new CardSystem();
            await this.cardSystem.loadCardsFromInventory();
        }

        // Vérifier le token avant d'initialiser OnlineManager
        const token = localStorage.getItem('auth_token');
        if (!token) {
            window.location.href = '/login';
            return;
        }

        // Initialiser OnlineManager manuellement si pas déjà fait
        if (!window.onlineManager) {
            window.onlineManager = new OnlineManager();
        }

        // S'authentifier si pas déjà authentifié
        if (!window.onlineManager.isAuthenticated) {
            await window.onlineManager.authenticateWithToken(token);
        }

        // Attendre que la connexion Socket.io soit établie
        if (!window.onlineManager.socket || !window.onlineManager.socket.connected) {
            if (!window.onlineManager.socket) {
                window.onlineManager.connectSocket();
            }
            // Attendre la connexion
            await new Promise((resolve) => {
                if (window.onlineManager.socket && window.onlineManager.socket.connected) {
                    resolve();
                } else {
                    const timeout = setTimeout(resolve, 3000);
                    window.onlineManager.socket?.on('connect', () => {
                        clearTimeout(timeout);
                        if (window.onlineManager.user && window.onlineManager.user.token) {
                            window.onlineManager.socket.emit('authenticate', { token: window.onlineManager.user.token });
                        }
                        resolve();
                    });
                }
            });
        }

        // Attendre l'authentification Socket.io si nécessaire
        if (window.onlineManager.socket && window.onlineManager.socket.connected && !window.onlineManager.isAuthenticated) {
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 3000);
                window.onlineManager.socket.once('authenticated', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                if (token) {
                    window.onlineManager.socket.emit('authenticate', { token });
                }
            });
        }

        // Initialiser les couleurs de rareté
        this.initRarityColors();

        // Charger l'inventaire
        await this.loadInventory();

        // Initialiser les filtres
        this.initFilters();

        // Initialiser le modal de détails
        this.initDetailModal();

        // Initialiser le DeckManager APRÈS que l'inventaire soit chargé
        if (window.DeckManager) {
            console.log('InventoryPage: Initializing DeckManager...');
            this.deckManager = new DeckManager(this, this.cardSystem);
        } else {
            console.error('InventoryPage: DeckManager class not found!');
        }
    }

    /**
     * Initialise les couleurs de rareté depuis LOOT_DATA ou LOOT_CONFIG
     */
    initRarityColors() {
        const lootData = window.LOOT_CONFIG || window.LOOT_DATA;
        if (lootData && lootData.categories) {
            Object.keys(lootData.categories).forEach(rarity => {
                this.rarityColors[rarity] = lootData.categories[rarity].color;
            });
        }
    }

    /**
     * Charge l'inventaire depuis le serveur
     */
    async loadInventory() {
        if (!window.onlineManager || !window.onlineManager.socket || !window.onlineManager.isAuthenticated) {
            console.error('⚠️ Pas de connexion Socket.io');
            this.currentInventory = [];
            this.displayInventory([]);
            return;
        }

        return new Promise((resolve) => {
            const socket = window.onlineManager.socket;

            const timeout = setTimeout(() => {
                socket.off('loot_items_inventory', onInventory);
                socket.off('loot_error', onError);
                console.warn('⚠️ Timeout lors du chargement de l\'inventaire');
                this.currentInventory = [];
                this.displayInventory([]);
                resolve();
            }, 5000);

            const onInventory = (data) => {
                clearTimeout(timeout);
                socket.off('loot_items_inventory', onInventory);
                socket.off('loot_error', onError);

                console.log('📦 Réponse inventaire items reçue:', data);

                if (data && Array.isArray(data.inventory)) {
                    console.log(`✅ Inventaire items chargé: ${data.inventory.length} items`);
                    this.currentInventory = data.inventory;
                    this.displayInventory(data.inventory);
                } else {
                    console.warn('⚠️ Format d\'inventaire invalide:', data);
                    this.currentInventory = [];
                    this.displayInventory([]);
                }
                resolve();
            };

            const onError = (error) => {
                clearTimeout(timeout);
                socket.off('loot_items_inventory', onInventory);
                socket.off('loot_error', onError);
                console.error('Erreur lors du chargement de l\'inventaire:', error);
                this.currentInventory = [];
                this.displayInventory([]);
                resolve();
            };

            socket.once('loot_items_inventory', onInventory);
            socket.once('loot_error', onError);

            socket.emit('get_loot_items');
        });
    }

    /**
     * Affiche l'inventaire avec filtres et pagination
     */
    displayInventory(inventory) {
        const container = document.getElementById('loot-items-container');
        if (!container) {
            console.error('❌ Conteneur loot-items-container non trouvé');
            return;
        }

        // Remove skeleton loader on first display
        const skeleton = container.querySelector('.loading-skeleton');
        if (skeleton) {
            skeleton.remove();
        }

        // Filtrer selon la rareté sélectionnée
        let filteredInventory = inventory;
        if (this.currentFilter !== 'all') {
            filteredInventory = inventory.filter(item => item.rarity === this.currentFilter);
        }

        // Grouper les items par ID pour le stacking
        const stackedItemsMap = new Map();
        filteredInventory.forEach(item => {
            if (stackedItemsMap.has(item.id)) {
                const existing = stackedItemsMap.get(item.id);
                existing.quantity++;
                // Optionnel : mettre à jour la date d'obtention si on veut trier par le plus récent reçu
                if (item.obtainedAt > existing.obtainedAt) {
                    existing.obtainedAt = item.obtainedAt;
                }
            } else {
                // Créer une copie pour ne pas modifier l'objet original
                stackedItemsMap.set(item.id, { ...item, quantity: 1 });
            }
        });

        // Convertir la Map en tableau et trier par date d'obtention (plus récent en premier)
        const stackedItems = Array.from(stackedItemsMap.values()).sort((a, b) => b.obtainedAt - a.obtainedAt);

        // Réinitialiser la page si nécessaire
        const totalPages = Math.ceil(stackedItems.length / this.itemsPerPage);
        if (this.currentPage > totalPages && totalPages > 0) {
            this.currentPage = totalPages;
        }

        if (stackedItems.length === 0) {
            container.innerHTML = '<div class="empty-inventory">Aucun item dans cette catégorie</div>';
            this.updatePagination(0, 0);
            return;
        }

        // Calculer les indices pour la pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedItems = stackedItems.slice(startIndex, endIndex);

        let html = '';
        paginatedItems.forEach(item => {
            // Récupérer les données complètes de l'item (image, description) depuis LOOT_CONFIG
            let itemData = item;
            if (window.LOOT_CONFIG && window.LOOT_CONFIG.items && window.LOOT_CONFIG.items[item.id]) {
                itemData = { ...item, ...window.LOOT_CONFIG.items[item.id] };
            } else if (window.LOOT_DATA && window.LOOT_DATA.messages && window.LOOT_DATA.messages[item.id]) {
                itemData = { ...item, ...window.LOOT_DATA.messages[item.id] };
            }

            const color = this.rarityColors[item.rarity] || '#ffffff';

            // Utiliser l'image si disponible, sinon l'emoji
            let visualContent = `<div class="loot-item-emoji" style="color: ${color};">${this.getRarityEmoji(item.rarity)}</div>`;
            if (itemData.image) {
                visualContent = `<img src="/img/cartes/${itemData.image}" class="loot-item-image" alt="${item.text || item.id}" loading="lazy">`;
            }

            // Nettoyer le nom (enlever les ** ** s'ils existent)
            let displayName = item.text || item.id;
            const nameMatch = displayName.match(/\*\*(.*?)\*\*/);
            if (nameMatch) displayName = nameMatch[1];
            if (itemData.name) displayName = itemData.name;

            // Récupérer l'effet de la carte si le système de cartes est disponible
            let cardEffect = '';
            if (this.cardSystem) {
                const effect = this.cardSystem.getCardSpecificEffects()[item.id] ||
                    this.cardSystem.cardEffectsMap[item.rarity];
                if (effect && effect.description) {
                    cardEffect = `<div class="loot-item-effect" style="color: ${color}; font-size: 0.85em; margin-top: 5px;">⚡ ${effect.description}</div>`;
                }
            }

            html += `
                <div class="loot-item-card" style="border-color: ${color}60; box-shadow: 0 0 10px ${color}20;" data-item-id="${item.id}">
                    <div class="loot-item-visual-container">
                        ${visualContent}
                    </div>
                    <div class="loot-item-name">${displayName}</div>
                    <div class="loot-item-rarity" style="color: ${color}; border-color: ${color}40;">
                        ${item.rarity.toUpperCase()}
                    </div>
                    <div class="loot-item-value">Valeur: ${itemData.value || 0}</div>
                    ${cardEffect}
                    ${item.quantity > 1 ? `<div class="loot-item-quantity" style="background: ${color};">x${item.quantity}</div>` : ''}
                </div>
            `;
        });

        container.innerHTML = html;

        // Ajouter les event listeners pour ouvrir le détail
        container.querySelectorAll('.loot-item-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = card.dataset.itemId;
                const item = stackedItems.find(i => i.id === itemId);
                if (item) {
                    this.openDetailModal(item);
                }
            });
        });

        // Mettre à jour la pagination
        this.updatePagination(stackedItems.length, totalPages);
    }

    /**
     * Met à jour l'affichage de la pagination
     */
    updatePagination(totalItems, totalPages) {
        let paginationContainer = document.getElementById('inventory-pagination');
        if (!paginationContainer) {
            // Créer le conteneur de pagination s'il n'existe pas
            const inventoryContent = document.querySelector('.inventory-content');
            if (inventoryContent) {
                paginationContainer = document.createElement('div');
                paginationContainer.id = 'inventory-pagination';
                paginationContainer.className = 'inventory-pagination';
                inventoryContent.appendChild(paginationContainer);
            } else {
                return;
            }
        }

        if (totalPages <= 1) {
            paginationContainer.innerHTML = `<div class="pagination-info">${totalItems} item${totalItems > 1 ? 's' : ''}</div>`;
            return;
        }

        let html = `<div class="pagination-info">Page ${this.currentPage} / ${totalPages} (${totalItems} item${totalItems > 1 ? 's' : ''})</div>`;
        html += '<div class="pagination-controls">';

        // Bouton précédent
        html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">← Précédent</button>`;

        // Numéros de page (afficher max 5 pages autour de la page actuelle)
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            html += `<button class="pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) html += '<span class="pagination-dots">...</span>';
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += '<span class="pagination-dots">...</span>';
            html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Bouton suivant
        html += `<button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Suivant →</button>`;

        html += '</div>';
        paginationContainer.innerHTML = html;

        // Event listeners pour les boutons de pagination
        paginationContainer.querySelectorAll('.pagination-btn').forEach(btn => {
            if (!btn.disabled) {
                btn.addEventListener('click', () => {
                    const page = parseInt(btn.dataset.page);
                    if (page && page !== this.currentPage) {
                        this.currentPage = page;
                        this.displayInventory(this.currentInventory);
                        // Scroll vers le haut
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            }
        });
    }

    /**
     * Initialise le modal de détails
     */
    initDetailModal() {
        // Créer le HTML du modal s'il n'existe pas (fallback si non présent dans HTML)
        if (!document.getElementById('item-detail-modal')) {
            const modalHtml = `
                <div id="item-detail-modal" class="modal">
                    <div class="item-detail-content">
                        <button class="close-modal-btn">&times;</button>
                        <div class="item-detail-body">
                            <div class="item-detail-visual">
                                <!-- Image sera insérée ici -->
                            </div>
                            <div class="item-detail-info">
                                <h2 class="item-detail-title"></h2>
                                <div class="item-detail-rarity-tag"></div>
                                <div class="item-detail-description"></div>
                                <div class="item-detail-stats">
                                    <div class="stat-row">
                                        <span class="stat-label">Valeur estimée</span>
                                        <span class="stat-value item-value"></span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-label">Quantité possédée</span>
                                        <span class="stat-value item-quantity"></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Toujours attacher les écouteurs, même si le modal existe déjà dans le HTML
        const modal = document.getElementById('item-detail-modal');
        if (modal) {
            const closeBtn = modal.querySelector('.close-modal-btn');
            if (closeBtn) {
                // Cloner pour retirer les anciens écouteurs potentiels
                const newCloseBtn = closeBtn.cloneNode(true);
                closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

                newCloseBtn.addEventListener('click', () => {
                    this.closeDetailModal();
                });
            }

            // Fermer en cliquant en dehors
            // On retire d'abord l'ancien listener pour éviter les doublons si init est appelé plusieurs fois
            const newModal = modal.cloneNode(true);
            modal.parentNode.replaceChild(newModal, modal);

            newModal.addEventListener('click', (e) => {
                if (e.target.id === 'item-detail-modal') {
                    this.closeDetailModal();
                }
            });

            // Réattacher l'écouteur sur le bouton fermer du NOUVEAU modal cloné
            const newModalCloseBtn = newModal.querySelector('.close-modal-btn');
            if (newModalCloseBtn) {
                newModalCloseBtn.addEventListener('click', () => {
                    this.closeDetailModal();
                });
            }
        }
    }

    /**
     * Ouvre le modal de détails pour un item
     */
    openDetailModal(item) {
        const modal = document.getElementById('item-detail-modal');
        if (!modal) return;

        // Récupérer les données complètes
        let itemData = item;
        if (window.LOOT_CONFIG && window.LOOT_CONFIG.items && window.LOOT_CONFIG.items[item.id]) {
            itemData = { ...item, ...window.LOOT_CONFIG.items[item.id] };
        }

        const color = this.rarityColors[item.rarity] || '#ffffff';

        // Titre
        let title = itemData.name || itemData.text || item.id;
        const nameMatch = title.match(/\*\*(.*?)\*\*/);
        if (nameMatch) title = nameMatch[1];
        modal.querySelector('.item-detail-title').textContent = title;
        modal.querySelector('.item-detail-title').style.color = color;

        // Visuel (Image ou Emoji)
        const visualContainer = modal.querySelector('.item-detail-visual');
        if (itemData.image) {
            visualContainer.innerHTML = `<img src="/img/cartes/${itemData.image}" alt="${title}">`;
            visualContainer.style.borderColor = color;
            visualContainer.style.boxShadow = `0 0 30px ${color}40`;
        } else {
            const emoji = this.getRarityEmoji(item.rarity);
            visualContainer.innerHTML = `<div style="font-size: 100px;">${emoji}</div>`;
            visualContainer.style.borderColor = color;
        }

        // Tag Rareté
        const rarityTag = modal.querySelector('.item-detail-rarity-tag');
        rarityTag.textContent = itemData.rarityName || item.rarity;
        rarityTag.style.backgroundColor = `${color}20`;
        rarityTag.style.color = color;
        rarityTag.style.borderColor = color;

        // Description
        // Afficher directement le champ "text" de lootData.js
        let desc = itemData.text || "Aucune description disponible.";
        // Nettoyer uniquement les balises de gras ** si présentes
        desc = desc.replace(/\*\*/g, '').trim();

        // Ajouter l'effet de la carte
        if (this.cardSystem) {
            const effect = this.cardSystem.getCardSpecificEffects()[item.id] ||
                this.cardSystem.cardEffectsMap[item.rarity];
            if (effect && effect.description) {
                desc += `\n\n⚡ Effet de carte: ${effect.description}`;
            }
        }

        modal.querySelector('.item-detail-description').textContent = desc || "Aucune description disponible.";

        // Stats
        modal.querySelector('.item-value').textContent = itemData.value || 0;
        modal.querySelector('.item-quantity').textContent = item.quantity || 1;

        // Afficher
        modal.classList.add('show');
        AnimationUtils.showModal(modal);
    }

    closeDetailModal() {
        const modal = document.getElementById('item-detail-modal');
        if (modal) {
            AnimationUtils.hideModal(modal);
        }
    }

    /**
     * Récupère l'emoji de rareté
     */
    getRarityEmoji(rarity) {
        if (window.LOOT_DATA && window.LOOT_DATA.categories && window.LOOT_DATA.categories[rarity]) {
            return window.LOOT_DATA.categories[rarity].emoji;
        }
        return '📦';
    }

    /**
     * Initialise les filtres
     */
    initFilters() {
        const filterContainer = document.getElementById('inventory-filters');
        if (!filterContainer) return;

        filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Retirer la classe active de tous les boutons
                filterContainer.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                });

                // Ajouter la classe active au bouton cliqué
                btn.classList.add('active');

                // Mettre à jour le filtre
                this.currentFilter = btn.dataset.filter;

                // Réinitialiser à la page 1
                this.currentPage = 1;

                // Réafficher l'inventaire avec le nouveau filtre
                this.displayInventory(this.currentInventory);
            });
        });
    }
}

// Initialiser la page quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryPage = new InventoryPage();
});
