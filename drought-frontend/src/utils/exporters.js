const DEFAULT_IMAGE_WIDTH = 1400;
const DEFAULT_IMAGE_HEIGHT = 900;
const LEAFLET_BASEMAP_TILE_URL = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

function sanitizeFilename(value) {
  return String(value || 'export')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '') || 'export';
}

function triggerFileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function resolveSelectedVariable(plotData, analysisState) {
  return analysisState?.droughtIndex || analysisState?.variable || plotData?.variable || 'unknown_variable';
}

function resolveTimeInterval(plotData, analysisState) {
  if (plotData?.type === '2D') {
    if (plotData?.isInterval && plotData?.period?.start_date && plotData?.period?.end_date) {
      return `${plotData.period.start_date} -> ${plotData.period.end_date}`;
    }

    if (plotData?.date) return String(plotData.date);
    if (analysisState?.startDate) return String(analysisState.startDate);
    return 'N/A';
  }

  if (plotData?.isInterval && plotData?.period?.start_date && plotData?.period?.end_date) {
    return `${plotData.period.start_date} -> ${plotData.period.end_date}`;
  }

  const start = analysisState?.startDate || null;
  const end = analysisState?.endDate || analysisState?.startDate || null;

  if (start && end) return `${start} -> ${end}`;
  if (plotData?.date) return String(plotData.date);
  return 'N/A';
}

function resolveTimeFooterLabel(plotData) {
  if (plotData?.type === '2D' && !plotData?.isInterval) {
    return 'Fecha';
  }
  return 'Intervalo';
}

function build1DJson({ plotData, analysisState, selectedCell }) {
  const variable = resolveSelectedVariable(plotData, analysisState);
  const rows = Array.isArray(plotData?.data)
    ? plotData.data.map((entry) => ({
        Tiempo: entry?.date ?? null,
        Valor: entry?.value ?? null,
      }))
    : [];

  return {
    tipo: '1D',
    metadata: {
      identificador_celda: selectedCell?.cell_id || plotData?.location?.cell_id || 'N/A',
      variable_o_indice: variable,
      resolucion: selectedCell?.resolution || plotData?.resolution || analysisState?.spatialResolution || 'N/A',
      intervalo_tiempo: resolveTimeInterval(plotData, analysisState),
    },
    columnas: ['Tiempo', 'Valor'],
    datos: rows,
  };
}

function build2DJson({ plotData, analysisState }) {
  const variable = resolveSelectedVariable(plotData, analysisState);
  const range = plotData?.isInterval && plotData?.period?.start_date && plotData?.period?.end_date
    ? `${plotData.period.start_date} -> ${plotData.period.end_date}`
    : (plotData?.date || analysisState?.startDate || 'N/A');

  const rows = Array.isArray(plotData?.gridCells)
    ? plotData.gridCells.map((cell) => ({
        Cell_id: cell?.cell_id ?? null,
        Valor: cell?.value ?? null,
      }))
    : [];

  return {
    tipo: '2D',
    metadata: {
      variable,
      fecha_intervalo: range,
      resolucion: plotData?.resolution || analysisState?.spatialResolution || 'N/A',
    },
    columnas: ['Cell_id', 'Valor'],
    datos: rows,
  };
}

export function downloadAnalysisJson({ plotData, analysisState, selectedCell }) {
  if (!plotData) {
    throw new Error('No hay datos de analisis para guardar.');
  }

  const is2D = plotData.type === '2D';
  const payload = is2D
    ? build2DJson({ plotData, analysisState })
    : build1DJson({ plotData, analysisState, selectedCell });

  const fileBase = sanitizeFilename(`${payload.tipo}_${resolveSelectedVariable(plotData, analysisState)}_${new Date().toISOString().slice(0, 10)}`);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerFileDownload(blob, `${fileBase}.json`);

  return {
    fileName: `${fileBase}.json`,
    rows: payload.datos.length,
    type: payload.tipo,
  };
}

