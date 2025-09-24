# Guide de Déploiement - AutoBattleGame Online

## 🚀 Déploiement sur Azure Container Instances

### Prérequis
- Compte Azure avec abonnement actif
- Azure CLI installé
- Docker installé
- Compte GitHub

### 1. Configuration Azure

#### Créer un Resource Group
```bash
az group create --name autobattlegame-rg --location westeurope
```

#### Créer un Container Registry
```bash
az acr create --resource-group autobattlegame-rg --name autobattlegameacr --sku Basic
```

#### Activer l'admin user
```bash
az acr update -n autobattlegameacr --admin-enabled true
```

### 2. Configuration GitHub Secrets

Ajoutez ces secrets dans votre repository GitHub (Settings > Secrets and variables > Actions) :

- `AZURE_CREDENTIALS` : Service Principal JSON
- `ACR_USERNAME` : Nom du registry Azure
- `ACR_PASSWORD` : Mot de passe du registry Azure

#### Créer un Service Principal
```bash
az ad sp create-for-rbac --name "autobattlegame-sp" --role contributor --scopes /subscriptions/{subscription-id}/resourceGroups/autobattlegame-rg --sdk-auth
```

### 3. Configuration du projet

#### Mettre à jour azure-deploy.yml
Remplacez `your-registry.azurecr.io` par votre registry Azure :
```yaml
image: autobattlegameacr.azurecr.io/autobattlegame-online:latest
```

#### Mettre à jour .github/workflows/deploy-azure.yml
Remplacez les variables d'environnement :
```yaml
env:
  AZURE_CONTAINER_REGISTRY: autobattlegameacr.azurecr.io
  CONTAINER_NAME: autobattlegame-online
  RESOURCE_GROUP: autobattlegame-rg
  LOCATION: westeurope
```

### 4. Déploiement local (test)

#### Construire l'image Docker
```bash
npm run docker:build
```

#### Tester localement
```bash
npm run docker:run
```

### 5. Déploiement automatique

1. Poussez votre code sur la branche `main`
2. Le workflow GitHub Actions se déclenche automatiquement
3. L'application est déployée sur Azure Container Instances

### 6. Accès à l'application

L'application sera accessible via :
- URL publique générée automatiquement
- Format : `https://autobattlegame-online-{hash}.westeurope.azurecontainer.io`

### 7. Monitoring

#### Voir les logs
```bash
az container logs --resource-group autobattlegame-rg --name autobattlegame-online-{hash}
```

#### Voir le statut
```bash
az container show --resource-group autobattlegame-rg --name autobattlegame-online-{hash}
```

### 8. Mise à jour

Pour mettre à jour l'application :
1. Modifiez le code
2. Committez et poussez sur `main`
3. Le déploiement se fait automatiquement

### 9. Coûts

- Azure Container Registry : ~5€/mois
- Azure Container Instances : ~0.01€/heure
- Total estimé : ~10-15€/mois pour un usage modéré

### 10. Sécurité

- L'application utilise HTTPS automatiquement
- Base de données SQLite persistante
- Rate limiting activé
- CORS configuré
- Helmet pour la sécurité HTTP

## 🔧 Dépannage

### Problèmes courants

1. **Erreur de build Docker**
   - Vérifiez que tous les fichiers sont présents
   - Vérifiez le .dockerignore

2. **Erreur de déploiement Azure**
   - Vérifiez les credentials GitHub
   - Vérifiez les permissions du Service Principal

3. **Application non accessible**
   - Vérifiez que le port 3000 est exposé
   - Vérifiez les logs Azure

### Support

Pour toute question, consultez :
- [Documentation Azure Container Instances](https://docs.microsoft.com/en-us/azure/container-instances/)
- [Documentation GitHub Actions](https://docs.github.com/en/actions)

