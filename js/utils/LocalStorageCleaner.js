/**
 * Script pour nettoyer le localStorage
 * À exécuter une fois au démarrage de l'application
 */

(function() {
    console.log('🧹 Nettoyage du localStorage...');

    // Liste des clés à supprimer
    const keysToRemove = [
        'user_info',
        'player_deck',
        'card_custom_effects'
    ];

    keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(`✅ Supprimé: ${key}`);
        }
    });

    console.log('✅ Nettoyage terminé');
})();
