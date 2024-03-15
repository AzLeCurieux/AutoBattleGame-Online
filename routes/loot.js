const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

// Sauvegarder des caisses (appelé après un loot)
router.post('/save-boxes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lootBoxes } = req.body;

    if (!Array.isArray(lootBoxes)) {
      return res.status(400).json({
        success: false,
        message: 'LootBoxes must be an array'
      });
    }

    // Sauvegarder chaque caisse
    for (const lootBox of lootBoxes) {
      await db.saveLootBox(userId, lootBox);
    }

    // Mise à jour des statistiques de session (lootBoxesFound)
    const gameManager = req.app.get('gameManager');
    let sessionUpdated = false;

    if (gameManager) {
      const session = gameManager.getUserSession(userId);
      if (session) {
        session.incrementLootBoxesFound(lootBoxes.length);
        sessionUpdated = true;
      }
    }

    if (!sessionUpdated) {
      // Fallback: mettre à jour la dernière session en DB directement
      try {
        // On utilise db.get via l'instance exportée
        // Note: db est l'instance de la classe Database exportée par ../database/db
        const lastSession = await db.get('SELECT session_id, loot_boxes_found FROM game_sessions WHERE user_id = ? ORDER BY start_time DESC LIMIT 1', [userId]);

        if (lastSession) {
          await db.run('UPDATE game_sessions SET loot_boxes_found = ? WHERE session_id = ?', [
            (lastSession.loot_boxes_found || 0) + lootBoxes.length,
            lastSession.session_id
          ]);
        }
      } catch (e) {
        console.error('Error updating loot stats in DB fallback:', e);
      }
    }

    res.json({
      success: true,
      message: 'Loot boxes saved successfully',
      count: lootBoxes.length
    });
  } catch (error) {
    console.error('Error saving loot boxes:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving loot boxes'
    });
  }
});

// Sauvegarder l'inventaire de caisses (pour compatibilité)
router.post('/save-inventory', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { inventory } = req.body;

    if (!Array.isArray(inventory)) {
      return res.status(400).json({
        success: false,
        message: 'Inventory must be an array'
      });
    }

    // Supprimer l'ancien inventaire et sauvegarder le nouveau
    await db.clearUserInventory(userId);

    for (const lootBox of inventory) {
      await db.saveLootBox(userId, lootBox);
    }

    res.json({
      success: true,
      message: 'Inventory saved successfully'
    });
  } catch (error) {
    console.error('Error saving inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving inventory'
    });
  }
});

// Récupérer l'inventaire de caisses
router.get('/get-inventory', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const inventory = await db.getUserInventory(userId);

    res.json({
      success: true,
      inventory: inventory
    });
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting inventory'
    });
  }
});

// Alias pour /inventory (utilisé par CardSystem)
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const inventory = await db.getUserInventory(userId);

    // Retourner directement le tableau d'inventaire
    res.json(inventory || []);
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting inventory'
    });
  }
});

// Récupérer les items (cartes) débloqués
router.get('/items', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Utiliser la méthode qui récupère les items (cartes) et non les loot boxes
    const items = await db.getUserLootInventory(userId);

    // Retourner directement le tableau d'items
    res.json(items || []);
  } catch (error) {
    console.error('Error getting loot items:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting loot items'
    });
  }
});

module.exports = router;

