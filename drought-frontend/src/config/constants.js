// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// API Endpoints
export const API_ENDPOINTS = {
  // Historical Analysis
  getHistoricalData: '/api/historical/data',
  getHydrometeorologicalVariable: '/api/historical/variable',
  getDroughtIndex: '/api/historical/drought-index',
  
  // Predictions
  getPrediction: '/api/prediction/drought-index',
  getMacroclimaticCorrelation: '/api/prediction/macroclimatic',
  
  // Data Export
  exportCSV: '/api/export/csv',
  exportChart: '/api/export/chart',
  
  // Stations and Grid
  getStations: '/api/stations',
  getGridCells: '/api/grid-cells',
};

// Map Configuration
export const MAP_CONFIG = {
  center: [4.7110, -74.0721], // Bogotá center
  zoom: 10,
  bounds: [
    [4.4, -74.3],
    [5.0, -73.9]
  ],
};


// Date format
export const DATE_FORMAT = 'yyyy-MM-dd';
