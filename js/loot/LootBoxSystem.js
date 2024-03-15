/**
 * Système de loot box inspiré de CS:GO
 * Chaque tranche de niveau (3, 10, 20, 30, etc.) donne entre 1-N caisses
 * Les probabilités sont basées sur la tranche de niveau
 */

class LootBoxSystem {
    constructor() {
        // Probabilités de base (fallback ou chargées depuis LOOT_CONFIG)
        if (typeof LOOT_CONFIG !== 'undefined' && LOOT_CONFIG.categories) {
            this.baseRarityChances = LOOT_CONFIG.categories;
        } else {
            console.warn("⚠️ LOOT_CONFIG non trouvé, utilisation des valeurs par défaut");
            this.baseRarityChances = {
                "consumer": {
                    name: "Consumer Grade",
                    color: "#b0c3d9",
                    chance: 0.394,
                    emoji: "⚪"
                },
                "industrial": {
                    name: "Industrial Grade",
                    color: "#5e98d9",
                    chance: 0.295,
                    emoji: "🔵"
                },
                "milspec": {
                    name: "Mil-spec",
                    color: "#4b69ff",
                    chance: 0.148,
                    emoji: "🔷"
                },
                "restricted": {
                    name: "Restricted",
                    color: "#8847ff",
                    chance: 0.069,
                    emoji: "🟣"
                },
                "classified": {
                    name: "Classified",
                    color: "#d32ce6",
                    chance: 0.029,
                    emoji: "🟪"
                },
                "covert": {
                    name: "Covert",
                    color: "#eb4b4b",
                    chance: 0.020,
                    emoji: "🔴"
                },
                "melee": {
                    name: "Melee",
                    color: "#e4ae39",
                    chance: 0.005,
                    emoji: "🟡"
                }
            };
        }

        this.inventory = []; // Inventaire réel chargé depuis le serveur
        this.isSpinning = false;
        this.sessionLootCount = {}; // Compteur de caisses par niveau pour la session (temporaire)
        this.pendingLootEvent = null; // Stocke les données du loot en attente de tirage
    }

    /**
     * Retourne les catégories de rareté (pour compatibilité)
     */
    get rarityCategories() {
        return this.baseRarityChances;
    }

    /**
     * Calcule le nombre de caisses à générer selon la tranche de niveau
     * Chaque tranche donne entre 1 et N caisses
     * Gère mathématiquement tous les niveaux, y compris > 200
     */
    calculateLootBoxCount(levelTier) {
        if (levelTier < 3) return 0;

        // Définir le nombre maximum de caisses par tranche
        const maxCountByTier = {
            3: 5,   // Niveau 3: 1-5 caisses
            10: 4,  // Niveau 10: 1-4 caisses
            20: 3,  // Niveau 20: 1-3 caisses
            30: 3,  // Niveau 30: 1-3 caisses
            40: 2,  // Niveau 40: 1-2 caisses
            50: 2   // Niveau 50+: 1-2 caisses (par défaut pour toutes les tranches >= 50)
        };

        // Pour les tranches >= 50, utiliser 2 caisses max
        const maxCount = maxCountByTier[levelTier] || 2;

        // Générer un nombre aléatoire entre 1 et maxCount
        return Math.floor(Math.random() * maxCount) + 1;
    }

