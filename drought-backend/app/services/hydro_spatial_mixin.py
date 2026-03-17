"""
Mixin con la lógica de consulta de datos espaciales (mapas 2D) para estaciones hidrológicas.
Se mezcla en HydroDataService mediante herencia múltiple.

Requiere que la clase base provea:
    self.cache, self._get_connection(), self._resolve_parquet_source(),
    self._apply_hydro_drought_scale()
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import date

from app.services.hydro_constants import HYDRO_STATIONS, INDICES_WITHOUT_SCALE


class HydroSpatialMixin:
    """Lógica de consulta de datos espaciales (mapa 2D) para estaciones hidrológicas."""

    def query_hydro_spatial(
        self,
        parquet_url: str,
        index_name: str,
        scale: int,
        target_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        use_interval: bool = False,
        limit: int = 100,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float], Optional[date], Dict[str, float]]:
        """
        Consulta datos espaciales (2D) para todas las estaciones en una fecha o intervalo.

        Args:
            parquet_url: Cloud key del archivo parquet
            index_name: Nombre del índice (SDI, SRI, MFI, DDI, HDI)
            scale: Escala temporal (1, 3, 6, 12)
            target_date: Fecha puntual (modo fecha única)
            start_date: Fecha inicio (modo intervalo)
            end_date: Fecha fin (modo intervalo)
            use_interval: Si True, usar modo intervalo
            limit: Máximo de registros

        Returns:
            Tupla (station_data, statistics, used_date, bounds)
        """
        interval_mode = use_interval or (
            start_date is not None and end_date is not None and start_date != end_date
        )

        # Cache key
        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "hydro_spatial",
                url=parquet_url,
                index=index_name,
                scale=scale,
                mode="interval" if interval_mode else "single",
                date=str(target_date),
                start=str(start_date),
                end=str(end_date),
                limit=limit,
            )
            if cache_key:
                cached = self.cache.get(cache_key)
                if cached and isinstance(cached, dict) and "data" in cached:
                    return (
                        cached["data"],
                        cached["statistics"],
                        cached.get("used_date"),
                        cached.get("bounds", {}),
                    )
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

            # Resolver parquet source
            source_info = self._resolve_parquet_source(parquet_url)
            parquet_source = source_info["source_expr"]

            # Base WHERE para índice y escala
            # DDI y HDI tienen Escala=NULL, no filtrar por escala para ellos
            if index_name in INDICES_WITHOUT_SCALE:
                base_where = f"Indice = '{index_name}'"
            else:
                base_where = f"Indice = '{index_name}' AND Escala = {scale}"

            # DDI/HDI son eventos con duración (Fecha_inicial→Fecha_Final).
            # Para ellos, buscar eventos que *cubran* la fecha objetivo,
            # no solo los que empiecen en ella.
            is_duration_index = index_name in INDICES_WITHOUT_SCALE

            def run_spatial_query(for_date: date):
                if is_duration_index:
                    # Evento activo: Fecha_inicial <= target AND Fecha_Final >= target
                    date_filter = (
                        f"AND CAST(Fecha_inicial AS DATE) <= CAST('{for_date}' AS DATE) "
                        f"AND CAST(Fecha_Final AS DATE) >= CAST('{for_date}' AS DATE)"
                    )
                else:
                    date_filter = f"AND CAST(Fecha_inicial AS DATE) = CAST('{for_date}' AS DATE)"

                query = f"""
                SELECT
                    CAST(codigo AS VARCHAR) as codigo,
                    latitud as lat,
                    longitud as lon,
                    AVG(CAST(Valor AS DOUBLE)) as value,
                    COUNT(*) as records_per_station
                FROM {parquet_source}
                WHERE {base_where}
                  {date_filter}
                GROUP BY codigo, latitud, longitud
                LIMIT {limit}
                """
                return conn.execute(query).fetchdf()

            def run_spatial_query_interval(range_start: date, range_end: date):
                if is_duration_index:
                    # Eventos que se solapan con el intervalo solicitado
                    date_filter = (
                        f"AND CAST(Fecha_inicial AS DATE) <= CAST('{range_end}' AS DATE) "
                        f"AND CAST(Fecha_Final AS DATE) >= CAST('{range_start}' AS DATE)"
                    )
                else:
                    date_filter = f"AND CAST(Fecha_inicial AS DATE) BETWEEN CAST('{range_start}' AS DATE) AND CAST('{range_end}' AS DATE)"

                query = f"""
                SELECT
                    CAST(codigo AS VARCHAR) as codigo,
                    latitud as lat,
                    longitud as lon,
                    AVG(CAST(Valor AS DOUBLE)) as value,
                    COUNT(*) as records_per_station
                FROM {parquet_source}
                WHERE {base_where}
                  {date_filter}
                GROUP BY codigo, latitud, longitud
                LIMIT {limit}
                """
                return conn.execute(query).fetchdf()

            used_date = None if interval_mode else target_date

            t1 = time_module.time()

            if interval_mode:
                result_df = run_spatial_query_interval(start_date, end_date)
            else:
                result_df = run_spatial_query(target_date)

                # Fallback: fecha más cercana con datos
                if result_df.empty:
                    if is_duration_index:
                        # Para DDI/HDI, buscar el evento más cercano cuyo rango cubra
                        # alguna fecha cercana al target.  Usamos el punto medio del evento.
                        nearest_query = f"""
                        SELECT CAST(Fecha_inicial AS DATE) AS fi,
                               CAST(Fecha_Final AS DATE)   AS ff
                        FROM {parquet_source}
                        WHERE {base_where} AND Valor IS NOT NULL AND Fecha_Final IS NOT NULL
                        ORDER BY ABS(
                            DATEDIFF('day',
                                CAST(Fecha_inicial AS DATE) + INTERVAL (
                                    DATEDIFF('day', CAST(Fecha_inicial AS DATE), CAST(Fecha_Final AS DATE)) / 2
                                ) DAY,
                                '{target_date}'::DATE
                            )
                        )
                        LIMIT 1
                        """
                        nearest_row = conn.execute(nearest_query).fetchone()
                        if nearest_row and nearest_row[0] is not None:
                            # Usar el punto medio del evento más cercano como fecha de referencia
                            mid_date = nearest_row[0] + (nearest_row[1] - nearest_row[0]) / 2
                            used_date = mid_date
                            # Re-query con este rango de eventos
                            overlap_query = f"""
                            SELECT
                                CAST(codigo AS VARCHAR) as codigo,
                                latitud as lat, longitud as lon,
                                AVG(CAST(Valor AS DOUBLE)) as value,
                                COUNT(*) as records_per_station
                            FROM {parquet_source}
                            WHERE {base_where}
                              AND CAST(Fecha_inicial AS DATE) <= CAST('{mid_date}' AS DATE)
                              AND CAST(Fecha_Final AS DATE)   >= CAST('{mid_date}' AS DATE)
                            GROUP BY codigo, latitud, longitud
                            LIMIT {limit}
                            """
                            result_df = conn.execute(overlap_query).fetchdf()
                    else:
                        nearest_query = f"""
                        SELECT CAST(Fecha_inicial AS DATE) AS d
                        FROM {parquet_source}
                        WHERE {base_where} AND Valor IS NOT NULL
                        GROUP BY 1
                        ORDER BY ABS(DATEDIFF('day', d, '{target_date}'::DATE))
                        LIMIT 1
                        """
                        nearest_row = conn.execute(nearest_query).fetchone()
                        if nearest_row and nearest_row[0] is not None:
                            used_date = nearest_row[0]
                            result_df = run_spatial_query(used_date)

            t2 = time_module.time()
            query_elapsed = t2 - t1
            level = "⚠️" if query_elapsed > 5 else "⚡"
            print(f"{level} hydro spatial query: {query_elapsed:.2f}s | index={index_name} scale={scale} rows={len(result_df)}")

            # Limpiar Inf
            if len(result_df) > 0:
                vals = result_df['value'].values
                inf_mask = ~np.isfinite(vals) & ~np.isnan(vals)
                if inf_mask.any():
                    vals[inf_mask] = np.nan
                    result_df['value'] = vals

            # Aplicar escala de severidad
            if len(result_df) > 0:
                result_df = self._apply_hydro_drought_scale(result_df, index_name)

            # Agregar nombre de estación desde constantes
            if len(result_df) > 0:
                result_df['station_name'] = result_df['codigo'].map(
                    lambda c: HYDRO_STATIONS.get(str(c), {}).get("name", f"Estación {c}")
                )

            # Estadísticas
            vals = result_df['value'].values if len(result_df) > 0 else np.array([])
            valid_mask = np.isfinite(vals) if len(vals) > 0 else np.array([], dtype=bool)
            total_stations = len(vals)
            valid_stations = int(valid_mask.sum())
            valid_vals = vals[valid_mask] if valid_stations > 0 else np.array([])

            statistics = {
                "mean": float(valid_vals.mean()) if valid_stations > 0 else None,
                "min": float(valid_vals.min()) if valid_stations > 0 else None,
                "max": float(valid_vals.max()) if valid_stations > 0 else None,
                "std": float(valid_vals.std()) if valid_stations > 0 else None,
                "count": valid_stations,
                "total_stations": total_stations,
                "valid_stations": valid_stations,
                "null_stations": total_stations - valid_stations,
            }

            # Bounds reales
            actual_bounds = {}
            if total_stations > 0:
                lat_vals = result_df['lat'].values
                lon_vals = result_df['lon'].values
                actual_bounds = {
                    "min_lat": float(lat_vals.min()),
                    "max_lat": float(lat_vals.max()),
                    "min_lon": float(lon_vals.min()),
                    "max_lon": float(lon_vals.max()),
                }

            station_data = result_df.to_dict('records')

            # Cache (15 minutos)
            if cache_key:
                self.cache.set(cache_key, {
                    "data": station_data,
                    "statistics": statistics,
                    "used_date": str(used_date) if used_date else None,
                    "bounds": actual_bounds,
                }, expire=900)

            total_elapsed = time_module.time() - t0
            print(f"   ↳ total hydro spatial: {total_elapsed:.2f}s")

            return station_data, statistics, used_date, actual_bounds

        except Exception as e:
            raise Exception(f"Error consultando datos espaciales hidrológicos: {str(e)}")
