# 🎮 AutoBattleGame - Version Web

Un jeu de combat automatique en ligne avec système de progression, améliorations et classement en temps réel.


## 🎯 Fonctionnalités

- **Combat automatique** au tour par tour
- **Système de progression** avec niveaux et boss
- **Améliorations** normales et de boss
- **Économie** basée sur l'or
- **Leaderboard** en temps réel
- **Authentification** utilisateur
- **Interface responsive**

## 🛠️ Technologies

- **Backend** : Node.js, Express, Socket.io
- **Base de données** : SQLite
- **Frontend** : HTML, CSS, JavaScript
- **Déploiement** : Azure App Service
- **CI/CD** : GitHub Actions

## 📁 Structure du Projet

```
├── server.js              # Serveur principal
├── package.json           # Dépendances Node.js
├── index.html            # Page principale du jeu
├── login.html            # Page de connexion
├── css/                  # Styles CSS
├── js/                   # Code JavaScript
│   ├── Game.js          # Logique principale du jeu
│   ├── online/          # Fonctionnalités en ligne
│   ├── battle/          # Système de combat
│   ├── game/            # Classes du jeu
│   └── ui/              # Interface utilisateur
├── database/             # Base de données SQLite
├── routes/               # Routes API
├── middleware/           # Middleware d'authentification
└── game/                 # Gestionnaire de jeu
```

## 🚀 Installation Locale

```bash
# Installer les dépendances
npm install

# Démarrer le serveur
npm start

# Ou en mode développement
npm run dev
```

## 📊 Configuration

- **Port** : 3000 (local) / 8080 (Azure)
- **Base de données** : SQLite (game.db)
- **Authentification** : JWT
- **WebSocket** : Socket.io pour le temps réel

## 🎮 Comment Jouer

1. **Créer un compte** ou se connecter
2. **Commencer une partie** - les combats sont automatiques
3. **Choisir des améliorations** après chaque combat
4. **Progresser** et atteindre des niveaux plus élevés
5. **Comparer** votre score sur le leaderboard

## 🔧 Scripts Utiles

```bash
# Réinitialiser la base de données
node reset-leaderboard.js

# Forcer la mise à jour du leaderboard
node force-update-leaderboard.js
```

## 📄 Licence

Ce projet est libre d'utilisation et de modification.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Ajouter de nouvelles fonctionnalités
