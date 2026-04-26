"""
Mixin con la logica de consulta de datos espaciales (mapas 2D) historicos.
Se mezcla en HistoricalDataService mediante herencia multiple.

Requiere que la clase base provea:
    self.cache, self._get_connection(), self._resolve_parquet_source(),
    self._detect_parquet_format(), self._apply_drought_scale(),
    self._get_available_freqs()
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import date

from app.services.historical_constants import (
    DROUGHT_INDEX_KEYS,
    DEFAULT_SOURCE,
    DEFAULT_SCALE,
    SOURCE_BY_INDEX,
    COLOR_SCALE_VERSION,
)


def _vectorized_colors(values: pd.Series, vmin: float, vmax: float) -> pd.Series:
    n = len(values)
    if vmin == vmax:
        return pd.Series(["#CCCCCC"] * n, index=values.index)

    norm = ((values.values - vmin) / (vmax - vmin)).clip(0.0, 1.0)

    r = np.zeros(n, dtype=np.uint8)
    g = np.zeros(n, dtype=np.uint8)
    b = np.zeros(n, dtype=np.uint8)

    def lerp(start, end, weight):
        return (start + (end - start) * weight).astype(np.uint8)

    # 0.00–0.25 -> azul oscuro #1e3a8a a azul fuerte #2563eb
    m1 = norm < 0.25
    t1 = norm[m1] / 0.25
    r[m1] = lerp(30, 37, t1)
    g[m1] = lerp(58, 99, t1)
    b[m1] = lerp(138, 235, t1)

    # 0.25–0.50 -> azul fuerte #2563eb a cian #06b6d4
    m2 = (norm >= 0.25) & (norm < 0.50)
    t2 = (norm[m2] - 0.25) / 0.25
    r[m2] = lerp(37, 6, t2)
    g[m2] = lerp(99, 182, t2)
    b[m2] = lerp(235, 212, t2)

    # 0.50–0.75 -> cian a amarillo
    m3 = (norm >= 0.50) & (norm < 0.75)
    t3 = (norm[m3] - 0.50) / 0.25
    r[m3] = lerp(6, 250, t3)
    g[m3] = lerp(182, 204, t3)
    b[m3] = lerp(212, 21, t3)

    # 0.75–1.00 -> amarillo a rojo intenso #dc2626
    m4 = norm >= 0.75
    t4 = (norm[m4] - 0.75) / 0.25
    r[m4] = lerp(250, 220, t4)
    g[m4] = lerp(204, 38, t4)
    b[m4] = lerp(21, 38, t4)

    rgb_bytes = np.stack([r, g, b], axis=1)
    colors = np.array(["#" + c.hex() for c in map(bytes, rgb_bytes)], dtype=object)

    nan_mask = np.isnan(values.values) if values.values.dtype.kind == 'f' else values.isna().values
    colors[nan_mask] = "#CCCCCC"
    return pd.Series(colors, index=values.index)


class SpatialMixin:
    """Lógica de consulta de datos espaciales (mapa 2D) sobre archivos parquet."""

    def query_spatial_data(
        self,
        parquet_url: str,
        variable: str,
        target_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        use_interval: bool = False,
        bounds: Optional[Dict[str, float]] = None,
        scale: Optional[int] = None,
        source: Optional[str] = None,
        frequency: Optional[str] = None,
        limit: int = 100000
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float], Optional[date], Dict[str, float]]:
        """
        Consulta datos espaciales (2D) para una fecha específica usando DuckDB.
        """
        interval_mode = use_interval or (
            start_date is not None and end_date is not None and start_date != end_date
        )

        # Resolver scale y source
        is_drought_index = variable in DROUGHT_INDEX_KEYS
        effective_scale = scale if is_drought_index else None
        # Source aplica a todas las variables (long format tiene source para todo)
        effective_source = source or SOURCE_BY_INDEX.get(variable, DEFAULT_SOURCE)
        requested_freq = frequency

        # Cache key con protección
        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "spatial",
                url=parquet_url,
                var=variable,
                mode="interval" if interval_mode else "single",
                date=str(target_date),
                start_date=str(start_date),
                end_date=str(end_date),
                bounds=str(bounds) if bounds else None,
                scale=effective_scale,
                source=effective_source,
                freq=requested_freq,
                palette=COLOR_SCALE_VERSION,
                limit=limit
            )

            if cache_key:
                cached_result = self.cache.get(cache_key)
                if cached_result and isinstance(cached_result, dict) and "data" in cached_result:
                    used_date = cached_result.get("used_date", str(target_date))
                    cached_bounds = cached_result.get("bounds", {})
                    return cached_result["data"], cached_result["statistics"], used_date, cached_bounds
        except Exception:
            cache_key = None

        try:
            import time as time_module
            t0 = time_module.time()

            conn = self._get_connection()

            if interval_mode:
                if not start_date or not end_date:
                    raise ValueError("Para modo intervalo debes enviar start_date y end_date")
                if start_date > end_date:
                    raise ValueError("start_date no puede ser mayor que end_date")
            elif not target_date:
                raise ValueError("En modo fecha única debes enviar target_date")

            # Resolver source (soporta single file y multi-archivo tiered)
            source_info = self._resolve_parquet_source(parquet_url)
            parquet_source = source_info["source_expr"]
            primary_path = source_info["primary_path"]

            # Detectar formato (cacheado 24h, reutiliza source_expr)
            format_info = self._detect_parquet_format(parquet_url, resolved_path=primary_path, source_expr=parquet_source)
            file_format = format_info['format']
            date_col = format_info['date_column']

            # Construir filtros base (sin fecha)
            base_clauses = []

            if bounds:
                base_clauses.append(f"lat >= {bounds.get('min_lat', -90)}")
                base_clauses.append(f"lat <= {bounds.get('max_lat', 90)}")
                base_clauses.append(f"lon >= {bounds.get('min_lon', -180)}")
                base_clauses.append(f"lon <= {bounds.get('max_lon', 180)}")

            # Detectar columnas reales
            parquet_columns = format_info.get('columns', [])
            has_freq_col = 'freq' in parquet_columns
            has_source_col = 'source' in parquet_columns

            # Frecuencia: detectar dinámicamente qué existe en el parquet
            effective_freq = None
            if has_freq_col:
                if is_drought_index:
                    # Índices son siempre frecuencia M — filtrar para evitar duplicados
                    effective_freq = 'M'
                    base_clauses.append("freq = 'M'")
                else:
                    var_col_name = format_info.get('var_column', 'var')
                    available_freqs = self._get_available_freqs(parquet_source, parquet_url, variable, file_format, var_col_name)

                    if requested_freq and requested_freq in available_freqs:
                        effective_freq = requested_freq
                        base_clauses.append(f"freq = '{effective_freq}'")
                    elif len(available_freqs) == 1:
                        effective_freq = available_freqs[0]
                        base_clauses.append(f"freq = '{effective_freq}'")
                    elif len(available_freqs) > 1:
                        effective_freq = requested_freq if requested_freq in available_freqs else ('D' if 'D' in available_freqs else available_freqs[0])
                        base_clauses.append(f"freq = '{effective_freq}'")

            if file_format == 'long':
                var_col = format_info.get('var_column', 'var')
                base_clauses.append(f"{var_col} = '{variable}'")

                # Source: aplicar a TODAS las variables (no solo índices)
                if has_source_col and effective_source:
                    base_clauses.append(f"source = '{effective_source}'")
                if effective_scale is not None:
                    base_clauses.append(f"scale = {effective_scale}")

                value_expr = "value"
            else:
                value_expr = variable

            base_where = " AND ".join(base_clauses) if base_clauses else "1=1"

            def run_spatial_query(for_date: date):
                where_clause = f"{base_where} AND {date_col} = CAST('{for_date}' AS DATE)"
                query = f"""
                SELECT
                    lat,
                    lon,
                    CAST(PRINTF('%.6f', lon) || '_' || PRINTF('%.6f', lat) AS VARCHAR) as cell_id,
                    AVG(CAST({value_expr} AS DOUBLE)) as value,
                    COUNT(*) as records_in_cell
                FROM {parquet_source}
                WHERE {where_clause}
                GROUP BY lat, lon
                LIMIT {limit}
                """
                return conn.execute(query).fetchdf()

            def run_spatial_query_interval(range_start: date, range_end: date):
                where_clause = (
                    f"{base_where} AND {date_col} BETWEEN "
                    f"CAST('{range_start}' AS DATE) AND CAST('{range_end}' AS DATE)"
                )
                query = f"""
                SELECT
                    lat,
                    lon,
                    CAST(PRINTF('%.6f', lon) || '_' || PRINTF('%.6f', lat) AS VARCHAR) as cell_id,
                    AVG(CAST({value_expr} AS DOUBLE)) as value,
                    COUNT(*) as records_in_cell
                FROM {parquet_source}
                WHERE {where_clause}
                GROUP BY lat, lon
                LIMIT {limit}
                """
                return conn.execute(query).fetchdf()

            used_date = None if interval_mode else target_date

            t1 = time_module.time()

            if interval_mode:
                result_df = run_spatial_query_interval(start_date, end_date)
            else:
                result_df = run_spatial_query(target_date)

                # Si no hay datos exactos, usar la fecha más cercana con datos
                if result_df.empty:
                    nearest_date_query = f"""
                    SELECT CAST({date_col} AS DATE) AS d
                    FROM {parquet_source}
                    WHERE {base_where} AND {value_expr} IS NOT NULL
                    GROUP BY 1
                    ORDER BY ABS(DATEDIFF('day', d, '{target_date}'::DATE))
                    LIMIT 1
                    """
                    nearest_row = conn.execute(nearest_date_query).fetchone()

                    if nearest_row and nearest_row[0] is not None:
                        used_date = nearest_row[0]
                        result_df = run_spatial_query(used_date)

            t2 = time_module.time()
            query_elapsed = t2 - t1
            level = "⚠️" if query_elapsed > 5 else "⚡"
            print(f"{level} spatial query: {query_elapsed:.2f}s | var={variable} src={effective_source} freq={effective_freq} rows={len(result_df)}")

            # Fallback: si source filtró y no hay datos, reintentar sin source
            if result_df.empty and has_source_col and effective_source and file_format == 'long':
                fallback_clauses = [c for c in base_clauses if not c.startswith("source =")]
                fallback_where = " AND ".join(fallback_clauses) if fallback_clauses else "1=1"

                def run_spatial_query_fallback(for_date):
                    fw = f"{fallback_where} AND {date_col} = CAST('{for_date}' AS DATE)"
                    q = f"""
                    SELECT lat, lon,
                           CAST(PRINTF('%.6f', lon) || '_' || PRINTF('%.6f', lat) AS VARCHAR) as cell_id,
                           AVG(CAST({value_expr} AS DOUBLE)) as value,
                           COUNT(*) as records_in_cell
                    FROM {parquet_source}
                    WHERE {fw} GROUP BY lat, lon LIMIT {limit}
                    """
                    return conn.execute(q).fetchdf()

                def run_spatial_query_interval_fallback(range_start, range_end):
                    fw = f"{fallback_where} AND {date_col} BETWEEN CAST('{range_start}' AS DATE) AND CAST('{range_end}' AS DATE)"
                    q = f"""
                    SELECT lat, lon,
                           CAST(PRINTF('%.6f', lon) || '_' || PRINTF('%.6f', lat) AS VARCHAR) as cell_id,
                           AVG(CAST({value_expr} AS DOUBLE)) as value,
                           COUNT(*) as records_in_cell
                    FROM {parquet_source}
                    WHERE {fw} GROUP BY lat, lon LIMIT {limit}
                    """
                    return conn.execute(q).fetchdf()

                if interval_mode:
                    result_df = run_spatial_query_interval_fallback(start_date, end_date)
                else:
                    result_df = run_spatial_query_fallback(used_date or target_date)

                if len(result_df) > 0:
                    print(f"   ↳ fallback sin source: {len(result_df)} rows")

            # 🚀 Post-procesamiento mínimo (cell_id ya viene de DuckDB, value ya es DOUBLE)
            # Solo limpiar Inf que DOUBLE puede contener
            vals = result_df['value'].values
            inf_mask = ~np.isfinite(vals) & ~np.isnan(vals)
            if inf_mask.any():
                vals[inf_mask] = np.nan
                result_df['value'] = vals

            if is_drought_index:
                result_df = self._apply_drought_scale(result_df, variable)
            else:
                variable_scale = self._get_scale_for_variable(variable, effective_freq)
                if variable_scale:
                    result_df = self._apply_variable_scale(result_df, variable, effective_freq)
                else:
                    valid_values = vals[np.isfinite(vals)]
                    if len(valid_values) > 0:
                        vmin = float(valid_values.min())
                        vmax = float(valid_values.max())
                        result_df["color"] = _vectorized_colors(result_df["value"], vmin, vmax)
                    else:
                        result_df["color"] = "#CCCCCC"

            # Estadísticas (usando numpy directo, sin copia de dropna)
            valid_mask = np.isfinite(vals)
            total_cells = len(vals)
            valid_cells = int(valid_mask.sum())
            valid_vals = vals[valid_mask]

            statistics = {
                "mean": float(valid_vals.mean()) if valid_cells > 0 else None,
                "min": float(valid_vals.min()) if valid_cells > 0 else None,
                "max": float(valid_vals.max()) if valid_cells > 0 else None,
                "std": float(valid_vals.std()) if valid_cells > 0 else None,
                "count": valid_cells,
                "total_cells": total_cells,
                "unique_cells": total_cells,
                "valid_cells": valid_cells,
                "null_cells": total_cells - valid_cells,
                "raw_records_aggregated": int(result_df['records_in_cell'].sum()) if 'records_in_cell' in result_df else total_cells
            }

            # Bounds reales de los datos (numpy, sin loop Python)
            actual_bounds = {}
            if total_cells > 0:
                lat_vals = result_df['lat'].values
                lon_vals = result_df['lon'].values
                actual_bounds = {
                    "min_lat": float(lat_vals.min()),
                    "max_lat": float(lat_vals.max()),
                    "min_lon": float(lon_vals.min()),
                    "max_lon": float(lon_vals.max()),
                }

            grid_cells = result_df.to_dict('records')

            # Cache (15 minutos)
            if cache_key:
                self.cache.set(cache_key, {
                    "data": grid_cells,
                    "statistics": statistics,
                    "used_date": str(used_date),
                    "bounds": actual_bounds,
                }, expire=900)

            total_elapsed = time_module.time() - t0
            print(f"   ↳ total spatial: {total_elapsed:.2f}s (query={query_elapsed:.2f}s, post={total_elapsed - query_elapsed:.2f}s)")

            return grid_cells, statistics, used_date, actual_bounds

        except Exception as e:
            raise Exception(f"Error consultando datos espaciales: {str(e)}")
