'use client';

import { BarChart3, TrendingUp, Download, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import Select from './ui/Select';
import Button from './ui/Button';
import DateRangePicker from './ui/DateRangePicker';

// Variables hidrometeorológicas disponibles en el backend
const hydrometeorologicalVariables = [
  { value: 'precip', label: 'Precipitación' },
  { value: 'tmean', label: 'Temperatura Media' },
  { value: 'tmin', label: 'Temperatura Mínima' },
  { value: 'tmax', label: 'Temperatura Máxima' },
  { value: 'pet', label: 'Evapotranspiración Potencial (PET)' },
  { value: 'balance', label: 'Balance Hídrico' },
];

// Índices de sequía disponibles en el backend
const droughtIndices = [
  { value: 'SPI', label: 'SPI - Índice de Precipitación Estandarizado', category: 'meteorological' },
  { value: 'SPEI', label: 'SPEI - Índice de Precipitación-Evapotranspiración Estandarizado', category: 'meteorological' },
  { value: 'RAI', label: 'RAI - Índice de Anomalía de Lluvia', category: 'meteorological' },
  { value: 'EDDI', label: 'EDDI - Índice de Demanda de Evaporación por Sequía', category: 'meteorological' },
  { value: 'PDSI', label: 'PDSI - Índice de Severidad de Sequía de Palmer', category: 'hydrological' },
];

const macroclimaticIndices = [
  { value: 'enso', label: 'ENSO - El Niño Southern Oscillation' },
  { value: 'pdo', label: 'PDO - Oscilación Decadal del Pacífico' },
  { value: 'nao', label: 'NAO - Oscilación del Atlántico Norte' },
];

const timeHorizons = [
  { value: '1m', label: '1 mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
];

export default function Sidebar({ 
  analysisState, 
  setAnalysisState, 
  predictionState, 
  setPredictionState,
  onAnalysisPlot,
  onPredictionPlot,
  onAnalysisSave,
  onPredictionSave,
  selectedStation,
  selectedCell
}) {
  const hasSelection = selectedStation || selectedCell;
  const selectionText = selectedStation 
    ? selectedStation.name 
    : selectedCell 
      ? `Celda [${selectedCell.center[0].toFixed(2)}, ${selectedCell.center[1].toFixed(2)}]`
      : null;
  
  return (
    <aside className="w-96 bg-gradient-to-b from-gray-50 to-gray-100/50 dark:from-[#141920] dark:to-[#0f1419] border border-gray-200 dark:border-gray-700 overflow-y-auto shadow-2xl rounded-xl">
      <div className="px-6 py-5 space-y-8">
        
        {/* Selection Indicator */}
        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
          hasSelection 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600' 
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 dark:border-amber-600 animate-pulse'
        }`}>
          <div className="flex items-start gap-3">
            {hasSelection ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                hasSelection 
                  ? 'text-green-800 dark:text-green-300' 
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {hasSelection ? 'Ubicación Seleccionada' : 'Falta Selección'}
              </p>
              <p className={`text-xs mt-1 ${
                hasSelection 
                  ? 'text-green-700 dark:text-green-400' 
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                {hasSelection 
                  ? selectionText
                  : 'Selecciona una estación o celda del mapa para continuar'
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* Historical Analysis Section */}
        <div className="animate-fade-in">
          <div className="relative flex items-center gap-3 mb-5 pb-4 border-b-2 border-blue-500 dark:border-blue-400">
            {/* Glow effect */}
            <div className="absolute -left-2 -right-2 -top-1 -bottom-1 bg-blue-500/10 dark:bg-blue-400/10 rounded-lg blur-sm"></div>
            
            <div className="relative p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="relative">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Análisis Histórico
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                Últimos 30 años
              </p>
            </div>
          </div>
          
          <div className="space-y-5 p-5 bg-gradient-to-br from-blue-50/50 via-blue-50/20 to-blue-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-blue-950/10 rounded-2xl border border-blue-200/50 dark:border-blue-900/30 shadow-lg">
            <Select
              label="Variables Hidrometeorológicas"
              options={hydrometeorologicalVariables}
              value={analysisState.variable}
              onChange={(value) => setAnalysisState({ ...analysisState, variable: value })}
              placeholder="Seleccionar variable..."
            />
            
            <Select
              label="Índices de Sequía"
              options={droughtIndices}
              value={analysisState.droughtIndex}
              onChange={(value) => setAnalysisState({ ...analysisState, droughtIndex: value })}
              placeholder="Seleccionar índice..."
            />
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Periodo de Tiempo
              </label>
              <DateRangePicker
                startDate={analysisState.startDate}
                endDate={analysisState.endDate}
                onStartDateChange={(date) => setAnalysisState({ ...analysisState, startDate: date })}
                onEndDateChange={(date) => setAnalysisState({ ...analysisState, endDate: date })}
              />
            </div>
            
            <div className="flex gap-3 pt-3">
              <Button
                onClick={onAnalysisPlot}
                variant="primary"
                className={`flex-1 shadow-md hover:shadow-lg transition-all ${
                  (!hasSelection || (!analysisState.variable && !analysisState.droughtIndex) || !analysisState.startDate || !analysisState.endDate) 
                    ? 'opacity-50 cursor-not-allowed' 
                    : ''
                }`}
                disabled={!hasSelection || (!analysisState.variable && !analysisState.droughtIndex) || !analysisState.startDate || !analysisState.endDate}
              >
                <BarChart3 className="w-4 h-4" />
                Graficar
              </Button>
              <Button
                onClick={onAnalysisSave}
                variant="secondary"
                className="flex-1"
              >
                <Download className="w-4 h-4" />
                Guardar
              </Button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 py-1 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 dark:from-[#141920] dark:via-[#0f1419] dark:to-[#141920] text-xs font-bold text-gray-600 dark:text-gray-400 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm">
              PREDICCIÓN
            </span>
          </div>
        </div>

        {/* Prediction Section */}
        <div className="animate-fade-in">
          <div className="relative flex items-center gap-3 mb-5 pb-4 border-b-2 border-green-500 dark:border-green-400">
            {/* Glow effect */}
            <div className="absolute -left-2 -right-2 -top-1 -bottom-1 bg-green-500/10 dark:bg-green-400/10 rounded-lg blur-sm"></div>
            
            <div className="relative p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div className="relative">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Predicción
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Modelos predictivos
              </p>
            </div>
          </div>
          
          <div className="space-y-5 p-5 bg-gradient-to-br from-green-50/50 via-green-50/20 to-green-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-green-950/10 rounded-2xl border border-green-200/50 dark:border-green-900/30 shadow-lg">
            <Select
              label="Índice de Sequía"
              options={droughtIndices}
              value={predictionState.droughtIndex}
              onChange={(value) => setPredictionState({ ...predictionState, droughtIndex: value })}
              placeholder="Seleccionar índice..."
            />
            
            <Select
              label="Fenómenos Macroclimáticos"
              options={macroclimaticIndices}
              value={predictionState.macroclimaticIndex}
              onChange={(value) => setPredictionState({ ...predictionState, macroclimaticIndex: value })}
              placeholder="Seleccionar correlación..."
            />
            
            <Select
              label="Horizonte de Predicción"
              options={timeHorizons}
              value={predictionState.timeHorizon}
              onChange={(value) => setPredictionState({ ...predictionState, timeHorizon: value })}
              placeholder="Seleccionar horizonte..."
            />
            
            <div className="flex gap-3 pt-3">
              <Button
                onClick={onPredictionPlot}
                variant="success"
                className={`flex-1 shadow-md hover:shadow-lg transition-all ${
                  !hasSelection ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={!hasSelection}
              >
                <TrendingUp className="w-4 h-4" />
                Graficar
              </Button>
              <Button
                onClick={onPredictionSave}
                variant="secondary"
                className="flex-1"
              >
                <Download className="w-4 h-4" />
                Guardar
              </Button>
            </div>
          </div>
        </div>

        {/* Reference Link */}
        <div className="text-xs text-gray-600 dark:text-gray-400 p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="mb-2 font-semibold text-blue-900 dark:text-blue-300">Ver ejemplo detallado:</p>
              <a
                href="https://droughtmonitor.unl.edu/CurrentMap.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all font-medium"
              >
                droughtmonitor.unl.edu
              </a>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
