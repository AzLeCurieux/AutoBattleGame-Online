# 🚀 Guide de Déploiement Azure - AutoBattleGame

## 📋 Configuration Minimale pour 15 Utilisateurs

### Ressources Azure Recommandées
- **Azure Container Instances (ACI)** : 1 vCPU, 1 GB RAM
- **Coût estimé** : ~15-20€/mois
- **Capacité** : 15-20 utilisateurs simultanés

## 🔧 Prérequis

### 1. Comptes et Outils
- [ ] Compte Azure (gratuit avec crédit de 200€)
- [ ] Compte GitHub
- [ ] Azure CLI installé
- [ ] Docker Desktop (optionnel, pour tests locaux)

### 2. Installation Azure CLI
```bash
# Windows (PowerShell en tant qu'administrateur)
winget install Microsoft.AzureCLI

# Ou télécharger depuis : https://aka.ms/installazurecliwindows
```

## 📝 Étapes de Déploiement

### Étape 1 : Préparation du Projet

#### 1.1 Vérifier les fichiers
Assurez-vous que ces fichiers existent :
- ✅ `Dockerfile`
- ✅ `azure-deploy.yml`
- ✅ `.github/workflows/deploy-azure.yml`
- ✅ `package.json`
- ✅ `server.js`

#### 1.2 Tester localement
```bash
# Installer les dépendances
npm install

# Tester le serveur
npm start

# Vérifier que le jeu fonctionne sur http://localhost:3000
```

### Étape 2 : Configuration Azure

#### 2.1 Connexion Azure CLI
```bash
# Se connecter à Azure
az login

# Vérifier la connexion
az account show
```

#### 2.2 Créer un groupe de ressources
```bash
# Créer un groupe de ressources (remplacez "AutoBattleGame" par votre nom)
az group create --name AutoBattleGame --location "West Europe"
```

#### 2.3 Créer un registre de conteneurs
```bash
# Créer un registre de conteneurs (nom unique requis)
az acr create --resource-group AutoBattleGame --name autobattlegame[VOTRE_NOM] --sku Basic --admin-enabled true
```

#### 2.4 Récupérer les identifiants du registre
```bash
# Récupérer les identifiants
az acr credential show --name autobattlegame[VOTRE_NOM] --resource-group AutoBattleGame
```

### Étape 3 : Configuration GitHub

