# 🔧 Correction Déploiement Azure App Service

## 🚨 Problème Identifié

**Erreur** : "Aucune demande de CD trouvée dans le registre de conteneurs"

**Cause** : Azure App Service est configuré pour déployer depuis un registre de conteneurs au lieu de GitHub directement.

## 🎯 Solution : Configuration Déploiement GitHub

### Étape 1 : Configurer le Déploiement GitHub dans Azure Portal

#### 1.1 Aller dans Azure Portal
1. **App Service** → **AutoBattleGame-Online**
2. **Deployment** → **Deployment Center**
3. **Settings** → **Source**

#### 1.2 Configurer GitHub
1. **Source** : GitHub
2. **Organization** : AzLeCurieux
3. **Repository** : AutoBattleGame-Online
4. **Branch** : main
5. **Build Provider** : GitHub Actions
6. **Runtime stack** : Node 18 LTS
7. **Save**

### Étape 2 : Vérifier la Configuration

#### 2.1 Variables d'environnement
1. **App Service** → **Configuration** → **Application settings**
2. Ajouter :
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
   - `WEBSITES_PORT` = `8080`

#### 2.2 Configuration du port
1. **App Service** → **Configuration** → **General settings**
2. **Platform** : 64 Bit
3. **Always On** : On
4. **ARR Affinity** : Off

### Étape 3 : Pousser le Code

#### 3.1 Résoudre le conflit Git
```bash
# Forcer le push
git push origin main --force
```

#### 3.2 Vérifier le déploiement
1. **GitHub** → **Actions**
2. Vérifier que le workflow se déclenche
3. **Azure Portal** → **Deployment Center** → **Logs**

## 🔧 Configuration Alternative : Workflow GitHub Actions

### Si le déploiement automatique ne fonctionne pas

#### Créer le workflow manuel
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

## 🚨 Dépannage

### Problème : Déploiement ne se déclenche pas
1. **Vérifier** que le code est poussé vers GitHub
2. **Vérifier** que le workflow GitHub Actions existe
3. **Vérifier** que les secrets sont configurés

### Problème : Application ne démarre pas
1. **Vérifier** les variables d'environnement
2. **Vérifier** les logs dans Azure Portal
3. **Vérifier** que le port est configuré

### Problème : Erreur de build
1. **Vérifier** que `package.json` existe
2. **Vérifier** que les dépendances sont installées
3. **Vérifier** que le script de build fonctionne

## 📋 Checklist de Vérification

### Azure Portal
- [ ] App Service configuré pour GitHub
- [ ] Variables d'environnement configurées
- [ ] Port configuré (8080)
- [ ] Always On activé

### GitHub
- [ ] Code poussé vers main
- [ ] Workflow GitHub Actions existe
- [ ] Secrets configurés
- [ ] Actions se déclenchent

### Code
- [ ] `server.js` configuré pour App Service
- [ ] `package.json` avec scripts
- [ ] Dépendances installées

## 🎯 Actions Immédiates

### 1. Configurer le déploiement GitHub
1. **Azure Portal** → **App Service** → **Deployment Center**
2. **Source** → **GitHub** → **Configurer**

### 2. Pousser le code
```bash
git push origin main --force
```

### 3. Vérifier le déploiement
1. **GitHub** → **Actions**
2. **Azure Portal** → **Deployment Center** → **Logs**

## 🚀 Résultat Attendu

Une fois configuré, votre application sera accessible via :
- **URL** : `https://autobattlegame-online.azurewebsites.net`
- **Déploiement automatique** à chaque push sur main
- **Logs** disponibles dans Azure Portal et GitHub Actions

**Le déploiement devrait fonctionner après ces corrections !** 🎉
