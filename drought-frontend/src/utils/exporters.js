
  // Declarar dividerY después de definir infoBoxY y infoBoxH, dentro de draw2DMap
  // fitLegendText debe estar antes de su uso
  const fitLegendText = (ctx2, text, maxWidth) => {
    if (ctx2.measureText(text).width <= maxWidth) return text;
    const ellipsis = '...';
    let out = text;
    while (out.length > 0 && ctx2.measureText(out + ellipsis).width > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + ellipsis;
  };
const DEFAULT_IMAGE_WIDTH = 1800;
const DEFAULT_IMAGE_HEIGHT = 1100;
const LEAFLET_BASEMAP_TILE_URL = 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

const METEOROLOGICAL_INDICES = new Set(['SPI', 'SPEI', 'RAI', 'EDDI', 'PDSI']);
const HYDROLOGICAL_INDICES = new Set(['SDI', 'SRI', 'MFI', 'DDI', 'HDI']);

const VARIABLE_LABELS = {
  precip: 'Precipitación',
  tmean: 'Temperatura Media',
  tmin: 'Temperatura Mínima',
  tmax: 'Temperatura Máxima',
  pet: 'Evapotranspiración Potencial (PET)',
};

const CHART_TITLE_LABELS = {
  precip: 'PRECIPITACIÓN',
  tmean: 'TEMPERATURA MEDIA',
  tmin: 'TEMPERATURA MÍNIMA',
  tmax: 'TEMPERATURA MÁXIMA',
  pet: 'EVAPOTRANSPIRACIÓN POTENCIAL',
  balance: 'BALANCE HÍDRICO',
};

const CHART_YLABEL_UNITS = {
  precip: 'PRECIPITACIÓN (mm)',
  tmean: 'TEMPERATURA (°C)',
  tmin: 'TEMPERATURA (°C)',
  tmax: 'TEMPERATURA (°C)',
  pet: 'EVAPOTRANSPIRACIÓN POTENCIAL (mm)',
  balance: 'BALANCE HÍDRICO (mm)',
};

const INDEX_LABELS = {
  SPI: 'Índice de Precipitación Estandarizado',
  SPEI: 'Índice de Precipitación-Evapotranspiración Estandarizado',
  RAI: 'Índice de Anomalía de Lluvia',
  EDDI: 'Índice de Demanda de Evaporación por Sequía',
  PDSI: 'Índice de Severidad de Sequía de Palmer',
  SDI: 'Índice de Sequía de Caudales',
  SRI: 'Índice de Recurrencia de Sequía',
  MFI: 'Índice de Flujo Mensual',
  DDI: 'Índice de Déficit de Duración',
  HDI: 'Índice de Déficit Hidrológico',
};

const FIXED_BACKEND_LEGEND_RANGES = {
  tmean: {
    'muy baja': '< 10.0 °C',
    baja: '10.0 a < 11.5 °C',
    'media-baja': '11.5 a < 13.0 °C',
    'media-alta': '13.0 a < 14.5 °C',
    alta: '14.5 a < 16.0 °C',
    'muy alta': '>= 16.0 °C',
  },
  tmin: {
    'muy baja': '< 2.0 °C',
    baja: '2.0 a < 4.0 °C',
    'media-baja': '4.0 a < 6.5 °C',
    'media-alta': '6.5 a < 9.0 °C',
    alta: '9.0 a < 11.0 °C',
    'muy alta': '>= 11.0 °C',
  },
  tmax: {
    'muy baja': '< 16.5 °C',
    baja: '16.5 a < 18.5 °C',
    'media-baja': '18.5 a < 20.5 °C',
    'media-alta': '20.5 a < 22.5 °C',
    alta: '22.5 a < 24.0 °C',
    'muy alta': '>= 24.0 °C',
  },
  pet: {
    'muy baja': '< 3.0 mm',
    baja: '3.0 a < 6.0 mm',
    'media-baja': '6.0 a < 9.0 mm',
    'media-alta': '9.0 a < 12.0 mm',
    alta: '12.0 a < 15.0 mm',
    'muy alta': '>= 15.0 mm',
  },
  precip: {
    D: {
      'muy baja': '< 10.0 mm',
      baja: '10.0 a < 20.0 mm',
      'media-baja': '20.0 a < 35.0 mm',
      'media-alta': '35.0 a < 50.0 mm',
      alta: '50.0 a < 70.0 mm',
      'muy alta': '>= 70.0 mm',
    },
    M: {
      'muy baja': '< 50.0 mm',
      baja: '50.0 a < 150.0 mm',
      'media-baja': '150.0 a < 250.0 mm',
      'media-alta': '250.0 a < 400.0 mm',
      alta: '400.0 a < 550.0 mm',
      'muy alta': '>= 550.0 mm',
    },
  },
};

const FIXED_INDEX_LEGEND_RANGES = {
SPI: {
'extremadamente seco': '< -2.0',
'severamente seco': '-2.0 a < -1.5',
'moderadamente seco': '-1.5 a < -1.0',
normal: '-1.0 a < 1.0',
'moderadamente humedo': '1.0 a < 1.5',
'muy humedo': '1.5 a < 2.0',
'extremadamente humedo': '>= 2.0',
},
SPEI: {
'extremadamente seco': '< -2.0',
'severamente seco': '-2.0 a < -1.5',
'moderadamente seco': '-1.5 a < -1.0',
normal: '-1.0 a < 1.0',
'moderadamente humedo': '1.0 a < 1.5',
'muy humedo': '1.5 a < 2.0',
'extremadamente humedo': '>= 2.0',
},
RAI: {
'extremadamente seco': '< -2.0',
'severamente seco': '-2.0 a < -1.5',
'moderadamente seco': '-1.5 a < -1.0',
normal: '-1.0 a < 1.0',
'moderadamente humedo': '1.0 a < 1.5',
'muy humedo': '1.5 a < 2.0',
'extremadamente humedo': '>= 2.0',
},
PDSI: {
'extremadamente seco': '< -4.0',
'severamente seco': '-4.0 a < -3.0',
'moderadamente seco': '-3.0 a < -2.0',
normal: '-2.0 a < 2.0',
'moderadamente humedo': '2.0 a < 3.0',
'muy humedo': '3.0 a < 4.0',
'extremadamente humedo': '>= 4.0',
},
EDDI: {
'extremadamente humedo': '< -2.0',
'muy humedo': '-2.0 a < -1.5',
'moderadamente humedo': '-1.5 a < -1.0',
normal: '-1.0 a < 1.0',
'moderadamente seco': '1.0 a < 1.5',
'severamente seco': '1.5 a < 2.0',
'extremadamente seco': '>= 2.0',
},
};

function normalizeLegendLabel(value) {
return String(value || '')
.toLowerCase()
.normalize('NFD')
.replace(/[\u0300-\u036f]/g, '')
.replace(/[.,;:]/g, '')
.replace(/\s+/g, ' ')
.trim()
.replace('media baja', 'media-baja')
.replace('media alta', 'media-alta');
}

function resolveFixedBackendRange(variableCode, frequencyCode, categoryLabel) {
const normalizedVar = String(variableCode || '')
.trim()
.split(/\s*-\s*|\s+/)[0];

const variableUpper = normalizedVar.toUpperCase();
const variableLower = normalizedVar.toLowerCase();
const key = normalizeLegendLabel(categoryLabel);

  if (variableUpper === 'PRECIP') {
    const freq = String(frequencyCode || 'M').toUpperCase();
    const byFrequency = FIXED_BACKEND_LEGEND_RANGES.precip[freq] || FIXED_BACKEND_LEGEND_RANGES.precip.M;
    return byFrequency?.[key] || null;
  }

  const variableConfig = FIXED_BACKEND_LEGEND_RANGES[variableLower];
  if (variableConfig && !variableConfig.D && !variableConfig.M) {
    return variableConfig[key] || null;
  }

  const indexConfig = FIXED_INDEX_LEGEND_RANGES[variableUpper];
  if (indexConfig) {
    return indexConfig[key] || null;
  }

  return null;
}
function resolveDataKind(rawValue) {
  const value = String(rawValue || '').trim();
  const upper = value.toUpperCase();
  const lower = value.toLowerCase();

  if (METEOROLOGICAL_INDICES.has(upper)) {
    return {
      group: 'Índice de sequía',
      family: 'Meteorológica',
      code: upper,
      label: INDEX_LABELS[upper] || upper,
    };
  }

  if (HYDROLOGICAL_INDICES.has(upper)) {
    return {
      group: 'Índice de sequía',
      family: 'Hidrológica',
      code: upper,
      label: INDEX_LABELS[upper] || upper,
    };
  }

  if (VARIABLE_LABELS[lower]) {
    return {
      group: 'Variable climática',
      family: null,
      code: lower,
      label: VARIABLE_LABELS[lower],
    };
  }

  return {
    group: 'Dato',
    family: null,
    code: value || 'N/A',
    label: value || 'N/A',
  };
}

function normalizeFrequencyCode(value) {
  if (value == null) return null;

  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return null;

  if (
    normalized === 'M' ||
    normalized === 'MONTHLY' ||
    normalized === 'MENSUAL' ||
    normalized.startsWith('MENS')
  ) {
    return 'M';
  }

  if (
    normalized === 'D' ||
    normalized === 'DAILY' ||
    normalized === 'DIARIA' ||
    normalized === 'DIARIO' ||
    normalized.startsWith('DIA')
  ) {
    return 'D';
  }

  return null;
}

function resolvePrecipFrequencyCode(plotData, analysisState) {
  const candidates = [
    plotData?.frequency,
    analysisState?.frequency,
    plotData?.periodicity,
    analysisState?.periodicity,
    plotData?.temporalResolution,
    analysisState?.temporalResolution,
  ];

  for (const candidate of candidates) {
    const code = normalizeFrequencyCode(candidate);
    if (code) return code;
  }

  const subtitle = String(plotData?.subtitle || '').toLowerCase();
  if (subtitle.includes('mensual')) return 'M';
  if (subtitle.includes('diaria') || subtitle.includes('diario')) return 'D';

  // Fallback histórico cuando backend no retorna frecuencia explícita.
  return 'M';
}

function resolveSatelliteProductLabel(plotData, analysisState, forcedResolution = null) {
  // Definir producto únicamente por la resolución de celdas, usando la misma lógica que draw2DMap
  let resolution = null;
  if (forcedResolution !== null) {
    resolution = forcedResolution;
  } else if (typeof plotData?.resolution !== 'undefined' && plotData?.resolution !== null) {
    resolution = Number(plotData.resolution);
  } else if (typeof analysisState?.spatialResolution !== 'undefined' && analysisState?.spatialResolution !== null) {
    resolution = Number(analysisState.spatialResolution);
  }
  if (Math.abs(resolution - 0.25) < 0.001) return `ERA5 (ECMWF, 0.25°)`;
  if (Math.abs(resolution - 0.10) < 0.001) return `IMERG (GPM NASA, 0.10°)`;
  if (Math.abs(resolution - 0.05) < 0.001) return `CHIRPS (UCSB, 0.05°)`;
  if (Number.isFinite(resolution)) return `Resolución desconocida (${resolution.toFixed(2)}°)`;
  return 'N/A';
}

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

export async function downloadAnalysisImage({ plotData, analysisState, selectedCell }) {
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
  if (is2D && plotData.isCuencas) {
    // Mapa 2D de cuencas hidrográficas
    await draw2DWatershedMap(ctx, plotData, analysisState);
  } else if (is2D) {
    // Dibuja el mapa 2D completo de celdas
    await draw2DMap(ctx, plotData, analysisState);
  } else {
    // Para gráficos 1D: panel institucional + barra indicadora + gráfico
    await draw2DInstitutionalPanel(ctx, plotData);
    drawAnalysisTypeIndicator(ctx, plotData);
    const mapLayout = { x: 56, y: 170, w: 580, h: 860 };
    const infoLayout  = { x: 656, y: 170, w: 540, h: 220 };
    const statsLayout = { x: 1204, y: 170, w: 540, h: 220 };
    const chartLayout = { x: 656, y: 410, w: 1088, h: 620 };
    // Calcular resolución una sola vez
    let resolucion = null;
    if (typeof plotData?.resolution !== 'undefined' && plotData?.resolution !== null) {
      resolucion = Number(plotData.resolution);
    } else if (typeof analysisState?.spatialResolution !== 'undefined' && analysisState?.spatialResolution !== null) {
      resolucion = Number(analysisState.spatialResolution);
    }
    if (plotData.isCuencaTimeSeries) {
      await draw1DSelectedCuencaMap(ctx, plotData, mapLayout);
    } else {
      await draw1DSelectedCellMap(ctx, { ...plotData, resolution: resolucion }, selectedCell, mapLayout);
    }
    draw1DConsultationInfo(ctx, { ...plotData, resolution: resolucion }, analysisState, infoLayout);
    draw1DStatsTable(ctx, plotData, statsLayout);
    draw1DChart(ctx, plotData, chartLayout);
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

  const _bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const primaryLogo = `${_bp}/logos/Logo_Dashboard_Diurno.png`;
  const entityLogos = [`${_bp}/logos/entidad1.png`, `${_bp}/logos/entidad2.png`, `${_bp}/logos/entidad3.png`];

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

  function niceNumber(value, round = true) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / (10 ** exponent);
  let niceFraction;

  if (round) {
  if (fraction < 1.5) niceFraction = 1;
  else if (fraction < 3) niceFraction = 2;
  else if (fraction < 4) niceFraction = 2.5;
  else if (fraction < 7) niceFraction = 5;
  else niceFraction = 10;
  } else {
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  }

  return niceFraction * (10 ** exponent);
  }

  function buildYAxisScale(values, desiredSteps = 8, paddingRatio = 0.12) {
  let rawMin = Math.min(...values);
  let rawMax = Math.max(...values);

  if (rawMin === rawMax) {
  const base = Math.abs(rawMin) > 0 ? Math.abs(rawMin) : 1;
  rawMin -= base * 0.5;
  rawMax += base * 0.5;
  }

  const rawRange = rawMax - rawMin;
  const pad = rawRange * paddingRatio;
  const paddedMin = rawMin - pad;
  const paddedMax = rawMax + pad;

  const step = niceNumber((paddedMax - paddedMin) / desiredSteps, true);
  let axisMin = Math.floor(paddedMin / step) * step;
  let axisMax = Math.ceil(paddedMax / step) * step;

  if (axisMin === axisMax) {
  axisMin -= step;
  axisMax += step;
  }

  const yTicks = [];
  for (let v = axisMax; v >= axisMin - step * 0.5; v -= step) {
  yTicks.push(Number(v.toFixed(10)));
  if (yTicks.length > desiredSteps + 3) break;
  }

  return {
  axisMin,
  axisMax,
  axisRange: axisMax - axisMin,
  step,
  yTicks,
  };
  }

function draw1DChart(ctx, plotData, layout = {}) {
  // --- Reset canvas state para evitar interferencia de operaciones previas ---
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // resetea cualquier transformación activa
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const chartX = layout.x ?? 56;
  const chartY = layout.y ?? 170;
  const chartW = layout.w ?? 980;
  const chartH = layout.h ?? 560;

  // Reservas internas
  const titleH      = 48;
  const axisLabelH  = 28;
  const legendH     = 50;
  const plotLeftPad  = 76;
  const plotRightPad = 28;
  const plotTopPad   = titleH + 14;
  const plotBottomPad = axisLabelH + legendH + 34;
  const plotW = chartW - (plotLeftPad + plotRightPad);
  const plotH = chartH - (plotTopPad + plotBottomPad);

  // --- Fondo del panel (siempre se dibuja, incluso si no hay datos) ---
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  drawCard(ctx, chartX, chartY, chartW, chartH, 14);

  // --- Datos ---
  const rows = Array.isArray(plotData?.data) ? plotData.data : [];
  const varCode = String(plotData?.variable || plotData?.variable_name || 'INDICADOR').trim().toUpperCase();
  const varKey = varCode.toLowerCase();
  const chartDisplayName = CHART_TITLE_LABELS[varKey] || varCode;
  const isIndex = METEOROLOGICAL_INDICES.has(varCode) || HYDROLOGICAL_INDICES.has(varCode);
  const allDates = rows.map((r) => r?.date).filter(Boolean);
  const dateStart = allDates.length ? formatISOtoDMY(allDates[0]) : 'N/A';
  const dateEnd   = allDates.length ? formatISOtoDMY(allDates[allDates.length - 1]) : 'N/A';

  // --- Título del gráfico ---
  const chartTitle = `SERIE TEMPORAL DE ${chartDisplayName} | ${dateStart} - ${dateEnd}`;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(fitText(ctx, chartTitle, chartW - 32), chartX + chartW / 2, chartY + titleH - 6);
  ctx.textAlign = 'left';

  // --- Si no hay datos válidos, mensaje y salir ---
  const values = rows
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Sin datos disponibles para este período', chartX + chartW / 2, chartY + chartH / 2);
    ctx.textAlign = 'left';
    ctx.restore();
    return;
  }

  // Escala dinámica: usa el rango real de los datos (no centra siempre en 0).
  const { axisMin: rawAxisMin, axisMax, axisRange: rawAxisRange, step, yTicks: rawYTicks } = buildYAxisScale(values, 8, 0.12);
  const clampToZero = varKey === 'precip' || varKey === 'pet';
  const axisMin = clampToZero ? Math.max(0, rawAxisMin) : rawAxisMin;
  const axisRange = axisMax - axisMin;
  const yTicks = clampToZero
    ? rawYTicks.filter((v) => v >= axisMin - 1e-9)
    : rawYTicks;

  const formatYAxisTick = (value) => {
    const safe = Math.abs(value) < 1e-9 ? 0 : value;
    const decimals = step >= 10 ? 0 : step >= 1 ? 1 : step >= 0.1 ? 2 : 3;
    return safe.toFixed(decimals).replace('.', ',');
  };

  // --- Área de trazado con clip ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(chartX + plotLeftPad, chartY + plotTopPad, plotW, plotH);
  ctx.clip();

  // Fondo del área de trazado
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(chartX + plotLeftPad, chartY + plotTopPad, plotW, plotH);
  ctx.restore();

  // --- Cuadrícula horizontal ---
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (let i = 0; i < yTicks.length; i += 1) {
    const py = chartY + plotTopPad + (1 - (yTicks[i] - axisMin) / axisRange) * plotH;
    ctx.beginPath();
    ctx.moveTo(chartX + plotLeftPad, py);
    ctx.lineTo(chartX + chartW - plotRightPad, py);
    ctx.stroke();
  }

  // --- Etiquetas eje Y ---
  ctx.fillStyle = '#64748b';
  ctx.font = '13px Arial';
  for (let i = 0; i < yTicks.length; i += 1) {
    const py = chartY + plotTopPad + (1 - (yTicks[i] - axisMin) / axisRange) * plotH;
    ctx.textAlign = 'right';
    ctx.fillText(formatYAxisTick(yTicks[i]), chartX + plotLeftPad - 6, py + 5);
  }
  ctx.textAlign = 'left';

  // --- Etiqueta eje Y (rotada) ---
  const yLabel = isIndex
  ? `VALOR DE ${varCode} (ADIMENSIONAL)`
  : `VALOR DE ${CHART_YLABEL_UNITS[varKey] || varCode}`;
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.translate(chartX + 18, chartY + plotTopPad + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // --- Línea del gráfico con clip ---
  const points = rows
    .map((item, index) => {
      const value = Number(item?.value);
      if (!Number.isFinite(value)) return null;
      const x = chartX + plotLeftPad + (index / Math.max(rows.length - 1, 1)) * plotW;
      const y = chartY + plotTopPad + (1 - (value - axisMin) / axisRange) * plotH;
      return { x, y, value, date: item?.date };
    })
    .filter(Boolean);

  if (points.length) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(chartX + plotLeftPad, chartY + plotTopPad, plotW, plotH);
    ctx.clip();

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  // --- Borde del área de trazado ---
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(chartX + plotLeftPad, chartY + plotTopPad, plotW, plotH);

  // --- Eje X: 5 fechas representativas ---
  const xAxisBaseY = chartY + plotTopPad + plotH;
  const xTickCount = 4;
  ctx.fillStyle = '#64748b';
  ctx.font = '13px Arial';
  for (let i = 0; i <= xTickCount; i += 1) {
    const rowIdx = Math.round((i / xTickCount) * (rows.length - 1));
    const date = formatISOtoDMY(rows[rowIdx]?.date || '');
    const px = chartX + plotLeftPad + (rowIdx / Math.max(rows.length - 1, 1)) * plotW;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, xAxisBaseY);
    ctx.lineTo(px, xAxisBaseY + 6);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText(date, px, xAxisBaseY + 20);
  }
  ctx.textAlign = 'left';

  // --- Etiqueta eje X ---
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FECHA', chartX + plotLeftPad + plotW / 2, xAxisBaseY + axisLabelH + 6);
  ctx.textAlign = 'left';

  // --- Leyenda inferior ---
  const legY = chartY + chartH - legendH + 10;
  const legX = chartX + plotLeftPad;
  ctx.fillStyle = '#eff6ff';
  ctx.strokeStyle = '#bfdbfe';
  ctx.lineWidth = 1;
  ctx.fillRect(legX, legY, plotW, legendH - 12);
  ctx.strokeRect(legX, legY, plotW, legendH - 12);

  ctx.fillStyle = '#2563eb';
  const legendLineY = legY + 20;
  const swatchW = 28;
  const swatchH = 5;
  const gapAfterSwatch = 10;

  ctx.font = 'bold 14px Arial';
  const varWidth = ctx.measureText(varCode).width;

  const totalLegendW = swatchW + gapAfterSwatch + varWidth;
  const legendStartX = legX + (plotW - totalLegendW) / 2;

  ctx.fillStyle = '#2563eb';
  ctx.fillRect(legendStartX, legY + 13, swatchW, swatchH);

  const varX = legendStartX + swatchW + gapAfterSwatch;
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(varCode, varX, legendLineY);

  ctx.restore(); // restaura el estado inicial guardado al comienzo
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fitText(ctx, text, maxWidth) {
  const raw = String(text || '');
  if (ctx.measureText(raw).width <= maxWidth) return raw;

  const suffix = '...';
  let out = raw;
  while (out.length > 0 && ctx.measureText(out + suffix).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + suffix;
}

function formatExportTimestamp(date) {
  const two = (value) => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}, ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

// Convierte 'YYYY-MM-DD' o 'YYYY/MM/DD' a 'dd/mm/aa'
function formatISOtoDMY(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(/\//g, '-');
  const parts = s.split('-');
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts;
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y.slice(-2)}`;
}

function draw1DConsultationInfo(ctx, plotData, analysisState, layout = {}) {
  const x = layout.x ?? 916;
  const y = layout.y ?? 690;
  const w = layout.w ?? 828;
  const h = layout.h ?? 240;
  const contentX = x + 20;
  const contentMaxW = w - 40;

  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, x, y, w, h, 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('INFORMACIÓN DE CONSULTA', x + w / 2, y + 30);
  ctx.textAlign = 'left';

  const selectedCode = resolveSelectedVariable(plotData, analysisState);
  const varKey = selectedCode.trim().toLowerCase();
  const chartDisplayName = CHART_TITLE_LABELS[varKey] || varKey;
  const isIndex = METEOROLOGICAL_INDICES.has(varKey) || HYDROLOGICAL_INDICES.has(varKey);
  const dataKind = resolveDataKind(selectedCode);
  const aggregationLevel = analysisState?.indexScale || plotData?.scale || 'N/A';
  const precipitationFrequencyCode = resolvePrecipFrequencyCode(plotData, analysisState);
  const frequencyLabel = precipitationFrequencyCode === 'D' ? 'Diaria' : 'Mensual';

  // Usar fechas reales de los datos (igual que el título del gráfico) para consistencia.
  const infoRows = Array.isArray(plotData?.data) ? plotData.data : [];
  const infoAllDates = infoRows.map((r) => r?.date).filter(Boolean);
  const infoDateStart = infoAllDates.length ? formatISOtoDMY(infoAllDates[0]) : 'N/A';
  const infoDateEnd   = infoAllDates.length ? formatISOtoDMY(infoAllDates[infoAllDates.length - 1]) : 'N/A';
  const timeWindow = infoAllDates.length ? `${infoDateStart} a ${infoDateEnd}` : resolveTimeInterval(plotData, analysisState).replace('->', 'a').replace(/-/g, '/');

  // Calcular resolución una sola vez y pasarla a resolveSatelliteProductLabel y a los metadatos
  let resolucion = null;
  if (typeof plotData?.resolution !== 'undefined' && plotData?.resolution !== null) {
    resolucion = Number(plotData.resolution);
  } else if (typeof analysisState?.spatialResolution !== 'undefined' && analysisState?.spatialResolution !== null) {
    resolucion = Number(analysisState.spatialResolution);
  }
  const productLabel = resolveSatelliteProductLabel(plotData, analysisState, resolucion);
  const indexOrVariable = dataKind.family
    ? `${dataKind.code} - ${dataKind.label}`
    : dataKind.label;
  ctx.fillStyle = '#334155';
  ctx.font = '16px Arial';

  let infoY = y + 56;
  infoY = wrapText(ctx, `Fecha de consulta: ${formatExportTimestamp(new Date())}`, contentX, infoY, contentMaxW, 22);
  infoY = wrapText(ctx, `Fecha de visualización: ${timeWindow}`, contentX, infoY, contentMaxW, 22);
  infoY = wrapText(ctx, `Tipo de dato: ${dataKind.group}`, contentX, infoY, contentMaxW, 22);
  if (dataKind.family) {
    infoY = wrapText(ctx, `Nivel de Agregación: ${aggregationLevel} meses`, contentX, infoY, contentMaxW, 22);
  } else {
    infoY = wrapText(ctx, `Frecuencia: ${frequencyLabel}`, contentX, infoY, contentMaxW, 22);
  }

  if (dataKind.family) {
    infoY = wrapText(ctx, `Tipo de índice: ${dataKind.family}`, contentX, infoY, contentMaxW, 22);
    infoY = wrapText(ctx, `Índice: ${indexOrVariable}`, contentX, infoY, contentMaxW, 22);
  } else {
    infoY = wrapText(ctx, `Variable: ${indexOrVariable}`, contentX, infoY, contentMaxW, 22);
  }

  // Determinar producto según resolución
  let producto = '';
  if (Number.isFinite(resolucion)) {
    if (Math.abs(resolucion - 0.05) < 0.001) producto = 'CHIRPS';
    else if (Math.abs(resolucion - 0.10) < 0.001) producto = 'IMERG';
    else if (Math.abs(resolucion - 0.25) < 0.001) producto = 'ERA5';
  }
  wrapText(ctx, `Producto de análisis satelital consultado: ${producto}`, contentX, infoY, contentMaxW, 22);
}

function draw1DStatsTable(ctx, plotData, layout = {}) {
  const x = layout.x ?? 1260;
  const y = layout.y ?? 170;
  const w = layout.w ?? 484;
  const h = layout.h ?? 220;
  const contentX = x + 20;
  const valueX = x + w - 20;

  // Calcular estadísticas desde los datos reales
  const rows = Array.isArray(plotData?.data) ? plotData.data : [];
  const values = rows
    .map((r) => Number(r?.value ?? r?.index_value ?? r?.spei ?? r?.spi))
    .filter((v) => Number.isFinite(v));
  const count = values.length;
  const maxVal  = count ? Math.max(...values) : null;
  const minVal  = count ? Math.min(...values) : null;
  const meanVal = count ? values.reduce((a, b) => a + b, 0) / count : null;
  const fmt = (v) => (v === null ? 'N/A' : v.toFixed(2));

  // Tarjeta de fondo con el mismo estilo del cuadro de consulta
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, x, y, w, h, 12);

  // Título con el mismo estilo
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ESTADÍSTICAS DE LA SERIE', x + w / 2, y + 30);
  ctx.textAlign = 'left';

  // Separador
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 44);
  ctx.lineTo(x + w - 12, y + 44);
  ctx.stroke();

  // Filas de estadísticas en formato tabla simple
  const stats = [
    { label: 'Máximo',           value: fmt(maxVal)  },
    { label: 'Mínimo',           value: fmt(minVal)  },
    { label: 'Media',            value: fmt(meanVal) },
    { label: 'N.º de registros', value: String(count) },
  ];

  const rowTop = y + 58;
  const rowH = (h - 70) / stats.length;

  stats.forEach((stat, i) => {
    const ry = rowTop + i * rowH;
    if (i > 0) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 12, ry - 6);
      ctx.lineTo(x + w - 12, ry - 6);
      ctx.stroke();
    }

    ctx.fillStyle = '#334155';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(stat.label, contentX, ry + rowH / 2 + 4);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(stat.value, valueX, ry + rowH / 2 + 4);
  });

  ctx.textAlign = 'left';
}

function drawCellGridOverlay(ctx, bounds, frame, resolution) {
  const lonRange = bounds.maxLon - bounds.minLon;
  const latRange = bounds.maxLat - bounds.minLat;
  if (lonRange <= 0 || latRange <= 0) return;

  let lonStep = Number.isFinite(resolution) && resolution > 0 ? resolution : lonRange / 20;
  let latStep = Number.isFinite(resolution) && resolution > 0 ? resolution : latRange / 20;

  const base = projectToMap(bounds.minLon, bounds.minLat, bounds, frame);
  const stepLonPoint = projectToMap(bounds.minLon + lonStep, bounds.minLat, bounds, frame);
  const stepLatPoint = projectToMap(bounds.minLon, bounds.minLat + latStep, bounds, frame);

  const lonPx = Math.abs(stepLonPoint.x - base.x);
  const latPx = Math.abs(stepLatPoint.y - base.y);
  const minPx = 14;

  if (lonPx > 0 && lonPx < minPx) {
    const factor = Math.ceil(minPx / lonPx);
    lonStep *= factor;
  }
  if (latPx > 0 && latPx < minPx) {
    const factor = Math.ceil(minPx / latPx);
    latStep *= factor;
  }

  const startLon = Math.floor(bounds.minLon / lonStep) * lonStep;
  const startLat = Math.floor(bounds.minLat / latStep) * latStep;

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2);
  ctx.clip();

  ctx.strokeStyle = 'rgba(37, 99, 235, 0.42)';
  ctx.lineWidth = 1;

  for (let lon = startLon; lon <= bounds.maxLon + lonStep; lon += lonStep) {
    const top = projectToMap(lon, bounds.maxLat, bounds, frame);
    const bottom = projectToMap(lon, bounds.minLat, bounds, frame);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }

  for (let lat = startLat; lat <= bounds.maxLat + latStep; lat += latStep) {
    const left = projectToMap(bounds.minLon, lat, bounds, frame);
    const right = projectToMap(bounds.maxLon, lat, bounds, frame);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }

  ctx.restore();
}

async function draw1DSelectedCellMap(ctx, plotData, selectedCell, layout = {}) {
  const targetCell = selectedCell || plotData?.location || null;
  const target = resolveLatLon(targetCell);
  if (!target) return;

  const panelX = layout.x ?? 1060;
  const panelY = layout.y ?? 330;
  const panelW = layout.w ?? 290;
  const panelH = layout.h ?? 400;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, panelX, panelY, panelW, panelH, 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MAPA DE CELDA CONSULTADA', panelX + panelW / 2, panelY + 32);
  ctx.textAlign = 'left';

  const metadataH = 88;
  const metadataX = panelX + 14;
  const metadataY = panelY + panelH - metadataH - 12;
  const metadataW = panelW - 28;

  const mapFrame = {
    x: panelX + 14,
    y: panelY + 48,
    w: panelW - 28,
    h: metadataY - (panelY + 48) - 10,
    pad: 10,
  };

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, mapFrame.x, mapFrame.y, mapFrame.w, mapFrame.h, 10);

  const boundaryCoords = await loadStudyAreaBoundary();
  const boundaryLons = boundaryCoords.map((coord) => coord[0]);
  const boundaryLats = boundaryCoords.map((coord) => coord[1]);

  const basePad = 0.75;
  const bounds = {
    minLon: boundaryLons.length ? Math.min(...boundaryLons) : target.lon - basePad,
    maxLon: boundaryLons.length ? Math.max(...boundaryLons) : target.lon + basePad,
    minLat: boundaryLats.length ? Math.min(...boundaryLats) : target.lat - basePad,
    maxLat: boundaryLats.length ? Math.max(...boundaryLats) : target.lat + basePad,
  };

  const lonPad = (bounds.maxLon - bounds.minLon) * 0.08;
  const latPad = (bounds.maxLat - bounds.minLat) * 0.08;

  bounds.minLon -= lonPad;
  bounds.maxLon += lonPad;
  bounds.minLat -= latPad;
  bounds.maxLat += latPad;

  const resolution = Number(
    selectedCell?.resolution
      || plotData?.resolution
      || plotData?.location?.resolution
      || 0.05
  );

  drawBasemapBackdrop(ctx, mapFrame, bounds);
  await drawLeafletBasemapTiles(ctx, bounds, mapFrame);
  drawProjectBoundary(ctx, boundaryCoords, bounds, mapFrame);
  drawCellGridOverlay(ctx, bounds, mapFrame, resolution);

  const halfRes = Number.isFinite(resolution) ? Math.max(resolution / 2, 0.0001) : 0.025;

  const west = clamp(target.lon - halfRes, bounds.minLon, bounds.maxLon);
  const east = clamp(target.lon + halfRes, bounds.minLon, bounds.maxLon);
  const north = clamp(target.lat + halfRes, bounds.minLat, bounds.maxLat);
  const south = clamp(target.lat - halfRes, bounds.minLat, bounds.maxLat);

  const nw = projectToMap(west, north, bounds, mapFrame);
  const se = projectToMap(east, south, bounds, mapFrame);

  const boxX = Math.min(nw.x, se.x);
  const boxY = Math.min(nw.y, se.y);
  const boxW = Math.max(8, Math.abs(se.x - nw.x));
  const boxH = Math.max(8, Math.abs(se.y - nw.y));

  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.strokeStyle = '#065f46';
  ctx.lineWidth = 4;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Doble contorno para incrementar contraste frente a la grilla.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(boxX + 1, boxY + 1, Math.max(2, boxW - 2), Math.max(2, boxH - 2));
  ctx.restore();

  const cellResolution = resolution;

  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, metadataX, metadataY, metadataW, metadataH, 10);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Metadatos', metadataX + 12, metadataY + 21);

  ctx.font = '14px Arial';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Latitud: ' + target.lat.toFixed(4), metadataX + 12, metadataY + 42);
  ctx.fillText('Longitud: ' + target.lon.toFixed(4), metadataX + 12, metadataY + 62);
  ctx.fillText('Resolución de celdas: ' + (Number.isFinite(cellResolution) ? `${cellResolution}°` : 'N/A'), metadataX + 250, metadataY + 42);
  ctx.fillText('Sistema de referencias: WGS84 (EPSG:4326)', metadataX + 250, metadataY + 62);
}

async function draw1DSelectedCuencaMap(ctx, plotData, layout = {}) {
  const panelX = layout.x ?? 56;
  const panelY = layout.y ?? 170;
  const panelW = layout.w ?? 580;
  const panelH = layout.h ?? 860;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, panelX, panelY, panelW, panelH, 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('MAPA DE CUENCA CONSULTADA', panelX + panelW / 2, panelY + 32);
  ctx.textAlign = 'left';

  const metadataH = 88;
  const metadataX = panelX + 14;
  const metadataY = panelY + panelH - metadataH - 12;
  const metadataW = panelW - 28;

  const mapFrame = {
    x: panelX + 14,
    y: panelY + 48,
    w: panelW - 28,
    h: metadataY - (panelY + 48) - 10,
    pad: 10,
  };

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, mapFrame.x, mapFrame.y, mapFrame.w, mapFrame.h, 10);

  // Resolve selected cuenca DN
  const cuencaDn = plotData?.cuencaDn ?? plotData?.predictionMeta?.cuencaDn ?? null;
  const cuencaNombre = plotData?.cuencaNombre ?? null;

  const cuencasFeatures = await loadCuencasGeoJSON();
  const boundaryCoords = await loadStudyAreaBoundary();
  const allPts = flattenFeatureCoordinates({ features: cuencasFeatures });
  const boundaryLons = boundaryCoords.map((c) => c[0]);
  const boundaryLats = boundaryCoords.map((c) => c[1]);

  const refPts = allPts.length ? allPts : boundaryCoords;
  const ptLons = refPts.map((c) => c[0]);
  const ptLats = refPts.map((c) => c[1]);

  const bounds = {
    minLon: Math.min(...ptLons, ...(boundaryLons.length ? boundaryLons : ptLons)),
    maxLon: Math.max(...ptLons, ...(boundaryLons.length ? boundaryLons : ptLons)),
    minLat: Math.min(...ptLats, ...(boundaryLats.length ? boundaryLats : ptLats)),
    maxLat: Math.max(...ptLats, ...(boundaryLats.length ? boundaryLats : ptLats)),
  };

  const lonPad = (bounds.maxLon - bounds.minLon) * 0.08;
  const latPad = (bounds.maxLat - bounds.minLat) * 0.08;
  bounds.minLon -= lonPad;
  bounds.maxLon += lonPad;
  bounds.minLat -= latPad;
  bounds.maxLat += latPad;

  drawBasemapBackdrop(ctx, mapFrame, bounds);
  await drawLeafletBasemapTiles(ctx, bounds, mapFrame);
  drawProjectBoundary(ctx, boundaryCoords, bounds, mapFrame);

  // Draw all cuencas, highlight the selected one
  ctx.save();
  ctx.beginPath();
  ctx.rect(mapFrame.x + 1, mapFrame.y + 1, mapFrame.w - 2, mapFrame.h - 2);
  ctx.clip();

  cuencasFeatures.forEach((feature) => {
    const dn = Number(feature?.properties?.DN);
    const isSelected = cuencaDn !== null && dn === Number(cuencaDn);
    if (isSelected) return; // draw selected last (on top)
    ctx.globalAlpha = 0.45;
    drawGeoJSONFeature(ctx, feature?.geometry, bounds, mapFrame, 'rgba(148, 163, 184, 0.55)');
  });

  // Draw selected cuenca on top
  cuencasFeatures.forEach((feature) => {
    const dn = Number(feature?.properties?.DN);
    const isSelected = cuencaDn !== null && dn === Number(cuencaDn);
    if (!isSelected) return;
    ctx.globalAlpha = 0.82;
    drawGeoJSONFeature(ctx, feature?.geometry, bounds, mapFrame, 'rgba(16, 185, 129, 0.65)');
    // Thick highlight border
    ctx.globalAlpha = 1;
    if (feature?.geometry?.type === 'Polygon') {
      feature.geometry.coordinates.forEach((ring) => {
        ctx.beginPath();
        drawGeoJSONPolygonRing(ctx, ring, bounds, mapFrame);
        ctx.strokeStyle = '#065f46';
        ctx.lineWidth = 3;
        ctx.stroke();
      });
    } else if (feature?.geometry?.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => {
          ctx.beginPath();
          drawGeoJSONPolygonRing(ctx, ring, bounds, mapFrame);
          ctx.strokeStyle = '#065f46';
          ctx.lineWidth = 3;
          ctx.stroke();
        });
      });
    }
  });

  ctx.globalAlpha = 1;
  ctx.restore();

  // Metadata card at the bottom of the panel
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, metadataX, metadataY, metadataW, metadataH, 10);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Metadatos', metadataX + 12, metadataY + 21);

  const resolvedNombre = cuencaNombre
    || cuencasFeatures.find((f) => Number(f?.properties?.DN) === Number(cuencaDn))?.properties?.Nombre
    || 'N/A';

  ctx.font = '14px Arial';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Cuenca: ' + resolvedNombre, metadataX + 12, metadataY + 42);
  ctx.fillText('DN: ' + (cuencaDn !== null ? cuencaDn : 'N/A'), metadataX + 12, metadataY + 62);
  ctx.fillText('Sistema de referencias: WGS84 (EPSG:4326)', metadataX + 250, metadataY + 42);
  ctx.fillText('Unidad espacial: Cuenca hidrográfica', metadataX + 250, metadataY + 62);
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
function drawAnalysisTypeIndicator(ctx, plotData) {
  const x = 56;
  const y = 112;
  const w = DEFAULT_IMAGE_WIDTH - 112;
  const h = 40;

  const isPrediction = plotData?.type?.startsWith('prediction');
  const isHistoricalPrediction = plotData?.type === 'prediction-history-2d' || plotData?.type === 'prediction-history-1d';
  
  let bgColor, textColor, label;
  
  if (isHistoricalPrediction) {
    bgColor = '#e9d5ff';
    textColor = '#6b21a8';
    label = 'PREDICCIÓN HISTÓRICA';
  } else if (isPrediction) {
    bgColor = '#d1fae5';
    textColor = '#065f46';
    label = 'PREDICCIÓN ACTUAL';
  } else {
    bgColor = '#bfdbfe';
    textColor = '#0c4a6e';
    label = 'ANÁLISIS HISTÓRICO';
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = textColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = textColor;
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 28);
  ctx.textAlign = 'left';
}
async function loadStudyAreaBoundary() {
  try {
    const _bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const response = await fetch(`${_bp}/data/study-area.geojson?t=${Date.now()}`);
    if (!response.ok) return [];
    const geojson = await response.json();
    return flattenFeatureCoordinates(geojson);
  } catch (_error) {
    return [];
  }
}

async function loadCuencasGeoJSON() {
  try {
    const _bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const response = await fetch(`${_bp}/data/Cuencas.geojson?t=${Date.now()}`);
    if (!response.ok) return [];
    const geojson = await response.json();
    return Array.isArray(geojson?.features) ? geojson.features : [];
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
}

function drawGraticule(ctx, bounds, frame) {
  const latLines = 5;
  const lonLines = 6;
  const labelInsetX = 10;
  const labelInsetY = 8;

  const formatLon = (lon) => `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  const formatLat = (lat) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;

  const lonTicks = [];
  const latTicks = [];

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.w, frame.h);
  ctx.clip();

  ctx.strokeStyle = 'rgba(51, 65, 85, 0.75)';
  ctx.lineWidth = 1.1;
  ctx.setLineDash([5, 4]);

  // Líneas de longitud (verticales)
  for (let i = 0; i <= lonLines; i += 1) {
    const lon = bounds.minLon + ((bounds.maxLon - bounds.minLon) * i) / lonLines;
    const pTop = projectToMap(lon, bounds.maxLat, bounds, frame);
    const pBottom = projectToMap(lon, bounds.minLat, bounds, frame);

    ctx.beginPath();
    ctx.moveTo(pTop.x, pTop.y);
    ctx.lineTo(pBottom.x, pBottom.y);
    ctx.stroke();

    lonTicks.push({ lon, x: pBottom.x });
  }

  // Líneas de latitud (horizontales)
  for (let i = 0; i <= latLines; i += 1) {
    const lat = bounds.minLat + ((bounds.maxLat - bounds.minLat) * i) / latLines;
    const pLeft = projectToMap(bounds.minLon, lat, bounds, frame);
    const pRight = projectToMap(bounds.maxLon, lat, bounds, frame);

    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.stroke();

    latTicks.push({ lat, y: pLeft.y });
  }

  ctx.setLineDash([]);
  ctx.restore();

  // Etiquetas de longitud (abajo, más separadas)
  const drawLonLabel = (text, x, y) => {
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y + 18); // +18px más abajo (antes +10)
    ctx.restore();
  };

  // Etiquetas de latitud (rotadas 90° y más a la izquierda)
  const drawLatLabel = (text, x, y) => {
    ctx.save();
    ctx.translate(x - 10, y - 10); // 10px más a la izquierda, 10px más arriba
    ctx.rotate(-Math.PI / 2); // rotar 90° CCW
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  lonTicks.forEach(({ lon, x }) => {
    const lonLabel = formatLon(lon);
    const lonLabelX = clamp(x, frame.x + 40, frame.x + frame.w - 40);
    const lonLabelY = frame.y + frame.h - labelInsetY;
    drawLonLabel(lonLabel, lonLabelX, lonLabelY);
  });

  latTicks.forEach(({ lat, y }) => {
    const latLabel = formatLat(lat);
    const latLabelY = clamp(y + 6, frame.y + 18, frame.y + frame.h - 8);
    drawLatLabel(latLabel, frame.x + labelInsetX - 10, latLabelY);
  });
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

  ctx.strokeStyle = 'rgba(30, 64, 175, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawGeoJSONPolygonRing(ctx, ring, bounds, frame) {
  if (!Array.isArray(ring) || ring.length < 3) return;
  const first = projectToMap(Number(ring[0][0]), Number(ring[0][1]), bounds, frame);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ring.length; i++) {
    const pt = projectToMap(Number(ring[i][0]), Number(ring[i][1]), bounds, frame);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
}

function drawGeoJSONFeature(ctx, geometry, bounds, frame, fillColor) {
  if (!geometry) return;
  const { type, coordinates } = geometry;
  ctx.fillStyle = fillColor || 'rgba(156, 163, 175, 0.5)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  if (type === 'Polygon') {
    ctx.beginPath();
    coordinates.forEach((ring) => drawGeoJSONPolygonRing(ctx, ring, bounds, frame));
    ctx.fill('evenodd');
    ctx.stroke();
  } else if (type === 'MultiPolygon') {
    coordinates.forEach((polygon) => {
      ctx.beginPath();
      polygon.forEach((ring) => drawGeoJSONPolygonRing(ctx, ring, bounds, frame));
      ctx.fill('evenodd');
      ctx.stroke();
    });
  }
}

function drawNorthArrow(ctx, x, y) {
  ctx.save();

  const scale = 1.65;

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(16 * scale)}px Arial`;
  ctx.fillText('N', x, y - 20 * scale);

  // Triangulo de la flecha
  ctx.beginPath();
  ctx.moveTo(x, y - 10 * scale);
  ctx.lineTo(x - 9 * scale, y + 12 * scale);
  ctx.lineTo(x + 9 * scale, y + 12 * scale);
  ctx.closePath();
  ctx.fill();

  // Cuerpo de la flecha
  ctx.beginPath();
  ctx.moveTo(x, y + 12 * scale);
  ctx.lineTo(x, y + 38 * scale);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.6 * scale;
  ctx.stroke();

  ctx.restore();
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
  const panelX = x - 14;
  const panelY = y - 24;
  const panelW = barPx + 28;
  const panelH = 64;

  ctx.save();

  // Barra sólida
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barPx, y);
  ctx.stroke();

  // Marcas y etiquetas
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#0f172a';
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
  drawAnalysisTypeIndicator(ctx, plotData);

  const mapX = 56;
  const mapY = 172; // antes 150, baja el mapa para evitar traslape con la barra
  const mapW = 1300;

  const footerReserve = 90;
  const mapBottom = DEFAULT_IMAGE_HEIGHT - footerReserve;
  const mapH = mapBottom - mapY; // se reduce un poco el alto del mapa

  // Leyenda a la derecha del mapa
  const legendW = 370;
  const legendH = Math.floor((mapH - 24) / 2);
  const legendX = DEFAULT_IMAGE_WIDTH - legendW - 56;
  // const legendY = DEFAULT_IMAGE_HEIGHT - legendH - 40; // Eliminado: ahora legendY es mutable y se asigna más abajo

  // --- Cuadro informativo extendido con leyenda ---
  const infoBoxW = legendW;
  const infoBoxX = DEFAULT_IMAGE_WIDTH - infoBoxW - 56;
  const infoBoxY = mapY + 12;


  // --- El recuadro se extiende hasta el final de la página ---
  const infoBoxMaxWidth = infoBoxW - 44;
  const infoBoxH = DEFAULT_IMAGE_HEIGHT - infoBoxY - 40;


  ctx.save();
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, 10);

  // Declarar dividerY justo antes de su uso
  const dividerY = infoBoxY + Math.floor(infoBoxH / 2);

  // Línea divisoria horizontal en la mitad del recuadro
  ctx.beginPath();
  ctx.moveTo(infoBoxX + 8, dividerY);
  ctx.lineTo(infoBoxX + infoBoxW - 8, dividerY);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Título
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('INFORMACIÓN DE CONSULTA', infoBoxX + 22, infoBoxY + 32);

  // Texto secundario
  ctx.font = '18px Arial';
  ctx.fillStyle = '#334155';

  let infoY = infoBoxY + 60;

  // Función para formatear fecha de YYYY-MM-DD a YYYY/MM/DD
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return dateStr;
    return String(dateStr).replace(/-/g, '/');
  };

  infoY = wrapText(ctx, 'Fecha de consulta: ' + new Date().toLocaleString(), infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  infoY = wrapText(
    ctx,
    'Fecha de visualización: ' +
      (plotData?.isInterval && plotData?.period?.start_date && plotData?.period?.end_date
        ? formatDate(plotData.period.start_date) + ' a ' + formatDate(plotData.period.end_date)
        : formatDate(plotData?.date || 'N/A')),
    infoBoxX + 22,
    infoY,
    infoBoxMaxWidth,
    22
  );

  // Nivel de Agregación / Frecuencia
  const aggregationLevel = analysisState?.indexScale || plotData?.scale || 'N/A';
  const precipitationFrequencyCode = resolvePrecipFrequencyCode(plotData, analysisState);
  const frequencyLabel = precipitationFrequencyCode === 'D' ? 'Diaria' : 'Mensual';

  const selectedCode = analysisState?.droughtIndex || analysisState?.variable || plotData?.variable || plotData?.variable_name || 'N/A';
  const dataKind = resolveDataKind(selectedCode);
  // Calcular resolución una sola vez y pasarla a resolveSatelliteProductLabel y a los metadatos
  let resolucion = null;
  if (typeof plotData?.resolution !== 'undefined' && plotData?.resolution !== null) {
    resolucion = Number(plotData.resolution);
  } else if (typeof analysisState?.spatialResolution !== 'undefined' && analysisState?.spatialResolution !== null) {
    resolucion = Number(analysisState.spatialResolution);
  }
  const satelliteProductLabel = resolveSatelliteProductLabel(plotData, analysisState, resolucion);
  const legendVariableCode = String(dataKind?.code || selectedCode || '')
    .trim()
    .split(/\s*-\s*|\s+/)[0]
    .toLowerCase();
  const legendFrequencyCode = resolvePrecipFrequencyCode(plotData, analysisState);

  infoY = wrapText(
    ctx,
    'Tipo de dato: ' + dataKind.group,
    infoBoxX + 22,
    infoY,
    infoBoxMaxWidth,
    22
  );
  if (dataKind.family) {
    infoY = wrapText(ctx, 'Nivel de Agregación: ' + aggregationLevel + ' meses', infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
    infoY = wrapText(ctx, 'Tipo de índice: ' + dataKind.family, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
    infoY = wrapText(ctx, 'Índice: ' + dataKind.code + ' - ' + dataKind.label, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  } else {
    infoY = wrapText(ctx, 'Frecuencia: ' + frequencyLabel, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
    infoY = wrapText(ctx, 'Variable: ' + dataKind.label, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  }
  // Determinar producto según resolución
  let producto = '';
  if (Number.isFinite(resolucion)) {
    if (Math.abs(resolucion - 0.05) < 0.001) producto = 'CHIRPS';
    else if (Math.abs(resolucion - 0.10) < 0.001) producto = 'IMERG';
    else if (Math.abs(resolucion - 0.25) < 0.001) producto = 'ERA5';
  }
  infoY = wrapText(
    ctx,
    'Producto de análisis satelital consultado: ' + producto,
    infoBoxX + 22,
    infoY,
    infoBoxMaxWidth,
    22
  );

  // --- LEYENDA DENTRO DEL MISMO RECUADRO ---
  // Construcción de groupedLegend y mapLegend antes de su uso
  // La leyenda comienza justo debajo de la línea divisoria
  let legendY = dividerY + 24;
  const groupedLegend = [];
  const mapLegend = new Map();
  cells.forEach((cell) => {
    const key = `${cell?.category || 'Sin categoría'}|${cell?.color || '#CCCCCC'}`;
    const v = Number(cell?.value);
    if (!mapLegend.has(key)) {
      mapLegend.set(key, {
        label: cell?.category || 'Sin categoría',
        color: cell?.color || '#CCCCCC',
        severity: Number.isFinite(Number(cell?.severity)) ? Number(cell.severity) : 999,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        hasValue: false,
      });
    }
    if (Number.isFinite(v)) {
      const item = mapLegend.get(key);
      item.min = Math.min(item.min, v);
      item.max = Math.max(item.max, v);
      item.hasValue = true;
    }
  });
  groupedLegend.push(...mapLegend.values());
  groupedLegend.sort((a, b) => a.severity - b.severity);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('LEYENDA', infoBoxX + 22, legendY);
  legendY += 28;

  if (!groupedLegend.length) {
    const values = cells
      .map((cell) => Number(cell?.value))
      .filter((value) => Number.isFinite(value));
    const minVal = values.length ? Math.min(...values) : null;
    const maxVal = values.length ? Math.max(...values) : null;
    ctx.fillStyle = '#334155';
    ctx.font = '14px Arial';
    // Calcular resolución y fuente una sola vez y mostrarlas juntas
    const resolucion = Number(plotData?.resolution || analysisState?.spatialResolution);
    let fuente = 'N/A';
    if (Math.abs(resolucion - 0.25) < 0.001) fuente = 'ERA5';
    else if (Math.abs(resolucion - 0.10) < 0.001) fuente = 'IMERG';
    else if (Math.abs(resolucion - 0.05) < 0.001) fuente = 'CHIRPS';
    const sistemaCoord = 'WGS84 (EPSG:4326)';

    ctx.fillText(`Fuente de datos: ${fuente}`, metaX, metaY + 22);
    ctx.fillText(`Tamaño de celda: ${Number.isFinite(resolucion) ? resolucion.toFixed(2) : 'N/A'}°`, metaX, metaY + 42);
    ctx.fillText(`Sistema de coordenadas: ${sistemaCoord}`, metaX, metaY + 62);
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 64, 175, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(infoBoxX + 22, legendY, 32, 18);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#334155';
    ctx.font = '15px Arial';
    ctx.fillText('Área de interés', infoBoxX + 64, legendY + 14);
    legendY += 28;
  } else {
    const rowStep = 28;
    for (let index = 0; index < groupedLegend.length; index += 1) {
      const legendEntry = groupedLegend[index];
      if (!legendEntry) continue;
      const fixedRangeText = resolveFixedBackendRange(
        legendVariableCode,
        legendFrequencyCode,
        legendEntry.label
      );
      const indexCode = String(dataKind?.code || legendVariableCode || '').trim().toUpperCase();
      const isIndex =
        METEOROLOGICAL_INDICES.has(indexCode) ||
        HYDROLOGICAL_INDICES.has(indexCode);
      const rangeText = fixedRangeText || (
        isIndex
          ? 'Clasificación backend'
          : (legendEntry.hasValue
              ? legendEntry.min.toFixed(2) + ' a ' + legendEntry.max.toFixed(2)
              : 'N/A')
      );
      ctx.fillStyle = legendEntry.color;
      ctx.fillRect(infoBoxX + 22, legendY, 32, 18);
      ctx.fillStyle = '#334155';
      ctx.font = '13px Arial';
      const rawText = legendEntry.label + ': ' + rangeText;
      const safeText = fitLegendText(ctx, rawText, infoBoxW - 90);
      ctx.fillText(safeText, infoBoxX + 62, legendY + 14);
      legendY += rowStep;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 64, 175, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(infoBoxX + 22, legendY, 32, 18);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#334155';
    ctx.font = '15px Arial';
    ctx.fillText('Área de interés', infoBoxX + 64, legendY + 14);
    legendY += 28;
  }
  ctx.restore();
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

drawBasemapBackdrop(ctx, frame, bounds);
  await drawLeafletBasemapTiles(ctx, bounds, frame);
  drawProjectBoundary(ctx, boundaryCoords, bounds, frame);

  // --- DIBUJA LA LEYENDA DE LA GRILLA FUERA DEL MAPA ---
  ctx.fillStyle = '#64748b';
  ctx.font = '20px Arial';

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
  ctx.globalAlpha = 0.75;
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

drawScaleBar(ctx, bounds, frame);
  // Restaurar elementos de lat/lon, norte y escala, pero sin recuadro de fondo.
  drawGraticule(ctx, bounds, frame);
  drawNorthArrow(ctx, mapX + 36, mapY + 36 + 40);
  drawScaleBar(ctx, bounds, frame);

  ctx.fillStyle = '#334155';
  ctx.font = '15px Arial';

groupedLegend.push(...mapLegend.values());
groupedLegend.sort((a, b) => a.severity - b.severity);

  // --- Metadatos cartográficos en la esquina inferior izquierda ---
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px Arial';

  const metaX = 56;
  const metaY = DEFAULT_IMAGE_HEIGHT - 54;
  ctx.fillText('Metadatos', metaX, metaY);

  ctx.font = '14px Arial';
  const sistemaCoord = 'WGS84 (EPSG:4326)';

  ctx.fillText(`Resolución de celdas: ${Number.isFinite(resolucion) ? resolucion.toFixed(2) : 'N/A'}°`, metaX, metaY + 22);
  ctx.fillText(`Sistema de coordenadas: ${sistemaCoord}`, metaX, metaY + 42);
  ctx.restore();
}

async function draw2DWatershedMap(ctx, plotData, analysisState) {
  const cuencasData = Array.isArray(plotData?.cuencasData) ? plotData.cuencasData : [];
  if (!cuencasData.length) return;

  const colorByDn = new Map(cuencasData.map((c) => [Number(c.dn), c]));

  await draw2DInstitutionalPanel(ctx, plotData);
  drawAnalysisTypeIndicator(ctx, plotData);

  const mapX = 56;
  const mapY = 172;
  const mapW = 1300;
  const footerReserve = 90;
  const mapH = DEFAULT_IMAGE_HEIGHT - footerReserve - mapY;

  const legendW = 370;
  const legendH = Math.floor((mapH - 24) / 2);
  const legendX = DEFAULT_IMAGE_WIDTH - legendW - 56;
  const legendY = DEFAULT_IMAGE_HEIGHT - legendH - 40;
  const infoBoxW = legendW;
  const infoBoxX = DEFAULT_IMAGE_WIDTH - infoBoxW - 56;
  const infoBoxY = mapY + 12;
  const infoBoxH = 250;

  // Info box
  ctx.save();
  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, 10);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('INFORMACIÓN DE CONSULTA', infoBoxX + 22, infoBoxY + 32);

  ctx.font = '18px Arial';
  ctx.fillStyle = '#334155';

  const selectedCode = analysisState?.droughtIndex || analysisState?.variable || plotData?.variable || plotData?.variable_name || 'N/A';
  const dataKind = resolveDataKind(selectedCode);
  const satelliteProductLabel = resolveSatelliteProductLabel(plotData, analysisState);
  const aggregationLevel = analysisState?.indexScale || plotData?.scale || 'N/A';
  const precipitationFrequencyCode = resolvePrecipFrequencyCode(plotData, analysisState);
  const frequencyLabel = precipitationFrequencyCode === 'D' ? 'Diaria' : 'Mensual';
  const infoBoxMaxWidth = infoBoxW - 44;

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return dateStr;
    return String(dateStr).replace(/-/g, '/');
  };

  let infoY = infoBoxY + 60;
  infoY = wrapText(ctx, 'Fecha de consulta: ' + new Date().toLocaleString(), infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  infoY = wrapText(
    ctx,
    'Fecha de visualización: ' +
      (plotData?.isInterval && plotData?.period?.start_date && plotData?.period?.end_date
        ? formatDate(plotData.period.start_date) + ' a ' + formatDate(plotData.period.end_date)
        : formatDate(plotData?.date || 'N/A')),
    infoBoxX + 22, infoY, infoBoxMaxWidth, 22,
  );
  infoY = wrapText(ctx, 'Tipo de dato: ' + dataKind.group, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  if (dataKind.family) {
    infoY = wrapText(ctx, 'Nivel de Agregación: ' + aggregationLevel + ' meses', infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
    infoY = wrapText(ctx, 'Tipo de índice: ' + dataKind.family, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
    infoY = wrapText(ctx, 'Índice: ' + dataKind.code + ' - ' + dataKind.label, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  } else {
    infoY = wrapText(ctx, 'Frecuencia: ' + frequencyLabel, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
    infoY = wrapText(ctx, 'Variable: ' + dataKind.label, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  }
  wrapText(ctx, 'Producto de análisis satelital consultado: ' + satelliteProductLabel, infoBoxX + 22, infoY, infoBoxMaxWidth, 22);
  ctx.restore();

  // Map frame
  const frame = { x: mapX, y: mapY, w: mapW, h: mapH, pad: 12 };
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, mapX, mapY, mapW, mapH, 14);

  // Load cuencas GeoJSON and compute bounds
  const cuencasFeatures = await loadCuencasGeoJSON();
  const allCuencaPoints = flattenFeatureCoordinates({ features: cuencasFeatures });
  const boundaryCoords = await loadStudyAreaBoundary();
  const boundaryLons = boundaryCoords.map((c) => c[0]);
  const boundaryLats = boundaryCoords.map((c) => c[1]);

  const refPts = allCuencaPoints.length ? allCuencaPoints : boundaryCoords;
  const ptLons = refPts.map((c) => c[0]);
  const ptLats = refPts.map((c) => c[1]);

  const bounds = {
    minLon: Math.min(...ptLons, ...(boundaryLons.length ? boundaryLons : ptLons)),
    maxLon: Math.max(...ptLons, ...(boundaryLons.length ? boundaryLons : ptLons)),
    minLat: Math.min(...ptLats, ...(boundaryLats.length ? boundaryLats : ptLats)),
    maxLat: Math.max(...ptLats, ...(boundaryLats.length ? boundaryLats : ptLats)),
  };

  const lonPad = (bounds.maxLon - bounds.minLon) * 0.05;
  const latPad = (bounds.maxLat - bounds.minLat) * 0.05;
  bounds.minLon -= lonPad;
  bounds.maxLon += lonPad;
  bounds.minLat -= latPad;
  bounds.maxLat += latPad;

  drawBasemapBackdrop(ctx, frame, bounds);
  await drawLeafletBasemapTiles(ctx, bounds, frame);
  drawProjectBoundary(ctx, boundaryCoords, bounds, frame);

  // Draw cuenca polygons clipped to map frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2);
  ctx.clip();

  ctx.globalAlpha = 0.85;
  cuencasFeatures.forEach((feature) => {
    const dn = Number(feature?.properties?.DN);
    const cuencaInfo = colorByDn.get(dn);
    const fillColor = cuencaInfo?.color || 'rgba(156, 163, 175, 0.4)';
    drawGeoJSONFeature(ctx, feature?.geometry, bounds, frame, fillColor);
  });

  // Draw cuenca name labels
  ctx.globalAlpha = 1;
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  cuencasFeatures.forEach((feature) => {
    const dn = Number(feature?.properties?.DN);
    const cuencaInfo = colorByDn.get(dn);
    const nombre = feature?.properties?.Nombre || cuencaInfo?.nombre || '';
    if (!nombre) return;
    const pts = flattenFeatureCoordinates({ features: [feature] });
    if (!pts.length) return;
    const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    const { x, y } = projectToMap(cx, cy, bounds, frame);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(nombre, x, y);
    ctx.fillStyle = '#1e293b';
    ctx.fillText(nombre, x, y);
  });
  ctx.textAlign = 'left';
  ctx.restore();

  drawGraticule(ctx, bounds, frame);
  drawNorthArrow(ctx, mapX + 36, mapY + 36 + 40);
  drawScaleBar(ctx, bounds, frame);

  // Legend
  const legendVariableCode = String(dataKind?.code || selectedCode || '').trim().split(/\s*-\s*|\s+/)[0].toLowerCase();
  const legendFrequencyCode = resolvePrecipFrequencyCode(plotData, analysisState);
  const indexCode = String(dataKind?.code || legendVariableCode || '').trim().toUpperCase();
  const isIndex = METEOROLOGICAL_INDICES.has(indexCode) || HYDROLOGICAL_INDICES.has(indexCode);

  const mapLegend = new Map();
  cuencasData.forEach((c) => {
    const key = `${c?.category || 'Sin categoría'}|${c?.color || '#CCCCCC'}`;
    const v = Number(c?.value);
    if (!mapLegend.has(key)) {
      mapLegend.set(key, {
        label: c?.category || 'Sin categoría',
        color: c?.color || '#CCCCCC',
        severity: Number.isFinite(Number(c?.severity)) ? Number(c.severity) : 999,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        hasValue: false,
      });
    }
    if (Number.isFinite(v)) {
      const item = mapLegend.get(key);
      item.min = Math.min(item.min, v);
      item.max = Math.max(item.max, v);
      item.hasValue = true;
    }
  });

  const groupedLegend = [...mapLegend.values()].sort((a, b) => a.severity - b.severity);

  const fitLegendText = (ctx2, text, maxWidth) => {
    if (ctx2.measureText(text).width <= maxWidth) return text;
    const ellipsis = '...';
    let out = text;
    while (out.length > 0 && ctx2.measureText(out + ellipsis).width > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + ellipsis;
  };

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  drawCard(ctx, legendX, legendY, legendW, legendH, 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('LEYENDA', legendX + 22, legendY + 32);

  if (groupedLegend.length) {
    let offsetY = legendY + 60;
    const rowStep = 28;
    const legendBottomLimit = legendY + legendH - 24;
    let hiddenCount = 0;

    for (let i = 0; i < groupedLegend.length; i++) {
      const legendEntry = groupedLegend[i];
      if (!legendEntry) continue;
      if (offsetY + rowStep + rowStep > legendBottomLimit) {
        hiddenCount = groupedLegend.length - i;
        break;
      }
      const fixedRangeText = resolveFixedBackendRange(legendVariableCode, legendFrequencyCode, legendEntry.label);
      const rangeText = fixedRangeText || (
        isIndex
          ? 'Clasificación backend'
          : (legendEntry.hasValue ? legendEntry.min.toFixed(2) + ' a ' + legendEntry.max.toFixed(2) : 'N/A')
      );
      ctx.fillStyle = legendEntry.color;
      ctx.fillRect(legendX + 22, offsetY, 32, 18);
      ctx.fillStyle = '#334155';
      ctx.font = '13px Arial';
      ctx.fillText(fitLegendText(ctx, legendEntry.label + ': ' + rangeText, legendW - 90), legendX + 62, offsetY + 14);
      offsetY += rowStep;
    }

    if (hiddenCount > 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px Arial';
      ctx.fillText('... +' + hiddenCount + ' categorías más', legendX + 22, offsetY + 12);
      offsetY += 20;
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(30, 64, 175, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const areaY = Math.min(offsetY, legendBottomLimit - 20);
    ctx.rect(legendX + 22, areaY, 32, 18);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#334155';
    ctx.font = '15px Arial';
    ctx.fillText('Área de interés', legendX + 64, areaY + 14);
  }

  // Footer metadata
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 15px Arial';
  const wMetaX = 56;
  const wMetaY = DEFAULT_IMAGE_HEIGHT - 54;
  ctx.fillText('Metadatos', wMetaX, wMetaY);
  ctx.font = '14px Arial';
  ctx.fillText('Unidad espacial: Cuencas hidrográficas', wMetaX, wMetaY + 22);
  ctx.fillText('Sistema de coordenadas: WGS84 (EPSG:4326)', wMetaX, wMetaY + 42);
  ctx.restore();
}

function buildWatershedSpatialJson({ plotData, analysisState }) {
  const variable = resolveSelectedVariable(plotData, analysisState);
  const cuencas = Array.isArray(plotData?.cuencasData) ? plotData.cuencasData : [];
  const rows = cuencas.map((c) => ({
    Cuenca_DN: c?.dn ?? null,
    Nombre_Cuenca: c?.nombre ?? null,
    Valor: c?.value ?? null,
    Categoria: c?.category ?? null,
  }));
  return {
    tipo: '2D-cuencas',
    metadata: {
      variable_o_indice: variable,
      fecha_intervalo: resolveTimeInterval(plotData, analysisState),
      fecha: plotData?.date || 'N/A',
      fuente: plotData?.dataSource || analysisState?.dataSource || 'N/A',
    },
    columnas: ['Cuenca_DN', 'Nombre_Cuenca', 'Valor', 'Categoria'],
    datos: rows,
  };
}

export function downloadAnalysisJson({ plotData, analysisState, selectedCell }) {
  const is2D = plotData.type === '2D' || plotData.type === 'prediction-2d' || plotData.type === 'prediction-history-2d';
  let data;
  if (is2D && plotData.isCuencas) {
    data = buildWatershedSpatialJson({ plotData, analysisState });
  } else if (is2D) {
    data = build2DJson({ plotData, analysisState });
  } else {
    data = build1DJson({ plotData, analysisState, selectedCell });
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerFileDownload(blob, sanitizeFilename(plotData?.title) + '.json');
  return {
    fileName: sanitizeFilename(plotData?.title) + '.json',
    rows: is2D && plotData.isCuencas
      ? (Array.isArray(plotData?.cuencasData) ? plotData.cuencasData.length : 0)
      : is2D
        ? (Array.isArray(plotData?.gridCells) ? plotData.gridCells.length : 0)
        : (Array.isArray(plotData?.data) ? plotData.data.length : 0),
    type: 'json',
  };
}