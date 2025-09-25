# Script de nettoyage complet du repository Git
# Exécuter en tant qu'administrateur

Write-Host "🧹 Nettoyage du repository Git..." -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Vérifier si nous sommes dans un repository Git
if (-not (Test-Path ".git")) {
    Write-Host "❌ Ce n'est pas un repository Git !" -ForegroundColor Red
    exit 1
}

# Sauvegarder les changements locaux
Write-Host "`n💾 Sauvegarde des changements locaux..." -ForegroundColor Yellow
git stash

# Récupérer les changements distants
Write-Host "`n📥 Récupération des changements distants..." -ForegroundColor Yellow
git fetch origin

# Forcer la synchronisation
Write-Host "`n🔄 Synchronisation avec le repository distant..." -ForegroundColor Yellow
git reset --hard origin/main

# Récupérer les changements sauvegardés
Write-Host "`n📤 Récupération des changements sauvegardés..." -ForegroundColor Yellow
git stash pop

# Supprimer les workflows incorrects
Write-Host "`n🗑️ Suppression des workflows incorrects..." -ForegroundColor Yellow
if (Test-Path ".github/workflows/deploy-azure.yml") {
    Remove-Item ".github/workflows/deploy-azure.yml" -Force
    Write-Host "✅ Workflow deploy-azure.yml supprimé" -ForegroundColor Green
}

# Vérifier que le workflow App Service existe
if (Test-Path ".github/workflows/main_Jeux-carre.yml") {
    Write-Host "✅ Workflow main_Jeux-carre.yml trouvé" -ForegroundColor Green
} else {
    Write-Host "⚠️ Workflow main_Jeux-carre.yml non trouvé" -ForegroundColor Yellow
}

# Vérifier package.json
Write-Host "`n📦 Vérification de package.json..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageContent = Get-Content "package.json" -Raw
    if ($packageContent -match '"test": "echo.*exit 1"') {
        Write-Host "⚠️ Script de test problématique détecté" -ForegroundColor Yellow
        Write-Host "   Correction nécessaire dans package.json" -ForegroundColor Yellow
    } else {
        Write-Host "✅ package.json semble correct" -ForegroundColor Green
    }
} else {
    Write-Host "❌ package.json non trouvé !" -ForegroundColor Red
}

# Commiter les corrections
Write-Host "`n💾 Commit des corrections..." -ForegroundColor Yellow
git add .
git commit -m "Clean repository and fix deployment configuration"

# Pousser vers GitHub
Write-Host "`n🚀 Push vers GitHub..." -ForegroundColor Yellow
git push origin main --force

Write-Host "`n✅ Repository nettoyé et synchronisé !" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

Write-Host "`n📋 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Vérifier GitHub Actions : https://github.com/AzLeCurieux/AutoBattleGame-Online/actions" -ForegroundColor Yellow
Write-Host "2. Configurer Azure App Service si nécessaire" -ForegroundColor Yellow
Write-Host "3. Vérifier les variables d'environnement" -ForegroundColor Yellow

Write-Host "`n🎯 URL de l'application :" -ForegroundColor Cyan
Write-Host "https://jeux-carre.azurewebsites.net" -ForegroundColor Green
