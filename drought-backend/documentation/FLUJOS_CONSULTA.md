# Flujos de Consulta - Sistema de Datos Históricos

## ✅ Estado: IMPLEMENTADO Y FUNCIONANDO

---

## 📊 FLUJO 1D: Serie de Tiempo (TimeSeries)

### Objetivo
Mostrar la evolución temporal de una variable/índice en UNA celda específica.

### Parámetros para Identificar la Celda Seleccionada

**Opción A: Por Coordenadas (RECOMENDADO)**
```json
{
  "lat": 4.6097,
  "lon": -74.0817
}
```
- El usuario hace **CLICK en el mapa** 
- El frontend obtiene las coordenadas (lat/lon) del punto clickeado
- El sistema busca la celda más cercana (tolerancia ±0.15°)

**Opción B: Por Cell ID (Alternativa)**
```json
{
  "cell_id": "4.6097_-74.0817"
}
```
- Formato: `"{lat:.4f}_{lon:.4f}"`
- Útil si ya conoces el ID exacto de la celda

### Request Completo

```bash
POST /api/v1/historical/timeseries
Content-Type: application/json

{
  "parquet_file_id": 1,           # ← Nivel de resolución (1, 2, o 3)
  "variable": "precip",            # ← Variable o índice
  "start_date": "2020-01-01",     # ← Rango de fechas INICIO
  "end_date": "2024-12-31",       # ← Rango de fechas FIN
  "lat": 4.6097,                  # ← CELDA: Latitud del click
  "lon": -74.0817,                # ← CELDA: Longitud del click
  "limit": 10000                  # ← Opcional: max registros
}
```

### Qué Hace el Sistema

1. **Descarga el parquet** (solo primera vez, luego usa caché)
2. **Ejecuta query SQL filtrada**:
   ```sql
   SELECT date, lat, lon, value
   FROM read_parquet('file.parquet')
   WHERE ABS(lat - 4.6097) < 0.15        -- ← Filtro por CELDA
     AND ABS(lon - (-74.0817)) < 0.15    -- ← Filtro por CELDA
     AND var = 'precip'                   -- ← Filtro por VARIABLE
     AND date >= '2020-01-01'            -- ← Filtro por FECHAS
     AND date <= '2024-12-31'
   ORDER BY date
   LIMIT 10000
   ```
3. **Encuentra la celda más cercana** al punto clickeado
4. **Filtra solo esa celda** del resultado
5. **Retorna ~1,825 puntos** (5 años × 365 días)

### Response

```json
{
  "variable": "precip",
  "variable_name": "Precipitación",
  "unit": "mm",
  "location": {
    "lat": 4.6097,
    "lon": -74.0817,
    "cell_id": "4.6100_-74.0800"   # ← Celda real encontrada
  },
  "data": [
    {
      "date": "2020-01-01",
      "value": 5.2,
      "quality": "good"
    },
    // ... ~1,825 puntos más
  ],
  "statistics": {
    "mean": 4.5,
    "min": 0.0,
    "max": 45.2,
    "std": 6.3,
    "count": 1826,
    "missing": 0
  }
}
```

### ✅ Verificación

- ✅ Filtra por **UNA celda** específica (lat/lon)
- ✅ Filtra por **rango de fechas** (start_date → end_date)
- ✅ Filtra por **variable o índice** seleccionado
- ✅ Solo carga datos necesarios (NO todo el parquet)
- ✅ Funciona con "precip" (millones de registros) sin problemas

---

## 🗺️ FLUJO 2D: Mapa Espacial (Spatial)

### Objetivo
Mostrar el estado de TODAS las celdas de un nivel en UNA fecha específica.

### Parámetros

**Sin Zoom (Vista Completa):**
```json
{
  "parquet_file_id": 1,           # ← Nivel 1 (baja resolución)
  "variable": "SPEI",
  "target_date": "2024-01-15"     # ← UNA sola fecha
}
```

**Con Zoom (Área Específica):**
```json
{
  "parquet_file_id": 2,           # ← Nivel 2 (media resolución)
  "variable": "SPEI",
  "target_date": "2024-01-15",
  "min_lat": 4.5,                 # ← Bounds del área a mostrar
  "max_lat": 4.75,
  "min_lon": -74.25,
  "max_lon": -74.0,
  "limit": 10000
}
```

### Qué Hace el Sistema

