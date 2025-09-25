# 🇨🇦 Configuration Azure Canada - AutoBattleGame

## 🎯 Problèmes Identifiés

1. **Région non autorisée** : "West Europe" n'est pas disponible pour votre abonnement
2. **Container Registry non enregistré** : Le namespace n'est pas activé
3. **Localisation** : Vous êtes au Canada (Québec)

## 🔧 Solutions

### Étape 1 : Enregistrer les Providers Azure

```bash
# Enregistrer Container Registry
az provider register --namespace Microsoft.ContainerRegistry

# Enregistrer Container Instances
az provider register --namespace Microsoft.ContainerInstance

# Vérifier l'enregistrement
az provider show --namespace Microsoft.ContainerRegistry --query registrationState
```

### Étape 2 : Créer le Groupe de Ressources au Canada

```bash
# Supprimer l'ancien groupe (si existe)
az group delete --name AutoBattleGame --yes

# Créer le nouveau groupe au Canada
az group create --name AutoBattleGame --location "Canada Central"
```

### Étape 3 : Créer le Registre de Conteneurs

```bash
# Créer le registre au Canada
az acr create --resource-group AutoBattleGame --name autobattlegame[VOTRE_NOM] --sku Basic --admin-enabled true --location "Canada Central"
```

### Étape 4 : Mettre à Jour la Configuration

#### 4.1 Mettre à jour azure-deploy.yml
```yaml
# Changer la location
location: canadacentral
```

#### 4.2 Mettre à jour .github/workflows/deploy-azure.yml
```yaml
# Changer la location
AZURE_LOCATION: Canada Central
```

## 🚀 Déploiement avec GitHub Codespaces

### Avantages GitHub Codespaces
- ✅ **Environnement pré-configuré** : Node.js, Git, Azure CLI
- ✅ **Déploiement direct** : Pas besoin d'installer localement
- ✅ **Intégration GitHub** : Actions automatiques

### Étapes dans Codespaces

#### 1. Se connecter à Azure
```bash
az login
```

#### 2. Exécuter la configuration
```bash
# Enregistrer les providers
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.ContainerInstance

# Créer le groupe de ressources
az group create --name AutoBattleGame --location "Canada Central"

# Créer le registre
az acr create --resource-group AutoBattleGame --name autobattlegame[VOTRE_NOM] --sku Basic --admin-enabled true --location "Canada Central"
```

#### 3. Récupérer les identifiants
```bash
# Identifiants du registre
az acr credential show --name autobattlegame[VOTRE_NOM] --resource-group AutoBattleGame

# Service principal
az ad sp create-for-rbac --name "AutoBattleGame-GitHub" --role contributor --scopes /subscriptions/[SUBSCRIPTION_ID]/resourceGroups/AutoBattleGame --sdk-auth
```

#### 4. Configurer les secrets GitHub
1. **Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Ajouter les secrets avec les valeurs récupérées

#### 5. Déclencher le déploiement
1. **Actions** → **"Deploy to Azure Container Instances"**
2. **"Run workflow"**

## 🔧 Configuration Mise à Jour

### Fichiers à Modifier

#### azure-deploy.yml
```yaml
# Configuration pour le Canada
apiVersion: 2021-09-01
location: canadacentral
name: autobattlegame
properties:
  containers:
  - name: autobattlegame
    properties:
      image: your-registry.azurecr.io/autobattlegame:latest
      resources:
        requests:
          cpu: 0.5
          memoryInGb: 0.5
      ports:
      - port: 3000
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: PORT
        value: "3000"
  osType: Linux
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 3000
  restartPolicy: Always
```

#### .github/workflows/deploy-azure.yml
```yaml
env:
  AZURE_CONTAINER_REGISTRY: ${{ secrets.AZURE_REGISTRY }}
  CONTAINER_NAME: autobattlegame
  RESOURCE_GROUP: ${{ secrets.AZURE_RESOURCE_GROUP }}
  LOCATION: "Canada Central"  # Changé pour le Canada
```

## 💰 Coûts Azure Student Canada

- **Container Instances** : GRATUIT (dans les limites étudiantes)
- **Container Registry** : GRATUIT (dans les limites étudiantes)
- **Réseau** : GRATUIT
- **Total** : 0€/mois

## 🎯 Régions Disponibles au Canada

- **Canada Central** (Toronto) - Recommandé
- **Canada East** (Québec City)

## ✅ Checklist Canada

- [ ] Providers Azure enregistrés
- [ ] Groupe de ressources créé au Canada
- [ ] Registre de conteneurs créé au Canada
- [ ] Configuration mise à jour pour le Canada
- [ ] Secrets GitHub configurés
- [ ] Déploiement déclenché
- [ ] Application accessible

## 🚨 Dépannage

### Erreur : "Provider not registered"
```bash
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.ContainerInstance
```

### Erreur : "Region not allowed"
- Utiliser "Canada Central" ou "Canada East"
- Vérifier les restrictions de votre abonnement étudiant

### Erreur : "Resource name taken"
- Changer le nom du registre : `autobattlegame[VOTRE_NOM]`

**Votre jeu sera déployé au Canada avec Azure Student !** 🇨🇦🚀
