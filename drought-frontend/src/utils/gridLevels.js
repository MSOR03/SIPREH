/**
 * Grid Level Manager - Maneja navegación jerárquica de celdas
 * Niveles: 0.25° (low) → 0.1° (medium) → 0.05° (high)
 */

// Configuración de niveles de resolución
export const GRID_LEVELS = {
  LOW: {
    name: 'Baja Resolución',
    resolution: 0.25,
    label: '0.25°',
    color: '#3b82f6',
    zoomLevel: 10,
    filePattern: /era5/i,
    nextLevel: 'MEDIUM',
    description: 'Vista general - ~28km por celda'
  },
  MEDIUM: {
    name: 'Media Resolución',
    resolution: 0.1,
    label: '0.1°',
    color: '#10b981',
    zoomLevel: 12,
    filePattern: /imerg/i,
    nextLevel: 'HIGH',
    prevLevel: 'LOW',
    description: 'Vista intermedia - ~11km por celda'
  },
  HIGH: {
    name: 'Alta Resolución',
    resolution: 0.05,
    label: '0.05°',
    color: '#8b5cf6',
    zoomLevel: 14,
    filePattern: /chirps/i,
    prevLevel: 'MEDIUM',
    description: 'Vista detallada - ~5.5km por celda'
  }
};

/**
 * Convierte un cell_id del backend (formato "LON_LAT") a objeto de celda
 * @param {string} cellId - Formato: "-74.125000_5.125000" (LON_LAT)
 * @param {number} resolution - Tamaño de la celda en grados
 */
export function parseCellId(cellId, resolution) {
  const [lonStr, latStr] = cellId.split('_');
  const lon = parseFloat(lonStr);
  const lat = parseFloat(latStr);
  
  // El cell_id representa el CENTRO de la celda
  const halfRes = resolution / 2;
  
  return {
    id: cellId,
    cell_id: cellId,
    bounds: [
      [lat - halfRes, lon - halfRes],
      [lat + halfRes, lon + halfRes]
    ],
    center: [lat, lon],
    resolution: resolution,
    lat: lat,
    lon: lon,
  };
}

/**
 * Genera celdas de grid según la resolución especificada (LEGACY - mantener para compatibility)
 */
export function generateGridCells(bounds, resolution) {
  const { latStart, latEnd, lonStart, lonEnd } = bounds;
  const cells = [];
  
  for (let lat = latStart; lat < latEnd; lat += resolution) {
    for (let lon = lonStart; lon < lonEnd; lon += resolution) {
      const centerLat = lat + resolution / 2;
      const centerLon = lon + resolution / 2;
      const cellId = `${centerLon.toFixed(6)}_${centerLat.toFixed(6)}`;
      cells.push({
        id: cellId,
        cell_id: cellId,
        bounds: [
          [lat, lon],
          [lat + resolution, lon + resolution]
        ],
        center: [centerLat, centerLon],
        resolution: resolution,
        lat: centerLat,
        lon: centerLon,
      });
    }
  }
  
  return cells;
}

/**
 * Genera celdas hijas para navegación drill-down
 * Filtra celdas del nivel hijo que están geográficamente contenidas en la celda padre
 * @param {Object} parentCell - Celda padre
 * @param {Array} allChildCells - Todas las celdas del nivel hijo (desde backend)
 */
export function generateChildCells(parentCell, allChildCells) {
  const [latMin, lonMin] = parentCell.bounds[0];
  const [latMax, lonMax] = parentCell.bounds[1];
  
  // Filtrar solo las celdas hijas que están dentro de los bounds del padre
  return allChildCells.filter(childCell => {
    const childLat = childCell.center[0];
    const childLon = childCell.center[1];
    
    // Verificar si el centro de la celda hija está dentro de los bounds del padre
    return childLat >= latMin && childLat <= latMax &&
           childLon >= lonMin && childLon <= lonMax;
  }).map(cell => ({
    ...cell,
    parentCell: parentCell.id,
  }));
}

/**
 * Detecta el nivel actual basado en la resolución
 */
export function detectGridLevel(resolution) {
  const tolerance = 0.01;
  
  if (Math.abs(resolution - GRID_LEVELS.LOW.resolution) < tolerance) {
    return 'LOW';
  } else if (Math.abs(resolution - GRID_LEVELS.MEDIUM.resolution) < tolerance) {
    return 'MEDIUM';
  } else if (Math.abs(resolution - GRID_LEVELS.HIGH.resolution) < tolerance) {
    return 'HIGH';
  }
  
  return 'MEDIUM'; // Default
}

