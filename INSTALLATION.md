# AutoBattleGame Online - Installation Guide

## Prérequis

### 1. Installer Node.js
- Télécharger Node.js depuis https://nodejs.org/
- Installer la version LTS (Long Term Support)
- Vérifier l'installation avec `node --version` et `npm --version`

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer les variables d'environnement
Créer un fichier `.env` à la racine du projet :
```
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3000
NODE_ENV=development
```

## Démarrage du serveur

### Mode développement
```bash
npm run dev
```

### Mode production
```bash
npm start
```

Le serveur sera accessible sur http://localhost:3000

## Structure du projet

```
AutoBattleGame-main/
├── backup/                 # Backup du projet original
├── database/              # Base de données SQLite
├── game/                  # Logique de jeu
├── middleware/            # Middleware d'authentification
├── routes/               # Routes API
├── css/                  # Styles CSS
├── js/                   # JavaScript frontend
├── server.js             # Serveur principal
├── package.json          # Dépendances Node.js
└── index.html            # Interface utilisateur
```

## Fonctionnalités implémentées

### ✅ Backend complet
- Serveur Express.js avec Socket.io
- Base de données SQLite
- Système d'authentification JWT
- API REST complète
- WebSocket pour temps réel

### ✅ Sécurité
- Authentification JWT
- Rate limiting
- Validation des données
- Système anti-triche
- Logs de sécurité

### ✅ Leaderboard en temps réel
- Classement global
- Joueurs en ligne
- Statistiques détaillées
- Mise à jour automatique

### ✅ Base de données
- Tables utilisateurs
- Sessions de jeu
- Scores et classements
- Logs anti-triche

## Prochaines étapes

1. Installer Node.js
2. Exécuter `npm install`
3. Démarrer le serveur avec `npm run dev`
4. Accéder à http://localhost:3000
5. Tester les fonctionnalités online

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur
- `PUT /api/auth/avatar` - Mise à jour avatar
- `POST /api/auth/logout` - Déconnexion

### Jeu
- `POST /api/game/start` - Démarrer une partie
- `POST /api/game/action` - Action de jeu
- `POST /api/game/score` - Soumettre un score
- `POST /api/game/end` - Terminer une partie
- `GET /api/game/history` - Historique des parties

### Leaderboard
- `GET /api/leaderboard` - Classement complet
- `GET /api/leaderboard/top` - Top joueurs
- `GET /api/leaderboard/user/:id` - Rang d'un utilisateur
- `GET /api/leaderboard/online` - Joueurs en ligne
- `GET /api/leaderboard/category/:category` - Classement par catégorie
- `GET /api/leaderboard/stats` - Statistiques globales

## WebSocket Events

### Client → Serveur
- `authenticate` - Authentification
- `game_action` - Action de jeu
- `submit_score` - Soumission de score

### Serveur → Client
- `authenticated` - Confirmation d'authentification
- `game_result` - Résultat d'action de jeu
- `score_submitted` - Confirmation de score
- `leaderboard_update` - Mise à jour du classement
- `online_players_update` - Mise à jour des joueurs en ligne
- `error` - Erreur
- `auth_error` - Erreur d'authentification
