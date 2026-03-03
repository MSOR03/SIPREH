'use client';

import { useState } from 'react';
import { RotateCcw, Download, MapPin } from 'lucide-react';
import Button from './ui/Button';
import dynamic from 'next/dynamic';
import TimeSeriesChart from './TimeSeriesChart';

// Dynamic import for Leaflet to avoid SSR issues
const LeafletMap = dynamic(
  () => import('./LeafletMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-600 dark:text-gray-400 font-medium">Cargando mapa...</div>
        </div>
      </div>
    )
  }
);

export default function MapArea({ plotData, onReset }) {
  const [mapKey, setMapKey] = useState(() => Date.now());
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  const handleReset = () => {
    // Force complete remount with new timestamp
    setMapKey(Date.now());
    setSelectedStation(null);
    onReset();
  };

  const handleStationSelect = (station) => {
    setSelectedStation(station);
    console.log('Estación seleccionada:', station);
    // TODO: Trigger data loading for this station
  };

  const handleGridCellClick = (cell) => {
    setSelectedCell(cell);
    console.log('Celda seleccionada del grid:', cell);
    // TODO: fetch or display data for this grid cell
  };

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-blue-50/30 via-blue-50/20 to-gray-50 dark:from-[#0f1419] dark:via-[#141920] dark:to-[#0f1419] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-2xl">
      {/* Map Controls */}
      <div className="bg-white/90 dark:bg-[#141920]/90 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="animate-slide-down">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span>Mapa de Estaciones</span>
            </h2>
            {selectedStation && (
              <p className="text-xs text-gray-600 dark:text-gray-400 ml-7 flex items-center gap-2 animate-fade-in">
                <span className="inline-flex relative">
                  <span className="inline-block w-2 h-2 bg-red-600 rounded-full"></span>
                  <span className="absolute inline-flex w-2 h-2 bg-red-600 rounded-full animate-ping opacity-75"></span>
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedStation.name}</span>
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">{selectedStation.area}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
            title="Reiniciar vista del mapa"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative bg-gradient-to-br from-blue-50/20 via-blue-50/10 to-blue-50/10 dark:from-gray-950 dark:via-[#0f1419] dark:to-gray-950 p-6">
        <div className="h-full bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl shadow-2xl ring-4 ring-blue-500/20 dark:ring-blue-400/20 border border-gray-200 dark:border-gray-700">
          <LeafletMap 
            onStationSelect={handleStationSelect}
            selectedStation={selectedStation}
            onGridCellClick={handleGridCellClick}
          />
        </div>
      </div>

      {/* Plot/Chart Area (will show when data is available) */}
      {plotData && (
        <div className="bg-gradient-to-r from-white to-blue-50/50 dark:from-[#141920] dark:to-blue-950/20 border-t border-gray-200 dark:border-gray-700 shadow-2xl backdrop-blur-sm">
          <div className="p-8 space-y-6 animate-slide-down">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {plotData.title}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Análisis de datos</p>
                </div>
              </div>
              <Button variant="secondary" className="shadow-lg hover:shadow-xl">
                <Download className="w-4 h-4" />
                Exportar Gráfico
              </Button>
            </div>
            
            {/* Chart area: show time series when available or placeholder */}
            {plotData.type === 'Serie de Tiempo' && plotData.data ? (
              <div className="relative h-80">
                <TimeSeriesChart
                  data={plotData.data}
                  xKey="date"
                  dataKey="value"
                  height={280}
                />
              </div>
            ) : (
              <div className="relative h-80 bg-gradient-to-br from-blue-50/30 via-blue-50/20 to-blue-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-blue-950/20 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 shadow-inner overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>
                
                <div className="text-center text-gray-500 dark:text-gray-400 relative z-10">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl"></div>
                    <BarChart3 className="relative w-20 h-20 mx-auto mb-4 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                  </div>
                  <p className="font-bold text-xl text-gray-900 dark:text-gray-100">Gráfico: {plotData.type}</p>
                  <p className="text-sm mt-3 max-w-md mx-auto text-gray-600 dark:text-gray-400">Los datos se visualizarán aquí una vez conectado al backend</p>
                  {selectedStation && (
                    <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium shadow-md">
                      <span className="inline-block w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></span>
                      Mostrando datos para: {selectedStation.name}
                    </div>
                  )}
                {selectedCell && (
                  <div className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium shadow-md">
                    <span className="inline-block w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
                    Celda: {selectedCell.center[0].toFixed(3)}, {selectedCell.center[1].toFixed(3)}
                  </div>
                )}
                  {selectedCell && (
                    <div className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium shadow-md">
                      <span className="inline-block w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
                      Celda del grid: {selectedCell.center[0].toFixed(3)}, {selectedCell.center[1].toFixed(3)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function BarChart3({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}