function drawCard(ctx, x, y, w, h, radius = 12) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawHeader(ctx, plotData) {
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px Arial';
  ctx.fillText(plotData?.title || 'Exportacion de grafico', 56, 68);

  const subtitleParts = [];
  if (plotData?.variable) subtitleParts.push(`Variable: ${plotData.variable}`);
  if (plotData?.type) subtitleParts.push(`Modo: ${plotData.type}`);
  if (plotData?.unit) subtitleParts.push(`Unidad: ${plotData.unit}`);

  ctx.fillStyle = '#475569';
  ctx.font = '20px Arial';
  ctx.fillText(subtitleParts.join(' | '), 56, 102);
}

function draw1DChart(ctx, plotData) {
  const rows = Array.isArray(plotData?.data) ? plotData.data : [];
  if (!rows.length) return;

  const chartX = 56;
  const chartY = 150;
  const chartW = 980;
  const chartH = 560;

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  drawCard(ctx, chartX, chartY, chartW, chartH, 14);

  const values = rows
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal - minVal || 1;

  ctx.strokeStyle = '#e2e8f0';
  for (let i = 0; i <= 5; i += 1) {
    const y = chartY + 24 + ((chartH - 60) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(chartX + 56, y);
    ctx.lineTo(chartX + chartW - 24, y);
    ctx.stroke();
  }

  const points = rows
    .map((item, index) => {
      const value = Number(item?.value);
      if (!Number.isFinite(value)) return null;
      const x = chartX + 56 + (index / Math.max(rows.length - 1, 1)) * (chartW - 92);
      const y = chartY + 24 + (1 - (value - minVal) / valRange) * (chartH - 60);
      return { x, y, value, date: item?.date };
    })
    .filter(Boolean);

  if (!points.length) return;

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  const first = points[0];
  const last = points[points.length - 1];

  ctx.fillStyle = '#334155';
  ctx.font = '16px Arial';
  ctx.fillText(first?.date || 'Inicio', chartX + 56, chartY + chartH - 14);
  const lastLabel = last?.date || 'Fin';
  const lastTextWidth = ctx.measureText(lastLabel).width;
  ctx.fillText(lastLabel, chartX + chartW - 24 - lastTextWidth, chartY + chartH - 14);

  ctx.font = '15px Arial';
  ctx.fillText(`Max: ${maxVal.toFixed(2)}`, chartX + 8, chartY + 30);
  ctx.fillText(`Min: ${minVal.toFixed(2)}`, chartX + 8, chartY + chartH - 30);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, 1060, 170, 290, 140, 12);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Leyenda', 1082, 202);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(1082, 220, 24, 4);
  ctx.fillStyle = '#334155';
  ctx.font = '16px Arial';
  ctx.fillText(plotData?.variable || 'Serie', 1116, 228);
  ctx.fillStyle = '#64748b';
  ctx.fillText(`Registros: ${rows.length}`, 1082, 262);
  ctx.fillText(`Unidad: ${plotData?.unit || 'N/A'}`, 1082, 286);
}

function resolveLatLon(cell) {
  if (Array.isArray(cell?.center) && cell.center.length >= 2) {
    return { lat: Number(cell.center[0]), lon: Number(cell.center[1]) };
  }

  if (Number.isFinite(Number(cell?.lat)) && Number.isFinite(Number(cell?.lon))) {
    return { lat: Number(cell.lat), lon: Number(cell.lon) };
  }

  if (Number.isFinite(Number(cell?.latitude)) && Number.isFinite(Number(cell?.longitude))) {
    return { lat: Number(cell.latitude), lon: Number(cell.longitude) };
  }

  return null;
}

function getUniqueSorted(values) {
  return [...new Set(values.map((v) => Number(v)).filter((v) => Number.isFinite(v)))].sort((a, b) => a - b);
}

function inferStep(values, fallback = 1) {
  if (values.length < 2) return fallback;
  let minDiff = Number.POSITIVE_INFINITY;

  for (let i = 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff > 0 && diff < minDiff) {
      minDiff = diff;
    }
  }

  return Number.isFinite(minDiff) ? minDiff : fallback;
}