1. **Ejecuta query SQL filtrada**:
   ```sql
   -- Sin bounds (mapa completo)
   SELECT lat, lon, value
   FROM read_parquet('file.parquet')
   WHERE date = '2024-01-15'         -- ← Filtro por UNA FECHA
     AND var = 'SPEI'                 -- ← Filtro por VARIABLE
   LIMIT 100000
   ```

   ```sql
   -- Con bounds (zoom en área)
   SELECT lat, lon, value
   FROM read_parquet('file.parquet')
   WHERE date = '2024-01-15'
     AND var = 'SPEI'
     AND lat >= 4.5 AND lat <= 4.75   -- ← Filtro por ÁREA
     AND lon >= -74.25 AND lon <= -74.0
   LIMIT 10000
   ```

2. **Retorna TODAS las celdas** dentro del área solicitada
3. **Categoriza valores** si es índice de sequía

### Response

```json
{
  "variable": "SPEI",
  "variable_name": "SPEI",
  "unit": "adimensional",
  "date": "2024-01-15",
  "grid_cells": [
    {
      "cell_id": "4.5000_-74.2500",   # ← ID generado automáticamente
      "lat": 4.5,
      "lon": -74.25,
      "value": -1.5,
      "category": "Moderadamente Seco",
      "color": "#FFFF00",
      "severity": 4
    },
    {
      "cell_id": "4.5000_-74.1500",
      "lat": 4.5,
      "lon": -74.15,
      "value": -0.8,
      "category": "Anormalmente Seco",
      "color": "#FFE066",
      "severity": 3
    }
    // ... hasta 10,000 celdas más
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
    "min_lat": 4.5,
    "max_lat": 4.75,
    "min_lon": -74.25,
    "max_lon": -74.0
  }
}
```

### ✅ Verificación

- ✅ Retorna **TODAS las celdas** del nivel (o dentro de bounds)
- ✅ Filtra por **UNA fecha** específica (NO rangos)
- ✅ Filtra por **variable o índice** seleccionado
- ✅ Bounds opcionales para **zoom progresivo**
- ✅ Genera `cell_id` automáticamente como "{lat:.4f}_{lon:.4f}"

---

## 🎯 Cómo Se Identifica una Celda Seleccionada

### En el Response de Spatial (2D)

Cada celda retorna:
```json
{
  "cell_id": "4.6100_-74.0800",   # ← Identificador único
  "lat": 4.61,                     # ← Coordenada latitud
  "lon": -74.08                    # ← Coordenada longitud
}
```

### Cuando el Usuario Hace Click en una Celda

**Opción 1: Usar lat/lon directamente (RECOMENDADO)**
```javascript
// Usuario clickea en celda del mapa
mapElement.addEventListener('click', (event) => {
  const clickedCell = event.target.cellData;
  
  // Llamar TimeSeries con las coordenadas
  fetchTimeSeries({
    lat: clickedCell.lat,        // ← Usar coordenadas directas
    lon: clickedCell.lon,
    variable: selectedVariable,
    start_date: dateRange.start,
    end_date: dateRange.end
  });
});
```

**Opción 2: Usar cell_id (Alternativa)**
```javascript
// Usuario clickea en celda
const cellId = clickedCell.cell_id;  // "4.6100_-74.0800"

// Llamar TimeSeries con cell_id
fetchTimeSeries({
  cell_id: cellId,                 // ← Usar ID de celda
  variable: selectedVariable,
  start_date: dateRange.start,
  end_date: dateRange.end
});
```

### Para Calcular Bounds de Zoom

Cuando usuario hace click en una celda para hacer zoom:

```javascript
// Celda del Nivel 1 (resolución 0.25°)
const cell = { lat: 4.5, lon: -74.25, cellSize: 0.25 };

// Calcular bounds de esa celda para Nivel 2
const bounds = {
  min_lat: Math.floor(cell.lat / cell.cellSize) * cell.cellSize,
  max_lat: Math.floor(cell.lat / cell.cellSize) * cell.cellSize + cell.cellSize,
  min_lon: Math.floor(cell.lon / cell.cellSize) * cell.cellSize,
  max_lon: Math.floor(cell.lon / cell.cellSize) * cell.cellSize + cell.cellSize
};

// Resultado:
// { min_lat: 4.5, max_lat: 4.75, min_lon: -74.25, max_lon: -74.0 }

// Llamar Spatial Nivel 2 con esos bounds
fetchSpatialData({
  parquet_file_id: 2,
  variable: selectedVariable,
  target_date: selectedDate,
  ...bounds,
  limit: 10000
});
```

