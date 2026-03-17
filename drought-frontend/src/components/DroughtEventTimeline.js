'use client';

/**
 * DroughtEventTimeline - renderiza barras horizontales coloreadas para eventos
 * de sequía que tienen duración (Fecha_inicial -> Fecha_Final).
 *
 * Se muestra debajo del chart principal de series de tiempo.
 */
export default function DroughtEventTimeline({ data, height = 60 }) {
  // Filtrar solo eventos que tienen fecha_final válida
  const events = (data || []).filter(d => d.fecha_final && d.fecha_final !== 'None' && d.fecha_final !== 'NaT');

  if (events.length === 0) return null;

  // Calcular rango temporal
  const timestamps = [];
  events.forEach(e => {
    timestamps.push(new Date(e.date).getTime());
    timestamps.push(new Date(e.fecha_final).getTime());
  });
  const minDate = Math.min(...timestamps);
  const maxDate = Math.max(...timestamps);
  const range = maxDate - minDate;

  if (range <= 0) return null;

  return (
    <div className="mt-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
        Eventos de sequía (duración)
        <span className="font-normal text-gray-400 dark:text-gray-500 ml-2">
          {events.length} evento{events.length !== 1 ? 's' : ''}
        </span>
      </p>
      <div className="relative overflow-hidden" style={{ height }}>
        {events.map((event, i) => {
          const startPx = ((new Date(event.date).getTime() - minDate) / range) * 100;
          const endPx = ((new Date(event.fecha_final).getTime() - minDate) / range) * 100;
          const widthPx = Math.max(endPx - startPx, 0.5);
          const duracion = event.duracion != null ? `${event.duracion} días` : '';
          const tooltipText = `${event.category || 'Evento'}: ${event.date} → ${event.fecha_final}${duracion ? ` (${duracion})` : ''}`;

          return (
            <div
              key={i}
              className="absolute rounded-sm cursor-pointer hover:opacity-100 transition-opacity"
              style={{
                left: `${startPx}%`,
                width: `${widthPx}%`,
                top: '15%',
                height: '70%',
                backgroundColor: event.color || '#ef4444',
                opacity: 0.8,
                minWidth: '2px',
              }}
              title={tooltipText}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
        <span>{new Date(minDate).toISOString().split('T')[0]}</span>
        <span>{new Date(maxDate).toISOString().split('T')[0]}</span>
      </div>
    </div>
  );
}
