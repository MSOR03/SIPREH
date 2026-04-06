const DEFAULT_IMAGE_WIDTH = 1800;
const DEFAULT_IMAGE_HEIGHT = 1100;
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
  // Prediction types: describe the scale/horizon instead of a date range
  if (plotData?.type?.startsWith('prediction')) {
    const meta = plotData?.predictionMeta;
    if (meta) {
      return `Escala ${meta.scale || 'N/A'}m - Horizontes 1-12`;
    }
    return 'N/A';
  }

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
  const isPrediction = plotData?.type?.startsWith('prediction');
  const rows = Array.isArray(plotData?.data)
    ? plotData.data.map((entry) => ({
        Tiempo: entry?.date ?? null,
        Valor: entry?.value ?? null,
      }))
    : [];

  return {
    tipo: '1D',
    metadata: {
      identificador_celda: isPrediction
        ? (plotData?.predictionMeta?.cellId || 'N/A')
        : (selectedCell?.cell_id || plotData?.location?.cell_id || plotData?.location?.codigo || 'N/A'),
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
  const isPrediction = plotData?.type === 'prediction-2d' || plotData?.type === 'prediction-history-2d';
  const range = isPrediction
    ? (plotData?.predictionMeta
      ? `${plotData.predictionMeta.index || variable} escala ${plotData.predictionMeta.scale || 'N/A'}m horizonte ${plotData.predictionMeta.horizon || 'N/A'}`
      : 'N/A')
    : (plotData?.isInterval && plotData?.period?.start_date && plotData?.period?.end_date
      ? `${plotData.period.start_date} -> ${plotData.period.end_date}`
      : (plotData?.date || analysisState?.startDate || 'N/A'));

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

export async function downloadAnalysisImage({ plotData, analysisState }) {
  const canvas = document.createElement('canvas');
  canvas.width = DEFAULT_IMAGE_WIDTH;
  canvas.height = DEFAULT_IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');

  ctx.save();
ctx.globalAlpha = 1.0;
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.restore();

  const is2D = plotData.type === '2D' || plotData.type === 'prediction-2d' || plotData.type === 'prediction-history-2d';

  // Dibuja el contenido según el tipo de datos
  if (is2D) {
    // Dibuja el mapa 2D completo
    await draw2DMap(ctx, plotData, analysisState);
  } else {
    // Dibuja el encabezado y el gráfico 1D
    drawHeader(ctx, plotData);
    draw1DChart(ctx, plotData);
  }

  // Convierte el canvas a blob PNG y descarga
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const fileName = 'export.png';
      triggerFileDownload(blob, fileName);
      resolve({
        fileName,
        rows: is2D
          ? (Array.isArray(plotData?.gridCells) ? plotData.gridCells.length : 0)
          : (Array.isArray(plotData?.data) ? plotData.data.length : 0),
        type: 'image',
      });
    }, 'image/png');
  });
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
  if (plotData?.type === '2D') {
    return;
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px Arial';
  ctx.fillText(plotData?.title || 'Exportacion de grafico', 56, 68);
} // <-- Cierra aquí la función

