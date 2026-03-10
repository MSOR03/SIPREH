# 🚀 Frontend - Ajustes para Integración con Backend

## ✅ Cambios Implementados

### 1. **Optimización del Mapa**
- ✅ **Basemap más rápido**: Cambiado de OpenStreetMap a CartoDB (tiles más rápidos)
- ✅ **Configuración optimizada**: `updateWhenIdle`, `keepBuffer` para mejor rendimiento
- ✅ **Selección visual de celdas**: Las celdas ahora se colorean en verde cuando están seleccionadas
- ✅ **Props actualizados**: MapArea y LeafletMap ahora manejan `selectedCell` correctamente

### 2. **Capa de Servicios API** - `src/services/api.js`
Implementa todos los endpoints del backend:

#### Catálogos
- `droughtApi.getVariables()` - Variables hidrometeorológicas
- `droughtApi.getDroughtIndices()` - Índices de sequía
- `droughtApi.getStations()` - Estaciones disponibles
- `droughtApi.getGridMesh()` - Grid de celdas
- `droughtApi.getConfig()` - Configuración del dashboard

#### Análisis Histórico
- `droughtApi.getHistoricalTimeSeries()` - Serie de tiempo (1D)
- `droughtApi.getHistoricalSpatial()` - Datos espaciales (2D)

#### Predicción
- `droughtApi.getPrediction()` - Predicción de sequía

#### Exportación
- `droughtApi.exportData()` - Exportar CSV/PNG/JPEG

#### Historical API (endpoints optimizados)
- `historicalApi.getCatalogVariables()`
- `historicalApi.getCatalogDroughtIndices()`
- `historicalApi.getTimeSeries()` - Con caché optimizado
- `historicalApi.getSpatialData()` - Con caché optimizado
- `historicalApi.getFiles()` - Archivos disponibles

### 3. **Custom Hooks** - `src/hooks/useApi.js`
Hooks React para facilitar integración:

```javascript
// Cargar catálogos
const { variables, droughtIndices, loading } = useCatalog();

// Cargar archivos
const { files, refresh } = useFiles();

// Obtener series de tiempo
const { data, fetchTimeSeries } = useTimeSeries();

// Obtener datos espaciales (2D)
const { data, fetchSpatialData } = useSpatialData();

// Predicciones
const { data, fetchPrediction } = usePrediction();

// Exportar
const { exportData } = useExport();
```

### 4. **Configuración de Entorno**
- ✅ `.env.local.example` - Plantilla para configuración
- ✅ Variable `NEXT_PUBLIC_API_URL` para URL del backend

---

## 📋 Cumplimiento de Requerimientos Funcionales

### ✅ Subpanel Análisis Histórico
- **Menu (1)**: Variables hidrometeorológicas ✓ (precipitación, temperatura, ET, caudal)
- **Menu (2)**: Índices de sequía ✓ (meteorológicos e hidrológicos)
- **Slidebar (1)**: Periodo de tiempo ✓ (fecha inicial - fecha final)
- **Botón Graficar**: ✓ Con validación de selección
- **Botón Guardar**: ✓ Estructura lista, funcionalidad por implementar
- **Gráfica 1D**: ✓ Serie de tiempo en celda o estación (TimeSeriesChart con uPlot)
- **Gráfica 2D**: 🔄 Estructura ready, requiere implementación de visualización espacial

### ✅ Subpanel Predicción
- **Menu (3)**: Índices de sequía ✓
- **Menu (3A)**: Correlaciones con fenómenos macroclimáticos ✓
- **Menu (4)**: Horizonte de tiempo ✓ (1m, 3m, 6m)
- **Botón Graficar**: ✓ Con validación
- **Botón Guardar**: ✓ Estructura lista
- **Predicción 2D**: 🔄 Estructura ready

### ✅ Zona (1) - Área Principal
- **Mapa**: ✓ Con norte y escala
- **Estaciones**: ✓ Visualización con colores
- **Malla de celdas**: ✓ Grid con selección visual
- **Gráficas 1D**: ✓ TimeSeriesChart optimizado (50K+ puntos)
- **Gráficas 2D**: 🔄 Por implementar visualización espacial
- **Botón Reset**: ✓ Limpia gráficas y selecciones

### ✅ Exportación
- **CSV**: ✓ API endpoint ready
- **PNG/JPEG**: ✓ API endpoint ready
- **Series de tiempo**: ✓ Exportación 1D
- **Múltiples arreglos 2D**: ✓ API soporta intervalos de tiempo

---

## 🔧 Para Conectar con Backend

### 1. Configurar URL del Backend

Crear archivo `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 2. Actualizar `page.js` para usar API real

```javascript
import { useCatalog, useTimeSeries, useFiles } from '@/hooks/useApi';

// En el componente
const { variables, droughtIndices } = useCatalog();
const { files } = useFiles();
const { fetchTimeSeries } = useTimeSeries();

