"""
Servicio para consulta de datos de prediccion de sequia usando DuckDB.

Consulta el parquet prediction_main (formato long) con columnas:
ds, freq, date, cell_id, lon, lat, var, scale, value,
conf_interp, conf_flag, n_used, neff, q1, q3, iqr_min, iqr_max, horizon
"""
import logging
from datetime import date
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple

from app.services.historical_data_service import HistoricalDataService
from app.services.cache import CacheService
from app.services.cloud_storage import CloudStorageService
from app.services.watershed_relations import (
    get_relations_for_source,
    CUENCA_NAMES,
)

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

    @staticmethod
    def _month_start(d: date) -> date:
        return date(d.year, d.month, 1)

    @staticmethod
    def _add_months(d: date, months: int) -> date:
        total = (d.year * 12 + (d.month - 1)) + months
        year = total // 12
        month = (total % 12) + 1
        return date(year, month, 1)

    def _resolve_effective_horizon_for_consultation(
        self,
        conn,
        parquet_source: str,
        var: str,
        scale: int,
        requested_horizon: int,
        consultation_date: Optional[date],
    ) -> int:
        """
        Mapea horizonte solicitado (Hn) al horizonte cuyo mes de prediccion
        coincide con fecha_consulta + n meses (H1 = mes siguiente).

        Nota: no usamos MIN(date) por horizonte porque algunos archivos pueden
        contener fechas atipicas en pocas filas que sesgan el mapeo global.
        En su lugar, tomamos el mes predominante por horizonte (mayor frecuencia
        de filas) y mapeamos contra ese mes representativo.
        """
        if requested_horizon < 1:
            return requested_horizon

        base_date = self._month_start(consultation_date or date.today())
        target_month = self._add_months(base_date, requested_horizon)

        q = f"""
            WITH month_counts AS (
                SELECT
                    CAST(horizon AS INTEGER) AS horizon,
                    DATE_TRUNC('month', CAST(date AS DATE)) AS pred_month_start,
                    COUNT(*) AS n_rows,
                    ROW_NUMBER() OVER (
                        PARTITION BY CAST(horizon AS INTEGER)
                        ORDER BY COUNT(*) DESC, DATE_TRUNC('month', CAST(date AS DATE)) ASC
                    ) AS rn
                FROM {parquet_source}
                WHERE var = '{var}'
                  AND scale = {scale}
                  AND date IS NOT NULL
                GROUP BY CAST(horizon AS INTEGER), DATE_TRUNC('month', CAST(date AS DATE))
            )
            SELECT
                horizon,
                pred_month_start AS pred_date
            FROM month_counts
            WHERE rn = 1
            ORDER BY horizon
        """
        horizon_df = conn.execute(q).fetchdf()
        if horizon_df.empty:
            return requested_horizon

        horizon_df["pred_date"] = pd.to_datetime(horizon_df["pred_date"], errors="coerce")
        horizon_df = horizon_df.dropna(subset=["pred_date"])
        if horizon_df.empty:
            return requested_horizon

        horizon_df["pred_month"] = horizon_df["pred_date"].dt.to_period("M")
        target_period = pd.Period(target_month, freq="M")
        exact = horizon_df[horizon_df["pred_month"] == target_period]
        if not exact.empty:
            return int(exact.iloc[0]["horizon"])

        return requested_horizon

    # ------------------------------------------------------------------
    # 1D: serie temporal por celda (12 horizontes)
    # ------------------------------------------------------------------
    def query_timeseries(
        self,
        parquet_url: str,
        cell_id: str,
        var: str,
        scale: int,
        base_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Retorna los 12 horizontes de prediccion para una celda, indice y escala.
        Cada fila incluye value, q1, q3, iqr_min, iqr_max.
        """
        base_tag = base_date.isoformat() if base_date else "na"
        cache_key = f"pred:ts:{parquet_url}:{cell_id}:{var}:{scale}:{base_tag}"
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
            row_horizon = int(row["horizon"])
            if base_date:
                row_date = self._add_months(base_date, row_horizon)
            else:
                row_date = pd.to_datetime(row["date"], errors="coerce")
            data.append({
                "horizon": row_horizon,
                "date": row_date.strftime("%Y-%m-%d") if pd.notna(row_date) else None,
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
        include_anomaly: bool = False,
        map_metric: str = "spi",
        clim_start_year: int = 1991,
        clim_end_year: int = 2020,
        historical_parquet_url: Optional[str] = None,
        align_to_consultation_month: bool = False,
        consultation_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Retorna ~297 celdas para indice, escala y horizonte.
        Soporta calculo de anomalia de precipitacion basado en SPI.
        """
        map_metric = str(map_metric or "spi").strip().lower()

        if map_metric not in {"spi", "anomaly"}:
            raise ValueError("map_metric debe ser 'spi' o 'anomaly'")

        if clim_start_year > clim_end_year:
            raise ValueError("clim_start_year no puede ser mayor que clim_end_year")

        if map_metric == "anomaly":
            include_anomaly = True

        consultation_tag = (consultation_date or date.today()).strftime("%Y-%m") if align_to_consultation_month else "na"
        cache_key = (
            f"pred:spatial:v5:{parquet_url}:{var}:{scale}:{horizon}:{consultation_tag}:"
            f"{int(include_anomaly)}:{map_metric}:{clim_start_year}:{clim_end_year}"
        )
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        conn = self.historical._get_connection()
        source_info = self.historical._resolve_parquet_source(parquet_url)
        parquet_source = source_info["source_expr"]

        effective_horizon = horizon
        target_month = None
        if align_to_consultation_month and consultation_date:
            target_month = self._add_months(self._month_start(consultation_date), horizon)

        if target_month is not None:
            target_month_iso = target_month.isoformat()
            query = f"""
                WITH monthly_candidates AS (
                    SELECT
                        cell_id,
                        CAST(date AS DATE) AS pred_date,
                        CAST(lat AS DOUBLE) AS lat,
                        CAST(lon AS DOUBLE) AS lon,
                        CAST(value AS DOUBLE) AS value,
                        CAST(horizon AS INTEGER) AS src_horizon,
                        ROW_NUMBER() OVER (
                            PARTITION BY cell_id
                            ORDER BY ABS(CAST(horizon AS INTEGER) - {horizon}) ASC,
                                     CAST(horizon AS INTEGER) ASC
                        ) AS rn
                    FROM {parquet_source}
                    WHERE var = '{var}'
                      AND scale = {scale}
                      AND DATE_TRUNC('month', CAST(date AS DATE)) = DATE '{target_month_iso}'
                )
                SELECT
                    cell_id,
                    pred_date,
                    lat,
                    lon,
                    value,
                    src_horizon
                FROM monthly_candidates
                WHERE rn = 1
                ORDER BY cell_id
            """
        else:
            query = f"""
                SELECT
                    cell_id,
                    CAST(date AS DATE) AS pred_date,
                    CAST(lat AS DOUBLE) AS lat,
                    CAST(lon AS DOUBLE) AS lon,
                    CAST(value AS DOUBLE) AS value,
                    CAST(horizon AS INTEGER) AS src_horizon
                FROM {parquet_source}
                WHERE var = '{var}'
                  AND scale = {scale}
                  AND horizon = {effective_horizon}
                ORDER BY cell_id
            """

        df = conn.execute(query).fetchdf()

        if df.empty and target_month is not None:
            # Fallback defensivo para parquets sin cobertura del mes objetivo.
            effective_horizon = self._resolve_effective_horizon_for_consultation(
                conn=conn,
                parquet_source=parquet_source,
                var=var,
                scale=scale,
                requested_horizon=horizon,
                consultation_date=consultation_date,
            )

            query = f"""
                SELECT
                    cell_id,
                    CAST(date AS DATE) AS pred_date,
                    CAST(lat AS DOUBLE) AS lat,
                    CAST(lon AS DOUBLE) AS lon,
                    CAST(value AS DOUBLE) AS value,
                    CAST(horizon AS INTEGER) AS src_horizon
                FROM {parquet_source}
                WHERE var = '{var}'
                  AND scale = {scale}
                  AND horizon = {effective_horizon}
                ORDER BY cell_id
            """
            df = conn.execute(query).fetchdf()

        if df.empty:
            return {
                "var": var,
                "scale": scale,
                "horizon": horizon,
                "effective_horizon": effective_horizon,
                "grid_cells": [],
                "statistics": {},
                "bounds": {},
            }

        anomaly_requested = include_anomaly or (map_metric == "anomaly")
        if anomaly_requested and var.upper() != "SPI":
            raise ValueError("La anomalia solo esta soportada para var='SPI'")

        anomaly_metadata = None
        if anomaly_requested:
            if scale != horizon:
                if map_metric == "anomaly":
                    raise ValueError(
                        "La anomalia solo se puede calcular cuando scale == horizon "
                        "(1-1, 3-3, 6-6, 12-12)"
                    )

                df["climatology_mean_precip"] = np.nan
                df["climatology_std_precip"] = np.nan
                df["climatology_std_spi"] = np.nan
                df["spi_value"] = pd.to_numeric(df["value"], errors="coerce")
                df["anomaly_value"] = np.nan
                anomaly_metadata = {
                    "enabled": False,
                    "map_metric": map_metric,
                    "reason": "scale_horizon_mismatch",
                    "detail": "La anomalia solo se calcula cuando scale == horizon",
                    "required_pairs": ["1-1", "3-3", "6-6", "12-12"],
                    "requested": {"scale": scale, "horizon": horizon},
                    "climatology_period": {
                        "start_year": clim_start_year,
                        "end_year": clim_end_year,
                    },
                }
            elif not historical_parquet_url:
                logger.warning("No historical dataset available for anomaly calculation. Returning SPI values only.")
                df["climatology_mean_precip"] = np.nan
                df["climatology_std_precip"] = np.nan
                df["climatology_std_spi"] = np.nan
                df["spi_value"] = pd.to_numeric(df["value"], errors="coerce")
                df["anomaly_value"] = np.nan
                anomaly_metadata = {
                    "enabled": False,
                    "map_metric": map_metric,
                    "reason": "historical_dataset_not_found",
                    "historical_var": "precip",
                    "climatology_period": {
                        "start_year": clim_start_year,
                        "end_year": clim_end_year,
                    },
                }
            else:
                hist_source_info = self.historical._resolve_parquet_source(historical_parquet_url)
                hist_source = hist_source_info["source_expr"]

                # Regla de negocio de horizontes: la climatologia se evalua
                # desplazando el mes de emision por el horizonte solicitado.
                # Ejemplo: emision enero + H12 => enero del anio siguiente,
                # por lo que 1991-2020 pasa a 1992-2021 (mismo mes).
                if consultation_date:
                    base_month = self._month_start(consultation_date)
                    clim_start_shifted = self._add_months(date(clim_start_year, base_month.month, 1), horizon)
                    clim_end_shifted = self._add_months(date(clim_end_year, base_month.month, 1), horizon)
                    clim_filter_month = clim_start_shifted.month
                    clim_filter_start_year = clim_start_shifted.year
                    clim_filter_end_year = clim_end_shifted.year
                else:
                    # Fallback defensivo: usar el mes de prediccion seleccionado.
                    pred_month_fallback = None
                    if not df.empty and "pred_date" in df.columns:
                        pred_series = pd.to_datetime(df["pred_date"], errors="coerce").dropna()
                        if not pred_series.empty:
                            pred_month_fallback = int(pred_series.iloc[0].month)

                    clim_filter_month = pred_month_fallback or 1
                    clim_filter_start_year = clim_start_year
                    clim_filter_end_year = clim_end_year

                clim_query = f"""
                    WITH precip_base AS (
                        SELECT
                            cell_id,
                            CAST(date AS DATE) AS obs_date,
                            CAST(EXTRACT(YEAR FROM CAST(date AS DATE)) AS INTEGER) AS clim_year,
                            CAST(EXTRACT(MONTH FROM CAST(date AS DATE)) AS INTEGER) AS clim_month,
                            CAST(ROUND(CAST(lat AS DOUBLE), 4) AS DOUBLE) AS clim_lat4,
                            CAST(ROUND(CAST(lon AS DOUBLE), 4) AS DOUBLE) AS clim_lon4,
                            AVG(TRY_CAST(value AS DOUBLE)) AS precip_value
                        FROM {hist_source}
                        WHERE UPPER(CAST(var AS VARCHAR)) IN ('PRECIP', 'PRECIPITATION', 'PREC')
                          AND UPPER(CAST(source AS VARCHAR)) = 'SAT_RAW'
                          AND (freq IS NULL OR UPPER(CAST(freq AS VARCHAR)) IN ('M', 'MON', 'MONTH', 'MONTHLY'))
                          AND value IS NOT NULL
                        GROUP BY
                            cell_id,
                            CAST(date AS DATE),
                            CAST(EXTRACT(YEAR FROM CAST(date AS DATE)) AS INTEGER),
                            CAST(EXTRACT(MONTH FROM CAST(date AS DATE)) AS INTEGER),
                            CAST(ROUND(CAST(lat AS DOUBLE), 4) AS DOUBLE),
                            CAST(ROUND(CAST(lon AS DOUBLE), 4) AS DOUBLE)
                    ),
                    precip_rolling AS (
                        SELECT
                            cell_id,
                            obs_date,
                            clim_year,
                            clim_month,
                            clim_lat4,
                            clim_lon4,
                            SUM(precip_value) OVER (
                                PARTITION BY cell_id
                                ORDER BY obs_date
                                ROWS BETWEEN {scale - 1} PRECEDING AND CURRENT ROW
                            ) AS precip_agg_value,
                            COUNT(precip_value) OVER (
                                PARTITION BY cell_id
                                ORDER BY obs_date
                                ROWS BETWEEN {scale - 1} PRECEDING AND CURRENT ROW
                            ) AS precip_agg_count
                        FROM precip_base
                        WHERE precip_value IS NOT NULL
                          AND isfinite(precip_value)
                    ),
                    clim_samples AS (
                        SELECT
                            cell_id,
                            clim_month,
                            clim_lat4,
                            clim_lon4,
                            clim_year,
                            precip_agg_value
                        FROM precip_rolling
                        WHERE precip_agg_count = {scale}
                          AND clim_month = {clim_filter_month}
                          AND clim_year BETWEEN {clim_filter_start_year} AND {clim_filter_end_year}
                    )
                    SELECT
                        cell_id,
                        clim_month,
                        clim_lat4,
                        clim_lon4,
                        AVG(precip_agg_value) AS climatology_mean_precip,
                        COALESCE(STDDEV_SAMP(precip_agg_value), STDDEV_POP(precip_agg_value)) AS climatology_std_precip,
                        COUNT(*) AS climatology_n_years
                    FROM clim_samples
                    WHERE precip_agg_value IS NOT NULL
                      AND isfinite(precip_agg_value)
                    GROUP BY cell_id, clim_month, clim_lat4, clim_lon4
                """

                clim_query_error = None
                try:
                    clim_df = conn.execute(clim_query).fetchdf()
                except Exception as exc:
                    # No bloquear el mapa SPI si la climatologia falla por valores historicos atipicos.
                    logger.warning(
                        "Climatology query failed for anomaly calculation (scale=%s, period=%s-%s): %s",
                        scale,
                        clim_start_year,
                        clim_end_year,
                        str(exc),
                    )
                    clim_df = pd.DataFrame()
                    clim_query_error = str(exc)

                df["pred_date"] = pd.to_datetime(df["pred_date"], errors="coerce")
                if consultation_date:
                    # Cuando la consulta se ancla a la fecha de emision, la climatologia
                    # debe usar el mes desplazado por el horizonte, no el mes crudo de la fila.
                    df["clim_month"] = int(clim_filter_month)
                else:
                    df["clim_month"] = df["pred_date"].dt.month.astype("Int64")
                df["pred_lat4"] = pd.to_numeric(df["lat"], errors="coerce").round(4)
                df["pred_lon4"] = pd.to_numeric(df["lon"], errors="coerce").round(4)

                if not clim_df.empty:
                    clim_by_cell = (
                        clim_df[["cell_id", "clim_month", "climatology_mean_precip", "climatology_std_precip", "climatology_n_years"]]
                        .dropna(subset=["climatology_std_precip"])
                        .groupby(["cell_id", "clim_month"], as_index=False)[["climatology_mean_precip", "climatology_std_precip", "climatology_n_years"]]
                        .mean()
                    )
                    df = df.merge(clim_by_cell, on=["cell_id", "clim_month"], how="left")

                    missing_mask = df["climatology_std_precip"].isna()
                    if missing_mask.any():
                        clim_by_coord = (
                            clim_df[["clim_lat4", "clim_lon4", "clim_month", "climatology_mean_precip", "climatology_std_precip", "climatology_n_years"]]
                            .dropna(subset=["climatology_std_precip"])
                            .groupby(["clim_lat4", "clim_lon4", "clim_month"], as_index=False)[["climatology_mean_precip", "climatology_std_precip", "climatology_n_years"]]
                            .mean()
                        )
                        fallback_df = df.loc[missing_mask, ["pred_lat4", "pred_lon4", "clim_month"]].merge(
                            clim_by_coord,
                            left_on=["pred_lat4", "pred_lon4", "clim_month"],
                            right_on=["clim_lat4", "clim_lon4", "clim_month"],
                            how="left",
                        )
                        df.loc[missing_mask, "climatology_mean_precip"] = fallback_df["climatology_mean_precip"].values
                        df.loc[missing_mask, "climatology_std_precip"] = fallback_df["climatology_std_precip"].values
                        df.loc[missing_mask, "climatology_n_years"] = fallback_df["climatology_n_years"].values
                else:
                    df["climatology_mean_precip"] = np.nan
                    df["climatology_std_precip"] = np.nan
                    df["climatology_n_years"] = np.nan

                df["spi_value"] = pd.to_numeric(df["value"], errors="coerce")
                df["anomaly_value"] = df["spi_value"] * pd.to_numeric(df["climatology_std_precip"], errors="coerce")
                # Compatibilidad hacia atrás con clientes que esperan este campo.
                df["climatology_std_spi"] = pd.to_numeric(df["climatology_std_precip"], errors="coerce")

                if map_metric == "anomaly":
                    if df["anomaly_value"].notna().sum() == 0:
                        raise ValueError("No hay datos climatologicos suficientes para mapear anomalia")
                    df["value"] = df["anomaly_value"]

                anomaly_metadata = {
                    "enabled": clim_query_error is None,
                    "map_metric": map_metric,
                    "formula": "anomaly = SPI_pred * std_precip_agg",
                    "historical_var": "precip",
                    "aggregation_window_months": scale,
                    "required_condition": "scale == horizon",
                    "climatology_period": {
                        "start_year": clim_filter_start_year,
                        "end_year": clim_filter_end_year,
                        "month": clim_filter_month,
                    },
                }
                if clim_query_error is not None:
                    anomaly_metadata["reason"] = "climatology_query_failed"
                    anomaly_metadata["detail"] = clim_query_error
        else:
            df["spi_value"] = pd.to_numeric(df["value"], errors="coerce")
            df["climatology_mean_precip"] = np.nan
            df["climatology_std_precip"] = np.nan
            df["climatology_std_spi"] = np.nan
            df["anomaly_value"] = np.nan

        if map_metric == "spi":
            df = self.historical._apply_drought_scale(df, var)
        else:
            vals = pd.to_numeric(df["value"], errors="coerce").values
            valid_mask = np.isfinite(vals)
            if valid_mask.any():
                vmax = float(np.max(np.abs(vals[valid_mask])))
                if vmax <= 0:
                    vmax = 1.0

                colors = []
                for v in vals:
                    if not np.isfinite(v):
                        colors.append("#CCCCCC")
                        continue
                    ratio = min(abs(float(v)) / vmax, 1.0)
                    if v < 0:
                        r, g, b = 220, int(220 * (1 - ratio)), int(220 * (1 - ratio))
                    elif v > 0:
                        r, g, b = int(220 * (1 - ratio)), int(220 * (1 - ratio)), 220
                    else:
                        r, g, b = 200, 200, 200
                    colors.append(f"#{r:02X}{g:02X}{b:02X}")
                df["color"] = colors
            else:
                df["color"] = "#CCCCCC"
            df["category"] = pd.NA
            df["severity"] = pd.NA

        grid_cells = []
        for _, row in df.iterrows():
            cell = {
                "cell_id": str(row["cell_id"]),
                "lat": float(row["lat"]),
                "lon": float(row["lon"]),
                "value": float(row["value"]) if pd.notna(row["value"]) else None,
                "spi_value": float(row["spi_value"]) if pd.notna(row.get("spi_value")) else None,
                "climatology_std_spi": float(row["climatology_std_spi"]) if pd.notna(row.get("climatology_std_spi")) else None,
                "climatology_mean_precip": float(row["climatology_mean_precip"]) if pd.notna(row.get("climatology_mean_precip")) else None,
                "climatology_std_precip": float(row["climatology_std_precip"]) if pd.notna(row.get("climatology_std_precip")) else None,
                "anomaly_value": float(row["anomaly_value"]) if pd.notna(row.get("anomaly_value")) else None,
                "metric": map_metric,
            }
            if "color" in row and pd.notna(row["color"]):
                cell["color"] = str(row["color"])
            if "category" in row and pd.notna(row["category"]):
                cell["category"] = str(row["category"])
            if "severity" in row and pd.notna(row["severity"]):
                cell["severity"] = int(row["severity"])
            grid_cells.append(cell)

        valid_values = [c["value"] for c in grid_cells if c["value"] is not None]
        total = len(grid_cells)

        if map_metric == "spi":
            cat_counts = {}
            for c in grid_cells:
                cat = c.get("category", "Sin dato")
                cat_counts[cat] = cat_counts.get(cat, 0) + 1

            severe_cats = {"Extremadamente Seco", "Severamente Seco"}
            moderate_cats = {"Moderadamente Seco"}
            normal_cats = {"Normal", "Moderadamente Húmedo", "Muy Húmedo", "Extremadamente Húmedo"}

            pct_severe = sum(cat_counts.get(c, 0) for c in severe_cats) / total * 100 if total else 0
            pct_moderate = sum(cat_counts.get(c, 0) for c in moderate_cats) / total * 100 if total else 0
            pct_normal = sum(cat_counts.get(c, 0) for c in normal_cats) / total * 100 if total else 0

            statistics = {
                "metric": map_metric,
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
        else:
            statistics = {
                "metric": map_metric,
                "count": len(valid_values),
                "unique_cells": total,
                "mean": sum(valid_values) / len(valid_values) if valid_values else None,
                "min": min(valid_values) if valid_values else None,
                "max": max(valid_values) if valid_values else None,
                "category_counts": {},
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
            "effective_horizon": effective_horizon,
            "target_month": target_month.isoformat() if target_month is not None else None,
            "map_metric": map_metric,
            "grid_cells": grid_cells,
            "statistics": statistics,
            "bounds": bounds,
            "anomaly_metadata": anomaly_metadata,
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

    # ------------------------------------------------------------------
    # 2D CUENCAS: datos espaciales agregados por cuenca (ponderado por área)
    # ------------------------------------------------------------------
    def query_watershed_spatial(
        self,
        parquet_url: str,
        var: str,
        scale: int,
        horizon: int,
    ) -> Dict[str, Any]:
        """
        Retorna las 7 cuencas con valor ponderado por area para un horizonte.
        Solo usa celdas CHIRPS que intersectan con las cuencas.
        """
        cache_key = f"pred:ws_spatial:{parquet_url}:{var}:{scale}:{horizon}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        conn = self.historical._get_connection()
        source_info = self.historical._resolve_parquet_source(parquet_url)
        parquet_source = source_info["source_expr"]

        relations = get_relations_for_source("CHIRPS")
        all_cell_ids = list({r["cell_id"] for r in relations})
        cell_list_sql = ", ".join(f"'{c}'" for c in all_cell_ids)

        query = f"""
            SELECT
                cell_id,
                CAST(value AS DOUBLE) AS value
            FROM {parquet_source}
            WHERE var = '{var}'
              AND scale = {scale}
              AND horizon = {horizon}
              AND cell_id IN ({cell_list_sql})
        """
        df = conn.execute(query).fetchdf()

        cell_values = {}
        for _, row in df.iterrows():
            cid = str(row["cell_id"])
            val = row["value"]
            if val is not None and np.isfinite(val):
                cell_values[cid] = float(val)

        # Aggregate per cuenca
        cuencas = []
        all_vals = []
        for dn in range(1, 8):
            cuenca_rels = [r for r in relations if r["dn"] == dn]
            weighted_sum = 0.0
            total_area = 0.0
            cell_count = 0
            for r in cuenca_rels:
                val = cell_values.get(r["cell_id"])
                if val is not None:
                    weighted_sum += val * r["area_m2"]
                    total_area += r["area_m2"]
                    cell_count += 1

            avg_val = (weighted_sum / total_area) if total_area > 0 else None
            cuenca = {
                "dn": dn,
                "nombre": CUENCA_NAMES.get(dn, f"Cuenca {dn}"),
                "value": round(avg_val, 4) if avg_val is not None else None,
                "cell_count": cell_count,
                "color": None,
                "category": None,
                "severity": None,
            }
            if avg_val is not None:
                all_vals.append(avg_val)
            cuencas.append(cuenca)

        # Apply drought scale coloring
        if cuencas:
            temp_df = pd.DataFrame([{"value": c["value"]} for c in cuencas])
            temp_df["value"] = pd.to_numeric(temp_df["value"], errors="coerce")
            temp_df = self.historical._apply_drought_scale(temp_df, var)
            for i, c in enumerate(cuencas):
                row = temp_df.iloc[i]
                if pd.notna(row.get("color")):
                    c["color"] = str(row["color"])
                if pd.notna(row.get("category")):
                    c["category"] = str(row["category"])
                if pd.notna(row.get("severity")):
                    c["severity"] = int(row["severity"])

        statistics = {
            "mean": float(np.mean(all_vals)) if all_vals else None,
            "min": float(np.min(all_vals)) if all_vals else None,
            "max": float(np.max(all_vals)) if all_vals else None,
            "count": len(all_vals),
        }

        result = {
            "var": var,
            "scale": scale,
            "horizon": horizon,
            "cuencas": cuencas,
            "statistics": statistics,
        }

        self.cache.set(cache_key, result, expire=900)
        return result

    # ------------------------------------------------------------------
    # 1D CUENCAS: serie por horizonte para una cuenca (ponderado por área)
    # ------------------------------------------------------------------
    def query_watershed_timeseries(
        self,
        parquet_url: str,
        var: str,
        scale: int,
        cuenca_dn: int,
        base_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Retorna los 12 horizontes ponderados por area para una cuenca.
        Incluye value, q1, q3, iqr_min, iqr_max.
        """
        base_tag = base_date.isoformat() if base_date else "na"
        cache_key = f"pred:ws_ts:{parquet_url}:{var}:{scale}:{cuenca_dn}:{base_tag}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        conn = self.historical._get_connection()
        source_info = self.historical._resolve_parquet_source(parquet_url)
        parquet_source = source_info["source_expr"]

        relations = get_relations_for_source("CHIRPS")
        cuenca_rels = [r for r in relations if r["dn"] == cuenca_dn]
        if not cuenca_rels:
            raise ValueError(f"No hay relaciones para cuenca DN={cuenca_dn} con fuente CHIRPS")

        cell_areas = {r["cell_id"]: r["area_m2"] for r in cuenca_rels}
        cell_list_sql = ", ".join(f"'{c}'" for c in cell_areas)

        # Build VALUES for areas to push weighted avg into SQL
        values_parts = [f"('{cid}', {area})" for cid, area in cell_areas.items()]
        values_clause = ", ".join(values_parts)

        query = f"""
            WITH cell_values AS (
                SELECT
                    CAST(horizon AS INTEGER) AS horizon,
                    CAST(date AS VARCHAR) AS date,
                    cell_id,
                    CAST(value AS DOUBLE) AS value,
                    CAST(q1 AS DOUBLE) AS q1,
                    CAST(q3 AS DOUBLE) AS q3,
                    CAST(iqr_min AS DOUBLE) AS iqr_min,
                    CAST(iqr_max AS DOUBLE) AS iqr_max
                FROM {parquet_source}
                WHERE var = '{var}'
                  AND scale = {scale}
                  AND cell_id IN ({cell_list_sql})
            ),
            areas(cell_id, area_m2) AS (
                SELECT * FROM (VALUES {values_clause}) AS t(cell_id, area_m2)
            )
            SELECT
                cv.horizon,
                MAX(cv.date) AS date,
                SUM(cv.value * a.area_m2) / NULLIF(SUM(a.area_m2), 0) AS value,
                SUM(cv.q1 * a.area_m2) / NULLIF(SUM(a.area_m2), 0) AS q1,
                SUM(cv.q3 * a.area_m2) / NULLIF(SUM(a.area_m2), 0) AS q3,
                SUM(cv.iqr_min * a.area_m2) / NULLIF(SUM(a.area_m2), 0) AS iqr_min,
                SUM(cv.iqr_max * a.area_m2) / NULLIF(SUM(a.area_m2), 0) AS iqr_max
            FROM cell_values cv
            JOIN areas a ON cv.cell_id = a.cell_id
            WHERE cv.value IS NOT NULL AND isfinite(cv.value)
            GROUP BY cv.horizon
            ORDER BY cv.horizon
        """
        df = conn.execute(query).fetchdf()

        if df.empty:
            return {
                "var": var,
                "scale": scale,
                "cuenca_dn": cuenca_dn,
                "cuenca_nombre": CUENCA_NAMES.get(cuenca_dn, f"Cuenca {cuenca_dn}"),
                "data": [],
                "statistics": {},
            }

        data = []
        for _, row in df.iterrows():
            row_horizon = int(row["horizon"])
            if base_date:
                row_date = self._add_months(base_date, row_horizon)
            else:
                row_date = pd.to_datetime(row["date"], errors="coerce")
            data.append({
                "horizon": row_horizon,
                "date": row_date.strftime("%Y-%m-%d") if pd.notna(row_date) else None,
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
            "cuenca_dn": cuenca_dn,
            "cuenca_nombre": CUENCA_NAMES.get(cuenca_dn, f"Cuenca {cuenca_dn}"),
            "data": data,
            "statistics": statistics,
        }

        self.cache.set(cache_key, result, expire=900)
        return result
