# 🔧 Dépannage Déploiement Azure App Service

## 🚨 Problème : Code sur GitHub mais Azure ne se déclenche pas

### **Causes Possibles**

1. **Workflow GitHub Actions manquant**
2. **Secrets GitHub non configurés**
3. **Configuration App Service incorrecte**
4. **Variables d'environnement manquantes**

## 🔍 Diagnostic Étape par Étape

### **Étape 1 : Vérifier GitHub Actions**

#### 1.1 Aller sur GitHub
1. **Repository** : https://github.com/azlecurieux/AutoBattleGame-Online
2. **Onglet "Actions"**
3. **Vérifier** s'il y a des workflows

#### 1.2 Si aucun workflow
- Le fichier `.github/workflows/deploy-app-service.yml` n'existe pas
- **Solution** : Créer le workflow

#### 1.3 Si workflow existe mais ne se déclenche pas
- **Vérifier** la syntaxe YAML
- **Vérifier** les secrets GitHub

### **Étape 2 : Vérifier les Secrets GitHub**

#### 2.1 Aller dans Settings
1. **Repository** → **Settings**
2. **Secrets and variables** → **Actions**
3. **Vérifier** que `AZUREAPPSERVICE_PUBLISHPROFILE` existe

#### 2.2 Si secret manquant
- **Récupérer** le Publish Profile
- **Ajouter** le secret

### **Étape 3 : Vérifier la Configuration App Service**

#### 3.1 Variables d'environnement
1. **Azure Portal** → **App Service** → **Configuration**
2. **Application settings**
3. **Vérifier** :
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
   - `WEBSITES_PORT` = `8080`

#### 3.2 Configuration générale
1. **App Service** → **Configuration** → **General settings**
2. **Vérifier** :
   - **Platform** : 64 Bit
   - **Always On** : On
   - **ARR Affinity** : Off

## 🚀 Solutions

### **Solution 1 : Créer le Workflow GitHub Actions**

#### 1.1 Créer le fichier
```yaml
name: Deploy to Azure App Service

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  AZURE_WEBAPP_NAME: AutoBattleGame-Online
  NODE_VERSION: '18.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ env.AZURE_WEBAPP_NAME }}
        publish-profile: ${{ secrets.AZUREAPPSERVICE_PUBLISHPROFILE }}
        package: '.'
```

#### 1.2 Commiter et pousser
```bash
git add .github/workflows/deploy-app-service.yml
git commit -m "Add GitHub Actions workflow for Azure App Service"
git push origin main
```

### **Solution 2 : Récupérer le Publish Profile**

#### 2.1 Via Azure CLI
```bash
az webapp deployment list-publishing-profiles --name AutoBattleGame-Online --resource-group Jeux-carre_group --xml
```

#### 2.2 Via Azure Portal
1. **App Service** → **Deployment** → **Deployment Center**
2. **Local Git** → **Get publish profile**
3. **Télécharger** le fichier `.PublishSettings`

#### 2.3 Ajouter le secret GitHub
1. **GitHub** → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. **Name** : `AZUREAPPSERVICE_PUBLISHPROFILE`
4. **Value** : Contenu du fichier `.PublishSettings`

### **Solution 3 : Configuration App Service**

#### 3.1 Variables d'environnement
```bash
az webapp config appsettings set --resource-group Jeux-carre_group --name AutoBattleGame-Online --settings NODE_ENV=production PORT=8080 WEBSITES_PORT=8080
```

#### 3.2 Configuration générale
```bash
az webapp config set --resource-group Jeux-carre_group --name AutoBattleGame-Online --always-on true
```

## 🔧 Dépannage Avancé

### **Problème : Workflow ne se déclenche pas**
1. **Vérifier** la syntaxe YAML
2. **Vérifier** que le fichier est dans `.github/workflows/`
3. **Vérifier** que le nom du fichier se termine par `.yml`

### **Problème : Déploiement échoue**
1. **Vérifier** les logs GitHub Actions
2. **Vérifier** les logs Azure Portal
3. **Vérifier** que le Publish Profile est valide

### **Problème : Application ne démarre pas**
1. **Vérifier** les variables d'environnement
2. **Vérifier** que le port est configuré
3. **Vérifier** que `server.js` est configuré pour App Service

## 📋 Checklist de Vérification

### **GitHub**
- [ ] Workflow GitHub Actions existe
- [ ] Workflow se déclenche sur push
- [ ] Secrets GitHub configurés
- [ ] Code poussé vers main

### **Azure**
- [ ] Variables d'environnement configurées
- [ ] Port configuré (8080)
- [ ] Always On activé
- [ ] Publish Profile valide

### **Code**
- [ ] `server.js` configuré pour App Service
- [ ] `package.json` avec scripts
- [ ] Dépendances installées

## 🎯 Actions Immédiates

### **1. Vérifier GitHub Actions**
1. Aller sur : https://github.com/azlecurieux/AutoBattleGame-Online
2. **Actions** → Vérifier les workflows

### **2. Créer le workflow si manquant**
- Créer le fichier `.github/workflows/deploy-app-service.yml`
- Commiter et pousser

### **3. Configurer les secrets**
- Récupérer le Publish Profile
- Ajouter le secret GitHub

### **4. Vérifier la configuration App Service**
- Variables d'environnement
- Configuration générale

## 🚀 Résultat Attendu

Une fois corrigé :
- ✅ **GitHub Actions** se déclenche
- ✅ **Azure App Service** reçoit le code
- ✅ **Application** se déploie
- ✅ **URL** : `https://autobattlegame-online.azurewebsites.net`

**Le déploiement devrait fonctionner après ces corrections !** 🎉
