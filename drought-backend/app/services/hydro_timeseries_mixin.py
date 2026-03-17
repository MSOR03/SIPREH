"""
Mixin con la lógica de consulta de series de tiempo para datos hidrológicos de estaciones.
Se mezcla en HydroDataService mediante herencia múltiple.

Requiere que la clase base provea:
    self.cache, self._get_connection(), self._resolve_parquet_source(),
    self._apply_hydro_drought_scale()
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import date

from app.services.hydro_constants import HYDRO_INDEX_KEYS, HYDRO_STATIONS, INDICES_WITHOUT_SCALE


class HydroTimeseriesMixin:
    """Lógica de consulta de series de tiempo para estaciones hidrológicas."""

    def query_hydro_timeseries(
        self,
        parquet_url: str,
        station_code: str,
        index_name: str,
        scale: int,
        start_date: date,
        end_date: date,
        limit: int = 70000,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float], Dict[str, Any], bool]:
        """
        Consulta serie de tiempo de un índice hidrológico para una estación.

        Args:
            parquet_url: Cloud key del archivo parquet
            station_code: Código de la estación (e.g., '2749')
            index_name: Nombre del índice (SDI, SRI, MFI, DDI, HDI)
            scale: Escala temporal (1, 3, 6, 12)
            start_date: Fecha inicio
            end_date: Fecha fin
            limit: Máximo de registros

        Returns:
            Tupla (data_points, statistics, station_info, has_duration)
        """
        # Cache key
        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "hydro_ts",
                url=parquet_url,
                station=station_code,
                index=index_name,
                scale=scale,
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
                        cached["station_info"],
                        cached["has_duration"],
                    )
        except Exception:
            cache_key = None

        try:
            import time as time_module
            t0 = time_module.time()

            conn = self._get_connection()

            # Resolver parquet source
            source_info = self._resolve_parquet_source(parquet_url)
            parquet_source = source_info["source_expr"]

            # Construir query
            # El parquet hidro tiene: codigo, Indice, Escala, Fecha_inicial, Fecha_Final, Duracion, Valor
            # codigo puede ser string o int, usar CAST para seguridad
            # DDI y HDI tienen Escala=NULL, no filtrar por escala para ellos
            scale_filter = f"AND Escala = {scale}" if index_name not in INDICES_WITHOUT_SCALE else ""
            # DDI/HDI son eventos con duración: incluir todo evento que se solape
            # con [start_date, end_date], no solo los que empiezan en ese rango.
            if index_name in INDICES_WITHOUT_SCALE:
                date_filter = (
                    f"AND CAST(Fecha_inicial AS DATE) <= CAST('{end_date}' AS DATE) "
                    f"AND CAST(Fecha_Final AS DATE) >= CAST('{start_date}' AS DATE)"
                )
            else:
                date_filter = (
                    f"AND Fecha_inicial >= CAST('{start_date}' AS DATE) "
                    f"AND Fecha_inicial <= CAST('{end_date}' AS DATE)"
                )

            query = f"""
            SELECT
                CAST(Fecha_inicial AS DATE) as date,
                CAST(Valor AS DOUBLE) as value,
                CAST(Fecha_Final AS DATE) as fecha_final,
                Duracion as duracion
            FROM {parquet_source}
            WHERE CAST(codigo AS VARCHAR) = '{station_code}'
              AND Indice = '{index_name}'
              {scale_filter}
              {date_filter}
            ORDER BY Fecha_inicial
            LIMIT {limit}
            """

            t1 = time_module.time()
            result_df = conn.execute(query).fetchdf()
            t2 = time_module.time()

            elapsed = t2 - t1
            level = "⚠️" if elapsed > 5 else "⚡"
            print(f"{level} hydro timeseries query: {elapsed:.2f}s | station={station_code} index={index_name} scale={scale} rows={len(result_df)}")

            # Determinar si hay datos con duración
            has_duration = False
            if len(result_df) > 0 and 'fecha_final' in result_df.columns:
                has_duration = result_df['fecha_final'].notna().any()

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

            # Convertir fechas a string
            if len(result_df) > 0:
                result_df['date'] = result_df['date'].astype(str)
                if 'fecha_final' in result_df.columns:
                    # Convertir fecha_final: NaT -> None
                    result_df['fecha_final'] = result_df['fecha_final'].astype(str)
                    result_df['fecha_final'] = result_df['fecha_final'].replace('NaT', None)

            # Limpiar duracion: NaN -> None
            if 'duracion' in result_df.columns:
                result_df['duracion'] = result_df['duracion'].where(result_df['duracion'].notna(), None)

            data_points = result_df.to_dict('records')

            # Estadísticas
            if len(result_df) > 0:
                stat_vals = result_df['value'].values.astype(float)
                valid_mask = np.isfinite(stat_vals)
                n_valid = int(valid_mask.sum())
                valid_arr = stat_vals[valid_mask]
                statistics = {
                    "mean": float(valid_arr.mean()) if n_valid > 0 else None,
                    "min": float(valid_arr.min()) if n_valid > 0 else None,
                    "max": float(valid_arr.max()) if n_valid > 0 else None,
                    "std": float(valid_arr.std()) if n_valid > 0 else None,
                    "count": n_valid,
                    "missing": len(stat_vals) - n_valid,
                }
            else:
                statistics = {"mean": None, "min": None, "max": None, "std": None, "count": 0, "missing": 0}

            # Info de la estación
            station_info = HYDRO_STATIONS.get(station_code, {})
            station_info = {
                "codigo": station_code,
                "lat": station_info.get("lat"),
                "lon": station_info.get("lon"),
                "name": station_info.get("name", f"Estación {station_code}"),
            }

            # Cache (15 minutos)
            if cache_key:
                self.cache.set(cache_key, {
                    "data": data_points,
                    "statistics": statistics,
                    "station_info": station_info,
                    "has_duration": has_duration,
                }, expire=900)

            total_elapsed = time_module.time() - t0
            print(f"   ↳ total hydro timeseries: {total_elapsed:.2f}s")

            return data_points, statistics, station_info, has_duration

        except Exception as e:
            raise Exception(f"Error consultando serie de tiempo hidrológica: {str(e)}")
