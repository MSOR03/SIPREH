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
 * Hook para manejar navegación jerárquica de grid
 * Gestiona el estado de niveles, drill-down, drill-up y selección de celdas
 * 
 * NOTA: Las celdas se cargan desde el backend (no se generan localmente)
 */
export function useGridNavigation(initialLevel = 'LOW') {
  const [currentLevel, setCurrentLevel] = useState(initialLevel);
  const [gridCells, setGridCells] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  
  // Cachear todas las celdas de todos los niveles al montar
  const [allCells, setAllCells] = useState({
    LOW: [],
    MEDIUM: [],
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
          HIGH: [],
        };
        
        // Para cada nivel, encontrar el archivo y obtener sus celdas
        for (const level of ['LOW', 'MEDIUM', 'HIGH']) {
          const resolution = GRID_LEVELS[level].resolution;
          
          // Buscar archivo con esta resolución
          const file = files.find(f => {
            const fileResolution = f.resolution || f.metadata?.resolution || 0.1;
            return Math.abs(fileResolution - resolution) < 0.01;
          });
          
          if (file) {
            // Obtener celdas del archivo
            const cellsResponse = await historicalApi.getCells(file.file_id);
            
            // Parsear cell_ids a objetos de celda
            if (cellsResponse.cells && Array.isArray(cellsResponse.cells)) {
              cellsData[level] = parseCellIds(cellsResponse.cells, resolution);
            }
          }
        }
        
        setAllCells(cellsData);
        
        // Inicializar con las celdas del nivel inicial
        setGridCells(cellsData[initialLevel]);
        
      } catch (err) {
        console.error('Error loading cells from backend:', err);
        setError(err.message);
        
        // Fallback: usar celdas estáticas reales
        console.warn('Usando celdas estáticas como fallback (extraídas de archivos parquet reales)');
        
        const { getAllStaticCells } = await import('../utils/staticCells');
        const fallbackCells = getAllStaticCells();
        
        setAllCells(fallbackCells);
        setGridCells(fallbackCells[initialLevel]);
        
      } finally {
        setIsLoading(false);
      }
    }
    
    loadAllCells();
  }, [initialLevel]);
  
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
    const allNextLevelCells = allCells[nextLevelKey];
    
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
  }, [currentLevel, gridCells, selectedCell, allCells]);
  
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
   * Resetea a la vista inicial
   */
  const resetToRoot = useCallback(() => {
    setCurrentLevel('LOW');
    setGridCells(allCells.LOW);
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
