'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, Download, Info, AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, CloudRain, Waves, Calendar, Grid3x3, MapPin, Database, Droplets, History, Zap } from 'lucide-react';
import Select from './ui/Select';
import Button from './ui/Button';
import DateRangePicker from './ui/DateRangePicker';

// ── Hydrometeorological variables & indices ─────────────────────
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

// ── Hydrological variables & indices ────────────────────────────
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

// ── Shared catalogs ─────────────────────────────────────────────
const timeHorizons = [
  { value: '1m', label: '1 mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
];

// ── Reusable: Collapsible panel (for main sections) ─────────────
function CollapsiblePanel({ icon: Icon, title, subtitle, color, open, onToggle, children }) {
  const colorMap = {
    blue: {
      border: 'border-blue-500 dark:border-blue-400',
      glow: 'bg-blue-500/10 dark:bg-blue-400/10',
      iconBg: 'from-blue-500 to-blue-600',
      dot: 'bg-blue-500',
      chevron: open ? 'text-blue-400' : 'text-gray-400 dark:text-gray-500',
    },
    green: {
      border: 'border-green-500 dark:border-green-400',
      glow: 'bg-green-500/10 dark:bg-green-400/10',
      iconBg: 'from-green-500 to-green-600',
      dot: 'bg-green-500',
      chevron: open ? 'text-green-400' : 'text-gray-400 dark:text-gray-500',
    },
    purple: {
      border: 'border-purple-500 dark:border-purple-400',
      glow: 'bg-purple-500/10 dark:bg-purple-400/10',
      iconBg: 'from-purple-500 to-purple-600',
      dot: 'bg-purple-500',
      chevron: open ? 'text-purple-400' : 'text-gray-400 dark:text-gray-500',
    },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={onToggle}
        className={`relative flex items-center gap-3 w-full text-left mb-3 pb-3 border-b-2 ${c.border} group`}
      >
        <div className={`absolute -left-2 -right-2 -top-1 -bottom-1 ${c.glow} rounded-lg blur-sm`} />
        <div className={`relative p-2 bg-gradient-to-br ${c.iconBg} rounded-xl shadow-lg`}>
          <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="relative flex-1">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 ${c.dot} rounded-full animate-pulse`} />
            {subtitle}
          </p>
        </div>
        <ChevronDown className={`relative w-5 h-5 ${c.chevron} transition-transform duration-300 ${open ? '' : '-rotate-90'}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-400 ease-in-out ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
}

// ── Reusable: Step section with numbered divider ────────────────
function StepSection({ step, title, children, color = 'blue' }) {
  const badgeColors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
  };
  return (
    <div className="relative">
      {/* Divider line with step badge */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br ${badgeColors[color] || badgeColors.blue} text-[10px] font-bold text-white shadow-sm shrink-0`}>
          {step}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-gray-300 dark:from-gray-600 to-transparent" />
      </div>
      <div className="pl-1">
        {children}
      </div>
    </div>
  );
}

// ── Reusable: Radio option (styled custom radio) ────────────────
function RadioOption({ name, value, checked, onChange, label, description, icon: Icon }) {
  return (
    <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
      checked
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-500 shadow-sm'
        : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
    }`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {Icon && (
        <div className={`p-1.5 rounded-lg shrink-0 ${
          checked
            ? 'bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-400'
            : 'bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-semibold block ${
          checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
        }`}>{label}</span>
        {description && (
          <span className={`text-[10px] block mt-0.5 leading-tight ${
            checked ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
          }`}>{description}</span>
        )}
      </div>
      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
        checked ? 'border-blue-500 dark:border-blue-400' : 'border-gray-300 dark:border-gray-600'
      }`}>
        {checked && <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />}
      </div>
    </label>
  );
}

// ── Reusable: Radio card (for data source with resolution) ──────
function RadioCard({ name, value, checked, onChange, label, badge }) {
  return (
    <label className={`flex flex-col items-center justify-center p-3 rounded-xl cursor-pointer transition-all border-2 text-center ${
      checked
        ? 'bg-blue-50 dark:bg-blue-900/25 border-blue-500 dark:border-blue-400 shadow-sm'
        : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
    }`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      <span className={`text-sm font-bold ${checked ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
      {badge && (
        <span className={`text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full ${
          checked
            ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        }`}>{badge}</span>
      )}
    </label>
  );
}


// ── Main Sidebar ────────────────────────────────────────────────

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
  selectedCell
}) {
  // Panel open/close state
  const [historicalOpen, setHistoricalOpen] = useState(true);
  const [predictionOpen, setPredictionOpen] = useState(true);
  const [predictionHistoryOpen, setPredictionHistoryOpen] = useState(false);
  // Category picker: true = show full picker cards, false = show selected category detail
  const [showCategoryPicker, setShowCategoryPicker] = useState(true);

  // Derived flags
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

  // Choose variables & indices based on data category
  const currentVariables = isHydromet ? hydrometeorologicalVariables : hydrologicalVariables;
  const currentIndices = isHydromet ? hydrometIndices : hydrologicalIndices;

  // Spatial unit options depend on category — NO grid for hydrological
  const spatialUnitOptions = (() => {
    if (isHydrological) {
      return [
        { value: 'cuencas', label: 'Cuencas', icon: Droplets, description: 'Agregación por cuenca hidrográfica' },
        { value: 'embalses', label: 'Embalses', icon: Database, description: 'Puntos en embalses y represas' },
        { value: 'estaciones', label: 'Estaciones', icon: MapPin, description: 'Estaciones de monitoreo hidrológico' },
      ];
    }
    return [
      { value: 'grid', label: 'Grid (celdas)', icon: Grid3x3, description: 'Celdas regulares del modelo' },
      { value: 'cuencas', label: 'Cuencas', icon: Droplets, description: 'Agregación por cuenca hidrográfica' },
      { value: 'embalses', label: 'Embalses', icon: Database, description: 'Puntos en embalses y represas' },
    ];
  })();

  // When switching data category, reset variable-dependent fields
  const handleCategoryChange = (newCat) => {
    const updates = { dataCategory: newCat, variable: '', droughtIndex: '' };
    if (newCat === 'hydrological') {
      updates.spatialUnit = 'estaciones';
      updates.dataSource = '';
    } else {
      if (analysisState.spatialUnit === 'estaciones') {
        updates.spatialUnit = 'grid';
      }
    }
    setAnalysisState({ ...analysisState, ...updates });
    setShowCategoryPicker(false);
  };

  // Build summary line
  const resolutionLabel = isHydromet 
    ? { 0.25: 'ERA5', 0.1: 'IMERG', 0.05: 'CHIRPS' }[analysisState.spatialResolution] || null
    : null;
  const summaryParts = [
    isHydromet ? 'Hidrometeorológico' : 'Hidrológico',
    analysisState.variable
      ? (currentVariables.find(v => v.value === analysisState.variable)?.label || analysisState.variable)
      : null,
    analysisState.droughtIndex || null,
    is2DMode && analysisState.spatialUnit
      ? { grid: 'Grid', cuencas: 'Cuencas', embalses: 'Embalses', estaciones: 'Estaciones' }[analysisState.spatialUnit] || null
      : null,
    is2DMode && resolutionLabel ? `${resolutionLabel} (${analysisState.spatialResolution}°)` : null,
    analysisState.startDate || null,
  ].filter(Boolean).join(' • ');

  // Build prediction summary lines
  const allIndices = [...hydrometIndices, ...hydrologicalIndices];
  const predictionSummary = [
    predictionState.droughtIndex
      ? (allIndices.find(i => i.value === predictionState.droughtIndex)?.label || predictionState.droughtIndex)
      : null,
    predictionState.timeHorizon
      ? (timeHorizons.find(h => h.value === predictionState.timeHorizon)?.label || predictionState.timeHorizon)
      : null,
  ].filter(Boolean).join(' • ') || null;

  const predictionHistorySummary = [
    predictionHistoryState.droughtIndex
      ? (allIndices.find(i => i.value === predictionHistoryState.droughtIndex)?.label || predictionHistoryState.droughtIndex)
      : null,
    predictionHistoryState.timeHorizon
      ? (timeHorizons.find(h => h.value === predictionHistoryState.timeHorizon)?.label || predictionHistoryState.timeHorizon)
      : null,
    predictionHistoryState.predictionDate || null,
  ].filter(Boolean).join(' • ') || null;

  // Validation for the generate button
  const analysisDisabled = (needsSelection && !hasSelection) 
    || (!analysisState.variable && !analysisState.droughtIndex) 
    || !analysisState.startDate 
    || (needsSelection && !analysisState.endDate);

  // Dynamic step counter
  let stepCounter = 0;
  const nextStep = () => ++stepCounter;

  // Show data source section? Only in 2D + hydromet + grid spatial unit
  const showDataSource = is2DMode && isHydromet && (analysisState.spatialUnit || 'grid') === 'grid';
  // Show spatial unit section? Only in 2D
  const showSpatialUnit = is2DMode;

  return (
    <aside className="w-[480px] min-w-[420px] bg-gradient-to-b from-gray-50 to-gray-100/50 dark:from-[#141920] dark:to-[#0f1419] border border-gray-200 dark:border-gray-700 overflow-y-auto shadow-2xl rounded-xl">
      <div className="px-5 py-4 space-y-5">
        
        {/* ═══ Selection Indicator ═══ */}
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
                  ? 'Visualización 2D: muestra todas las celdas del dominio'
                  : hasSelection 
                    ? selectionText
                    : 'Selecciona una estación o celda del mapa para continuar'
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* ═══════════════════════════════════════════════════════
            ANÁLISIS HISTÓRICO (collapsible)
        ═══════════════════════════════════════════════════════ */}
        <CollapsiblePanel
          icon={BarChart3}
          title="Análisis Histórico"
          subtitle="Últimos 30 años"
          color="blue"
          open={historicalOpen}
          onToggle={() => setHistoricalOpen(!historicalOpen)}
        >
          {/* Dynamic summary */}
          {summaryParts && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 mb-3 truncate border border-gray-200 dark:border-gray-700/40">
              {summaryParts}
            </p>
          )}
          
          <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50/50 via-blue-50/20 to-blue-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-blue-950/10 rounded-2xl border border-blue-200/50 dark:border-blue-900/30 shadow-lg">
            
            {/* ══ Category: Picker vs Active badge ══ */}
            {showCategoryPicker ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Selecciona una categoría de datos
                </p>
                {/* Hydromet card */}
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
                      Precipitación, temperatura, evapotranspiración — ERA5, IMERG, CHIRPS
                    </span>
                  </div>
                  {isHydromet && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
                </button>
                {/* Hydro card */}
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
                      Caudales, niveles — Estaciones, cuencas, embalses
                    </span>
                  </div>
                  {isHydrological && <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shrink-0" />}
                </button>
              </div>
            ) : (
              /* ── Active category badge + back button ── */
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
            )}

            {/* ── Only show the rest when a category is selected (detail view) ── */}
            {!showCategoryPicker && (
              <div className="space-y-5">

                {/* ── STEP: Variable Selection ── */}
                <StepSection step={nextStep()} title="Variables">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Variable climática"
                      options={currentVariables}
                      value={analysisState.variable}
                      onChange={(value) => setAnalysisState({ ...analysisState, variable: value })}
                      placeholder="Seleccionar..."
                    />
                    <Select
                      label="Índice de sequía"
                      options={currentIndices}
                      value={analysisState.droughtIndex}
                      onChange={(value) => setAnalysisState({ ...analysisState, droughtIndex: value })}
                      placeholder="Seleccionar..."
                    />
                  </div>
                </StepSection>

                {/* ── STEP: Visualization Type ── */}
                <StepSection step={nextStep()} title="Tipo de visualización">
                  <div className="grid grid-cols-2 gap-2">
                    <RadioOption
                      name="vizType"
                      value="1D"
                      checked={analysisState.visualizationType === '1D'}
                      onChange={(v) => setAnalysisState({ ...analysisState, visualizationType: v })}
                      label="Serie Temporal"
                      description="Evolución temporal en un punto"
                      icon={BarChart3}
                    />
                    <RadioOption
                      name="vizType"
                      value="2D"
                      checked={analysisState.visualizationType === '2D'}
                      onChange={(v) => setAnalysisState({ ...analysisState, visualizationType: v })}
                      label="Mapa Espacial"
                      description="Distribución espacial"
                      icon={Grid3x3}
                    />
                  </div>
                </StepSection>

                {/* ── STEP: Spatial Unit (only 2D) ── */}
                {showSpatialUnit && (
                  <StepSection step={nextStep()} title="Unidad espacial">
                    <div className="space-y-2">
                      {spatialUnitOptions.map((opt) => (
                        <RadioOption
                          key={opt.value}
                          name="spatialUnit"
                          value={opt.value}
                          checked={(analysisState.spatialUnit || (isHydromet ? 'grid' : 'estaciones')) === opt.value}
                          onChange={(v) => setAnalysisState({ ...analysisState, spatialUnit: v })}
                          label={opt.label}
                          description={opt.description}
                          icon={opt.icon}
                        />
                      ))}
                    </div>
                  </StepSection>
                )}

                {/* ── STEP: Data Source (only 2D + hydromet) ── */}
                {showDataSource && (
                  <StepSection step={nextStep()} title="Fuente de datos / Resolución">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'ERA5', res: 0.25, badge: '0.25°' },
                        { key: 'IMERG', res: 0.1, badge: '0.10°' },
                        { key: 'CHIRPS', res: 0.05, badge: '0.05°' },
                      ].map((src) => (
                        <RadioCard
                          key={src.key}
                          name="dataSource"
                          value={src.key}
                          checked={analysisState.spatialResolution === src.res}
                          onChange={() => setAnalysisState({ ...analysisState, dataSource: src.key, spatialResolution: src.res })}
                          label={src.key}
                          badge={src.badge}
                        />
                      ))}
                    </div>
                  </StepSection>
                )}

                {/* ── STEP: Time ── */}
                <StepSection step={nextStep()} title="Período de tiempo">
                  {is2DMode ? (
                    <div>
                      <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                        Fecha del mapa
                      </label>
                      <input
                        type="date"
                        value={analysisState.startDate}
                        onChange={(e) => setAnalysisState({ ...analysisState, startDate: e.target.value, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ) : (
                    <DateRangePicker
                      startDate={analysisState.startDate}
                      endDate={analysisState.endDate}
                      onStartDateChange={(date) => setAnalysisState({ ...analysisState, startDate: date })}
                      onEndDateChange={(date) => setAnalysisState({ ...analysisState, endDate: date })}
                    />
                  )}
                </StepSection>
                
                {/* ── Action Buttons ── */}
                <div className="flex gap-3 pt-3 mt-1 border-t border-gray-200/60 dark:border-gray-700/40">
                  <Button
                    onClick={onAnalysisPlot}
                    variant="primary"
                    className={`flex-1 shadow-md hover:shadow-lg transition-all ${
                      analysisDisabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={analysisDisabled}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Generar
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
            )}
          </div>
        </CollapsiblePanel>

        {/* ═══════════════════════════════════════════════════════
            PREDICCIÓN ACTUAL (collapsible)
        ═══════════════════════════════════════════════════════ */}
        <CollapsiblePanel
          icon={Zap}
          title="Predicción Actual"
          subtitle="Última predicción disponible"
          color="green"
          open={predictionOpen}
          onToggle={() => setPredictionOpen(!predictionOpen)}
        >
          {/* Dynamic summary */}
          {predictionSummary && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 mb-3 truncate border border-gray-200 dark:border-gray-700/40">
              {predictionSummary}
            </p>
          )}

          <div className="space-y-4 p-4 bg-gradient-to-br from-green-50/50 via-green-50/20 to-green-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-green-950/10 rounded-2xl border border-green-200/50 dark:border-green-900/30 shadow-lg">
            <div className="space-y-5">

              {/* ── STEP 1: Índice de Sequía ── */}
              <StepSection step={1} title="Índice de sequía" color="green">
                <Select
                  label="Seleccionar índice"
                  options={[...hydrometIndices, ...hydrologicalIndices]}
                  value={predictionState.droughtIndex}
                  onChange={(value) => setPredictionState({ ...predictionState, droughtIndex: value })}
                  placeholder="Seleccionar índice..."
                />
              </StepSection>

              {/* ── STEP 2: Horizonte ── */}
              <StepSection step={2} title="Horizonte de predicción" color="green">
                <div className="grid grid-cols-3 gap-2">
                  {timeHorizons.map((h) => (
                    <RadioCard
                      key={h.value}
                      name="predHorizon"
                      value={h.value}
                      checked={predictionState.timeHorizon === h.value}
                      onChange={() => setPredictionState({ ...predictionState, timeHorizon: h.value })}
                      label={h.label}
                    />
                  ))}
                </div>
              </StepSection>

              {/* ── Action Buttons ── */}
              <div className="flex gap-3 pt-3 mt-1 border-t border-gray-200/60 dark:border-gray-700/40">
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
        </CollapsiblePanel>

        {/* ═══════════════════════════════════════════════════════
            HISTÓRICO DE PREDICCIONES (collapsible)
        ═══════════════════════════════════════════════════════ */}
        <CollapsiblePanel
          icon={History}
          title="Histórico de Predicciones"
          subtitle="Predicciones pasadas por fecha de emisión"
          color="purple"
          open={predictionHistoryOpen}
          onToggle={() => setPredictionHistoryOpen(!predictionHistoryOpen)}
        >
          {/* Dynamic summary */}
          {predictionHistorySummary && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 mb-3 truncate border border-gray-200 dark:border-gray-700/40">
              {predictionHistorySummary}
            </p>
          )}

          <div className="space-y-4 p-4 bg-gradient-to-br from-purple-50/50 via-purple-50/20 to-purple-50/30 dark:from-[#1a1f2e] dark:via-[#141920] dark:to-purple-950/10 rounded-2xl border border-purple-200/50 dark:border-purple-900/30 shadow-lg">
            <div className="space-y-5">

              {/* ── STEP 1: Índice de Sequía ── */}
              <StepSection step={1} title="Índice de sequía" color="purple">
                <Select
                  label="Seleccionar índice"
                  options={[...hydrometIndices, ...hydrologicalIndices]}
                  value={predictionHistoryState.droughtIndex}
                  onChange={(value) => setPredictionHistoryState({ ...predictionHistoryState, droughtIndex: value })}
                  placeholder="Seleccionar índice..."
                />
              </StepSection>

              {/* ── STEP 2: Horizonte ── */}
              <StepSection step={2} title="Horizonte de predicción" color="purple">
                <div className="grid grid-cols-3 gap-2">
                  {timeHorizons.map((h) => (
                    <RadioCard
                      key={h.value}
                      name="predHistHorizon"
                      value={h.value}
                      checked={predictionHistoryState.timeHorizon === h.value}
                      onChange={() => setPredictionHistoryState({ ...predictionHistoryState, timeHorizon: h.value })}
                      label={h.label}
                    />
                  ))}
                </div>
              </StepSection>

              {/* ── STEP 3: Fecha de emisión ── */}
              <StepSection step={3} title="Fecha de emisión" color="purple">
                <div>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                    ¿Cuándo se realizó la predicción?
                  </label>
                  <input
                    type="date"
                    value={predictionHistoryState.predictionDate}
                    onChange={(e) => setPredictionHistoryState({ ...predictionHistoryState, predictionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </StepSection>

              {/* ── Action Buttons ── */}
              <div className="flex gap-3 pt-3 mt-1 border-t border-gray-200/60 dark:border-gray-700/40">
                <Button
                  onClick={onPredictionHistoryPlot}
                  variant="primary"
                  className={`flex-1 shadow-md hover:shadow-lg transition-all ${
                    !hasSelection ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={!hasSelection}
                >
                  <History className="w-4 h-4" />
                  Consultar
                </Button>
                <Button
                  onClick={onPredictionHistorySave}
                  variant="secondary"
                  className="flex-1"
                >
                  <Download className="w-4 h-4" />
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </CollapsiblePanel>

        {/* ═══ Reference Link ═══ */}
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
