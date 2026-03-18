/**
 * API Service for DroughtMonitor Backend Integration
 * Handles all HTTP requests to the backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Base fetch wrapper with error handling
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // Extraer mensaje de error apropiado
      let errorMessage = 'Error en la petición';
      
      if (typeof data === 'object') {
        errorMessage = data.detail || data.message || JSON.stringify(data);
      } else if (typeof data === 'string') {
        errorMessage = data;
      }
      
      throw new ApiError(
        errorMessage,
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network or other errors
    throw new ApiError(
      'Error de conexión con el servidor',
      0,
      { originalError: error.message }
    );
  }
}

/**
 * Drought Monitoring API Service
 */
export const droughtApi = {
  /**
   * CATÁLOGOS - Variables e Índices
   */
  
  // Menu (1): Variables hidrometeorológicas
  getVariables: async () => {
    return fetchApi('/drought/variables');
  },

  // Menu (2) y Menu (3): Índices de sequía
  getDroughtIndices: async () => {
    return fetchApi('/drought/drought-indices');
  },

  // Obtener estaciones disponibles
  getStations: async () => {
    return fetchApi('/drought/stations');
  },

  // Obtener grid de celdas
  getGridMesh: async () => {
    return fetchApi('/drought/grid-mesh');
  },

  // Obtener configuración del dashboard
  getConfig: async () => {
    return fetchApi('/drought/config');
  },

  // Obtener archivos disponibles
  getFiles: async (datasetType) => {
    const params = datasetType ? `?dataset_type=${datasetType}` : '';
    return fetchApi(`/historical/files${params}`);
  },

  // Obtener archivo por resolución específica (solo archivos históricos)
  getFileByResolution: async (resolution) => {
    const files = await fetchApi('/historical/files?dataset_type=historical');
    // Buscar archivo que coincida con la resolución
    const file = files.find(f => {
      const metadata = f.metadata || {};
      const fileResolution = f.resolution || metadata.resolution || 0.1;
      return Math.abs(fileResolution - resolution) < 0.01;
    });
    return file || files[0]; // Fallback al primero si no encuentra
  },

  /**
   * ANÁLISIS HISTÓRICO
   */
  
  // Serie de tiempo (1D) - Gráfica en celda o estación
  getHistoricalTimeSeries: async (params) => {
    const {
      fileId,
      variableOrIndex,
      startDate,
      endDate,
      stationId = null,
      cellId = null,
      lat = null,
      lon = null,
    } = params;

    return fetchApi('/drought/historical/timeseries', {
      method: 'POST',
      body: JSON.stringify({
        file_id: fileId,
        variable_or_index: variableOrIndex,
        start_date: startDate,
        end_date: endDate,
        station_id: stationId,
        cell_id: cellId,
        lat: lat,
        lon: lon,
      }),
    });
  },

  // Datos espaciales (2D) - Todas las celdas para una fecha
  getHistoricalSpatial: async (params) => {
    const {
      fileId,
      variableOrIndex,
      targetDate,
    } = params;

    return fetchApi('/drought/historical/spatial', {
      method: 'POST',
      body: JSON.stringify({
        file_id: fileId,
        variable_or_index: variableOrIndex,
        target_date: targetDate,
      }),
    });
  },

  /**
   * PREDICCIÓN
   */
  
  // Predicción de sequía
  getPrediction: async (params) => {
    const {
      droughtIndex,
      macroclimaticIndex = null,
      horizonMonths,
      locationId = null,
      lat = null,
      lon = null,
    } = params;

    return fetchApi('/drought/prediction/forecast', {
      method: 'POST',
      body: JSON.stringify({
        drought_index: droughtIndex,
        macroclimatic_index: macroclimaticIndex,
        horizon_months: horizonMonths,
        location_id: locationId,
        lat: lat,
        lon: lon,
      }),
    });
  },

  /**
   * EXPORTACIÓN
   */
  
  // Exportar datos (CSV) o gráficas (PNG/JPEG)
  exportData: async (params) => {
    const {
      dataType,
      format,
      variableOrIndex,
      startDate = null,
      endDate = null,
      targetDate = null,
      locationId = null,
      includeMetadata = true,
    } = params;

    return fetchApi('/drought/export', {
      method: 'POST',
      body: JSON.stringify({
        data_type: dataType,
        format: format,
        variable_or_index: variableOrIndex,
        start_date: startDate,
        end_date: endDate,
        target_date: targetDate,
        location_id: locationId,
        include_metadata: includeMetadata,
      }),
    });
  },
};

/**
 * Historical Data API (endpoints más recientes)
 */