function flattenFeatureCoordinates(geojson) {
  const features = Array.isArray(geojson?.features) ? geojson.features : [];
  const points = [];

  const pushCoords = (coords) => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))) {
      points.push([Number(coords[0]), Number(coords[1])]);
      return;
    }
    coords.forEach(pushCoords);
  };

  features.forEach((feature) => {
    pushCoords(feature?.geometry?.coordinates);
  });

  return points;
}

async function loadStudyAreaBoundary() {
  try {
    const response = await fetch(`/data/study-area.geojson?t=${Date.now()}`);
    if (!response.ok) return [];
    const geojson = await response.json();
    return flattenFeatureCoordinates(geojson);
  } catch (_error) {
    return [];
  }
}

function projectToMap(lon, lat, bounds, frame) {
  const lonRange = bounds.maxLon - bounds.minLon || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;

  const x = frame.x + frame.pad + ((lon - bounds.minLon) / lonRange) * (frame.w - frame.pad * 2);
  const y = frame.y + frame.pad + (1 - (lat - bounds.minLat) / latRange) * (frame.h - frame.pad * 2);
  return { x, y };
}

function lonToTileX(lon, zoom) {
  return ((lon + 180) / 360) * (2 ** zoom);
}

function latToTileY(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * (2 ** zoom);
}

function tileXToLon(x, zoom) {
  return (x / (2 ** zoom)) * 360 - 180;
}

function tileYToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / (2 ** zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function pickTileZoom(bounds, frame) {
  const innerW = frame.w - frame.pad * 2;
  const innerH = frame.h - frame.pad * 2;
  let bestZoom = 7;

  for (let z = 5; z <= 11; z += 1) {
    const xMin = lonToTileX(bounds.minLon, z);
    const xMax = lonToTileX(bounds.maxLon, z);
    const yMin = latToTileY(bounds.maxLat, z);
    const yMax = latToTileY(bounds.minLat, z);

    const pxW = Math.abs(xMax - xMin) * 256;
    const pxH = Math.abs(yMax - yMin) * 256;
    const tilesCount = (Math.floor(xMax) - Math.floor(xMin) + 1) * (Math.floor(yMax) - Math.floor(yMin) + 1);

    if (pxW <= innerW * 2.2 && pxH <= innerH * 2.2 && tilesCount <= 36) {
      bestZoom = z;
    }
  }

  return bestZoom;
}

async function drawLeafletBasemapTiles(ctx, bounds, frame) {
  const z = pickTileZoom(bounds, frame);
  const xMinF = lonToTileX(bounds.minLon, z);
  const xMaxF = lonToTileX(bounds.maxLon, z);
  const yMinF = latToTileY(bounds.maxLat, z);
  const yMaxF = latToTileY(bounds.minLat, z);

  const xStart = Math.floor(Math.min(xMinF, xMaxF));
  const xEnd = Math.floor(Math.max(xMinF, xMaxF));
  const yStart = Math.floor(Math.min(yMinF, yMaxF));
  const yEnd = Math.floor(Math.max(yMinF, yMaxF));

  const jobs = [];
  for (let x = xStart; x <= xEnd; x += 1) {
    for (let y = yStart; y <= yEnd; y += 1) {
      const url = LEAFLET_BASEMAP_TILE_URL
        .replace('{z}', String(z))
        .replace('{x}', String(x))
        .replace('{y}', String(y));

      jobs.push({ x, y, url });
    }
  }

  const loaded = await Promise.all(jobs.map(async (job) => {
    try {
      const image = await loadImage(job.url);
      return { ...job, image };
    } catch (_e) {
      return null;
    }
  }));

  const tiles = loaded.filter(Boolean);
  if (!tiles.length) return false;

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2);
  ctx.clip();

  tiles.forEach(({ x, y, image }) => {
    const lonLeft = tileXToLon(x, z);
    const lonRight = tileXToLon(x + 1, z);
    const latTop = tileYToLat(y, z);
    const latBottom = tileYToLat(y + 1, z);

    const pTL = projectToMap(lonLeft, latTop, bounds, frame);
    const pBR = projectToMap(lonRight, latBottom, bounds, frame);

    const drawX = Math.min(pTL.x, pBR.x);
    const drawY = Math.min(pTL.y, pBR.y);
    const drawW = Math.abs(pBR.x - pTL.x);
    const drawH = Math.abs(pBR.y - pTL.y);

    if (drawW > 0 && drawH > 0) {
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
    }
  });

  ctx.restore();
  return true;
}

