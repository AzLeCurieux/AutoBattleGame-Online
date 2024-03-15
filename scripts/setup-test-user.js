#!/usr/bin/env node
/**
 * Script pour créer un utilisateur de test avec des items
 */

const { db } = require('../database/db');
const bcrypt = require('bcryptjs');

async function setupTestUser() {
    console.log('🔧 Configuration utilisateur de test...\n');

    const username = 'test';
    const password = 'test';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Vérifier si l'utilisateur existe
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        let userId;

        if (existingUser) {
            console.log('✅ Utilisateur "test" existe déjà (ID:', existingUser.id, ')');
            userId = existingUser.id;

            // Mettre à jour le mot de passe
            await new Promise((resolve, reject) => {
                db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log('✅ Mot de passe mis à jour: "test"');
        } else {
            // Créer l'utilisateur
            userId = await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO users (username, password, level, experience, coins) VALUES (?, ?, 1, 0, 10000)',
                    [username, hashedPassword],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
            console.log('✅ Utilisateur créé: test/test (ID:', userId, ')');
        }

        // Ajouter quelques items de test
        const testItems = [
            'andres_everest',
            'aurelien_dofus',
            'axel_bruce_wayne',
            'glamal_basket',
            'ibra_kart',
            'axel_batman',
            'axel_mugshot',
            'glamal_onsen',
            'aurelien_bob',
            'glamal_fiak'
        ];

        console.log('\n📦 Ajout de', testItems.length, 'items de test...');

        for (const itemId of testItems) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO user_loot (user_id, loot_item_id, quantity, obtained_at)
                     VALUES (?, ?, 1, ?)`,
                    [userId, itemId, Date.now()],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        console.log('✅ Items ajoutés\n');

        // Afficher résumé
        const itemCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM user_loot WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        console.log('═══════════════════════════════════════');
        console.log('✅ Configuration terminée !');
        console.log('═══════════════════════════════════════');
        console.log('📋 Informations de connexion :');
        console.log('   Username: test');
        console.log('   Password: test');
        console.log('   User ID:', userId);
        console.log('   Items:', itemCount);
        console.log('═══════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

// Attendre que la base de données soit initialisée
setTimeout(() => {
    setupTestUser();
}, 1000);
