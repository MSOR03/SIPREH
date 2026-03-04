/**
 * Integration hooks for backend API
 * Custom React hooks for common API operations
 */

import { useState, useEffect, useCallback } from 'react';
import { droughtApi, historicalApi, apiHelpers } from '@/services/api';

/**
 * Hook to load catalog data (variables and indices)
 */
export function useCatalog() {
  const [variables, setVariables] = useState([]);
  const [droughtIndices, setDroughtIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoading(true);
        const [varsData, indicesData] = await Promise.all([
          historicalApi.getCatalogVariables(),
          historicalApi.getCatalogDroughtIndices(),
        ]);

        setVariables(varsData.variables || varsData.items || []);
        setDroughtIndices(indicesData.indices || indicesData.items || []);
        setError(null);
      } catch (err) {
        console.error('Error loading catalog:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, []);

  return { variables, droughtIndices, loading, error };
}

/**
 * Hook to load available files
 */
export function useFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await historicalApi.getFiles();
      setFiles(data);
      setError(null);
    } catch (err) {
      console.error('Error loading files:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { files, loading, error, refresh };
}

/**
 * Hook to load stations
 */
export function useStations() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadStations() {
      try {
        setLoading(true);
        const data = await droughtApi.getStations();
        setStations(data.stations || []);
        setError(null);
      } catch (err) {
        console.error('Error loading stations:', err);
        setError(err.message);
        // Use mock data as fallback
        setStations([]);
      } finally {
        setLoading(false);
      }
    }

    loadStations();
  }, []);

  return { stations, loading, error };
}

/**
 * Hook to fetch time series data
 */
export function useTimeSeries() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTimeSeries = useCallback(async (params) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await historicalApi.getTimeSeries({
        fileId: params.fileId,
        columns: [params.variableOrIndex],
        startDate: apiHelpers.formatDate(params.startDate),
        endDate: apiHelpers.formatDate(params.endDate),
        stationId: params.stationId,
        cellId: params.cellId,
        lat: params.lat,
        lon: params.lon,
      });

      setData(result);
      return result;
    } catch (err) {
      console.error('Error fetching time series:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchTimeSeries };
}

/**
 * Hook to fetch spatial data (2D)
 */
export function useSpatialData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSpatialData = useCallback(async (params) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await historicalApi.getSpatialData({
        fileId: params.fileId,
        column: params.variableOrIndex,
        targetDate: apiHelpers.formatDate(params.targetDate),
        bounds: params.bounds,
      });

      setData(result);
      return result;
    } catch (err) {
      console.error('Error fetching spatial data:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchSpatialData };
}

/**
 * Hook to fetch predictions
 */
export function usePrediction() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrediction = useCallback(async (params) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await droughtApi.getPrediction({
        droughtIndex: params.droughtIndex,
        macroclimaticIndex: params.macroclimaticIndex,
        horizonMonths: apiHelpers.parseHorizon(params.timeHorizon),
        locationId: params.locationId,
        lat: params.lat,
        lon: params.lon,
      });

      setData(result);
      return result;
    } catch (err) {
      console.error('Error fetching prediction:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchPrediction };
}

/**
 * Hook to export data
 */
export function useExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const exportData = useCallback(async (params) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await droughtApi.exportData({
        dataType: params.dataType, // 'timeseries' | 'spatial'
        format: params.format, // 'csv' | 'png' | 'jpeg'
        variableOrIndex: params.variableOrIndex,
        startDate: apiHelpers.formatDate(params.startDate),
        endDate: apiHelpers.formatDate(params.endDate),
        targetDate: apiHelpers.formatDate(params.targetDate),
        locationId: params.locationId,
      });

      // Download file
      if (result.download_url) {
        const link = document.createElement('a');
        link.href = result.download_url;
        link.download = result.filename || 'export';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      return result;
    } catch (err) {
      console.error('Error exporting data:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, exportData };
}
