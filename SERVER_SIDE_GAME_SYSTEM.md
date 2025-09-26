# Système de Jeu Côté Serveur - Documentation

## 🎯 Vue d'ensemble

Ce système implémente une architecture **server-side** complète pour le jeu AutoBattleGame, éliminant toutes les possibilités de triche en déplaçant toute la logique de jeu côté serveur.

## 🏗️ Architecture

### Composants Principaux

1. **ServerGameState** (`game/ServerGameState.js`)
   - Gère l'état complet d'une session de jeu
   - Contient toutes les données du joueur (niveau, or, santé, dégâts, etc.)
   - Gère les combats, améliorations, et sauvegardes
   - Chaque session est isolée et liée à un utilisateur

2. **ServerGameManager** (`game/ServerGameManager.js`)
   - Gère toutes les sessions de jeu actives
   - Coordonne les actions entre clients et serveur
   - Gère le nettoyage des sessions inactives
   - Interface principale pour les actions de jeu

3. **ServerGameClient** (`js/online/ServerGameClient.js`)
   - Client côté navigateur pour communiquer avec le serveur
   - Envoie les actions de jeu au serveur
   - Reçoit et affiche les mises à jour d'état
   - Gère les notifications visuelles

## 🔒 Sécurité Anti-Triche

### Avantages du Système Côté Serveur

1. **Impossible de modifier les données** - Tout l'état est côté serveur
2. **Validation complète** - Chaque action est vérifiée côté serveur
3. **Sessions isolées** - Chaque joueur a sa propre session sécurisée
4. **Audit complet** - Toutes les actions sont enregistrées
5. **Pas de synchronisation** - Pas de conflits entre client et serveur

### Mécanismes de Sécurité

- **Validation des actions** : Chaque action est vérifiée avant exécution
- **Limites de taux** : Protection contre le spam d'actions
- **Sessions uniques** : Une seule session active par utilisateur
- **Nettoyage automatique** : Sessions inactives supprimées automatiquement
- **Logs d'audit** : Historique complet des actions

## 🎮 Fonctionnalités

### Actions de Jeu Supportées

- **Combat** : Démarrer/arrêter combat, attaquer
- **Améliorations** : Acheter des améliorations (santé, dégâts, critique)
- **Soins** : Soigner le joueur avec de l'or
- **Passifs** : Sauvegarder les améliorations passives
- **Boss** : Gérer les passifs de boss

### Communication Client-Serveur

```javascript
// Côté client - Envoyer une action
serverGameClient.startFight();
serverGameClient.attack();
serverGameClient.heal();
serverGameClient.buyUpgrade('health');

// Côté serveur - Recevoir et traiter
socket.on('server_game_action', async (data) => {
  const result = await serverGameManager.handleGameAction(userId, action, data);
  socket.emit('server_game_result', result);
});
```

## 📊 Gestion des Sessions

### Cycle de Vie d'une Session

1. **Création** : Session créée lors de l'authentification
2. **Activation** : Session active pendant le jeu
3. **Mise à jour** : État mis à jour à chaque action
4. **Nettoyage** : Session supprimée après inactivité (5 minutes)

### Données de Session

```javascript
{
  sessionId: "session_user123_1234567890_abc123",
  userId: 123,
  player: {
    level: 5,
    gold: 150,
    maxHealth: 120,
    currentHealth: 100,
    damage: 15,
    criticalHitChance: 0.1,
    criticalHitDamagePercent: 1.7
  },
  enemy: { /* état de l'ennemi actuel */ },
  isFighting: true,
  passiveUpgrades: [],
  bossPassives: []
}
```

## 🔄 Flux de Communication

### 1. Authentification
```
Client → Serveur: authenticate(token)
Serveur → Client: authenticated + sessionId + gameState
```

### 2. Actions de Jeu
```
Client → Serveur: server_game_action(action, data)
Serveur → Client: server_game_result(result, gameState)
```

### 3. Mise à Jour d'État
```
Serveur → Client: game_state(updatedState)
Client: updateGameUI()
```

## 🛠️ Intégration

### Côté Client

Le système s'intègre automatiquement avec le jeu existant :

```javascript
// Dans Game.js
handleFightButton() {
  if (this.onlineManager && this.onlineManager.isUsingServerGameLogic()) {
    const serverClient = this.onlineManager.getServerGameClient();
    serverClient.startFight();
    return;
  }
  // Logique côté client (legacy)
}
```

### Côté Serveur

Le serveur gère automatiquement les sessions :

```javascript
// Dans server.js
const serverGameManager = new ServerGameManager();

socket.on('server_game_action', async (data) => {
  const result = await serverGameManager.handleGameAction(userId, action, data);
  socket.emit('server_game_result', result);
});
```

## 🎨 Interface Utilisateur

### Notifications Visuelles

- **Montée de niveau** : Notification verte avec animation
- **Nouveau record** : Notification dorée avec trophée
- **Défaite** : Notification rouge avec animation
- **Victoire** : Particules et effets visuels

### Mise à Jour en Temps Réel

- **État du joueur** : Niveau, or, santé mis à jour instantanément
- **État de combat** : Informations ennemi en temps réel
- **Boutons** : État des boutons basé sur l'état serveur

## 🚀 Avantages

### Pour les Joueurs
- **Expérience fluide** : Pas de lag ou de désynchronisation
- **Sécurité** : Impossible de tricher
- **Fiabilité** : Sauvegarde automatique côté serveur

### Pour les Développeurs
- **Maintenance facile** : Logique centralisée côté serveur
- **Debugging** : Logs complets de toutes les actions
- **Évolutivité** : Facile d'ajouter de nouvelles fonctionnalités

## 🔧 Configuration

### Variables d'Environnement

```bash
# Port du serveur
PORT=3000

# Mode développement
NODE_ENV=development

# Secret JWT
JWT_SECRET=your-secret-key
```

### Paramètres de Session

```javascript
// Dans ServerGameState.js
const INACTIVE_THRESHOLD = 300000; // 5 minutes
const MAX_ACTION_HISTORY = 100; // Actions gardées en mémoire
```

## 📈 Monitoring

### Statistiques Serveur

```javascript
const stats = serverGameManager.getServerStats();
console.log({
  activeSessions: stats.activeSessions,
  activeUsers: stats.activeUsers,
  leaderboardSize: stats.leaderboardSize
});
```

### Logs d'Audit

Toutes les actions sont enregistrées avec :
- Timestamp
- User ID
- Action type
- Données de l'action
- Résultat

## 🎯 Conclusion

Ce système de jeu côté serveur élimine complètement les possibilités de triche tout en offrant une expérience de jeu fluide et sécurisée. L'architecture modulaire permet une maintenance facile et une évolution future du jeu.

**Résultat** : Un jeu 100% sécurisé où toute la logique est contrôlée côté serveur, rendant la triche impossible.
