# Arquitectura del Sistema - DroughtMonitor

## 🏛️ Vista General

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                    │
│          Dashboard + Leaflet Map + Admin Panel              │
└────────────┬──────────────────────────┬─────────────────────┘
             │                          │
          Público                    JWT Auth
             │                          │
┌────────────┴──────────────────────────┴─────────────────────┐
│                   FASTAPI BACKEND                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 API Routers (v1)                    │    │
│  │  /auth  /admin  /parquet  /dashboard  /drought    │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │              Services Layer                         │    │
│  │  • DroughtAnalysisService (7 índices)             │    │
│  │  • CloudStorageService (R2/S3/B2)                 │    │
│  │  • ExportService (CSV)                            │    │
│  │  • CacheService (Redis + Memory)                  │    │
│  │  • GeoProcessor (Leaflet + Clustering)            │    │
│  └──────────────────────┬──────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
┌─────▼─────┐   ┌─────────▼─────┐   ┌────────▼────────┐
│ Database  │   │Cloud Storage  │   │  Redis Cache    │
│ SQLite/   │   │(Parquet Files)│   │   (Opcional)    │
│PostgreSQL │   │  R2/S3/B2     │   │  50x speedup    │
└───────────┘   └───────────────┘   └─────────────────┘
```

---

## 🗄️ Diseño de Base de Datos

### Modelo de Datos

```sql
-- Tabla: users
CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    is_superuser    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: parquet_files
CREATE TABLE parquet_files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        VARCHAR(255) NOT NULL,
    original_name   VARCHAR(255),
    file_size       BIGINT NOT NULL,
    file_hash       VARCHAR(64),
    cloud_provider  VARCHAR(50) NOT NULL,     -- 'cloudflare-r2', 'aws-s3', 'backblaze-b2'
    cloud_url       TEXT NOT NULL,
    bucket_name     VARCHAR(255),
    file_metadata   JSON,                     -- num_rows, num_columns, columns, date_range
    is_active       BOOLEAN DEFAULT TRUE,
    uploaded_by_id  INTEGER,
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (uploaded_by_id) REFERENCES users(id)
);

-- Índices para optimización
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_parquet_is_active ON parquet_files(is_active);
CREATE INDEX idx_parquet_uploaded_at ON parquet_files(uploaded_at DESC);
```

### Relaciones

```
users (1) ──── (N) parquet_files
   │
   └── uploaded_by_id
```

---

## 📦 Estructura del Proyecto

```
drought-backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── auth.py          # Login, registro
│   │       │   ├── admin.py         # Gestión admin
│   │       │   ├── parquet.py       # Upload/download
│   │       │   ├── dashboard.py     # Datos públicos
│   │       │   └── drought.py       # Sistema sequías (9 endpoints)
│   │       └── api.py               # Router principal
│   │
│   ├── core/
│   │   ├── config.py                # Configuración (.env)
│   │   ├── security.py              # JWT, hashing
│   │   └── deps.py                  # Dependencies
│   │
│   ├── db/
│   │   ├── base.py                  # Base SQLAlchemy
│   │   └── session.py               # Database session
│   │
│   ├── models/
│   │   ├── user.py                  # Modelo User
│   │   └── parquet_file.py          # Modelo ParquetFile
│   │
│   ├── schemas/
│   │   ├── user.py                  # Pydantic schemas User
│   │   ├── parquet.py               # Schemas ParquetFile
│   │   ├── token.py                 # Schemas JWT
│   │   └── drought.py               # Schemas Sistema Sequías
│   │
│   ├── services/
│   │   ├── auth.py                  # Autenticación usuarios
│   │   ├── cloud_storage.py         # S3/R2/B2
│   │   ├── parquet_processor.py     # Procesamiento parquet
│   │   ├── cache_service.py         # Redis + Memory
│   │   ├── geo_processor.py         # Geoespacial Leaflet
│   │   ├── drought_analysis.py      # Catalogo 4 vars + 7 índices
│   │   └── export_service.py        # Exportar CSV
│   │
│   └── main.py                      # FastAPI app
│
├── tests/
│   └── test_api.py                  # Suite de pruebas
│
├── .env                             # Variables de entorno
├── .env.example                     # Template .env
├── requirements.txt                 # Dependencias
├── init_db.py                       # Inicializar DB
├── run.py                           # Correr servidor
├── README.md                        # Documentación principal
└── ARCHITECTURE.md                  # Este archivo
```

---

## 🔄 Flujos de Datos

### 1. Análisis de Sequía (Dashboard)

```
Frontend Request
    │
    ├─→ POST /drought/historical/timeseries
    │       │
    │       ├─→ [Validar request con Pydantic]
    │       ├─→ [Consultar file_id en DB]
    │       ├─→ [Descargar .parquet desde R2/S3]
    │       ├─→ [DroughtAnalysisService]
    │       │      ├─→ Pandas read_parquet()
    │       │      ├─→ Filtrar por fecha/ubicación
    │       │      ├─→ Extraer variable/índice
    │       │      └─→ Categorizar sequía
    │       └─→ [Return JSON timeseries]
    │
    ├─→ POST /drought/historical/spatial
    │       │
    │       └─→ [Similar flujo → datos 2D por fecha]
    │
    └─→ POST /drought/prediction/forecast
            │
            └─→ [DroughtAnalysisService + modelo predictivo]
