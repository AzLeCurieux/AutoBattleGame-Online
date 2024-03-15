const fs = require('fs');
const path = require('path');

// Configuration des dossiers
const IMAGES_DIR = path.join(__dirname, '../img/cartes');
const OUTPUT_FILE = path.join(__dirname, '../js/loot/lootData.js');

// Configuration des raretés (Modifiable ici)
const RARITY_CONFIG = {
    1: { name: "Consumer Grade", id: "consumer", color: "#b0c3d9", chance: 0.394, value: 10 },
    2: { name: "Industrial Grade", id: "industrial", color: "#5e98d9", chance: 0.295, value: 25 },
    3: { name: "Mil-spec", id: "milspec", color: "#4b69ff", chance: 0.148, value: 75 },
    4: { name: "Restricted", id: "restricted", color: "#8847ff", chance: 0.069, value: 250 },
    5: { name: "Classified", id: "classified", color: "#d32ce6", chance: 0.029, value: 1000 },
    6: { name: "Covert", id: "covert", color: "#eb4b4b", chance: 0.020, value: 5000 },
    7: { name: "Melee / Gold", id: "melee", color: "#e4ae39", chance: 0.005, value: 20000 }
};

// Fonction pour formater le nom (ex: "lucas_totem" -> "Lucas Totem")
function formatName(rawName) {
    return rawName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function generateConfig() {
    if (!fs.existsSync(IMAGES_DIR)) {
        console.error(`❌ Le dossier ${IMAGES_DIR} n'existe pas.`);
        return;
    }

    const files = fs.readdirSync(IMAGES_DIR);
    const categories = {};
    const items = {};

    // Initialiser les catégories
    Object.keys(RARITY_CONFIG).forEach(key => {
        const conf = RARITY_CONFIG[key];
        categories[conf.id] = {
            name: conf.name,
            color: conf.color,
            chance: conf.chance,
            items: [] // Liste des IDs d'items
        };
    });

    console.log(`📂 Scan de ${files.length} fichiers...`);

    files.forEach(file => {
        if (!file.match(/\.(png|jpg|jpeg|webp)$/i)) return;

        // Regex pour extraire le numéro de rareté et le nom : "1_nom_de_fichier.png"
        const match = file.match(/^(\d+)_(.+)\./);
        
        if (match) {
            const rarityNum = parseInt(match[1]);
            const rawName = match[2];
            const rarityConf = RARITY_CONFIG[rarityNum];

            if (rarityConf) {
                const itemId = rawName; // ID unique basé sur le nom du fichier sans numéro
                const itemName = formatName(rawName);
                
                // Ajouter l'item à la liste de la catégorie
                categories[rarityConf.id].items.push(itemId);

                // Créer l'objet item
                items[itemId] = {
                    id: itemId,
                    name: itemName,
                    text: `**${itemName}** apparaît !`,
                    rarity: rarityConf.id,
                    rarityName: rarityConf.name,
                    image: file, // Nom du fichier image
                    value: rarityConf.value,
                    color: rarityConf.color
                };
            }
        }
    });

    // Construction du contenu du fichier JS
    const fileContent = `/**
 * FICHIER GÉNÉRÉ AUTOMATIQUEMENT PAR scripts/generate-loot-config.js
 * NE PAS MODIFIER MANUELLEMENT LES ITEMS, AJOUTEZ DES IMAGES DANS /img/cartes
 */

const LOOT_CONFIG = {
    // Configuration des caisses par niveau
    caseTypes: {
        "Alpha Case (1-39)": {
            name: "Alpha Case (1-39)",
            levelRange: [1, 39],
            image: "/img/case/Caisse_icons/alpha_case.png",
            imageLarge: "/img/case/Caisse_trimmed/alpha_case.png",
            probabilities: [45.908, 33.932, 16.467, 1.996, 0.898, 0.499, 0.299]
        },
        "Bravo Case (40-49)": {
            name: "Bravo Case (40-49)",
            levelRange: [40, 49],
            image: "/img/case/Caisse_icons/bravo_case.png",
            imageLarge: "/img/case/Caisse_trimmed/bravo_case.png",
            probabilities: [44.879, 33.263, 17.951, 2.112, 0.950, 0.528, 0.317]
        },
        "Chroma Case (50-59)": {
            name: "Chroma Case (50-59)",
            levelRange: [50, 59],
            image: "/img/case/Caisse_icons/chroma_case.png",
            imageLarge: "/img/case/Caisse_trimmed/chroma_case.png",
            probabilities: [38.461, 31.468, 21.145, 5.331, 2.662, 0.583, 0.350]
        },
        "Delta case (60-69)": {
            name: "Delta case (60-69)",
            levelRange: [60, 69],
            image: "/img/case/Caisse_icons/delta_case.png",
            imageLarge: "/img/case/Caisse_trimmed/delta_case.png",
            probabilities: [28.867, 24.744, 21.682, 12.856, 7.011, 4.325, 0.515]
        },
        "Spectrum Case (70-79)": {
            name: "Spectrum Case (70-79)",
            levelRange: [70, 79],
            image: "/img/case/Caisse_icons/spectrum_case.png",
            imageLarge: "/img/case/Caisse_trimmed/spectrum_case.png",
            probabilities: [26.316, 22.632, 21.105, 14.684, 7.895, 5.411, 1.958]
        },
        "Clutch Case (80-89)": {
            name: "Clutch Case (80-89)",
            levelRange: [80, 89],
            image: "/img/case/Caisse_icons/clutch_case.png",
            imageLarge: "/img/case/Caisse_trimmed/clutch_case.png",
            probabilities: [21.534, 19.497, 18.436, 24.351, 8.324, 5.623, 2.214]
        },
        "Red Case (90-99)": {
            name: "Red Case (90-99)",
            levelRange: [90, 99],
            image: "/img/case/Caisse_icons/red_case.png",
            imageLarge: "/img/case/Caisse_trimmed/red_case.png",
            probabilities: [19.080, 18.133, 17.091, 27.553, 9.074, 6.361, 2.701]
        },
        "Prisma Edition (100+)": {
            name: "Prisma Edition (100+)",
            levelRange: [100, 999],
            image: "/img/case/Caisse_icons/prisma_edition.png",
            imageLarge: "/img/case/Caisse_trimmed/prisma_edition.png",
            probabilities: [10.725, 10.291, 14.136, 36.069, 14.180, 11.343, 3.268]
        }
    },

    // Configuration globale du système d'augmentation (Upgrade)
    upgradeSystem: {
        baseSuccessRate: 0.5,
        multiplier: 1.2
    },

    // Catégories de rareté (Générées)
    categories: ${JSON.stringify(categories, null, 4)},

    // Liste complète des items avec détails (Générés)
    items: ${JSON.stringify(items, null, 4)}
};

// Mapping pour compatibilité avec l'ancien système si nécessaire
const LOOT_DATA = {
    categories: {}, // Sera rempli dynamiquement
    messages: LOOT_CONFIG.items // Alias pour l'ancien code qui utilisait 'messages'
};

// Remplissage de compatibilité
Object.keys(LOOT_CONFIG.categories).forEach(key => {
    const cat = LOOT_CONFIG.categories[key];
    LOOT_DATA.categories[cat.name + (key === 'consumer' ? ' (Common)' : '')] = {
        items: cat.items,
        chance: cat.chance,
        color: cat.color,
        id: key
    };
});

/**
 * Obtient le type de caisse pour un niveau donné
 * @param {number} level - Niveau du joueur
 * @returns {object} - Case type configuration
 */
LOOT_CONFIG.getCaseTypeForLevel = function (level) {
    const caseTypesArray = Object.values(this.caseTypes);
    for (const caseType of caseTypesArray) {
        if (level >= caseType.levelRange[0] && level <= caseType.levelRange[1]) {
            return caseType;
        }
    }
    // Fallback to Alpha Case if level is below 1
    return this.caseTypes["Alpha Case (1-39)"];
};

/**
 * Obtient les probabilités pour un niveau donné
 * @param {number} level - Niveau du joueur
 * @returns {array} - Array of probabilities (percentages)
 */
LOOT_CONFIG.getProbabilitiesForLevel = function (level) {
    const caseType = this.getCaseTypeForLevel(level);
    return caseType.probabilities;
};

/**
 * Normalise les probabilités en décimales (0-1) au lieu de pourcentages
 * @param {array} probabilities - Array of probabilities as percentages
 * @returns {array} - Array of probabilities as decimals
 */
LOOT_CONFIG.normalizeProbabilities = function (probabilities) {
    return probabilities.map(p => p / 100);
};

// Export global
if (typeof window !== 'undefined') {
    window.LOOT_CONFIG = LOOT_CONFIG;
    window.LOOT_DATA = LOOT_DATA; // Garder LOOT_DATA pour la compatibilité existante
}

if (typeof module !== 'undefined') {
    module.exports = { LOOT_CONFIG, LOOT_DATA };
}
`;

    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`✅ Configuration générée avec succès dans ${OUTPUT_FILE}`);
}

generateConfig();


