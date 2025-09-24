// Point d'entrée principal du jeu
let game;
let onlineManager;

document.addEventListener('DOMContentLoaded', () => {
    console.log("AutoBattleGame - Version Web");
    console.log("Initialisation du jeu...");
    
    // Initialize online manager first
    onlineManager = new OnlineManager();
    window.onlineManager = onlineManager;
    
    // Initialiser le jeu
    game = new Game();
    
    // Rendre le jeu global pour les améliorations
    window.game = game;
    
    // Connect game with online manager
    game.setOnlineManager(onlineManager);
    
    // Essayer de charger une sauvegarde
    if (game.loadGame()) {
        console.log("Sauvegarde chargée avec succès");
    } else {
        console.log("Nouvelle partie démarrée");
    }
    
    // Démarrer la sauvegarde automatique
    game.startAutoSave();
    
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
    
    console.log("Jeu initialisé avec succès!");
    console.log("Contrôles:");
    console.log("- Espace/Entrée: Combattre");
    console.log("- Échap: Arrêter le combat");
    console.log("- C: Ouvrir le camp");
    console.log("- R: Redémarrer");
    console.log("- Ctrl+M: Basculer le son");
    console.log("- Ctrl+S: Sauvegarder");
});

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
    console.error('Erreur dans le jeu:', e.error);
});

// Gestion des promesses rejetées
window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesse rejetée:', e.reason);
});