```

### 2. Upload Archivo (Admin)

```
Admin Login
    │
    ├─→ POST /auth/login
    │       └─→ JWT Token
    │
    └─→ POST /parquet/upload (+ Token)
            │
            ├─→ [Verificar JWT]
            ├─→ [Validar .parquet]
            ├─→ [CloudStorageService]
            │      ├─→ boto3.upload_fileobj()
            │      └─→ Get cloud_url
            ├─→ [Extraer metadata con PyArrow]
            ├─→ [Guardar en DB]
            └─→ [Return file info]
```

### 3. Optimización para 45M Registros

```
Request → /dashboard/geo/clusters
    │
    ├─→ [CacheService.get(cache_key)]
    │       │
    │       ├─→ HIT → Return cached data (50x faster)
    │       │
    │       └─→ MISS
    │             ├─→ [Download .parquet]
    │             ├─→ [GeoProcessor.cluster()]
    │             │      ├─→ Spatial clustering (0.1° grid)
    │             │      └─→ Aggregate 45M → 15K clusters
    │             ├─→ [CacheService.set(data, ttl=3600)]
    │             └─→ [Return clustered data]
```

---

## 🛡️ Seguridad

### JWT Authentication

```python
# Generar token
token_data = {
    "sub": user.email,
    "exp": datetime.utcnow() + timedelta(days=7)
}
token = jwt.encode(token_data, SECRET_KEY, algorithm="HS256")

# Verificar token
payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
```

### Password Hashing

```python
# Registro
hashed = pwd_context.hash("plain_password")  # bcrypt

# Login
pwd_context.verify("plain_password", hashed)  # True/False
```

### CORS Policy

```python
origins = [
    "http://localhost:3000",  # Next.js dev
    "https://droughtmonitor.com"  # Producción
]
```

---

## 🎯 Patrones de Diseño

### 1. Dependency Injection

```python
# app/core/deps.py
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# En endpoint
@router.get("/data")
def get_data(db: Session = Depends(get_db)):
    return db.query(Model).all()
```

### 2. Service Layer Pattern

```python
# Lógica de negocio separada
class DroughtAnalysisService:
    def get_timeseries(self, file_id, variable, dates, location):
        # Lógica compleja aquí
        pass

# Endpoint limpio
@router.post("/timeseries")
def get_timeseries(request: TimeSeriesRequest):
    service = DroughtAnalysisService()
    return service.get_timeseries(...)
```

### 3. Repository Pattern

```python
# app/services/auth.py
class AuthService:
    def create_user(self, db, email, password):
        # CRUD operations
        pass
    
    def authenticate(self, db, email, password):
        # Authentication logic
        pass
```

---

## 📊 Catálogos de Datos

### Variables Hidrometeorológicas

| ID | Nombre | Unidad | Descripción |
|----|--------|--------|-------------|
| precipitation | Precipitación | mm | Lluvia acumulada |
| temperature | Temperatura | °C | Temperatura media |
| evapotranspiration | Evapotranspiración | mm | ET potencial |
| streamflow | Caudal | m³/s | Caudal hídrico |

### Índices de Sequía

| ID | Nombre | Categoría | Predicción | Horizonte |
|----|--------|-----------|------------|-----------|
| spi1 | SPI-1 | Meteorológica | ✅ | 1m, 3m, 6m |
| spi3 | SPI-3 | Meteorológica | ✅ | 1m, 3m, 6m |
| spi6 | SPI-6 | Meteorológica | ✅ | 1m, 3m, 6m |
| spei | SPEI | Meteorológica | ✅ | 1m, 3m, 6m |
| edi | EDI | Meteorológica | ✅ | 1m, 3m, 6m |
| ssi | SSI | Hidrológica | ❌ | - |
| swsi | SWSI | Hidrológica | ❌ | - |

---

## 🚀 Escalabilidad

### Performance Optimizations

```python
# 1. Cache multinivel
CacheService
    ├─→ Redis (producción) → 50x speedup
    └─→ Memory (desarrollo) → 10x speedup

# 2. Clustering geoespacial
45,000,000 points → 15,000 clusters (grid 0.1°)

# 3. Índices de base de datos
CREATE INDEX idx_parquet_is_active
CREATE INDEX idx_parquet_uploaded_at

# 4. Async I/O
FastAPI async endpoints + uvicorn workers
```

### Producción Deployment

```bash
# PostgreSQL
DATABASE_URL=postgresql://user:pass@host/db

# Redis
REDIS_URL=redis://default:pass@host:6379

# Workers
uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
```

---

## 📚 Stack Tecnológico

| Categoría | Tecnología | Versión | Propósito |
|-----------|-----------|---------|-----------|
| Framework | FastAPI | 0.109+ | API REST |
| Server | Uvicorn | 0.25+ | ASGI server |
| ORM | SQLAlchemy | 2.0+ | Database |
| Validation | Pydantic | 2.5+ | Schemas |
| Auth | python-jose | 3.3+ | JWT |
| Password | passlib | 1.7+ | Hashing |
| Data | Pandas | 2.2+ | DataFrame |
| Parquet | PyArrow | 15.0+ | Parquet I/O |
| Geo | GeoPandas | 0.14+ | Geospatial |
| Cloud | boto3 | 1.34+ | S3/R2/B2 |
| Cache | Redis | 5.0+ | Performance |

---

## 🔮 Roadmap Futuro

- [ ] Background tasks con Celery
- [ ] Rate limiting (throttling)
- [ ] Monitoring (Prometheus + Grafana)
- [ ] CI/CD con GitHub Actions
- [ ] Docker containerization
- [ ] WebSockets para real-time
- [ ] API v2 con GraphQL
- [ ] Audit logs completos
- [ ] Backup automático DB
- [ ] CDN para archivos estáticos
