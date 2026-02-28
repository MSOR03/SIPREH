# 🌍 DroughtMonitor - Monitoreo y Predicción de Sequías para Bogotá

Sistema completo de backend para monitoreo y predicción de sequías con análisis histórico, visualización espacial y temporal, y predicción a corto/mediano plazo.

---

## 🚀 Inicio Rápido

### 1. Instalación

```bash
# Clonar e instalar dependencias
cd drought-backend
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Inicializar base de datos
python init_db.py

# Correr servidor
python run.py
```

Servidor disponible en: **http://localhost:8000**  
Documentación API: **http://localhost:8000/docs**

---

## ⚙️ Configuración (.env)

```bash
# === SEGURIDAD ===
SECRET_KEY=tu-clave-super-secreta-de-minimo-32-caracteres
ADMIN_EMAIL=admin@droughtmonitor.com
ADMIN_PASSWORD=cambiar-en-produccion

# === BASE DE DATOS ===
DATABASE_URL=sqlite:///./droughtmonitor.db
# Para PostgreSQL: postgresql://user:password@localhost/dbname

# === ALMACENAMIENTO EN LA NUBE (Requerido) ===
# Opciones: cloudflare-r2, aws-s3, backblaze-b2
CLOUD_STORAGE_PROVIDER=cloudflare-r2
CLOUD_STORAGE_ENDPOINT=https://tu-account-id.r2.cloudflarestorage.com
CLOUD_STORAGE_BUCKET=drought-data
CLOUD_STORAGE_ACCESS_KEY=tu-access-key
CLOUD_STORAGE_SECRET_KEY=tu-secret-key
CLOUD_STORAGE_REGION=auto

# === CACHE (Opcional - Recomendado para 45M registros) ===
REDIS_URL=redis://localhost:6379/0
# Sin Redis usa memoria (menos eficiente)

# === CORS ===
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]
```

### Opciones de Almacenamiento Gratuito

| Servicio | Espacio Gratis | Configuración |
|----------|----------------|---------------|
| **Cloudflare R2** | 10 GB | Mejor opción, sin cargos de salida |
| **AWS S3** | 5 GB (12 meses) | Estándar de la industria |
| **Backblaze B2** | 10 GB | Económico |

---

## 🏗️ Servicios Implementados

### 1. **DroughtAnalysisService**
Procesamiento de datos de sequía:
- ✅ 4 variables hidrometeorológicas (precipitación, temperatura, ET, caudal)
- ✅ 7 índices de sequía (SPI-1/3/6, SPEI, EDI, SSI, SWSI)
- ✅ Categorización automática (7 niveles de sequía)
- ✅ Series temporales y datos espaciales

### 2. **CloudStorageService**
Gestión de archivos .parquet:
- ✅ Upload/download a Cloudflare R2, AWS S3, Backblaze B2
- ✅ Validación de archivos
- ✅ Extracción de metadatos

### 3. **ExportService**
Exportación de datos:
- ✅ Series de tiempo a CSV
- ✅ Datos espaciales a CSV
- ✅ Múltiples fechas en un solo archivo

### 4. **CacheService**
Optimización para grandes datasets:
- ✅ Cache en Redis (primario)
- ✅ Fallback a memoria
- ✅ 50x mejora de performance

### 5. **GeoProcessor**
Procesamiento geoespacial:
- ✅ Clustering espacial (45M → 15K puntos)
- ✅ GeoJSON para Leaflet
- ✅ Heatmaps
- ✅ Agregación por grilla

---

## 📊 Endpoints de la API

### 🔐 Autenticación

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@droughtmonitor.com",
  "password": "change-this-secure-password"
}

→ {"access_token": "...", "token_type": "bearer"}
```

```http
GET /api/v1/auth/me
Authorization: Bearer <token>

→ Información del usuario actual
```

---

### 📁 Gestión de Archivos Parquet (Admin)

#### Subir archivo
```http
POST /api/v1/parquet/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: archivo.parquet

→ {
  "success": true,
  "file": {
    "id": 1,
    "filename": "archivo_20240228.parquet",
    "file_size": 45000000,
    "cloud_url": "https://..."
  }
}
```

#### Listar archivos
```http
GET /api/v1/admin/files?skip=0&limit=10
Authorization: Bearer <token>

→ {
  "total": 5,
  "files": [...]
}
```

#### Obtener metadatos
```http
GET /api/v1/parquet/metadata/1
Authorization: Bearer <token>

→ {
  "file_id": 1,
  "metadata": {
    "num_rows": 45000000,
    "num_columns": 8,
    "columns": ["date", "lat", "lon", "spi3", ...]
  }
}
```

---

### 🌍 Sistema de Monitoreo de Sequías (Dashboard)

#### 1. Variables Hidrometeorológicas (Menu 1)
```http
GET /api/v1/drought/variables

