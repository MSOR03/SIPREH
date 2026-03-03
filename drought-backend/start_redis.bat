@echo off
REM Script simple para ejecutar Redis en modo standalone (sin servicio de Windows)
REM Ejecutar este script y dejarlo corriendo mientras usas el backend

echo ========================================
echo   Redis Server - Modo Standalone
echo ========================================
echo.

REM Verificar si existe el ejecutable
if not exist redis\redis-server.exe (
    echo [ERROR] Redis no encontrado en: redis\redis-server.exe
    echo.
    echo Descarga Redis desde:
    echo https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.zip
    echo.
    echo Extrae el contenido en: %~dp0redis\
    echo.
    pause
    exit /b 1
)

echo [INFO] Iniciando Redis en puerto 6379...
echo [INFO] Para detener: Ctrl+C
echo.
echo ========================================
echo   Redis corriendo...
echo ========================================
echo.

cd redis
redis-server.exe redis.windows.conf

pause
