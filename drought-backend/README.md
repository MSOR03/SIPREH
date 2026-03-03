# Drought Monitoring System - Backend API

Sistema de monitoreo de sequía con análisis espaciotemporal de alto rendimiento usando DuckDB y almacenamiento en nube.

## 🚀 Características principales

- **Ultra-rápido**: DuckDB procesa millones de registros en milisegundos (10-100x más rápido que Pandas)
- **Almacenamiento cloud**: Integración con Cloudflare R2 (S3-compatible)
- **Sincronización bidireccional**: BD ↔ Cloudflare automática
- **Formatos flexibles**: Detección automática de formatos long/wide y columnas de fecha
- **Caché inteligente**: Sistema de dos niveles (Redis + memoria)
- **Autenticación JWT**: Access + refresh tokens con roles de usuario
- **API REST completa**: FastAPI con documentación automática (OpenAPI/Swagger)

## 📋 Requisitos

- Python 3.9+
- PostgreSQL 12+
- Redis (opcional, mejora rendimiento de caché)
- Cloudflare R2 (opcional, para almacenamiento en nube)

## ⚡ Quick Start

### Windows
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Editar .env con tus credenciales
python init_db.py
python run.py
```

### Linux/Mac
```bash
chmod +x setup.sh
./setup.sh
cp .env.example .env
# Editar .env con tus credenciales
source venv/bin/activate
python init_db.py
python run.py
```

**Servidor disponible en**: `http://localhost:8000`  
**Documentación API**: `http://localhost:8000/docs`

**Usuario admin por defecto**:
- Email: `admin@example.com`
- Password: `admin123`

## 📚 Documentación

> 📑 **Ver índice completo**: [DOCS_INDEX.md](DOCS_INDEX.md) - Toda la documentación disponible organizada por categorías y rutas de aprendizaje

### 🚀 Para empezar
- **[Quick Start Guide](QUICKSTART.md)** - Puesta en marcha rápida
- **[FAQ](FAQ.md)** - Preguntas frecuentes y solución de problemas

### 📖 Guías de usuario
- **[Matriz de Endpoints](ENDPOINTS_GUIDE.md)** 🆕 - **¿Qué endpoint usar?** Guía completa de endpoints duplicados y recomendaciones
- **[Flujos de consulta 1D/2D](FLUJOS_CONSULTA.md)** - Cómo hacer consultas timeseries y espaciales
- **[Guía de variables](VARIABLES_GUIDE.md)** - Variables climáticas disponibles
- **[Gestión de archivos](FILE_MANAGEMENT_GUIDE.md)** - Upload, registro y gestión de archivos parquet

### 🔧 Guías técnicas
- **[Sistema DuckDB](HISTORICAL_DATA_GUIDE.md)** - Arquitectura completa del sistema de consultas
- **[Sincronización Cloudflare](SINCRONIZACION_CLOUDFLARE.md)** - Sync bidireccional BD ↔ R2
- **[Arquitectura del sistema](ARCHITECTURE.md)** - Diseño general y componentes

### ⚡ Referencia rápida
- **[Respuestas rápidas](RESPUESTAS_RAPIDAS.md)** - Ejemplos de código copy-paste

## 🔌 API Endpoints

### 🔐 Autenticación (`/api/v1/auth`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/login` | Login con email/password → tokens |
| POST | `/refresh` | Renovar access token con refresh token |
| GET | `/me` | Información del usuario actual |

### 👤 Administración (`/api/v1/admin`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/users` | Listar usuarios (admin) |
| POST | `/users` | Crear nuevo usuario (admin) |
| GET | `/files` | Listar archivos registrados |
| POST | `/files/upload` | Subir archivo parquet local |
| POST | `/files/register-external` | Registrar archivo en Cloudflare R2 |
| DELETE | `/files/{id}?delete_from_cloud=true` | Eliminar archivo (BD + cloud) |
| POST | `/files/cloud/sync` | Sincronizar BD ↔ Cloudflare |

### 📊 Datos históricos - DuckDB optimizado (`/api/v1/historical`)
**Recomendado para consultas rápidas de datos históricos**

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/catalog/all` | Catálogo completo (variables + índices) |
| GET | `/catalog/variables` | Variables climáticas disponibles |
| GET | `/files` | Archivos disponibles con metadatos |
| GET | `/files/{id}/info` | Información detallada de archivo |
| GET | `/files/{id}/columns` | Columnas disponibles (auto-detectado) |
| POST | `/timeseries` | **1D**: Serie temporal (celda única, rango fechas) |
| POST | `/spatial` | **2D**: Mapa espacial (todas celdas, fecha única) |

### 🌊 Análisis de sequía (`/api/v1/drought`)
**Incluye features adicionales: clustering, predicción, export**

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/timeseries` | Serie temporal + stats + tendencias |
| POST | `/spatial` | Análisis espacial + clustering |
| POST | `/predict` | Predicciones de sequía |
| POST | `/export` | Exportar análisis a CSV/JSON/GeoJSON |

### 📈 Dashboard (`/api/v1/dashboard`)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/data/v2` | **Recomendado**: Dashboard optimizado con clustering |
| POST | `/data` | Dashboard v1 (legacy) |

## 💡 Ejemplos de uso

### Consulta 1D: Serie temporal (celda única)
```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/historical/timeseries",
    json={
        "file_id": 1,
        "variable": "precip",
        "lat": 4.5981,      # Bogotá
        "lon": -74.0758,
        "start_date": "2020-01-01",
        "end_date": "2020-12-31",
        "limit": 50000      # Máximo 50k registros
    }
)

data = response.json()
# [{"date": "2020-01-01", "value": 12.5}, ...]
```

