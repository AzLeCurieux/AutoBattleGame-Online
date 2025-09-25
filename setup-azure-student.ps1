# Script PowerShell pour Azure Student - AutoBattleGame
# Exécuter en tant qu'administrateur

param(
    [Parameter(Mandatory=$true)]
    [string]$RegistryName,
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "AutoBattleGame",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "West Europe"
)

Write-Host "🎓 Configuration Azure Student pour AutoBattleGame" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Vérifier si Azure CLI est installé
try {
    $azVersion = az version --output tsv 2>$null
    Write-Host "✅ Azure CLI détecté : $azVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure CLI non trouvé. Installez-le d'abord :" -ForegroundColor Red
    Write-Host "   winget install Microsoft.AzureCLI" -ForegroundColor Yellow
    exit 1
}

# Vérifier la connexion Azure
Write-Host "`n🔐 Vérification de la connexion Azure..." -ForegroundColor Yellow
try {
    $account = az account show --output json 2>$null | ConvertFrom-Json
    Write-Host "✅ Connecté à Azure avec le compte : $($account.user.name)" -ForegroundColor Green
    Write-Host "   Subscription : $($account.name)" -ForegroundColor Cyan
    Write-Host "   Tenant : $($account.tenantId)" -ForegroundColor Cyan
    
    # Vérifier si c'est un compte étudiant
    if ($account.name -like "*Student*" -or $account.name -like "*Education*") {
        Write-Host "🎓 Compte étudiant détecté - Services gratuits disponibles !" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Compte non-étudiant détecté - Vérifiez les coûts" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Non connecté à Azure. Exécutez : az login" -ForegroundColor Red
    exit 1
}

# Créer le groupe de ressources
Write-Host "`n📁 Création du groupe de ressources..." -ForegroundColor Yellow
try {
    $rg = az group create --name $ResourceGroupName --location $Location --output json 2>$null | ConvertFrom-Json
    Write-Host "✅ Groupe de ressources créé : $($rg.name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la création du groupe de ressources" -ForegroundColor Red
    exit 1
}

# Créer le registre de conteneurs
Write-Host "`n🐳 Création du registre de conteneurs..." -ForegroundColor Yellow
try {
    $acr = az acr create --resource-group $ResourceGroupName --name $RegistryName --sku Basic --admin-enabled true --output json 2>$null | ConvertFrom-Json
    Write-Host "✅ Registre de conteneurs créé : $($acr.name)" -ForegroundColor Green
    Write-Host "   URL : $($acr.loginServer)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erreur lors de la création du registre de conteneurs" -ForegroundColor Red
    Write-Host "   Le nom '$RegistryName' est peut-être déjà pris. Choisissez un autre nom." -ForegroundColor Yellow
    exit 1
}

# Récupérer les identifiants du registre
Write-Host "`n🔑 Récupération des identifiants du registre..." -ForegroundColor Yellow
try {
    $credentials = az acr credential show --name $RegistryName --resource-group $ResourceGroupName --output json 2>$null | ConvertFrom-Json
    Write-Host "✅ Identifiants récupérés" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la récupération des identifiants" -ForegroundColor Red
    exit 1
}

# Créer le service principal
Write-Host "`n👤 Création du service principal..." -ForegroundColor Yellow
try {
    $sp = az ad sp create-for-rbac --name "AutoBattleGame-GitHub" --role contributor --scopes "/subscriptions/$($account.id)/resourceGroups/$ResourceGroupName" --sdk-auth --output json 2>$null | ConvertFrom-Json
    Write-Host "✅ Service principal créé" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de la création du service principal" -ForegroundColor Red
    exit 1
}

# Afficher les informations de configuration
Write-Host "`n📋 INFORMATIONS DE CONFIGURATION GITHUB" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

Write-Host "`n🔐 Secrets GitHub à configurer :" -ForegroundColor Yellow
Write-Host "1. AZURE_CREDENTIALS :" -ForegroundColor Cyan
Write-Host ($sp | ConvertTo-Json -Compress) -ForegroundColor White

Write-Host "`n2. AZURE_REGISTRY :" -ForegroundColor Cyan
Write-Host $acr.loginServer -ForegroundColor White

Write-Host "`n3. AZURE_REGISTRY_USERNAME :" -ForegroundColor Cyan
Write-Host $acr.name -ForegroundColor White

Write-Host "`n4. AZURE_REGISTRY_PASSWORD :" -ForegroundColor Cyan
Write-Host $credentials.passwords[0].value -ForegroundColor White

Write-Host "`n5. AZURE_RESOURCE_GROUP :" -ForegroundColor Cyan
Write-Host $ResourceGroupName -ForegroundColor White

Write-Host "`n6. AZURE_LOCATION :" -ForegroundColor Cyan
Write-Host $Location -ForegroundColor White

Write-Host "`n📝 ÉTAPES SUIVANTES :" -ForegroundColor Green
Write-Host "1. Pousser le code vers GitHub" -ForegroundColor Yellow
Write-Host "2. Configurer les secrets GitHub avec les valeurs ci-dessus" -ForegroundColor Yellow
Write-Host "3. Déclencher le workflow GitHub Actions" -ForegroundColor Yellow
Write-Host "4. Votre jeu sera en ligne gratuitement !" -ForegroundColor Yellow

Write-Host "`n💰 COÛTS AZURE STUDENT :" -ForegroundColor Green
Write-Host "- Container Instances (0.5 vCPU, 0.5 GB) : GRATUIT" -ForegroundColor Cyan
Write-Host "- Container Registry (Basic) : GRATUIT" -ForegroundColor Cyan
Write-Host "- Réseau et stockage : GRATUIT" -ForegroundColor Cyan
Write-Host "- TOTAL : 0€/mois (dans les limites étudiantes)" -ForegroundColor Green

Write-Host "`n✅ Configuration Azure Student terminée !" -ForegroundColor Green
Write-Host "Consultez AZURE_STUDENT_DEPLOYMENT.md pour les étapes suivantes." -ForegroundColor Cyan
