"""
Mixin con la logica de consulta de series de tiempo historicas.
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

from app.services.historical_constants import DROUGHT_INDEX_KEYS, DEFAULT_SOURCE, DEFAULT_SCALE, SOURCE_BY_INDEX, NO_SCALE_DROUGHT_INDICES, get_parquet_source, infer_data_source_from_url


class TimeseriesMixin:
    """Lógica de consulta de series de tiempo sobre archivos parquet."""

    def query_timeseries(
        self,
        parquet_url: str,
        variable: str,
        start_date: date,
        end_date: date,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        cell_id: Optional[str] = None,
        scale: Optional[int] = None,
        source: Optional[str] = None,
        frequency: Optional[str] = None,
        limit: int = 70000
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float], Dict[str, Optional[float]], str]:
        """
        Consulta serie de tiempo de una variable/índice usando DuckDB.

        Soporta dos formatos:
        - Wide: cada variable es una columna (SPI, SPEI, precip, etc.)
        - Long: columna 'var' con el nombre y columna 'value' con el valor
        """
        # Resolver scale y source
        is_drought_index = variable in DROUGHT_INDEX_KEYS
        # PDSI no es escalado: IMERG/CHIRPS tiene scale=0, ERA5 tiene scale=1.
        # No filtrar por scale para evitar 0 resultados según el dataset.
        effective_scale = scale if (is_drought_index and variable not in NO_SCALE_DROUGHT_INDICES) else None
        # Source aplica tanto a índices como a variables (long format tiene source para todo)
        # Si el cliente no envía source, se infiere de la URL: IMERG→SAT_LSCDF, CHIRPS→SAT_RAW, ERA5→OBS_IDW
        if source is not None:
            effective_source = source
        else:
            inferred_ds = infer_data_source_from_url(parquet_url)
            effective_source = get_parquet_source(inferred_ds, variable)

        # Frecuencia: se resolverá dinámicamente después de detectar columnas del parquet
        requested_freq = frequency

        # Generar key de cache con protección contra errores
        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "timeseries",
                url=parquet_url,
                var=variable,
                start=str(start_date),
                end=str(end_date),
                lat=lat,
                lon=lon,
                cell=cell_id,
                scale=effective_scale,
                source=effective_source,
                freq=requested_freq,
                limit=limit
            )

            # Verificar cache (deserializar dict → tupla)
            if cache_key:
                cached_result = self.cache.get(cache_key)
                if cached_result and isinstance(cached_result, dict) and "data" in cached_result:
                    coords = cached_result.get("coordinates", {"lat": None, "lon": None})
                    freq = cached_result.get("frequency", "D")
                    return cached_result["data"], cached_result["statistics"], coords, freq
        except Exception:
            cache_key = None  # Si falla, continuar sin caché

        try:
            import time as time_module
            t0 = time_module.time()

            conn = self._get_connection()

            # Resolver source (soporta single file y multi-archivo tiered)
            source_info = self._resolve_parquet_source(parquet_url)
            parquet_source = source_info["source_expr"]
            primary_path = source_info["primary_path"]

            # Detectar formato y columna de fecha (cacheado 24h en Redis)
            format_info = self._detect_parquet_format(parquet_url, resolved_path=primary_path, source_expr=parquet_source)
            file_format = format_info['format']
            date_col = format_info['date_column']

            # Construir filtros
            where_clauses = []

            # Filtro de fechas
            where_clauses.append(f"{date_col} >= CAST('{start_date}' AS DATE)")
            where_clauses.append(f"{date_col} <= CAST('{end_date}' AS DATE)")

            # Detectar columnas reales del parquet
            parquet_columns = format_info.get('columns', [])
            has_freq_col = 'freq' in parquet_columns
            has_source_col = 'source' in parquet_columns

            # --- Resolver frecuencia efectiva ---
            need_monthly_agg = False
            effective_freq = None

            if has_freq_col:
                if is_drought_index:
                    # Índices son siempre frecuencia M — filtrar para evitar duplicados
                    effective_freq = 'M'
                    where_clauses.append("freq = 'M'")
                else:
                    # Detectar qué frecuencias REALMENTE existen para esta variable en el parquet
                    var_col_name = format_info.get('var_column', 'var')
                    available_freqs = self._get_available_freqs(parquet_source, parquet_url, variable, file_format, var_col_name)

                    if requested_freq and requested_freq in available_freqs:
                        # User pidió una freq que SÍ existe → usarla directo
                        effective_freq = requested_freq
                        where_clauses.append(f"freq = '{effective_freq}'")
                    elif requested_freq == 'M' and 'M' not in available_freqs and 'D' in available_freqs:
                        # User pidió M pero solo hay D → filtrar D y agregar en pandas
                        effective_freq = 'D'
                        where_clauses.append("freq = 'D'")
                        need_monthly_agg = True
                    elif requested_freq == 'D' and 'D' not in available_freqs and 'M' in available_freqs:
                        # User pidió D pero solo hay M → dar M tal cual
                        effective_freq = 'M'
                        where_clauses.append("freq = 'M'")
                    elif len(available_freqs) == 1:
                        # Solo una frecuencia existe → usarla
                        effective_freq = available_freqs[0]
                        where_clauses.append(f"freq = '{effective_freq}'")
                    elif len(available_freqs) > 1:
                        # Frecuencias múltiples, sin pedido explícito → default D si existe
                        effective_freq = 'D' if 'D' in available_freqs else available_freqs[0]
                        where_clauses.append(f"freq = '{effective_freq}'")
                    # Si no hay freqs disponibles, no filtrar
            elif not is_drought_index and not has_freq_col and requested_freq == 'M':
                # Sin columna freq pero user pide mensual → agregar en pandas
                need_monthly_agg = True

            # 🔥 OPTIMIZACIÓN: BETWEEN para pushdown de row-groups del parquet
            if cell_id:
                try:
                    _lon_s, _lat_s = cell_id.split('_', 1)
                    _eps = 0.0001
                    _clat, _clon = float(_lat_s), float(_lon_s)
                    where_clauses.append(f"lat BETWEEN {_clat - _eps} AND {_clat + _eps}")
                    where_clauses.append(f"lon BETWEEN {_clon - _eps} AND {_clon + _eps}")
                except (ValueError, IndexError):
                    where_clauses.append(f"cell_id = '{cell_id}'")
            elif lat is not None and lon is not None:
                tolerance = 0.15
                where_clauses.append(f"lat BETWEEN {lat - tolerance} AND {lat + tolerance}")
                where_clauses.append(f"lon BETWEEN {lon - tolerance} AND {lon + tolerance}")

            # Construir query
            if file_format == 'long':
                var_col = format_info.get('var_column', 'var')
                where_clauses.append(f"{var_col} = '{variable}'")

                # Source: aplicar a TODAS las variables (no solo índices)
                if has_source_col and effective_source:
                    where_clauses.append(f"source = '{effective_source}'")
                if effective_scale is not None:
                    where_clauses.append(f"scale = {effective_scale}")

                where_clause = " AND ".join(where_clauses)

                query = f"""
                SELECT
                    CAST({date_col} AS DATE) as date,
                    lat,
                    lon,
                    CAST(value AS DOUBLE) as value
                FROM {parquet_source}
                WHERE {where_clause}
                LIMIT {limit}
                """
            else:
                where_clause = " AND ".join(where_clauses)

                query = f"""
                SELECT
                    CAST({date_col} AS DATE) as date,
                    lat,
                    lon,
                    CAST({variable} AS DOUBLE) as value
                FROM {parquet_source}
                WHERE {where_clause}
                LIMIT {limit}
                """

            # Ejecutar query
            t5 = time_module.time()
            result_df = conn.execute(query).fetchdf()
            t6 = time_module.time()

            elapsed = t6 - t5
            level = "⚠️" if elapsed > 5 else "⚡"
            print(f"{level} timeseries query: {elapsed:.2f}s | file={parquet_url} var={variable} cell={cell_id} src={effective_source} freq={effective_freq} rows={len(result_df)}")

            # Fallback: si source filtró y no hay datos, reintentar sin source
            if len(result_df) == 0 and has_source_col and effective_source and file_format == 'long':
                fallback_clauses = [c for c in where_clauses if not c.startswith("source =")]
                fallback_where = " AND ".join(fallback_clauses)
                fallback_query = f"""
                SELECT
                    CAST({date_col} AS DATE) as date,
                    lat,
                    lon,
                    CAST(value AS DOUBLE) as value
                FROM {parquet_source}
                WHERE {fallback_where}
                LIMIT {limit}
                """
                result_df = conn.execute(fallback_query).fetchdf()
                if len(result_df) > 0:
                    print(f"   ↳ fallback sin source: {len(result_df)} rows")

            # Si buscamos por lat/lon, filtrar por el punto más cercano
            if lat is not None and lon is not None and len(result_df) > 0:
                result_df['distance'] = np.sqrt(
                    (result_df['lat'] - lat)**2 + (result_df['lon'] - lon)**2
                )
                closest_point = result_df.loc[result_df['distance'].idxmin()]
                actual_lat, actual_lon = closest_point['lat'], closest_point['lon']

                result_df = result_df[
                    (result_df['lat'] == actual_lat) &
                    (result_df['lon'] == actual_lon)
                ].drop(columns=['distance'])

            # Ordenar por fecha en pandas (más rápido que ORDER BY sobre archivo remoto)
            if len(result_df) > 0:
                result_df = result_df.sort_values('date')

            # DuckDB ya retorna DOUBLE gracias al CAST en la query;
            # solo limpiar Inf que DOUBLE puede contener
            vals = result_df['value'].values
            inf_mask = ~np.isfinite(vals) & ~np.isnan(vals)
            if inf_mask.any():
                vals[inf_mask] = np.nan
                result_df['value'] = vals

            if is_drought_index:
                result_df = self._apply_drought_scale(result_df, variable)

            # Extraer coordenadas ANTES de agregar (la agregación borra lat/lon)
            actual_lat = None
            actual_lon = None
            if len(result_df) > 0:
                actual_lat = float(result_df['lat'].iloc[0])
                actual_lon = float(result_df['lon'].iloc[0])
                result_df = result_df.drop(columns=['lat', 'lon'])

            # Agregación mensual: si el usuario pidió M pero los datos son D
            if need_monthly_agg and len(result_df) > 0:
                result_df['date'] = pd.to_datetime(result_df['date'])
                result_df = (
                    result_df
                    .groupby(result_df['date'].dt.to_period('M'))
                    .agg(value=('value', 'mean'))
                    .reset_index()
                )
                # Convertir period → date (primer día del mes)
                result_df['date'] = result_df['date'].dt.to_timestamp()

            # Determinar frecuencia real retornada
            if is_drought_index:
                returned_freq = "M"
            elif need_monthly_agg:
                returned_freq = "M"
            elif effective_freq:
                returned_freq = effective_freq
            else:
                returned_freq = "D"

            # Convertir fecha a string ISO (strftime es lento; astype str es ~3x más rápido)
            if len(result_df) > 0 and 'date' in result_df.columns:
                result_df['date'] = result_df['date'].astype(str)

            data_points = result_df.to_dict('records')

            # Estadísticas (numpy directo, sin copia de dropna)
            stat_vals = result_df['value'].values
            valid_mask = np.isfinite(stat_vals)
            n_valid = int(valid_mask.sum())
            valid_arr = stat_vals[valid_mask]
            statistics = {
                "mean": float(valid_arr.mean()) if n_valid > 0 else None,
                "min": float(valid_arr.min()) if n_valid > 0 else None,
                "max": float(valid_arr.max()) if n_valid > 0 else None,
                "std": float(valid_arr.std()) if n_valid > 0 else None,
                "count": n_valid,
                "missing": len(stat_vals) - n_valid
            }

            # Guardar en cache (15 minutos)
            if cache_key:
                self.cache.set(cache_key, {
                    "data": data_points,
                    "statistics": statistics,
                    "coordinates": {"lat": actual_lat, "lon": actual_lon},
                    "frequency": returned_freq
                }, expire=900)

            total_elapsed = time_module.time() - t0
            print(f"   ↳ total timeseries: {total_elapsed:.2f}s (query={elapsed:.2f}s, post={total_elapsed - elapsed:.2f}s)")

            return data_points, statistics, {"lat": actual_lat, "lon": actual_lon}, returned_freq

        except Exception as e:
            raise Exception(f"Error consultando serie de tiempo: {str(e)}")