→ {
  "total": 4,
  "variables": [
    {"id": "precipitation", "name": "Precipitación", "unit": "mm"},
    {"id": "temperature", "name": "Temperatura", "unit": "°C"},
    {"id": "evapotranspiration", "name": "Evapotranspiración", "unit": "mm"},
    {"id": "streamflow", "name": "Caudal", "unit": "m³/s"}
  ]
}
```

#### 2. Índices de Sequía (Menu 2 y 3)
```http
GET /api/v1/drought/drought-indices

→ {
  "total": 7,
  "indices": [
    {"id": "spi1", "name": "SPI-1", "category": "meteorological", "supports_prediction": true},
    {"id": "spi3", "name": "SPI-3", ...},
    {"id": "spi6", "name": "SPI-6", ...},
    {"id": "spei", "name": "SPEI", ...},
    {"id": "edi", "name": "EDI", ...},
    {"id": "ssi", "name": "SSI", "category": "hydrological", ...},
    {"id": "swsi", "name": "SWSI", ...}
  ]
}
```

#### 3. Serie de Tiempo (Análisis Histórico 1D)
```http
POST /api/v1/drought/historical/timeseries
Content-Type: application/json

{
  "file_id": 1,
  "variable_or_index": "spi3",
  "start_date": "2020-01-01",
  "end_date": "2023-12-31",
  "station_id": "BOG001"  // o "cell_id" o "lat"+"lon"
}

→ {
  "variable_or_index": "spi3",
  "location_type": "station",
  "coordinates": {"lat": 4.6097, "lon": -74.0817},
  "unit": "adimensional",
  "data": [
    {"date": "2020-01-01", "value": -0.5, "category": "normal"},
    ...
  ],
  "statistics": {"mean": -0.12, "min": -1.8, "max": 1.2}
}
```

#### 4. Datos Espaciales (Análisis Histórico 2D)
```http
POST /api/v1/drought/historical/spatial
Content-Type: application/json

{
  "file_id": 1,
  "variable_or_index": "precipitation",
  "target_date": "2023-12-01"
}

→ {
  "variable_or_index": "precipitation",
  "date": "2023-12-01",
  "unit": "mm",
  "grid_cells": [
    {"cell_id": "cell_123", "lat": 4.65, "lon": -74.05, "value": 45.2},
    ...
  ],
  "statistics": {...},
  "color_scale": {"type": "continuous", "colormap": "viridis"}
}
```

#### 5. Predicción (Menu 4: 1m, 3m, 6m)
```http
POST /api/v1/drought/prediction/forecast
Content-Type: application/json

{
  "file_id": 1,
  "drought_index": "spi3",
  "horizon": "3m",  // "1m", "3m", "6m"
  "reference_date": "2024-02-28"
}

→ {
  "drought_index": "spi3",
  "horizon": "3m",
  "forecast_range": {"start": "2024-02-28", "end": "2024-05-28"},
  "spatial_data": [...],
  "statistics": {"mean": -0.45, "confidence": 0.75}
}
```

#### 6. Exportar Datos (Botón Guardar)
```http
POST /api/v1/drought/export
Content-Type: application/json

// Serie de tiempo
{
  "export_type": "timeseries_csv",
  "file_id": 1,
  "variable_or_index": "spi3",
  "start_date": "2020-01-01",
  "end_date": "2020-12-31",
  "location_id": "BOG001"
}

// Datos espaciales
{
  "export_type": "spatial_csv",
  "file_id": 1,
  "variable_or_index": "precipitation",
  "target_date": "2023-12-01"
}

→ {
  "success": true,
  "download_url": "/api/v1/drought/download/...",
  "filename": "timeseries_spi3_20240228.csv",
  "expires_at": "2024-02-29T14:30:22"
}
```

#### 7. Estaciones y Malla
```http
GET /api/v1/drought/stations?file_id=1
→ Lista de estaciones con coordenadas

GET /api/v1/drought/grid-mesh?file_id=1
→ Información de la malla de discretización

GET /api/v1/drought/config
→ Configuración del dashboard (área de estudio, escalas de color)
```

---

### 🗺️ Endpoints Geoespaciales Optimizados

#### Clusters Espaciales (Recomendado para 45M registros)
```http
GET /api/v1/dashboard/geo/clusters?file_id=1&grid_size=0.1

→ {
  "type": "clusters",
  "count": 15234,
  "clusters": [
    {"lat": -12.05, "lon": -77.04, "count": 1523, "avg_value": 0.45},
    ...
  ]
}
```

#### GeoJSON para Leaflet
```http
GET /api/v1/dashboard/geo/geojson?file_id=1&max_features=5000

→ {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Point", "coordinates": [-77.04, -12.05]},
      "properties": {"value": 0.45, "category": "moderate"}
    }
  ]
}
```

#### Heatmap
```http
GET /api/v1/dashboard/geo/heatmap?file_id=1&max_points=10000

