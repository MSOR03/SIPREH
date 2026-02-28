@echo off
REM Script para instalar dependencias y configurar el backend en Windows

echo ================================
echo DroughtMonitor Backend - Setup
echo ================================
echo.

REM Verificar si Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no está instalado o no está en el PATH
    echo Por favor instala Python 3.8 o superior
    pause
    exit /b 1
)

echo [1/5] Creando entorno virtual...
if exist venv (
    echo Ya existe un entorno virtual
) else (
    python -m venv venv
    echo Entorno virtual creado
)
echo.

echo [2/5] Activando entorno virtual...
call venv\Scripts\activate
echo.

echo [3/5] Instalando dependencias...
pip install --upgrade pip
pip install -r requirements.txt
echo.

echo [4/5] Configurando variables de entorno...
if exist .env (
    echo Ya existe archivo .env
) else (
    copy .env.example .env
    echo Archivo .env creado. Por favor edítalo con tus configuraciones.
)
echo.

echo [5/5] Inicializando base de datos...
python init_db.py
echo.

echo ================================
echo Setup completado exitosamente!
echo ================================
echo.
echo Próximos pasos:
echo 1. Edita el archivo .env con tus configuraciones
echo 2. Configura tu servicio de almacenamiento en la nube
echo 3. Ejecuta: python run.py
echo 4. Visita: http://localhost:8000/docs
echo.
echo Credenciales por defecto:
echo Email: admin@droughtmonitor.com
echo Password: change-this-secure-password
echo.
pause
