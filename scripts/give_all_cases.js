const { db, initializeDatabase } = require('../database/game.db');

// Configuration des caisses (copié de lootData.js)
const CASE_TYPES = [
    {
        name: "Alpha Case (1-39)",
        level: 10,
        probabilities: [45.908, 33.932, 16.467, 1.996, 0.898, 0.499, 0.299]
    },
    {
        name: "Bravo Case (40-49)",
        level: 40,
        probabilities: [44.879, 33.263, 17.951, 2.112, 0.950, 0.528, 0.317]
    },
    {
        name: "Chroma Case (50-59)",
        level: 50,
        probabilities: [38.461, 31.468, 21.145, 5.331, 2.662, 0.583, 0.350]
    },
    {
        name: "Delta case (60-69)",
        level: 60,
        probabilities: [28.867, 24.744, 21.682, 12.856, 7.011, 4.325, 0.515]
    },
    {
        name: "Spectrum Case (70-79)",
        level: 70,
        probabilities: [26.316, 22.632, 21.105, 14.684, 7.895, 5.411, 1.958]
    },
    {
        name: "Clutch Case (80-89)",
        level: 80,
        probabilities: [21.534, 19.497, 18.436, 24.351, 8.324, 5.623, 2.214]
    },
    {
        name: "Red Case (90-99)",
        level: 90,
        probabilities: [19.080, 18.133, 17.091, 27.553, 9.074, 6.361, 2.701]
    },
    {
        name: "Prisma Edition (100+)",
        level: 100,
        probabilities: [10.725, 10.291, 14.136, 36.069, 14.180, 11.343, 3.268]
    }
];

// Catégories de rareté (pour couleurs et emojis)
const RARITY_CATEGORIES = [
    { key: "consumer", color: "#b0c3d9", emoji: "⚪" },
    { key: "industrial", color: "#5e98d9", emoji: "🔵" },
    { key: "milspec", color: "#4b69ff", emoji: "🟦" },
    { key: "restricted", color: "#8847ff", emoji: "🟣" },
    { key: "classified", color: "#d32ce6", emoji: "💗" },
    { key: "covert", color: "#eb4b4b", emoji: "🔴" },
    { key: "melee", color: "#e4ae39", emoji: "🟡" }
];

const QUANTITY_PER_CASE = 100;

// Fonction pour normaliser les probabilités (somme = 1)
function normalizeProbabilities(probs) {
    const sum = probs.reduce((a, b) => a + b, 0);
    return probs.map(p => p / sum);
}

// Fonction pour sélectionner une rareté
function selectRarity(probabilities) {
    const normalized = normalizeProbabilities(probabilities);
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < normalized.length; i++) {
        cumulative += normalized[i];
        if (random <= cumulative) {
            return RARITY_CATEGORIES[i];
        }
    }
    return RARITY_CATEGORIES[0];
}

async function giveCasesToAllUsers() {
    try {
        console.log('📦 Démarrage du script de distribution de caisses...');
        await initializeDatabase();
        console.log('✅ Base de données initialisée');

        // 1. Récupérer tous les utilisateurs
        const users = await db.all("SELECT id, username FROM users");
        console.log(`👥 ${users.length} utilisateurs trouvés.`);

        if (users.length === 0) {
            console.log('⚠️ Aucun utilisateur trouvé.');
            process.exit(0);
        }

        for (const user of users) {
            console.log(`🎁 Traitement de l'utilisateur: ${user.username} (ID: ${user.id})`);

            let count = 0;
            const casesToInsert = [];

            // Générer toutes les caisses pour cet utilisateur
            for (const caseType of CASE_TYPES) {
                for (let i = 0; i < QUANTITY_PER_CASE; i++) {
                    const rarityInfo = selectRarity(caseType.probabilities);
                    // Générer un ID unique avec un timestamp plus précis et un compteur
                    const lootBoxId = `lootbox_${user.id}_${caseType.level}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;

                    casesToInsert.push({
                        user_id: user.id,
                        loot_box_id: lootBoxId,
                        rarity: rarityInfo.key,
                        color: rarityInfo.color,
                        emoji: rarityInfo.emoji,
                        level: caseType.level,
                        obtained_at: Date.now()
                    });
                    count++;
                }
            }

            // Insérer toutes les caisses par batch (plus rapide)
            console.log(`📦 Insertion de ${count} caisses pour ${user.username}...`);
            for (const caseData of casesToInsert) {
                try {
                    await db.run(
                        'INSERT INTO loot_inventory (user_id, loot_box_id, rarity, color, emoji, level, obtained_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            caseData.user_id,
                            caseData.loot_box_id,
                            caseData.rarity,
                            caseData.color,
                            caseData.emoji,
                            caseData.level,
                            caseData.obtained_at
                        ]
                    );
                } catch (insertError) {
                    console.error(`❌ Erreur lors de l'insertion d'une caisse pour ${user.username}:`, insertError.message);
                    // Continuer avec les autres caisses
                }
            }

            console.log(`✅ Ajouté ${count} caisses pour ${user.username}`);
        }

        console.log('🎉 Distribution terminée pour tous les utilisateurs !');

        // Vérifier le résultat
        for (const user of users) {
            const inventory = await db.all('SELECT * FROM loot_inventory WHERE user_id = ?', [user.id]);
            console.log(`📊 ${user.username} possède maintenant ${inventory.length} caisses`);
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur globale:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

giveCasesToAllUsers();