    /**
     * Génère un niveau de caisse avec 10% de chance d'upgrade
     * @param {number} baseLevel - Niveau de base du joueur
     * @returns {number} - Niveau de caisse (potentiellement upgradé)
     */
    generateCaseLevelWithUpgrade(baseLevel) {
        const upgradeChance = Math.random();

        if (upgradeChance < 0.10) { // 10% chance
            // Essayer d'upgrade vers la catégorie supérieure
            const baseTier = this.calculateLevelTier(baseLevel);
            const caseType = this.getCaseTypeForLevel(baseTier);

            // Trouver la prochaine catégorie
            if (typeof LOOT_CONFIG !== 'undefined' && LOOT_CONFIG.caseTypes) {
                const caseTypesArray = Object.values(LOOT_CONFIG.caseTypes);
                const currentIndex = caseTypesArray.findIndex(ct => ct.name === caseType.name);

                if (currentIndex >= 0 && currentIndex < caseTypesArray.length - 1) {
                    const nextCaseType = caseTypesArray[currentIndex + 1];
                    console.log(`🎁 UPGRADE! ${caseType.name} → ${nextCaseType.name}`);
                    return nextCaseType.levelRange[0]; // Utiliser le premier niveau de la catégorie supérieure
                }
            }
        }

        return this.calculateLevelTier(baseLevel); // Pas d'upgrade, retourner le niveau normal
    }

    /**
     * Génère plusieurs caisses de la même tranche de niveau
     */
    generateLootBoxes(levelTier, count) {
        const lootBoxes = [];
        for (let i = 0; i < count; i++) {
            lootBoxes.push(this.generateLootBox(levelTier));
        }
        return lootBoxes;
    }

    /**
     * Calcule les probabilités ajustées en fonction du niveau (basé sur les case types)
     * Utilise les probabilités prédéfinies pour chaque type de caisse
     */
    getAdjustedChances(level) {
        if (typeof LOOT_CONFIG === 'undefined' || !LOOT_CONFIG.getCaseTypeForLevel) {
            console.warn('⚠️ LOOT_CONFIG.getCaseTypeForLevel not available, using fallback');
            return Object.values(this.baseRarityChances).map(cat => cat.chance);
        }

        const caseType = LOOT_CONFIG.getCaseTypeForLevel(level);
        const probabilities = caseType.probabilities;

        // Convert percentages to decimals (0-1)
        return LOOT_CONFIG.normalizeProbabilities(probabilities);
    }

    /**
     * Sélectionne une rareté en fonction du niveau (utilise les probabilités du case type)
     */
    selectRarity(level) {
        const categories = Object.keys(this.baseRarityChances);
        const adjustedChances = this.getAdjustedChances(level);

        // Générer un nombre aléatoire entre 0 et 1
        const random = Math.random();

        // Trouver la catégorie correspondante
        let cumulative = 0;
        for (let i = 0; i < categories.length; i++) {
            cumulative += adjustedChances[i];
            if (random <= cumulative) {
                return categories[i];
            }
        }

        // Fallback (ne devrait jamais arriver)
        return categories[0];
    }

