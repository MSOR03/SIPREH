"""
Servicio para consulta de datos de prediccion de sequia usando DuckDB.

Consulta el parquet prediction_main (formato long) con columnas:
ds, freq, date, cell_id, lon, lat, var, scale, value,
conf_interp, conf_flag, n_used, neff, q1, q3, iqr_min, iqr_max, horizon
"""
import logging
from typing import Dict, List, Any, Optional, Tuple

from app.services.historical_data_service import HistoricalDataService
from app.services.cache import CacheService
from app.services.cloud_storage import CloudStorageService

logger = logging.getLogger("prediction")


class PredictionDataService:
    """
    Servicio para consulta de predicciones de sequia via DuckDB.
    Reutiliza la conexion DuckDB y categorización de sequia de HistoricalDataService.
    """

    def __init__(
        self,
        historical_service: HistoricalDataService,
        cache_service: Optional[CacheService] = None,
    ):
        self.historical = historical_service
        self.cache = cache_service or CacheService()

    # ------------------------------------------------------------------
    # 1D: serie temporal por celda (12 horizontes)
    # ------------------------------------------------------------------
    def query_timeseries(
        self,
        parquet_url: str,
        cell_id: str,
        var: str,
        scale: int,
    ) -> Dict[str, Any]:
        """
        Retorna los 12 horizontes de prediccion para una celda, indice y escala.
        Cada fila incluye value, q1, q3, iqr_min, iqr_max.
        """
        cache_key = f"pred:ts:{parquet_url}:{cell_id}:{var}:{scale}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        conn = self.historical._get_connection()
        source_info = self.historical._resolve_parquet_source(parquet_url)
        parquet_source = source_info["source_expr"]

        # Parsear cell_id para filtro lat/lon con epsilon
        _eps = 0.0001
        try:
            _lon_s, _lat_s = cell_id.split("_", 1)
            _clon, _clat = float(_lon_s), float(_lat_s)
            cell_filter = (
                f"lat BETWEEN {_clat - _eps} AND {_clat + _eps} "
                f"AND lon BETWEEN {_clon - _eps} AND {_clon + _eps}"
            )
        except ValueError:
            cell_filter = f"cell_id = '{cell_id}'"

        query = f"""
            SELECT
                CAST(horizon AS INTEGER) AS horizon,
                CAST(date AS VARCHAR)    AS date,
                CAST(value AS DOUBLE)    AS value,
                CAST(q1 AS DOUBLE)       AS q1,
                CAST(q3 AS DOUBLE)       AS q3,
                CAST(iqr_min AS DOUBLE)  AS iqr_min,
                CAST(iqr_max AS DOUBLE)  AS iqr_max
            FROM {parquet_source}
            WHERE var = '{var}'
              AND scale = {scale}
              AND {cell_filter}
            ORDER BY horizon
        """

        df = conn.execute(query).fetchdf()

        if df.empty:
            return {
                "var": var,
                "scale": scale,
                "cell_id": cell_id,
                "data": [],
                "statistics": {},
            }

        data = []
        for _, row in df.iterrows():
            data.append({
                "horizon": int(row["horizon"]),
                "date": str(row["date"]).split(" ")[0] if row["date"] else None,
                "value": float(row["value"]) if row["value"] is not None else None,
                "q1": float(row["q1"]) if row["q1"] is not None else None,
                "q3": float(row["q3"]) if row["q3"] is not None else None,
                "iqr_min": float(row["iqr_min"]) if row["iqr_min"] is not None else None,
                "iqr_max": float(row["iqr_max"]) if row["iqr_max"] is not None else None,
            })

        values = [d["value"] for d in data if d["value"] is not None]
        statistics = {}
        if values:
            statistics = {
                "count": len(values),
                "mean": sum(values) / len(values),
                "min": min(values),
                "max": max(values),
            }

        result = {
            "var": var,
            "scale": scale,
            "cell_id": cell_id,
            "data": data,
            "statistics": statistics,
        }

        self.cache.set(cache_key, result, expire=900)
        return result

    # ------------------------------------------------------------------
    # 2D: grid espacial (297 celdas para indice + escala + horizonte)
    # ------------------------------------------------------------------
    def query_spatial(
        self,
        parquet_url: str,
        var: str,
        scale: int,
        horizon: int,
    ) -> Dict[str, Any]:
        """
        Retorna ~297 celdas con value + categoria de sequia para un
        indice, escala y horizonte dado.
        """
        cache_key = f"pred:spatial:{parquet_url}:{var}:{scale}:{horizon}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        conn = self.historical._get_connection()
        source_info = self.historical._resolve_parquet_source(parquet_url)
        parquet_source = source_info["source_expr"]

        query = f"""
            SELECT
                cell_id,
                CAST(lat AS DOUBLE) AS lat,
                CAST(lon AS DOUBLE) AS lon,
                CAST(value AS DOUBLE) AS value
            FROM {parquet_source}
            WHERE var = '{var}'
              AND scale = {scale}
              AND horizon = {horizon}
            ORDER BY cell_id
        """

        df = conn.execute(query).fetchdf()

        if df.empty:
            return {
                "var": var,
                "scale": scale,
                "horizon": horizon,
                "grid_cells": [],
                "statistics": {},
                "bounds": {},
            }

        # Aplicar categorías de sequia (reusa la lógica de historical)
        import pandas as pd
        import numpy as np

        df = self.historical._apply_drought_scale(df, var)

        grid_cells = []
        for _, row in df.iterrows():
            cell = {
                "cell_id": str(row["cell_id"]),
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
                "value": float(row["value"]) if pd.notna(row["value"]) else None,
            }
            if "color" in row and pd.notna(row["color"]):
                cell["color"] = str(row["color"])
            if "category" in row and pd.notna(row["category"]):
                cell["category"] = str(row["category"])
            if "severity" in row and pd.notna(row["severity"]):
                cell["severity"] = int(row["severity"])
            grid_cells.append(cell)

        valid_values = [c["value"] for c in grid_cells if c["value"] is not None]

        # Calcular porcentajes de categoría
        total = len(grid_cells)
        cat_counts = {}
        for c in grid_cells:
            cat = c.get("category", "Sin dato")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

        # Mapear a pct_severe, pct_moderate, pct_normal
        severe_cats = {"Extremadamente Seco", "Severamente Seco"}
        moderate_cats = {"Moderadamente Seco"}
        normal_cats = {"Normal", "Moderadamente Húmedo", "Muy Húmedo", "Extremadamente Húmedo"}

        pct_severe = sum(cat_counts.get(c, 0) for c in severe_cats) / total * 100 if total else 0
        pct_moderate = sum(cat_counts.get(c, 0) for c in moderate_cats) / total * 100 if total else 0
        pct_normal = sum(cat_counts.get(c, 0) for c in normal_cats) / total * 100 if total else 0

        statistics = {
            "count": len(valid_values),
            "unique_cells": total,
            "mean": sum(valid_values) / len(valid_values) if valid_values else None,
            "min": min(valid_values) if valid_values else None,
            "max": max(valid_values) if valid_values else None,
            "pct_severe": round(pct_severe, 1),
            "pct_moderate": round(pct_moderate, 1),
            "pct_normal": round(pct_normal, 1),
            "category_counts": cat_counts,
        }

        bounds = {}
        if valid_values:
            lats = [c["lat"] for c in grid_cells]
            lons = [c["lon"] for c in grid_cells]
            bounds = {
                "min_lat": min(lats),
                "max_lat": max(lats),
                "min_lon": min(lons),
                "max_lon": max(lons),
            }

        result = {
            "var": var,
            "scale": scale,
            "horizon": horizon,
            "grid_cells": grid_cells,
            "statistics": statistics,
            "bounds": bounds,
        }

        self.cache.set(cache_key, result, expire=900)
        return result

    # ------------------------------------------------------------------
    # Celdas unicas del parquet de prediccion (para renderizar en el mapa)
    # ------------------------------------------------------------------
    def query_cells(self, parquet_url: str) -> Dict[str, Any]:
        """
        Retorna la lista de cell_ids unicos del parquet de prediccion.
        Estas son las 297 celdas CHIRPS que se renderizan en el mapa.
        """
        cache_key = f"pred:cells:{parquet_url}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        conn = self.historical._get_connection()
        source_info = self.historical._resolve_parquet_source(parquet_url)
        parquet_source = source_info["source_expr"]

        query = f"""
            SELECT DISTINCT
                cell_id,
                CAST(lat AS DOUBLE) AS lat,
                CAST(lon AS DOUBLE) AS lon
            FROM {parquet_source}
            ORDER BY cell_id
        """

        df = conn.execute(query).fetchdf()

        cells = []
        for _, row in df.iterrows():
            cells.append(str(row["cell_id"]))

        result = {
            "cells": cells,
            "count": len(cells),
            "resolution": 0.05,
        }

        self.cache.set(cache_key, result, expire=3600)
        return result
