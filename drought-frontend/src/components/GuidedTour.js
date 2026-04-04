'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, X, BarChart3, Zap, History, Map as MapIcon, Layers } from 'lucide-react';

const TOUR_STEPS = [
  {
    target: 'sidebar',
    icon: BarChart3,
    color: 'blue',
    title: 'Panel de Control',
    description: 'Desde aqui configuras todos los analisis. Tiene tres secciones principales que puedes abrir y cerrar.',
    position: 'right',
  },
  {
    target: 'historical',
    icon: BarChart3,
    color: 'blue',
    title: 'Analisis Historico',
    description: 'Consulta datos hidrometeorológicos desde 1941. Selecciona variables, indices de sequia, fechas y tipo de visualizacion (1D serie temporal o 2D mapa espacial).',
    position: 'right',
  },
  {
    target: 'prediction',
    icon: Zap,
    color: 'green',
    title: 'Prediccion Actual',
    description: 'Ve la prediccion mas reciente de indices de sequia a 12 horizontes (1-12 meses). Puedes ver graficos 1D por celda o mapas 2D con categorias de sequia.',
    position: 'right',
  },
  {
    target: 'prediction-history',
    icon: History,
    color: 'purple',
    title: 'Historico de Predicciones',
    description: 'Consulta predicciones anteriores seleccionando la fecha de emision. Funciona igual que la prediccion actual pero puedes elegir entre todas las predicciones subidas.',
    position: 'right',
  },
  {
    target: 'map',
    icon: MapIcon,
    color: 'blue',
    title: 'Mapa Interactivo',
    description: 'Haz click en una celda o estacion para seleccionarla. Usa doble-click para hacer zoom. Los resultados de las consultas se muestran debajo del mapa.',
    position: 'left',
  },
  {
    target: 'layers',
    icon: Layers,
    color: 'blue',
    title: 'Control de Capas',
    description: 'Activa o desactiva las capas del mapa: celdas, estaciones, cuencas, embalses y limites del area de estudio.',
    position: 'left',
  },
];

const STORAGE_KEY = 'drought-tour-completed';

export default function GuidedTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [onComplete]);

  const updateTargetRect = useCallback(() => {
    const current = TOUR_STEPS[step];
    if (!current) return;

    const selectors = {
      'sidebar': '[data-tour="sidebar"]',
      'historical': '[data-tour="historical"]',
      'prediction': '[data-tour="prediction"]',
      'prediction-history': '[data-tour="prediction-history"]',
      'map': '[data-tour="map"]',
      'layers': '[data-tour="layers"]',
    };

    const el = document.querySelector(selectors[current.target]);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    return () => window.removeEventListener('resize', updateTargetRect);
  }, [visible, step, updateTargetRect]);

  const handleNext = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const StepIcon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;
  const pad = 6;

  const colorClasses = {
    blue: { bg: 'from-blue-600 to-blue-700', ring: 'ring-blue-400', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'from-green-600 to-green-700', ring: 'ring-green-400', dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'from-purple-600 to-purple-700', ring: 'ring-purple-400', dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
  };
  const colors = colorClasses[current.color] || colorClasses.blue;

  // Tooltip position
  let tooltipStyle = {};
  if (targetRect) {
    if (current.position === 'right') {
      tooltipStyle = {
        top: Math.max(8, targetRect.top + targetRect.height / 2 - 80),
        left: targetRect.right + 16,
      };
    } else {
      tooltipStyle = {
        top: Math.max(8, targetRect.top + targetRect.height / 2 - 80),
        right: window.innerWidth - targetRect.left + 16,
      };
    }
  } else {
    tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="fixed inset-0 z-[10000]" onClick={handleSkip}>
      {/* Semi-transparent overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Highlight ring around target */}
      {targetRect && (
        <div
          className={`absolute ring-2 ${colors.ring} ring-offset-2 rounded-xl pointer-events-none`}
          style={{
            top: targetRect.top - pad,
            left: targetRect.left - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="absolute w-80 animate-fade-in"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className={`bg-gradient-to-r ${colors.bg} px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <StepIcon className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-sm">{current.title}</span>
            </div>
            <button onClick={handleSkip} className="text-white/70 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === step ? `${colors.dot} scale-125` : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
              <span className="text-xs text-gray-400 ml-2">{step + 1}/{TOUR_STEPS.length}</span>
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
              )}
              {step === 0 && (
                <button
                  onClick={handleSkip}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Saltar
                </button>
              )}
              <button
                onClick={handleNext}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r ${colors.bg} rounded-lg shadow-sm hover:shadow-md transition-all`}
              >
                {isLast ? 'Comenzar' : 'Siguiente'}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
