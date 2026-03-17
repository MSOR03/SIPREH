"""
Servicio para consulta de datos hidrológicos de estaciones usando DuckDB.

Reutiliza la infraestructura de HistoricalDataService (DuckDB connection, cache, cloud storage)
pero con lógica de consulta adaptada a estaciones (no celdas de grilla).

La lógica de consulta está dividida en mixins especializados:
- HydroTimeseriesMixin  → query_hydro_timeseries  (hydro_timeseries_mixin.py)
- HydroSpatialMixin     → query_hydro_spatial      (hydro_spatial_mixin.py)
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional

from app.services.hydro_timeseries_mixin import HydroTimeseriesMixin
from app.services.hydro_spatial_mixin import HydroSpatialMixin
from app.services.hydro_constants import (
    HYDRO_STATIONS,
    HYDRO_INDEX_KEYS,
    HYDRO_COLUMN_MAPPING,
    HYDRO_INDEX_DROUGHT_SCALES,
)


class HydroDataService(HydroTimeseriesMixin, HydroSpatialMixin):
    """
    Servicio para consulta de datos hidrológicos de estaciones.

    Delega infraestructura (DuckDB connection, cache, cloud storage)
    al HistoricalDataService existente para evitar duplicación.
    """

    def __init__(self, historical_service):
        """
        Args:
            historical_service: Instancia de HistoricalDataService
        """
        self._historical = historical_service
        self.cache = historical_service.cache

    def _get_connection(self):
        """Reutiliza la conexión DuckDB del servicio histórico."""
        return self._historical._get_connection()

    def _resolve_parquet_source(self, parquet_url: str) -> Dict[str, Any]:
        """Reutiliza la resolución de source del servicio histórico."""
        return self._historical._resolve_parquet_source(parquet_url)

    def _apply_hydro_drought_scale(self, df: pd.DataFrame, index_name: str) -> pd.DataFrame:
        """
        Aplica escala de severidad de sequía para índices hidrológicos.
        Mismo algoritmo vectorizado que HistoricalDataService._apply_drought_scale.
        """
        scale_config = HYDRO_INDEX_DROUGHT_SCALES.get(index_name,
                       HYDRO_INDEX_DROUGHT_SCALES["DEFAULT"])
        bins = scale_config["bins"]
        cats = scale_config["categories"]

        vals = df["value"].values
        finite_bins = np.array(bins[1:-1], dtype=np.float64)
        indices = np.searchsorted(finite_bins, vals, side="right")

        cat_arr = np.empty(len(vals), dtype=object)
        col_arr = np.empty(len(vals), dtype=object)
        sev_arr = np.empty(len(vals), dtype=np.float64)

        for i, cat in enumerate(cats):
            mask = indices == i
            cat_arr[mask] = cat["label"]
            col_arr[mask] = cat["color"]
            sev_arr[mask] = cat["severity"]

        df["category"] = pd.array(cat_arr, dtype="string")
        df["color"] = pd.array(col_arr, dtype="string")
        df["severity"] = pd.array(sev_arr, dtype="Int64")

        null_mask = np.isnan(vals) if vals.dtype.kind == 'f' else df["value"].isna()
        if np.any(null_mask):
            df.loc[null_mask, ["category", "color", "severity"]] = pd.NA
        return df

    def get_stations(self) -> List[Dict[str, Any]]:
        """Retorna la lista de 29 estaciones hidrológicas."""
        return [
            {"codigo": code, **info}
            for code, info in HYDRO_STATIONS.items()
        ]

    def get_indices(self) -> List[Dict[str, Any]]:
        """Retorna el catálogo de índices hidrológicos."""
        return [
            {
                "id": key,
                "name": HYDRO_COLUMN_MAPPING[key]["name"],
                "unit": HYDRO_COLUMN_MAPPING[key]["unit"],
                "category": HYDRO_COLUMN_MAPPING[key]["category"],
            }
            for key in HYDRO_INDEX_KEYS
            if key in HYDRO_COLUMN_MAPPING
        ]
