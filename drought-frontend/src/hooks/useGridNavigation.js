import { useState, useCallback, useEffect } from 'react';
import {
  GRID_LEVELS,
  generateChildCells,
  getNextLevel,
  getPrevLevel,
  hasNextLevel,
  hasPrevLevel,
  determineClickAction,
  parseCellIds,
} from '../utils/gridLevels';
import { historicalApi } from '../services/api';

/**
 * Infiere la resolución de un archivo desde su campo resolution o desde el nombre del archivo.
 * Los archivos registrados vía admin_cloud.py siempre tienen resolution set,
 * pero como fallback se usa el filename por si acaso.
 */
function getEffectiveResolution(f) {
  // 1. Use explicit data_source from backend metadata (most reliable)
  const dsResMap = { 'ERA5': 0.25, 'IMERG': 0.1, 'ERA5_LAND': 0.1, 'CHIRPS': 0.05 };
  if (f.data_source && dsResMap[f.data_source] != null) return dsResMap[f.data_source];
  // 2. Use resolution_level from backend metadata
  const lvlResMap = { 'LOW': 0.25, 'MEDIUM': 0.1, 'MEDIUM_ERA5LAND': 0.1, 'HIGH': 0.05 };
  if (f.resolution_level && lvlResMap[f.resolution_level] != null) return lvlResMap[f.resolution_level];
  // 3. Filename-based fallback — check era5_land before generic era5
  const name = (f.filename || '').toLowerCase();
  if (name.includes('era5_land') || name.includes('era5land')) return 0.1;
  if (name.includes('imerg')) return 0.1;
  if (name.includes('chirps')) return 0.05;
  if (name.includes('era5')) return 0.25;
  return null;
}

/**
 * Hook para manejar navegación jerárquica de grid
 * Gestiona el estado de niveles, drill-down, drill-up y selección de celdas
 * 
 * NOTA: Las celdas se cargan desde el backend (no se generan localmente)
 */