// Al graficar
const handleAnalysisPlot = async () => {
  const location = apiHelpers.buildLocationFilter(
    selectedStation,
    selectedCell
  );
  
  const result = await fetchTimeSeries({
    fileId: files[0]?.id, // Usar archivo disponible
    variableOrIndex: analysisState.variable || analysisState.droughtIndex,
    startDate: analysisState.startDate,
    endDate: analysisState.endDate,
    ...location,
  });
  
  setPlotData({
    title: `Análisis: ${analysisState.variable}`,
    type: 'Serie de Tiempo',
    data: result.data, // Formato compatible con TimeSeriesChart
  });
};
```

### 3. Formato de Datos del Backend

El backend debe retornar datos en formato compatible:

**Serie de Tiempo (1D):**
```json
{
  "data": [
    { "date": "2024-01-01", "value": 45.2 },
    { "date": "2024-01-02", "value": 48.7 }
  ],
  "statistics": {
    "mean": 46.5,
    "min": 45.2,
    "max": 48.7
  }
}
```

**Datos Espaciales (2D):**
```json
{
  "grid_cells": [
    {
      "cell_id": "c1",
      "lat": 4.65,
      "lon": -74.1,
      "value": 42.5
    }
  ],
  "bounds": {...}
}
```

---

## 🎨 Mejoras Visuales Implementadas

### Selección de Celdas
```javascript
// Celda normal: Azul semi-transparente
{ fillOpacity: 0.05, color: '#3b82f6' }

// Celda seleccionada: Verde destacado
{ fillOpacity: 0.35, color: '#10b981', weight: 3 }

// Hover: Azul más intenso
{ fillOpacity: 0.2, color: '#2563eb', weight: 2 }
```

### Tiles del Mapa
- **Antes**: OpenStreetMap (lento)
- **Ahora**: CartoDB Light (rápido, limpio, profesional)

---

## 📦 Estructura de Archivos

```
drought-frontend/
├── src/
│   ├── services/
│   │   └── api.js           ← Servicios API
│   ├── hooks/
│   │   └── useApi.js        ← Custom hooks
│   ├── components/
│   │   ├── TimeSeriesChart.js    ← Optimizado con uPlot
│   │   ├── LeafletMap.js         ← Tiles rápidos + selección
│   │   ├── MapArea.js            ← Maneja selecciones
│   │   └── Sidebar.js            ← Validación de selección
│   └── app/
│       └── page.js               ← Lógica principal
├── .env.local.example       ← Plantilla configuración
└── FRONTEND_INTEGRATION.md  ← Esta guía
```

---

## 🔄 Próximos Pasos para Integración Completa

### 1. Implementar Visualización 2D (Mapas de Calor)
```javascript
// Usar una librería como Leaflet.heat o react-leaflet-heatmap
import HeatmapLayer from 'react-leaflet-heatmap-layer-v3';

<HeatmapLayer
  points={spatialData.grid_cells}
  longitudeExtractor={m => m.lon}
  latitudeExtractor={m => m.lat}
  intensityExtractor={m => m.value}
/>
```

### 2. Conectar botones "Guardar"
```javascript
import { useExport } from '@/hooks/useApi';

const { exportData } = useExport();

const handleAnalysisSave = async () => {
  await exportData({
    dataType: 'timeseries',
    format: 'csv', // o 'png', 'jpeg'
    variableOrIndex: analysisState.variable,
    startDate: analysisState.startDate,
    endDate: analysisState.endDate,
    locationId: selectedStation?.id,
  });
};
```

### 3. Cargar estaciones reales del backend
```javascript
// En LeafletMap.js
import { useStations } from '@/hooks/useApi';

const { stations: backendStations } = useStations();

// Usar backendStations en lugar de mock data
```

### 4. Agregar loader/spinner durante cargas
```javascript
const { loading } = useTimeSeries();

{loading && <Spinner />}
{!loading && <TimeSeriesChart data={data} />}
```

---

## ⚠️ Puntos Importantes

### 1. **CORS**
El backend debe permitir requests desde el frontend:
```python
# En backend (main.py o similar)
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 2. **Manejo de Errores**
El frontend ya tiene manejo de errores en `api.js`:
```javascript
try {
  const data = await droughtApi.getVariables();
} catch (error) {
  if (error.status === 404) {
    showError('Datos no encontrados');
  } else {
    showError('Error de conexión');
  }
}
```

### 3. **ID de Archivo**
El frontend necesita saber qué archivo usar. Opciones:
- Tener un `defaultFileId` en configuración
- Permitir al usuario seleccionar archivo
- Usar el archivo más reciente automáticamente

---

## ✅ Checklist de Integración

- [x] Servicios API creados
- [x] Custom hooks implementados
- [x] Variables de entorno configuradas
- [x] Validación de selección implementada
- [x] Gráficas 1D optimizadas
- [x] Mapa optimizado con tiles rápidos
- [x] Selección visual de celdas
- [ ] Conectar componentes con API real
- [ ] Implementar visualización 2D (mapas de calor)
- [ ] Funcionalidad de exportación completa
- [ ] Cargar estaciones reales del backend
- [ ] Testing de integración
- [ ] Manejo de estados de carga

---

## 🎯 Resumen

**Frontend está listo para integración** con:
- ✅ Estructura de servicios API completa
- ✅ Custom hooks React para operaciones comunes
- ✅ Componentes optimizados y validados
- ✅ Manejo de errores implementado
- ✅ UX/UI profesional

**Lo que falta:**
- 🔄 Conectar llamadas mock con llamadas API reales
- 🔄 Implementar visualización 2D completa
- 🔄 Completar funcionalidad de exportación

**Tiempo estimado de integración completa:** 2-3 días de desarrollo
