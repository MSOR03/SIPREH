# Script para instalar dependencias del proyecto DroughtMonitor Backend
# Requiere que exista el entorno virtual 'venv'

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Instalando dependencias..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Activar el entorno virtual venv
Write-Host "`nActivando entorno virtual 'venv'..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: No se pudo activar el entorno virtual 'venv'" -ForegroundColor Red
    exit 1
}

# Instalar las dependencias desde requirements.txt
Write-Host "`nInstalando paquetes desde requirements.txt..." -ForegroundColor Yellow
pip install -r requirements.txt

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Instalación completada exitosamente!" -ForegroundColor Green
    Write-Host "`nPuedes ejecutar el proyecto con: python run.py" -ForegroundColor Green
} else {
    Write-Host "`n✗ Error durante la instalación" -ForegroundColor Red
    exit 1
}

Write-Host "`n================================" -ForegroundColor Cyan
