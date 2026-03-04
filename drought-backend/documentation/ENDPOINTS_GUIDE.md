# Matriz de Endpoints - Guía de uso

Este documento clarifica qué endpoints usar según tu caso de uso, destacando endpoints duplicados y sus diferencias.

## 📊 Resumen ejecutivo

### Endpoints de datos históricos
| Caso de uso | Endpoint recomendado | Por qué |
|-------------|---------------------|---------|
| **Consultas rápidas** sin análisis | `/api/v1/historical/*` | DuckDB puro, 10-100x más rápido |
| **Análisis complejos** (clustering, stats) | `/api/v1/drought/*` | Incluye procesamiento adicional |
| **Dashboard/visualización** | `/api/v1/dashboard/data/v2` | Optimizado con clustering K-means |
| **Gestión de archivos (admin)** | `/api/v1/admin/files/*` | CRUD completo + sync Cloudflare |
| **Upload/download archivos** | `/api/v1/parquet/*` | Operaciones de archivos |

---

## 🔄 Endpoints duplicados (funcionalidad similar)

### 1️⃣ Catálogo de variables

#### Opción A: `/api/v1/historical/catalog/variables` ⚡ RECOMENDADO
```bash
GET /api/v1/historical/catalog/variables
```
**Ventajas**:
- Más rápido (solo lectura)
- Incluye información de disponibilidad
- Parte del sistema DuckDB optimizado

**Cuándo usar**: Cuando solo necesitas listar variables disponibles.

#### Opción B: `/api/v1/drought/variables`
```bash
GET /api/v1/drought/variables
```
**Ventajas**:
- Incluye metadata adicional de análisis
- Información sobre capacidad de predicción

**Cuándo usar**: Cuando necesitas metadata extendida de variables.

---

### 2️⃣ Catálogo de índices de sequía

#### Opción A: `/api/v1/historical/catalog/drought-indices` ⚡ RECOMENDADO
```bash
GET /api/v1/historical/catalog/drought-indices
```
**Ventajas**: Más rápido, formato consistente con `/catalog/variables`.

#### Opción B: `/api/v1/drought/drought-indices`
```bash
GET /api/v1/drought/drought-indices
```
**Ventajas**: Incluye algoritmos de cálculo y metadata extendida.

**Recomendación**: Usar Opción A a menos que necesites metadata de cálculo.

---

### 3️⃣ Serie temporal (1D) - Consulta histórica ⚠️ IMPORTANTE

#### Opción A: `/api/v1/historical/timeseries` ⚡⚡ RECOMENDADO PARA VELOCIDAD
```bash
POST /api/v1/historical/timeseries
```
**Request**:
```json
{
  "parquet_file_id": 1,
  "variable": "precip",
  "lat": 4.5981,
  "lon": -74.0758,
  "start_date": "2020-01-01",
  "end_date": "2020-12-31",
  "limit": 50000
}
```

**Ventajas**:
- ⚡ **10-20x más rápido** que Opción B
- SQL optimizado con DuckDB
- Mejor para consultas rápidas
- Auto-detección de formatos long/wide
- Auto-detección columnas de fecha

**Cuándo usar**: 
- Dashboard en vivo
- Exploración rápida de datos
- Cuando no necesitas análisis estadísticos extras

#### Opción B: `/api/v1/drought/historical/timeseries` 📊 PARA ANÁLISIS
```bash
POST /api/v1/drought/historical/timeseries
```
**Request**:
```json
{
  "file_id": 1,
  "variable": "SPI",
  "start_date": "2020-01-01",
  "end_date": "2020-12-31",
  "station_id": "BOG001",
  "aggregation": "monthly",
  "include_statistics": true
}
```

**Ventajas**:
- 📊 **Análisis estadísticos** incluidos (tendencias, outliers)
- Agregación temporal (diaria, mensual, anual)
- Clasificación de severidad de sequía
- Cálculo de percentiles
- Más flexible con estaciones vs coordenadas

**Cuándo usar**:
- Reportes científicos
- Análisis de tendencias
- Cuando necesitas stats/percentiles
- Exportar análisis procesados

**Diferencias clave**:
| Feature | `/historical/timeseries` | `/drought/historical/timeseries` |
|---------|-------------------------|----------------------------------|
| Velocidad | ⚡⚡⚡ | ⚡ |
| Stats automáticas | ✅ Básicas | ✅ Avanzadas |
| Tendencias | ❌ | ✅ |
| Percentiles | ❌ | ✅ |
| Agregación temporal | ❌ | ✅ (daily/monthly/yearly) |
| Clustering | ❌ | ✅ |
| Formato soportado | Long/Wide | Long primarily |

