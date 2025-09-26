// Point d'entrée principal du jeu
let game;
let onlineManager;

document.addEventListener('DOMContentLoaded', () => {
    // AutoBattleGame - Version Web
    
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
    
    // Jeu initialisé avec succès
    const bgVideo = document.getElementById('bg-video');
    if (bgVideo) {
        // Lecture en boucle avec ralentissement progressif sur la durée
        bgVideo.loop = true;
        const baseRate = 1.0;
        const minRate = 0.6; // vitesse minimale atteinte en fin de vidéo
        const range = baseRate - minRate;

        const updateRate = () => {
            if (!bgVideo.duration || isNaN(bgVideo.duration)) return;
            const t = Math.max(0, Math.min(1, bgVideo.currentTime / bgVideo.duration));
            // Smoothstep (0->1) pour une courbe douce
            const eased = t * t * (3 - 2 * t);
            const target = baseRate - range * eased;
            bgVideo.playbackRate = Math.max(0.5, target);
        };

        bgVideo.addEventListener('timeupdate', updateRate);
        bgVideo.addEventListener('loadedmetadata', () => {
            bgVideo.playbackRate = baseRate;
            updateRate();
            bgVideo.play().catch(() => {});
        });
    }
});

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
    console.error('Erreur dans le jeu:', e.error);
});

// Gestion des promesses rejetées
window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesse rejetée:', e.reason);
});
