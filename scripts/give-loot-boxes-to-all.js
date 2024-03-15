/**
 * Script pour donner 20 caisses de chaque niveau jusqu'à 200 à tous les utilisateurs
 */

const path = require('path');
const { db, initializeDatabase } = require('../database/db');

async function giveLootBoxesToAll() {
    try {
        console.log('🎁 Début de la distribution de caisses...');
        
        // Définir le chemin de la base de données
        process.env.SQLITE_DB_DIR = process.env.SQLITE_DB_DIR || 'C:\\Users\\matos\\data';
        process.env.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.env.SQLITE_DB_DIR, 'game.db');
        
        console.log(`📁 Chemin de la base de données : ${process.env.SQLITE_DB_PATH}`);
        
        // Initialiser la base de données
        await initializeDatabase();
        console.log('✅ Base de données initialisée');
        
        // Récupérer tous les utilisateurs
        const users = await db.all('SELECT id FROM users');
        
        if (users.length === 0) {
            console.log('❌ Aucun utilisateur trouvé');
            return;
        }
        
        console.log(`📊 ${users.length} utilisateur(s) trouvé(s)`);
        
        // Créer les caisses pour chaque niveau de 1 à 200
        const levels = Array.from({ length: 200 }, (_, i) => i + 1);
        let totalBoxes = 0;
        const BATCH_SIZE = 500; // Insérer par batch de 500 pour optimiser
        
        for (const user of users) {
            const userId = user.id;
            const boxes = [];
            const now = Date.now(); // Timestamp en millisecondes
            
            for (const level of levels) {
                // Créer 20 caisses de ce niveau pour cet utilisateur
                for (let i = 0; i < 20; i++) {
                    const boxId = `box_${userId}_${level}_${now}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Créer un objet lootBox avec toutes les propriétés requises
                    // Valeurs par défaut pour rarity, color, emoji (seront remplacées lors de l'ouverture)
                    boxes.push({
                        id: boxId,
                        rarity: 'Consumer', // Valeur par défaut
                        color: '#b0c3d9', // Valeur par défaut
                        emoji: '📦', // Valeur par défaut
                        level: level,
                        obtainedAt: now
                    });
                }
            }
            
            // Insérer par batch en utilisant la méthode optimisée
            for (let i = 0; i < boxes.length; i += BATCH_SIZE) {
                const batch = boxes.slice(i, i + BATCH_SIZE);
                await db.saveLootBoxesBatch(userId, batch);
            }
            
            totalBoxes += boxes.length;
            console.log(`✅ ${boxes.length} caisses ajoutées pour l'utilisateur ${userId}`);
        }
        
        console.log(`\n🎉 Distribution terminée !`);
        console.log(`📦 Total de caisses distribuées : ${totalBoxes}`);
        console.log(`👥 Utilisateurs : ${users.length}`);
        console.log(`📊 Caisses par utilisateur : ${levels.length * 20} (${levels.length} niveaux × 20 caisses)`);
        
    } catch (error) {
        console.error('❌ Erreur lors de la distribution:', error);
        throw error;
    }
}

// Exécuter le script
if (require.main === module) {
    giveLootBoxesToAll()
        .then(() => {
            console.log('\n✅ Script terminé avec succès');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Erreur fatale:', error);
            process.exit(1);
        });
}

module.exports = { giveLootBoxesToAll };