export function useGridNavigation(initialLevel = 'LOW', mediumDataSource = null) {
  const [currentLevel, setCurrentLevel] = useState(initialLevel);
  const [gridCells, setGridCells] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  
  // Cachear todas las celdas de todos los niveles al montar
  // allCells.MEDIUM_IMERG y allCells.MEDIUM_ERA5LAND se cargan separadamente
  const [allCells, setAllCells] = useState({
    LOW: [],
    MEDIUM: [],
    MEDIUM_IMERG: [],
    MEDIUM_ERA5LAND: [],
    HIGH: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Cargar todas las celdas al inicio
  useEffect(() => {
    async function loadAllCells() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Cargar archivos y obtener celdas de cada nivel (solo historicos)
        const files = await historicalApi.getFiles('historical');
        
        const cellsData = {
          LOW: [],
          MEDIUM: [],
          MEDIUM_IMERG: [],
          MEDIUM_ERA5LAND: [],
          HIGH: [],
        };
        
        // Para cada nivel, encontrar el archivo y obtener sus celdas
        for (const level of ['LOW', 'MEDIUM', 'HIGH']) {
          const resolution = GRID_LEVELS[level].resolution;
          
          if (level === 'MEDIUM') {
            // At MEDIUM (0.1°) there can be ERA5_LAND and IMERG — load both
            const medFiles = files.filter(f => {
              const hasKnownSource = f.data_source ||
                (f.resolution_level && f.resolution_level !== 'UNKNOWN');
              if (!hasKnownSource) return false;
              const fr = getEffectiveResolution(f);
              return fr !== null && Math.abs(fr - resolution) < 0.01;
            });
            for (const mf of medFiles) {
              const resp = await historicalApi.getCells(mf.file_id);
              if (resp.cells && Array.isArray(resp.cells)) {
                const parsed = parseCellIds(resp.cells, resolution);
                if (mf.data_source === 'ERA5_LAND') {
                  cellsData.MEDIUM_ERA5LAND = parsed;
                } else {
                  cellsData.MEDIUM_IMERG = parsed;
                }
              }
            }
            // Active MEDIUM defaults to IMERG, then ERA5_LAND.
            // The separate mediumDataSource useEffect will switch it once allCells is set.
            cellsData.MEDIUM = cellsData.MEDIUM_IMERG.length
              ? cellsData.MEDIUM_IMERG
              : cellsData.MEDIUM_ERA5LAND;
          } else {
            const file = files.find(f => {
              const hasKnownSource = f.data_source ||
                (f.resolution_level && f.resolution_level !== 'UNKNOWN');
              if (!hasKnownSource) return false;
              const fileResolution = getEffectiveResolution(f);
              if (fileResolution === null) return false;
              return Math.abs(fileResolution - resolution) < 0.01;
            });
            
            if (file) {
              const cellsResponse = await historicalApi.getCells(file.file_id);
              if (cellsResponse.cells && Array.isArray(cellsResponse.cells)) {
                cellsData[level] = parseCellIds(cellsResponse.cells, resolution);
              }
            }
          }
        }
        
        setAllCells(cellsData);
        
        // Inicializar en el nivel más bajo con datos disponibles (no necesariamente LOW)
        const startLevel = ['LOW', 'MEDIUM', 'HIGH'].find(l => cellsData[l].length > 0) || initialLevel;
        setCurrentLevel(startLevel);
        setGridCells(cellsData[startLevel]);
        
      } catch (err) {
        console.error('Error loading cells from backend:', err);
        setError(err.message);
        
        // Fallback: usar celdas estáticas reales
        console.warn('Usando celdas estáticas como fallback (extraídas de archivos parquet reales)');
        
        const { getStaticCells, getAllStaticCells } = await import('../utils/staticCells');
        const fallbackCells = getAllStaticCells();
        
        setAllCells({
          ...fallbackCells,
          MEDIUM_IMERG: fallbackCells.MEDIUM,
          MEDIUM_ERA5LAND: getStaticCells('MEDIUM', 'ERA5_LAND'),
        });
        setGridCells(fallbackCells[initialLevel]);
        
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAllCells();
  }, [initialLevel]);

  // When mediumDataSource changes (or allCells first loads), update active MEDIUM cells from cache
  useEffect(() => {
    if (currentLevel !== 'MEDIUM') return;
    const preferred = mediumDataSource === 'ERA5_LAND' ? allCells.MEDIUM_ERA5LAND : allCells.MEDIUM_IMERG;
    const fallback = allCells.MEDIUM_ERA5LAND?.length ? allCells.MEDIUM_ERA5LAND : allCells.MEDIUM_IMERG;
    const next = (preferred?.length ? preferred : fallback) || [];
    setGridCells(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediumDataSource, allCells]);
  
  /**
   * Navega al siguiente nivel (drill-down)
   */
  const drillDown = useCallback((parentCell) => {
    if (!hasNextLevel(currentLevel)) {
      console.warn('No hay siguiente nivel disponible');
      return false;
    }
    
    const nextLevelKey = getNextLevel(currentLevel);
    
    // Guarda el estado actual en el historial
    setNavigationHistory(prev => [
      ...prev,
      {
        level: currentLevel,
        cells: gridCells,
        selectedCell: selectedCell,
        parentCell: parentCell,
      }
    ]);
    
    // Obtener todas las celdas del siguiente nivel desde el caché
    // Para MEDIUM, usar la fuente correcta según mediumDataSource
    let allNextLevelCells = allCells[nextLevelKey];
    if (nextLevelKey === 'MEDIUM') {
      const preferred = mediumDataSource === 'ERA5_LAND' ? allCells.MEDIUM_ERA5LAND : allCells.MEDIUM_IMERG;
      allNextLevelCells = (preferred?.length ? preferred : allCells.MEDIUM) || [];
    }
    
    // Filtrar solo las celdas que están dentro de la celda padre
    const childCells = generateChildCells(parentCell, allNextLevelCells);
    
    if (childCells.length === 0) {
      console.warn('No se encontraron celdas hijas para esta celda padre');
      // Revertir el historial
      setNavigationHistory(prev => prev.slice(0, -1));
      return false;
    }
    
    // Actualiza estado
    setCurrentLevel(nextLevelKey);
    setGridCells(childCells);
    setSelectedCell(null); // Limpia selección al navegar
    
    return true;
  }, [currentLevel, gridCells, selectedCell, allCells, mediumDataSource]);
  
  /**
   * Regresa al nivel anterior (drill-up)
   */
  const drillUp = useCallback(() => {
    if (!hasPrevLevel(currentLevel) || navigationHistory.length === 0) {
      console.warn('No hay nivel anterior disponible');
      return false;
    }
    
    // Recupera el estado anterior del historial
    const previousState = navigationHistory[navigationHistory.length - 1];
    
    setCurrentLevel(previousState.level);
    setGridCells(previousState.cells);
    setSelectedCell(previousState.selectedCell);
    setNavigationHistory(prev => prev.slice(0, -1));
    
    return true;
  }, [currentLevel, navigationHistory]);
  
  /**
   * Resetea a la vista inicial (nivel más bajo disponible, no necesariamente LOW)
   */
  const resetToRoot = useCallback(() => {
    const rootLevel = ['LOW', 'MEDIUM', 'HIGH'].find(l => allCells[l]?.length > 0) || 'LOW';
    setCurrentLevel(rootLevel);
    setGridCells(allCells[rootLevel] || []);
    setSelectedCell(null);
    setNavigationHistory([]);
  }, [allCells]);
  
  /**
   * Maneja el click en una celda
   */
  const handleCellClick = useCallback((cell, clickType = 'single') => {
    const action = determineClickAction(currentLevel, clickType);
    
    if (action === 'DRILL_DOWN') {
      return drillDown(cell);
    } else if (action === 'SELECT') {
      // Seleccionar celda para graficar
      setSelectedCell(cell);
      return true;
    }
    
    return false;
  }, [currentLevel, drillDown]);
  
  /**
   * Maneja doble click en celda (siempre selecciona)
   */
  const handleCellDoubleClick = useCallback((cell) => {
    setSelectedCell(cell);
    return true;
  }, []);
  
  /**
   * Limpia la selección
   */
  const clearSelection = useCallback(() => {
    setSelectedCell(null);
  }, []);
  
  /**
   * Maneja hover sobre celda
   */
  const handleCellMouseOver = useCallback((cell) => {
    setHoveredCell(cell);
  }, []);
  
  /**
   * Maneja salida del mouse de celda
   */
  const handleCellMouseOut = useCallback(() => {
    setHoveredCell(null);
  }, []);
  
  return {
    // Estado
    currentLevel,
    gridCells,
    selectedCell,
    hoveredCell,
    navigationHistory,
    currentLevelConfig: GRID_LEVELS[currentLevel],
    isLoading,
    error,
    allCells, // Exponer todas las celdas cacheadas
    
    // Información
    canDrillDown: hasNextLevel(currentLevel),
    canDrillUp: hasPrevLevel(currentLevel) && navigationHistory.length > 0,
    isAtRoot: currentLevel === 'LOW' && navigationHistory.length === 0,
    isAtLeaf: currentLevel === 'HIGH',
    
    // Acciones
    drillDown,
    drillUp,
    resetToRoot,
    handleCellClick,
    handleCellDoubleClick,
    clearSelection,
    handleCellMouseOver,
    handleCellMouseOut,
    
    // Setters directos (para casos especiales)
    setSelectedCell,
    setCurrentLevel,
  };
}
