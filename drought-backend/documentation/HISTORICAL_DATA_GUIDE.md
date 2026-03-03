# Sistema Optimizado de Datos Históricos con DuckDB

## 🚀 Implementación Completada

Se ha implementado un sistema de consulta rápida de datos históricos para el monitoreo de sequías usando **DuckDB** y **caché inteligente**.

## 🎯 Flujos de Usuario Implementados

### Flujo A: Serie de Tiempo (Gráfico 1D)
```
Usuario → Selecciona CELDA en mapa (lat/lon)
       → Selecciona VARIABLE (precip, SPI, etc.)
       → Selecciona RANGO DE FECHAS (start_date, end_date)
       → Click "Graficar"

Backend → Filtra por lat/lon + variable + fechas
       → Solo carga datos de ESA celda (~1,825 puntos para 5 años)
       → NO carga todo el parquet (millones de registros)
       
Resultado → Gráfico 1D con evolución temporal de la variable
```

### Flujo B: Mapa Espacial 2D con Zoom Progresivo
```
Usuario → Selecciona FECHA específica
       → Selecciona VARIABLE
       → Ve mapa 2D completo (Nivel 1 - Baja resolución)

Nivel 1: Parquet 1 (1M registros, 0.25°)
  → Carga TODAS las celdas en esa fecha (~2,500 celdas)
  → Usuario hace CLICK en celda grande

Nivel 2: Parquet 2 (10M registros, 0.1°)  
  → Carga solo celdas dentro de BOUNDS de celda anterior
  → Usuario ve área ampliada con celdas medianas
  → Usuario hace CLICK en celda mediana

Nivel 3: Parquet 3 (50M registros, celdas pequeñas)
  → Carga solo celdas dentro de BOUNDS de celda anterior
  → Usuario ve máximo detalle
  → Click en celda → Muestra Serie de Tiempo (Flujo A)

Backend → Cada nivel usa bounds para limitar consulta
       → Solo UNA fecha por consulta
       → Límites configurables (default: 100,000 celdas)
```

### Optimización Clave
✅ **TimeSeries**: Filtra POR CELDA (no trae todo el parquet)  
✅ **Spatial**: Filtra POR FECHA + BOUNDS (usa zoom progresivo)  
✅ **Límites**: Configurable vía parámetro `limit`  

## 📊 Características Principales

### 1. **Consultas Ultra Rápidas**
- **DuckDB**: Lectura y consulta SQL directa sobre archivos .parquet
- **Caché en Memoria/Redis**: Los datos frecuentemente consultados se mantienen en caché
- **Descarga Inteligente**: Los archivos .parquet se descargan una vez y se cachean localmente

### 2. **Soporte para Tus Datos**
El sistema está configurado para tus archivos .parquet en Cloudflare con las columnas:

**Variables Hidrometeorológicas:**
- `precip` - Precipitación (mm)
- `tmean` - Temperatura Media (°C)
- `tmin` - Temperatura Mínima (°C)
- `tmax` - Temperatura Máxima (°C)
- `pet` - Evapotranspiración Potencial (mm)
- `balance` - Balance Hídrico (mm)

**Índices de Sequía:**
- `SPI` - Standardized Precipitation Index
- `SPEI` - Standardized Precipitation Evapotranspiration Index
- `RAI` - Rainfall Anomaly Index
- `EDDI` - Evaporative Demand Drought Index
- `PDSI` - Palmer Drought Severity Index

### 3. **Tres Resoluciones Disponibles**
- **Baja Resolución**: 0.25° (1M registros) - Más rápido
- **Media Resolución**: 0.1° (10M registros) - Balance
- **Alta Resolución**: Celdas pequeñas (50M registros) - Más detalle

## 📝 Estructura de Archivos .parquet

Tus archivos deben tener las siguientes columnas mínimas:
```
date, lat, lon, precip, tmean, tmin, tmax, pet, balance, SPI, SPEI, RAI, EDDI, PDSI
```

Opcionalmente puede incluir:
```
cell_id, station_id
```

## 🔧 Configuración Inicial

### 1. Instalar Dependencias

```bash
cd drought-backend
pip install -r requirements.txt
```

Esto instalará:
- `duckdb==0.10.0` - Motor de consultas SQL
- `requests==2.31.0` - Descarga de archivos
- Y todas las demás dependencias