function drawBasemapBackdrop(ctx, frame) {
  const gradient = ctx.createLinearGradient(frame.x, frame.y, frame.x + frame.w, frame.y + frame.h);
  gradient.addColorStop(0, '#eef4f2');
  gradient.addColorStop(1, '#e4eef6');
  ctx.fillStyle = gradient;
  ctx.fillRect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2);

  // Fallback background if web tiles are unavailable.
  ctx.save();
  ctx.fillStyle = 'rgba(168, 198, 134, 0.12)';
  ctx.beginPath();
  ctx.moveTo(frame.x + 25, frame.y + frame.h - 80);
  ctx.bezierCurveTo(frame.x + 220, frame.y + frame.h - 170, frame.x + 420, frame.y + frame.h - 110, frame.x + 560, frame.y + frame.h - 220);
  ctx.bezierCurveTo(frame.x + 660, frame.y + frame.h - 290, frame.x + 820, frame.y + frame.h - 270, frame.x + frame.w - 20, frame.y + frame.h - 340);
  ctx.lineTo(frame.x + frame.w - 20, frame.y + frame.h - 5);
  ctx.lineTo(frame.x + 25, frame.y + frame.h - 5);
  ctx.closePath();
  ctx.fill();

  // Simple hydro lines as pseudo basemap detail.
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i += 1) {
    const y = frame.y + 70 + i * 90;
    ctx.beginPath();
    ctx.moveTo(frame.x + 15, y);
    ctx.bezierCurveTo(frame.x + 220, y + 24, frame.x + 420, y - 18, frame.x + 640, y + 18);
    ctx.bezierCurveTo(frame.x + 760, y + 36, frame.x + 860, y + 14, frame.x + frame.w - 12, y + 28);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
}

function drawGraticule(ctx, bounds, frame) {
  const latLines = 5;
  const lonLines = 6;

  ctx.save();
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);

  for (let i = 0; i <= lonLines; i += 1) {
    const lon = bounds.minLon + ((bounds.maxLon - bounds.minLon) * i) / lonLines;
    const pTop = projectToMap(lon, bounds.maxLat, bounds, frame);
    const pBottom = projectToMap(lon, bounds.minLat, bounds, frame);
    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y);
    ctx.lineTo(pBottom.x, pBottom.y);
    ctx.stroke();
  }

  for (let i = 0; i <= latLines; i += 1) {
    const lat = bounds.minLat + ((bounds.maxLat - bounds.minLat) * i) / latLines;
    const pLeft = projectToMap(bounds.minLon, lat, bounds, frame);
    const pRight = projectToMap(bounds.maxLon, lat, bounds, frame);
    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Arial';
  ctx.fillText('Basemap simplificado', frame.x + 14, frame.y + 18);
  ctx.restore();
}

