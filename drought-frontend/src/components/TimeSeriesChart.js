'use client';

import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import './TimeSeriesChart.css';
import { prepareTimeSeriesData, getOptimalThreshold } from '@/utils/downsampling';
import { ZoomIn, Maximize2, Move } from 'lucide-react';

/**
 * High-performance time series chart using uPlot
 * Optimized for large datasets (50K+ points) with minimal performance impact
 *
 * Props:
 *   data        - array of objects containing { [xKey]:..., [dataKey]:... }
 *   xKey        - key name for x axis (default 'date')
 *   dataKey     - key name for y values (default 'value')
 *   type        - 'line' or 'area' (default 'line')
 *   width       - width for chart (default '100%')
 *   height      - height in pixels (default 300)
 *   stroke      - color of line/area border (default '#2563eb')
 *   fill        - fill color when type='area' (default '#2563eb33')
 *   maxPoints   - maximum points to render (auto-downsamples if exceeded, default: 5000)
 *   showLegend  - show legend (default: false)
 *   title       - chart title (default: '')
 *   yLabel      - y-axis label (default: '')
 */
export default function TimeSeriesChart({
  data = [],
  xKey = 'date',
  dataKey = 'value',
  type = 'line',
  width = '100%',
  height = 300,
  stroke = '#2563eb',
  fill = '#2563eb33',
  maxPoints = 5000,
  showLegend = false,
  title = '',
  yLabel = '',
}) {
  const chartRef = useRef(null);
  const plotInstance = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!chartRef.current) return;

    // Get container width
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(chartRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chartRef.current || !data.length || !containerWidth) return;

    // Prepare data with optimal downsampling
    const threshold = getOptimalThreshold(data.length, containerWidth);
    const [timestamps, values] = prepareTimeSeriesData(
      data,
      xKey,
      dataKey,
      Math.min(maxPoints, threshold)
    );

    // uPlot options
    const opts = {
      width: containerWidth,
      height: height,
      title: title,
      tzDate: ts => new Date(ts * 1000),
      plugins: [],
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          label: 'Tiempo',
          stroke: '#9ca3af',
          grid: { show: true, stroke: '#e5e7eb', width: 1 },
          ticks: { show: true, stroke: '#e5e7eb', width: 1 },
          font: '12px system-ui, -apple-system, sans-serif',
          values: (self, ticks) => ticks.map(val => {
            const date = new Date(val * 1000);
            return date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: data.length > 365 ? 'numeric' : undefined,
            });
          }),
        },
        {
          stroke: '#9ca3af',
          label: yLabel,
          labelFont: '14px system-ui, -apple-system, sans-serif',
          space: 180,
          grid: { show: true, stroke: '#e5e7eb', width: 1 },
          ticks: { show: true, stroke: '#e5e7eb', width: 1 },
          font: '12px system-ui, -apple-system, sans-serif',
        },
      ],
      series: [
        {
          // X values (time)
          label: 'Date',
        },
        {
          // Y values
          label: yLabel || dataKey,
          stroke: stroke,
          width: 2,
          fill: type === 'area' ? fill : undefined,
          points: {
            show: data.length < 100,
            size: 4,
          },
          spanGaps: false,
        },
      ],
      legend: {
        show: showLegend,
      },
      cursor: {
        lock: true,
        focus: {
          prox: 16,
        },
        sync: {
          key: 'drought-charts',
        },
        drag: {
          x: true,
          y: false,
        },
      },
      hooks: {
        setScale: [
          (u) => {
            const xMin = u.scales.x.min;
            const xMax = u.scales.x.max;
            const dataMin = Math.min(...timestamps);
            const dataMax = Math.max(...timestamps);
            const isCurrentlyZoomed = (xMin > dataMin || xMax < dataMax);
            setIsZoomed(isCurrentlyZoomed);
          },
        ],
      },
    };

    // Destroy previous instance
    if (plotInstance.current) {
      plotInstance.current.destroy();
    }

    // Create new plot
    const plotData = [timestamps, values];
    plotInstance.current = new uPlot(opts, plotData, chartRef.current);

    return () => {
      if (plotInstance.current) {
        plotInstance.current.destroy();
        plotInstance.current = null;
      }
    };
  }, [data, xKey, dataKey, type, stroke, fill, height, containerWidth, maxPoints, showLegend, title, yLabel]);

  // Reset zoom function
  const handleResetZoom = () => {
    if (plotInstance.current) {
      const timestamps = plotInstance.current.data[0];
      const min = Math.min(...timestamps);
      const max = Math.max(...timestamps);
      plotInstance.current.setScale('x', { min, max });
      setIsZoomed(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Chart Controls Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {isZoomed && (
          <button
            onClick={handleResetZoom}
            className="group flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            title="Resetear zoom - Ver toda la gráfica"
          >
            <Maximize2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Vista Completa</span>
          </button>
        )}

        <div className="flex items-center gap-1 px-2 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 dark:border-gray-600">
          <Move className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Arrastra para zoom</span>
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={chartRef}
        className="w-full"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
        }}
      />

      {/* Data Info Footer */}
      {data.length > 0 && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {data.length.toLocaleString()} puntos
            </span>
            {data.length > maxPoints && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                Optimizado a {maxPoints.toLocaleString()}
              </span>
            )}
          </div>
          {isZoomed && (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              <ZoomIn className="w-3 h-3" />
              Zoom activo
            </span>
          )}
        </div>
      )}
    </div>
  );
}