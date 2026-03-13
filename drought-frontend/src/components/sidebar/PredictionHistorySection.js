'use client';

import { Calendar, Download, History } from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { CollapsiblePanel, RadioCard, StepSection } from './primitives';

export default function PredictionHistorySection({
  predictionHistoryOpen,
  setPredictionHistoryOpen,
  predictionHistorySummary,
  predictionHistoryState,
  setPredictionHistoryState,
  allIndices,
  timeHorizons,
  hasSelection,
  onPredictionHistoryPlot,
  onPredictionHistorySave,
}) {
  return (
    <CollapsiblePanel
      icon={History}
      title="Histórico de Predicciones"
      subtitle="Predicciones pasadas por fecha de emisión"
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
          <StepSection step={1} title="Índice de sequía" color="purple" collapsible defaultOpen>
            <Select
              label="Seleccionar índice"
              options={allIndices}
              value={predictionHistoryState.droughtIndex}
              onChange={(value) => setPredictionHistoryState((prev) => ({ ...prev, droughtIndex: value }))}
              placeholder="Seleccionar índice..."
            />
          </StepSection>

          <StepSection step={2} title="Horizonte de predicción" color="purple" collapsible defaultOpen={false}>
            <div className="grid grid-cols-3 gap-2">
              {timeHorizons.map((h) => (
                <RadioCard
                  key={h.value}
                  name="predHistHorizon"
                  value={h.value}
                  checked={predictionHistoryState.timeHorizon === h.value}
                  onChange={() => setPredictionHistoryState((prev) => ({ ...prev, timeHorizon: h.value }))}
                  label={h.label}
                />
              ))}
            </div>
          </StepSection>

          <StepSection step={3} title="Fecha de emisión" color="purple" collapsible defaultOpen={false}>
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                <Calendar className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                ¿Cuándo se realizó la predicción?
              </label>
              <input
                type="date"
                value={predictionHistoryState.predictionDate}
                onChange={(e) => setPredictionHistoryState((prev) => ({ ...prev, predictionDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </StepSection>

          <div className="flex gap-3 pt-4 mt-2 border-t border-gray-200/60 dark:border-gray-700/40">
            <Button
              onClick={onPredictionHistoryPlot}
              variant="primary"
              className={`flex-1 py-3 rounded-2xl text-sm tracking-wide shadow-md hover:shadow-lg transition-all ${!hasSelection ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!hasSelection}
            >
              <History className="w-4 h-4" />
              Consultar
            </Button>
            <Button
              onClick={onPredictionHistorySave}
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
