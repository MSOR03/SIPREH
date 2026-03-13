'use client';

import { Download, TrendingUp, Zap } from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { CollapsiblePanel, RadioCard, StepSection } from './primitives';

export default function PredictionSection({
  predictionOpen,
  setPredictionOpen,
  predictionSummary,
  predictionState,
  setPredictionState,
  allIndices,
  timeHorizons,
  hasSelection,
  onPredictionPlot,
  onPredictionSave,
}) {
  return (
    <CollapsiblePanel
      icon={Zap}
      title="Predicción Actual"
      subtitle="Última predicción disponible"
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
          <StepSection step={1} title="Índice de sequía" color="green" collapsible defaultOpen>
            <Select
              label="Seleccionar índice"
              options={allIndices}
              value={predictionState.droughtIndex}
              onChange={(value) => setPredictionState((prev) => ({ ...prev, droughtIndex: value }))}
              placeholder="Seleccionar índice..."
            />
          </StepSection>

          <StepSection step={2} title="Horizonte de predicción" color="green" collapsible defaultOpen={false}>
            <div className="grid grid-cols-3 gap-2">
              {timeHorizons.map((h) => (
                <RadioCard
                  key={h.value}
                  name="predHorizon"
                  value={h.value}
                  checked={predictionState.timeHorizon === h.value}
                  onChange={() => setPredictionState((prev) => ({ ...prev, timeHorizon: h.value }))}
                  label={h.label}
                />
              ))}
            </div>
          </StepSection>

          <div className="flex gap-3 pt-4 mt-2 border-t border-gray-200/60 dark:border-gray-700/40">
            <Button
              onClick={onPredictionPlot}
              variant="success"
              className={`flex-1 py-3 rounded-2xl text-sm tracking-wide shadow-md hover:shadow-lg transition-all ${!hasSelection ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!hasSelection}
            >
              <TrendingUp className="w-4 h-4" />
              Graficar
            </Button>
            <Button
              onClick={onPredictionSave}
              variant="secondary"
              className="flex-1 py-3 rounded-2xl text-sm tracking-wide"
            >
              <Download className="w-4 h-4" />
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
