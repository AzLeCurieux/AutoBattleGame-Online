/**
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
    categories: {
    "consumer": {
        "name": "Consumer Grade",
        "color": "#b0c3d9",
        "chance": 0.394,
        "items": [
            "andres_everest",
            "aurelien_dofus",
            "axel_bruce_wayne",
            "complet",
            "gagou_fornite",
            "glamal_basket",
            "glamal_csgo",
            "glamal_neige",
            "ibra_kart",
            "kilian_garden",
            "kilian_pokemon",
            "lucas_lucarton",
            "quentin_fish"
        ]
    },
    "industrial": {
        "name": "Industrial Grade",
        "color": "#5e98d9",
        "chance": 0.295,
        "items": [
            "axel_batman",
            "axel_mugshot",
            "glamal_onsen",
            "glamal_pirate",
            "iut",
            "lucas_canada"
        ]
    },
    "milspec": {
        "name": "Mil-spec",
        "color": "#4b69ff",
        "chance": 0.148,
        "items": [
            "aurelien_bob",
            "glamal_fiak",
            "glamal_voiture",
            "lucas_voiture",
            "quentin_pokemon"
        ]
    },
    "restricted": {
        "name": "Restricted",
        "color": "#8847ff",
        "chance": 0.069,
        "items": [
            "andres_boite",
            "andres_urgence",
            "aurelien_maxeed",
            "glamal_men_in_black",
            "kilian_obelix",
            "kilian_red"
        ]
    },
    "classified": {
        "name": "Classified",
        "color": "#d32ce6",
        "chance": 0.029,
        "items": [
            "all_nigg",
            "andres_m8",
            "aurelien_dragon",
            "glamal_location",
            "kilian_enceinte"
        ]
    },
    "covert": {
        "name": "Covert",
        "color": "#eb4b4b",
        "chance": 0.02,
        "items": [
            "andres_tartinex",
            "aurelien_lfi",
            "axel_potion",
            "complet_grill",
            "glamal_panart",
            "lucas_cheval",
            "lucas_dust",
            "quentin_drake",
            "quentin_nostonks",
            "quentin_potion"
        ]
    },
    "melee": {
        "name": "Melee / Gold",
        "color": "#e4ae39",
        "chance": 0.005,
        "items": [
            "andres_gold",
            "aurelien_yellow_army",
            "glamal_cs_gold",
            "lucas_totem",
            "quentin_sonic"
        ]
    }
},

    // Liste complète des items avec détails (Générés)
    items: {
    "andres_everest": {
        "id": "andres_everest",
        "name": "Andres Everest",
        "text": "**Andres Everest** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_andres_everest.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "aurelien_dofus": {
        "id": "aurelien_dofus",
        "name": "Aurelien Dofus",
        "text": "**Aurelien Dofus** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_aurelien_dofus.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "axel_bruce_wayne": {
        "id": "axel_bruce_wayne",
        "name": "Axel Bruce Wayne",
        "text": "**Axel Bruce Wayne** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_axel_bruce_wayne.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "complet": {
        "id": "complet",
        "name": "Complet",
        "text": "**Complet** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_complet.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "gagou_fornite": {
        "id": "gagou_fornite",
        "name": "Gagou Fornite",
        "text": "**Gagou Fornite** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_gagou_fornite.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "glamal_basket": {
        "id": "glamal_basket",
        "name": "Glamal Basket",
        "text": "**Glamal Basket** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_glamal_basket.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "glamal_csgo": {
        "id": "glamal_csgo",
        "name": "Glamal Csgo",
        "text": "**Glamal Csgo** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_glamal_csgo.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "glamal_neige": {
        "id": "glamal_neige",
        "name": "Glamal Neige",
        "text": "**Glamal Neige** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_glamal_neige.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "ibra_kart": {
        "id": "ibra_kart",
        "name": "Ibra Kart",
        "text": "**Ibra Kart** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_ibra_kart.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "kilian_garden": {
        "id": "kilian_garden",
        "name": "Kilian Garden",
        "text": "**Kilian Garden** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_kilian_garden.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "kilian_pokemon": {
        "id": "kilian_pokemon",
        "name": "Kilian Pokemon",
        "text": "**Kilian Pokemon** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_kilian_pokemon.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "lucas_lucarton": {
        "id": "lucas_lucarton",
        "name": "Lucas Lucarton",
        "text": "**Lucas Lucarton** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_lucas_lucarton.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "quentin_fish": {
        "id": "quentin_fish",
        "name": "Quentin Fish",
        "text": "**Quentin Fish** apparaît !",
        "rarity": "consumer",
        "rarityName": "Consumer Grade",
        "image": "1_quentin_fish.png",
        "value": 10,
        "color": "#b0c3d9"
    },
    "axel_batman": {
        "id": "axel_batman",
        "name": "Axel Batman",
        "text": "**Axel Batman** apparaît !",
        "rarity": "industrial",
        "rarityName": "Industrial Grade",
        "image": "2_axel_batman.png",
        "value": 25,
        "color": "#5e98d9"
    },
    "axel_mugshot": {
        "id": "axel_mugshot",
        "name": "Axel Mugshot",
        "text": "**Axel Mugshot** apparaît !",
        "rarity": "industrial",
        "rarityName": "Industrial Grade",
        "image": "2_axel_mugshot.png",
        "value": 25,
        "color": "#5e98d9"
    },
    "glamal_onsen": {
        "id": "glamal_onsen",
        "name": "Glamal Onsen",
        "text": "**Glamal Onsen** apparaît !",
        "rarity": "industrial",
        "rarityName": "Industrial Grade",
        "image": "2_glamal_onsen.png",
        "value": 25,
        "color": "#5e98d9"
    },
    "glamal_pirate": {
        "id": "glamal_pirate",
        "name": "Glamal Pirate",
        "text": "**Glamal Pirate** apparaît !",
        "rarity": "industrial",
        "rarityName": "Industrial Grade",
        "image": "2_glamal_pirate.png",
        "value": 25,
        "color": "#5e98d9"
    },
    "iut": {
        "id": "iut",
        "name": "Iut",
        "text": "**Iut** apparaît !",
        "rarity": "industrial",
        "rarityName": "Industrial Grade",
        "image": "2_iut.png",
        "value": 25,
        "color": "#5e98d9"
    },
    "lucas_canada": {
        "id": "lucas_canada",
        "name": "Lucas Canada",
        "text": "**Lucas Canada** apparaît !",
        "rarity": "industrial",
        "rarityName": "Industrial Grade",
        "image": "2_lucas_canada.png",
        "value": 25,
        "color": "#5e98d9"
    },
    "aurelien_bob": {
        "id": "aurelien_bob",
        "name": "Aurelien Bob",
        "text": "**Aurelien Bob** apparaît !",
        "rarity": "milspec",
        "rarityName": "Mil-spec",
        "image": "3_aurelien_bob.png",
        "value": 75,
        "color": "#4b69ff"
    },
    "glamal_fiak": {
        "id": "glamal_fiak",
        "name": "Glamal Fiak",
        "text": "**Glamal Fiak** apparaît !",
        "rarity": "milspec",
        "rarityName": "Mil-spec",
        "image": "3_glamal_fiak.png",
        "value": 75,
        "color": "#4b69ff"
    },
    "glamal_voiture": {
        "id": "glamal_voiture",
        "name": "Glamal Voiture",
        "text": "**Glamal Voiture** apparaît !",
        "rarity": "milspec",
        "rarityName": "Mil-spec",
        "image": "3_glamal_voiture.png",
        "value": 75,
        "color": "#4b69ff"
    },
    "lucas_voiture": {
        "id": "lucas_voiture",
        "name": "Lucas Voiture",
        "text": "**Lucas Voiture** apparaît !",
        "rarity": "milspec",
        "rarityName": "Mil-spec",
        "image": "3_lucas_voiture.png",
        "value": 75,
        "color": "#4b69ff"
    },
    "quentin_pokemon": {
        "id": "quentin_pokemon",
        "name": "Quentin Pokemon",
        "text": "**Quentin Pokemon** apparaît !",
        "rarity": "milspec",
        "rarityName": "Mil-spec",
        "image": "3_quentin_pokemon.png",
        "value": 75,
        "color": "#4b69ff"
    },
    "andres_boite": {
        "id": "andres_boite",
        "name": "Andres Boite",
        "text": "**Andres Boite** apparaît !",
        "rarity": "restricted",
        "rarityName": "Restricted",
        "image": "4_andres_boite.png",
        "value": 250,
        "color": "#8847ff"
    },
    "andres_urgence": {
        "id": "andres_urgence",
        "name": "Andres Urgence",
        "text": "**Andres Urgence** apparaît !",
        "rarity": "restricted",
        "rarityName": "Restricted",
        "image": "4_andres_urgence.png",
        "value": 250,
        "color": "#8847ff"
    },
    "aurelien_maxeed": {
        "id": "aurelien_maxeed",
        "name": "Aurelien Maxeed",
        "text": "**Aurelien Maxeed** apparaît !",
        "rarity": "restricted",
        "rarityName": "Restricted",
        "image": "4_aurelien_maxeed.png",
        "value": 250,
        "color": "#8847ff"
    },
    "glamal_men_in_black": {
        "id": "glamal_men_in_black",
        "name": "Glamal Men In Black",
        "text": "**Glamal Men In Black** apparaît !",
        "rarity": "restricted",
        "rarityName": "Restricted",
        "image": "4_glamal_men_in_black.png",
        "value": 250,
        "color": "#8847ff"
    },
    "kilian_obelix": {
        "id": "kilian_obelix",
        "name": "Kilian Obelix",
        "text": "**Kilian Obelix** apparaît !",
        "rarity": "restricted",
        "rarityName": "Restricted",
        "image": "4_kilian_obelix.png",
        "value": 250,
        "color": "#8847ff"
    },
    "kilian_red": {
        "id": "kilian_red",
        "name": "Kilian Red",
        "text": "**Kilian Red** apparaît !",
        "rarity": "restricted",
        "rarityName": "Restricted",
        "image": "4_kilian_red.png",
        "value": 250,
        "color": "#8847ff"
    },
    "all_nigg": {
        "id": "all_nigg",
        "name": "All Nigg",
        "text": "**All Nigg** apparaît !",
        "rarity": "classified",
        "rarityName": "Classified",
        "image": "5_all_nigg.png",
        "value": 1000,
        "color": "#d32ce6"
    },
    "andres_m8": {
        "id": "andres_m8",
        "name": "Andres M8",
        "text": "**Andres M8** apparaît !",
        "rarity": "classified",
        "rarityName": "Classified",
        "image": "5_andres_m8.png",
        "value": 1000,
        "color": "#d32ce6"
    },
    "aurelien_dragon": {
        "id": "aurelien_dragon",
        "name": "Aurelien Dragon",
        "text": "**Aurelien Dragon** apparaît !",
        "rarity": "classified",
        "rarityName": "Classified",
        "image": "5_aurelien_dragon.png",
        "value": 1000,
        "color": "#d32ce6"
    },
    "glamal_location": {
        "id": "glamal_location",
        "name": "Glamal Location",
        "text": "**Glamal Location** apparaît !",
        "rarity": "classified",
        "rarityName": "Classified",
        "image": "5_glamal_location.png",
        "value": 1000,
        "color": "#d32ce6"
    },
    "kilian_enceinte": {
        "id": "kilian_enceinte",
        "name": "Kilian Enceinte",
        "text": "**Kilian Enceinte** apparaît !",
        "rarity": "classified",
        "rarityName": "Classified",
        "image": "5_kilian_enceinte.png",
        "value": 1000,
        "color": "#d32ce6"
    },
    "andres_tartinex": {
        "id": "andres_tartinex",
        "name": "Andres Tartinex",
        "text": "**Andres Tartinex** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_andres_tartinex.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "aurelien_lfi": {
        "id": "aurelien_lfi",
        "name": "Aurelien Lfi",
        "text": "**Aurelien Lfi** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_aurelien_lfi.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "axel_potion": {
        "id": "axel_potion",
        "name": "Axel Potion",
        "text": "**Axel Potion** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_axel_potion.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "complet_grill": {
        "id": "complet_grill",
        "name": "Complet Grill",
        "text": "**Complet Grill** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_complet_grill.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "glamal_panart": {
        "id": "glamal_panart",
        "name": "Glamal Panart",
        "text": "**Glamal Panart** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_glamal_panart.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "lucas_cheval": {
        "id": "lucas_cheval",
        "name": "Lucas Cheval",
        "text": "**Lucas Cheval** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_lucas_cheval.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "lucas_dust": {
        "id": "lucas_dust",
        "name": "Lucas Dust",
        "text": "**Lucas Dust** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_lucas_dust.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "quentin_drake": {
        "id": "quentin_drake",
        "name": "Quentin Drake",
        "text": "**Quentin Drake** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_quentin_drake.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "quentin_nostonks": {
        "id": "quentin_nostonks",
        "name": "Quentin Nostonks",
        "text": "**Quentin Nostonks** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_quentin_nostonks.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "quentin_potion": {
        "id": "quentin_potion",
        "name": "Quentin Potion",
        "text": "**Quentin Potion** apparaît !",
        "rarity": "covert",
        "rarityName": "Covert",
        "image": "6_quentin_potion.png",
        "value": 5000,
        "color": "#eb4b4b"
    },
    "andres_gold": {
        "id": "andres_gold",
        "name": "Andres Gold",
        "text": "**Andres Gold** apparaît !",
        "rarity": "melee",
        "rarityName": "Melee / Gold",
        "image": "7_andres_gold.png",
        "value": 20000,
        "color": "#e4ae39"
    },
    "aurelien_yellow_army": {
        "id": "aurelien_yellow_army",
        "name": "Aurelien Yellow Army",
        "text": "**Aurelien Yellow Army** apparaît !",
        "rarity": "melee",
        "rarityName": "Melee / Gold",
        "image": "7_aurelien_yellow_army.png",
        "value": 20000,
        "color": "#e4ae39"
    },
    "glamal_cs_gold": {
        "id": "glamal_cs_gold",
        "name": "Glamal Cs Gold",
        "text": "**Glamal Cs Gold** apparaît !",
        "rarity": "melee",
        "rarityName": "Melee / Gold",
        "image": "7_glamal_cs_gold.png",
        "value": 20000,
        "color": "#e4ae39"
    },
    "lucas_totem": {
        "id": "lucas_totem",
        "name": "Lucas Totem",
        "text": "**Lucas Totem** apparaît !",
        "rarity": "melee",
        "rarityName": "Melee / Gold",
        "image": "7_lucas_totem.png",
        "value": 20000,
        "color": "#e4ae39"
    },
    "quentin_sonic": {
        "id": "quentin_sonic",
        "name": "Quentin Sonic",
        "text": "**Quentin Sonic** apparaît !",
        "rarity": "melee",
        "rarityName": "Melee / Gold",
        "image": "7_quentin_sonic.png",
        "value": 20000,
        "color": "#e4ae39"
    }
}
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