### 2. Configurar Variables de Entorno

Edita tu archivo `.env`:

```env
# Cloud Storage (Cloudflare R2)
CLOUD_STORAGE_ENDPOINT=https://your-account.r2.cloudflarestorage.com
CLOUD_STORAGE_ACCESS_KEY=tu_access_key
CLOUD_STORAGE_SECRET_KEY=tu_secret_key
CLOUD_STORAGE_BUCKET=drought-data

# Cache (opcional - mejora el rendimiento)
REDIS_URL=redis://localhost:6379/0
```

### 3. Subir Archivos .parquet

Hay dos opciones:

#### Opción A: Via Admin Panel

1. Inicia sesión como admin
2. Ve a `/api/v1/admin/parquet/upload`
3. Sube tu archivo .parquet
4. El sistema lo subirá automáticamente a Cloudflare

#### Opción B: Registrar Archivos Ya en Cloudflare

Si ya tienes los archivos en Cloudflare, usa este script:

```python
# scripts/register_cloudflare_files.py
import requests

# URL base de tu API
API_BASE = "http://localhost:8000/api/v1"

# Autenticación (obtén token primero)
def get_admin_token():
    response = requests.post(
        f"{API_BASE}/auth/login",
        data={
            "username": "admin@droughtmonitor.com",
            "password": "tu_password"
        }
    )
    return response.json()["access_token"]

# Registrar archivo
def register_parquet_file(token, file_data):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{API_BASE}/admin/parquet/register",
        json=file_data,
        headers=headers
    )
    return response.json()

# Uso
token = get_admin_token()

# Registrar archivo de baja resolución
low_res_file = {
    "filename": "bogota_drought_025deg.parquet",
    "cloud_url": "https://your-bucket.r2.cloudflarestorage.com/bogota_drought_025deg.parquet",
    "description": "Datos históricos de sequía - Baja resolución (0.25°)",
    "metadata": {
        "resolution": "0.25",
        "records": 1000000,
        "coverage": "Bogotá",
        "period": "1990-2024"
    }
}

result = register_parquet_file(token, low_res_file)
print(f"Archivo registrado con ID: {result['id']}")
```

## 📡 Uso de la API

### 1. Obtener Catálogo de Variables

```bash
# Variables hidrometeorológicas
curl http://localhost:8000/api/v1/historical/catalog/variables

# Índices de sequía
curl http://localhost:8000/api/v1/historical/catalog/drought-indices

# Todo
curl http://localhost:8000/api/v1/historical/catalog/all
```

### 2. Listar Archivos Disponibles

```bash
curl http://localhost:8000/api/v1/historical/files
```

Respuesta:
```json
[
  {
    "file_id": 1,
    "filename": "bogota_drought_025deg.parquet",
    "resolution": "0.25",
    "date_range": {
      "start": "1990-01-01",
      "end": "2024-12-31"
    },
    "spatial_bounds": {
      "min_lat": 4.0,
      "max_lat": 5.0,
      "min_lon": -74.5,
      "max_lon": -73.5
    },
    "size_mb": 45.2,
    "record_count": 1000000
  }
]
```

### 3. Consultar Serie de Tiempo (1D)

**Implementa el requerimiento: Slidebar (1) + Click en celda**

**Flujo del Usuario:**
1. Usuario selecciona una CELDA específica en el mapa (lat/lon)
2. Selecciona variable o índice de sequía
3. Selecciona rango de fechas (start_date, end_date)
4. Sistema consulta SOLO los datos de esa celda en ese periodo
   - ✅ Eficiente: No carga todo el .parquet, solo filtra esa ubicación + variable + fechas
   - ✅ Rápido: Con precipitación (millones de registros) solo trae ~5 años x 365 días = ~1,825 puntos

```bash
curl -X POST http://localhost:8000/api/v1/historical/timeseries \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "precip",
    "start_date": "2020-01-01",
    "end_date": "2024-12-31",
    "lat": 4.6097,
    "lon": -74.0817,
    "limit": 50000
  }'
```

Respuesta:
```json
{
  "variable": "SPI",
  "variable_name": "SPI",
  "unit": "adimensional",
  "location": {
    "lat": 4.6097,
    "lon": -74.0817,
    "cell_id": null
  },
  "data": [
    {
      "date": "2020-01-01",
      "value": -1.2,
      "category": "Moderadamente Seco",
      "color": "#FFFF00",
      "severity": 4,
      "quality": "good"
    },
    ...
  ],
  "statistics": {
    "mean": -0.15,
    "min": -2.8,
    "max": 2.1,
    "std": 0.95,
    "count": 1826,
    "missing": 0
  }
}
```

