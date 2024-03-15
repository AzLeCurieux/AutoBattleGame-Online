const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/shop/buy
 * Acheter une carte dans la boutique
 */
router.post('/buy', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { cardId, cardPrice, playerGold } = req.body;

        // Validation de base
        if (!cardId || typeof cardPrice !== 'number' || typeof playerGold !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Paramètres invalides'
            });
        }

        // Vérifier que le joueur a assez d'or
        if (playerGold < cardPrice) {
            return res.status(403).json({
                success: false,
                message: 'Or insuffisant'
            });
        }

        // ANTI-CHEAT 1: Vérifier que la carte est dans l'inventaire du joueur (débloquée)
        const lootItems = await db.getUserLootInventory(userId);
        let hasCard = lootItems && lootItems.some(item => String(item.id).trim() === String(cardId).trim());

        // Fallback: si pas de vraies cartes mais des lootboxes, autoriser (compatibilité)
        if (!hasCard) {
            const lootBoxes = await db.getUserInventory(userId);
            const hasLootBoxes = lootBoxes && lootBoxes.length > 0;
            const hasRealCards = lootItems && lootItems.length > 0;

            if (!hasRealCards && hasLootBoxes) {
                hasCard = true;
            }
        }

        if (!hasCard) {
            return res.status(403).json({
                success: false,
                message: 'Carte non débloquée'
            });
        }

        // Note: Deck is now built during the game, no pre-game deck checks needed

        console.log(`✅ Achat: ${cardId} pour ${cardPrice} or (user ${userId})`);

        res.json({
            success: true,
            message: 'Carte achetée avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur achat carte:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

/**
 * POST /api/shop/sell
 * Vendre une carte du deck
 */
router.post('/sell', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { cardId, sellPrice } = req.body;

        console.log(`🔍 Sell request - cardId: ${cardId}, sellPrice: ${sellPrice}, type: ${typeof sellPrice}`);

        // Validation de base
        if (!cardId || typeof sellPrice !== 'number' || isNaN(sellPrice)) {
            console.error(`❌ Invalid params - cardId: ${cardId}, sellPrice: ${sellPrice}`);
            return res.status(400).json({
                success: false,
                message: `Paramètres invalides (cardId: ${cardId}, sellPrice: ${sellPrice})`
            });
        }

        // Note: Deck is now built during the game, selling from run deck
        console.log(`✅ Vente: ${cardId} pour ${sellPrice} or (user ${userId})`);

        res.json({
            success: true,
            message: 'Carte vendue avec succès'
        });

    } catch (error) {
        console.error('❌ Erreur vente carte:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

module.exports = router;
