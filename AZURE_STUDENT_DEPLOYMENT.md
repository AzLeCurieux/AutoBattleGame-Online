# 🎓 Déploiement Azure Student - AutoBattleGame

## 🎯 Avantages Azure Student

- **Crédit gratuit** : 100$ par an
- **Services gratuits** : Container Instances, Container Registry
- **Pas de carte de crédit** requise
- **Parfait pour 15 utilisateurs**

## 📋 Étapes de Déploiement

### Étape 1 : Connexion Azure Student

#### 1.1 Se connecter à Azure
```bash
az login
```
*Une fenêtre de navigateur s'ouvrira*

#### 1.2 Vérifier le compte étudiant
```bash
az account show
```
*Vérifiez que vous êtes connecté avec votre compte étudiant*

### Étape 2 : Créer les Ressources Azure

#### 2.1 Créer le groupe de ressources
```bash
az group create --name AutoBattleGame --location "West Europe"
```

#### 2.2 Créer le registre de conteneurs
```bash
# Remplacez "autobattlegame[VOTRE_NOM]" par un nom unique
az acr create --resource-group AutoBattleGame --name autobattlegame[VOTRE_NOM] --sku Basic --admin-enabled true
```

#### 2.3 Récupérer les identifiants du registre
```bash
az acr credential show --name autobattlegame[VOTRE_NOM] --resource-group AutoBattleGame
```

#### 2.4 Créer le service principal
```bash
# Récupérer votre subscription ID
az account show --query id --output tsv

# Créer le service principal (remplacer [SUBSCRIPTION_ID])
az ad sp create-for-rbac --name "AutoBattleGame-GitHub" --role contributor --scopes /subscriptions/[SUBSCRIPTION_ID]/resourceGroups/AutoBattleGame --sdk-auth
```

### Étape 3 : Configuration GitHub

#### 3.1 Pousser le code vers GitHub
```bash
# Si pas encore fait
git push -u origin main --force
```

#### 3.2 Configurer les secrets GitHub
1. Aller sur : https://github.com/azlecurieux/AutoBattleGame-Online
2. **Settings** → **Secrets and variables** → **Actions**
3. **"New repository secret"** pour chaque secret :

| Secret | Valeur |
|--------|--------|
| `AZURE_CREDENTIALS` | JSON du service principal (étape 2.4) |
| `AZURE_REGISTRY` | `autobattlegame[VOTRE_NOM].azurecr.io` |
| `AZURE_REGISTRY_USERNAME` | `autobattlegame[VOTRE_NOM]` |
| `AZURE_REGISTRY_PASSWORD` | Mot de passe de l'étape 2.3 |
| `AZURE_RESOURCE_GROUP` | `AutoBattleGame` |
| `AZURE_LOCATION` | `West Europe` |

### Étape 4 : Déploiement Automatique

#### 4.1 Déclencher le workflow
1. **GitHub** → **Actions**
2. **"Deploy to Azure Container Instances"**
3. **"Run workflow"** → **"Run workflow"**

#### 4.2 Suivre le déploiement
- ✅ Checkout code
- ✅ Set up Node.js
- ✅ Install dependencies
- ✅ Login to Azure
- ✅ Build and push Docker image
- ✅ Deploy to Azure Container Instances

### Étape 5 : Vérification

#### 5.1 Récupérer l'URL
```bash
# Vérifier l'IP publique
az container show --resource-group AutoBattleGame --name autobattlegame --query ipAddress.ip --output tsv
```

#### 5.2 Tester l'application
- **URL** : `http://[IP_PUBLIQUE]:3000`
- **Ou** : `http://autobattlegame.westeurope.azurecontainer.io:3000`

## 💰 Coûts Azure Student

### Services Utilisés
- **Container Instances** : 0.5 vCPU, 0.5 GB → **GRATUIT** (dans les limites étudiantes)
- **Container Registry** : Basic → **GRATUIT** (dans les limites étudiantes)
- **Réseau** : **GRATUIT** (dans les limites étudiantes)

### Limites Azure Student
- **Crédit** : 100$ par an
- **Services gratuits** : Container Instances, Container Registry
- **Pas de frais** pour ce projet

## 🔧 Dépannage Azure Student

### Problème : Quota dépassé
```bash
# Vérifier les quotas
az quota list --scope /subscriptions/[SUBSCRIPTION_ID]/providers/Microsoft.ContainerInstance/locations/westeurope
```

### Problème : Services non disponibles
- Vérifier que votre compte étudiant est actif
- Contacter le support Azure Student si nécessaire

### Problème : Authentification
```bash
# Se reconnecter
az logout
az login
```

## 📊 Monitoring

### Vérifier les ressources
```bash
# Lister les conteneurs
az container list --resource-group AutoBattleGame

# Vérifier les logs
az container logs --resource-group AutoBattleGame --name autobattlegame
```

### Vérifier les coûts
1. **Azure Portal** → **Cost Management + Billing**
2. Vérifier que les coûts sont à 0$ (services gratuits)

## ✅ Checklist Azure Student

- [ ] Compte Azure Student actif
- [ ] Connexion Azure CLI réussie
- [ ] Groupe de ressources créé
- [ ] Registre de conteneurs créé
- [ ] Service principal créé
- [ ] Code poussé vers GitHub
- [ ] Secrets GitHub configurés
- [ ] Workflow GitHub Actions exécuté
- [ ] Application accessible
- [ ] Coûts vérifiés (0$)

## 🎉 Avantages du Déploiement

- **Gratuit** avec Azure Student
- **Automatique** via GitHub Actions
- **Scalable** pour 15 utilisateurs
- **Sécurisé** avec authentification
- **Monitoring** intégré

**Votre jeu sera en ligne gratuitement avec Azure Student !** 🚀