### 4. Consultar Datos Espaciales (2D)

**Implementa el requerimiento: Graficar 2D para todas las celdas**

**Flujo del Usuario:**
1. Usuario selecciona una FECHA específica
2. Selecciona variable o índice
3. Sistema consulta TODAS las celdas de ese nivel en esa fecha
   - ✅ Eficiente: Solo una fecha, no periodos largos
   - ✅ Rápido: Con límite de 100,000 celdas por query

**Sistema de Zoom con 3 Niveles:**

```
Nivel 1 (Baja Resolución - 0.25°)
  parquet_file_id: 1 (1M registros)
  → Usuario ve mapa completo de Colombia
  → Click en celda grande
  
Nivel 2 (Media Resolución - 0.1°)  
  parquet_file_id: 2 (10M registros)
  → Usa BOUNDS de la celda del Nivel 1
  → Usuario ve área ampliada con celdas medianas
  → Click en celda mediana
  
Nivel 3 (Alta Resolución - celdas pequeñas)
  parquet_file_id: 3 (50M registros)
  → Usa BOUNDS de la celda del Nivel 2
  → Usuario ve máximo detalle del área
```

**Ejemplo - Zoom desde Bogotá:**

```bash
# NIVEL 1: Vista completa (sin bounds)
curl -X POST http://localhost:8000/api/v1/historical/spatial \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "SPEI",
    "target_date": "2024-01-15"
  }'

# Usuario hace click en celda de Bogotá (lat: 4.6, lon: -74.0)
# Sistema calcula bounds de esa celda: 
# min_lat: 4.5, max_lat: 4.75, min_lon: -74.25, max_lon: -74.0

# NIVEL 2: Zoom en Bogotá
curl -X POST http://localhost:8000/api/v1/historical/spatial \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 2,
    "variable": "SPEI",
    "target_date": "2024-01-15",
    "min_lat": 4.5,
    "max_lat": 4.75,
    "min_lon": -74.25,
    "max_lon": -74.0,
    "limit": 10000
  }'

# Usuario hace click en celda más pequeña dentro de Bogotá
# Sistema calcula bounds más estrechos

# NIVEL 3: Máximo detalle
curl -X POST http://localhost:8000/api/v1/historical/spatial \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 3,
    "variable": "SPEI",
    "target_date": "2024-01-15",
    "min_lat": 4.60,
    "max_lat": 4.65,
    "min_lon": -74.10,
    "max_lon": -74.05,
    "limit": 5000
  }'
```

Respuesta:
```json
{
  "variable": "SPEI",
  "variable_name": "SPEI",
  "unit": "adimensional",
  "date": "2024-01-15",
  "grid_cells": [
    {
      "cell_id": "4.0000_-74.5000",
      "lat": 4.0,
      "lon": -74.5,
      "value": -1.5,
      "category": "Moderadamente Seco",
      "color": "#FFFF00",
      "severity": 4
    },
    ...
  ],
  "statistics": {
    "mean": -0.8,
    "min": -2.5,
    "max": 0.5,
    "std": 0.75,
    "count": 2500,
    "total_cells": 2500
  },
  "bounds": {
    "min_lat": 4.0,
    "max_lat": 5.0,
    "min_lon": -74.5,
    "max_lon": -73.5
  }
}
```

## 🎯 Integración con Frontend

### Sistema de Zoom Multi-Nivel

El frontend debe implementar un sistema de zoom progresivo con 3 niveles:

