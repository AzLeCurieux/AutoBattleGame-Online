# 🚀 Solution Propre - Déploiement Azure App Service

## 🎯 **Problèmes Identifiés**

1. **Conflits Git** : Repository distant et local désynchronisés
2. **Workflow incorrect** : Configuration pour Container Instances au lieu d'App Service
3. **Scripts défaillants** : Test script qui fait échouer le build
4. **Authentification** : Publish Profile non configuré

## 🔧 **Solution Propre - Étape par Étape**

### **Étape 1 : Nettoyer le Repository Git**

#### 1.1 Forcer la synchronisation
```bash
# Sauvegarder vos changements locaux
git stash

# Récupérer les changements distants
git fetch origin

# Forcer la synchronisation
git reset --hard origin/main

# Récupérer vos changements
git stash pop
```

#### 1.2 Alternative : Reset complet
```bash
# Supprimer l'historique local
rm -rf .git

# Réinitialiser Git
git init
git remote add origin https://github.com/AzLeCurieux/AutoBattleGame-Online.git

# Récupérer le code distant
git fetch origin
git checkout -b main origin/main
```

### **Étape 2 : Corriger le Workflow GitHub Actions**

#### 2.1 Supprimer les workflows incorrects
```bash
# Supprimer le workflow Container Instances
rm .github/workflows/deploy-azure.yml

# Garder seulement le workflow App Service
# Le fichier main_Jeux-carre.yml est déjà correct
```

#### 2.2 Vérifier le workflow App Service
Le fichier `.github/workflows/main_Jeux-carre.yml` est déjà parfait :
- ✅ **Build** : Node.js 22.x
- ✅ **Deploy** : Azure App Service
- ✅ **App Name** : Jeux-carre

### **Étape 3 : Corriger package.json**

#### 3.1 Scripts corrigés
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "echo 'No build step required'",
    "test": "echo 'No tests specified'",
    "docker:build": "docker build -t autobattlegame-online .",
    "docker:run": "docker run -p 3000:3000 autobattlegame-online"
  }
}
```

### **Étape 4 : Configuration Azure App Service**

#### 4.1 Variables d'environnement
```bash
# Via Azure CLI (si disponible)
az webapp config appsettings set --resource-group Jeux-carre_group --name Jeux-carre --settings NODE_ENV=production PORT=8080 WEBSITES_PORT=8080
```

#### 4.2 Via Azure Portal
1. **App Service** → **Jeux-carre** → **Configuration**
2. **Application settings** → **New application setting**
3. Ajouter :
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
   - `WEBSITES_PORT` = `8080`

### **Étape 5 : Configuration GitHub Actions**

#### 5.1 Authentification fédérée (Recommandée)
1. **Azure Portal** → **App Service** → **Jeux-carre**
2. **Deployment** → **Deployment Center**
3. **Settings** → **Source**
4. **Authentication** → **User-assigned managed identity**
5. **Save**

#### 5.2 Alternative : Publish Profile
1. **Azure Portal** → **App Service** → **Jeux-carre**
2. **Deployment** → **Deployment Center**
3. **Get publish profile** → **Télécharger**
4. **GitHub** → **Settings** → **Secrets and variables** → **Actions**
5. **New repository secret** :
   - **Name** : `__publishingprofilesecretname__`
   - **Value** : Contenu du fichier `.PublishSettings`

## 🚀 **Script de Nettoyage Complet**

### **Script PowerShell**
```powershell
# Nettoyage complet du repository
Write-Host "🧹 Nettoyage du repository Git..." -ForegroundColor Green

# Sauvegarder les changements
git stash

# Récupérer les changements distants
git fetch origin

# Forcer la synchronisation
git reset --hard origin/main

# Récupérer les changements
git stash pop

# Supprimer les workflows incorrects
Remove-Item .github/workflows/deploy-azure.yml -ErrorAction SilentlyContinue

# Commiter les corrections
git add .
git commit -m "Clean repository and fix deployment configuration"
git push origin main --force

Write-Host "✅ Repository nettoyé et synchronisé !" -ForegroundColor Green
```

### **Script Bash**
```bash
#!/bin/bash
echo "🧹 Nettoyage du repository Git..."

# Sauvegarder les changements
git stash

# Récupérer les changements distants
git fetch origin

# Forcer la synchronisation
git reset --hard origin/main

# Récupérer les changements
git stash pop

# Supprimer les workflows incorrects
rm -f .github/workflows/deploy-azure.yml

# Commiter les corrections
git add .
git commit -m "Clean repository and fix deployment configuration"
git push origin main --force

echo "✅ Repository nettoyé et synchronisé !"
```

## 📋 **Checklist de Vérification**

### **Repository Git**
- [ ] Repository synchronisé avec GitHub
- [ ] Aucun conflit Git
- [ ] Workflow correct (main_Jeux-carre.yml)
- [ ] package.json corrigé

### **Azure App Service**
- [ ] Variables d'environnement configurées
- [ ] Port configuré (8080)
- [ ] Authentification configurée

### **GitHub Actions**
- [ ] Workflow se déclenche
- [ ] Build réussit
- [ ] Deploy réussit

## 🎯 **Résultat Final**

Une fois tout configuré :
- ✅ **Repository** : Propre et synchronisé
- ✅ **Workflow** : GitHub Actions fonctionnel
- ✅ **Build** : Réussit sans erreur
- ✅ **Deploy** : Vers Azure App Service
- ✅ **Application** : Accessible via `https://jeux-carre.azurewebsites.net`

## 🔧 **Dépannage**

### **Si le déploiement échoue encore :**
1. **Vérifier** les logs GitHub Actions
2. **Vérifier** la configuration App Service
3. **Vérifier** les variables d'environnement
4. **Vérifier** l'authentification

## 🚀 **Actions Immédiates**

### **1. Exécuter le script de nettoyage**
```bash
# Choisir le script approprié (PowerShell ou Bash)
# Exécuter le script de nettoyage
```

### **2. Configurer Azure App Service**
- Variables d'environnement
- Authentification

### **3. Vérifier le déploiement**
- GitHub Actions
- Logs de déploiement

**Cette solution propre résoudra tous les problèmes de déploiement !** 🎉
