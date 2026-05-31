'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Zap, BarChart3, Map as MapIcon, Grid3x3, Droplets } from 'lucide-react';
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

function formatIssuedAt(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const fullDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return `${day}/${month}/${year}`;
  }

  const yearMonthMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    const [, year, month] = yearMonthMatch;
    return `${month}/${year}`;
  }

  return raw;
}

function parseIssuedAtDate(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const fullDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const yearMonthMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    const [, year, month] = yearMonthMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function formatDateIso(date) {
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  const iso = formatDateIso(date);
  if (!iso) return null;
  return formatIssuedAt(iso);
}

export default function PredictionSection({
  predictionOpen,
  setPredictionOpen,
  predictionSummary,
  predictionState,
  setPredictionState,
  hasSelection,
  onPredictionPlot,
}) {
  const [currentIssuedAt, setCurrentIssuedAt] = useState(null);
  const [loadingIssuedAt, setLoadingIssuedAt] = useState(false);
  const is2D = predictionState.visualizationType === '2D';
  const is1D = predictionState.visualizationType === '1D';
  const isCuencas = predictionState.spatialUnit === 'cuencas';

  useEffect(() => {
    if (!predictionOpen) return;

    let cancelled = false;

    async function loadCurrentPredictionIssuedAt() {
      setLoadingIssuedAt(true);
      try {
        const { predictionHistoryApi } = await import('@/services/api');
        const result = await predictionHistoryApi.getList();
        if (cancelled) return;

        const currentPrediction = result?.predictions?.find((item) => item.is_current) || result?.predictions?.[0] || null;
        setCurrentIssuedAt(currentPrediction?.issued_at || null);
      } catch (error) {
        if (!cancelled) {
          setCurrentIssuedAt(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingIssuedAt(false);
        }
      }
    }

    loadCurrentPredictionIssuedAt();

    return () => {
      cancelled = true;
    };
  }, [predictionOpen]);

  const subtitle = useMemo(() => {
    if (loadingIssuedAt) return 'Cargando fecha de emision...';
    const issuedAtLabel = formatIssuedAt(currentIssuedAt);
    return issuedAtLabel ? `Fecha de emision: ${issuedAtLabel}` : 'Ultima prediccion disponible';
  }, [currentIssuedAt, loadingIssuedAt]);

  const horizonSummary = useMemo(() => {
    const horizon = Number(predictionState.horizon || 1);
    const issuedAtDate = parseIssuedAtDate(currentIssuedAt);
    const forecastDate = issuedAtDate ? addMonths(issuedAtDate, horizon) : null;
    const forecastDateLabel = formatDateDisplay(forecastDate);

    return {
      horizonLabel: `${horizon} ${horizon === 1 ? 'mes' : 'meses'}`,
      forecastDateLabel,
      horizonMarks: [1, 6, 12].map((step) => {
        const dateLabel = issuedAtDate ? formatDateDisplay(addMonths(issuedAtDate, step)) : null;
        return {
          step,
          label: `${step}m`,
          dateLabel,
        };
      }),
    };
  }, [currentIssuedAt, predictionState.horizon]);

  const canGenerate = (() => {
    if (!predictionState.droughtIndex || !predictionState.scale) return false;
    if (is1D && !isCuencas && !hasSelection) return false;
    if (is1D && isCuencas && !hasSelection) return false;
    if (is2D && !predictionState.horizon) return false;
    return true;
  })();

  return (
    <CollapsiblePanel
      icon={Zap}
      title="Prediccion Actual"
      subtitle={subtitle}
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
                description={isCuencas ? 'Por cuenca, 12 horizontes' : 'Por celda, 12 horizontes'}
                icon={BarChart3}
              />
              <RadioOption
                name="predVisType"
                value="2D"
                checked={is2D}
                onChange={() => setPredictionState((prev) => ({ ...prev, visualizationType: '2D' }))}
                label="2D Mapa"
                description={isCuencas ? '7 cuencas CHIRPS' : '297 celdas CHIRPS'}
                icon={MapIcon}
              />
            </div>
          </StepSection>

          {/* Step 1.5: Spatial Unit (Celdas / Cuencas) */}
          <StepSection step={2} title="Unidad espacial" color="green" collapsible defaultOpen={false}>
            <div className="space-y-2">
              <RadioOption
                name="predSpatialUnit"
                value="grid"
                checked={!isCuencas}
                onChange={() => setPredictionState((prev) => ({ ...prev, spatialUnit: 'grid' }))}
                label="Celdas"
                icon={Grid3x3}
              />
              <RadioOption
                name="predSpatialUnit"
                value="cuencas"
                checked={isCuencas}
                onChange={() => setPredictionState((prev) => ({ ...prev, spatialUnit: 'cuencas' }))}
                label="Cuencas"
                icon={Droplets}
              />
            </div>
          </StepSection>

          {/* Step 3: Drought Index */}
          <StepSection step={3} title="Indice de sequia" color="green" collapsible defaultOpen>
            <Select
              label="Seleccionar indice"
              options={PREDICTION_INDICES}
              value={predictionState.droughtIndex}
              onChange={(value) => setPredictionState((prev) => ({ ...prev, droughtIndex: value }))}
              placeholder="Seleccionar indice..."
            />
          </StepSection>

          {/* Step 4: Scale */}
          <StepSection step={4} title="Nivel de Agregación" color="green" collapsible defaultOpen>
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

          {/* Step 5: Horizon (only 2D) */}
          {is2D && (
            <StepSection step={5} title="Horizonte de prediccion" color="green" collapsible defaultOpen>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Horizonte: <strong className="text-green-700 dark:text-green-300">{horizonSummary.horizonLabel}</strong>
                    {horizonSummary.forecastDateLabel && (
                      <span className="ml-3 text-gray-400 dark:text-gray-500">
                        ({horizonSummary.forecastDateLabel})
                      </span>
                    )}
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
                <div className="flex justify-between gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                  {horizonSummary.horizonMarks.map((mark) => (
                    <span key={mark.step} className="flex flex-col items-center leading-tight text-center">
                      <span>{mark.label}</span>
                      <span className="text-[9px] text-gray-500 dark:text-gray-400">
                        {mark.dateLabel || '--/--/----'}
                      </span>
                    </span>
                  ))}
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