function drawProjectBoundary(ctx, boundaryCoords, bounds, frame) {
  if (!boundaryCoords.length) return;

  ctx.save();
  ctx.beginPath();
  boundaryCoords.forEach(([lon, lat], index) => {
    const { x, y } = projectToMap(lon, lat, bounds, frame);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();

  ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 64, 175, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('Limite del proyecto', frame.x + 14, frame.y + 36);
  ctx.restore();
}

function drawNorthArrow(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('N', x - 5, y - 14);

  ctx.beginPath();
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x - 8, y + 12);
  ctx.lineTo(x + 8, y + 12);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, y + 12);
  ctx.lineTo(x, y + 36);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawScaleBar(ctx, bounds, frame) {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonKm = Math.abs((bounds.maxLon - bounds.minLon) * 111.32 * Math.cos((midLat * Math.PI) / 180));
  if (!Number.isFinite(lonKm) || lonKm <= 0) return;

  const pxPerKm = (frame.w - frame.pad * 2) / lonKm;
  const candidatesKm = [5, 10, 20, 25, 50, 75, 100, 150, 200, 300];
  const targetPx = 140;
  let chosen = candidatesKm[0];
  for (let i = 0; i < candidatesKm.length; i += 1) {
    if (candidatesKm[i] * pxPerKm <= targetPx) {
      chosen = candidatesKm[i];
    }
  }

  const barPx = Math.max(45, chosen * pxPerKm);
  const x = frame.x + frame.w - barPx - 54;
  const y = frame.y + frame.h - 22;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.lineWidth = 1;
  drawCard(ctx, x - 12, y - 20, barPx + 48, 30, 6);

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y - 6, barPx / 2, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + barPx / 2, y - 6, barPx / 2, 6);
  ctx.strokeStyle = '#0f172a';
  ctx.strokeRect(x, y - 6, barPx, 6);

  ctx.fillStyle = '#334155';
  ctx.font = '11px Arial';
  ctx.fillText(`0`, x - 2, y + 10);
  ctx.fillText(`${Math.round(chosen / 2)} km`, x + barPx / 2 - 14, y + 10);
  ctx.fillText(`${chosen} km`, x + barPx - 10, y + 10);
  ctx.restore();
}