// Ahora define draw2DInstitutionalPanel fuera
async function draw2DInstitutionalPanel(ctx, plotData)  {
  const x = 56;
  const y = 8;
  const w = DEFAULT_IMAGE_WIDTH - 112;
  const h = 96;

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#1d4ed8');
  grad.addColorStop(0.55, '#1e40af');
  grad.addColorStop(1, '#1e3a8a');

  ctx.save();
  ctx.fillStyle = grad;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  drawCard(ctx, x, y, w, h, 14);

  const primaryLogo = '/logos/Logo_Dashboard_Diurno.png';
  const entityLogos = ['/logos/entidad1.png', '/logos/entidad2.png', '/logos/entidad3.png'];

  // Área grande para el logo a la izquierda
  const logoAreaX = x + 6; // pequeño margen izquierdo
  const logoAreaY = y + 8;
  const logoAreaW = Math.floor(w * 0.33);
  const logoAreaH = h - 16;

  // Variables para textos
  const textX = logoAreaX + logoAreaW + 16;
  const textMaxW = w - (logoAreaW + 32 + 180);

  // --- Cargar el logo y calcular el área exacta ---
  let mainW = 0, mainH = 0, mainX = 0, mainY = 0;
  try {
    const mainImg = await loadImage(primaryLogo);
    const fit = Math.min((logoAreaW - 16) / mainImg.width, (logoAreaH - 16) / mainImg.height);
    mainW = mainImg.width * fit;
    mainH = mainImg.height * fit;
    mainX = logoAreaX + (logoAreaW - mainW) / 2;
    mainY = logoAreaY + (logoAreaH - mainH) / 2;
    // Dibuja el recuadro blanco ajustado al logo (+margen)
    const margin = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = 'rgba(15,23,42,0.14)';
    drawCard(ctx, logoAreaX, mainY - margin, mainW + margin * 2, mainH + margin * 2, 10);
    ctx.drawImage(mainImg, logoAreaX + margin, mainY, mainW, mainH);

    // Calcula el borde derecho del fondo blanco
    const logoRight = logoAreaX + margin + mainW + margin;
    const textX = logoRight + 12; // 12px de espacio extra

    // Ahora el texto nunca se sobrepone al logo
    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 44px Arial';
    ctx.fillText('SIPREH', textX, y + 44, textMaxW);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Sistema Integrado de Prediccion y Monitoreo de Sequias', textX, y + 65, textMaxW);

    ctx.fillStyle = '#dbeafe';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Bogota, Colombia', textX, y + 85, textMaxW);

  } catch (e) {
    // Manejo de error si el logo principal no carga
  }

  // --- Logos de entidades alineados a la derecha, ocupando el alto disponible ---
  const logoGap = 16;
  const logoMaxHeight = h - 24; // Alto máximo disponible para los logos (ajusta el margen si lo deseas)

  // Carga y escala los logos
  let loadedEntityLogos = await Promise.all(entityLogos.map(async (src) => {
    try {
      const img = await loadImage(src);
      const scale = logoMaxHeight / img.height;
      return {
        img,
        width: img.width * scale,
        height: logoMaxHeight,
      };
    } catch {
      return null;
    }
  }));

  loadedEntityLogos = loadedEntityLogos.filter(Boolean);

  // Calcula el ancho total ocupado por los logos y los gaps
  const totalLogosWidth = loadedEntityLogos.reduce((sum, logo) => sum + logo.width, 0) + logoGap * (loadedEntityLogos.length - 1);
  const iconsStartX = x + w - 12 - totalLogosWidth; // margen derecho de 12px
  const iconsY = y + (h - logoMaxHeight) / 2;

  // Dibuja los logos alineados a la derecha, ocupando el alto disponible y manteniendo su proporción
  let iconX = iconsStartX;
  for (const logo of loadedEntityLogos) {
    ctx.drawImage(logo.img, iconX, iconsY, logo.width, logo.height);
    iconX += logo.width + logoGap;
  }

  ctx.restore();
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

  const innerW = frame.w - frame.pad * 2;
  const innerH = frame.h - frame.pad * 2;

  const scaleX = innerW / lonRange;
  const scaleY = innerH / latRange;
  const scale = Math.min(scaleX, scaleY);

  const drawW = lonRange * scale;
  const drawH = latRange * scale;

  const offsetX = frame.x + frame.pad + (innerW - drawW) / 2;
  const offsetY = frame.y + frame.pad + (innerH - drawH) / 2;

  return {
    x: offsetX + (lon - bounds.minLon) * scale,
    y: offsetY + (bounds.maxLat - lat) * scale,
  };
}
function projectToMapCover(lon, lat, bounds, frame) {
const lonRange = bounds.maxLon - bounds.minLon || 1;
const latRange = bounds.maxLat - bounds.minLat || 1;

const innerW = frame.w - frame.pad * 2;
const innerH = frame.h - frame.pad * 2;

const scaleX = innerW / lonRange;
const scaleY = innerH / latRange;
const scale = Math.max(scaleX, scaleY);

const drawW = lonRange * scale;
const drawH = latRange * scale;

const offsetX = frame.x + frame.pad + (innerW - drawW) / 2;
const offsetY = frame.y + frame.pad + (innerH - drawH) / 2;

return {
x: offsetX + (lon - bounds.minLon) * scale,
y: offsetY + (bounds.maxLat - lat) * scale,
};
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

    const pTL = projectToMapCover(lonLeft, latTop, bounds, frame);
    const pBR = projectToMapCover(lonRight, latBottom, bounds, frame);

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

function drawBasemapBackdrop(ctx, frame, bounds) {
  const insetX = 0;  // margen horizontal interno (ajusta este valor)
  const insetY = 0;  // margen vertical interno

  const x = frame.x + insetX;
  const y = frame.y + insetY;
  const w = Math.max(0, frame.w - insetX * 2);
  const h = Math.max(0, frame.h - insetY * 2);

  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, '#eef4f2');
  gradient.addColorStop(1, '#e4eef6');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  // Fallback background if web tiles are unavailable.
  ctx.save();
  ctx.fillStyle = 'rgba(168, 198, 134, 0.12)';
  ctx.beginPath();
  ctx.moveTo(x + 25, y + h - 80);
  ctx.bezierCurveTo(x + 220, y + h - 170, x + 420, y + h - 110, x + 560, y + h - 220);
  ctx.bezierCurveTo(x + 660, y + h - 290, x + 820, y + h - 270, x + w - 20, y + h - 340);
  ctx.lineTo(x + w - 20, y + h - 5);
  ctx.lineTo(x + 25, y + h - 5);
  ctx.closePath();
  ctx.fill();

  // Simple hydro lines as pseudo basemap detail.
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i += 1) {
    const yy = y + 70 + i * 90;
    ctx.beginPath();
    ctx.moveTo(x + 15, yy);
    ctx.bezierCurveTo(x + 220, yy + 24, x + 420, yy - 18, x + 640, yy + 18);
    ctx.bezierCurveTo(x + 760, yy + 36, x + 860, yy + 14, x + w - 12, yy + 28);
    ctx.stroke();
  }
  ctx.restore();

  // Dibuja la grilla sobre el fondo
  if (bounds) {
    drawGraticule(ctx, bounds, frame);
  }
}

