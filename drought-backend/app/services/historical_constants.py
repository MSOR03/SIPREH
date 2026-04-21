"""
Constantes y mapeos del servicio de datos históricos de sequía.
Incluye catálogo de variables, archivos parquet y escalas de severidad.
"""
import numpy as np

# Claves de grupos para filtrar el catálogo
DROUGHT_INDEX_KEYS = ["SPI", "SPEI", "RAI", "EDDI", "PDSI"]
HYDROMETEOROLOGICAL_KEYS = ["precip", "tmean", "tmin", "tmax", "pet", "balance"]

# Escalas válidas para índices de sequía (en meses)
VALID_SCALES = [1, 3, 6, 12]
DEFAULT_SCALE = 1

# Fuentes válidas de datos y fuente por defecto
DEFAULT_SOURCE = "OBS_IDW"

# Fuente específica por índice (cuando difiere del default)
SOURCE_BY_INDEX = {
    "EDDI": "PET_HARGREAVES",
    "pet": "PET_HARGREAVES",
}

# Mapeo de columnas reales en los archivos .parquet
COLUMN_MAPPING = {
    # Variables hidrometeorológicas
    "precip":  {"name": "Precipitación",              "unit": "mm",           "category": "meteorological"},
    "tmean":   {"name": "Temperatura Media",           "unit": "°C",           "category": "meteorological"},
    "tmin":    {"name": "Temperatura Mínima",          "unit": "°C",           "category": "meteorological"},
    "tmax":    {"name": "Temperatura Máxima",          "unit": "°C",           "category": "meteorological"},
    "pet":     {"name": "Evapotranspiración Potencial","unit": "mm",           "category": "meteorological"},
    "balance": {"name": "Balance Hídrico",             "unit": "mm",           "category": "hydrological"},
    # Índices de sequía
    "SPI":  {"name": "SPI",  "unit": "adimensional", "category": "meteorological", "supports_prediction": True},
    "SPEI": {"name": "SPEI", "unit": "adimensional", "category": "meteorological", "supports_prediction": True},
    "RAI":  {"name": "RAI",  "unit": "adimensional", "category": "meteorological", "supports_prediction": False},
    "EDDI": {"name": "EDDI", "unit": "adimensional", "category": "meteorological", "supports_prediction": True},
    "PDSI": {"name": "PDSI", "unit": "adimensional", "category": "hydrological",  "supports_prediction": False},
}

# Archivos parquet disponibles con diferentes resoluciones
PARQUET_FILES = {
    "low_res": {
        "name": "Baja Resolución (0.25°)",
        "resolution": 0.25,
        "records": "1M",
        "url_key": "low_res_url"
    },
    "medium_res": {
        "name": "Media Resolución (0.1°)",
        "resolution": 0.1,
        "records": "10M",
        "url_key": "medium_res_url"
    },
    "high_res": {
        "name": "Alta Resolución",
        "resolution": 0.05,
        "records": "50M",
        "url_key": "high_res_url"
    },
}

