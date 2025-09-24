# Changelog - AutoBattleGame Online

## [1.1.0] - 2024-01-XX

### Supprimé
- **Partie JavaFX** : Suppression complète du code Java et des fichiers Maven
- **Dossier JavaFX_Maven** : Tous les fichiers Java, ressources et configurations Maven
- **Références Java** : Mise à jour de tous les fichiers de documentation

### Modifié
- **README.md** : Suppression des références à JavaFX, description mise à jour
- **package.json** : Description mise à jour pour refléter la version web uniquement
- **.gitignore** : Ajout du dossier JavaFX_Maven à ignorer
- **.dockerignore** : Suppression des références JavaFX

### Ajouté
- **cleanup-java.bat** : Script pour supprimer le dossier JavaFX_Maven
- **CHANGELOG.md** : Ce fichier de suivi des changements

### Notes
- Le projet est maintenant 100% web (Node.js + HTML/CSS/JavaScript)
- Toutes les fonctionnalités du jeu original sont préservées
- Prêt pour le déploiement sur Azure Container Instances
- Compatible avec Docker et GitHub Actions

## [1.0.0] - 2024-01-XX

### Ajouté
- Version web complète du jeu AutoBattleGame
- Système de combat automatique au tour par tour
- Système de progression avec niveaux et boss
- Améliorations normales et de boss
- Système d'économie basé sur l'or
- Interface utilisateur responsive
- Système d'authentification
- Leaderboard en temps réel
- Notifications de nouveaux records
- Déploiement Docker et Azure
- Workflow GitHub Actions