export const historicalApi = {
  // Catálogo de variables disponibles
  getCatalogVariables: async () => {
    return fetchApi('/historical/catalog/variables');
  },

  // Catálogo de índices de sequía
  getCatalogDroughtIndices: async () => {
    return fetchApi('/historical/catalog/drought-indices');
  },

  // Catálogo completo
  getCatalogAll: async () => {
    return fetchApi('/historical/catalog/all');
  },

  // Archivos disponibles
  getFiles: async (datasetType) => {
    const params = datasetType ? `?dataset_type=${datasetType}` : '';
    return fetchApi(`/historical/files${params}`);
  },

  // Información de un archivo específico
  getFileInfo: async (fileId) => {
    return fetchApi(`/historical/files/${fileId}/info`);
  },

  // Columnas de un archivo
  getFileColumns: async (fileId) => {
    return fetchApi(`/historical/files/${fileId}/columns`);
  },

  // Validar archivo
  validateFile: async (fileId) => {
    return fetchApi(`/historical/files/${fileId}/validate`);
  },

  // Serie de tiempo con caché optimizado
  getTimeSeries: async (params) => {
    const {
      fileId,
      variable,
      startDate,
      endDate,
      lat = null,
      lon = null,
      cellId = null,
      scale = null,
      source = null,
      frequency = null,
      limit = 70000,
    } = params;

    return fetchApi('/historical/timeseries', {
      method: 'POST',
      body: JSON.stringify({
        parquet_file_id: fileId,
        variable: variable,
        start_date: startDate,
        end_date: endDate,
        lat: lat,
        lon: lon,
        cell_id: cellId,
        scale: scale,
        source: source,
        frequency: frequency,
        limit: limit,
      }),
    });
  },

  // Datos espaciales con caché optimizado
  getSpatialData: async (params) => {
    const {
      fileId,
      variable,
      targetDate,
      startDate = null,
      endDate = null,
      useInterval = false,
      scale = null,
      source = null,
      frequency = null,
      minLat = null,
      maxLat = null,
      minLon = null,
      maxLon = null,
      limit = 100000,
    } = params;

    return fetchApi('/historical/spatial', {
      method: 'POST',
      body: JSON.stringify({
        parquet_file_id: fileId,
        variable: variable,
        target_date: targetDate,
        start_date: startDate,
        end_date: endDate,
        use_interval: useInterval,
        scale: scale,
        source: source,
        frequency: frequency,
        min_lat: minLat,
        max_lat: maxLat,
        min_lon: minLon,
        max_lon: maxLon,
        limit: limit,
      }),
    });
  },

  // Estadísticas del caché
  getCacheStats: async () => {
    return fetchApi('/historical/cache/stats');
  },

  // Limpiar caché
  clearCache: async (pattern = null) => {
    return fetchApi('/historical/cache/clear', {
      method: 'POST',
      body: JSON.stringify({ pattern }),
    });
  },

  // Health check
  checkHealth: async () => {
    return fetchApi('/historical/health');
  },

  // Obtener celdas únicas de un archivo (cell_ids)
  getCells: async (fileId) => {
    return fetchApi(`/historical/files/${fileId}/cells`);
  },

  // Obtener archivo por resolución (solo históricos)
  getFileByResolution: async (resolution) => {
    const files = await fetchApi('/historical/files?dataset_type=historical');
    const file = files.find(f => {
      const fileResolution = f.resolution || f.metadata?.resolution || 0.1;
      return Math.abs(fileResolution - resolution) < 0.01;
    });
    return file || files[0];
  },
};

/**
 * Hydrological Station Data API
 */
export const hydroApi = {
  // Obtener las 29 estaciones hidrológicas
  getStations: async () => {
    return fetchApi('/hydro/stations');
  },

  // Catálogo de índices hidrológicos
  getIndices: async () => {
    return fetchApi('/hydro/indices');
  },

  // Serie de tiempo 1D para una estación
  getTimeSeries: async (params) => {
    const { fileId, stationCode, indexName, scale, startDate, endDate, limit = 70000 } = params;
    return fetchApi('/hydro/timeseries', {
      method: 'POST',
      body: JSON.stringify({
        parquet_file_id: fileId,
        station_code: stationCode,
        index_name: indexName,
        scale: scale,
        start_date: startDate,
        end_date: endDate,
        limit: limit,
      }),
    });
  },

  // Datos espaciales 2D para todas las estaciones
  getSpatialData: async (params) => {
    const { fileId, indexName, scale, targetDate, startDate, endDate, useInterval = false } = params;
    return fetchApi('/hydro/spatial', {
      method: 'POST',
      body: JSON.stringify({
        parquet_file_id: fileId,
        index_name: indexName,
        scale: scale,
        target_date: targetDate,
        start_date: startDate,
        end_date: endDate,
        use_interval: useInterval,
      }),
    });
  },
};

/**
 * Helper functions
 */
export const apiHelpers = {
  /**
   * Format date for API (YYYY-MM-DD)
   */
  formatDate: (date) => {
    if (!date) return null;
    if (typeof date === 'string') return date;
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return null;
  },

  /**
   * Parse horizon string to months
   */
  parseHorizon: (horizon) => {
    const map = {
      '1m': 1,
      '3m': 3,
      '6m': 6,
    };
    return map[horizon] || 1;
  },

  /**
   * Build location filter for API
   */
  buildLocationFilter: (selectedStation, selectedCell) => {
    if (selectedStation) {
      return {
        stationId: selectedStation.id,
        type: 'station',
      };
    }
    if (selectedCell) {
      return {
        lat: selectedCell.center[0],
        lon: selectedCell.center[1],
        type: 'cell',
      };
    }
    return null;
  },
};

export { ApiError };
export default droughtApi;
