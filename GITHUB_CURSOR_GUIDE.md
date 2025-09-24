# 🔗 Guide GitHub + Cursor - AutoBattleGame

## 📋 Étape 3 : Configuration GitHub (Détaillée)

### 3.1 Créer le Repository GitHub

#### Option A : Via l'interface web GitHub
1. **Aller sur GitHub.com** et se connecter
2. **Cliquer sur le "+" en haut à droite** → "New repository"
3. **Remplir les informations** :
   - **Repository name** : `AutoBattleGame-Online`
   - **Description** : `AutoBattleGame - Online Battle Game with Real-time Leaderboard`
   - **Visibility** : 
     - ✅ **Public** (gratuit, visible par tous)
     - ❌ **Private** (payant, visible par vous seulement)
4. **Ne PAS cocher** :
   - ❌ "Add a README file"
   - ❌ "Add .gitignore"
   - ❌ "Choose a license"
5. **Cliquer "Create repository"**

#### Option B : Via GitHub CLI (si installé)
```bash
# Installer GitHub CLI
winget install GitHub.cli

# Se connecter
gh auth login

# Créer le repository
gh repo create AutoBattleGame-Online --public --description "AutoBattleGame - Online Battle Game"
```

### 3.2 Pousser le Code (Détaillé)

#### 3.2.1 Initialiser Git dans Cursor
```bash
# Dans le terminal de Cursor (Ctrl+`)
git init
```

#### 3.2.2 Ajouter tous les fichiers
```bash
# Ajouter tous les fichiers au staging
git add .

# Vérifier les fichiers ajoutés
git status
```

#### 3.2.3 Premier commit
```bash
# Créer le premier commit
git commit -m "Initial commit - AutoBattleGame Online with Azure deployment"
```

#### 3.2.4 Connecter au repository GitHub
```bash
# Ajouter le remote GitHub (remplacer [VOTRE_USERNAME])
git remote add origin https://github.com/[VOTRE_USERNAME]/AutoBattleGame-Online.git

# Vérifier la connexion
git remote -v
```

#### 3.2.5 Pousser le code
```bash
# Pousser vers GitHub
git push -u origin main
```

**Si erreur "main branch doesn't exist"** :
```bash
# Créer la branche main
git branch -M main
git push -u origin main
```

### 3.3 Configurer les Secrets GitHub (Détaillé)

#### 3.3.1 Accéder aux secrets
1. **Aller dans votre repository** : `https://github.com/[VOTRE_USERNAME]/AutoBattleGame-Online`
2. **Cliquer sur "Settings"** (onglet en haut)
3. **Dans le menu de gauche** : "Secrets and variables" → "Actions"
4. **Cliquer sur "New repository secret"**

#### 3.3.2 Ajouter chaque secret

**Secret 1 : AZURE_CREDENTIALS**
- **Name** : `AZURE_CREDENTIALS`
- **Secret** : Le JSON du service principal (exemple) :
```json
{
  "clientId": "12345678-1234-1234-1234-123456789012",
  "clientSecret": "abcdefgh-ijkl-mnop-qrst-uvwxyz123456",
  "subscriptionId": "87654321-4321-4321-4321-210987654321",
  "tenantId": "11111111-2222-3333-4444-555555555555"
}
```

**Secret 2 : AZURE_REGISTRY**
- **Name** : `AZURE_REGISTRY`
- **Secret** : `autobattlegame[VOTRE_NOM].azurecr.io`

**Secret 3 : AZURE_REGISTRY_USERNAME**
- **Name** : `AZURE_REGISTRY_USERNAME`
- **Secret** : `autobattlegame[VOTRE_NOM]`

**Secret 4 : AZURE_REGISTRY_PASSWORD**
- **Name** : `AZURE_REGISTRY_PASSWORD`
- **Secret** : Le mot de passe du registre (récupéré via Azure CLI)

**Secret 5 : AZURE_RESOURCE_GROUP**
- **Name** : `AZURE_RESOURCE_GROUP`
- **Secret** : `AutoBattleGame`

**Secret 6 : AZURE_LOCATION**
- **Name** : `AZURE_LOCATION`
- **Secret** : `West Europe`

#### 3.3.3 Vérifier les secrets
- Vous devriez voir 6 secrets dans la liste
- Chaque secret a un nom et une valeur masquée

