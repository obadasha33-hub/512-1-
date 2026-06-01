# Build script for Capacitor APK (local static build)
# This builds just the client-side app for offline use in the APK

$ErrorActionPreference = "Stop"
$root = "C:\Users\LENOVO\Documents\CPY_SAVES\CPY"
$apiDir = "$root\src\app\api"
$apiBackup = "$root\src\_api_backup_for_capacitor"

Write-Host "=== Capacitor APK Build ===" -ForegroundColor Cyan

# Step 1: Move API routes aside
Write-Host "[1/4] Moving API routes aside..." -ForegroundColor Yellow
if (Test-Path $apiBackup) { Remove-Item $apiBackup -Recurse -Force }
Move-Item $apiDir $apiBackup

# Step 2: Temporarily set output to export
Write-Host "[2/4] Building static export..." -ForegroundColor Yellow
$configPath = "$root\next.config.ts"
$originalContent = Get-Content $configPath -Raw
$newContent = $originalContent -replace 'output: "standalone"', 'output: "export"'
$newContent = $newContent -replace 'reactStrictMode: true', "reactStrictMode: true,`n  images: { unoptimized: true },"
Set-Content $configPath $newContent

# Remove manifest.ts temporarily (not compatible with static export)
$manifestPath = "$root\src\app\manifest.ts"
$manifestBackup = "$root\src\_manifest_backup"
if (Test-Path $manifestPath) { Move-Item $manifestPath $manifestBackup }

Push-Location $root
npx next build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Pop-Location
    Set-Content $configPath $originalContent
    Move-Item $apiBackup $apiDir
    if (Test-Path $manifestBackup) { Move-Item $manifestBackup $manifestPath }
    exit 1
}
Pop-Location

# Step 3: Restore everything
Write-Host "[3/4] Restoring files..." -ForegroundColor Yellow
Set-Content $configPath $originalContent
Move-Item $apiBackup $apiDir
if (Test-Path $manifestBackup) { Move-Item $manifestBackup $manifestPath }

# Step 4: Sync + Build APK
Write-Host "[4/4] Syncing Capacitor and building APK..." -ForegroundColor Yellow
Push-Location $root
npx cap sync android
Pop-Location

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Push-Location "$root\android"
& .\gradlew.bat assembleDebug
Pop-Location

if ($LASTEXITCODE -eq 0) {
    $apk = "$root\android\app\build\outputs\apk\debug\app-debug.apk"
    $size = (Get-Item $apk).Length / 1MB
    Write-Host ""
    Write-Host "=== BUILD SUCCESS ===" -ForegroundColor Green
    Write-Host "APK: $apk" -ForegroundColor Green
    Write-Host "Size: $([math]::Round($size, 1)) MB" -ForegroundColor Green
    Write-Host ""
    Write-Host "Install: adb install `"$apk`"" -ForegroundColor Cyan
} else {
    Write-Host "APK build failed!" -ForegroundColor Red
}
