'use client';

import { useEffect, useState } from 'react';
import { History, BarChart3, Map as MapIcon, RefreshCw, Grid3x3, Droplets } from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { CollapsiblePanel, RadioCard, RadioOption, StepSection } from './primitives';

const PREDICTION_INDICES = [
  { value: 'SPI', label: 'SPI - Indice de Precipitacion Estandarizado' },
  { value: 'SPEI', label: 'SPEI - Indice de Precipitacion-Evapotranspiracion' },
  { value: 'RAI', label: 'RAI - Indice de Anomalia de Lluvia' },
  { value: 'EDDI', label: 'EDDI - Indice de Demanda de Evaporacion' },
  { value: 'PDSI', label: 'PDSI - Indice de Severidad de Sequia de Palmer' },
];

const SCALES = [1, 3, 6, 12];

export default function PredictionHistorySection({
  predictionHistoryOpen,
  setPredictionHistoryOpen,
  predictionHistorySummary,
  predictionHistoryState,
  setPredictionHistoryState,
  hasSelection,
  onPredictionHistoryPlot,
}) {
  const [predictionFiles, setPredictionFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Load prediction history files when section opens
  useEffect(() => {
    if (!predictionHistoryOpen || predictionFiles.length > 0) return;
    let cancelled = false;
    async function loadFiles() {
      setLoadingFiles(true);
      try {
        const { predictionHistoryApi } = await import('@/services/api');
        const result = await predictionHistoryApi.getList();
        if (!cancelled && result?.predictions) {
          setPredictionFiles(result.predictions);
        }
      } catch (err) {
        console.error('Error loading prediction history files:', err);
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    }
    loadFiles();
    return () => { cancelled = true; };
  }, [predictionHistoryOpen, predictionFiles.length]);

  const handleRefreshFiles = async () => {
    setLoadingFiles(true);
    try {
      const { predictionHistoryApi } = await import('@/services/api');
      const result = await predictionHistoryApi.getList();
      if (result?.predictions) {
        setPredictionFiles(result.predictions);
      }
    } catch (err) {
      console.error('Error refreshing prediction history files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const is2D = predictionHistoryState.visualizationType === '2D';
  const is1D = predictionHistoryState.visualizationType === '1D';
  const isCuencas = predictionHistoryState.spatialUnit === 'cuencas';

  const canGenerate = (() => {
    if (!predictionHistoryState.selectedFileId) return false;
    if (!predictionHistoryState.droughtIndex || !predictionHistoryState.scale) return false;
    if (is1D && !isCuencas && !hasSelection) return false;
    if (is1D && isCuencas && !hasSelection) return false;
    if (is2D && !predictionHistoryState.horizon) return false;
    return true;
  })();

  // Build options for dropdown
  const fileOptions = predictionFiles.map((f) => ({
    value: String(f.file_id),
    label: `${f.issued_at || 'Sin fecha'}${f.is_current ? ' (Actual)' : ''}`,
  }));

  return (
    <CollapsiblePanel
      icon={History}
      title="Historico de Predicciones"
      subtitle="Predicciones pasadas por fecha de emision"
      color="purple"
      open={predictionHistoryOpen}
      onToggle={() => setPredictionHistoryOpen(!predictionHistoryOpen)}
    >
      {predictionHistorySummary && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 mb-3 truncate border border-gray-200 dark:border-gray-700/40">
          {predictionHistorySummary}
        </p>
      )}

      <div className="space-y-5 p-5 bg-gradient-to-br from-purple-50/50 via-purple-50/20 to-purple-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-purple-950/10 rounded-2xl border border-purple-200/50 dark:border-purple-900/30 shadow-lg">
        <div className="space-y-6">

          {/* Step 1: Fecha de emision (Select prediction file) */}
          <StepSection step={1} title="Fecha de emision" color="purple" collapsible defaultOpen>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Seleccionar prediccion
                </label>
                <button
                  onClick={handleRefreshFiles}
                  disabled={loadingFiles}
                  className="text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
                  title="Actualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {loadingFiles ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Cargando predicciones...
                </div>
              ) : fileOptions.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  No hay predicciones disponibles. Sube una desde el panel de administracion.
                </p>
              ) : (
                <Select
                  label="Fecha de emision"
                  options={fileOptions}
                  value={predictionHistoryState.selectedFileId || ''}
                  onChange={(value) => setPredictionHistoryState((prev) => ({ ...prev, selectedFileId: value }))}
                  placeholder="Seleccionar prediccion..."
                />
              )}
            </div>
          </StepSection>

          {/* Step 2: Visualization Type */}
          <StepSection step={2} title="Tipo de visualizacion" color="purple" collapsible defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <RadioOption
                name="predHistVisType"
                value="1D"
                checked={is1D}
                onChange={() => setPredictionHistoryState((prev) => ({ ...prev, visualizationType: '1D' }))}
                label="1D Serie"
                description={isCuencas ? 'Por cuenca, 12 horizontes' : 'Por celda, 12 horizontes'}
                icon={BarChart3}
              />
              <RadioOption
                name="predHistVisType"
                value="2D"
                checked={is2D}
                onChange={() => setPredictionHistoryState((prev) => ({ ...prev, visualizationType: '2D' }))}
                label="2D Mapa"
                description={isCuencas ? '7 cuencas CHIRPS' : '297 celdas CHIRPS'}
                icon={MapIcon}
              />
            </div>
          </StepSection>

          {/* Step 2.5: Spatial Unit (Celdas / Cuencas) */}
          <StepSection step={3} title="Unidad espacial" color="purple" collapsible defaultOpen={false}>
            <div className="space-y-2">
              <RadioOption
                name="predHistSpatialUnit"
                value="grid"
                checked={!isCuencas}
                onChange={() => setPredictionHistoryState((prev) => ({ ...prev, spatialUnit: 'grid' }))}
                label="Celdas"
                icon={Grid3x3}
              />
              <RadioOption
                name="predHistSpatialUnit"
                value="cuencas"
                checked={isCuencas}
                onChange={() => setPredictionHistoryState((prev) => ({ ...prev, spatialUnit: 'cuencas' }))}
                label="Cuencas"
                icon={Droplets}
              />
            </div>
          </StepSection>

          {/* Step 4: Drought Index */}
          <StepSection step={4} title="Indice de sequia" color="purple" collapsible defaultOpen>
            <Select
              label="Seleccionar indice"
              options={PREDICTION_INDICES}
              value={predictionHistoryState.droughtIndex}
              onChange={(value) => setPredictionHistoryState((prev) => ({ ...prev, droughtIndex: value }))}
              placeholder="Seleccionar indice..."
            />
          </StepSection>

          {/* Step 5: Scale */}
          <StepSection step={5} title="Nivel de Agregación" color="purple" collapsible defaultOpen={false}>
            <div className="grid grid-cols-4 gap-2">
              {SCALES.map((s) => (
                <RadioCard
                  key={s}
                  name="predHistScale"
                  value={s}
                  checked={predictionHistoryState.scale === s}
                  onChange={() => setPredictionHistoryState((prev) => ({ ...prev, scale: s }))}
                  label={`${s}m`}
                  badge={`${s} ${s === 1 ? 'mes' : 'meses'}`}
                />
              ))}
            </div>
          </StepSection>

          {/* Step 6: Horizon (only 2D) */}
          {is2D && (
            <StepSection step={6} title="Horizonte de prediccion" color="purple" collapsible defaultOpen>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Horizonte: <strong className="text-purple-700 dark:text-purple-300">{predictionHistoryState.horizon || 1} {(predictionHistoryState.horizon || 1) === 1 ? 'mes' : 'meses'}</strong>
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={predictionHistoryState.horizon || 1}
                  onChange={(e) => setPredictionHistoryState((prev) => ({ ...prev, horizon: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
                  <span>1m</span>
                  <span>6m</span>
                  <span>12m</span>
                </div>
              </div>
            </StepSection>
          )}

          {/* Info banner for 1D */}
          {is1D && !hasSelection && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {isCuencas
                  ? 'Selecciona una cuenca del mapa para ver la prediccion 1D'
                  : 'Selecciona una celda del mapa para ver la prediccion 1D'}
              </p>
            </div>
          )}

          <div className="pt-4 mt-2 border-t border-gray-200/60 dark:border-gray-700/40">
            <Button
              onClick={onPredictionHistoryPlot}
              variant="primary"
              className={`w-full py-3 rounded-2xl text-sm tracking-wide shadow-md hover:shadow-lg transition-all ${!canGenerate ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
              disabled={!canGenerate}
            >
              <History className="w-4 h-4" />
              Generar Historico
            </Button>
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