# Escalas de severidad por índice
# Nota: bins en orden ascendente para pd.cut (intervalos [a,b) con right=False)
INDEX_DROUGHT_SCALES = {
    "DEFAULT": {  # SPI, SPEI, RAI
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
    "PDSI": {
        "bins": [-np.inf, -4.0, -3.0, -2.0, 2.0, 3.0, 4.0, np.inf],
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
    "EDDI": {  # seco positivo, húmedo negativo
        "bins": [-np.inf, -2.0, -1.5, -1.0, 1.0, 1.5, 2.0, np.inf],
        "categories": [
            {"label": "Extremadamente Húmedo", "color": "#000080", "severity": 0},
            {"label": "Muy Húmedo",            "color": "#0000FF", "severity": 1},
            {"label": "Moderadamente Húmedo",  "color": "#00FFFF", "severity": 2},
            {"label": "Normal",                "color": "#00FF00", "severity": 3},
            {"label": "Moderadamente Seco",    "color": "#FFFF00", "severity": 4},
            {"label": "Severamente Seco",      "color": "#FFA500", "severity": 5},
            {"label": "Extremadamente Seco",   "color": "#FF0000", "severity": 6},
        ],
    },
}
VARIABLE_CLASS_SCALES = {
    "pet": {
        "bins": [-np.inf, 3.0, 6.0, 9.0, 12.0, 15.0, np.inf],
        "categories": [
            {"label": "Muy baja", "color": "#08306B", "severity": 0},
            {"label": "Baja", "color": "#2171B5", "severity": 1},
            {"label": "Media-baja", "color": "#6BAED6", "severity": 2},
            {"label": "Media-alta", "color": "#FDBE85", "severity": 3},
            {"label": "Alta", "color": "#F16913", "severity": 4},
            {"label": "Muy alta", "color": "#A50F15", "severity": 5},
        ],
    },
    "tmean": {
        "bins": [-np.inf, 10.0, 11.5, 13.0, 14.5, 16.0, np.inf],
        "categories": [
            {"label": "Muy baja", "color": "#08306B", "severity": 0},
            {"label": "Baja", "color": "#2171B5", "severity": 1},
            {"label": "Media-baja", "color": "#6BAED6", "severity": 2},
            {"label": "Media-alta", "color": "#FDBE85", "severity": 3},
            {"label": "Alta", "color": "#F16913", "severity": 4},
            {"label": "Muy alta", "color": "#A50F15", "severity": 5},
        ],
    },
    "tmin": {
        "bins": [-np.inf, 2.0, 4.0, 6.5, 9.0, 11.0, np.inf],
        "categories": [
            {"label": "Muy baja", "color": "#08306B", "severity": 0},
            {"label": "Baja", "color": "#2171B5", "severity": 1},
            {"label": "Media-baja", "color": "#6BAED6", "severity": 2},
            {"label": "Media-alta", "color": "#FDBE85", "severity": 3},
            {"label": "Alta", "color": "#F16913", "severity": 4},
            {"label": "Muy alta", "color": "#A50F15", "severity": 5},
        ],
    },
    "tmax": {
        "bins": [-np.inf, 16.5, 18.5, 20.5, 22.5, 24.0, np.inf],
        "categories": [
            {"label": "Muy baja", "color": "#08306B", "severity": 0},
            {"label": "Baja", "color": "#2171B5", "severity": 1},
            {"label": "Media-baja", "color": "#6BAED6", "severity": 2},
            {"label": "Media-alta", "color": "#FDBE85", "severity": 3},
            {"label": "Alta", "color": "#F16913", "severity": 4},
            {"label": "Muy alta", "color": "#A50F15", "severity": 5},
        ],
    },
    "precip": {
        "D": {
            "bins": [-np.inf, 10.0, 20.0, 35.0, 50.0, 70.0, np.inf],
            "categories": [
                {"label": "Muy baja", "color": "#BFDDF2", "severity": 0},
                {"label": "Baja", "color": "#93C5E8", "severity": 1},
                {"label": "Media-baja", "color": "#63A7D8", "severity": 2},
                {"label": "Media-alta", "color": "#3D8AC5", "severity": 3},
                {"label": "Alta", "color": "#1F6BA5", "severity": 4},
                {"label": "Muy alta", "color": "#0B4F80", "severity": 5},
            ],
        },
        "M": {
            "bins": [-np.inf, 50.0, 150.0, 250.0, 400.0, 550.0, np.inf],
            "categories": [
                {"label": "Muy baja", "color": "#BFDDF2", "severity": 0},
                {"label": "Baja", "color": "#93C5E8", "severity": 1},
                {"label": "Media-baja", "color": "#63A7D8", "severity": 2},
                {"label": "Media-alta", "color": "#3D8AC5", "severity": 3},
                {"label": "Alta", "color": "#1F6BA5", "severity": 4},
                {"label": "Muy alta", "color": "#0B4F80", "severity": 5},
            ],
        },
    },
}