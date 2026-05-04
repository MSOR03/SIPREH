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

# Fuentes válidas de datos y fuente por defecto (ERA5)
DEFAULT_SOURCE = "OBS_IDW"

# Versión de paleta para invalidar caché cuando cambian colores de categorías.
COLOR_SCALE_VERSION = "2026-04-25-temp-v5"

# Fuente específica por índice (cuando difiere del default)
# SOLO para variables cuya fuente es IGUAL en todos los datasets.
SOURCE_BY_INDEX = {
    "EDDI": "PET_HARGREAVES",
    "pet":  "PET_HARGREAVES",
    # PDSI NO va aquí: en ERA5 usa OBS_IDW, en IMERG/CHIRPS usa SAT_LSCDF
}

# Fuente parquet según dataset (IMERG/CHIRPS). ERA5 usa DEFAULT_SOURCE.
SOURCE_BY_DATA_SOURCE = {
    "IMERG": "SAT_LSCDF",
    "CHIRPS": "SAT_RAW",
}

# Override variable+dataset (mayor precedencia que todo lo demás).
# Usado cuando una variable tiene fuente distinta al default del dataset.
# PDSI en CHIRPS usa SAT_LSCDF (no SAT_RAW como el resto de variables CHIRPS).
SOURCE_BY_VAR_AND_DS: dict = {
    ("PDSI", "CHIRPS"): "SAT_LSCDF",
}

# Índices de sequía que NO usan la columna 'scale' como filtro.
# PDSI no es un índice escalado (no existe PDSI-1, PDSI-3…).
# IMERG/CHIRPS lo almacenan con scale=0 y ERA5 con scale=1;
# filtrar por scale produciría 0 resultados en el dataset equivocado.
NO_SCALE_DROUGHT_INDICES = {"PDSI"}


def get_parquet_source(data_source: str, variable: str) -> str:
    """
    Retorna el valor a filtrar en la columna 'source' del parquet.
    Prioridad:
      1. SOURCE_BY_VAR_AND_DS  (variable + dataset específico)
      2. SOURCE_BY_INDEX       (variable siempre igual en todos los datasets)
      3. SOURCE_BY_DATA_SOURCE (default del dataset)
      4. DEFAULT_SOURCE        (ERA5 / fallback)
    """
    ds_upper = data_source.upper()
    override = SOURCE_BY_VAR_AND_DS.get((variable, ds_upper))
    if override:
        return override
    return SOURCE_BY_INDEX.get(variable) or SOURCE_BY_DATA_SOURCE.get(ds_upper, DEFAULT_SOURCE)


def infer_data_source_from_url(parquet_url: str) -> str:
    """Infiere ERA5/IMERG/CHIRPS a partir del cloud_key o URL del parquet."""
    url_lower = (parquet_url or "").lower()
    if "chirps" in url_lower:
        return "CHIRPS"
    if "imerg" in url_lower:
        return "IMERG"
    return "ERA5"

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

TEMPERATURE_PALETTE_CATEGORIES = [
    {"label": "Muy baja", "color": "#084081", "severity": 0},
    {"label": "Baja", "color": "#2171B5", "severity": 1},
    {"label": "Media-baja", "color": "#6BAED6", "severity": 2},
    {"label": "Media-alta", "color": "#FEE090", "severity": 3},
    {"label": "Alta", "color": "#FC8D59", "severity": 4},
    {"label": "Muy alta", "color": "#D7191C", "severity": 5},
]


def _temperature_palette_copy():
    return [dict(item) for item in TEMPERATURE_PALETTE_CATEGORIES]


VARIABLE_CLASS_SCALES = {
   "pet": {
        "bins": [-np.inf, 3.0, 6.0, 9.0, 12.0, 15.0, np.inf],
        "categories": _temperature_palette_copy(),
    },
    "tmean": {
        "bins": [-np.inf, 10.0, 11.5, 13.0, 14.5, 16.0, np.inf],
        "categories": _temperature_palette_copy(),
    },
    "tmin": {
        "bins": [-np.inf, 2.0, 4.0, 6.5, 9.0, 11.0, np.inf],
        "categories": _temperature_palette_copy(),
    },
    "tmax": {
        "bins": [-np.inf, 16.5, 18.5, 20.5, 22.5, 24.0, np.inf],
        "categories": _temperature_palette_copy(),
    },
     "precip": {
        "D": {
            "bins": [-np.inf, 10.0, 20.0, 35.0, 50.0, 70.0, np.inf],
            "categories": [
                {"label": "Muy baja", "color": "#E60000", "severity": 0},
                {"label": "Baja", "color": "#FF7A00", "severity": 1},
                {"label": "Media-baja", "color": "#FFD400", "severity": 2},
                {"label": "Media-alta", "color": "#73BDF2", "severity": 3},
                {"label": "Alta", "color": "#1E88E5", "severity": 4},
                {"label": "Muy alta", "color": "#0033A0", "severity": 5},
            ],
        },
        "M": {
            "bins": [-np.inf, 50.0, 150.0, 250.0, 400.0, 550.0, np.inf],
            "categories": [
                {"label": "Muy baja", "color": "#E60000", "severity": 0},
                {"label": "Baja", "color": "#FF7A00", "severity": 1},
                {"label": "Media-baja", "color": "#FFD400", "severity": 2},
                {"label": "Media-alta", "color": "#73BDF2", "severity": 3},
                {"label": "Alta", "color": "#1E88E5", "severity": 4},
                {"label": "Muy alta", "color": "#0033A0", "severity": 5},
            ],
        },
    },
}