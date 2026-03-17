"""
Constantes y mapeos para datos hidrológicos de estaciones.
Incluye catálogo de 29 estaciones fijas, índices hidrológicos y escalas de severidad.
"""
import numpy as np

# 29 estaciones hidrológicas fijas
# Cada estación identificada por su código IDEAM
HYDRO_STATIONS = {
    "2749":  {"lat": 4.233333, "lon": -74.15,     "name": "RIO ITSMO - BETANIA"},
    "2732":  {"lat": 4.233333, "lon": -74.133333,  "name": "RIO TABACO - RECINTO"},
    "2731":  {"lat": 4.1,      "lon": -74.233333,  "name": "QDA. LOS AMARILLOS - LA UNION"},
    "2705":  {"lat": 4.116667, "lon": -74.2,       "name": "R. CHOCHAL - LAS SOPAS"},
    "2701":  {"lat": 4.183333, "lon": -74.183333,  "name": "STA. ROSA - BOQUERON"},
    "20759": {"lat": 4.383333, "lon": -74.166667,  "name": "CHISACA - CANALETA PARSHALL"},
    "20747": {"lat": 4.366667, "lon": -74.183333,  "name": "R. MUGROSO - EL HERRADERO"},
    "20746": {"lat": 4.383333, "lon": -74.183333,  "name": "R. CHISACA - LA TOMA"},
    "20725": {"lat": 4.383333, "lon": -74.133333,  "name": "R. CURUBITAL - PTE. AUSTRALIA"},
    "20706": {"lat": 4.416667, "lon": -74.15,      "name": "R. TUNJUELO - LA REGADERA"},
    "6735":  {"lat": 4.583333, "lon": -73.7,       "name": "QDA. LETICIA - SALIDA T"},
    "3702":  {"lat": 4.633333, "lon": -74.05,      "name": "RIO CHUZA - MONTERREDON"},
    "3716":  {"lat": 4.533333, "lon": -73.716667,  "name": "RIO GUATIQUIA LETICIA"},
    "3715":  {"lat": 4.483333, "lon": -73.716667,  "name": "RIO GUAJARO - NACIMIENTO"},
    "3714":  {"lat": 4.466667, "lon": -73.716667,  "name": "QDA BLANCA - NACIMIENTO"},
    "3711":  {"lat": 4.433333, "lon": -73.683333,  "name": "QDA. BLANCA - EL CARMEN"},
    "3718":  {"lat": 4.483333, "lon": -73.65,      "name": "RIO GUATIQUIA - SAN LU"},
    "3709":  {"lat": 4.466667, "lon": -73.683333,  "name": "RIO GUAJARO - CENTRO"},
    "3704":  {"lat": 4.533333, "lon": -73.75,      "name": "RIO GUATIQUIA - SAN JOS"},
    "20951": {"lat": 4.633333, "lon": -74.083333,  "name": "ARZOBISPO - PARQUE NACIONAL"},
    "20949": {"lat": 4.65,     "lon": -74.05,      "name": "QDA. LA VIEJA - VENTANA - CAPTACION"},
    "20948": {"lat": 4.666667, "lon": -74.033333,  "name": "QDA. CHICO - TRAMONTI"},
    "2745":  {"lat": 4.4,      "lon": -73.783333,  "name": "RIO STA BARBARA LA ESCA"},
    "20946": {"lat": 4.683333, "lon": -74.0,       "name": "RIO TEUSACA - PUENTE FRANCIS"},
    "20836": {"lat": 4.566667, "lon": -74.15,      "name": "TUNJUELO - AVENIDA BOYACA"},
    "20811": {"lat": 4.8,      "lon": -74.1,       "name": "RIO BOGOTA - PUENTE LA VIRGEN"},
    "20729": {"lat": 4.783333, "lon": -73.966667,  "name": "RIO TEUSACA - LA CABANA"},
    "20705": {"lat": 4.566667, "lon": -74.066667,  "name": "RIO SAN CRISTOBAL - EL DELIRIO"},
    "20701": {"lat": 4.616667, "lon": -74.266667,  "name": "RIO TUNJUELO - PUENTE BOSA"},
}

# Índices hidrológicos disponibles
HYDRO_INDEX_KEYS = ["SDI", "SRI", "MFI", "DDI", "HDI"]

# Escalas válidas (meses)
HYDRO_VALID_SCALES = [1, 3, 6, 12]
HYDRO_DEFAULT_SCALE = 1

# Índices que NO tienen escala (Escala es siempre NULL en el parquet).
# DDI y HDI usan Umbral (20) en vez de Escala, y siempre tienen
# Fecha_Final + Duracion (son eventos de sequía con rango temporal).
INDICES_WITHOUT_SCALE = {"DDI", "HDI"}

# Mapeo de índices hidrológicos
HYDRO_COLUMN_MAPPING = {
    "SDI": {"name": "SDI - Índice de Sequía de Caudales",        "unit": "adimensional", "category": "hydrological"},
    "SRI": {"name": "SRI - Índice de Recurrencia de Sequía",     "unit": "adimensional", "category": "hydrological"},
    "MFI": {"name": "MFI - Índice de Flujo Mensual",             "unit": "adimensional", "category": "hydrological"},
    "DDI": {"name": "DDI - Índice de Déficit de Duración",       "unit": "adimensional", "category": "hydrological"},
    "HDI": {"name": "HDI - Índice de Déficit Hidrológico",       "unit": "adimensional", "category": "hydrological"},
}

# Escalas de severidad para índices hidrológicos
# Usa los mismos bins estándar que los índices meteorológicos (DEFAULT)
HYDRO_INDEX_DROUGHT_SCALES = {
    "DEFAULT": {
        "bins": [-np.inf, -2.0, -1.5, -1.0, 1.0, 1.5, 2.0, np.inf],
        "categories": [
            {"label": "Extremadamente Seco",   "color": "#FF0000", "severity": 6},
            {"label": "Severamente Seco",      "color": "#FFA500", "severity": 5},
            {"label": "Moderadamente Seco",    "color": "#FFFF00", "severity": 4},
            {"label": "Normal",                "color": "#00FF00", "severity": 3},
            {"label": "Moderadamente Húmedo",  "color": "#00FFFF", "severity": 2},
            {"label": "Muy Húmedo",            "color": "#0000FF", "severity": 1},
            {"label": "Extremadamente Húmedo", "color": "#000080", "severity": 0},
        ],
    },
}
