# 🚀 Étapes de Déploiement - AutoBattleGame

## 📋 Checklist de Déploiement

### ✅ Étape 1 : GitHub (Terminé)
- [x] Repository créé : `AutoBattleGame-Online`
- [x] Code commité localement
- [ ] Code poussé vers GitHub

### 🔄 Étape 2 : Azure Student
- [ ] Connexion Azure CLI
- [ ] Création des ressources Azure
- [ ] Configuration des secrets GitHub
- [ ] Déploiement automatique

## 🎯 Prochaines Actions

### 1. Pousser le code vers GitHub
```bash
# Dans le terminal de Cursor
git push -u origin main --force
```

### 2. Se connecter à Azure
```bash
# Dans le terminal de Cursor
az login
```
*Une fenêtre de navigateur s'ouvrira pour vous connecter*

### 3. Exécuter le script de configuration
```powershell
# Dans PowerShell (en tant qu'administrateur)
.\setup-azure-student.ps1 -RegistryName "autobattlegame[VOTRE_NOM]"
```

### 4. Configurer les secrets GitHub
1. Aller sur : https://github.com/azlecurieux/AutoBattleGame-Online
2. **Settings** → **Secrets and variables** → **Actions**
3. Ajouter les 6 secrets affichés par le script

### 5. Déclencher le déploiement
1. **GitHub** → **Actions**
2. **"Deploy to Azure Container Instances"**
3. **"Run workflow"**

## 🎓 Avantages Azure Student

- **100% GRATUIT** pour ce projet
- **100$ de crédit** par an
- **Services gratuits** : Container Instances, Container Registry
- **Parfait pour 15 utilisateurs**

## 📊 Configuration Optimisée

- **CPU** : 0.5 vCPU
- **RAM** : 0.5 GB
- **Coût** : 0€/mois
- **Performance** : < 2 secondes

## 🔧 Dépannage

### Problème : Git push échoue
```bash
# Forcer le push
git push -u origin main --force
```

### Problème : Azure CLI non trouvé
```bash
# Recharger le PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### Problème : Connexion Azure
```bash
# Se reconnecter
az logout
az login
```

## 📞 Support

### Guides Disponibles
- **`AZURE_STUDENT_DEPLOYMENT.md`** : Guide complet Azure Student
- **`GITHUB_CURSOR_GUIDE.md`** : Guide GitHub + Cursor
- **`DEPLOYMENT_MANUAL.md`** : Déploiement manuel

### Scripts Disponibles
- **`setup-azure-student.ps1`** : Configuration automatique Azure Student
- **`setup-azure.ps1`** : Configuration Azure standard

## 🎉 Résultat Final

Votre jeu sera accessible via :
- **URL** : `http://autobattlegame.westeurope.azurecontainer.io:3000`
- **Gratuit** avec Azure Student
- **Automatique** via GitHub Actions
- **Scalable** pour 15 utilisateurs

**Prêt à commencer ? Suivez les étapes ci-dessus !** 🚀