    /**
     * Génère une caisse avec une rareté basée sur le niveau
     * Inclut maintenant le type de caisse et son image
     */
    generateLootBox(levelTier) {
        const rarity = this.selectRarity(levelTier);
        const category = this.baseRarityChances[rarity];
        const caseType = this.getCaseTypeForLevel(levelTier);

        return {
            id: `lootbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            rarity: rarity,
            color: category.color,
            emoji: category.emoji || '📦',
            level: levelTier,
            caseType: caseType.name, // Nom du type de caisse
            caseImage: caseType.image, // Image de la caisse
            caseImageLarge: caseType.imageLarge, // Image large
            obtainedAt: Date.now()
        };
    }

    /**
     * Calcule la tranche de niveau et retourne le nom de la caisse correspondante
     * Utilise le système de case types basé sur les tranches de niveau
     */
    calculateLevelTier(level) {
        if (typeof level !== 'number' || level < 0) {
            return 0;
        }

        // Niveau 3 est une tranche spéciale
        if (level === 3) {
            return 3;
        }

        // Pour les niveaux >= 10, la tranche est calculée mathématiquement
        return Math.floor(level / 10) * 10;
    }

    /**
     * Obtient le type de caisse pour un niveau donné
     * @param {number} level - Niveau du joueur
     * @returns {object} - Case type configuration
     */
    getCaseTypeForLevel(level) {
        if (typeof LOOT_CONFIG !== 'undefined' && LOOT_CONFIG.getCaseTypeForLevel) {
            return LOOT_CONFIG.getCaseTypeForLevel(level);
        }
        // Fallback
        return {
            name: "Alpha Case (1-39)",
            levelRange: [1, 39],
            image: "/img/case/Caisse_icons/alpha_case.png",
            probabilities: [45.908, 33.932, 16.467, 1.996, 0.898, 0.499, 0.299]
        };
    }

    /**
     * Vérifie si le niveau actuel correspond à un niveau de loot (fin de tranche)
     * Niveaux : 3, 10, 20, 30, 40...
     */
    isLootLevel(level) {
        if (typeof level !== 'number' || level < 0) return false;
        if (level === 3) return true;
        // Pour les autres niveaux, doit être un multiple de 10
        if (level >= 10 && level % 10 === 0) return true;
        return false;
    }

    /**
     * Vérifie si le joueur doit recevoir des caisses après avoir battu un boss
     * Déclenche aux tranches : 3, 10, 20, 30, 40, 50, etc.
     * Gère mathématiquement tous les niveaux, y compris > 200
     */
    shouldReceiveLootBox(level, previousLevel) {
        // Validation des paramètres
        if (previousLevel === null || previousLevel === undefined || typeof level !== 'number' || typeof previousLevel !== 'number') {
            return false;
        }

        // Calculer les tranches de manière mathématique
        const currentTier = this.calculateLevelTier(level);
        const previousTier = this.calculateLevelTier(previousLevel);

        // Si on passe à une nouvelle tranche, donner des caisses
        const shouldReceive = currentTier !== previousTier && currentTier >= 3;
        if (shouldReceive) {
            console.log(`🎁 Loot déclenché ! Tranche ${currentTier} (niveau ${level})`);
        }
        return shouldReceive;
    }

    /**
     * Déclenche l'événement de loot : AUTOMATIQUE et NON-BLOQUANT
     * Génère et affiche immédiatement les caisses en ligne horizontale
     */
    async triggerLootEvent(level) {
        if (typeof level !== 'number' || level < 0) {
            console.error('triggerLootEvent: niveau invalide', level);
            return;
        }

        // Déterminer la tranche de niveau
        const levelTier = this.calculateLevelTier(level);

        // Calculer le nombre de caisses automatiquement
        const count = this.calculateLootBoxCount(levelTier);

        console.log(`🎁 Loot Event: Niveau ${level} → ${count} caisse(s)`);

        try {
            // Générer les caisses avec possibilité d'upgrade
            const lootBoxes = [];
            for (let i = 0; i < count; i++) {
                const caseLevelWithUpgrade = this.generateCaseLevelWithUpgrade(level);
                const box = this.generateLootBox(caseLevelWithUpgrade);
                lootBoxes.push(box);
            }

            //Sauvegarder côté serveur
            await this.saveLootBoxesToServer(lootBoxes);

            // Grouper les caisses par type pour stacker les notifications
            const groupedBoxes = {};
            lootBoxes.forEach(box => {
                const caseType = this.getCaseTypeForLevel(box.level);
                const key = caseType.name;
                if (!groupedBoxes[key]) {
                    groupedBoxes[key] = {
                        caseType: caseType,
                        count: 0,
                        firstBox: box
                    };
                }
                groupedBoxes[key].count++;
            });

            // Afficher les notifications groupées
            Object.values(groupedBoxes).forEach((group, index) => {
                setTimeout(() => {
                    this.showHorizontalLootNotification(group.firstBox, index, group.count);
                }, index * 300); // Décalage de 300ms entre chaque ligne
            });

            // Mettre à jour l'inventaire
            await this.loadInventory();

            console.log(`✅ ${count} caisse(s) ajoutée(s) à l'inventaire`);

            // PAS de pause du jeu - le joueur peut continuer à jouer

        } catch (error) {
            console.error('Erreur dans triggerLootEvent:', error);
        }
    }

