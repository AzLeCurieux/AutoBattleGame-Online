// Point d'entrée principal du jeu
let game;
let onlineManager;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎮 Game initialization started');

    // Initialize online manager first
    onlineManager = new OnlineManager();
    window.onlineManager = onlineManager;

    // Initialiser le jeu
    game = new Game();

    // Rendre le jeu global pour les améliorations et card effects
    window.game = game;
    console.log('✅ window.game set:', !!window.game);

    // Connect game with online manager
    game.setOnlineManager(onlineManager);

    // Initialize loot box system
    if (window.lootBoxSystem) {
        window.lootBoxSystem.game = game;
        window.lootBoxSystem.init();
    }

    // Initialize card system
    window.cardSystem = new CardSystem();

    // Initialize NEW card effects handler with visuals
    window.cardEffectVisuals = new CardEffectVisuals(game.player);
    window.cardEffectHandler = new CardEffectHandler(game.player, game);

    // Make available to game immediately
    game.cardEffectHandler = window.cardEffectHandler;
    game.cardEffectVisuals = window.cardEffectVisuals;

    // Charger les cartes depuis l'inventaire
    window.cardSystem.loadCardsFromInventory();
    console.log('📦 Cards loaded from inventory');

    // Initialize deck UI après le chargement des cartes
    window.deckUI = new DeckUI(window.cardSystem);
    window.deckUI.updatePreview();

    // Get deck cards and apply effects
    const deckCards = window.cardSystem.getDeck();
    window.cardEffectHandler.applyCardEffects(deckCards);

    console.log('✨ Card effect system initialized');

    // Reset reload count if we got this far
    sessionStorage.removeItem('deck_reload_count');

    // Essayer de charger une sauvegarde
    if (game.loadGame()) {
        console.log("Sauvegarde chargée avec succès");
    } else {
    }

    // Démarrer la sauvegarde automatique
    game.startAutoSave();

    // NOUVEAU: Event listener pour le bouton de fermeture de la boutique
    const closeShopBtn = document.getElementById('close-shop-btn');
    if (closeShopBtn && window.cardShop) {
        closeShopBtn.addEventListener('click', () => {
            window.cardShop.closeShop();
            // On laisse le joueur cliquer sur Fight manuellement
        });
    }

    // Ajouter des raccourcis clavier pour les paramètres
    document.addEventListener('keydown', (e) => {
        // Ctrl + M pour basculer le son
        if (e.ctrlKey && e.key === 'm') {
            e.preventDefault();
            const enabled = game.audioManager.toggle();
            console.log(`Audio ${enabled ? 'activé' : 'désactivé'}`);
        }

        // Ctrl + S pour sauvegarder manuellement
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            game.saveGame();
            console.log("Sauvegarde manuelle effectuée");
        }
    });

    // Gérer la visibilité de la page pour la sauvegarde
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            game.saveGame();
        }
    });

    // Gérer la fermeture de la page
    window.addEventListener('beforeunload', () => {
        game.saveGame();
    });

});

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
    console.error('Erreur dans le jeu:', e.error);
});

// Gestion des promesses rejetées
window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesse rejetée:', e.reason);
});