---

### 4️⃣ Datos espaciales (2D) - Mapa

#### Opción A: `/api/v1/historical/spatial` ⚡⚡ RECOMENDADO PARA VELOCIDAD
```bash
POST /api/v1/historical/spatial
```
**Request**:
```json
{
  "parquet_file_id": 1,
  "variable": "precip",
  "target_date": "2020-06-15",
  "min_lat": -5.0,
  "max_lat": 15.0,
  "min_lon": -80.0,
  "max_lon": -65.0,
  "limit": 100000
}
```

**Ventajas**:
- ⚡ **10-15x más rápido** que Opción B
- Ideal para cargar mapas rápidamente
- Filtrado eficiente por bounds
- Hasta 100k celdas

**Cuándo usar**:
- Mapas interactivos en tiempo real
- Zoom/pan dinámico en frontend
- Cuando solo necesitas valores raw

#### Opción B: `/api/v1/drought/historical/spatial` 📊 PARA ANÁLISIS
```bash
POST /api/v1/drought/historical/spatial
```
**Request**:
```json
{
  "file_id": 1,
  "variable": "SPI",
  "date": "2020-06-15",
  "bounds": {
    "min_lat": -5.0,
    "max_lat": 15.0,
    "min_lon": -80.0,
    "max_lon": -65.0
  },
  "include_clustering": true,
  "cluster_count": 5
}
```

**Ventajas**:
- 🎨 **Clustering K-means** automático
- Categorización de severidad
- Interpolación espacial (opcional)
- Cálculo de hotspots
- GeoJSON output

**Cuándo usar**:
- Mapas temáticos con clustering
- Análisis de patrones espaciales
- Detección de hotspots
- Exportar a GIS

**Diferencias clave**:
| Feature | `/historical/spatial` | `/drought/historical/spatial` |
|---------|----------------------|-------------------------------|
| Velocidad | ⚡⚡⚡ | ⚡ |
| Clustering | ❌ | ✅ K-means |
| Categorización | ❌ | ✅ Severity levels |
| Interpolación | ❌ | ✅ IDW |
| GeoJSON | ❌ | ✅ |
| Límite de celdas | 100k | 50k (procesa más pesado) |

---

### 5️⃣ Listado de archivos

#### Opción A: `/api/v1/admin/files` 🔐 ADMIN COMPLETO
```bash
GET /api/v1/admin/files
```
**Requiere**: Autenticación + rol admin

**Funcionalidad**:
- ✅ CRUD completo (crear, leer, actualizar, eliminar)
- ✅ Sincronización BD ↔ Cloudflare
- ✅ Registro de archivos externos
- ✅ Activación/desactivación
- ✅ Ver archivos inactivos

**Endpoints disponibles**:
```bash
GET    /api/v1/admin/files                    # Listar todos
GET    /api/v1/admin/files/{id}               # Detalles
DELETE /api/v1/admin/files/{id}               # Eliminar
POST   /api/v1/admin/files/register-external  # Registrar desde cloud
POST   /api/v1/admin/files/cloud/sync         # Sincronizar BD ↔ cloud
POST   /api/v1/admin/files/{id}/activate      # Activar/desactivar
```

**Cuándo usar**: Panel de administración, gestión de archivos.

#### Opción B: `/api/v1/historical/files` 📖 SOLO LECTURA
```bash
GET /api/v1/historical/files
```
**Requiere**: Solo lectura (sin autenticación)

**Funcionalidad**:
- ✅ Listar archivos activos
- ✅ Ver metadata (columnas, formato)
- ✅ Validar estructura de archivo
- ❌ No puede modificar

**Endpoints disponibles**:
```bash
GET /api/v1/historical/files                # Listar activos
GET /api/v1/historical/files/{id}/info      # Detalles + metadata
GET /api/v1/historical/files/{id}/columns   # Columnas disponibles
GET /api/v1/historical/files/{id}/validate  # Validar formato
```

**Cuándo usar**: Frontend para selección de archivos, exploración de datos.

---

## 🎯 Endpoints únicos (sin duplicados)

### 📊 Dashboard
```bash
POST /api/v1/dashboard/data/v2     # Dashboard v2 (RECOMENDADO)
POST /api/v1/dashboard/data        # Dashboard v1 (legacy)
GET  /api/v1/dashboard/geo/geojson
GET  /api/v1/dashboard/geo/clusters
GET  /api/v1/dashboard/geo/heatmap
```
**Uso**: Visualización optimizada con clustering, solo usar estos endpoints para dashboard.

