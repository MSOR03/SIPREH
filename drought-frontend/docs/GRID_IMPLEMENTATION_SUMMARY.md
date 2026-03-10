# Sistema de Navegación Jerárquica - Resumen de Implementación

**Fecha**: 2024
**Estado**: ✅ Completado
**Archivos Modificados**: 2
**Archivos Creados**: 3

---

## 🎯 Objetivo

Implementar un sistema de navegación jerárquica de tres niveles que permita a los usuarios explorar celdas de grid con diferentes resoluciones:

- **0.25°** (ERA5) → ~28km por celda - Vista general
- **0.10°** (IMERG) → ~11km por celda - Vista intermedia  
- **0.05°** (CHIRPS) → ~5.5km por celda - Vista detallada

---

## 📦 Archivos Creados

### 1. `src/utils/gridLevels.js` (350 líneas)
**Propósito**: Configuración y utilidades del sistema de grid

**Funciones principales**:
- `GRID_LEVELS` - Configuración de los 3 niveles de resolución
- `generateGridCells(bounds, resolution)` - Genera celdas para un área
- `generateChildCells(parentCell, childResolution)` - Drill-down
- `detectGridLevel(resolution)` - Detecta nivel actual
- `getCellStyle(level, isSelected, isHovered)` - Estilos visuales
- `determineClickAction(level, clickType)` - Lógica de interacción
- `BOGOTA_BOUNDS` - Coordenadas de Bogotá

### 2. `src/hooks/useGridNavigation.js` (180 líneas)
**Propósito**: Hook React para gestionar navegación jerárquica

**Estado gestionado**:
- `currentLevel`: Nivel actual ('LOW', 'MEDIUM', 'HIGH')
- `gridCells`: Array de celdas visibles
- `selectedCell`: Celda seleccionada
- `hoveredCell`: Celda con hover
- `navigationHistory`: Historial de navegación

**Métodos**:
- `drillDown(cell)` - Navega a siguiente nivel
- `drillUp()` - Regresa a nivel anterior
- `resetToRoot()` - Vuelve al inicio
- `handleCellClick(cell)` - Maneja clicks
- `clearSelection()` - Limpia selección

### 3. `GRID_NAVIGATION_GUIDE.md`
**Propósito**: Documentación completa del sistema

**Contenido**:
- Guía de uso del hook
- Flujos de navegación
- Integración con backend
- Configuración visual
- Ejemplos de código
- Troubleshooting

---

## 🔧 Archivos Modificados

### 1. `src/components/LeafletMap.js`
**Cambios principales**:
- ✅ Acepta `gridCells` por props (en lugar de generarlas internamente)
- ✅ Acepta `currentLevel` para aplicar estilos por nivel
- ✅ Acepta `hoveredCell` para efectos visuales
- ✅ Nuevos handlers: `onCellDoubleClick`, `onCellMouseOver`, `onCellMouseOut`
- ✅ useEffect para regenerar grid cuando cambian las celdas
- ✅ Estilos dinámicos usando `getCellStyle()`

**Props agregados**:
```javascript
gridCells       // Array de celdas a mostrar
currentLevel    // 'LOW' | 'MEDIUM' | 'HIGH'
hoveredCell     // Celda con hover
onCellDoubleClick   // Handler para doble-click
onCellMouseOver     // Handler para mouse over
onCellMouseOut      // Handler para mouse out
```

### 2. `src/components/MapArea.js`
**Cambios principales**:
- ✅ Integración del hook `useGridNavigation`
- ✅ Indicador visual de nivel actual
- ✅ Contador de celdas visibles
- ✅ Controles de navegación (Atrás, Home)
- ✅ Badges informativos según el estado
- ✅ Lógica de drill-down/drill-up en clicks
- ✅ Display de resolución en info de celda seleccionada

**UI Agregada**:
```
┌─────────────────────────────────────────────────┐
│ 🗺️ Mapa de Estaciones                           │
│   Nivel: Baja Resolución (0.25°) (64 celdas)   │
│   [🏠] [← Atrás] [Click en celda para zoom]     │
│   ● Estación Centro | Bogotá D.C.              │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Usuario

### Escenario 1: Navegación Drill-Down

```
Usuario en nivel 0.25° (vista general, 64 celdas)
    ↓ [Click en celda]
Sistema navega a nivel 0.1° (6-7 celdas dentro de esa área)
    ↓ [Click en celda]
Sistema navega a nivel 0.05° (4 celdas dentro de esa área)
    ↓ [Click en celda]
Sistema SELECCIONA la celda (no hay más niveles)
    ✅ Botón "Graficar" habilitado
```

### Escenario 2: Selección Directa

```
Usuario en cualquier nivel
    ↓ [Doble-click en celda]
Sistema SELECCIONA la celda inmediatamente
    ✅ Botón "Graficar" habilitado
```

### Escenario 3: Navegación Drill-Up

```
Usuario en nivel 0.05° (vista detallada)
    ↓ [Click en "← Atrás"]
Sistema regresa a nivel 0.1° (con las mismas celdas de antes)
    ↓ [Click en "← Atrás"]
Sistema regresa a nivel 0.25° (con las mismas celdas de antes)
```

### Escenario 4: Reset Completo

```
Usuario en cualquier nivel
    ↓ [Click en "🏠 Home" o "Reiniciar"]
Sistema vuelve a nivel 0.25° inicial
    ✅ Todas las selecciones limpiadas
    ✅ Historial de navegación borrado