function drawGraticule(ctx, bounds, frame) {
  const latLines = 5;
  const lonLines = 6;
  const margin = 20; // píxeles para sobresalir fuera del frame

  const formatLon = (lon) => `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  const formatLat = (lat) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;

  ctx.save();
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial';

  // Líneas de longitud (verticales)
  for (let i = 0; i <= lonLines; i += 1) {
    const lon = bounds.minLon + ((bounds.maxLon - bounds.minLon) * i) / lonLines;
    const pTop = projectToMap(lon, bounds.maxLat, bounds, frame);
    const pBottom = projectToMap(lon, bounds.minLat, bounds, frame);

    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y - margin);
    ctx.lineTo(pBottom.x, pBottom.y + margin);
    ctx.stroke();

    // Etiqueta SOLO fuera del mapa (abajo, horizontal)
    ctx.fillText(formatLon(lon), pBottom.x - 18, frame.y + frame.h + margin + 12);
  }

  // Líneas de latitud (horizontales)
  for (let i = 0; i <= latLines; i += 1) {
    const lat = bounds.minLat + ((bounds.maxLat - bounds.minLat) * i) / latLines;
    const pLeft = projectToMap(bounds.minLon, lat, bounds, frame);
    const pRight = projectToMap(bounds.maxLon, lat, bounds, frame);

    ctx.beginPath();
    ctx.moveTo(pLeft.x - margin, pLeft.y);
    ctx.lineTo(pRight.x + margin, pRight.y);
    ctx.stroke();

    // Etiqueta SOLO fuera del mapa (izquierda, rotada 90°)
    ctx.save();
    ctx.font = '14px Arial'; // Opcional, para mejor visibilidad
    ctx.translate(frame.x - 8, pLeft.y + 4); // Ajusta -8 según necesidad
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(formatLat(lat), 0, 0);
    ctx.restore();
  }

  ctx.setLineDash([]);
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
ctx.restore();
}

function drawNorthArrow(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  const scale = 0.7;
  ctx.font = `bold ${Math.round(14 * scale)}px Arial`;
  ctx.fillText('N', x - 5 * scale, y - 14 * scale);

  ctx.beginPath();
  ctx.moveTo(x, y - 10 * scale);
  ctx.lineTo(x - 8 * scale, y + 12 * scale);
  ctx.lineTo(x + 8 * scale, y + 12 * scale);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, y + 12 * scale);
  ctx.lineTo(x, y + 36 * scale);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  }

function drawScaleBar(ctx, bounds, frame) {
  // Fija la escala a 25 km, con divisiones en 0, 5, 10 y 25 km
  const maxKm = 25;
  const divisions = [0, 5, 10, 25];

  // Calcula la longitud de la barra en píxeles
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonKm = Math.abs((bounds.maxLon - bounds.minLon) * 111.32 * Math.cos((midLat * Math.PI) / 180));
  if (!Number.isFinite(lonKm) || lonKm <= 0) return;
  const pxPerKm = (frame.w - frame.pad * 2) / lonKm;
  const barPx = maxKm * pxPerKm;

  // Posición de la barra
  const x = frame.x + frame.w - barPx - 54;
  const y = frame.y + frame.h - 22 - frame.h * 0.025;

  ctx.save();

  // Barra sólida
  ctx.strokeStyle = '#232f3e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barPx, y);
  ctx.stroke();

  // Marcas y etiquetas
  ctx.strokeStyle = '#232f3e';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#232f3e';
  ctx.font = '14px Arial';

  divisions.forEach((km) => {
    const tickX = x + (barPx * km) / maxKm;
    // Marca principal
    ctx.beginPath();
    ctx.moveTo(tickX, y - 12);
    ctx.lineTo(tickX, y + 12);
    ctx.stroke();

    // Etiqueta solo en 5, 10 y 25 km
    if (km !== 0) {
      const label = `${km} km`;
      const textWidth = ctx.measureText(label).width;
      ctx.fillText(label, tickX - textWidth / 2, y + 28);
    }
  });

  ctx.restore();
}

// Dibuja texto multilínea ajustando el ancho máximo y devuelve la siguiente coordenada Y
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y, maxWidth);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y, maxWidth);
  return y + lineHeight;
}

async function draw2DMap(ctx, plotData, analysisState) {
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

  await draw2DInstitutionalPanel(ctx, plotData);

  const mapX = 56;
  const mapY = 150;
  const mapW = 1300;

  const footerReserve = 90;
  const mapBottom = DEFAULT_IMAGE_HEIGHT - footerReserve;
  const mapH = mapBottom - mapY;

  const droughtSeverityScale = [
    { label: 'Extremadamente húmedo', color: '#000080' },
    { label: 'Muy húmedo', color: '#0000FF' },
    { label: 'Moderadamente húmedo', color: '#00FFFF' },
    { label: 'Normal', color: '#00FF00' },
    { label: 'Moderadamente seco', color: '#FFFF00' },
    { label: 'Severamente seco', color: '#FFA500' },
    { label: 'Extremadamente seco', color: '#FF0000' },
  ];

  // Leyenda a la derecha del mapa
  const legendW = 370;
  const legendH = Math.floor((mapH - 24) / 2);
  const legendX = DEFAULT_IMAGE_WIDTH - legendW - 56;
  const legendY = DEFAULT_IMAGE_HEIGHT - legendH - 40;

  // --- Cuadro informativo sobre la leyenda ---
  const infoBoxW = legendW;
  const infoBoxX = DEFAULT_IMAGE_WIDTH - infoBoxW - 56;
  const infoBoxY = Math.round(DEFAULT_IMAGE_HEIGHT * 0.135);
  const infoBoxH = legendY - infoBoxY - 16;

  ctx.save();
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, 10);

  // Título
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Información de consulta', infoBoxX + 22, infoBoxY + 32);

  // Mapeo de siglas a descripciones
  const indexDescriptions = {
    SPI: 'Índice de Precipitación Estandarizado',
    SPEI: 'Índice de Precipitación-Evapotranspiración Estandarizado',
    RAI: 'Índice de Anomalía de Lluvia',
    EDDI: 'Índice de Demanda de Evaporación por Sequía',
    PDSI: 'Índice de Severidad de Sequía de Palmer'
  };

  // Texto secundario
  ctx.font = '15px Arial';
  ctx.fillStyle = '#334155';
  let infoY = infoBoxY + 60;
  const infoBoxMaxWidth = infoBoxW - 44; // 22px de margen a cada lado

  infoY = wrapText(ctx, 'Fecha de consulta: ' + new Date().toLocaleString(), infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  infoY = wrapText(
    ctx,
    'Visualización: ' +
      (plotData?.isInterval && plotData?.period?.start_date && plotData?.period?.end_date
        ? plotData.period.start_date + ' a ' + plotData.period.end_date
        : (plotData?.date || 'N/A')),
    infoBoxX + 22,
    infoY,
    infoBoxMaxWidth,
    22
  );
  infoY = wrapText(ctx, 'Tipo de índice: Meteorológico', infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  const sigla = plotData?.variable_name || plotData?.variable || 'N/A';
  const descripcion = indexDescriptions[sigla] ? ` (${indexDescriptions[sigla]})` : '';
  wrapText(ctx, 'Índice ' + sigla + descripcion, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  // --- Fin cuadro informativo ---

  const frame = { x: mapX, y: mapY, w: mapW, h: mapH, pad: 12 };
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

  drawBasemapBackdrop(ctx, frame);
  await drawLeafletBasemapTiles(ctx, bounds, frame);
  drawProjectBoundary(ctx, boundaryCoords, bounds, frame);

  // --- DIBUJA LA GRILLA SIEMPRE AQUÍ, después del fondo y el contorno ---
  drawGraticule(ctx, bounds, frame);

  // --- DIBUJA LA LEYENDA DE LA GRILLA FUERA DEL MAPA ---
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial';

  // --- Continúa con el renderizado de celdas ---
  const lonRange = bounds.maxLon - bounds.minLon || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;

  const uniqueLons = getUniqueSorted(points.map((p) => p.lon));
  const uniqueLats = getUniqueSorted(points.map((p) => p.lat));
  const lonStep = inferStep(uniqueLons, Number(plotData?.resolution) || lonRange / 20 || 0.1);
  const latStep = inferStep(uniqueLats, Number(plotData?.resolution) || latRange / 20 || 0.1);

  const base = projectToMap(bounds.minLon, bounds.minLat, bounds, frame);
  const stepLon = projectToMap(bounds.minLon + lonStep, bounds.minLat, bounds, frame);
  const stepLat = projectToMap(bounds.minLon, bounds.minLat + latStep, bounds, frame);

  const cellWidth = Math.max(5, Math.abs(stepLon.x - base.x) * 0.92);
  const cellHeight = Math.max(5, Math.abs(stepLat.y - base.y) * 0.92);

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

function drawNorthArrow(ctx, x, y) {
  ctx.save();
  const scale = 2.0; // 200% del tamaño original
  const yOffset = 20; // Desplazamiento hacia el sur (ahora el doble que antes)
  // Letra N
  ctx.fillStyle = '#222';
  ctx.font = `bold ${Math.round(20 * scale)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('N', x, y - 18 * scale + yOffset);

  // Flecha (triángulo)
  ctx.beginPath();
  ctx.moveTo(x, y - 10 * scale + yOffset);      // Punta de la flecha
  ctx.lineTo(x - 8 * scale, y + 10 * scale + yOffset);  // Esquina izquierda
  ctx.lineTo(x + 8 * scale, y + 10 * scale + yOffset);  // Esquina derecha
  ctx.closePath();
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.restore();
}

drawNorthArrow(ctx, mapX + 36, mapY + 36 + 40);
drawScaleBar(ctx, bounds, frame);

  ctx.fillStyle = '#334155';
  ctx.font = '15px Arial';

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
  drawCard(ctx, legendX, legendY, legendW, legendH, 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Arial';
  ctx.fillText('Leyenda', legendX + 22, legendY + 32);

  if (!legendEntries.length) {
    const values = cells
      .map((cell) => Number(cell?.value))
      .filter((value) => Number.isFinite(value));

    const minVal = values.length ? Math.min(...values) : null;
    const maxVal = values.length ? Math.max(...values) : null;

    ctx.fillStyle = '#334155';
    ctx.font = '15px Arial';
    ctx.fillText('Escala continua', legendX + 22, legendY + 66);
    ctx.fillText('Min: ' + (minVal?.toFixed(2) ?? 'N/A'), legendX + 22, legendY + 92);
    ctx.fillText('Max: ' + (maxVal?.toFixed(2) ?? 'N/A'), legendX + 22, legendY + 116);
    return;
  }

  let offsetY = legendY + 60;
  droughtSeverityScale.forEach((entry) => {
    ctx.fillStyle = entry.color;
    ctx.fillRect(legendX + 22, offsetY, 32, 18);
    ctx.fillStyle = '#334155';
    ctx.font = '15px Arial';
    ctx.fillText(entry.label, legendX + 62, offsetY + 15);
    offsetY += 32;
  });

  // Entrada para el área de interés (contorno azul)
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 64, 175, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(legendX + 22, offsetY, 32, 18);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#334155';
  ctx.font = '15px Arial';
  ctx.fillText('Área de interés', legendX + 64, offsetY + 14);

  offsetY += 32;

  ctx.fillStyle = '#64748b';
  ctx.font = '14px Arial';

  // --- Metadatos cartográficos en la esquina inferior izquierda ---
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px Arial';

  const metaX = 56;
const metaY = DEFAULT_IMAGE_HEIGHT - 54;
  ctx.fillText('Metadatos', metaX, metaY);

  ctx.font = '14px Arial';
  const resolucion = plotData?.resolution || analysisState?.spatialResolution || 'N/A';
  const sistemaCoord = 'WGS84 (EPSG:4326)';

  ctx.fillText(`Resolución: ${resolucion}°`, metaX, metaY + 22);
  ctx.fillText(`Sistema de coordenadas: ${sistemaCoord}`, metaX, metaY + 42);
  ctx.restore();
}
export function downloadAnalysisJson({ plotData, analysisState, selectedCell }) {
  const is2D = plotData.type === '2D' || plotData.type === 'prediction-2d' || plotData.type === 'prediction-history-2d';
  const data = is2D
    ? build2DJson({ plotData, analysisState })
    : build1DJson({ plotData, analysisState, selectedCell });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerFileDownload(blob, sanitizeFilename(plotData?.title) + '.json');
  return {
    fileName: sanitizeFilename(plotData?.title) + '.json',
    rows: is2D
      ? (Array.isArray(plotData?.gridCells) ? plotData.gridCells.length : 0)
      : (Array.isArray(plotData?.data) ? plotData.data.length : 0),
    type: 'json',
  };
}