### 🔮 Predicción de sequía
```bash
POST /api/v1/drought/prediction/forecast
```
**Único endpoint** para predicciones de sequía. No hay alternativa.

### 📤 Exportación de datos
```bash
POST /api/v1/drought/export
```
**Único endpoint** para exportar análisis (CSV, JSON, GeoJSON).

### 📁 Upload/Download archivos
```bash
POST /api/v1/parquet/upload        # Upload archivo local
GET  /api/v1/parquet/download/{id}
GET  /api/v1/parquet/metadata/{id}
```
**Únicos endpoints** para operaciones de archivos.

### 🔐 Autenticación
```bash
POST /api/v1/auth/login
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```
**Únicos endpoints** para autenticación JWT.

### 👤 Administración de usuarios
```bash
GET  /api/v1/admin/users
POST /api/v1/admin/users
GET  /api/v1/admin/users/{id}
PUT  /api/v1/admin/users/{id}
```
**Únicos endpoints** para gestión de usuarios.

---

## 💡 Decisiones rápidas (Cheat Sheet)

### ¿Qué endpoint usar?

```
┌─────────────────────────────────────────────────────┐
│ ¿Necesitas máxima velocidad?                        │
│ ├─ Sí → /api/v1/historical/*                       │
│ └─ No, necesito análisis → /api/v1/drought/*       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ¿Qué tipo de visualización?                         │
│ ├─ Mapa interactivo → /historical/spatial          │
│ ├─ Mapa con clusters → /drought/historical/spatial │
│ ├─ Dashboard completo → /dashboard/data/v2         │
│ └─ Gráfico de tiempo → /historical/timeseries      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ¿Necesitas gestionar archivos?                      │
│ ├─ Admin (CRUD) → /admin/files/*                   │
│ ├─ Upload/download → /parquet/*                    │
│ └─ Solo listar → /historical/files                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ¿Necesitas features especiales?                     │
│ ├─ Predicción → /drought/prediction/forecast       │
│ ├─ Export → /drought/export                        │
│ └─ Clustering → /drought/historical/spatial        │
└─────────────────────────────────────────────────────┘
```

---

## 🚨 Endpoints deprecados (no usar)

| Endpoint deprecado | Usar en su lugar | Razón |
|-------------------|------------------|-------|
| `/api/v1/dashboard/data` | `/api/v1/dashboard/data/v2` | v2 es 3x más rápido |
| `/api/v1/dashboard/time-series` | `/api/v1/historical/timeseries` | Inconsistente con nueva arquitectura |

---

## 🔍 Ejemplos comparativos

### Ejemplo 1: Obtener serie de tiempo

**❌ NO ÓPTIMO** (usa servicio de análisis cuando no lo necesitas):
```python
response = requests.post("/api/v1/drought/historical/timeseries", json={
    "file_id": 1,
    "variable": "precip",
    "start_date": "2020-01-01",
    "end_date": "2020-12-31",
    "station_id": "BOG001"
})
# Demora: ~850ms
```

**✅ ÓPTIMO** (usa DuckDB directo):
```python
response = requests.post("/api/v1/historical/timeseries", json={
    "parquet_file_id": 1,
    "variable": "precip",
    "lat": 4.5981,
    "lon": -74.0758,
    "start_date": "2020-01-01",
    "end_date": "2020-12-31"
})
# Demora: ~45ms (18.9x más rápido)
```

### Ejemplo 2: Mapa con análisis

**✅ CORRECTO** (necesitas clustering):
```python
response = requests.post("/api/v1/drought/historical/spatial", json={
    "file_id": 1,
    "variable": "SPI",
    "date": "2020-06-15",
    "bounds": {"min_lat": -5, "max_lat": 15, "min_lon": -80, "max_lon": -65},
    "include_clustering": True,
    "cluster_count": 5
})
# Retorna clusters coloreados automáticamente
```

**❌ INCORRECTO** (usarías raw data sin clustering):
```python
# Si usas /historical/spatial aquí, tendrías que hacer clustering en frontend
# = más lento + más código
```

---

## 📚 Ver también

- [FLUJOS_CONSULTA.md](FLUJOS_CONSULTA.md) - Flujos completos de 1D/2D con frontend
- [HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md) - Documentación técnica DuckDB
- [README.md](README.md) - Guía principal del proyecto
