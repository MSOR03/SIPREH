'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Prediction Time Series Chart with IQR bands.
 * Uses Canvas 2D for rendering (no external dependency).
 *
 * Props:
 *   data: Array of { horizon, date, value, q1, q3, iqr_min, iqr_max }
 *   title: string
 *   yLabel: string
 *   height: number (px)
 */
export default function PredictionTimeSeriesChart({ data = [], title = '', yLabel = 'Valor', height = 340 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 600, h: height });
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Responsive
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [height]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const dpr = window.devicePixelRatio || 1;
    const W = dims.w;
    const H = dims.h;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Colors
    const textColor = isDark ? '#d1d5db' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const valueStroke = '#10b981';
    const iqrFill = 'rgba(16, 185, 129, 0.15)';
    const iqrOuterFill = 'rgba(16, 185, 129, 0.07)';
    const q1q3Fill = 'rgba(16, 185, 129, 0.30)';

    // Margins
    const ml = 60, mr = 20, mt = 40, mb = 50;
    const pw = W - ml - mr;
    const ph = H - mt - mb;

    // Data ranges
    const allVals = data.flatMap(d => [d.value, d.q1, d.q3, d.iqr_min, d.iqr_max].filter(v => v != null));
    const yMin = Math.min(...allVals) - 0.2;
    const yMax = Math.max(...allVals) + 0.2;

    const xScale = (i) => ml + (i / (data.length - 1 || 1)) * pw;
    const yScale = (v) => mt + (1 - (v - yMin) / (yMax - yMin || 1)) * ph;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Title
    ctx.fillStyle = textColor;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, 22);

    // Y grid + labels
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + (i / yTicks) * (yMax - yMin);
      const y = yScale(v);
      ctx.fillStyle = textColor;
      ctx.fillText(v.toFixed(1), ml - 8, y + 4);
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.5;
      ctx.moveTo(ml, y);
      ctx.lineTo(W - mr, y);
      ctx.stroke();
    }

    // Y label
    ctx.save();
    ctx.translate(14, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = textColor;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // X axis labels
    ctx.textAlign = 'center';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = textColor;
    data.forEach((d, i) => {
      const x = xScale(i);
      ctx.fillText(`H${d.horizon}`, x, H - mb + 18);
      // Tick mark
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.moveTo(x, mt);
      ctx.lineTo(x, mt + ph);
      ctx.stroke();
    });

    // Helper: draw filled polygon between two series
    const fillBand = (upperKey, lowerKey, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      const pts = data.filter(d => d[upperKey] != null && d[lowerKey] != null);
      if (pts.length < 2) return;
      // upper line forward
      pts.forEach((d, i) => {
        const idx = data.indexOf(d);
        const x = xScale(idx);
        const y = yScale(d[upperKey]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      // lower line backward
      for (let i = pts.length - 1; i >= 0; i--) {
        const d = pts[i];
        const idx = data.indexOf(d);
        const x = xScale(idx);
        const y = yScale(d[lowerKey]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };

    // Draw bands: outer first, then inner
    fillBand('iqr_max', 'iqr_min', iqrOuterFill);
    fillBand('q3', 'q1', q1q3Fill);

    // Draw IQR boundary lines (dashed)
    const drawDashedLine = (key, color, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash(dash);
      ctx.beginPath();
      data.forEach((d, i) => {
        if (d[key] == null) return;
        const x = xScale(i);
        const y = yScale(d[key]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawDashedLine('iqr_max', 'rgba(16,185,129,0.3)', [4, 4]);
    drawDashedLine('iqr_min', 'rgba(16,185,129,0.3)', [4, 4]);
    drawDashedLine('q3', 'rgba(16,185,129,0.5)', [6, 3]);
    drawDashedLine('q1', 'rgba(16,185,129,0.5)', [6, 3]);

    // Main value line
    ctx.strokeStyle = valueStroke;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      if (d.value == null) return;
      const x = xScale(i);
      const y = yScale(d.value);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Value dots
    data.forEach((d, i) => {
      if (d.value == null) return;
      const x = xScale(i);
      const y = yScale(d.value);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = valueStroke;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#1f2937' : '#ffffff';
      ctx.fill();
    });

    // Legend
    const legendY = H - 12;
    const legendItems = [
      { label: 'Valor', color: valueStroke, dash: [] },
      { label: 'Q1-Q3 (IQR)', color: 'rgba(16,185,129,0.5)', dash: [6, 3] },
      { label: 'IQR Min-Max', color: 'rgba(16,185,129,0.3)', dash: [4, 4] },
    ];
    ctx.font = '10px system-ui, sans-serif';
    let lx = ml;
    legendItems.forEach(({ label, color, dash }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(lx, legendY);
      ctx.lineTo(lx + 20, legendY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = textColor;
      ctx.textAlign = 'left';
      ctx.fillText(label, lx + 24, legendY + 3);
      lx += ctx.measureText(label).width + 44;
    });

  }, [data, dims, isDark, title, yLabel]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Sin datos de prediccion
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} className="w-full" />
    </div>
  );
}
