# AutoBattleGame - Version Web

Un jeu de combat automatique en ligne avec système de progression, améliorations et classement en temps réel.

## 🎮 Description du Jeu

AutoBattleGame est un jeu de combat automatique où vous affrontez des ennemis dans des combats au tour par tour. Le jeu propose un système de progression avec des améliorations, des boss, et une économie basée sur l'or.

## ✨ Fonctionnalités

### Combat Automatique
- **Combat au tour par tour** : Les combats se déroulent automatiquement avec des animations fluides
- **Système de dégâts critiques** : Possibilité d'infliger des dégâts critiques avec des chances et multiplicateurs configurables
- **Animations d'attaque** : Transitions visuelles lors des attaques
- **Dégâts flottants** : Affichage temporaire des dégâts infligés

### Système de Progression
- **Niveaux** : Progression automatique après chaque ennemi vaincu
- **Croissance des ennemis** : Santé et dégâts augmentent selon des formules mathématiques
- **Boss spéciaux** : Ennemis plus puissants tous les 5 niveaux (2x santé, 1.25x dégâts)

### Améliorations
- **Améliorations normales** (après chaque combat) :
  - Santé : +25 à +55 points
  - Dégâts : +10 à +30 points
  - Soin complet
  - +3 or
  - Dégâts critiques : +5% à +20%
  - Chance critique : +2% à +7%

- **Améliorations de Boss** (niveaux multiples de 5) :
  - Soin 10% de la santé max à chaque fin de round
  - +10 dégâts à chaque fin de round
  - +25 santé max à chaque fin de round

### Économie
- **Système d'or** : Gagné après chaque ennemi vaincu
- **Interface de camp** : Dépenser l'or pour se soigner (5 or)

### Interface Utilisateur
- **Design moderne** : Interface sombre avec des couleurs vives
- **Responsive** : Adapté aux écrans desktop, tablette et mobile
- **Animations fluides** : Transitions et effets visuels
- **Audio** : Sons synthétiques pour les effets

## 🚀 Installation et Utilisation

### Prérequis
- Un navigateur web moderne (Chrome, Firefox, Safari, Edge)
- Support JavaScript activé

### Installation
1. Téléchargez tous les fichiers du projet
2. Ouvrez `index.html` dans votre navigateur
3. Le jeu se lance automatiquement !

### Structure des Fichiers
```
AutoBattleGame-Web/
├── index.html              # Page principale
├── css/
│   ├── main.css           # Styles principaux
│   ├── animations.css     # Animations
│   └── responsive.css     # Design responsive
├── js/
│   ├── main.js           # Point d'entrée
│   ├── Game.js           # Contrôleur principal
│   ├── game/             # Classes de jeu
│   ├── battle/           # Système de combat
│   ├── ui/               # Interface utilisateur
│   └── utils/            # Utilitaires
└── README.md             # Ce fichier
```

## 🎯 Contrôles

### Clavier
- **Espace/Entrée** : Commencer/continuer un combat
- **Échap** : Arrêter le combat en cours
- **C** : Ouvrir/fermer l'interface du camp
- **R** : Redémarrer le jeu
- **Ctrl+M** : Basculer le son
- **Ctrl+S** : Sauvegarder manuellement

### Souris/Tactile
- **Boutons** : Interface intuitive avec boutons cliquables
- **Modales** : Cliquer à l'extérieur pour fermer

## 💾 Sauvegarde

- **Sauvegarde automatique** : Toutes les 30 secondes
- **Sauvegarde à la fermeture** : Automatique lors de la fermeture du navigateur
- **Sauvegarde manuelle** : Ctrl+S
- **Durée de validité** : 7 jours maximum

## 🎨 Personnalisation

### Modifier les couleurs
Éditez `css/main.css` pour changer les couleurs du jeu :
- Joueur : `#1e90ff` (bleu)
- Ennemis : `#ff4444` (rouge)
- Boss : `#ff8800` (orange)
- Or : `#ffd700` (doré)

### Ajuster les animations
Modifiez `css/animations.css` pour personnaliser les animations.

### Changer les sons
Éditez `js/utils/AudioManager.js` pour modifier les sons synthétiques.

## 🔧 Développement

### Architecture
Le jeu utilise une architecture modulaire avec des classes séparées :
- **Game** : Contrôleur principal
- **Player/Enemy** : Classes de combattants
- **AttackAnimation** : Gestion des combats
- **Upgrades** : Système d'améliorations
- **UIController** : Interface utilisateur

### Ajouter de nouvelles fonctionnalités
1. Créez une nouvelle classe dans le dossier approprié
2. Importez-la dans `index.html`
3. Intégrez-la dans la classe `Game`

## 🐛 Dépannage

### Le jeu ne se lance pas
- Vérifiez que JavaScript est activé
- Ouvrez la console développeur (F12) pour voir les erreurs
- Assurez-vous que tous les fichiers sont présents

### Problèmes de performance
- Fermez les autres onglets du navigateur
- Videz le cache du navigateur
- Utilisez un navigateur récent

### Sauvegarde perdue
- Vérifiez que localStorage est activé
- Les sauvegardes expirent après 7 jours
- Utilisez Ctrl+S pour sauvegarder manuellement

## 📱 Compatibilité

### Navigateurs supportés
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Appareils
- **Desktop** : Optimisé pour 1920x1080
- **Tablette** : Adapté aux écrans tactiles
- **Mobile** : Interface responsive

## 🎵 Audio

Le jeu utilise l'API Web Audio pour générer des sons synthétiques :
- Sons d'impact
- Sons de coups critiques
- Sons de soin
- Sons de niveau supérieur
- Sons de boutons

## 🔮 Fonctionnalités Futures

- [ ] Mode multijoueur
- [ ] Nouveaux types d'ennemis
- [ ] Système d'équipement
- [ ] Thèmes visuels
- [ ] Statistiques détaillées
- [ ] Mode difficile

## 📄 Licence

Ce projet est libre d'utilisation et de modification.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Ajouter de nouvelles fonctionnalités
- Améliorer la documentation

---

**Amusez-vous bien avec AutoBattleGame ! 🎮**
