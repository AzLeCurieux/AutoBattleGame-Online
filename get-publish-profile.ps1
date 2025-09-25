# Script pour récupérer le Publish Profile Azure App Service
# Exécuter en tant qu'administrateur

param(
    [Parameter(Mandatory=$false)]
    [string]$AppName = "AutoBattleGame-Online",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "Jeux-carre_group"
)

Write-Host "🔑 Récupération du Publish Profile Azure App Service" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Vérifier la connexion Azure
try {
    $account = az account show --output json 2>$null | ConvertFrom-Json
    Write-Host "✅ Connecté à Azure avec le compte : $($account.user.name)" -ForegroundColor Green
} catch {
    Write-Host "❌ Non connecté à Azure. Exécutez : az login" -ForegroundColor Red
    exit 1
}

# Récupérer le Publish Profile
Write-Host "`n📋 Récupération du Publish Profile..." -ForegroundColor Yellow
try {
    $publishProfile = az webapp deployment list-publishing-profiles --name $AppName --resource-group $ResourceGroup --xml --output tsv 2>$null
    
    if ($publishProfile) {
        Write-Host "✅ Publish Profile récupéré avec succès" -ForegroundColor Green
        
        # Sauvegarder dans un fichier
        $publishProfile | Out-File -FilePath "publish-profile.xml" -Encoding UTF8
        Write-Host "📁 Publish Profile sauvegardé dans : publish-profile.xml" -ForegroundColor Cyan
        
        Write-Host "`n📋 INSTRUCTIONS POUR GITHUB :" -ForegroundColor Green
        Write-Host "1. Aller sur GitHub : https://github.com/azlecurieux/AutoBattleGame-Online" -ForegroundColor Yellow
        Write-Host "2. Settings → Secrets and variables → Actions" -ForegroundColor Yellow
        Write-Host "3. New repository secret" -ForegroundColor Yellow
        Write-Host "4. Name : AZUREAPPSERVICE_PUBLISHPROFILE" -ForegroundColor Yellow
        Write-Host "5. Value : Copier le contenu du fichier publish-profile.xml" -ForegroundColor Yellow
        
        Write-Host "`n📄 Contenu du Publish Profile :" -ForegroundColor Cyan
        Write-Host "=================================" -ForegroundColor Cyan
        Write-Host $publishProfile -ForegroundColor White
        
    } else {
        Write-Host "❌ Impossible de récupérer le Publish Profile" -ForegroundColor Red
        Write-Host "Vérifiez que l'App Service existe : $AppName" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur lors de la récupération du Publish Profile" -ForegroundColor Red
    Write-Host "Vérifiez que l'App Service existe : $AppName" -ForegroundColor Yellow
    Write-Host "Vérifiez que le groupe de ressources existe : $ResourceGroup" -ForegroundColor Yellow
}

Write-Host "`n✅ Script terminé !" -ForegroundColor Green
