'use client';

import { useState } from 'react';
import { RotateCcw, Download, MapPin, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import Button from './ui/Button';
import dynamic from 'next/dynamic';
import TimeSeriesChart from './TimeSeriesChart';
import { useGridNavigation } from '../hooks/useGridNavigation';
import { formatLevelLabel } from '../utils/gridLevels';

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

export default function MapArea({ 
  plotData, 
  onReset, 
  selectedStation, 
  selectedCell,
  onStationSelect,
  onCellSelect 
}) {
  const [mapKey, setMapKey] = useState(() => Date.now());

  // Usar el hook de navegación jerárquica
  const gridNav = useGridNavigation('LOW');

  const handleReset = () => {
    // Force complete remount with new timestamp
    setMapKey(Date.now());
    onStationSelect(null);
    onCellSelect(null);
    gridNav.resetToRoot();
    gridNav.clearSelection();
    onReset();
  };

  const handleStationSelect = (station) => {
    onStationSelect(station);
    onCellSelect(null); // Clear cell when station is selected
    gridNav.clearSelection();
    console.log('Estación seleccionada:', station);
  };

  const handleGridCellClick = (cell) => {
    // Single click: selecciona la celda para análisis
    onCellSelect(cell);
    onStationSelect(null); // Clear station when cell is selected
    console.log('Celda seleccionada para análisis:', cell);
  };

  const handleGridCellDoubleClick = (cell) => {
    // Double click: intenta hacer drill down
    const didDrill = gridNav.handleCellClick(cell, 'double');
    
    if (didDrill) {
      // Si navegó, limpiar selección
      onCellSelect(null);
      onStationSelect(null);
      console.log('Drill down a celda:', cell);
    } else {
      // Si no puede navegar (nivel máximo), selecciona
      onCellSelect(cell);
      onStationSelect(null);
      console.log('Nivel máximo alcanzado, celda seleccionada:', cell);
    }
  };

  const handleDrillUp = () => {
    const success = gridNav.drillUp();
    if (success) {
      onCellSelect(null);
      onStationSelect(null);
    }
  };
  
  const handleBackToRoot = () => {
    gridNav.resetToRoot();
    onCellSelect(null);
    onStationSelect(null);
  };

  return (
    <main className="flex-1 flex flex-col bg-gradient-to-br from-blue-50/30 via-blue-50/20 to-gray-50 dark:from-[#0f1419] dark:via-[#141920] dark:to-[#0f1419] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-2xl">
      {/* Map Controls */}
      <div className="bg-white/90 dark:bg-[#141920]/90 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 px-6 py-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="animate-slide-down flex-1">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md">
                  <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span>Mapa de Estaciones</span>
              </h2>
              
              {/* Grid Level Indicator */}
              <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg border border-blue-200 dark:border-blue-700">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Nivel:</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {formatLevelLabel(gridNav.currentLevel)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({gridNav.gridCells.length} celdas)
                </span>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-1">
                {/* Help tooltip */}
                <div className="group relative">
                  <button className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <p className="font-bold mb-2">📍 Controles del Mapa:</p>
                    <ul className="space-y-1">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 shrink-0">•</span>
                        <span><b>1 click</b> en celda → Selecciona para análisis</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400 shrink-0">•</span>
                        <span><b>2 clicks</b> en celda → Zoom a mayor resolución</span>
                      </li>
                    </ul>
                    <div className="absolute bottom-0 right-4 w-2 h-2 bg-gray-900 transform rotate-45 translate-y-1"></div>
                  </div>
                </div>
                
                {!gridNav.isAtRoot && (
                  <button
                    onClick={handleBackToRoot}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Volver al inicio"
                  >
                    <Home className="w-3.5 h-3.5" />
                  </button>
                )}
                
                {gridNav.canDrillUp && (
                  <button
                    onClick={handleDrillUp}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Volver al nivel anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Atrás
                  </button>
                )}
                
                {gridNav.canDrillDown && (
                  <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-200 dark:border-emerald-700">
                    <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="font-medium">Doble-click para zoom</span>
                  </div>
                )}
                
                {gridNav.isAtLeaf && (
                  <div className="text-xs text-purple-600 dark:text-purple-400 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-700 font-medium">
                    ✓ Máxima resolución
                  </div>
                )}
              </div>
            </div>
            
            {/* Selection Indicators */}
            <div className="flex items-center gap-3 ml-7 mt-1">
              {selectedStation && (
                <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2 animate-fade-in">
                  <span className="inline-flex relative">
                    <span className="inline-block w-2 h-2 bg-red-600 rounded-full"></span>
                    <span className="absolute inline-flex w-2 h-2 bg-red-600 rounded-full animate-ping opacity-75"></span>
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedStation.name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-medium">{selectedStation.area}</span>
                </p>
              )}
              
              {selectedCell && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-300 dark:border-green-700 rounded-lg shadow-sm animate-fade-in">
                  <span className="inline-flex relative">
                    <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                    <span className="absolute inline-flex w-2 h-2 bg-green-600 rounded-full animate-ping opacity-75"></span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-green-900 dark:text-green-100">Celda seleccionada:</span>
                    <code className="text-xs px-1.5 py-0.5 bg-white dark:bg-gray-800 text-green-700 dark:text-green-300 rounded font-mono border border-green-200 dark:border-green-700">
                      {selectedCell.cell_id}
                    </code>
                    <span className="text-xs px-1.5 py-0.5 bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 rounded font-bold">
                      {selectedCell.resolution}°
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800/50 px-2 py-0.5 rounded">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Lista para graficar</span>
                  </div>
                </div>
              )}
              
              {!selectedStation && !selectedCell && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 animate-pulse">
                  <span className="inline-block w-2 h-2 bg-amber-500 rounded-full"></span>
                  <span className="font-medium">Selecciona una estación o celda del mapa</span>
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 animate-slide-down">
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
      </div>

      {/* Map Container */}
      <div className="flex-1 relative bg-gradient-to-br from-blue-50/20 via-blue-50/10 to-blue-50/10 dark:from-gray-950 dark:via-[#0f1419] dark:to-gray-950 p-6">
        <div className="h-full bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-2xl shadow-2xl ring-4 ring-blue-500/20 dark:ring-blue-400/20 border border-gray-200 dark:border-gray-700">
          <LeafletMap 
            onStationSelect={handleStationSelect}
            selectedStation={selectedStation}
            selectedCell={selectedCell}
            onGridCellClick={handleGridCellClick}
            onCellDoubleClick={handleGridCellDoubleClick}
            onCellMouseOver={gridNav.handleCellMouseOver}
            onCellMouseOut={gridNav.handleCellMouseOut}
            gridCells={gridNav.gridCells}
            currentLevel={gridNav.currentLevel}
            hoveredCell={gridNav.hoveredCell}
            spatialDataCells={plotData?.type === '2D' ? plotData.gridCells : null}
            spatialResolution={plotData?.type === '2D' ? (plotData.resolution || 0.05) : 0.05}
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
            
            {/* Chart area: show time series when available or 2D spatial info */}
            {plotData.type === '2D' && plotData.gridCells ? (
              <div className="relative">
                {plotData.subtitle && (
                  <div className="mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      {plotData.subtitle}
                    </p>
                  </div>
                )}
                
                {/* Statistics summary */}
                {plotData.statistics && (
                  <div className="mb-4 grid grid-cols-5 gap-3">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Media</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.mean?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Mínimo</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.min?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Máximo</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.max?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Celdas</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.gridCells.length}</p>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Datos válidos</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.count || 'N/A'}</p>
                    </div>
                  </div>
                )}
                
                <div className="bg-white dark:bg-gray-900/50 rounded-xl p-6 shadow-inner">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Visualización Espacial 2D
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                    Las celdas en el mapa muestran los valores de <strong>{plotData.variable}</strong> para la fecha seleccionada.
                    Los colores representan {plotData.variable.includes('SPI') || plotData.variable.includes('SPEI') || plotData.variable.includes('PDSI') ? 'las categorías de sequía' : 'los valores de la variable'}.
                  </p>
                  
                  {/* Leyenda de colores para índices de sequía */}
                  {(plotData.variable === 'SPI' || plotData.variable === 'SPEI' || plotData.variable === 'PDSI') && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Leyenda:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{backgroundColor: '#000080'}}></div>
                          <span className="text-gray-700 dark:text-gray-300">Extremadamente Húmedo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{backgroundColor: '#0000FF'}}></div>
                          <span className="text-gray-700 dark:text-gray-300">Muy Húmedo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{backgroundColor: '#00FFFF'}}></div>
                          <span className="text-gray-700 dark:text-gray-300">Moderadamente Húmedo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{backgroundColor: '#00FF00'}}></div>
                          <span className="text-gray-700 dark:text-gray-300">Normal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{backgroundColor: '#FFFF00'}}></div>
                          <span className="text-gray-700 dark:text-gray-300">Moderadamente Seco</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{backgroundColor: '#FFA500'}}></div>
                          <span className="text-gray-700 dark:text-gray-300">Severamente Seco</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{backgroundColor: '#FF0000'}}></div>
                          <span className="text-gray-700 dark:text-gray-300">Extremadamente Seco</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (plotData.type === 'Serie de Tiempo' || plotData.type === '1D') && plotData.data ? (
              <div className="relative">
                {plotData.subtitle && (
                  <div className="mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      {plotData.subtitle}
                    </p>
                  </div>
                )}
                
                {/* Statistics summary */}
                {plotData.statistics && (
                  <div className="mb-4 grid grid-cols-4 gap-3">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Media</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.mean?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Mínimo</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.min?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Máximo</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.max?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Registros</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{plotData.statistics.count || 'N/A'}</p>
                    </div>
                  </div>
                )}
                
                <div className="bg-white dark:bg-gray-900/50 rounded-xl p-4 shadow-inner">
                  <TimeSeriesChart
                    data={plotData.data}
                    xKey="date"
                    dataKey="value"
                    height={320}
                    stroke="#2563eb"
                    fill="#2563eb22"
                    type="area"
                    yLabel={plotData.unit || "Valor"}
                    title={plotData.variable_name || plotData.title}
                  />
                </div>
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
