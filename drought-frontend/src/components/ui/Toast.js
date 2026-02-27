'use client';

import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const toastVariants = {
  success: {
    bg: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30',
    border: 'border-green-500/50 dark:border-green-400/50',
    icon: CheckCircle,
    iconColor: 'text-green-600 dark:text-green-400',
    progressBar: 'bg-green-500 dark:bg-green-400',
  },
  error: {
    bg: 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30',
    border: 'border-red-500/50 dark:border-red-400/50',
    icon: AlertCircle,
    iconColor: 'text-red-600 dark:text-red-400',
    progressBar: 'bg-red-500 dark:bg-red-400',
  },
  warning: {
    bg: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30',
    border: 'border-amber-500/50 dark:border-amber-400/50',
    icon: AlertTriangle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    progressBar: 'bg-amber-500 dark:bg-amber-400',
  },
  info: {
    bg: 'bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30',
    border: 'border-blue-500/50 dark:border-blue-400/50',
    icon: Info,
    iconColor: 'text-blue-600 dark:text-blue-400',
    progressBar: 'bg-blue-500 dark:bg-blue-400',
  },
};

export default function Toast({ 
  id, 
  title, 
  message, 
  type = 'info', 
  duration = 4000,
  onClose 
}) {
  const variant = toastVariants[type];
  const Icon = variant.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, id, onClose]);

  return (
    <div
      className={`relative flex items-start gap-3 ${variant.bg} ${variant.border} border-l-4 rounded-lg shadow-2xl backdrop-blur-sm p-4 min-w-[320px] max-w-md animate-slide-in-right overflow-hidden`}
    >
      {/* Progress bar */}
      <div 
        className={`absolute bottom-0 left-0 h-1 ${variant.progressBar} animate-shrink-width`}
        style={{ animationDuration: `${duration}ms` }}
      />

      {/* Icon */}
      <div className={`flex-shrink-0 ${variant.iconColor}`}>
        <Icon className="w-6 h-6" strokeWidth={2} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
            {title}
          </h4>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {message}
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors group"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200" />
      </button>
    </div>
  );
}
