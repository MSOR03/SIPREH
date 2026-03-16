'use client';

import { BarChart3, Calendar, ChevronLeft, CloudRain, Clock, Grid3x3, Waves, ArrowDownUp } from 'lucide-react';
import Select from '../ui/Select';
import Button from '../ui/Button';
import DateRangePicker from '../ui/DateRangePicker';
import { CollapsiblePanel, RadioCard, RadioOption, StepSection } from './primitives';

export default function HistoricalSection({
  historicalOpen,
  setHistoricalOpen,
  summaryParts,
  showCategoryPicker,
  setShowCategoryPicker,
  handleCategoryChange,
  isHydromet,
  isHydrological,
  currentVariables,
  currentIndices,
  analysisState,
  setAnalysisState,
  showSpatialUnit,
  spatialUnitOptions,
  showDataSource,
  analysisDisabled,
  onAnalysisPlot,
}) {
  const stepNumbers = (() => {
    let current = 1;
    const numbers = {
      variables: current++,
      visualizationType: current++,
    };

    if (showSpatialUnit) {
      numbers.spatialUnit = current++;
    }

    if (showDataSource) {
      numbers.dataSource = current++;
    }

    numbers.timePeriod = current;
    return numbers;
  })();

  return (
    <CollapsiblePanel
      icon={BarChart3}
      title="Análisis Histórico"
      subtitle="Datos desde 1941"
      color="blue"
      open={historicalOpen}
      onToggle={() => setHistoricalOpen(!historicalOpen)}
    >
      {summaryParts && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 mb-3 truncate border border-gray-200 dark:border-gray-700/40">
          {summaryParts}
        </p>
      )}

      <div className="space-y-5 p-5 bg-gradient-to-br from-blue-50/50 via-blue-50/20 to-blue-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-blue-950/10 rounded-2xl border border-blue-200/50 dark:border-blue-900/30 shadow-lg">
        {showCategoryPicker ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Selecciona una categoría de datos
            </p>
            <button
              type="button"
              onClick={() => handleCategoryChange('hydromet')}
              className={`w-full flex items-center gap-3.5 p-4 rounded-xl border-2 text-left transition-all group ${
                isHydromet
                  ? 'bg-blue-50 dark:bg-blue-900/25 border-blue-500 dark:border-blue-400 shadow-md'
                  : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                isHydromet
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40'
              }`}>
                <CloudRain className={`w-5 h-5 ${isHydromet ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-blue-500'}`} />
              </div>
              <div className="flex-1">
                <span className={`text-sm font-bold block ${isHydromet ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}`}>
                  Datos Hidrometeorológicos
                </span>
                <span className={`text-[11px] block mt-0.5 ${isHydromet ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  Precipitación, temperatura, evapotranspiración - ERA5, IMERG, CHIRPS
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('hydrological')}
              className={`w-full flex items-center gap-3.5 p-4 rounded-xl border-2 text-left transition-all group ${
                isHydrological
                  ? 'bg-teal-50 dark:bg-teal-900/25 border-teal-500 dark:border-teal-400 shadow-md'
                  : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-sm'
              }`}
            >
              <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                isHydrological
                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/40'
              }`}>
                <Waves className={`w-5 h-5 ${isHydrological ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-teal-500'}`} />
              </div>
              <div className="flex-1">
                <span className={`text-sm font-bold block ${isHydrological ? 'text-teal-800 dark:text-teal-200' : 'text-gray-800 dark:text-gray-200'}`}>
                  Datos Hidrológicos
                </span>
                <span className={`text-[11px] block mt-0.5 ${isHydrological ? 'text-teal-600 dark:text-teal-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  Caudales, niveles - Estaciones, cuencas, embalses
                </span>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Cambiar
              </button>
              <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg ${
                isHydromet
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  : 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800'
              }`}>
                {isHydromet
                  ? <CloudRain className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  : <Waves className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                }
                <span className={`text-xs font-bold ${isHydromet ? 'text-blue-700 dark:text-blue-300' : 'text-teal-700 dark:text-teal-300'}`}>
                  {isHydromet ? 'Hidrometeorológico' : 'Hidrológico'}
                </span>
              </div>
            </div>

            <StepSection step={stepNumbers.variables} title="Variables" collapsible defaultOpen>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Variable climática"
                  options={currentVariables}
                  value={analysisState.variable}
                  onChange={(value) => setAnalysisState((prev) => ({ ...prev, variable: value }))}
                  placeholder="Seleccionar..."
                />
                <Select
                  label="Índice de sequía"
                  options={currentIndices}
                  value={analysisState.droughtIndex}
                  onChange={(value) => setAnalysisState((prev) => ({ ...prev, droughtIndex: value }))}
                  placeholder="Seleccionar..."
                />
              </div>

              {analysisState.droughtIndex && (
                <div className="mt-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    Escala temporal (meses)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 6, 12].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAnalysisState((prev) => ({ ...prev, indexScale: s }))}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                          (analysisState.indexScale || 1) === s
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 shadow-sm'
                            : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {analysisState.variable && !analysisState.droughtIndex && (
                analysisState.visualizationType === '1D' || analysisState.variable === 'precip'
              ) && (
                <div className="mt-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    <ArrowDownUp className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    Frecuencia
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'D', label: 'Diaria' },
                      { key: 'M', label: 'Mensual' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setAnalysisState((prev) => ({ ...prev, frequency: f.key }))}
                        className={`py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                          (analysisState.frequency || 'D') === f.key
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 shadow-sm'
                            : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </StepSection>

            <StepSection step={stepNumbers.visualizationType} title="Tipo de visualización" collapsible defaultOpen>
              <div className="grid grid-cols-2 gap-2">
                <RadioOption
                  name="vizType"
                  value="1D"
                  checked={analysisState.visualizationType === '1D'}
                  onChange={(v) => setAnalysisState((prev) => ({ ...prev, visualizationType: v }))}
                  label="Serie Temporal"
                  description="Evolución temporal en un punto"
                  icon={BarChart3}
                />
                <RadioOption
                  name="vizType"
                  value="2D"
                  checked={analysisState.visualizationType === '2D'}
                  onChange={(v) => setAnalysisState((prev) => ({ ...prev, visualizationType: v }))}
                  label="Mapa Espacial"
                  description="Distribución espacial"
                  icon={Grid3x3}
                />
              </div>
            </StepSection>

            {showSpatialUnit && (
              <StepSection step={stepNumbers.spatialUnit} title="Unidad espacial" collapsible defaultOpen={false}>
                <div className="space-y-2">
                  {spatialUnitOptions.map((opt) => (
                    <RadioOption
                      key={opt.value}
                      name="spatialUnit"
                      value={opt.value}
                      checked={(analysisState.spatialUnit || (isHydromet ? 'grid' : 'estaciones')) === opt.value}
                      onChange={(v) => setAnalysisState((prev) => ({ ...prev, spatialUnit: v }))}
                      label={opt.label}
                      icon={opt.icon}
                    />
                  ))}
                </div>
              </StepSection>
            )}

            {showDataSource && (
              <StepSection step={stepNumbers.dataSource} title="Fuente de datos" collapsible defaultOpen={false}>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'ERA5', res: 0.25 },
                    { key: 'IMERG', res: 0.10 },
                    { key: 'CHIRPS', res: 0.05 },
                  ].map((src) => (
                    <RadioCard
                      key={src.key}
                      name="dataSource"
                      value={src.key}
                      checked={analysisState.spatialResolution === src.res}
                      onChange={() => setAnalysisState((prev) => ({ ...prev, dataSource: src.key, spatialResolution: src.res }))}
                      label={src.key}
                    />
                  ))}
                </div>
              </StepSection>
            )}

            <StepSection step={stepNumbers.timePeriod} title="Período de tiempo" collapsible defaultOpen>
              {analysisState.visualizationType === '2D' ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-white/70 dark:bg-[#151b27]/70">
                    <label className="flex items-start gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 leading-5">
                      <input
                        type="checkbox"
                        checked={Boolean(analysisState.useSpatialInterval)}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setAnalysisState((prev) => ({
                            ...prev,
                            useSpatialInterval: enabled,
                            endDate: enabled ? (prev.endDate || prev.startDate) : prev.startDate,
                          }));
                        }}
                        className="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        Usar intervalo de fechas
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          El mapa usa el promedio por celda entre la fecha inicial y final.
                        </span>
                      </span>
                    </label>
                  </div>

                  {analysisState.useSpatialInterval ? (
                    <DateRangePicker
                      startDate={analysisState.startDate}
                      endDate={analysisState.endDate}
                      onStartDateChange={(date) => setAnalysisState((prev) => ({
                        ...prev,
                        startDate: date,
                        endDate: prev.endDate && date > prev.endDate ? date : prev.endDate,
                      }))}
                      onEndDateChange={(date) => setAnalysisState((prev) => ({
                        ...prev,
                        endDate: date,
                        startDate: prev.startDate && date < prev.startDate ? date : prev.startDate,
                      }))}
                    />
                  ) : (
                    <div>
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                        Fecha del mapa
                      </label>
                      <input
                        type="date"
                        value={analysisState.startDate}
                        onChange={(e) => setAnalysisState((prev) => ({ ...prev, startDate: e.target.value, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <DateRangePicker
                  startDate={analysisState.startDate}
                  endDate={analysisState.endDate}
                  onStartDateChange={(date) => setAnalysisState((prev) => ({ ...prev, startDate: date }))}
                  onEndDateChange={(date) => setAnalysisState((prev) => ({ ...prev, endDate: date }))}
                />
              )}
            </StepSection>

            <div className="pt-4 mt-2 border-t border-gray-200/60 dark:border-gray-700/40">
              <Button
                onClick={onAnalysisPlot}
                variant="primary"
                className={`w-full py-3.5 rounded-2xl text-sm tracking-wide font-bold border border-blue-300/40 shadow-[0_14px_34px_-12px_rgba(37,99,235,0.75)] hover:shadow-[0_20px_42px_-14px_rgba(37,99,235,0.85)] transition-all duration-300 ${analysisDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'}`}
                disabled={analysisDisabled}
              >
                <BarChart3 className="w-4 h-4" />
                Generar Analisis
              </Button>
            </div>
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
}