    /**
     * Affiche une notification horizontale pour un loot
     * S'affiche au-dessus de la zone de combat avec animation
     * Couleur basée sur le tier de la caisse, pas sur la rareté du drop
     * @param {object} box - La caisse lootée
     * @param {number} stackIndex - Index de la ligne (pour empiler)
     * @param {number} count - Nombre de caisses du même type (pour le multiplicateur)
     */
    showHorizontalLootNotification(box, stackIndex = 0, count = 1) {
        const notification = document.createElement('div');
        notification.className = 'horizontal-loot-notification';

        // Obtenir le type de caisse
        const caseType = this.getCaseTypeForLevel(box.level);

        // Couleur basée sur le TIER de la caisse (pas la rareté du drop)
        const caseColor = this.getCaseColor(caseType.name);

        // Positionner en fonction de l'index pour empiler
        const topOffset = 120 + (stackIndex * 50); // 50px entre chaque ligne (réduit)
        notification.style.top = `${topOffset}px`;
        notification.style.setProperty('--case-color', caseColor);

        // Affichage simplifié en une ligne
        notification.innerHTML = `
            <div class="loot-notif-icon">
                <img src="${caseType.image}" alt="${caseType.name}" />
            </div>
            <div class="loot-notif-title">${caseType.name}</div>
            <div class="loot-notif-multiplier">
                <span class="multiplier-label">x${count}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Animation d'apparition
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Supprimer après 5 secondes
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 5000);
    }

    /**
     * Retourne la couleur associée à un type de caisse
     * @param {string} caseName - Nom du type de caisse
     * @returns {string} - Code couleur hexadécimal
     */
    getCaseColor(caseName) {
        const caseColors = {
            "Alpha Case (1-39)": "#a0a0a0",      // Gris
            "Bravo Case (40-49)": "#6b8cae",     // Bleu clair
            "Chroma Case (50-59)": "#5d76cb",    // Bleu
            "Delta case (60-69)": "#8a6bbd",     // Violet
            "Spectrum Case (70-79)": "#c54bc9",  // Magenta
            "Clutch Case (80-89)": "#d74b4b",    // Rouge
            "Red Case (90-99)": "#eb4b4b",       // Rouge vif
            "Prisma Edition (100+)": "#d4af37"   // Or
        };
        return caseColors[caseName] || "#ffd700"; // Fallback or
    }

    /**
     * Sauvegarde les caisses côté serveur via Socket.io
     */
    async saveLootBoxesToServer(lootBoxes) {
        if (!window.onlineManager || !window.onlineManager.socket || !window.onlineManager.isAuthenticated) {
            console.warn('⚠️ Pas de connexion Socket.io, impossible de sauvegarder les caisses');
            return;
        }

        return new Promise((resolve, reject) => {
            const socket = window.onlineManager.socket;

            // Timeout après 5 secondes
            const timeout = setTimeout(() => {
                reject(new Error('Timeout lors de la sauvegarde des caisses'));
            }, 5000);

            // Écouter la réponse
            const onSaved = (data) => {
                clearTimeout(timeout);
                socket.off('loot_boxes_saved', onSaved);
                socket.off('loot_error', onError);
                console.log(`✅ ${data.count} caisse(s) sauvegardée(s) côté serveur`);
                resolve(data);
            };

            const onError = (error) => {
                clearTimeout(timeout);
                socket.off('loot_boxes_saved', onSaved);
                socket.off('loot_error', onError);
                console.error('Erreur lors de la sauvegarde des caisses:', error);
                reject(new Error(error.message || 'Erreur lors de la sauvegarde'));
            };

            socket.once('loot_boxes_saved', onSaved);
            socket.once('loot_error', onError);

            // Envoyer les caisses
            socket.emit('save_loot_boxes', { lootBoxes });
        });
    }

    /**
     * Affiche une notification de loot
     */
    showLootNotification(levelTier, count, lootBoxes) {
        // Créer un pop-up simple
        const notification = document.createElement('div');
        notification.className = 'loot-notification mini'; // Ajout de la classe mini

        // Déterminer l'affichage de la tranche de niveau
        // Afficher uniquement le niveau de base (ex: Niveau 10 au lieu de Niveau 10-19)
        const tierDisplay = `Niveau ${levelTier}`;

        notification.innerHTML = `
            <div class="loot-notification-content">
                <div class="loot-notification-icon">🎁</div>
                <div class="loot-notification-details">
                    <div class="loot-notification-title">+${count} Caisses</div>
                    <div class="loot-notification-subtitle">${tierDisplay}</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animation d'apparition
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Supprimer après 3 secondes
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Met à jour le tableau récapitulatif des caisses lootées
     * Affiche les caisses de l'inventaire réel (persistantes) groupées par type de caisse
     * Avec icônes et rétractablemin-height
     */
    updateLootSummary() {
        const summaryContainer = document.getElementById('loot-summary');
        if (!summaryContainer) return;

        // Utiliser l'inventaire réel (persistant) plutôt que le compteur de session
        if (!this.inventory || this.inventory.length === 0) {
            summaryContainer.innerHTML = '<div class="empty-summary">Aucune caisse</div>';
            return;
        }

        // Grouper les caisses par TYPE DE CAISSE (pas par niveau)
        const caseGroups = {};
        this.inventory.forEach(box => {
            const caseType = this.getCaseTypeForLevel(box.level);
            const key = caseType.name; // Utiliser le nom comme clé

            if (!caseGroups[key]) {
                caseGroups[key] = {
                    caseType: caseType,
                    count: 0
                };
            }
            caseGroups[key].count++;
        });

        // Trier par ordre de niveau (en utilisant levelRange[0])
        const sortedGroups = Object.values(caseGroups)
            .sort((a, b) => a.caseType.levelRange[0] - b.caseType.levelRange[0]);

        if (sortedGroups.length === 0) {
            summaryContainer.innerHTML = '<div class="empty-summary">Aucune caisse</div>';
            return;
        }

        // Header avec bouton de collapse
        let html = `
            <div class="summary-header-wrapper">
                <div class="summary-header">📦 Mes Caisses</div>
                <button class="summary-toggle-btn" onclick="window.lootBoxSystem.toggleSummary()">
                    <span class="toggle-icon">−</span>
                </button>
            </div>
            <div class="summary-content" id="loot-summary-content">
        `;

        sortedGroups.forEach(group => {
            html += `
                <div class="summary-item">
                    <img src="${group.caseType.image}" class="summary-icon" alt="${group.caseType.name}" />
                    <span class="summary-level">${group.caseType.name}</span>
                    <span class="summary-count">${group.count}</span>
                </div>
            `;
        });

        // Ajouter le total
        const total = this.inventory.length;
        html += `
                <div class="summary-item summary-total" style="border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 8px; padding-top: 8px;">
                    <span class="summary-level" style="font-weight: 700;">Total</span>
                    <span class="summary-count" style="color: #eac058; font-weight: 700;">${total}</span>
                </div>
            </div>
        `;

        summaryContainer.innerHTML = html;
    }

    /**
     * Toggle summary visibility
     */
    toggleSummary() {
        const content = document.getElementById('loot-summary-content');
        const toggleBtn = document.querySelector('.summary-toggle-btn .toggle-icon');

        if (content && toggleBtn) {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? 'block' : 'none';
            toggleBtn.textContent = isCollapsed ? '−' : '+';
        }
    }

    /**
     * Réinitialise le compteur de session (appelé au restart)
     */
    resetSessionLootCount() {
        this.sessionLootCount = {};
        this.updateLootSummary();
    }

    /**
     * Charge l'inventaire depuis le serveur via Socket.io
     */
    async loadInventory() {
        if (!window.onlineManager || !window.onlineManager.socket || !window.onlineManager.isAuthenticated) {
            this.inventory = [];
            this.updateLootSummary();
            return;
        }

        return new Promise((resolve) => {
            const socket = window.onlineManager.socket;

            // Timeout après 5 secondes
            const timeout = setTimeout(() => {
                socket.off('loot_inventory', onInventory);
                socket.off('loot_error', onError);
                console.warn('⚠️ Timeout lors du chargement de l\'inventaire');
                this.inventory = [];
                this.updateLootSummary();
                resolve();
            }, 5000);

            // Écouter la réponse
            const onInventory = (data) => {
                clearTimeout(timeout);
                socket.off('loot_inventory', onInventory);
                socket.off('loot_error', onError);

                if (Array.isArray(data.inventory)) {
                    this.inventory = data.inventory;
                    this.updateInventoryDisplay();
                    this.updateLootSummary();
                    console.log(`✅ Inventaire chargé: ${this.inventory.length} caisses`);
                } else {
                    this.inventory = [];
                    this.updateLootSummary();
                }
                resolve();
            };

            const onError = (error) => {
                clearTimeout(timeout);
                socket.off('loot_inventory', onInventory);
                socket.off('loot_error', onError);
                console.error('Erreur lors du chargement de l\'inventaire:', error);
                this.inventory = [];
                this.updateLootSummary();
                resolve();
            };

            socket.once('loot_inventory', onInventory);
            socket.once('loot_error', onError);

            // Demander l'inventaire
            socket.emit('get_loot_inventory');
        });
    }

    /**
     * Met à jour l'affichage de l'inventaire
     */
    updateInventoryDisplay() {
        const inventoryContainer = document.getElementById('loot-inventory');
        if (!inventoryContainer) return;

        if (this.inventory.length === 0) {
            inventoryContainer.innerHTML = '<div class="empty-inventory">Aucune caisse</div>';
            return;
        }

        // Grouper par rareté
        const grouped = {};
        this.inventory.forEach(box => {
            if (!grouped[box.rarity]) {
                grouped[box.rarity] = [];
            }
            grouped[box.rarity].push(box);
        });

        let html = '';
        Object.keys(grouped).forEach(rarity => {
            const boxes = grouped[rarity];
            const category = this.baseRarityChances[rarity];
            if (!category) return;
            html += `
                <div class="inventory-rarity-group">
                    <div class="rarity-header" style="color: ${category.color}">
                        ${category.emoji || '📦'} ${category.name || rarity} (${boxes.length})
                    </div>
                    <div class="rarity-boxes">
                        ${boxes.map(box => `
                            <div class="loot-box-item" style="border-color: ${category.color}">
                                <div class="loot-box-emoji">${category.emoji || '📦'}</div>
                                <div class="loot-box-level">Niveau ${box.level}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        inventoryContainer.innerHTML = html;
    }

    /**
     * Calcule les probabilités de base (sans ajustement)
     */
    getBaseChances() {
        return Object.values(this.baseRarityChances).map(cat => cat.chance);
    }

    /**
     * Calcule les probabilités ajustées pour une tranche de niveau donnée (méthode publique)
     */
    getAdjustedChancesForLevel(levelTier) {
        return this.getAdjustedChances(levelTier);
    }

    /**
     * Met à jour l'affichage des probabilités pour un niveau donné
     * Affiche maintenant le nom du type de caisse
     */
    updateProbabilitiesDisplay(level) {
        // Chercher le bon conteneur (peut être loot-probabilities ou horizontal-probabilities)
        let probabilitiesContainer = document.getElementById('horizontal-probabilities');
        if (!probabilitiesContainer) {
            probabilitiesContainer = document.getElementById('loot-probabilities');
        }
        if (!probabilitiesContainer) return;

        const adjustedChances = this.getAdjustedChances(level);
        const categories = Object.keys(this.baseRarityChances);
        const caseType = this.getCaseTypeForLevel(level);

        // Chercher ou créer le wrapper
        let wrapper = probabilitiesContainer.querySelector('.probabilities-header-wrapper');
        if (!wrapper) {
            // Si pas de wrapper, créer la structure complète
            wrapper = document.createElement('div');
            wrapper.className = 'probabilities-header-wrapper';
            wrapper.innerHTML = `
                <div class="probabilities-header"></div>
                <a href="/probability-charts.html" class="info-btn" title="Voir les graphiques détaillés" target="_blank">
                    <span class="info-icon">ℹ</span>
                </a>
            `;
            probabilitiesContainer.innerHTML = '';
            probabilitiesContainer.appendChild(wrapper);
        }

        // Mettre à jour le header
        const header = wrapper.querySelector('.probabilities-header');
        if (header) {
            header.textContent = `Chances de Loot - ${caseType.name}`;
        }

        // Obtenir les probabilités de base (Alpha Case) pour comparaison
        const alphaProbs = window.LOOT_CONFIG?.caseTypes["Alpha Case (1-39)"]?.probabilities || [];

        // Construire les items de probabilité
        let itemsHTML = '';
        categories.forEach((rarity, index) => {
            const category = this.baseRarityChances[rarity];
            const chance = adjustedChances[index];
            const percentage = (chance * 100).toFixed(3);

            // Calculer l'évolution par rapport à Alpha Case
            let evolutionHTML = '';
            if (alphaProbs.length > index) {
                const alphaProb = alphaProbs[index];
                const currentProb = chance * 100;
                const diff = currentProb - alphaProb;

                if (Math.abs(diff) > 0.01) { // Seulement si différence significative
                    const sign = diff > 0 ? '+' : '';
                    const color = diff > 0 ? '#4ade80' : '#f87171'; // Vert si augmentation, rouge si diminution
                    evolutionHTML = `<span class="probability-evolution" style="color: ${color}; font-size: 0.85em; margin-left: 5px;">(${sign}${diff.toFixed(2)}%)</span>`;
                }
            }

            itemsHTML += `
                <div class="probability-item" style="color: ${category.color}">
                    <span class="probability-emoji">${category.emoji || '📦'}</span>
                    <span class="probability-name">${category.name || rarity}</span>
                    <span class="probability-chance">${percentage}%${evolutionHTML}</span>
                </div>
            `;
        });

        // Ajouter ou mettre à jour les items après le wrapper
        let itemsContainer = probabilitiesContainer.querySelector('.probability-items-container');
        if (!itemsContainer) {
            itemsContainer = document.createElement('div');
            itemsContainer.className = 'probability-items-container';
            probabilitiesContainer.appendChild(itemsContainer);
        }
        itemsContainer.innerHTML = itemsHTML;
    }

    /**
     * Initialise le système (charge l'inventaire depuis le serveur)
     * L'inventaire est lié à l'utilisateur et persiste même après déconnexion/reconnexion
     */
    async init() {
        // Charger l'inventaire depuis le serveur (lié à l'utilisateur, pas à la session)
        // L'inventaire sera aussi chargé après l'authentification dans OnlineManager
        const token = localStorage.getItem('auth_token');
        if (token) {
            await this.loadInventory();
        }
    }

    /**
     * Affiche le modal d'inventaire
     */
    showInventory() {
        this.updateInventoryDisplay();
        const modal = document.getElementById('loot-inventory-modal');
        if (modal) {
            AnimationUtils.showModal(modal);
        }
    }

    /**
     * Cache la roulette de loot (pour compatibilité avec l'ancien code)
     */
    hideWheel() {
        // La roulette n'est plus affichée sur la page principale
        // Cette méthode existe pour éviter les erreurs
        const wheelContainer = document.getElementById('loot-wheel-container');
        if (wheelContainer) {
            wheelContainer.style.display = 'none';
        }
    }
}

// Instance globale
if (typeof window !== 'undefined') {
    window.LootBoxSystem = LootBoxSystem;
    // Créer une instance globale
    window.lootBoxSystem = new LootBoxSystem();
}
