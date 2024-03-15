/**
 * Page de gambling pour ouvrir les caisses
 */

class GamblingPage {
    constructor() {
        this.isSpinning = false;
        this.currentInventory = []; // Stocker l'inventaire chargé
        this.selectedBox = null; // Caisse sélectionnée
        this.lastSpinTime = 0; // Dernier temps de spin pour le cooldown
        this.SPIN_COOLDOWN = 500; // Cooldown de 500ms entre les spins
        this.selectedQuantity = 1; // Quantité sélectionnée par défaut
        this.animationsEnabled = true; // Animations activées par défaut
        this.init();
    }

    async init() {
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

        // Initialiser les probabilités (niveau 10 par défaut)
        this.updateProbabilities(10);

        // Initialiser la roulette à l'état de repos
        this.initTrack();

        // Charger l'inventaire depuis le serveur
        await this.loadInventory();

        // Initialiser le bouton "Lancer"
        this.updateSpinButton();

        // Initialiser les boutons de quantité
        this.initQuantityControls();

        // Initialiser le switch d'animation
        this.initAnimationSwitch();

        // Initialiser le modal de sélection des caisses
        this.initBoxSelectionModal();

        // Event listener pour le bouton "Lancer"
        const spinBtn = document.getElementById('spin-horizontal-btn');
        if (spinBtn) {
            spinBtn.addEventListener('click', () => {
                // Vérifier le cooldown
                const now = Date.now();
                if (now - this.lastSpinTime < this.SPIN_COOLDOWN) {
                    console.log('⏳ Cooldown actif, veuillez patienter...');
                    return;
                }

                // Vérifier que l'inventaire est chargé
                if (!this.currentInventory || this.currentInventory.length === 0) {
                    console.log('⏳ Inventaire en cours de chargement...');
                    return;
                }

                if (this.selectedBox && !this.isSpinning) {
                    this.lastSpinTime = now;
                    this.handleSpinClick();
                }
            });
        }

        // Event listener pour fermer l'overlay simple
        const continueBtn = document.getElementById('collect-loot-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.closeLootOverlay('loot-result-overlay');
            });
        }

        // Event listener pour fermer l'overlay bulk
        const collectBulkBtn = document.getElementById('collect-bulk-btn');
        if (collectBulkBtn) {
            collectBulkBtn.addEventListener('click', () => {
                this.closeLootOverlay('bulk-result-overlay');
            });
        }
    }

    initQuantityControls() {
        const qtyBtns = document.querySelectorAll('.qty-btn');
        qtyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.isSpinning) return;

                // Retirer la classe active de tous les boutons
                qtyBtns.forEach(b => b.classList.remove('active'));

                // Ajouter la classe active au bouton cliqué
                e.target.classList.add('active');

                // Mettre à jour la quantité
                this.selectedQuantity = parseInt(e.target.dataset.qty);
                console.log('Quantité sélectionnée:', this.selectedQuantity);

                // Mettre à jour le bouton lancer (texte)
                this.updateSpinButton();
            });
        });
    }

    initAnimationSwitch() {
        const switchEl = document.getElementById('animation-switch');
        if (switchEl) {
            this.animationsEnabled = switchEl.checked;
            switchEl.addEventListener('change', (e) => {
                this.animationsEnabled = e.target.checked;
                console.log('Animations enabled:', this.animationsEnabled);
            });
        }
    }

    /**
     * Initialise le modal de sélection des caisses
     */
    initBoxSelectionModal() {
        const openBtn = document.getElementById('open-box-selection-btn');
        const closeBtn = document.getElementById('close-box-selection-modal');
        const modal = document.getElementById('box-selection-modal');

        if (openBtn && modal) {
            openBtn.addEventListener('click', async () => {
                modal.classList.add('active');
                // Recharger l'inventaire depuis le serveur pour avoir les données à jour
                await this.loadInventory();
                this.displayInventory(this.currentInventory);
            });
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        }

        // Fermer le modal en cliquant en dehors
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }

        // Fermer avec la touche Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });
    }

    /**
     * Gère le clic sur le bouton lancer
     */
    handleSpinClick() {
        if (this.isSpinning || !this.selectedBox) return;

        // Vérifier si on a assez de caisses DU MÊME TYPE (pas juste du même niveau)
        const selectedCaseType = window.LOOT_CONFIG?.getCaseTypeForLevel(this.selectedBox.level);
        const boxesOfSameType = this.currentInventory.filter(b => {
            const boxCaseType = window.LOOT_CONFIG?.getCaseTypeForLevel(b.level);
            return boxCaseType?.name === selectedCaseType?.name;
        });

        if (boxesOfSameType.length < this.selectedQuantity) {
            alert(`Vous n'avez pas assez de caisses ! (Requis: ${this.selectedQuantity}, Disponible: ${boxesOfSameType.length})`);
            // Reset quantity to 1 if not enough
            this.selectedQuantity = 1;
            document.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.qty-btn[data-qty="1"]').classList.add('active');
            this.updateSpinButton();
            return;
        }

        if (this.selectedQuantity === 1) {
            // Mode classique (Roulette)
            this.openBox(this.selectedBox.id, this.currentInventory);
        } else {
            // Mode multiple (Bulk) - Prendre les N premières caisses du même type
            const boxesToOpen = boxesOfSameType.slice(0, this.selectedQuantity);
            this.openBulkBoxes(boxesToOpen);
        }
    }

    /**
     * Ouvre une caisse par son ID (Mode x1)
     */
    openBoxById(boxId) {
        // Recharger l'inventaire pour être sûr d'avoir les données
        this.loadInventory().then(() => {
            // Trouver la caisse dans l'inventaire chargé
            const allBoxes = [];
            const container = document.getElementById('gambling-inventory');
            if (container) {
                container.querySelectorAll('.loot-box-item').forEach(item => {
                    const id = item.dataset.boxId;
                    if (id) {
                        // Récupérer les données depuis l'inventaire
                        const box = this.currentInventory?.find(b => b.id === id);
                        if (box) {
                            allBoxes.push(box);
                        }
                    }
                });
            }

            const box = allBoxes.find(b => b.id === boxId);
            if (box) {
                this.openBox(boxId, allBoxes);
            } else {
                console.warn('Caisse non trouvée:', boxId);
            }
        });
    }

    /**
     * Charge l'inventaire depuis le serveur via Socket.io
     */
    async loadInventory() {
        // Vérifier que OnlineManager est disponible et authentifié
        if (!window.onlineManager) {
            console.error('OnlineManager non disponible');
            this.currentInventory = [];
            this.displayInventory([]);
            return;
        }

        // Attendre que la socket soit connectée et authentifiée
        if (!window.onlineManager.socket || !window.onlineManager.socket.connected) {
            console.warn('Socket non connecté, tentative de connexion...');
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
                        const token = localStorage.getItem('auth_token');
                        if (token) {
                            window.onlineManager.socket.emit('authenticate', { token });
                        }
                        resolve();
                    });
                }
            });
        }

        if (!window.onlineManager.isAuthenticated) {
            const token = localStorage.getItem('auth_token');
            if (token && window.onlineManager.socket && window.onlineManager.socket.connected) {
                // Attendre l'authentification
                await new Promise((resolve) => {
                    const timeout = setTimeout(resolve, 3000);
                    window.onlineManager.socket.once('authenticated', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                    window.onlineManager.socket.emit('authenticate', { token });
                });
            } else {
                console.error('Impossible de s\'authentifier');
                this.currentInventory = [];
                this.displayInventory([]);
                return;
            }
        }

        return new Promise((resolve) => {
            const socket = window.onlineManager.socket;

            const timeout = setTimeout(() => {
                socket.off('loot_inventory', onInventory);
                socket.off('loot_error', onError);
                console.warn('⚠️ Timeout lors du chargement de l\'inventaire');
                this.currentInventory = [];
                this.displayInventory([]);
                resolve();
            }, 5000);

            const onInventory = (data) => {
                clearTimeout(timeout);
                socket.off('loot_inventory', onInventory);
                socket.off('loot_error', onError);

                console.log('📦 Réponse inventaire reçue:', data);

                if (data && Array.isArray(data.inventory)) {
                    console.log(`✅ Inventaire chargé dans gambling: ${data.inventory.length} caisses`);
                    this.currentInventory = data.inventory;
                    this.displayInventory(data.inventory);
                    // Mise à jour des boutons en fonction du nouvel inventaire
                    this.updateSpinButton();
                } else {
                    console.warn('⚠️ Format d\'inventaire invalide:', data);
                    this.currentInventory = [];
                    this.displayInventory([]);
                }
                resolve();
            };

            const onError = (error) => {
                clearTimeout(timeout);
                socket.off('loot_inventory', onInventory);
                socket.off('loot_error', onError);
                console.error('Erreur lors du chargement de l\'inventaire:', error);
                this.currentInventory = [];
                this.displayInventory([]);
                resolve();
            };

            socket.once('loot_inventory', onInventory);
            socket.once('loot_error', onError);

            socket.emit('get_loot_inventory');
        });
    }

    /**
     * Affiche le menu de sélection de caisses (nouveau design)
     */
    displayInventory(inventory) {
        const container = document.getElementById('box-selection-menu');
        if (!container) {
            console.error('❌ Conteneur box-selection-menu non trouvé');
            return;
        }

        if (!inventory || inventory.length === 0) {
            container.innerHTML = '<div class="empty-inventory" style="grid-column: 1/-1; text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Aucune caisse disponible</div>';
            return;
        }

        // Grouper par TYPE DE CAISSE (pas par niveau)
        const groupedByCaseType = {};
        inventory.forEach(box => {
            const caseType = window.LOOT_CONFIG?.getCaseTypeForLevel(box.level);
            const key = caseType?.name || `Niveau ${box.level}`;

            if (!groupedByCaseType[key]) {
                groupedByCaseType[key] = {
                    caseType: caseType,
                    boxes: [],
                    levelTier: box.level
                };
            }
            groupedByCaseType[key].boxes.push(box);
        });

        // Trier par ordre de niveau
        const sortedGroups = Object.values(groupedByCaseType)
            .sort((a, b) => (a.caseType?.levelRange[0] || 0) - (b.caseType?.levelRange[0] || 0));

        let html = '';

        sortedGroups.forEach(group => {
            const count = group.boxes.length;
            const firstBox = group.boxes[0];
            const isSelected = this.selectedBox && this.selectedBox.level === group.levelTier;

            const caseName = group.caseType?.name || `Niveau ${group.levelTier}`;
            const caseImage = group.caseType?.image || firstBox.caseImage || '/img/case/Caisse_icons/alpha_case.png';

            html += `
                <div class="box-selection-item ${isSelected ? 'selected' : ''}" data-level-tier="${group.levelTier}" data-box-id="${firstBox.id}">
                    <div class="box-selection-image">
                        <img src="${caseImage}" alt="${caseName}" />
                    </div>
                    <div class="box-selection-name">${caseName}</div>
                    <div class="box-selection-count ${count > 0 ? 'highlight' : ''}">${count} disponible${count > 1 ? 's' : ''}</div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Event listeners pour les items de sélection
        container.querySelectorAll('.box-selection-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const levelTier = parseInt(item.dataset.levelTier);
                const boxId = item.dataset.boxId;
                if (!isNaN(levelTier) && boxId) {
                    const boxesForTier = inventory.filter(box => box.level === levelTier);
                    const box = boxesForTier.find(b => b.id === boxId) || boxesForTier[0];
                    if (box) {
                        this.selectBox(box);
                    }
                }
            });
        });
    }

    /**
     * Sélectionne une caisse
     */
    selectBox(box) {
        this.selectedBox = box;

        // Mettre à jour l'affichage de l'inventaire
        this.displayInventory(this.currentInventory);

        // Mettre à jour les probabilités
        this.updateProbabilities(box.level);

        // Afficher/mettre à jour le bouton "Lancer"
        this.updateSpinButton();

        // Afficher l'info de la caisse sélectionnée (Tag dans le header)
        const selectedBoxTag = document.getElementById('selected-box-tag');
        const selectedBoxNameTag = document.getElementById('selected-box-name-tag');
        const selectedBoxIcon = document.getElementById('selected-box-icon');

        if (selectedBoxTag && selectedBoxNameTag && selectedBoxIcon) {
            const caseType = window.LOOT_CONFIG?.getCaseTypeForLevel(box.level);
            // Extraire le nom sans la tranche de niveau (ex: "Alpha Case" au lieu de "Alpha Case (1-39)")
            const cleanName = caseType?.name.replace(/\s*\(.*?\)\s*/g, '') || `Niveau ${box.level}`;
            selectedBoxNameTag.textContent = cleanName;
            selectedBoxIcon.src = caseType?.image || '/img/case/Caisse_icons/alpha_case.png';
            selectedBoxTag.style.display = 'inline-flex';
        }

        // Fermer le modal après sélection
        const modal = document.getElementById('box-selection-modal');
        if (modal) {
            modal.classList.remove('active');
        }

        // Mettre à jour le texte du bouton avec le nombre restant
        const openBtn = document.getElementById('open-box-selection-btn');
        if (openBtn) {
            // Compter TOUTES les caisses du même TYPE (pas juste du même niveau)
            const selectedCaseType = window.LOOT_CONFIG?.getCaseTypeForLevel(box.level);
            const boxesOfSameType = this.currentInventory.filter(b => {
                const boxCaseType = window.LOOT_CONFIG?.getCaseTypeForLevel(b.level);
                return boxCaseType?.name === selectedCaseType?.name;
            });
            const count = boxesOfSameType.length;
            openBtn.textContent = `📦 ${count} caisse${count > 1 ? 's' : ''} restante${count > 1 ? 's' : ''}`;
        }

        console.log('✅ Caisse sélectionnée:', box);
    }

    /**
     * Met à jour le bouton "Lancer"
     */
    updateSpinButton() {
        const spinBtn = document.getElementById('spin-horizontal-btn');
        if (!spinBtn) return;

        if (this.selectedBox) {
            spinBtn.disabled = false;
            spinBtn.textContent = this.selectedQuantity > 1
                ? `🎰 Ouvrir ${this.selectedQuantity} caisses`
                : '🎰 Lancer la Roulette';
            spinBtn.classList.remove('btn-disabled');
            spinBtn.classList.add('btn-primary');


            // Vérifier si assez de caisses DU MÊME TYPE
            const selectedCaseType = window.LOOT_CONFIG?.getCaseTypeForLevel(this.selectedBox.level);
            const boxesOfSameType = this.currentInventory.filter(b => {
                const boxCaseType = window.LOOT_CONFIG?.getCaseTypeForLevel(b.level);
                return boxCaseType?.name === selectedCaseType?.name;
            });
            const qtyBtns = document.querySelectorAll('.qty-btn');
            qtyBtns.forEach(btn => {
                const qty = parseInt(btn.dataset.qty);
                btn.disabled = boxesOfSameType.length < qty;
            });


        } else {
            spinBtn.disabled = true;
            spinBtn.textContent = '⚠️ Sélectionnez une caisse';
            spinBtn.classList.remove('btn-primary');
            spinBtn.classList.add('btn-disabled');

            // Désactiver tous les boutons de quantité
            document.querySelectorAll('.qty-btn').forEach(btn => btn.disabled = true);
        }
    }

    /**
     * Ouvre une caisse (Mode x1)
     */
    async openBox(boxId, inventory) {
        if (this.isSpinning) return;

        const box = inventory.find(b => b.id === boxId);
        if (!box) {
            console.error('Caisse non trouvée:', boxId);
            return;
        }

        // S'assurer que la caisse est sélectionnée
        if (this.selectedBox?.id !== boxId) {
            this.selectBox(box);
        }

        // Lancer la roulette pour ouvrir la caisse
        this.spinWheelForBox(box);
    }

    /**
     * Logique centrale : Calcule le résultat d'une ouverture de caisse
     * (Séparé de l'animation pour réutilisation en Bulk)
     */
    calculateLootResult(levelTier) {
        const rarityCategories = window.lootBoxSystem?.baseRarityChances || window.lootBoxSystem?.rarityCategories || {};
        const winningRarity = window.lootBoxSystem?.selectRarity(levelTier) || Object.keys(rarityCategories)[0];
        const winningCategory = rarityCategories[winningRarity];

        // Utiliser la nouvelle structure LOOT_CONFIG ou l'ancienne
        const lootData = window.LOOT_CONFIG || window.LOOT_DATA;
        let winningItemData = null;
        let winningItemId = null;

        if (lootData && lootData.categories && lootData.categories[winningRarity]) {
            const categoryItems = lootData.categories[winningRarity].items;
            if (categoryItems && categoryItems.length > 0) {
                winningItemId = categoryItems[Math.floor(Math.random() * categoryItems.length)];

                // Récupérer les données complètes de l'item
                if (lootData.items && lootData.items[winningItemId]) {
                    winningItemData = lootData.items[winningItemId];
                } else if (lootData.messages && lootData.messages[winningItemId]) {
                    // Fallback pour l'ancien format
                    winningItemData = lootData.messages[winningItemId];
                }
            }
        }

        // Objet item gagnant
        let winningItemObj = {
            rarityName: winningRarity,
            itemName: winningRarity, // Fallback
            color: winningCategory.color,
            emoji: winningCategory.emoji || '📦',
            image: null,
            itemId: winningItemId,
            itemData: winningItemData
        };

        if (winningItemData) {
            // Essayer de récupérer le nom propre si disponible, sinon parser le texte
            if (winningItemData.name) {
                winningItemObj.itemName = winningItemData.name;
            } else if (winningItemData.text) {
                const match = winningItemData.text.match(/\*\*(.*?)\*\*/);
                winningItemObj.itemName = match ? match[1] : winningItemId;
            } else {
                winningItemObj.itemName = winningItemId;
            }

            // Image
            winningItemObj.image = winningItemData.image;
        }

        return winningItemObj;
    }

    /**
     * Lance la roulette pour ouvrir une caisse spécifique (Animation complète)
     */
    async spinWheelForBox(box) {
        if (this.isSpinning) return;

        this.isSpinning = true;
        const wheelItems = document.getElementById('horizontal-wheel-items');
        const spinBtn = document.getElementById('spin-horizontal-btn');

        if (!wheelItems) {
            this.isSpinning = false;
            return;
        }

        if (spinBtn) spinBtn.disabled = true;

        // Changer le fond aux couleurs de la caisse
        this.setCaseBackground(box.level);

        // 1. CALCULER LE GAGNANT
        const levelTier = box.level;
        const result = this.calculateLootResult(levelTier);

        // Si animations désactivées, aller directement au résultat
        if (!this.animationsEnabled) {
            // Sauvegarde immédiate
            if (result.itemId) {
                await this.saveLootedItem(result.itemId, result.rarityName, result.itemData);
            }
            await this.removeBoxFromServer(box.id);

            // Incrémenter le compteur de loot boxes ouvertes
            if (window.game && window.game.player && typeof window.game.player.incrementLootBoxCount === 'function') {
                window.game.player.incrementLootBoxCount();
            }

            // Afficher l'overlay (sans délai de roulette)
            this.showLootOverlay(result);
            this.finalizeSpin(box.level, box.id);
            return;
        }

        // 2. CONFIGURATION ET GÉNÉRATION (Si animation active)
        const CARD_WIDTH = 200;
        const GAP = 10;
        const ITEM_FULL_WIDTH = CARD_WIDTH + GAP;
        const TOTAL_CARDS = 150;
        const WINNER_INDEX = 130;

        wheelItems.innerHTML = '';
        wheelItems.style.transition = 'none';
        wheelItems.style.transform = 'translateX(0px)';

        const rarityCategories = window.lootBoxSystem?.baseRarityChances || window.lootBoxSystem?.rarityCategories || {};
        const lootData = window.LOOT_CONFIG || window.LOOT_DATA;

        for (let i = 0; i < TOTAL_CARDS; i++) {
            let itemObj;
            if (i === WINNER_INDEX) {
                itemObj = { name: result.rarityName, ...result };
            } else {
                const adjustedChances = window.lootBoxSystem.getAdjustedChances(levelTier);
                const categories = Object.keys(rarityCategories);
                const random = Math.random();
                let cumulative = 0;
                let selectedRarity = categories[0];
                for (let j = 0; j < categories.length; j++) {
                    cumulative += adjustedChances[j];
                    if (random <= cumulative) {
                        selectedRarity = categories[j];
                        break;
                    }
                }
                itemObj = this.getRandomItem(rarityCategories, lootData, selectedRarity);
            }
            wheelItems.appendChild(this.createCard(itemObj));
        }

        // 3. CALCUL POSITION
        const randomOffset = Math.floor(Math.random() * (CARD_WIDTH - 20)) + 10;
        const winnerPosition = ITEM_FULL_WIDTH * WINNER_INDEX;
        const finalPosition = -(winnerPosition + randomOffset);

        void wheelItems.offsetHeight; // Force reflow

        // 4. ANIMATION
        // 4. ANIMATION
        wheelItems.style.transition = 'transform 8s cubic-bezier(0.15, 1, 0.3, 1)';
        wheelItems.style.transform = `translateX(${finalPosition}px)`;

        // Lancer la boucle de mise à jour du fond
        const updateBackgroundLoop = () => {
            if (!this.isSpinning) return;

            const style = window.getComputedStyle(wheelItems);
            const matrix = new WebKitCSSMatrix(style.transform);
            const currentTranslate = matrix.m41;

            // (Anciennement: changement de couleur en fonction de l'item au centre - RETIRÉ)
            // Le fond garde maintenant la couleur de la caisse pendant tout le tirage

            requestAnimationFrame(updateBackgroundLoop);
        };
        requestAnimationFrame(updateBackgroundLoop);

        // 5. FIN
        setTimeout(async () => {
            this.showLootOverlay(result);

            if (result.itemId) {
                await this.saveLootedItem(result.itemId, result.rarityName, result.itemData);
            }
            await this.removeBoxFromServer(box.id);

            // Incrémenter le compteur de loot boxes ouvertes
            if (window.game && window.game.player && typeof window.game.player.incrementLootBoxCount === 'function') {
                window.game.player.incrementLootBoxCount();
            }

            this.finalizeSpin(box.level, box.id);

            // Restaurer le fond aux couleurs par défaut après le tirage
            this.restoreDefaultBackground();
        }, 8000);
    }

    /**
     * Ouvre plusieurs caisses en mode Bulk
     */
    async openBulkBoxes(boxes) {
        if (this.isSpinning || boxes.length === 0) return;
        this.isSpinning = true;

        const spinBtn = document.getElementById('spin-horizontal-btn');
        if (spinBtn) spinBtn.disabled = true;

        const results = [];
        const promises = [];

        // 1. Calculer et Lancer toutes les opérations (Sauvegarde + Suppression)
        console.log(`🚀 Ouverture groupée de ${boxes.length} caisses...`);

        for (const box of boxes) {
            const result = this.calculateLootResult(box.level);
            results.push(result);

            // Sauvegarder l'item
            if (result.itemId) {
                promises.push(this.saveLootedItem(result.itemId, result.rarityName, result.itemData));
            }
            // Supprimer la caisse
            promises.push(this.removeBoxFromServer(box.id));
        }

        // 2. Attendre que tout soit traité côté serveur (ou timeout)
        await Promise.all(promises);

        // Incrémenter le compteur de loot boxes ouvertes
        if (window.game && window.game.player && typeof window.game.player.incrementLootBoxCount === 'function') {
            for (let i = 0; i < boxes.length; i++) {
                window.game.player.incrementLootBoxCount();
            }
        }

        // 3. Afficher l'interface Bulk avec ou sans animation
        this.showBulkLootOverlay(results);

        // 4. Finaliser
        // Délai adaptatif selon l'animation
        const animationDelay = this.animationsEnabled ? (results.length * 500 + 2000) : 1000;

        // Note: finalizeSpin réactive le bouton. On le fait après l'affichage pour éviter les clics
        // On peut le faire plus tôt si on bloque l'UI, mais ici on va juste reset l'état
        setTimeout(() => {
            this.finalizeSpin(boxes[0].level, null);
        }, this.animationsEnabled ? 1000 : 500);
        // Le bouton sera réactivé par finalizeSpin, mais l'overlay bloquera l'interaction de toute façon
    }

    /**
     * Affiche l'overlay de résultat multiple (Bulk) avec animation de Slot
     */
    showBulkLootOverlay(results) {
        const overlay = document.getElementById('bulk-result-overlay');
        const grid = document.getElementById('loot-grid-reveal');
        if (!overlay || !grid) return;

        grid.innerHTML = '';
        overlay.classList.add('visible');

        // Créer les cartes (Initialement cachées ou en mode animation)
        results.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'loot-card-mini';

            // Contenu initial (peut être masqué ou placeholder si animé)
            // Si animé, on met un placeholder "?" et on lance l'animation
            if (this.animationsEnabled) {
                card.style.setProperty('--rarity-color', '#444'); // Gris par défaut
                card.classList.add('animating');
                card.innerHTML = `
                    <div class="mini-emoji">🎰</div>
                    <div class="mini-name">...</div>
                    <div class="mini-rarity">Rolling...</div>
                `;
            } else {
                // Affichage direct
                card.style.setProperty('--rarity-color', item.color);

                // Utiliser l'image si disponible
                let visualContent = `<div class="mini-emoji" style="color: ${item.color}">${item.emoji}</div>`;
                if (item.image) {
                    visualContent = `<img src="/img/cartes/${item.image}" class="mini-image" alt="${item.itemName}">`;
                }

                card.innerHTML = `
                    ${visualContent}
                    <div class="mini-name">${item.itemName}</div>
                    <div class="mini-rarity" style="border: 1px solid ${item.color}">${item.rarityName ? item.rarityName.split(' ')[0] : ''}</div>
                `;
                card.classList.add('revealed');
            }

            grid.appendChild(card);

            // Si animations activées : Lancer la séquence de "Slot Machine"
            if (this.animationsEnabled) {
                // Délai avant de stopper l'animation (augmente pour chaque carte)
                const stopDelay = 1000 + (index * 300); // 1s + 300ms par carte

                // Intervalle pour changer visuellement le contenu (effet slot)
                const emojis = ['🍎', '🍌', '🍒', '💎', '⚔️', '🛡️', '📦', '🔥', '⚡', '🎰'];
                const interval = setInterval(() => {
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    const emojiEl = card.querySelector('.mini-emoji');
                    if (emojiEl) emojiEl.textContent = randomEmoji;
                }, 100); // Change toutes les 100ms

                // Arrêter l'animation et révéler le vrai item
                setTimeout(() => {
                    clearInterval(interval);
                    card.classList.remove('animating');
                    card.style.setProperty('--rarity-color', item.color);

                    // Utiliser l'image si disponible
                    let visualContent = `<div class="mini-emoji" style="color: ${item.color}">${item.emoji}</div>`;
                    if (item.image) {
                        visualContent = `<img src="/img/cartes/${item.image}" class="mini-image" alt="${item.itemName}">`;
                    }

                    card.innerHTML = `
                        ${visualContent}
                        <div class="mini-name">${item.itemName}</div>
                        <div class="mini-rarity" style="border: 1px solid ${item.color}">${item.rarityName ? item.rarityName.split(' ')[0] : ''}</div>
                    `;

                    // Petit effet de pop
                    card.classList.add('revealed');

                    // Jouer son de slot stop
                }, stopDelay);
            }
        });
    }

    /**
     * Nettoyage après spin (Commun Single et Bulk)
     */
    finalizeSpin(levelTier, lastBoxId) {
        // Recharger l'inventaire réel
        setTimeout(() => {
            this.loadInventory().then(() => {
                const remainingBoxes = this.currentInventory.filter(b => b.level === levelTier);
                if (remainingBoxes.length === 0) {
                    this.selectedBox = null;
                    const tag = document.getElementById('selected-box-tag');
                    if (tag) tag.style.display = 'none';
                    // Reset quantité à 1 car plus de caisses
                    this.selectedQuantity = 1;
                    document.querySelectorAll('.qty-btn').forEach(b => b.classList.remove('active'));
                    const btn1 = document.querySelector('.qty-btn[data-qty="1"]');
                    if (btn1) btn1.classList.add('active');

                } else {
                    this.selectedBox = remainingBoxes[0];
                }

                this.isSpinning = false;
                this.updateSpinButton();
            });
        }, 1000);
    }

    createCard(itemObj) {
        const card = document.createElement('div');
        card.className = 'horizontal-wheel-item';
        card.dataset.color = itemObj.color; // Pour le shader
        card.style.borderColor = itemObj.color;
        card.style.setProperty('--rarity-color', itemObj.color);

        // Utiliser l'image si disponible
        let visualContent = `<div class="wheel-item-emoji" style="color: ${itemObj.color};">${itemObj.emoji}</div>`;
        if (itemObj.image) {
            visualContent = `<img src="/img/cartes/${itemObj.image}" class="wheel-item-image" alt="${itemObj.itemName}">`;
        }

        card.innerHTML = `
            ${visualContent}
            <div class="wheel-item-text">${itemObj.itemName || itemObj.name.split(' ')[0]}</div>
        `;
        return card;
    }

    initTrack() {
        const wheelItems = document.getElementById('horizontal-wheel-items');
        if (!wheelItems) return;

        wheelItems.innerHTML = '';
        wheelItems.style.transition = 'none';
        wheelItems.style.transform = 'translateX(0px)';

        const rarityCategories = window.lootBoxSystem?.baseRarityChances || window.lootBoxSystem?.rarityCategories || {};
        const lootData = window.LOOT_CONFIG || window.LOOT_DATA;

        for (let i = 0; i < 10; i++) {
            const item = this.getRandomItem(rarityCategories, lootData);
            wheelItems.appendChild(this.createCard(item));
        }
    }

    getRandomItem(rarityCategories, lootData, forcedRarity = null) {
        const categories = Object.keys(rarityCategories);
        const rarity = forcedRarity || categories[Math.floor(Math.random() * categories.length)];
        const category = rarityCategories[rarity];

        let itemData = null;
        let itemName = rarity; // Fallback

        if (lootData && lootData.categories && lootData.categories[rarity]) {
            const items = lootData.categories[rarity].items;
            if (items && items.length > 0) {
                const randomItemId = items[Math.floor(Math.random() * items.length)];

                if (lootData.items && lootData.items[randomItemId]) {
                    itemData = lootData.items[randomItemId];
                } else if (lootData.messages && lootData.messages[randomItemId]) {
                    itemData = lootData.messages[randomItemId];
                }

                if (itemData) {
                    if (itemData.name) {
                        itemName = itemData.name;
                    } else if (itemData.text) {
                        const match = itemData.text.match(/\*\*(.*?)\*\*/);
                        itemName = match ? match[1] : randomItemId;
                    }
                }
            }
        }

        return {
            name: rarity,
            itemName: itemName,
            color: category.color,
            emoji: category.emoji || '📦',
            image: itemData ? itemData.image : null
        };
    }

    showLootOverlay(item) {
        const overlay = document.getElementById('loot-result-overlay');
        if (!overlay) return;

        const container = overlay.querySelector('.loot-card-reveal');
        if (!container) return;

        overlay.style.setProperty('--rarity-color', item.color);
        overlay.style.setProperty('--glow-color', item.color);

        // Utiliser l'image si disponible
        let visualContent = `<div class="reveal-emoji" style="color: ${item.color}">${item.emoji}</div>`;
        if (item.image) {
            visualContent = `<img src="/img/cartes/${item.image}" class="reveal-image" alt="${item.itemName}">`;
        }

        container.innerHTML = `
            ${visualContent}
            <div class="reveal-name">${item.itemName}</div>
            <div class="reveal-rarity" style="color: ${item.color}; border-color: ${item.color}">${item.rarityName ? item.rarityName.split(' ')[0] : item.name.split(' ')[0]}</div>
        `;

        overlay.classList.add('visible');
    }

    closeLootOverlay(id = 'loot-result-overlay') {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    updateProbabilities(levelTier = 10) {
        const container = document.getElementById('horizontal-probabilities');
        if (!container || !window.lootBoxSystem) return;

        const rarityCategories = window.lootBoxSystem.baseRarityChances || window.lootBoxSystem.rarityCategories;
        const categories = Object.keys(rarityCategories);
        const adjustedChances = window.lootBoxSystem.getAdjustedChancesForLevel(levelTier);

        let html = `
            <div class="probabilities-header" style="text-align: center; color: #ffd700; margin-bottom: 10px; font-weight: bold;">Chances de Loot (Niveau ${levelTier})</div>
            <table class="probabilities-table">
                <thead>
                    <tr>
                        <th>Rareté</th>
                        <th style="text-align: right;">Chance</th>
                    </tr>
                </thead>
                <tbody>
        `;

        categories.forEach((rarity, index) => {
            const category = rarityCategories[rarity];
            const chance = adjustedChances[index];
            const percentage = (chance * 100).toFixed(1);

            html += `
                <tr style="color: ${category.color}">
                    <td>
                        <span class="prob-emoji">${category.emoji || '📦'}</span>
                        <span class="prob-name">${category.name || rarity.split(' ')[0]}</span>
                    </td>
                    <td class="prob-chance">${percentage}%</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    async removeBoxFromServer(boxId) {
        if (!window.onlineManager || !window.onlineManager.socket || !window.onlineManager.isAuthenticated) {
            return;
        }

        return new Promise((resolve) => {
            const socket = window.onlineManager.socket;
            const timeout = setTimeout(() => {
                socket.off('loot_box_removed', onRemoved);
                resolve();
            }, 5000);

            const onRemoved = (data) => {
                clearTimeout(timeout);
                socket.off('loot_box_removed', onRemoved);
                console.log(`✅ Caisse ${data.boxId} supprimée`);
                resolve();
            };

            socket.once('loot_box_removed', onRemoved);
            socket.emit('remove_loot_box', { boxId });
        });
    }

    async saveLootedItem(itemId, rarity, itemData) {
        if (!window.onlineManager || !window.onlineManager.socket || !window.onlineManager.isAuthenticated) {
            return;
        }

        return new Promise((resolve) => {
            const socket = window.onlineManager.socket;
            const timeout = setTimeout(() => {
                socket.off('loot_item_saved', onSaved);
                resolve();
            }, 5000);

            const onSaved = (data) => {
                clearTimeout(timeout);
                socket.off('loot_item_saved', onSaved);
                console.log(`✅ Item ${itemId} sauvegardé`);
                resolve();
            };

            socket.once('loot_item_saved', onSaved);
            socket.emit('save_loot_item', {
                itemId: itemId,
                rarity: rarity,
                itemData: itemData
            });
        });
    }
    /**
     * Obtient les couleurs de fond pour une caisse basée sur son niveau
     */
    getCaseBackgroundColors(level) {
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16) / 255,
                g: parseInt(result[2], 16) / 255,
                b: parseInt(result[3], 16) / 255
            } : null;
        };

        const darken = (rgb, factor = 0.4) => ({
            r: rgb.r * factor,
            g: rgb.g * factor,
            b: rgb.b * factor
        });

        const lighten = (rgb, factor = 0.6) => ({
            r: Math.min(1, rgb.r * (1 + factor)),
            g: Math.min(1, rgb.g * (1 + factor)),
            b: Math.min(1, rgb.b * (1 + factor))
        });

        let baseColor;
        // Couleurs selon les caisses
        if (level >= 1 && level <= 39) {
            baseColor = hexToRgb('#b0c3d9'); // Consumer Grade
        } else if (level >= 40 && level <= 49) {
            baseColor = hexToRgb('#5e98d9'); // Industrial Grade
        } else if (level >= 50 && level <= 59) {
            baseColor = hexToRgb('#4b69ff'); // Mil-spec
        } else if (level >= 60 && level <= 69) {
            baseColor = hexToRgb('#74388a'); // Delta (violet foncé)
        } else if (level >= 70 && level <= 79) {
            baseColor = hexToRgb('#8a3883'); // Spectrum (violet/rose)
        } else if (level >= 80 && level <= 89) {
            baseColor = hexToRgb('#e506bc'); // Clutch (rose/magenta)
        } else if (level >= 90 && level <= 99) {
            baseColor = hexToRgb('#eb4b4b'); // Covert (rouge)
        } else {
            baseColor = hexToRgb('#e4ae39'); // Melee / Gold
        }

        return {
            colour_1: lighten(baseColor, 0.3),
            colour_2: baseColor,
            colour_3: darken(baseColor, 0.3)
        };
    }

    /**
     * Change le fond aux couleurs de la caisse pendant le tirage
     */
    setCaseBackground(level) {
        if (!window.setShaderColors) return;

        const colors = this.getCaseBackgroundColors(level);
        window.setShaderColors(colors.colour_1, colors.colour_2, colors.colour_3);
    }

    /**
     * Restaure le fond aux couleurs par défaut
     */
    restoreDefaultBackground() {
        if (!window.setShaderColors) return;

        // Couleurs par défaut (rouge/noir)
        window.setShaderColors(
            { r: 0.58, g: 0.07, b: 0.07 }, // colour_1
            { r: 0.15, g: 0.15, b: 0.15 }, // colour_2
            { r: 0.05, g: 0.05, b: 0.05 }  // colour_3
        );
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gamblingPage = new GamblingPage();
});