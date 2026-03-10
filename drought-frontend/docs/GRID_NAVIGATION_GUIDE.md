# Sistema de Navegación Jerárquica - Guía de Uso

## Descripción General

El sistema de navegación jerárquica permite a los usuarios navegar entre tres niveles de resolución de celdas de grid en el mapa:

- **Nivel Bajo (0.25°)**: ~28km por celda - Vista general (ERA5)
- **Nivel Medio (0.1°)**: ~11km por celda - Vista intermedia (IMERG)
- **Nivel Alto (0.05°)**: ~5.5km por celda - Vista detallada (CHIRPS)

## Arquitectura

### Archivos Creados

1. **`src/utils/gridLevels.js`**
   - Configuración de niveles de resolución
   - Utilidades para generar celdas
   - Funciones de navegación entre niveles
   - Cálculo de estilos visuales

2. **`src/hooks/useGridNavigation.js`**
   - Hook personalizado para gestionar navegación
   - Manejo de estado de niveles
   - Historial de navegación (drill-down/drill-up)
   - Selección de celdas

3. **Modificaciones**:
   - `src/components/LeafletMap.js` - Integración de navegación jerárquica
   - `src/components/MapArea.js` - UI de controles de navegación

## Flujo de Navegación

### 1. Drill-Down (Navegar a nivel más detallado)

```javascript
// Usuario hace click en una celda de 0.25°
// → Sistema navega a las celdas de 0.1° dentro de esa área
// → Usuario hace click en una celda de 0.1°
// → Sistema navega a las celdas de 0.05° dentro de esa área
```

**Comportamiento**:
- **Single Click**: Si hay siguiente nivel disponible → Navega (drill-down)
- **Single Click**: Si es último nivel (0.05°) → Selecciona celda
- **Double Click**: Siempre selecciona la celda (sin importar el nivel)
- **Shift + Click**: Selecciona celda (sin importar el nivel)

### 2. Drill-Up (Regresar a nivel anterior)

```javascript
// Usuario presiona botón "Atrás"
// → Sistema regresa al nivel anterior con el mismo estado visual
```

**Características**:
- Mantiene historial de navegación
- Restaura estado de selección del nivel anterior
- Botón "Home" para volver al nivel inicial (0.25°)

### 3. Selección de Celda

Una celda seleccionada:
- Se destaca con color verde (`#10b981`)
- Mayor opacidad de relleno (0.35)
- Borde más grueso (weight: 3)
- Habilita el botón "Graficar" en el sidebar

## Uso del Hook

### Importación

```javascript
import { useGridNavigation } from '../hooks/useGridNavigation';
```

### Inicialización

```javascript
const gridNav = useGridNavigation('LOW'); // Inicia en nivel bajo (0.25°)
```

### Propiedades del Hook

```javascript
// Estado
gridNav.currentLevel          // 'LOW' | 'MEDIUM' | 'HIGH'
gridNav.gridCells             // Array de celdas actuales
gridNav.selectedCell          // Celda seleccionada (o null)
gridNav.hoveredCell           // Celda con hover (o null)
gridNav.navigationHistory     // Historial de navegación
gridNav.currentLevelConfig    // Configuración del nivel actual

// Información booleana
gridNav.canDrillDown          // ¿Puede navegar a siguiente nivel?
gridNav.canDrillUp            // ¿Puede regresar a nivel anterior?
gridNav.isAtRoot              // ¿Está en el nivel inicial?
gridNav.isAtLeaf              // ¿Está en el último nivel? (0.05°)

// Métodos
gridNav.drillDown(cell)       // Navega al siguiente nivel
gridNav.drillUp()             // Regresa al nivel anterior
gridNav.resetToRoot()         // Vuelve al inicio
gridNav.handleCellClick(cell) // Maneja click en celda
gridNav.handleCellDoubleClick(cell) // Maneja doble click
gridNav.clearSelection()      // Limpia selección
```

## Integración con Backend

### Flujo de Datos

1. **Obtener archivo por resolución**:
```javascript
import { droughtApi } from '../services/api';

const file = await droughtApi.getFileByResolution(0.25);
// Retorna: { id, filename, file_path, metadata: { resolution: 0.25 } }
```

2. **Obtener datos espaciales**:
```javascript
const spatialData = await historicalApi.getSpatialData({
  file_id: file.id,
  variable: 'precipitation',
  index: 'SPI_3',
  date: '2024-01-15'
});
// Retorna: Array de celdas con valores de sequía
```

3. **Obtener series temporales**:
```javascript
const timeSeries = await historicalApi.getTimeSeries({
  file_id: file.id,
  lat: 4.7110,
  lon: -74.0721,
  variable: 'precipitation',
  start_date: '2023-01-01',
  end_date: '2024-01-31'
});
```

