# 🚀 Quick Start - Sistema de Datos Históricos

## Instalación Rápida

```bash
# 1. Instalar dependencias
cd drought-backend
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Cloudflare

# 3. Iniciar servidor
python run.py
```

## Gestionar Archivos .parquet

### ¿Ya tienes archivos en Cloudflare? (MÁS FÁCIL)

```bash
# Usa el script interactivo
python scripts/manage_cloudflare_files.py

# Menú:
# 1. Ver archivos en CLOUDFLARE
# 2. Ver archivos en BASE DE DATOS  
# 3. SINCRONIZAR (registra automáticamente)
```

### ¿Vas a subir archivos nuevos?

```bash
# Sube via API - se registran automáticamente
curl -X POST http://localhost:8000/api/v1/parquet/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@datos_bogota.parquet"

# ✅ Ya está disponible para consultas!
```

### Opción Manual: Registrar URL específica

```bash
curl -X POST http://localhost:8000/api/v1/admin/files/register-external \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "bogota_drought.parquet",
    "cloud_url": "https://tu-url.r2.cloudflarestorage.com/archivo.parquet",
    "description": "Datos históricos Bogotá",
    "metadata": {"resolution": "0.25"}
  }'
```

## Probar la API

```bash
# Ver archivos disponibles (debe mostrar tus archivos)
curl http://localhost:8000/api/v1/historical/files

# Ejecutar suite de pruebas completa
python scripts/test_historical_api.py
```

**Verificar que archivos están disponibles:**

```bash
# 1. Listar archivos en Cloudflare (admin)
curl -X GET "http://localhost:8000/api/v1/admin/files/cloud/list" \
  -H "Authorization: Bearer $TOKEN"

# 2. Listar archivos disponibles para consultas (público)
curl http://localhost:8000/api/v1/historical/files

# 3. Obtener info detallada de un archivo
curl http://localhost:8000/api/v1/historical/files/1/info
```

**Consultas de datos:**

```bash
# 1. Listar archivos
curl http://localhost:8000/api/v1/historical/files

# 2. Catálogo de variables
curl http://localhost:8000/api/v1/historical/catalog/all

# 3. Serie de tiempo
curl -X POST http://localhost:8000/api/v1/historical/timeseries \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "SPI",
    "start_date": "2020-01-01",
    "end_date": "2024-12-31",
    "lat": 4.6097,
    "lon": -74.0817
  }'

# 4. Datos espaciales
curl -X POST http://localhost:8000/api/v1/historical/spatial \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "SPEI",
    "target_date": "2024-01-15"
  }'
```

## Endpoints Principales

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/historical/catalog/variables` | GET | Variables hidrometeorológicas |
| `/historical/catalog/drought-indices` | GET | Índices de sequía |
| `/historical/files` | GET | Archivos disponibles |
| `/historical/timeseries` | POST | Serie de tiempo (1D) |
| `/historical/spatial` | POST | Datos espaciales (2D) |

## Variables Disponibles

### Hidrometeorológicas
- `precip` - Precipitación (mm)
- `tmean` - Temperatura Media (°C)
- `tmin` - Temperatura Mínima (°C)
- `tmax` - Temperatura Máxima (°C)
- `pet` - Evapotranspiración Potencial (mm)
- `balance` - Balance Hídrico (mm)

### Índices de Sequía
- `SPI` - Standardized Precipitation Index
- `SPEI` - Standardized Precipitation Evapotranspiration Index
- `RAI` - Rainfall Anomaly Index
- `EDDI` - Evaporative Demand Drought Index
- `PDSI` - Palmer Drought Severity Index

## Estructura de Archivos .parquet

Tus archivos deben tener:

```
Columnas requeridas:
- date (DATE)
- lat (FLOAT)
- lon (FLOAT)
- precip, tmean, tmin, tmax, pet, balance (FLOAT)
- SPI, SPEI, RAI, EDDI, PDSI (FLOAT)

Columnas opcionales:
- cell_id (STRING)
- station_id (STRING)
```

## Documentación Completa

- 📖 **Guía Completa**: `HISTORICAL_DATA_GUIDE.md`
- 📋 **Resumen de Implementación**: `IMPLEMENTATION_SUMMARY.md`
- 🏗️ **Arquitectura**: `ARCHITECTURE.md`

## Troubleshooting

### Servidor no inicia
```bash
# Verifica dependencias
pip install -r requirements.txt

# Verifica base de datos
python init_db.py
```

### DuckDB error
```bash
pip install --upgrade duckdb==0.10.0
```

### Archivos no se listan
```bash
# Verifica credenciales de Cloudflare en .env
# Registra archivos con el script
python scripts/register_cloudflare_files.py
```

## Soporte

Para más información, revisa:
- Código fuente documentado en `app/services/historical_data_service.py`
- Endpoints en `app/api/v1/endpoints/historical.py`
- Ejemplos en `HISTORICAL_DATA_GUIDE.md`
