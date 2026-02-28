#!/bin/bash
# Script para instalar dependencias y configurar el backend en Linux/Mac

echo "================================"
echo "DroughtMonitor Backend - Setup"
echo "================================"
echo ""

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 no está instalado"
    echo "Por favor instala Python 3.8 o superior"
    exit 1
fi

echo "[1/5] Creando entorno virtual..."
if [ -d "venv" ]; then
    echo "Ya existe un entorno virtual"
else
    python3 -m venv venv
    echo "Entorno virtual creado"
fi
echo ""

echo "[2/5] Activando entorno virtual..."
source venv/bin/activate
echo ""

echo "[3/5] Instalando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt
echo ""

echo "[4/5] Configurando variables de entorno..."
if [ -f ".env" ]; then
    echo "Ya existe archivo .env"
else
    cp .env.example .env
    echo "Archivo .env creado. Por favor edítalo con tus configuraciones."
fi
echo ""

echo "[5/5] Inicializando base de datos..."
python init_db.py
echo ""

echo "================================"
echo "Setup completado exitosamente!"
echo "================================"
echo ""
echo "Próximos pasos:"
echo "1. Edita el archivo .env con tus configuraciones"
echo "2. Configura tu servicio de almacenamiento en la nube"
echo "3. Ejecuta: python run.py"
echo "4. Visita: http://localhost:8000/docs"
echo ""
echo "Credenciales por defecto:"
echo "Email: admin@droughtmonitor.com"
echo "Password: change-this-secure-password"
echo ""
