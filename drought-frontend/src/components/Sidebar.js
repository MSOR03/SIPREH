'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Database, Droplets, Grid3x3, MapPin } from 'lucide-react';
import HistoricalSection from './sidebar/HistoricalSection';
import PredictionSection from './sidebar/PredictionSection';
import PredictionHistorySection from './sidebar/PredictionHistorySection';

const hydrometeorologicalVariables = [
  { value: 'precip', label: 'Precipitación' },
  { value: 'tmean', label: 'Temperatura Media' },
  { value: 'tmin', label: 'Temperatura Mínima' },
  { value: 'tmax', label: 'Temperatura Máxima' },
  { value: 'pet', label: 'Evapotranspiración Potencial (PET)' },
  { value: 'balance', label: 'Balance Hídrico' },
];

const hydrometIndices = [
  { value: 'SPI', label: 'SPI - Índice de Precipitación Estandarizado', category: 'meteorological' },
  { value: 'SPEI', label: 'SPEI - Índice de Precipitación-Evapotranspiración Estandarizado', category: 'meteorological' },
  { value: 'RAI', label: 'RAI - Índice de Anomalía de Lluvia', category: 'meteorological' },
  { value: 'EDDI', label: 'EDDI - Índice de Demanda de Evaporación por Sequía', category: 'meteorological' },
  { value: 'PDSI', label: 'PDSI - Índice de Severidad de Sequía de Palmer', category: 'hydrological' },
];

const hydrologicalVariables = [
  { value: 'caudal_medio', label: 'Caudal (Medio)' },
  { value: 'caudal_max', label: 'Caudal (Máximo)' },
  { value: 'caudal_min', label: 'Caudal (Mínimo)' },
  { value: 'nivel', label: 'Nivel' },
];

const hydrologicalIndices = [
  { value: 'SSI', label: 'SSI - Índice de Sequía de Caudales' },
  { value: 'SDI', label: 'SDI - Índice de Sequía Hidrológica' },
];

