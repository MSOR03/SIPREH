'use client';

import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';

/**
 * Modal for AI-generated drought prediction summary.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   loading: boolean
 *   summary: string | null
 *   index: string
 *   type: '1d' | '2d'
 */
export default function AiSummaryModal({ open, onClose, loading, summary, index, type }) {
  const backdropRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-2xl border border-green-200 dark:border-green-800 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Resumen IA
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {type === '1d' ? 'Analisis temporal' : 'Analisis espacial'} - {index}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[120px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <div className="w-10 h-10 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                Generando resumen con IA...
              </p>
            </div>
          ) : summary ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {summary}
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <Sparkles className="w-3 h-3 text-green-500" />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  Generado con Llama 3.1-8B via Groq
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              No se pudo generar el resumen.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
