const { db, initializeDatabase } = require('../database/db');
const path = require('path');
const fs = require('fs');

async function resetDatabase() {
  try {
    console.log('🔄 Connexion à la base de données...');
    await initializeDatabase();

    console.log('🗑️  Suppression de toutes les données utilisateurs...');

    // Supprimer toutes les données des tables (dans l'ordre pour respecter les contraintes de clés étrangères)
    await db.run('DELETE FROM cheat_logs');
    console.log('✅ cheat_logs supprimés');

    await db.run('DELETE FROM player_loot_inventory');
    console.log('✅ player_loot_inventory supprimé');

    await db.run('DELETE FROM loot_inventory');
    console.log('✅ loot_inventory supprimé');

    await db.run('DELETE FROM scores');
    console.log('✅ scores supprimés');

    await db.run('DELETE FROM game_states');
    console.log('✅ game_states supprimés');

    await db.run('DELETE FROM game_sessions');
    console.log('✅ game_sessions supprimés');

    await db.run('DELETE FROM leaderboard');
    console.log('✅ leaderboard supprimé');

    await db.run('DELETE FROM users');
    console.log('✅ users supprimés');

    // Réinitialiser les séquences AUTOINCREMENT
    await db.run('DELETE FROM sqlite_sequence');
    console.log('✅ Séquences réinitialisées');

    console.log('✅ Base de données réinitialisée avec succès !');
    console.log('📊 Toutes les tables sont maintenant vides.');

    // Fermer la connexion
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    db.close();
    process.exit(1);
  }
}

// Exécuter la réinitialisation
resetDatabase();




