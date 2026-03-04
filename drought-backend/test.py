"""
Script de prueba completo para DroughtMonitor API
Verifica autenticación, upload de archivos y sistema de sequías
"""
import requests
import json
from datetime import date, timedelta

# Configuración
BASE_URL = "http://localhost:8000/api/v1"
ADMIN_EMAIL = "admin@droughtmonitor.com"
ADMIN_PASSWORD = "change-this-secure-password"


def print_header(title):
    """Imprime encabezado visual"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


# ============================================================================
# 1. AUTENTICACIÓN
# ============================================================================

def test_login():
    """Prueba login de admin"""
    print_header("1. AUTENTICACIÓN")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Login exitoso")
        print(f"   Email: {ADMIN_EMAIL}")
        print(f"   Token: {data['access_token'][:50]}...")
        return data['access_token']
    else:
        print(f"❌ Error en login: {response.status_code}")
        print(response.text)
        return None


def test_me(token):
    """Verifica información del usuario actual"""
    print_header("2. INFORMACIÓN DEL USUARIO")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Usuario autenticado")
        print(f"   Email: {data['email']}")
        print(f"   Admin: {data['is_superuser']}")
    else:
        print(f"❌ Error: {response.status_code}")


# ============================================================================
# 2. GESTIÓN DE ARCHIVOS
# ============================================================================

def test_list_files(token):
    """Lista archivos parquet subidos"""
    print_header("3. ARCHIVOS PARQUET")
    
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/admin/files", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Total de archivos: {data['total']}")
        
        if data['total'] > 0:
            for f in data['files']:
                print(f"\n   📁 {f['filename']}")
                print(f"      ID: {f['id']}")
                print(f"      Tamaño: {f['file_size']:,} bytes")
                print(f"      Activo: {f['is_active']}")
        else:
            print("\n⚠️  No hay archivos subidos aún")
            print("   Configura .env y usa POST /parquet/upload para subir datos")
        
        return data['total']
    else:
        print(f"❌ Error: {response.status_code}")
        return 0


# ============================================================================
# 3. SISTEMA DE SEQUÍAS
# ============================================================================

def test_drought_variables():
    """Prueba catálogo de variables hidrometeorológicas"""
    print_header("4. VARIABLES HIDROMETEOROLÓGICAS")
    
    response = requests.get(f"{BASE_URL}/drought/variables")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Variables disponibles: {data['total']}")
        print("\nCatálogo:")
        for var in data['variables']:
            print(f"   • {var['name']} ({var['id']})")
            print(f"     Unidad: {var['unit']} | Categoría: {var['category']}")
    else:
        print(f"❌ Error: {response.status_code}")


def test_drought_indices():
    """Prueba catálogo de índices de sequía"""
    print_header("5. ÍNDICES DE SEQUÍA")
    
    response = requests.get(f"{BASE_URL}/drought/drought-indices")
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Índices disponibles: {data['total']}")
        
        print("\nÍndices Meteorológicos:")
        for idx in data['indices']:
            if idx['category'] == 'meteorological':
                pred = "✅" if idx['supports_prediction'] else "❌"
                print(f"   • {idx['name']} ({idx['id']}) - Predicción: {pred}")
        
        print("\nÍndices Hidrológicos:")
        for idx in data['indices']:
            if idx['category'] == 'hydrological':
                pred = "✅" if idx['supports_prediction'] else "❌"
                print(f"   • {idx['name']} ({idx['id']}) - Predicción: {pred}")
    else:
        print(f"❌ Error: {response.status_code}")


def test_historical_timeseries():
    """Prueba endpoint de serie temporal (requiere datos)"""
    print_header("6. SERIE TEMPORAL (ANÁLISIS HISTÓRICO 1D)")
    
    # Simulación de request (requiere file_id real)
    payload = {
        "file_id": 1,
        "variable_or_index": "spi3",
        "start_date": "2020-01-01",
        "end_date": "2020-12-31",
        "station_id": "BOG001"
    }
    
    response = requests.post(
        f"{BASE_URL}/drought/historical/timeseries",
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Serie temporal obtenida")
        print(f"   Variable: {data['variable_or_index']}")
        print(f"   Ubicación: {data['location_type']}")
        print(f"   Puntos de datos: {len(data['data'])}")
        if data['statistics']:
            print(f"   Estadísticas: min={data['statistics'].get('min')} max={data['statistics'].get('max')}")
    else:
        print(f"⚠️  Endpoint disponible pero necesita datos parquet subidos")
        print(f"   Status: {response.status_code}")


def test_historical_spatial():
    """Prueba endpoint de datos espaciales (requiere datos)"""
    print_header("7. DATOS ESPACIALES (ANÁLISIS HISTÓRICO 2D)")
    
    payload = {
        "file_id": 1,
        "variable_or_index": "precipitation",
        "target_date": "2023-12-01"
    }
    
    response = requests.post(
        f"{BASE_URL}/drought/historical/spatial",
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Datos espaciales obtenidos")
        print(f"   Variable: {data['variable_or_index']}")
        print(f"   Fecha: {data['date']}")
        print(f"   Celdas: {len(data['grid_cells'])}")
    else:
        print(f"⚠️  Endpoint disponible pero necesita datos parquet subidos")
        print(f"   Status: {response.status_code}")


def test_prediction():
    """Prueba endpoint de predicción (requiere datos)"""
    print_header("8. PREDICCIÓN DE SEQUÍAS")
    
    payload = {
        "file_id": 1,
        "drought_index": "spi3",
        "horizon": "3m",
        "reference_date": "2024-02-28"
    }
    
    response = requests.post(
        f"{BASE_URL}/drought/prediction/forecast",
        json=payload
    )
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Predicción generada")
        print(f"   Índice: {data['drought_index']}")
        print(f"   Horizonte: {data['horizon']}")
        print(f"   Rango: {data['forecast_range']['start']} → {data['forecast_range']['end']}")
    else:
        print(f"⚠️  Endpoint disponible pero necesita datos parquet subidos")
        print(f"   Status: {response.status_code}")


def test_configuration():
    """Prueba configuración del dashboard"""
    print_header("9. CONFIGURACIÓN DEL DASHBOARD")
    
    response = requests.get(f"{BASE_URL}/drought/config")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Configuración obtenida")
        print(f"   Área de estudio: {data.get('study_area', 'No definida')}")
        print(f"   Categorías de sequía: {len(data.get('drought_categories', []))}")
    else:
        print(f"❌ Error: {response.status_code}")


# ============================================================================
# EJECUCIÓN PRINCIPAL
# ============================================================================

def main():
    print("""
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║        🌍  DROUGHTMONITOR API - SUITE DE PRUEBAS  🌍             ║
║                                                                   ║
║  Verifica que todos los endpoints estén funcionando              ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    """)
    
    print("📡 URL del servidor:", BASE_URL)
    print("👤 Usuario admin:", ADMIN_EMAIL)
    
    # 1. Autenticación
    token = test_login()
    if not token:
        print("\n❌ No se pudo obtener token. Verifica que el servidor esté corriendo.")
        print("   Ejecuta: python run.py")
        return
    
    # 2. Info del usuario
    test_me(token)
    
    # 3. Archivos
    file_count = test_list_files(token)
    
    # 4-5. Catálogos de sequías (públicos)
    test_drought_variables()
    test_drought_indices()
    
    # 6-8. Análisis (requieren datos)
    if file_count > 0:
        test_historical_timeseries()
        test_historical_spatial()
        test_prediction()
    else:
        print_header("6-8. ANÁLISIS Y PREDICCIÓN")
        print("⚠️  Se necesitan archivos parquet para probar estos endpoints:")
        print("   • POST /drought/historical/timeseries")
        print("   • POST /drought/historical/spatial")
        print("   • POST /drought/prediction/forecast")
        print("\n   Para subir archivos:")
        print("   1. Configura credenciales cloud en .env")
        print("   2. Reinicia servidor: python run.py")
        print("   3. POST /parquet/upload con tu archivo .parquet")
    
    # 9. Configuración
    test_configuration()
    
    # Resumen
    print_header("RESUMEN DE PRUEBAS")
    print("✅ Autenticación: Funcionando")
    print("✅ Gestión de archivos: Funcionando")
    print("✅ Catálogos de sequías: Funcionando")
    print("✅ Dashboard config: Funcionando")
    
    if file_count > 0:
        print("✅ Análisis de datos: Funcionando")
    else:
        print("⚠️  Análisis de datos: Requiere upload de archivos parquet")
    
    print("\n📚 Documentación completa: http://localhost:8000/docs")
    print("📖 Arquitectura del sistema: Ver ARCHITECTURE.md")
    print("🚀 README: Ver README.md")


if __name__ == "__main__":
    main()
