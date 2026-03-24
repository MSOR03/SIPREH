'use client';

import { TrendingUp, Zap, BarChart3, Map as MapIcon } from 'lucide-react';
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

export default function PredictionSection({
  predictionOpen,
  setPredictionOpen,
  predictionSummary,
  predictionState,
  setPredictionState,
  hasSelection,
  onPredictionPlot,
}) {
  const is2D = predictionState.visualizationType === '2D';
  const is1D = predictionState.visualizationType === '1D';

  const canGenerate = (() => {
    if (!predictionState.droughtIndex || !predictionState.scale) return false;
    if (is1D && !hasSelection) return false;
    if (is2D && !predictionState.horizon) return false;
    return true;
  })();

  return (
    <CollapsiblePanel
      icon={Zap}
      title="Prediccion Actual"
      subtitle="Ultima prediccion disponible"
      color="green"
      open={predictionOpen}
      onToggle={() => setPredictionOpen(!predictionOpen)}
    >
      {predictionSummary && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 mb-3 truncate border border-gray-200 dark:border-gray-700/40">
          {predictionSummary}
        </p>
      )}

      <div className="space-y-5 p-5 bg-gradient-to-br from-green-50/50 via-green-50/20 to-green-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-green-950/10 rounded-2xl border border-green-200/50 dark:border-green-900/30 shadow-lg">
        <div className="space-y-6">

          {/* Step 1: Visualization Type */}
          <StepSection step={1} title="Tipo de visualizacion" color="green" collapsible defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <RadioOption
                name="predVisType"
                value="1D"
                checked={is1D}
                onChange={() => setPredictionState((prev) => ({ ...prev, visualizationType: '1D' }))}
                label="1D Serie"
                description="Por celda, 12 horizontes"
                icon={BarChart3}
              />
              <RadioOption
                name="predVisType"
                value="2D"
                checked={is2D}
                onChange={() => setPredictionState((prev) => ({ ...prev, visualizationType: '2D' }))}
                label="2D Mapa"
                description="297 celdas CHIRPS"
                icon={MapIcon}
              />
            </div>
          </StepSection>

          {/* Step 2: Drought Index */}
          <StepSection step={2} title="Indice de sequia" color="green" collapsible defaultOpen>
            <Select
              label="Seleccionar indice"
              options={PREDICTION_INDICES}
              value={predictionState.droughtIndex}
              onChange={(value) => setPredictionState((prev) => ({ ...prev, droughtIndex: value }))}
              placeholder="Seleccionar indice..."
            />
          </StepSection>

          {/* Step 3: Scale */}
          <StepSection step={3} title="Escala temporal" color="green" collapsible defaultOpen>
            <div className="grid grid-cols-4 gap-2">
              {SCALES.map((s) => (
                <RadioCard
                  key={s}
                  name="predScale"
                  value={s}
                  checked={predictionState.scale === s}
                  onChange={() => setPredictionState((prev) => ({ ...prev, scale: s }))}
                  label={`${s}m`}
                  badge={`${s} ${s === 1 ? 'mes' : 'meses'}`}
                />
              ))}
            </div>
          </StepSection>

          {/* Step 4: Horizon (only 2D) */}
          {is2D && (
            <StepSection step={4} title="Horizonte de prediccion" color="green" collapsible defaultOpen>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Horizonte: <strong className="text-green-700 dark:text-green-300">{predictionState.horizon || 1} {(predictionState.horizon || 1) === 1 ? 'mes' : 'meses'}</strong>
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={predictionState.horizon || 1}
                  onChange={(e) => setPredictionState((prev) => ({ ...prev, horizon: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
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
                Selecciona una celda del mapa para ver la prediccion 1D
              </p>
            </div>
          )}

          <div className="pt-4 mt-2 border-t border-gray-200/60 dark:border-gray-700/40">
            <Button
              onClick={onPredictionPlot}
              variant="success"
              className={`w-full py-3 rounded-2xl text-sm tracking-wide shadow-md hover:shadow-lg transition-all ${!canGenerate ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
              disabled={!canGenerate}
            >
              <TrendingUp className="w-4 h-4" />
              Generar Prediccion
            </Button>
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
