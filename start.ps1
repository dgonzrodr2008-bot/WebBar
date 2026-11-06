# Script de inicio para PowerShell - Restaurante Tarca Luis
Set-Location $PSScriptRoot

Write-Host "=========================================================" -ForegroundColor Yellow
Write-Host "  Iniciando Restaurante Tarca Luis (La Palma, Canarias)  " -ForegroundColor White
Write-Host "=========================================================" -ForegroundColor Yellow
Write-Host "Directorio: $PSScriptRoot`n" -ForegroundColor Cyan

$agyCmd = "$env:APPDATA\Antigravity\bin\agy-node.cmd"

if (Test-Path $agyCmd) {
    & $agyCmd server.js
} elseif (Get-Command agy-node -ErrorAction SilentlyContinue) {
    agy-node server.js
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    node server.js
} else {
    Write-Host "[ERROR] Node.js no está disponible." -ForegroundColor Red
    Pause
}