→ {
  "type": "heatmap",
  "points": [
    {"lat": -12.05, "lon": -77.04, "intensity": 0.75},
    ...
  ]
}
```

---

## 📝 Formato de Archivo .parquet

### Columnas Requeridas

```python
# Obligatorias
date          # Fecha (YYYY-MM-DD)
lat/latitude  # Latitud decimal
lon/longitude # Longitud decimal

# Al menos una variable o índice
precipitation      # mm
temperature        # °C
evapotranspiration # mm
streamflow         # m³/s
spi1, spi3, spi6   # Índices SPI
spei               # Índice SPEI
ssi                # Índice SSI

# Opcionales
station_id    # ID de estación
cell_id       # ID de celda
elevation     # Elevación (m)
```

### Ejemplo de Datos

| date | lat | lon | precipitation | temperature | spi3 | cell_id |
|------|-----|-----|---------------|-------------|------|---------|
| 2023-01-01 | 4.65 | -74.05 | 45.2 | 14.5 | -0.5 | cell_1 |
| 2023-01-01 | 4.66 | -74.06 | 38.7 | 14.2 | -0.8 | cell_2 |

---

## 🔄 Flujo de Trabajo Completo

### 1. Configurar y Correr
```bash
# Configurar .env
nano .env

# Inicializar
python init_db.py

# Correr servidor
python run.py
```

### 2. Login (Admin)
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@droughtmonitor.com","password":"tu-password"}'
```

### 3. Subir Datos
```bash
curl -X POST "http://localhost:8000/api/v1/parquet/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@datos_sequia_bogota.parquet"
```

### 4. Consultar Dashboard
```bash
# Variables disponibles
curl "http://localhost:8000/api/v1/drought/variables"

# Serie de tiempo
curl -X POST "http://localhost:8000/api/v1/drought/historical/timeseries" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": 1,
    "variable_or_index": "spi3",
    "start_date": "2020-01-01",
    "end_date": "2023-12-31",
    "station_id": "BOG001"
  }'

# Datos espaciales
curl -X POST "http://localhost:8000/api/v1/drought/historical/spatial" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": 1,
    "variable_or_index": "precipitation",
    "target_date": "2023-12-01"
  }'

# Predicción
curl -X POST "http://localhost:8000/api/v1/drought/prediction/forecast" \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": 1,
    "drought_index": "spi3",
    "horizon": "3m"
  }'
```

---

## 🎨 Categorías de Sequía

| Categoría | Rango | Color | Hex |
|-----------|-------|-------|-----|
| Extremadamente Húmedo | ≥ 2.0 | Azul Oscuro | #000080 |
| Muy Húmedo | 1.5 a 2.0 | Azul | #0000FF |
| Moderadamente Húmedo | 1.0 a 1.5 | Cyan | #00FFFF |
| **Normal** | **-1.0 a 1.0** | **Verde** | **#00FF00** |
| Moderadamente Seco | -1.5 a -1.0 | Amarillo | #FFFF00 |
| Severamente Seco | -2.0 a -1.5 | Naranja | #FFA500 |
| Extremadamente Seco | < -2.0 | Rojo | #FF0000 |

---

## 🧪 Pruebas

```bash
# Ejecutar suite de pruebas
python test_api.py

# Probar endpoints específicos
curl "http://localhost:8000/api/v1/drought/variables"
```

---

## 🚀 Despliegue en Producción

### PostgreSQL (Recomendado)
```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/droughtmonitor
```

### Redis (Recomendado para 45M registros)
```bash
# Local
docker run -d -p 6379:6379 redis

# O usar servicio cloud (Upstash, Redis Cloud)
REDIS_URL=redis://default:password@endpoint.upstash.io:6379
```

### Plataformas Cloud
- **Render.com**: `render.yaml` incluido
- **Railway**: Conectar repositorio
- **Fly.io**: Despliegue automático
- **AWS EC2**: Instancia t3.small+ con Docker

---

## 📚 Recursos Adicionales

- **Documentación Interactiva**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Arquitectura del Sistema**: Ver [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 🔧 Troubleshooting

### Error: "Cloud storage not configured"
→ Configura credenciales en `.env` y reinicia servidor

### Datos lentos con 45M registros
→ Configura Redis: `REDIS_URL=redis://localhost:6379/0`

### Error: "Variable not found in parquet"
→ Verifica columnas del archivo: `precipitation`, `spi3`, etc.

### Puerto 8000 en uso
→ Cambia puerto en `run.py`: `uvicorn.run(..., port=8001)`

---

## 📞 Soporte

**Credenciales por defecto:**
- Email: `admin@droughtmonitor.com`
- Password: `change-this-secure-password`

**Cambiar en producción** editando `.env`