### Consulta 2D: Mapa espacial (todas las celdas, una fecha)
```python
response = requests.post(
    "http://localhost:8000/api/v1/historical/spatial",
    json={
        "file_id": 1,
        "variable": "precip",
        "date": "2020-06-15",
        "bounds": {
            "min_lat": -5.0,
            "max_lat": 15.0,
            "min_lon": -80.0,
            "max_lon": -65.0
        },
        "limit": 100000     # Máximo 100k registros
    }
)

data = response.json()
# [{"lat": 4.5, "lon": -74.0, "value": 15.2}, ...]
```

### Sincronización Cloudflare R2
```bash
# Registrar archivo que ya existe en Cloudflare
curl -X POST "http://localhost:8000/api/v1/admin/files/register-external" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cloud_key": "grid_IMERG.parquet",
    "name": "IMERG Precipitation",
    "description": "IMERG 0.10° resolution",
    "data_type": "precipitation"
  }'

# Sincronizar BD ↔ Cloudflare (bidireccional)
curl -X POST "http://localhost:8000/api/v1/admin/files/cloud/sync" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Resultado: {"registered": 2, "deleted_from_db": 1, "total_files": 5}
```

## 📊 Performance

### Benchmarks DuckDB vs Pandas

| Operación | Pandas | DuckDB | Mejora |
|-----------|--------|--------|--------|
| Serie temporal (10k registros) | 850ms | 45ms | **18.9x** |
| Mapa espacial (100k registros) | 2.1s | 180ms | **11.7x** |
| Agregación mensual (1M registros) | 8.5s | 420ms | **20.2x** |

### Límites recomendados
- **Timeseries (1D)**: `limit=50000` (default)
- **Spatial (2D)**: `limit=100000` (default)
- Usar filtros de `start_date`/`end_date` y `bounds` para optimizar

## 🔧 Configuración

### Variables de entorno (.env)
```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost/droughtdb

# Seguridad JWT
SECRET_KEY=your-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS (frontend URL)
ALLOWED_ORIGINS=["http://localhost:3000"]

# Cloudflare R2 (opcional)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Redis (opcional, mejora caché)
REDIS_URL=redis://localhost:6379/0
```

## 🗂️ Estructura del proyecto

```
drought-backend/
├── app/
│   ├── api/v1/
│   │   ├── api.py                      # Router principal
│   │   └── endpoints/
│   │       ├── auth.py                 # JWT authentication
│   │       ├── admin.py                # User + file management
│   │       ├── historical.py           # ⚡ DuckDB queries (fast)
│   │       ├── drought.py              # Drought analysis + extras
│   │       ├── dashboard.py            # Dashboard v1 (legacy)
│   │       └── dashboard_v2.py         # Dashboard v2 (recommended)
│   ├── services/
│   │   ├── historical_data_service.py  # 🚀 DuckDB core service
│   │   ├── cloud_storage.py            # Cloudflare R2 client
│   │   ├── cache.py                    # Two-level cache
│   │   └── ...
│   ├── models/                         # SQLAlchemy models
│   ├── schemas/                        # Pydantic schemas
│   ├── core/                           # Config + security
│   └── db/                             # Database session
├── exports/                            # Generated exports
├── uploads/                            # Uploaded files
├── init_db.py                          # DB initialization
└── run.py                              # Entry point
```

## 🛠️ Troubleshooting

### ❌ "Database connection failed"
```bash
# Verificar PostgreSQL está corriendo
sudo systemctl status postgresql  # Linux
# Windows: Services → PostgreSQL

# Verificar DATABASE_URL en .env
postgresql://user:password@localhost:5432/droughtdb
```

### ❌ "Cloudflare R2 authentication failed"
- Verificar `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` en `.env`
- Verificar permisos del bucket (READ + WRITE)
- Probar con: `GET /api/v1/admin/files/cloud/sync`

### ❌ "Column not found in parquet file"
```bash
# Ver columnas disponibles auto-detectadas
GET /api/v1/historical/files/{id}/columns

# Verificar formato (long vs wide)
GET /api/v1/historical/files/{id}/validate
```

### 🐌 Queries muy lentas
1. Usar parámetro `limit` (default: 50k timeseries, 100k spatial)
2. Filtrar por fecha: `start_date`/`end_date`
3. Filtrar por bounds: `min_lat`, `max_lat`, `min_lon`, `max_lon`
4. Verificar caché está activo (Redis recomendado)

Ver más en [FAQ.md](FAQ.md)

## 🚢 Deployment

### Render.com (recomendado)
```bash
# 1. Push a GitHub
# 2. Conectar repositorio en Render.com
# 3. Usar render.yaml (incluido)
# 4. Configurar variables de entorno
# 5. Deploy automático
```

### Docker (próximamente)
```bash
docker build -t drought-backend .
docker run -p 8000:8000 --env-file .env drought-backend
```

## 🧪 Testing

```bash
pip install -r requirements-dev.txt
pytest
pytest --cov=app  # Con cobertura
```

## 📖 API Documentation

Una vez corriendo el servidor:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🤝 Contribuir

1. Fork el repositorio
2. Crear branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Add nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

## 📄 Licencia

[Especificar licencia]

## 📧 Soporte

- Reportar bugs: [GitHub Issues](link-to-issues)
- Documentación completa: Ver sección [📚 Documentación](#-documentación)
- Email: [tu-email]
