# 🚀 Déploiement Rapide Azure - AutoBattleGame

## ⚡ Déploiement en 5 Minutes

### Prérequis
- [ ] Compte Azure (gratuit avec 200€ de crédit)
- [ ] Compte GitHub
- [ ] Azure CLI installé

### 1. Installation Azure CLI (Windows)
```powershell
# PowerShell en tant qu'administrateur
winget install Microsoft.AzureCLI
```

### 2. Connexion Azure
```bash
az login
```

### 3. Configuration Automatique
```powershell
# Exécuter le script de configuration
.\setup-azure.ps1 -RegistryName "autobattlegame[VOTRE_NOM]"
```

**Remplacez `[VOTRE_NOM]` par votre nom ou initiales pour rendre le nom unique.**

### 4. Configuration GitHub

#### 4.1 Créer le repository
1. Aller sur [GitHub.com](https://github.com)
2. "New repository" → `AutoBattleGame-Online`
3. Cocher "Public" ou "Private"
4. "Create repository"

#### 4.2 Pousser le code
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/[VOTRE_USERNAME]/AutoBattleGame-Online.git
git push -u origin main
```

#### 4.3 Configurer les secrets
1. GitHub → Settings → Secrets and variables → Actions
2. "New repository secret" pour chaque secret :

| Secret | Valeur |
|--------|--------|
| `AZURE_CREDENTIALS` | JSON du service principal (affiché par le script) |
| `AZURE_REGISTRY` | URL du registre (ex: `autobattlegame[VOTRE_NOM].azurecr.io`) |
| `AZURE_REGISTRY_USERNAME` | Nom du registre |
| `AZURE_REGISTRY_PASSWORD` | Mot de passe du registre |
| `AZURE_RESOURCE_GROUP` | `AutoBattleGame` |
| `AZURE_LOCATION` | `West Europe` |

### 5. Déploiement Automatique
1. GitHub → Actions
2. "Deploy to Azure Container Instances"
3. "Run workflow" → "Run workflow"

### 6. Accès au Jeu
- L'URL sera : `http://autobattlegame.[LOCATION].azurecontainer.io:3000`
- Remplacer `[LOCATION]` par votre région

## 📊 Configuration Minimale

### Ressources Azure
- **CPU** : 0.5 vCPU
- **RAM** : 0.5 GB
- **Capacité** : 15 utilisateurs simultanés
- **Coût** : ~15€/mois

### Performance Attendue
- **Temps de réponse** : < 2 secondes
- **Utilisateurs simultanés** : 15 maximum
- **Uptime** : 99.9%

## 🔧 Dépannage Rapide

### Problème : Erreur d'authentification
```bash
# Vérifier la connexion
az account show

# Se reconnecter si nécessaire
az login
```

### Problème : Nom de registre déjà pris
```bash
# Choisir un autre nom
.\setup-azure.ps1 -RegistryName "autobattlegame[VOTRE_NOM]2"
```

### Problème : Workflow GitHub échoue
1. Vérifier tous les secrets GitHub
2. Vérifier que le repository est public ou que les actions sont activées
3. Consulter les logs dans GitHub Actions

### Problème : Application ne démarre pas
```bash
# Vérifier les logs
az container logs --resource-group AutoBattleGame --name autobattlegame
```

## 📞 Support

### Logs Utiles
```bash
# Logs de l'application
az container logs --resource-group AutoBattleGame --name autobattlegame

# Statut du conteneur
az container show --resource-group AutoBattleGame --name autobattlegame --query instanceView.state

# IP publique
az container show --resource-group AutoBattleGame --name autobattlegame --query ipAddress.ip
```

### Ressources
- [Guide complet](AZURE_DEPLOYMENT_GUIDE.md)
- [Documentation Azure](https://docs.microsoft.com/en-us/azure/container-instances/)
- [GitHub Actions](https://github.com/Azure/actions)

## ✅ Checklist de Déploiement

- [ ] Azure CLI installé et connecté
- [ ] Script `setup-azure.ps1` exécuté avec succès
- [ ] Repository GitHub créé
- [ ] Code poussé vers GitHub
- [ ] Secrets GitHub configurés
- [ ] Workflow GitHub Actions exécuté
- [ ] Application accessible via l'URL publique
- [ ] Test de connexion/inscription
- [ ] Test du jeu et du leaderboard

**🎉 Félicitations ! Votre jeu est maintenant en ligne !**