## 🚀 Étape 4 : Déploiement Automatique (Détaillé)

### 4.1 Accéder aux Actions GitHub
1. **Aller dans votre repository** : `https://github.com/[VOTRE_USERNAME]/AutoBattleGame-Online`
2. **Cliquer sur l'onglet "Actions"** (en haut)
3. **Vous devriez voir** : "Deploy to Azure Container Instances"

### 4.2 Déclencher le déploiement
1. **Cliquer sur "Deploy to Azure Container Instances"**
2. **Cliquer sur "Run workflow"** (bouton vert)
3. **Laisser "Use workflow from"** : `Branch: main`
4. **Cliquer sur "Run workflow"** (bouton vert)

### 4.3 Suivre le déploiement
1. **Cliquer sur le workflow en cours** (titre en bleu)
2. **Cliquer sur "build-and-deploy"** (job en cours)
3. **Suivre les étapes** :
   - ✅ Checkout code
   - ✅ Set up Node.js
   - ✅ Install dependencies
   - ✅ Login to Azure
   - ✅ Login to Azure Container Registry
   - ✅ Build and push Docker image
   - ✅ Deploy to Azure Container Instances

### 4.4 Vérifier le succès
- **Toutes les étapes doivent être vertes** ✅
- **Si une étape échoue** (rouge ❌), cliquer dessus pour voir l'erreur

## 🔧 Intégration Cursor avec GitHub

### Configuration Git dans Cursor
1. **Ouvrir Cursor**
2. **Ctrl+Shift+P** → "Git: Initialize Repository"
3. **Configurer Git** (si pas déjà fait) :
```bash
git config --global user.name "Votre Nom"
git config --global user.email "votre.email@example.com"
```

### Workflow de développement dans Cursor
1. **Modifier le code** dans Cursor
2. **Sauvegarder** (Ctrl+S)
3. **Dans le terminal** (Ctrl+`) :
```bash
git add .
git commit -m "Description des changements"
git push
```
4. **Le déploiement se déclenche automatiquement** via GitHub Actions

### Extensions Cursor recommandées
- **GitLens** : Améliore l'intégration Git
- **GitHub Pull Requests** : Gestion des PR
- **Docker** : Support Docker

## 🚨 Dépannage GitHub

### Problème : Repository non trouvé
```bash
# Vérifier l'URL du remote
git remote -v

# Corriger si nécessaire
git remote set-url origin https://github.com/[VOTRE_USERNAME]/AutoBattleGame-Online.git
```

### Problème : Authentification GitHub
```bash
# Utiliser un token personnel
git remote set-url origin https://[VOTRE_USERNAME]:[VOTRE_TOKEN]@github.com/[VOTRE_USERNAME]/AutoBattleGame-Online.git
```

### Problème : Workflow ne se déclenche pas
1. **Vérifier que le fichier** `.github/workflows/deploy-azure.yml` existe
2. **Vérifier que le code est poussé** sur la branche `main`
3. **Vérifier que les secrets** sont configurés
4. **Vérifier que le repository** est public ou que les actions sont activées

### Problème : Erreur de permissions
1. **Aller dans Settings** → "Actions" → "General"
2. **Vérifier que "Allow all actions and reusable workflows"** est sélectionné
3. **Sauvegarder**

## 📊 Monitoring du Déploiement

### Vérifier le statut
1. **GitHub** → "Actions" → Voir les workflows
2. **Azure Portal** → "Container Instances" → Voir les conteneurs
3. **Logs** : Cliquer sur chaque étape pour voir les détails

### URL de l'application
- **Format** : `http://autobattlegame.westeurope.azurecontainer.io:3000`
- **Ou** : `http://[IP_PUBLIQUE]:3000`

## ✅ Checklist Complète

### GitHub
- [ ] Repository créé : `AutoBattleGame-Online`
- [ ] Code poussé vers GitHub
- [ ] 6 secrets configurés
- [ ] Actions activées

### Déploiement
- [ ] Workflow GitHub Actions exécuté
- [ ] Toutes les étapes réussies
- [ ] Application accessible via l'URL
- [ ] Tests fonctionnels effectués

### Cursor
- [ ] Git configuré
- [ ] Extensions installées
- [ ] Workflow de développement établi

**🎉 Votre jeu est maintenant en ligne et se met à jour automatiquement !**