/**
 * Verifica si un nivel tiene siguiente nivel (drill-down disponible)
 */
export function hasNextLevel(currentLevel) {
  const level = GRID_LEVELS[currentLevel];
  return level && level.nextLevel !== undefined;
}

/**
 * Verifica si un nivel tiene nivel anterior (drill-up disponible)
 */
export function hasPrevLevel(currentLevel) {
  const level = GRID_LEVELS[currentLevel];
  return level && level.prevLevel !== undefined;
}

/**
 * Obtiene el siguiente nivel
 */
export function getNextLevel(currentLevel) {
  const level = GRID_LEVELS[currentLevel];
  return level?.nextLevel || null;
}

/**
 * Obtiene el nivel anterior
 */
export function getPrevLevel(currentLevel) {
  const level = GRID_LEVELS[currentLevel];
  return level?.prevLevel || null;
}

/**
 * Verifica si una celda contiene un punto
 */
export function cellContainsPoint(cell, lat, lon) {
  const [latMin, lonMin] = cell.bounds[0];
  const [latMax, lonMax] = cell.bounds[1];
  
  return lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;
}

/**
 * Encuentra la celda padre que contiene una celda hija
 */
export function findParentCell(childCell, parentCells) {
  const childCenter = childCell.center;
  return parentCells.find(parent => 
    cellContainsPoint(parent, childCenter[0], childCenter[1])
  );
}

/**
 * Calcula bounds para una región
 */
export function calculateBounds(lat, lon, padding = 0.5) {
  return {
    latStart: lat - padding,
    latEnd: lat + padding,
    lonStart: lon - padding,
    lonEnd: lon + padding,
  };
}

/**
 * Obtiene configuración de estilo para celda según nivel y estado
 */
export function getCellStyle(level, isSelected = false, isHovered = false) {
  const levelConfig = GRID_LEVELS[level];
  const baseColor = levelConfig?.color || '#3b82f6';
  
  if (isSelected) {
    return {
      color: '#10b981',
      weight: 3,
      fillOpacity: 0.18, // antes 0.35
      fillColor: '#10b981',
    };
  }

  if (isHovered) {
    return {
      color: baseColor,
      weight: 2,
      fillOpacity: 0.13, // antes 0.25
      fillColor: baseColor,
    };
  }

  return {
    color: baseColor,
    weight: 1,
    fillOpacity: 0.04, // antes 0.08
    fillColor: baseColor,
  };
}

/**
 * Formato de visualización del nivel
 */
export function formatLevelLabel(level) {
  const config = GRID_LEVELS[level];
  return config ? `${config.name} (${config.label})` : level;
}

/**
 * Determina la acción al hacer click en una celda
 * - Single-click: seleccionar para graficar
 * - Double-click: drill-down si hay siguiente nivel, sino seleccionar
 */
export function determineClickAction(level, clickType = 'single') {
  // Para doble-click: intentar drill down si hay siguiente nivel
  if (clickType === 'double' && hasNextLevel(level)) {
    return 'DRILL_DOWN'; // Navegar al siguiente nivel
  }
  
  // Para cualquier otro caso: seleccionar para graficar
  return 'SELECT';
}

/**
 * Bogotá bounds por defecto
 */
export const BOGOTA_BOUNDS = {
  latStart: 4.45,
  latEnd: 4.85,
  lonStart: -74.25,
  lonEnd: -73.95,
};

/**
 * Genera las celdas iniciales de Bogotá para un nivel específico (LEGACY)
 */
export function generateBogotaGridCells(level = 'LOW') {
  const config = GRID_LEVELS[level];
  return generateGridCells(BOGOTA_BOUNDS, config.resolution);
}

/**
 * Convierte un array de cell_ids del backend a objetos de celda
 * @param {Array<string>} cellIds - Array de cell_ids formato "LON_LAT"
 * @param {number} resolution - Resolución en grados
 */
export function parseCellIds(cellIds, resolution) {
  return cellIds.map(cellId => parseCellId(cellId, resolution));
}

/**
 * Filtra celdas por bounds geográficos
 */
export function filterCellsByBounds(cells, bounds) {
  const { latStart, latEnd, lonStart, lonEnd } = bounds;
  
  return cells.filter(cell => {
    const lat = cell.center[0];
    const lon = cell.center[1];
    return lat >= latStart && lat <= latEnd && lon >= lonStart && lon <= lonEnd;
  });
}