```javascript
// components/DroughtMap.jsx
const ZOOM_LEVELS = {
  1: { 
    fileId: 1, 
    resolution: 0.25, 
    description: "Vista completa",
    cellSize: 0.25  // grados
  },
  2: { 
    fileId: 2, 
    resolution: 0.1, 
    description: "Vista regional",
    cellSize: 0.1
  },
  3: { 
    fileId: 3, 
    resolution: 0.05, 
    description: "Vista detallada",
    cellSize: 0.05
  }
};

function DroughtMap() {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentBounds, setCurrentBounds] = useState(null);
  const [selectedDate, setSelectedDate] = useState("2024-01-15");
  const [mapData, setMapData] = useState(null);

  // Función para calcular bounds de una celda
  const calculateCellBounds = (lat, lon, cellSize) => {
    // Encontrar el origen de la celda (esquina inferior izquierda)
    const cellLat = Math.floor(lat / cellSize) * cellSize;
    const cellLon = Math.floor(lon / cellSize) * cellSize;
    
    return {
      min_lat: cellLat,
      max_lat: cellLat + cellSize,
      min_lon: cellLon,
      max_lon: cellLon + cellSize
    };
  };

  // Cargar datos del nivel actual
  const loadMapData = async (level, bounds = null) => {
    const config = ZOOM_LEVELS[level];
    
    const response = await fetch('http://localhost:8000/api/v1/historical/spatial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parquet_file_id: config.fileId,
        variable: 'SPEI',
        target_date: selectedDate,
        ...bounds,  // min_lat, max_lat, min_lon, max_lon (null = todo el mapa)
        limit: level === 3 ? 10000 : 100000  // Menos límite en nivel más detallado
      })
    });
    
    const data = await response.json();
    setMapData(data);
  };

  // Click en una celda → hacer zoom
  const handleCellClick = (lat, lon) => {
    if (currentLevel >= 3) {
      // Ya estamos en nivel máximo, mostrar serie de tiempo
      loadTimeSeries(lat, lon);
      return;
    }
    
    // Calcular bounds de la celda clickeada
    const newBounds = calculateCellBounds(
      lat, 
      lon, 
      ZOOM_LEVELS[currentLevel].cellSize
    );
    
    // Ir al siguiente nivel con esos bounds
    setCurrentLevel(currentLevel + 1);
    setCurrentBounds(newBounds);
    loadMapData(currentLevel + 1, newBounds);
  };

  // Cargar serie de tiempo al click en celda final
  const loadTimeSeries = async (lat, lon) => {
    const response = await fetch('http://localhost:8000/api/v1/historical/timeseries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parquet_file_id: ZOOM_LEVELS[currentLevel].fileId,
        variable: 'SPEI',
        start_date: '2020-01-01',
        end_date: '2024-12-31',
        lat,
        lon,
        limit: 10000
      })
    });
    
    const data = await response.json();
    // Mostrar gráfico 1D
    showTimeSeriesChart(data);
  };

  // Zoom out (volver al nivel anterior)
  const zoomOut = () => {
    if (currentLevel > 1) {
      setCurrentLevel(currentLevel - 1);
      setCurrentBounds(null);  // o guardar historial de bounds
      loadMapData(currentLevel - 1, null);
    }
  };

  // Carga inicial
  useEffect(() => {
    loadMapData(1, null);  // Nivel 1 completo
  }, [selectedDate]);

  return (
    <div>
      <h3>Nivel {currentLevel}: {ZOOM_LEVELS[currentLevel].description}</h3>
      <button onClick={zoomOut} disabled={currentLevel === 1}>
        ← Alejar
      </button>
      
      {/* Renderizar celdas en el mapa */}
      <MapComponent 
        cells={mapData?.grid_cells}
        onCellClick={handleCellClick}
      />
    </div>
  );
}
```

### Ejemplo en JavaScript/React (Serie de Tiempo):