### Mapeo de Resoluciones

El backend detecta resolución por nombre de archivo:

| Patrón | Resolución | Dataset |
|--------|-----------|---------|
| `*era5*` | 0.25° | ERA5 |
| `*imerg*` | 0.10° | IMERG |
| `*chirps*` | 0.05° | CHIRPS |

## Configuración Visual

### Colores por Nivel

Definidos en `src/utils/gridLevels.js`:

```javascript
LOW:    '#3b82f6' (azul)
MEDIUM: '#10b981' (verde)
HIGH:   '#8b5cf6' (púrpura)
```

### Estados de Celda

```javascript
// Normal
{ color: levelColor, weight: 1, fillOpacity: 0.08 }

// Hover
{ color: levelColor, weight: 2, fillOpacity: 0.25 }

// Seleccionada
{ color: '#10b981', weight: 3, fillOpacity: 0.35 }
```

## Ejemplo de Implementación

### Componente con Navegación Completa

```javascript
import { useGridNavigation } from '../hooks/useGridNavigation';
import { formatLevelLabel } from '../utils/gridLevels';

function MyMapComponent() {
  const gridNav = useGridNavigation('LOW');

  const handleCellClick = (cell) => {
    const didDrill = gridNav.handleCellClick(cell, 'single');
    
    if (!didDrill) {
      // Celda seleccionada - cargar datos
      loadCellData(cell);
    } else {
      // Navegó a siguiente nivel - actualizar vista
      console.log('Navegó a nivel:', gridNav.currentLevel);
    }
  };

  return (
    <div>
      {/* Indicador de nivel */}
      <div>
        Nivel actual: {formatLevelLabel(gridNav.currentLevel)}
        ({gridNav.gridCells.length} celdas)
      </div>

      {/* Controles */}
      {gridNav.canDrillUp && (
        <button onClick={gridNav.drillUp}>← Atrás</button>
      )}
      
      {!gridNav.isAtRoot && (
        <button onClick={gridNav.resetToRoot}>🏠 Inicio</button>
      )}

      {/* Mapa */}
      <LeafletMap
        gridCells={gridNav.gridCells}
        currentLevel={gridNav.currentLevel}
        selectedCell={gridNav.selectedCell}
        hoveredCell={gridNav.hoveredCell}
        onGridCellClick={handleCellClick}
        onCellDoubleClick={gridNav.handleCellDoubleClick}
        onCellMouseOver={gridNav.handleCellMouseOver}
        onCellMouseOut={gridNav.handleCellMouseOut}
      />
    </div>
  );
}
```

## Testing

### Probar Navegación

1. **Nivel Bajo → Medio**:
   - Inicia en vista general (0.25°)
   - Click en cualquier celda
   - Verifica que aparecen ~6-7 celdas (0.1°) dentro del área

2. **Nivel Medio → Alto**:
   - Desde nivel medio (0.1°)
   - Click en una celda
   - Verifica que aparecen ~4 celdas (0.05°) dentro del área

3. **Drill-Up**:
   - Desde nivel alto o medio
   - Click en botón "Atrás"
   - Verifica que regresa al nivel anterior con las mismas celdas

4. **Selección**:
   - En cualquier nivel, doble-click en celda
   - Verifica que la celda se destaca en verde
   - Verifica que el botón "Graficar" se habilita

## Troubleshooting

### Las celdas no aparecen
- Verificar que `gridCells` se pasa a LeafletMap
- Verificar en console: `gridNav.gridCells.length`
- Verificar que el mapa se inicializó correctamente

### No navega al hacer click
- Verificar que `onGridCellClick` está conectado
- Verificar que `currentLevel` no es `'HIGH'` (último nivel)
- Verificar console logs para errores

### Los estilos no cambian
- Verificar que `currentLevel` se pasa a LeafletMap
- Verificar que `getCellStyle()` se importó correctamente
- Verificar que `selectedCell` o `hoveredCell` están actualizados

### El historial no funciona
- Verificar que `drillDown()` se llama antes de navegar
- Verificar que `navigationHistory` tiene elementos
- Verificar que no hay errores en `drillUp()`

## Próximas Mejoras

- [ ] Animaciones suaves al navegar entre niveles
- [ ] Zoom automático del mapa al cambiar de nivel
- [ ] Caché de celdas visitadas (performance)
- [ ] Visualización de datos en tiempo real sobre celdas
- [ ] Exportar ruta de navegación
- [ ] Breadcrumbs de navegación visual

## Referencias

- [Documentación Backend - Endpoints](../../drought-backend/documentation/ENDPOINTS_GUIDE.md)
- [Guía de Variables](../../drought-backend/documentation/VARIABLES_GUIDE.md)
- [Datos Históricos](../../drought-backend/documentation/HISTORICAL_DATA_GUIDE.md)