const timeHorizons = [
  { value: '1m', label: '1 mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
];

const RESOLUTION_SOURCE_BY_VALUE = { 0.25: 'ERA5', 0.1: 'IMERG', 0.05: 'CHIRPS' };
const SPATIAL_UNIT_LABELS = { grid: 'Grid', cuencas: 'Cuencas', embalses: 'Embalses', estaciones: 'Estaciones' };
const ALL_INDICES = [...hydrometIndices, ...hydrologicalIndices];

export default function Sidebar({
  analysisState,
  setAnalysisState,
  predictionState,
  setPredictionState,
  predictionHistoryState,
  setPredictionHistoryState,
  onAnalysisPlot,
  onPredictionPlot,
  onPredictionHistoryPlot,
  onAnalysisSave,
  onPredictionSave,
  onPredictionHistorySave,
  selectedStation,
  selectedCell,
}) {
  const [historicalOpen, setHistoricalOpen] = useState(true);
  const [predictionOpen, setPredictionOpen] = useState(true);
  const [predictionHistoryOpen, setPredictionHistoryOpen] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(true);

  const isHydromet = (analysisState.dataCategory || 'hydromet') === 'hydromet';
  const isHydrological = (analysisState.dataCategory || 'hydromet') === 'hydrological';
  const is2DMode = analysisState.visualizationType === '2D';
  const needsSelection = !is2DMode;
  const hasSelection = selectedStation || selectedCell;

  const selectionText = selectedStation
    ? selectedStation.name
    : selectedCell
      ? `Celda [${selectedCell.center[0].toFixed(2)}, ${selectedCell.center[1].toFixed(2)}]`
      : null;

  const currentVariables = useMemo(
    () => (isHydromet ? hydrometeorologicalVariables : hydrologicalVariables),
    [isHydromet]
  );

  const currentIndices = useMemo(
    () => (isHydromet ? hydrometIndices : hydrologicalIndices),
    [isHydromet]
  );

  const spatialUnitOptions = useMemo(() => {
    if (isHydrological) {
      return [
        { value: 'cuencas', label: 'Cuencas', icon: Droplets },
        { value: 'embalses', label: 'Embalses', icon: Database },
        { value: 'estaciones', label: 'Estaciones', icon: MapPin },
      ];
    }

    return [
      { value: 'grid', label: 'Celdas', icon: Grid3x3 },
      { value: 'cuencas', label: 'Cuencas', icon: Droplets },
      { value: 'embalses', label: 'Embalses', icon: Database },
    ];
  }, [isHydrological]);

  const handleCategoryChange = (newCat) => {
    const updates = { dataCategory: newCat, variable: '', droughtIndex: '' };

    if (newCat === 'hydrological') {
      updates.spatialUnit = 'estaciones';
      updates.dataSource = '';
    } else if (analysisState.spatialUnit === 'estaciones') {
      updates.spatialUnit = 'grid';
    }

    setAnalysisState((prev) => ({ ...prev, ...updates }));
    setShowCategoryPicker(false);
  };

  const resolutionLabel = useMemo(
    () => (isHydromet ? RESOLUTION_SOURCE_BY_VALUE[analysisState.spatialResolution] || null : null),
    [isHydromet, analysisState.spatialResolution]
  );

  const summaryParts = useMemo(() => {
    const variableLabel = analysisState.variable
      ? (currentVariables.find((v) => v.value === analysisState.variable)?.label || analysisState.variable)
      : null;

    return [
      isHydromet ? 'Hidrometeorológico' : 'Hidrológico',
      variableLabel,
      analysisState.droughtIndex || null,
      is2DMode && analysisState.spatialUnit ? SPATIAL_UNIT_LABELS[analysisState.spatialUnit] || null : null,
      is2DMode && resolutionLabel ? `${resolutionLabel} (${analysisState.spatialResolution}°)` : null,
      is2DMode && analysisState.useSpatialInterval
        ? (analysisState.startDate && analysisState.endDate ? `${analysisState.startDate} - ${analysisState.endDate}` : null)
        : (analysisState.startDate || null),
    ].filter(Boolean).join(' • ');
  }, [
    isHydromet,
    is2DMode,
    analysisState.variable,
    analysisState.droughtIndex,
    analysisState.spatialUnit,
    analysisState.spatialResolution,
    analysisState.useSpatialInterval,
    analysisState.startDate,
    analysisState.endDate,
    currentVariables,
    resolutionLabel,
  ]);

  const predictionSummary = useMemo(
    () => [
      predictionState.droughtIndex
        ? (ALL_INDICES.find((i) => i.value === predictionState.droughtIndex)?.label || predictionState.droughtIndex)
        : null,
      predictionState.timeHorizon
        ? (timeHorizons.find((h) => h.value === predictionState.timeHorizon)?.label || predictionState.timeHorizon)
        : null,
    ].filter(Boolean).join(' • ') || null,
    [predictionState.droughtIndex, predictionState.timeHorizon]
  );

  const predictionHistorySummary = useMemo(
    () => [
      predictionHistoryState.droughtIndex
        ? (ALL_INDICES.find((i) => i.value === predictionHistoryState.droughtIndex)?.label || predictionHistoryState.droughtIndex)
        : null,
      predictionHistoryState.timeHorizon
        ? (timeHorizons.find((h) => h.value === predictionHistoryState.timeHorizon)?.label || predictionHistoryState.timeHorizon)
        : null,
      predictionHistoryState.predictionDate || null,
    ].filter(Boolean).join(' • ') || null,
    [
      predictionHistoryState.droughtIndex,
      predictionHistoryState.timeHorizon,
      predictionHistoryState.predictionDate,
    ]
  );

  const analysisDisabled = useMemo(
    () => (needsSelection && !hasSelection)
      || (!analysisState.variable && !analysisState.droughtIndex)
      || !analysisState.startDate
      || ((needsSelection || (is2DMode && analysisState.useSpatialInterval)) && !analysisState.endDate),
    [
      needsSelection,
      hasSelection,
      analysisState.variable,
      analysisState.droughtIndex,
      analysisState.startDate,
      analysisState.endDate,
      is2DMode,
      analysisState.useSpatialInterval,
    ]
  );

  const showDataSource = is2DMode && isHydromet && (analysisState.spatialUnit || 'grid') === 'grid';
  const showSpatialUnit = is2DMode;

  return (
    <aside className="w-[480px] min-w-[420px] bg-gradient-to-b from-gray-50 to-gray-100/50 dark:from-[#141920] dark:to-[#0f1419] border border-gray-200 dark:border-gray-700 overflow-y-auto shadow-2xl rounded-xl">
      <div className="px-6 py-5 space-y-6">
        <div className={`p-3 rounded-xl border-2 transition-all duration-300 ${
          !needsSelection || hasSelection
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 dark:border-amber-600 animate-pulse'
        }`}>
          <div className="flex items-start gap-3">
            {!needsSelection || hasSelection ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                !needsSelection || hasSelection
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {is2DMode ? 'Modo Espacial (2D)' : hasSelection ? 'Ubicación Seleccionada' : 'Falta Selección'}
              </p>
              <p className={`text-xs mt-0.5 ${
                !needsSelection || hasSelection
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                {is2DMode
                  ? 'Visualizacion 2D: muestra todas las celdas del dominio'
                  : hasSelection
                    ? selectionText
                    : 'Selecciona una estación o celda del mapa para continuar'}
              </p>
            </div>
          </div>
        </div>

        <HistoricalSection
          historicalOpen={historicalOpen}
          setHistoricalOpen={setHistoricalOpen}
          summaryParts={summaryParts}
          showCategoryPicker={showCategoryPicker}
          setShowCategoryPicker={setShowCategoryPicker}
          handleCategoryChange={handleCategoryChange}
          isHydromet={isHydromet}
          isHydrological={isHydrological}
          currentVariables={currentVariables}
          currentIndices={currentIndices}
          analysisState={analysisState}
          setAnalysisState={setAnalysisState}
          showSpatialUnit={showSpatialUnit}
          spatialUnitOptions={spatialUnitOptions}
          showDataSource={showDataSource}
          analysisDisabled={analysisDisabled}
          onAnalysisPlot={onAnalysisPlot}
          onAnalysisSave={onAnalysisSave}
        />

        <PredictionSection
          predictionOpen={predictionOpen}
          setPredictionOpen={setPredictionOpen}
          predictionSummary={predictionSummary}
          predictionState={predictionState}
          setPredictionState={setPredictionState}
          allIndices={ALL_INDICES}
          timeHorizons={timeHorizons}
          hasSelection={hasSelection}
          onPredictionPlot={onPredictionPlot}
          onPredictionSave={onPredictionSave}
        />

        <PredictionHistorySection
          predictionHistoryOpen={predictionHistoryOpen}
          setPredictionHistoryOpen={setPredictionHistoryOpen}
          predictionHistorySummary={predictionHistorySummary}
          predictionHistoryState={predictionHistoryState}
          setPredictionHistoryState={setPredictionHistoryState}
          allIndices={ALL_INDICES}
          timeHorizons={timeHorizons}
          hasSelection={hasSelection}
          onPredictionHistoryPlot={onPredictionHistoryPlot}
          onPredictionHistorySave={onPredictionHistorySave}
        />

        <div className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="mb-1 font-semibold text-blue-900 dark:text-blue-300">Ver ejemplo detallado:</p>
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
