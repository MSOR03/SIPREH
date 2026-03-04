'use client';

import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import './TimeSeriesChart.css';
import { prepareTimeSeriesData, getOptimalThreshold } from '@/utils/downsampling';

/**
 * Advanced high-performance time series chart with custom tooltips and zoom
 * Perfect for datasets with 50K+ points
 *
 * Features:
 * - Auto-downsampling with LTTB algorithm
 * - Interactive zoom and pan
 * - Custom tooltips with formatted values
 * - Multi-series support
 * - Dark mode compatible
 * - Responsive
 *
 * Props:
 *   data          - array of objects { [xKey]: date, [dataKey]: value, ... }
 *   xKey          - x-axis key (default: 'date')
 *   dataKey       - y-axis key or array of keys for multiple series
 *   height        - chart height in pixels (default: 300)
 *   stroke        - line color or array of colors
 *   fill          - fill color for area charts or array
 *   type          - 'line' or 'area' (default: 'line')
 *   maxPoints     - max points before downsampling (default: 5000)
 *   title         - chart title
 *   yLabel        - y-axis label
 *   tooltipFormat - function to format tooltip values
 *   showZoom      - enable zoom/pan (default: true)
 *   showTooltip   - show custom tooltip (default: true)
 */
export default function AdvancedTimeSeriesChart({
  data = [],
  xKey = 'date',
  dataKey = 'value',
  height = 300,
  stroke = '#2563eb',
  fill = '#2563eb33',
  type = 'line',
  maxPoints = 5000,
  title = '',
  yLabel = '',
  tooltipFormat = (val) => val?.toFixed(2) ?? 'N/A',
  showZoom = true,
  showTooltip = true,
}) {
  const chartRef = useRef(null);
  const plotInstance = useRef(null);
  const tooltipRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Support multiple series
  const dataKeys = Array.isArray(dataKey) ? dataKey : [dataKey];
  const colors = Array.isArray(stroke) ? stroke : [stroke];
  const fills = Array.isArray(fill) ? fill : [fill];

  useEffect(() => {
    if (!chartRef.current) return;

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

    // Prepare data for all series
    const threshold = getOptimalThreshold(data.length, containerWidth);
    const targetPoints = Math.min(maxPoints, threshold);
    
    const [timestamps] = prepareTimeSeriesData(data, xKey, dataKeys[0], targetPoints);
    const allSeries = dataKeys.map(key => 
      prepareTimeSeriesData(data, xKey, key, targetPoints)[1]
    );

    const plotData = [timestamps, ...allSeries];

    // Tooltip plugin
    const tooltipPlugin = () => {
      let tooltip = null;

      function init(u) {
        if (!showTooltip) return;
        
        tooltip = tooltipRef.current;
        if (!tooltip) {
          tooltip = document.createElement('div');
          tooltip.className = 'u-tooltip';
          tooltip.style.display = 'none';
          chartRef.current.appendChild(tooltip);
          tooltipRef.current = tooltip;
        }
      }

      function setCursor(u) {
        if (!showTooltip || !tooltip) return;
        
        const { idx } = u.cursor;
        
        if (idx === null || idx === undefined) {
          tooltip.style.display = 'none';
          return;
        }

        const date = new Date(u.data[0][idx] * 1000);
        const dateStr = date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: data.length < 365 ? '2-digit' : undefined,
          minute: data.length < 365 ? '2-digit' : undefined,
        });

        let html = `<div class="u-tooltip-date">${dateStr}</div>`;
        
        dataKeys.forEach((key, i) => {
          const value = u.data[i + 1][idx];
          const color = colors[i] || colors[0];
          html += `
            <div class="u-tooltip-value">
              <span class="u-tooltip-marker" style="background-color: ${color}"></span>
              <span>${key}: <strong>${tooltipFormat(value)}</strong></span>
            </div>
          `;
        });

        tooltip.innerHTML = html;

        const left = u.cursor.left;
        const top = u.cursor.top;

        tooltip.style.display = 'block';
        tooltip.style.left = (left + 15) + 'px';
        tooltip.style.top = (top - 10) + 'px';

        // Adjust if tooltip goes off screen
        const rect = tooltip.getBoundingClientRect();
        const chartRect = chartRef.current.getBoundingClientRect();
        
        if (rect.right > chartRect.right) {
          tooltip.style.left = (left - rect.width - 15) + 'px';
        }
        if (rect.bottom > chartRect.bottom) {
          tooltip.style.top = (top - rect.height + 10) + 'px';
        }
      }

      function destroy() {
        if (tooltip && tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }

      return {
        hooks: {
          init,
          setCursor,
          destroy,
        },
      };
    };

    // Chart options
    const opts = {
      width: containerWidth,
      height,
      title,
      tzDate: ts => new Date(ts * 1000),
      plugins: [tooltipPlugin()],
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: '#9ca3af',
          grid: { show: true, stroke: '#e5e7eb', width: 1 },
          ticks: { show: true, stroke: '#e5e7eb', width: 1 },
          font: '12px system-ui',
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
          labelFont: '14px system-ui',
          grid: { show: true, stroke: '#e5e7eb', width: 1 },
          ticks: { show: true, stroke: '#e5e7eb', width: 1 },
          font: '12px system-ui',
        },
      ],
      series: [
        { label: 'Time' },
        ...dataKeys.map((key, i) => ({
          label: key,
          stroke: colors[i] || colors[0],
          width: 2,
          fill: type === 'area' ? (fills[i] || fills[0]) : undefined,
          points: { show: data.length < 100, size: 4 },
          spanGaps: false,
        })),
      ],
      legend: { show: dataKeys.length > 1 },
      cursor: {
        lock: true,
        focus: { prox: 16 },
        drag: showZoom ? { x: true, y: false } : undefined,
      },
    };

    // Cleanup previous instance
    if (plotInstance.current) {
      plotInstance.current.destroy();
    }

    // Create new chart
    plotInstance.current = new uPlot(opts, plotData, chartRef.current);

    return () => {
      if (plotInstance.current) {
        plotInstance.current.destroy();
        plotInstance.current = null;
      }
    };
  }, [data, xKey, dataKeys, colors, fills, type, height, containerWidth, maxPoints, title, yLabel, tooltipFormat, showZoom, showTooltip]);

  return (
    <div className="relative w-full">
      <div ref={chartRef} className="w-full" />
      {showZoom && data.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Drag to zoom • Double-click to reset
        </div>
      )}
    </div>
  );
}
