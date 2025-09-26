# Guide de Débogage - Animations de Combat

## 🐛 Problème : Aucune animation ne se déclenche

### 🔍 Étapes de Diagnostic

#### 1. Vérifier la Console du Navigateur

Ouvrez la console (F12) et exécutez :

```javascript
// Tester le système
testServerGameSystem()

// Afficher l'état actuel
showGameState()
```

#### 2. Vérifier l'Authentification

```javascript
// Vérifier si connecté
console.log('Authentifié:', window.game.onlineManager.isAuthenticated)
console.log('Utilise serveur:', window.game.onlineManager.isUsingServerGameLogic())
```

#### 3. Vérifier le Client Serveur

```javascript
// Vérifier le client
const client = window.game.onlineManager.getServerGameClient()
console.log('Client disponible:', !!client)
console.log('Connecté au serveur:', client?.isConnectedToServer())
```

#### 4. Vérifier l'État du Jeu

```javascript
// État côté serveur
const gameState = client?.getGameState()
console.log('État serveur:', gameState)

// État côté client
console.log('Joueur client:', window.game.player)
console.log('Animation combat:', window.game.attackAnimation)
```

### 🛠️ Solutions Possibles

#### Solution 1 : Forcer le Mode Client

Si le système côté serveur ne fonctionne pas, forcez le mode client :

```javascript
// Dans la console
window.game.onlineManager.serverGameClient = null
```

#### Solution 2 : Redémarrer la Session

```javascript
// Redémarrer la session de jeu
window.game.handleRestartButton()
```

#### Solution 3 : Vérifier les Événements Socket

```javascript
// Écouter les événements socket
window.game.onlineManager.socket.on('server_game_result', (data) => {
  console.log('Résultat serveur:', data)
})

window.game.onlineManager.socket.on('game_state', (data) => {
  console.log('État jeu:', data)
})
```

### 🔧 Corrections Automatiques

#### Correction 1 : Réinitialiser le Système

```javascript
// Réinitialiser complètement
if (window.game) {
  window.game.onlineManager = null
  location.reload()
}
```

#### Correction 2 : Mode Hybride

```javascript
// Forcer le mode hybride (serveur + animations client)
if (window.game && window.game.onlineManager) {
  const client = window.game.onlineManager.getServerGameClient()
  if (client) {
    // Désactiver temporairement le système serveur
    client.isConnected = false
  }
}
```

### 📊 Logs de Diagnostic

#### Activer les Logs Détaillés

```javascript
// Activer les logs détaillés
localStorage.setItem('debug_server_game', 'true')

// Redémarrer la page
location.reload()
```

#### Vérifier les Erreurs

```javascript
// Écouter toutes les erreurs
window.addEventListener('error', (e) => {
  console.error('Erreur globale:', e.error)
})

// Écouter les erreurs de promesses
window.addEventListener('unhandledrejection', (e) => {
  console.error('Promesse rejetée:', e.reason)
})
```

### 🎯 Test Manuel

#### Test 1 : Combat Basique

1. Cliquer sur "Combattre"
2. Vérifier dans la console :
   ```javascript
   console.log('En combat:', window.game.attackAnimation?.isPlayerFighting())
   console.log('Ennemi vivant:', window.game.attackAnimation?.isEnemyIsAlive())
   ```

#### Test 2 : Actions Serveur

```javascript
// Tester directement les actions serveur
const client = window.game.onlineManager.getServerGameClient()
client.startFight()
setTimeout(() => client.attack(), 1000)
```

#### Test 3 : État Synchronisé

```javascript
// Vérifier la synchronisation
setInterval(() => {
  const serverState = client.getGameState()
  const clientPlayer = window.game.player
  
  console.log('Serveur - Or:', serverState.player.gold)
  console.log('Client - Or:', clientPlayer.gold)
  console.log('Synchronisé:', serverState.player.gold === clientPlayer.gold)
}, 2000)
```

### 🚨 Problèmes Courants

#### Problème 1 : Socket Non Connecté

**Symptôme** : Pas de réponse du serveur
**Solution** :
```javascript
// Vérifier la connexion socket
console.log('Socket connecté:', window.game.onlineManager.socket.connected)
```

#### Problème 2 : Session Expirée

**Symptôme** : Erreurs d'authentification
**Solution** :
```javascript
// Renouveler l'authentification
window.game.onlineManager.authenticateWithToken(localStorage.getItem('auth_token'))
```

#### Problème 3 : État Incohérent

**Symptôme** : Données différentes côté client/serveur
**Solution** :
```javascript
// Forcer la synchronisation
const client = window.game.onlineManager.getServerGameClient()
client.requestGameState()
```

### 📞 Support

Si le problème persiste :

1. **Copier les logs de la console**
2. **Exécuter `testServerGameSystem()` et copier le résultat**
3. **Vérifier l'état réseau (onglet Network dans F12)**
4. **Tester avec un autre navigateur**

### 🎮 Mode de Fallback

En cas de problème, le jeu peut fonctionner en mode client uniquement :

```javascript
// Désactiver complètement le système serveur
window.game.onlineManager.serverGameClient = null
window.game.onlineManager.isUsingServerGameLogic = () => false
```

Cela permettra de jouer avec l'ancien système côté client en attendant la résolution du problème.
