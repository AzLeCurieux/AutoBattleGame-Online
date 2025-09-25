# 🚀 Déploiement Azure App Service - AutoBattleGame

## 🎯 Configuration Actuelle

- **Service** : Azure App Service
- **Plan** : B1 (Basic)
- **Région** : Canada Central ✅
- **OS** : Linux ✅
- **Repository** : AutoBattleGame-Online ✅

## 🔧 Configuration pour Azure App Service

### Problème Identifié
Azure App Service utilise un déploiement différent d'Azure Container Instances. Nous devons adapter la configuration.

### Solution : Créer un Workflow GitHub Actions pour App Service

## 📝 Étapes de Configuration

### 1. Créer le Workflow App Service

Créer le fichier `.github/workflows/deploy-app-service.yml` :

```yaml
name: Deploy to Azure App Service

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  AZURE_WEBAPP_NAME: AutoBattleGame-Online
  AZURE_WEBAPP_PACKAGE_PATH: '.'
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

    - name: Build application
      run: npm run build || echo "No build script found"

    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ env.AZURE_WEBAPP_NAME }}
        publish-profile: ${{ secrets.AZUREAPPSERVICE_PUBLISHPROFILE }}
        package: ${{ env.AZURE_WEBAPP_PACKAGE_PATH }}
```

### 2. Récupérer le Publish Profile

#### Dans Azure Portal :
1. Aller dans votre App Service
2. **Deployment** → **Deployment Center**
3. **Local Git** → **Get publish profile**
4. Télécharger le fichier `.PublishSettings`

#### Ou via Azure CLI :
```bash
az webapp deployment list-publishing-profiles --name AutoBattleGame-Online --resource-group Jeux-carre_group --xml
```

### 3. Configurer les Secrets GitHub

1. **Repository** → **Settings** → **Secrets and variables** → **Actions**
2. **"New repository secret"** :
   - **Name** : `AZUREAPPSERVICE_PUBLISHPROFILE`
   - **Value** : Contenu du fichier `.PublishSettings`

### 4. Configuration App Service

#### Variables d'environnement dans Azure Portal :
1. **App Service** → **Configuration** → **Application settings**
2. Ajouter :
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
   - `WEBSITES_PORT` = `8080`

#### Ou via Azure CLI :
```bash
az webapp config appsettings set --resource-group Jeux-carre_group --name AutoBattleGame-Online --settings NODE_ENV=production PORT=8080 WEBSITES_PORT=8080
```

## 🔧 Modifications Nécessaires

### 1. Mettre à jour server.js

```javascript
// Changer le port pour App Service
const PORT = process.env.PORT || process.env.WEBSITES_PORT || 3000;

// Écouter sur toutes les interfaces
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🎮 Game available at http://localhost:${PORT}`);
});
```

### 2. Créer un fichier web.config (optionnel)

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <webSocket enabled="false" />
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeInspector" patternSyntax="ECMAScript" stopProcessing="true">
          <match url="^server.js\/debug[\/]?" />
        </rule>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}"/>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="server.js"/>
        </rule>
      </rules>
    </rewrite>
    <security>
      <requestFiltering>
        <hiddenSegments>
          <remove segment="bin"/>
        </hiddenSegments>
      </requestFiltering>
    </security>
    <httpErrors existingResponse="PassThrough" />
    <iisnode watchedFiles="web.config;*.js"/>
  </system.webServer>
</configuration>
```

## 🚀 Déploiement

### 1. Commiter les changements
```bash
git add .
git commit -m "Configure for Azure App Service deployment"
git push origin main
```

### 2. Déclencher le déploiement
1. **GitHub** → **Actions**
2. **"Deploy to Azure App Service"**
3. **"Run workflow"**

## 💰 Coûts Azure App Service B1

- **Plan B1** : ~13€/mois
- **Parfait pour 15 utilisateurs**
- **Inclus** : SSL, custom domain, staging slots

## 🔧 Dépannage

### Problème : Application ne démarre pas
1. Vérifier les logs : **App Service** → **Log stream**
2. Vérifier les variables d'environnement
3. Vérifier que le port est configuré

### Problème : Déploiement échoue
1. Vérifier le Publish Profile
2. Vérifier les secrets GitHub
3. Vérifier les logs GitHub Actions

### Problème : Socket.io ne fonctionne pas
1. Activer WebSockets dans App Service
2. Configurer les variables d'environnement

## ✅ Avantages App Service

- ✅ **Déploiement automatique** via GitHub
- ✅ **SSL gratuit** et custom domain
- ✅ **Scaling automatique**
- ✅ **Monitoring intégré**
- ✅ **Staging slots** pour les tests

## 🎯 URL de l'Application

Votre jeu sera accessible via :
- **URL par défaut** : `https://autobattlegame-online.azurewebsites.net`
- **Custom domain** : Possible avec App Service

**Votre jeu sera déployé sur Azure App Service au Canada !** 🇨🇦🚀
