/**
 * 29 estaciones hidrológicas fijas con coordenadas y nombres.
 * Fuente de verdad para frontend — replica hydro_constants.py del backend.
 */
export const HYDRO_STATIONS = [
  { codigo: '2749',  lat: 4.233333, lon: -74.15,     name: 'RIO ITSMO - BETANIA' },
  { codigo: '2732',  lat: 4.233333, lon: -74.133333,  name: 'RIO TABACO - RECINTO' },
  { codigo: '2731',  lat: 4.1,      lon: -74.233333,  name: 'QDA. LOS AMARILLOS - LA UNION' },
  { codigo: '2705',  lat: 4.116667, lon: -74.2,       name: 'R. CHOCHAL - LAS SOPAS' },
  { codigo: '2701',  lat: 4.183333, lon: -74.183333,  name: 'STA. ROSA - BOQUERON' },
  { codigo: '20759', lat: 4.383333, lon: -74.166667,  name: 'CHISACA - CANALETA PARSHALL' },
  { codigo: '20747', lat: 4.366667, lon: -74.183333,  name: 'R. MUGROSO - EL HERRADERO' },
  { codigo: '20746', lat: 4.383333, lon: -74.183333,  name: 'R. CHISACA - LA TOMA' },
  { codigo: '20725', lat: 4.383333, lon: -74.133333,  name: 'R. CURUBITAL - PTE. AUSTRALIA' },
  { codigo: '20706', lat: 4.416667, lon: -74.15,      name: 'R. TUNJUELO - LA REGADERA' },
  { codigo: '6735',  lat: 4.583333, lon: -73.7,       name: 'QDA. LETICIA - SALIDA T' },
  { codigo: '3702',  lat: 4.633333, lon: -74.05,      name: 'RIO CHUZA - MONTERREDON' },
  { codigo: '3716',  lat: 4.533333, lon: -73.716667,  name: 'RIO GUATIQUIA LETICIA' },
  { codigo: '3715',  lat: 4.483333, lon: -73.716667,  name: 'RIO GUAJARO - NACIMIENTO' },
  { codigo: '3714',  lat: 4.466667, lon: -73.716667,  name: 'QDA BLANCA - NACIMIENTO' },
  { codigo: '3711',  lat: 4.433333, lon: -73.683333,  name: 'QDA. BLANCA - EL CARMEN' },
  { codigo: '3718',  lat: 4.483333, lon: -73.65,      name: 'RIO GUATIQUIA - SAN LU' },
  { codigo: '3709',  lat: 4.466667, lon: -73.683333,  name: 'RIO GUAJARO - CENTRO' },
  { codigo: '3704',  lat: 4.533333, lon: -73.75,      name: 'RIO GUATIQUIA - SAN JOS' },
  { codigo: '20951', lat: 4.633333, lon: -74.083333,  name: 'ARZOBISPO - PARQUE NACIONAL' },
  { codigo: '20949', lat: 4.65,     lon: -74.05,      name: 'QDA. LA VIEJA - VENTANA - CAPTACION' },
  { codigo: '20948', lat: 4.666667, lon: -74.033333,  name: 'QDA. CHICO - TRAMONTI' },
  { codigo: '2745',  lat: 4.4,      lon: -73.783333,  name: 'RIO STA BARBARA LA ESCA' },
  { codigo: '20946', lat: 4.683333, lon: -74.0,       name: 'RIO TEUSACA - PUENTE FRANCIS' },
  { codigo: '20836', lat: 4.566667, lon: -74.15,      name: 'TUNJUELO - AVENIDA BOYACA' },
  { codigo: '20811', lat: 4.8,      lon: -74.1,       name: 'RIO BOGOTA - PUENTE LA VIRGEN' },
  { codigo: '20729', lat: 4.783333, lon: -73.966667,  name: 'RIO TEUSACA - LA CABANA' },
  { codigo: '20705', lat: 4.566667, lon: -74.066667,  name: 'RIO SAN CRISTOBAL - EL DELIRIO' },
  { codigo: '20701', lat: 4.616667, lon: -74.266667,  name: 'RIO TUNJUELO - PUENTE BOSA' },
];

// Lookup por código
export const STATIONS_BY_CODE = Object.fromEntries(
  HYDRO_STATIONS.map(s => [s.codigo, s])
);

// Índices hidrológicos
export const HYDRO_INDICES = [
  { value: 'SDI', label: 'SDI - Índice de Sequía de Caudales' },
  { value: 'SRI', label: 'SRI - Índice de Recurrencia de Sequía' },
  { value: 'MFI', label: 'MFI - Índice de Flujo Mensual' },
  { value: 'DDI', label: 'DDI - Índice de Déficit de Duración' },
  { value: 'HDI', label: 'HDI - Índice de Déficit Hidrológico' },
];

// Índices que NO usan escala (Escala es NULL en el parquet).
// DDI y HDI usan Umbral en vez de Escala y siempre tienen duración.
export const INDICES_WITHOUT_SCALE = new Set(['DDI', 'HDI']);
