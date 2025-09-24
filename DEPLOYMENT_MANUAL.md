# 🚀 Déploiement Manuel Azure - AutoBattleGame

## Étape 1 : Installation Azure CLI

### Option A : Téléchargement Direct
1. Aller sur : https://aka.ms/installazurecliwindows
2. Télécharger le fichier MSI
3. **Exécuter en tant qu'administrateur**
4. **Cocher "Add Azure CLI to PATH"**
5. Redémarrer PowerShell

### Option B : Via PowerShell (si winget fonctionne)
```powershell
# En tant qu'administrateur
winget install Microsoft.AzureCLI
```

## Étape 2 : Vérification
```bash
# Redémarrer PowerShell puis tester
az version
az login
```

## Étape 3 : Configuration Azure (Manuelle)

### 3.1 Connexion
```bash
az login
```

### 3.2 Créer le groupe de ressources
```bash
az group create --name AutoBattleGame --location "West Europe"
```

### 3.3 Créer le registre de conteneurs
```bash
# Remplacez "autobattlegame[VOTRE_NOM]" par un nom unique
az acr create --resource-group AutoBattleGame --name autobattlegame[VOTRE_NOM] --sku Basic --admin-enabled true
```

### 3.4 Récupérer les identifiants
```bash
# Remplacer [VOTRE_NOM] par le nom choisi
az acr credential show --name autobattlegame[VOTRE_NOM] --resource-group AutoBattleGame
```

### 3.5 Créer le service principal
```bash
# Récupérer votre subscription ID d'abord
az account show --query id --output tsv

# Créer le service principal (remplacer [SUBSCRIPTION_ID])
az ad sp create-for-rbac --name "AutoBattleGame-GitHub" --role contributor --scopes /subscriptions/[SUBSCRIPTION_ID]/resourceGroups/AutoBattleGame --sdk-auth
```

## Étape 4 : Configuration GitHub

### 4.1 Créer le repository
1. Aller sur [GitHub.com](https://github.com)
2. "New repository" → `AutoBattleGame-Online`
3. Cocher "Public" ou "Private"
4. "Create repository"

### 4.2 Pousser le code
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/[VOTRE_USERNAME]/AutoBattleGame-Online.git
git push -u origin main
```

### 4.3 Configurer les secrets GitHub
1. GitHub → Settings → Secrets and variables → Actions
2. "New repository secret" pour chaque secret :

| Secret | Valeur |
|--------|--------|
| `AZURE_CREDENTIALS` | JSON du service principal (étape 3.5) |
| `AZURE_REGISTRY` | `autobattlegame[VOTRE_NOM].azurecr.io` |
| `AZURE_REGISTRY_USERNAME` | `autobattlegame[VOTRE_NOM]` |
| `AZURE_REGISTRY_PASSWORD` | Mot de passe de l'étape 3.4 |
| `AZURE_RESOURCE_GROUP` | `AutoBattleGame` |
| `AZURE_LOCATION` | `West Europe` |

## Étape 5 : Déploiement

### 5.1 Déclencher le workflow
1. GitHub → Actions
2. "Deploy to Azure Container Instances"
3. "Run workflow" → "Run workflow"

### 5.2 Vérifier le déploiement
```bash
# Lister les conteneurs
az container list --resource-group AutoBattleGame --output table

# Vérifier l'IP publique
az container show --resource-group AutoBattleGame --name autobattlegame --query ipAddress.ip --output tsv
```

## Étape 6 : Test

### 6.1 Accéder au jeu
- URL : `http://[IP_PUBLIQUE]:3000`
- Ou : `http://autobattlegame.westeurope.azurecontainer.io:3000`

### 6.2 Tests à effectuer
- [ ] Page d'accueil se charge
- [ ] Connexion/inscription fonctionne
- [ ] Jeu se lance
- [ ] Leaderboard s'affiche
- [ ] Temps de réponse < 2 secondes

## Dépannage

### Azure CLI non trouvé
```powershell
# Vérifier le PATH
$env:Path -split ';' | Where-Object { $_ -like "*Azure*" }

# Ajouter manuellement au PATH si nécessaire
$env:Path += ";C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin"
```

### Erreur de permissions
```powershell
# Exécuter en tant qu'administrateur
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Workflow GitHub échoue
1. Vérifier tous les secrets
2. Vérifier que le repository est public ou actions activées
3. Consulter les logs dans GitHub Actions

## Coûts

- **Container Instances** : ~8€/mois (0.5 vCPU, 0.5 GB)
- **Container Registry** : ~5€/mois
- **Réseau** : ~2€/mois
- **Total** : ~15€/mois pour 15 utilisateurs