---

## 📋 Resumen de Parámetros

### TimeSeries (1D)

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `parquet_file_id` | int | ✅ Sí | Nivel de resolución (1, 2, 3) |
| `variable` | string | ✅ Sí | Variable o índice (precip, SPI, etc.) |
| `start_date` | date | ✅ Sí | Fecha inicio del rango |
| `end_date` | date | ✅ Sí | Fecha fin del rango |
| `lat` | float | 🔶 Uno | **Latitud de celda seleccionada** |
| `lon` | float | 🔶 Uno | **Longitud de celda seleccionada** |
| `cell_id` | string | 🔶 Uno | ID de celda (ej: "4.6100_-74.0800") |
| `limit` | int | ❌ No | Max registros (default: 50000) |

**🔶 Uno = Debes usar (lat + lon) O cell_id**

### Spatial (2D)

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `parquet_file_id` | int | ✅ Sí | Nivel de resolución (1, 2, 3) |
| `variable` | string | ✅ Sí | Variable o índice |
| `target_date` | date | ✅ Sí | **UNA fecha específica** |
| `min_lat` | float | ❌ No | Límite sur (para zoom) |
| `max_lat` | float | ❌ No | Límite norte (para zoom) |
| `min_lon` | float | ❌ No | Límite oeste (para zoom) |
| `max_lon` | float | ❌ No | Límite este (para zoom) |
| `limit` | int | ❌ No | Max celdas (default: 100000) |

---

## 🧪 Pruebas Rápidas

### Test 1D (Serie de Tiempo)
```bash
curl -X POST http://localhost:8000/api/v1/historical/timeseries \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "precip",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "lat": 4.6097,
    "lon": -74.0817,
    "limit": 1000
  }'
```

**Resultado esperado**: ~31 puntos (enero 2024)

### Test 2D (Mapa Completo)
```bash
curl -X POST http://localhost:8000/api/v1/historical/spatial \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "SPEI",
    "target_date": "2024-01-15",
    "limit": 1000
  }'
```

**Resultado esperado**: Hasta 1000 celdas en esa fecha

### Test 2D (Con Zoom)
```bash
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
    "limit": 500
  }'
```

**Resultado esperado**: Hasta 500 celdas dentro del área especificada

---

## ✅ Confirmación de Funcionamiento

| Flujo | Estado | Verificación |
|-------|--------|--------------|
| **1D: Una celda + rango fechas** | ✅ OK | Filtra por lat/lon + variable + fechas |
| **2D: Todas celdas + una fecha** | ✅ OK | Filtra por date + variable + bounds |
| **Identificación de celda** | ✅ OK | Via lat/lon o cell_id |
| **Límites configurables** | ✅ OK | Parámetro `limit` en ambos |
| **Generación cell_id** | ✅ OK | Auto-generado como "{lat:.4f}_{lon:.4f}" |
| **Filtros SQL eficientes** | ✅ OK | Solo carga datos necesarios |
| **Caché inteligente** | ✅ OK | Consultas repetidas son rápidas |

---

## 🎓 Conclusión

### Para 1D (TimeSeries):
- ✅ **Celda seleccionada**: Identificada por `lat` + `lon` (del click del usuario)
- ✅ **Filtra**: Solo esa celda + rango de fechas + variable
- ✅ **Retorna**: Serie temporal de ~1,825 puntos (5 años)

### Para 2D (Spatial):
- ✅ **Todas las celdas**: Del nivel seleccionado (o dentro de bounds)
- ✅ **Filtra**: Por UNA fecha + variable + área opcional
- ✅ **Retorna**: Array de celdas con cell_id, lat, lon, value
- ✅ **Cell ID**: Generado automáticamente como "{lat:.4f}_{lon:.4f}"

### Respuesta a tu pregunta:
**"¿Cómo sé cuál celda está seleccionada?"**
- En 1D: Usuario hace click → Frontend envía `lat` y `lon` al backend
- En 2D: Backend retorna cada celda con su `cell_id`, `lat`, `lon`
- Frontend puede usar cualquiera (lat/lon es más directo)