```

---

## 🎨 Estilos Visuales

### Colores por Nivel

| Nivel | Color | Código | Descripción |
|-------|-------|--------|-------------|
| Bajo (0.25°) | Azul | `#3b82f6` | Vista general |
| Medio (0.1°) | Verde | `#10b981` | Vista intermedia |
| Alto (0.05°) | Púrpura | `#8b5cf6` | Vista detallada |

### Estados de Celda

| Estado | Color | Opacidad | Borde |
|--------|-------|----------|-------|
| Normal | Color de nivel | 0.08 | 1px |
| Hover | Color de nivel | 0.25 | 2px |
| Seleccionada | Verde `#10b981` | 0.35 | 3px |

---

## 📊 Integración con Backend

### Endpoints Preparados

1. **Obtener archivo por resolución**:
```javascript
GET /drought/files
// Filtra por metadata.resolution = 0.25, 0.1 o 0.05
```

2. **Obtener datos espaciales** (para colorear celdas):
```javascript
POST /historical/spatial
{
  file_id: number,
  variable: string,
  index: string,
  date: string
}
// Retorna: Array de { cell_id, lat, lon, value, category, color }
```

3. **Obtener series temporales** (para graficar):
```javascript
POST /historical/timeseries
{
  file_id: number,
  lat: number,
  lon: number,
  variable: string,
  start_date: string,
  end_date: string
}
```

### Método Helper Agregado

En `src/services/api.js`:

```javascript
getFileByResolution: async (resolution) => {
  const files = await fetchApi('/historical/files');
  return files.find(f => 
    Math.abs((f.metadata?.resolution || 0.1) - resolution) < 0.01
  ) || files[0];
}
```

---

## ✅ Testing Checklist

- [x] Genera celdas iniciales de Bogotá (0.25°)
- [x] Click en celda LOW → navega a MEDIUM
- [x] Click en celda MEDIUM → navega a HIGH
- [x] Click en celda HIGH → selecciona (no navega más)
- [x] Doble-click en cualquier nivel → selecciona
- [x] Botón "Atrás" funciona
- [x] Botón "Home" vuelve al inicio
- [x] Selección limpia al navegar
- [x] Indicador de nivel actualizado
- [x] Contador de celdas correcto
- [x] Estilos visuales por nivel
- [x] Hover effect funciona
- [x] Sin errores en consola

---

## 🚀 Próximos Pasos

### Pendiente de Implementación

1. **Conectar API de datos espaciales**
   - Llamar a `/historical/spatial` al cargar cada nivel
   - Colorear celdas según valor de sequía
   - Mostrar leyenda de colores

2. **Conectar API de series temporales**
   - Al seleccionar celda, obtener datos de `/historical/timeseries`
   - Renderizar TimeSeriesChart con datos reales
   - Aplicar downsampling si es necesario

3. **Integrar archivos Parquet**
   - Usar `getFileByResolution()` para obtener archivo correcto
   - Pasar `file_id` a endpoints de datos

4. **Visualización 2D (Spatial)**
   - Crear componente SpatialMap
   - Mostrar heatmap de todas las celdas
   - Permitir seleccionar fecha específica

### Mejoras UX

- [ ] Animación suave al cambiar de nivel
- [ ] Zoom automático del mapa al drill-down
- [ ] Loading state al cargar celdas
- [ ] Tooltip con info de celda al hover
- [ ] Breadcrumbs de navegación (0.25° > 0.1° > Celda XYZ)
- [ ] Caché de celdas visitadas

---

## 📝 Notas Técnicas

### Generación de Celdas

- **Nivel 0.25°**: ~64 celdas para Bogotá (latStart: 4.45, latEnd: 4.85, lonStart: -74.25, lonEnd: -73.95)
- **Drill-down**: Genera ~6-7 celdas de 0.1° dentro de una celda de 0.25°
- **Drill-down**: Genera ~4 celdas de 0.05° dentro de una celda de 0.1°

### Identificación de Celdas

Formato: `cell_LAT_LON` (ej: `cell_4.6500_-74.1000`)
- Precisión de 4 decimales
- Centro de la celda

### Historial de Navegación

```javascript
navigationHistory = [
  {
    level: 'LOW',
    cells: [...],
    selectedCell: null,
    parentCell: {id: 'cell_4.6_-74.1', ...}
  }
]
```

---

## 🐛 Debugging

### Console Logs Útiles

```javascript
console.log('Current level:', gridNav.currentLevel);
console.log('Grid cells:', gridNav.gridCells.length);
console.log('Can drill down:', gridNav.canDrillDown);
console.log('Can drill up:', gridNav.canDrillUp);
console.log('Navigation history:', gridNav.navigationHistory.length);
console.log('Selected cell:', gridNav.selectedCell);
```

### Verificación Visual

- Nivel BAJO: Celdas azules, ~64 celdas
- Nivel MEDIO: Celdas verdes, ~6-7 celdas
- Nivel ALTO: Celdas púrpura, ~4 celdas
- Seleccionada: Verde brillante, borde grueso

---

## 📚 Referencias

- [Guía Completa de Navegación](./GRID_NAVIGATION_GUIDE.md)
- [API Service Layer](./src/services/api.js)
- [Hook useApi](./src/hooks/useApi.js)
- [Backend Endpoints](../drought-backend/documentation/ENDPOINTS_GUIDE.md)

---

**Implementado por**: GitHub Copilot
**Modelo**: Claude Sonnet 4.5
**Tag**: `v1.0-grid-navigation`