async function draw2DMap(ctx, plotData) {
  const cells = Array.isArray(plotData?.gridCells) ? plotData.gridCells : [];
  if (!cells.length) return;

  const points = cells
    .map((cell) => {
      const coords = resolveLatLon(cell);
      if (!coords) return null;
      return { ...coords, cell };
    })
    .filter(Boolean);

  if (!points.length) return;

  const mapX = 56;
  const mapY = 150;
  const mapW = 980;
  const mapH = 560;
  const frame = { x: mapX, y: mapY, w: mapW, h: mapH, pad: 28 };

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, mapX, mapY, mapW, mapH, 14);

  const minLon = Math.min(...points.map((p) => p.lon));
  const maxLon = Math.max(...points.map((p) => p.lon));
  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));

  const boundaryCoords = await loadStudyAreaBoundary();
  const boundaryLons = boundaryCoords.map((c) => c[0]);
  const boundaryLats = boundaryCoords.map((c) => c[1]);

  const bounds = {
    minLon: Math.min(minLon, ...(boundaryLons.length ? boundaryLons : [minLon])),
    maxLon: Math.max(maxLon, ...(boundaryLons.length ? boundaryLons : [maxLon])),
    minLat: Math.min(minLat, ...(boundaryLats.length ? boundaryLats : [minLat])),
    maxLat: Math.max(maxLat, ...(boundaryLats.length ? boundaryLats : [maxLat])),
  };

  const hasRealBasemap = await drawLeafletBasemapTiles(ctx, bounds, frame);
  if (!hasRealBasemap) {
    drawBasemapBackdrop(ctx, frame);
  }

  drawGraticule(ctx, bounds, frame);
  drawProjectBoundary(ctx, boundaryCoords, bounds, frame);

  const lonRange = bounds.maxLon - bounds.minLon || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;

  const uniqueLons = getUniqueSorted(points.map((p) => p.lon));
  const uniqueLats = getUniqueSorted(points.map((p) => p.lat));
  const lonStep = inferStep(uniqueLons, Number(plotData?.resolution) || lonRange / 20 || 0.1);
  const latStep = inferStep(uniqueLats, Number(plotData?.resolution) || latRange / 20 || 0.1);

  const cellWidth = Math.max(5, ((lonStep / lonRange) * (mapW - 56)) * 0.92);
  const cellHeight = Math.max(5, ((latStep / latRange) * (mapH - 56)) * 0.92);

  // Render as filled cells to resemble the true gridded map export.
  ctx.save();
  ctx.globalAlpha = 0.58;
  points.forEach((point) => {
    const { x, y } = projectToMap(point.lon, point.lat, bounds, frame);

    const left = x - cellWidth / 2;
    const top = y - cellHeight / 2;

    ctx.fillStyle = point.cell?.color || '#2563eb';
    ctx.fillRect(left, top, cellWidth, cellHeight);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(left, top, cellWidth, cellHeight);
  });
  ctx.restore();

  drawNorthArrow(ctx, mapX + mapW - 36, mapY + 42);
  drawScaleBar(ctx, bounds, frame);

  ctx.fillStyle = '#334155';
  ctx.font = '15px Arial';
  ctx.fillText(`Celdas renderizadas: ${points.length}`, mapX + 24, mapY + mapH - 20);

  const legendEntries = [];
  const seen = new Set();
  cells.forEach((cell) => {
    if (!cell?.category || !cell?.color) return;
    if (seen.has(cell.category)) return;
    seen.add(cell.category);
    legendEntries.push({
      label: cell.category,
      color: cell.color,
      severity: Number.isFinite(Number(cell.severity)) ? Number(cell.severity) : 99,
    });
  });

  legendEntries.sort((a, b) => a.severity - b.severity);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, 1060, 170, 290, 380, 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Leyenda', 1082, 202);

  if (!legendEntries.length) {
    const values = cells
      .map((cell) => Number(cell?.value))
      .filter((value) => Number.isFinite(value));

    const minVal = values.length ? Math.min(...values) : null;
    const maxVal = values.length ? Math.max(...values) : null;

    ctx.fillStyle = '#334155';
    ctx.font = '15px Arial';
    ctx.fillText('Escala continua', 1082, 236);
    ctx.fillText(`Min: ${minVal?.toFixed(2) ?? 'N/A'}`, 1082, 262);
    ctx.fillText(`Max: ${maxVal?.toFixed(2) ?? 'N/A'}`, 1082, 286);
    ctx.fillText(`Res: ${plotData?.resolution || 'N/A'}°`, 1082, 320);
    return;
  }

  let offsetY = 230;
  legendEntries.slice(0, 12).forEach((entry) => {
    ctx.fillStyle = entry.color;
    ctx.fillRect(1082, offsetY, 14, 14);
    ctx.fillStyle = '#334155';
    ctx.font = '14px Arial';
    ctx.fillText(entry.label, 1104, offsetY + 12);
    offsetY += 24;
  });

  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial';
  ctx.fillText(`Res: ${plotData?.resolution || 'N/A'}°`, 1082, 528);
}

export async function downloadAnalysisImage({ plotData, analysisState }) {
  if (!plotData) {
    throw new Error('No hay datos de analisis para exportar imagen.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = DEFAULT_IMAGE_WIDTH;
  canvas.height = DEFAULT_IMAGE_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto del canvas.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawHeader(ctx, plotData);

  if (plotData.type === '2D') {
    await draw2DMap(ctx, plotData);
  } else {
    draw1DChart(ctx, plotData);
  }

  const footer = `Generado: ${new Date().toLocaleString()} | ${resolveTimeFooterLabel(plotData)}: ${resolveTimeInterval(plotData, analysisState)}`;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px Arial';
  ctx.fillText(footer, 56, 860);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('No se pudo generar la imagen PNG.');
  }

  const variable = resolveSelectedVariable(plotData, analysisState);
  const fileBase = sanitizeFilename(`grafico_${plotData.type || 'analysis'}_${variable}_${new Date().toISOString().slice(0, 10)}`);
  triggerFileDownload(blob, `${fileBase}.png`);

  return {
    fileName: `${fileBase}.png`,
    type: plotData.type || 'analysis',
  };
}
