# Script para instalar Redis en Windows
# Ejecutar como administrador: powershell -ExecutionPolicy Bypass -File install_redis.ps1

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "  Instalación de Redis para Windows" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# URL de descarga de Redis (última versión estable para Windows)
$redisUrl = "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.zip"
$downloadPath = "$env:TEMP\Redis-x64-3.0.504.zip"
$installPath = "C:\Redis"

Write-Host "`n[1/5] Descargando Redis..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $redisUrl -OutFile $downloadPath
    Write-Host "✅ Descarga completada" -ForegroundColor Green
} catch {
    Write-Host "❌ Error descargando Redis: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/5] Creando directorio de instalación..." -ForegroundColor Yellow
if (-Not (Test-Path $installPath)) {
    New-Item -ItemType Directory -Path $installPath | Out-Null
    Write-Host "✅ Directorio creado: $installPath" -ForegroundColor Green
} else {
    Write-Host "✅ Directorio ya existe: $installPath" -ForegroundColor Green
}

Write-Host "`n[3/5] Extrayendo archivos..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $downloadPath -DestinationPath $installPath -Force
    Write-Host "✅ Archivos extraídos" -ForegroundColor Green
} catch {
    Write-Host "❌ Error extrayendo archivos: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[4/5] Configurando Redis..." -ForegroundColor Yellow
$redisConf = @"
port 6379
bind 127.0.0.1
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
"@

$redisConf | Out-File -FilePath "$installPath\redis.windows.conf" -Encoding ASCII
Write-Host "✅ Configuración creada" -ForegroundColor Green

Write-Host "`n[5/5] Instalando servicio de Windows..." -ForegroundColor Yellow
try {
    & "$installPath\redis-server.exe" --service-install "$installPath\redis.windows.conf" --loglevel verbose
    Write-Host "✅ Servicio instalado" -ForegroundColor Green
    
    Write-Host "`nIniciando servicio Redis..." -ForegroundColor Yellow
    & "$installPath\redis-server.exe" --service-start
    Start-Sleep -Seconds 2
    
    # Verificar que está corriendo
    $service = Get-Service -Name Redis -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Host "✅ Redis está corriendo" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis instalado pero no está corriendo" -ForegroundColor Yellow
        Write-Host "   Ejecuta: net start Redis" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error instalando servicio: $_" -ForegroundColor Red
    Write-Host "`n💡 Puedes iniciar Redis manualmente con:" -ForegroundColor Cyan
    Write-Host "   cd $installPath" -ForegroundColor White
    Write-Host "   redis-server.exe redis.windows.conf" -ForegroundColor White
}

# Agregar a PATH
Write-Host "`n[Extra] Agregando Redis a PATH del sistema..." -ForegroundColor Yellow
try {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -notlike "*$installPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installPath", "Machine")
        Write-Host "✅ Redis agregado a PATH (reinicia la terminal)" -ForegroundColor Green
    } else {
        Write-Host "✅ Redis ya está en PATH" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  No se pudo agregar a PATH (requiere privilegios de admin)" -ForegroundColor Yellow
}

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  ✅ Instalación completada" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan

Write-Host "`n📋 Siguiente paso:" -ForegroundColor Cyan
Write-Host "   1. Agrega a tu .env:" -ForegroundColor White
Write-Host "      REDIS_URL=redis://localhost:6379/0" -ForegroundColor Yellow
Write-Host "`n   2. Reinicia el servidor de DroughtMonitor" -ForegroundColor White
Write-Host "`n   3. Verifica con: redis-cli ping" -ForegroundColor White
Write-Host "      (Debería responder: PONG)" -ForegroundColor White

Write-Host "`n🔧 Comandos útiles:" -ForegroundColor Cyan
Write-Host "   Iniciar:  net start Redis" -ForegroundColor White
Write-Host "   Detener:  net stop Redis" -ForegroundColor White
Write-Host "   Estado:   sc query Redis" -ForegroundColor White
Write-Host "   Cliente:  redis-cli" -ForegroundColor White

Read-Host "`nPresiona Enter para salir"