#### 3.1 Créer un repository GitHub
1. Aller sur [GitHub.com](https://github.com)
2. Cliquer sur "New repository"
3. Nom : `AutoBattleGame-Online`
4. Description : `AutoBattleGame - Online Battle Game`
5. Cocher "Public" ou "Private"
6. Cliquer "Create repository"

#### 3.2 Pousser le code
```bash
# Initialiser Git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "Initial commit - AutoBattleGame Online"

# Ajouter le remote GitHub
git remote add origin https://github.com/[VOTRE_USERNAME]/AutoBattleGame-Online.git

# Pousser le code
git push -u origin main
```

#### 3.3 Configurer les secrets GitHub
1. Aller dans votre repository GitHub
2. Cliquer sur "Settings" → "Secrets and variables" → "Actions"
3. Cliquer "New repository secret"
4. Ajouter ces secrets :

**AZURE_CREDENTIALS** :
```json
{
  "clientId": "VOTRE_CLIENT_ID",
  "clientSecret": "VOTRE_CLIENT_SECRET",
  "subscriptionId": "VOTRE_SUBSCRIPTION_ID",
  "tenantId": "VOTRE_TENANT_ID"
}
```

**AZURE_REGISTRY** :
```
autobattlegame[VOTRE_NOM].azurecr.io
```

**AZURE_REGISTRY_USERNAME** :
```
autobattlegame[VOTRE_NOM]
```

**AZURE_REGISTRY_PASSWORD** :
```
[PASSWORD_RÉCUPÉRÉ_ÉTAPE_2.4]
```

**AZURE_RESOURCE_GROUP** :
```
AutoBattleGame
```

**AZURE_LOCATION** :
```
West Europe
```

### Étape 4 : Créer le Service Principal Azure

#### 4.1 Créer le service principal
```bash
# Créer le service principal
az ad sp create-for-rbac --name "AutoBattleGame-GitHub" --role contributor --scopes /subscriptions/[VOTRE_SUBSCRIPTION_ID]/resourceGroups/AutoBattleGame --sdk-auth
```

#### 4.2 Copier la sortie JSON
La commande ci-dessus affiche un JSON. Copiez-le entièrement et utilisez-le comme valeur pour le secret `AZURE_CREDENTIALS`.

### Étape 5 : Déploiement Automatique

#### 5.1 Déclencher le déploiement
1. Aller dans votre repository GitHub
2. Cliquer sur "Actions"
3. Cliquer sur "Deploy to Azure Container Instances"
4. Cliquer "Run workflow"
5. Cliquer "Run workflow" (bouton vert)

#### 5.2 Vérifier le déploiement
- Le workflow va :
  1. Construire l'image Docker
  2. La pousser vers Azure Container Registry
  3. Déployer sur Azure Container Instances
  4. Configurer l'URL publique

### Étape 6 : Configuration Post-Déploiement

#### 6.1 Récupérer l'URL publique
```bash
# Lister les instances de conteneurs
az container list --resource-group AutoBattleGame --output table

# Récupérer l'IP publique
az container show --resource-group AutoBattleGame --name autobattlegame --query ipAddress.ip --output tsv
```

#### 6.2 Tester l'application
1. Ouvrir l'URL dans un navigateur
2. Tester la connexion/inscription
3. Tester le jeu
4. Vérifier le leaderboard

## 🔧 Configuration Minimale Azure

### Azure Container Instances
```yaml
# azure-deploy.yml (déjà configuré)
resources:
  - name: autobattlegame
    type: Microsoft.ContainerInstance/containerGroups
    apiVersion: 2021-09-01
    location: "[parameters('location')]"
    properties:
      containers:
      - name: autobattlegame
        properties:
          image: "[parameters('containerImage')]"
          resources:
            requests:
              cpu: 1.0          # 1 vCPU
              memoryInGb: 1.0   # 1 GB RAM
          ports:
          - port: 3000
            protocol: TCP
      osType: Linux
      ipAddress:
        type: Public
        ports:
        - protocol: TCP
          port: 3000
      restartPolicy: Always
```

### Coûts Estimés (Mensuel)
- **Azure Container Instances** : ~15€
- **Azure Container Registry** : ~5€
- **Réseau** : ~2€
- **Total** : ~22€/mois

## 🚨 Dépannage

### Problèmes Courants

#### 1. Erreur d'authentification GitHub
```bash
# Vérifier les secrets GitHub
# Régénérer AZURE_CREDENTIALS si nécessaire
```

#### 2. Image Docker ne se construit pas
```bash
# Vérifier le Dockerfile
# Tester localement : docker build -t test .
```

#### 3. Application ne démarre pas
```bash
# Vérifier les logs
az container logs --resource-group AutoBattleGame --name autobattlegame
```

#### 4. Port non accessible
```bash
# Vérifier la configuration réseau
az container show --resource-group AutoBattleGame --name autobattlegame --query ipAddress
```

## 📊 Monitoring

### Métriques à Surveiller
- **CPU Usage** : Doit rester < 80%
- **Memory Usage** : Doit rester < 80%
- **Response Time** : < 2 secondes
- **Concurrent Users** : < 15

### Alertes Recommandées
```bash
# Créer une alerte CPU
az monitor metrics alert create \
  --name "High CPU Usage" \
  --resource-group AutoBattleGame \
  --scopes /subscriptions/[SUBSCRIPTION_ID]/resourceGroups/AutoBattleGame/providers/Microsoft.ContainerInstance/containerGroups/autobattlegame \
  --condition "avg Percentage CPU > 80" \
  --description "CPU usage is high"
```

## 🔄 Mise à Jour

### Déploiement de Nouvelles Versions
1. Modifier le code
2. Commit et push vers GitHub
3. Le workflow GitHub Actions se déclenche automatiquement
4. L'application se met à jour sans interruption

### Rollback
```bash
# Redéployer une version précédente
az container restart --resource-group AutoBattleGame --name autobattlegame
```

## 📞 Support

### Ressources Utiles
- [Documentation Azure Container Instances](https://docs.microsoft.com/en-us/azure/container-instances/)
- [GitHub Actions pour Azure](https://github.com/Azure/actions)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)

### Contact
En cas de problème, vérifiez :
1. Les logs GitHub Actions
2. Les logs Azure Container Instances
3. La configuration des secrets GitHub
4. Les permissions du service principal
