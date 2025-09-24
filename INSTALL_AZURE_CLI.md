# 🔧 Installation Azure CLI - Windows

## Méthode 1 : Installation via MSI (Recommandée)

### 1. Télécharger Azure CLI
1. Aller sur : https://aka.ms/installazurecliwindows
2. Télécharger le fichier MSI
3. Exécuter l'installateur en tant qu'administrateur
4. **Important** : Cocher "Add Azure CLI to PATH" pendant l'installation

### 2. Redémarrer PowerShell
```powershell
# Fermer et rouvrir PowerShell
# Ou recharger le profil
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### 3. Vérifier l'installation
```bash
az version
```

## Méthode 2 : Installation via Chocolatey

```powershell
# Installer Chocolatey si pas déjà fait
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Installer Azure CLI
choco install azure-cli
```

## Méthode 3 : Installation via Scoop

```powershell
# Installer Scoop si pas déjà fait
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Installer Azure CLI
scoop install azure-cli
```

## Vérification

Après installation, testez :
```bash
az version
az login
```

## Problèmes Courants

### Azure CLI non trouvé
- Redémarrer PowerShell/CMD
- Vérifier que le PATH contient : `C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin`
- Réinstaller en cochant "Add to PATH"

### Erreur de permissions
- Exécuter PowerShell en tant qu'administrateur
- Vérifier les politiques d'exécution : `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