```javascript
// services/historicalDataService.js

const API_BASE = 'http://localhost:8000/api/v1/historical';

export const historicalDataService = {
  // Obtener catálogos
  async getVariables() {
    const response = await fetch(`${API_BASE}/catalog/variables`);
    return response.json();
  },

  async getDroughtIndices() {
    const response = await fetch(`${API_BASE}/catalog/drought-indices`);
    return response.json();
  },

  // Listar archivos
  async getAvailableFiles() {
    const response = await fetch(`${API_BASE}/files`);
    return response.json();
  },

  // Serie de tiempo (para gráfico 1D)
  async getTimeSeries(params) {
    const response = await fetch(`${API_BASE}/timeseries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parquet_file_id: params.fileId,
        variable: params.variable,
        start_date: params.startDate,
        end_date: params.endDate,
        lat: params.lat,
        lon: params.lon
      })
    });
    return response.json();
  },

  // Datos espaciales (para mapa 2D)
  async getSpatialData(params) {
    const response = await fetch(`${API_BASE}/spatial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parquet_file_id: params.fileId,
        variable: params.variable,
        target_date: params.targetDate,
        min_lat: params.bounds?.minLat,
        max_lat: params.bounds?.maxLat,
        min_lon: params.bounds?.minLon,
        max_lon: params.bounds?.maxLon
      })
    });
    return response.json();
  }
};
```

### Ejemplo de uso en componente React:

```jsx
// components/DroughtAnalysis.jsx
import { useState, useEffect } from 'react';
import { historicalDataService } from '../services/historicalDataService';

function DroughtAnalysis() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [variables, setVariables] = useState([]);
  const [timeSeriesData, setTimeSeriesData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cargar archivos y variables al iniciar
  useEffect(() => {
    const loadInitialData = async () => {
      const [filesData, varsData] = await Promise.all([
        historicalDataService.getAvailableFiles(),
        historicalDataService.getVariables()
      ]);
      setFiles(filesData);
      setVariables(varsData.items);
      if (filesData.length > 0) {
        setSelectedFile(filesData[0].file_id);
      }
    };
    loadInitialData();
  }, []);

  // Consultar serie de tiempo al hacer click en el mapa
  const handleMapClick = async (lat, lon) => {
    setLoading(true);
    try {
      const data = await historicalDataService.getTimeSeries({
        fileId: selectedFile,
        variable: 'SPI',
        startDate: '2020-01-01',
        endDate: '2024-12-31',
        lat,
        lon
      });
      setTimeSeriesData(data);
    } catch (error) {
      console.error('Error fetching time series:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Análisis Histórico de Sequía</h2>
      {/* Tu UI aquí */}
    </div>
  );
}
```

## ⚡ Rendimiento

### Benchmarks Estimados

Con DuckDB + caché + filtros optimizados:

**TimeSeries (1D) - UNA celda:**
- 5 años de datos diarios (~1,825 puntos): **50-200ms** (primera vez), **10-50ms** (cacheado)
- ✅ Eficiente incluso con "precip" que tiene millones de registros
- ✅ Solo carga datos de esa celda específica gracias a filtros `WHERE lat AND lon AND date`

**Spatial (2D) - TODAS las celdas en UNA fecha:**
- Nivel 1 (baja resolución, ~2,500 celdas): **100-300ms** (primera vez), **30-80ms** (cacheado)
- Nivel 2 con bounds (media resolución, ~1,000 celdas): **80-200ms**
- Nivel 3 con bounds estrechos (alta resolución, ~500 celdas): **60-150ms**
- ✅ Solo una fecha, no periodos largos
- ✅ Límites configurables para controlar cantidad de celdas

**Descarga de archivo parquet:**
- Archivo 6MB: **1-3s** (solo primera vez, luego caché local)
- Archivo 30MB: **3-8s** (solo primera vez)
- Archivo 130MB: **8-20s** (solo primera vez)

### Optimizaciones Implementadas

1. **Filtros SQL eficientes**:
   ```sql
   -- TimeSeries: Solo UNA celda + rango de fechas + UNA variable
   WHERE lat = 4.6097 
     AND lon = -74.0817 
     AND var = 'precip'
     AND date >= '2020-01-01' 
     AND date <= '2024-12-31'
   LIMIT 50000
   
   -- Resultado: ~1,825 registros de millones disponibles
   ```

   ```sql
   -- Spatial: TODAS las celdas (o bounds) + UNA fecha + UNA variable  
   WHERE date = '2024-01-15'
     AND var = 'SPEI'
     AND lat >= 4.5 AND lat <= 4.75
     AND lon >= -74.25 AND lon <= -74.0
   LIMIT 100000
   
   -- Resultado: ~2,500 celdas de millones disponibles
   ```

2. **Límites configurables**:
   - `limit` en TimeSeries (default: 50,000) - ~137 años de datos diarios
   - `limit` en Spatial (default: 100,000) - suficiente para áreas grandes
   - Frontend puede ajustar según necesidad

3. **Caché en dos niveles**:
   - Redis (si disponible) - compartido entre procesos
   - Memoria - rápido pero volátil

2. **Descarga inteligente**:
   - Los .parquet se descargan una vez y se cachean localmente
   - DuckDB lee directamente del archivo local (muy rápido)

3. **Consultas SQL optimizadas**:
   - Filtrado en la fuente (no carga todo el archivo)
   - Índices automáticos de DuckDB
   - Lectura columnar eficiente

## 🔍 Monitoreo y Debug

### Ver estado del sistema:

```bash
curl http://localhost:8000/api/v1/historical/health
```

### Limpiar caché (útil en desarrollo):

```bash
curl -X POST http://localhost:8000/api/v1/historical/cache/clear
```

## 📚 Estado de Implementación

### ✅ Completado
1. **Sistema de consultas con DuckDB**: Queries SQL optimizadas sobre .parquet
2. **Caché inteligente**: Dos niveles (Redis opcional + memoria)
3. **Filtros eficientes**: Por celda (lat/lon) + variable + fechas/fecha
4. **Límites configurables**: Evita cargar demasiados datos (50k/100k defaults)
5. **Detección automática de formato**: Long (var/value) vs Wide (columnas)
6. **Detección automática de columna de fecha**: date, datetime, ds, time, etc.
7. **Sistema de bounds**: Para zoom progresivo en mapas 2D
8. **Categorización de sequía**: Colores y severidad automática para índices
9. **Cloudflare R2 storage**: Descarga y caché local de .parquet

### 🚧 Próximos Pasos
1. ⬜ **Endpoints de predicción** (horizonte 1m, 3m, 6m)
   - POST `/historical/predict` 
   - Solo para índices con `supports_prediction=True`
   - Modelos ML o estadísticos

2. ⬜ **Exportación de datos** 
   - POST `/historical/export` → CSV, PNG, JPEG
   - Matplotlib/Plotly para gráficos
   - Descarga directa de series temporales

3. ⬜ **Correlaciones macroclimáticas**
   - Análisis con ENSO, PDO, IOD
   - Endpoint `/historical/correlations`
   - Cálculo de Pearson/Spearman

4. ⬜ **Estadísticas avanzadas**
   - Percentiles históricos
   - Anomalías mensuales/anuales
   - Tendencias (Mann-Kendall)

## 🆘 Soporte y Problemas Comunes

### Error: "Variable no disponible"
- Verifica que la columna existe en tu .parquet usando GET `/files/{id}/columns`
- Usa nombres exactos: `precip`, `SPI`, `SPEI`, etc. (case-sensitive)
- Los archivos en formato "long" tienen variable en columna `var`
- Los archivos en formato "wide" tienen cada variable como columna separada

### Error: "Archivo no encontrado"
- Verifica que el archivo está registrado en la DB usando GET `/files`
- Confirma que tiene `cloud_key` configurado (no solo `cloud_url`)
- Usa `/api/v1/historical/files` para ver archivos disponibles

### TimeSeries muy lento o se cae con "precip"
✅ **SOLUCIONADO**: Sistema ahora usa filtros SQL eficientes + límites
- Solo carga datos de UNA celda específica (lat/lon)
- Solo carga rango de fechas solicitado
- Límite default de 50,000 registros (~137 años)
- Ajusta `limit` en el request si necesitas más/menos datos

### Spatial muy lento con parquet grande (50M registros)  
✅ **SOLUCIONADO**: Sistema usa bounds + límites
- Solo carga celdas dentro de bounds especificados
- Solo carga UNA fecha (no rangos)
- Límite default de 100,000 celdas
- Usa zoom progresivo: empieza en Nivel 1 (rápido), luego Nivel 2/3 con bounds

### Mejores Prácticas

**Para TimeSeries (1D):**
```json
{
  "parquet_file_id": 1,
  "variable": "precip",
  "start_date": "2020-01-01",
  "end_date": "2024-12-31",
  "lat": 4.6097,           // ✅ SIEMPRE especifica lat/lon
  "lon": -74.0817,         // ✅ Para filtrar UNA celda
  "limit": 10000           // ✅ Ajusta según necesidad (5 años ~ 1,825 puntos)
}
```

**Para Spatial (2D) - Vista Completa:**
```json
{
  "parquet_file_id": 1,    // ✅ Empieza con Nivel 1 (baja resolución)
  "variable": "SPEI",
  "target_date": "2024-01-15",  // ✅ Solo UNA fecha
  "limit": 100000          // ✅ Suficiente para mapa completo
}
```

**Para Spatial (2D) - Zoom:**
```json
{
  "parquet_file_id": 2,    // ✅ Nivel 2 con bounds
  "variable": "SPEI",
  "target_date": "2024-01-15",
  "min_lat": 4.5,          // ✅ Bounds de celda seleccionada
  "max_lat": 4.75,
  "min_lon": -74.25,
  "max_lon": -74.0,
  "limit": 10000           // ✅ Menos celdas = más rápido
}
```

### Rendimiento lento
- Primera consulta siempre es más lenta (descarga archivo)
- Considera instalar Redis para caché persistente
- Usa archivos de menor resolución para exploración rápida

### DuckDB no disponible
```bash
pip install duckdb==0.10.0
```

## 📞 Contacto

Para preguntas o mejoras, revisa la documentación técnica en:
- `drought-backend/ARCHITECTURE.md`
- `drought-backend/app/services/historical_data_service.py`

---

## 📋 Resumen Ejecutivo

### ¿Qué problema resuelve?
Consulta rápida de **millones de registros** de datos históricos de sequía sin cargar todo en memoria.

### ¿Cómo lo resuelve?
**DuckDB** hace queries SQL directas sobre archivos .parquet con filtros eficientes:
- TimeSeries: `WHERE lat AND lon AND variable AND date BETWEEN ... LIMIT`
- Spatial: `WHERE date AND variable AND lat/lon BETWEEN bounds ... LIMIT`

### ¿Qué tan rápido es?
- **TimeSeries**: 50-200ms (primera vez), 10-50ms (cacheado)
- **Spatial**: 100-300ms (primera vez), 30-80ms (cacheado)
- **Incluso con "precip"** (millones de registros): ✅ Rápido gracias a filtros

### ¿Qué necesito saber para el frontend?

**Para gráfico 1D (Serie de Tiempo):**
```javascript
// Usuario hace click en celda del mapa
const timeseries = await fetch('/api/v1/historical/timeseries', {
  method: 'POST',
  body: JSON.stringify({
    parquet_file_id: 1,         // Nivel de resolución
    variable: 'precip',          // O SPI, SPEI, etc.
    start_date: '2020-01-01',
    end_date: '2024-12-31',
    lat: 4.6097,                 // ✅ IMPORTANTE: Coordenadas exactas
    lon: -74.0817,
    limit: 10000                 // Ajustable
  })
});
```

**Para mapa 2D (Spatial) con Zoom:**
```javascript
// Nivel 1: Vista completa
const level1 = await fetch('/api/v1/historical/spatial', {
  method: 'POST',
  body: JSON.stringify({
    parquet_file_id: 1,          // Baja resolución
    variable: 'SPEI',
    target_date: '2024-01-15',   // ✅ IMPORTANTE: Solo UNA fecha
    // Sin bounds = mapa completo
  })
});

// Usuario hace click en celda → Calcular bounds de esa celda
const cellBounds = {
  min_lat: 4.5, max_lat: 4.75,
  min_lon: -74.25, max_lon: -74.0
};

// Nivel 2: Zoom en área
const level2 = await fetch('/api/v1/historical/spatial', {
  method: 'POST',
  body: JSON.stringify({
    parquet_file_id: 2,          // Media resolución
    variable: 'SPEI',
    target_date: '2024-01-15',
    ...cellBounds,               // ✅ IMPORTANTE: Bounds de celda anterior
    limit: 10000
  })
});
```

### ¿Cómo evito problemas de rendimiento?
1. ✅ **Siempre usa lat/lon** en TimeSeries para filtrar UNA celda
2. ✅ **Siempre usa UNA fecha** en Spatial (no rangos)
3. ✅ **Usa bounds** en zoom para limitar área
4. ✅ **Ajusta limit** según necesidad (defaults son buenos)
5. ✅ **Empieza con Nivel 1** (baja resolución) antes de hacer zoom

### ¿Qué archivos necesito?
```
Nivel 1: parquet_file_id=1 (Baja resolución, 0.25°, ~1M registros)
Nivel 2: parquet_file_id=2 (Media resolución, 0.1°, ~10M registros)  
Nivel 3: parquet_file_id=3 (Alta resolución, celdas pequeñas, ~50M registros)
```

Cada archivo debe tener:
- Formato long: columnas `date, lat, lon, var, value`
- Formato wide: columnas `date, lat, lon, precip, SPI, SPEI, ...`
- Variables: precip, tmean, tmin, tmax, pet, balance, SPI, SPEI, RAI, EDDI, PDSI

