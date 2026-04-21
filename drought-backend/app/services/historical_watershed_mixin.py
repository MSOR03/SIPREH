"""
Mixin con la lógica de consulta de datos agregados por cuenca (watershed).

Calcula promedios ponderados por área de intersección:
  valor_cuenca = Σ(valor_celda × area_interseccion) / Σ(area_interseccion)

Requiere que la clase base provea:
    self.cache, self._get_connection(), self._resolve_parquet_source(),
    self._detect_parquet_format(), self._apply_drought_scale(),
    self._get_available_freqs()
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import date

from app.services.historical_constants import DROUGHT_INDEX_KEYS, DEFAULT_SOURCE, SOURCE_BY_INDEX
from app.services.watershed_relations import (
    get_relations_for_source,
    get_cell_ids_for_source,
    CUENCA_NAMES,
)
from app.services.historical_spatial_mixin import _vectorized_colors


class WatershedMixin:
    """Lógica de consulta de datos agregados por cuenca sobre archivos parquet."""

    def _build_watershed_base(
        self,
        parquet_url: str,
        variable: str,
        data_source: str,
        scale: Optional[int] = None,
        frequency: Optional[str] = None,
    ) -> dict:
        """
        Construye los componentes base de la query DuckDB para watershed.
        Retorna dict con source_expr, date_col, value_expr, base_where, cell_ids, relations.
        """
        conn = self._get_connection()

        is_drought_index = variable in DROUGHT_INDEX_KEYS
        # data_source (ERA5/IMERG/CHIRPS) selects resolution/file,
        # but the parquet source column uses OBS_IDW, SAT_RAW, etc.
        effective_source = SOURCE_BY_INDEX.get(variable, DEFAULT_SOURCE)

        source_info = self._resolve_parquet_source(parquet_url)
        parquet_source = source_info["source_expr"]
        primary_path = source_info["primary_path"]

        format_info = self._detect_parquet_format(
            parquet_url, resolved_path=primary_path, source_expr=parquet_source
        )
        file_format = format_info["format"]
        date_col = format_info["date_column"]

        parquet_columns = format_info.get("columns", [])
        has_freq_col = "freq" in parquet_columns
        has_source_col = "source" in parquet_columns

        base_clauses = []

        # Frecuencia
        if has_freq_col:
            if is_drought_index:
                base_clauses.append("freq = 'M'")
            else:
                var_col_name = format_info.get("var_column", "var")
                available_freqs = self._get_available_freqs(
                    parquet_source, parquet_url, variable, file_format, var_col_name
                )
                if frequency and frequency in available_freqs:
                    base_clauses.append(f"freq = '{frequency}'")
                elif len(available_freqs) == 1:
                    base_clauses.append(f"freq = '{available_freqs[0]}'")
                elif len(available_freqs) > 1:
                    eff = frequency if frequency in available_freqs else ("D" if "D" in available_freqs else available_freqs[0])
                    base_clauses.append(f"freq = '{eff}'")

        if file_format == "long":
            var_col = format_info.get("var_column", "var")
            base_clauses.append(f"{var_col} = '{variable}'")
            if has_source_col and effective_source:
                base_clauses.append(f"source = '{effective_source}'")
            if is_drought_index and scale is not None:
                base_clauses.append(f"scale = {scale}")
            value_expr = "value"
        else:
            value_expr = variable

        # Filtrar solo celdas relevantes para la fuente (usar columna nativa cell_id)
        cell_ids = get_cell_ids_for_source(data_source)
        cell_list_sql = ", ".join(f"'{c}'" for c in cell_ids)
        base_clauses.append(f"cell_id IN ({cell_list_sql})")

        base_where = " AND ".join(base_clauses) if base_clauses else "1=1"

        relations = get_relations_for_source(data_source)

        return {
            "conn": conn,
            "parquet_source": parquet_source,
            "date_col": date_col,
            "value_expr": value_expr,
            "base_where": base_where,
            "cell_ids": cell_ids,
            "relations": relations,
            "is_drought_index": is_drought_index,
            "has_source_col": has_source_col,
            "effective_source": effective_source,
            "file_format": file_format,
        }

    def _aggregate_by_cuenca(
        self, cell_df: pd.DataFrame, relations: list, is_drought_index: bool, variable: str
    ) -> List[dict]:
        """
        Agrega valores de celdas a cuencas usando promedio ponderado por área.

        cell_df: DataFrame con columnas [cell_id, value]
        relations: lista de dicts {cell_id, dn, nombre, area_m2}

        Retorna lista de dicts con {dn, nombre, value, color, category, severity, cell_count}.
        """
        if cell_df.empty:
            return [
                {"dn": dn, "nombre": name, "value": None, "color": "#CCCCCC",
                 "category": None, "severity": None, "cell_count": 0}
                for dn, name in CUENCA_NAMES.items()
            ]

        # Construir lookup de cell values
        cell_values = dict(zip(cell_df["cell_id"].values, cell_df["value"].values))

        # Agrupar relaciones por cuenca
        cuenca_data = {}
        for rel in relations:
            dn = rel["dn"]
            cid = rel["cell_id"]
            area = rel["area_m2"]
            val = cell_values.get(cid)

            if dn not in cuenca_data:
                cuenca_data[dn] = {"nombre": rel["nombre"], "weighted_sum": 0.0, "total_area": 0.0, "cell_count": 0}

            if val is not None and np.isfinite(val):
                cuenca_data[dn]["weighted_sum"] += val * area
                cuenca_data[dn]["total_area"] += area
                cuenca_data[dn]["cell_count"] += 1

        # Calcular promedios ponderados
        cuenca_values = []
        for dn, name in CUENCA_NAMES.items():
            cd = cuenca_data.get(dn)
            if cd and cd["total_area"] > 0:
                cuenca_values.append({
                    "dn": dn,
                    "nombre": cd["nombre"],
                    "value": cd["weighted_sum"] / cd["total_area"],
                    "cell_count": cd["cell_count"],
                })
            else:
                cuenca_values.append({
                    "dn": dn,
                    "nombre": name,
                    "value": None,
                    "cell_count": 0,
                })

        # Aplicar coloring
        values_for_color = pd.Series([c["value"] for c in cuenca_values])

        if is_drought_index:
            # Usar drought scale coloring
            temp_df = pd.DataFrame({
                "value": values_for_color,
            })
            temp_df = self._apply_drought_scale(temp_df, variable)
            for i, c in enumerate(cuenca_values):
                row = temp_df.iloc[i]
                c["color"] = row.get("color", "#CCCCCC") if pd.notna(row.get("color")) else "#CCCCCC"
                c["category"] = row.get("category") if pd.notna(row.get("category")) else None
                c["severity"] = int(row["severity"]) if pd.notna(row.get("severity")) else None
        else:
            valid = values_for_color.dropna()
            if len(valid) > 0:
                vmin = float(valid.min())
                vmax = float(valid.max())
                colors = _vectorized_colors(values_for_color, vmin, vmax)
            else:
                colors = pd.Series(["#CCCCCC"] * len(cuenca_values))
            for i, c in enumerate(cuenca_values):
                c["color"] = colors.iloc[i]
                c["category"] = None
                c["severity"] = None

        return cuenca_values

    def query_watershed_spatial(
        self,
        parquet_url: str,
        variable: str,
        data_source: str,
        target_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        use_interval: bool = False,
        scale: Optional[int] = None,
        frequency: Optional[str] = None,
    ) -> Tuple[List[dict], Dict[str, Any], Optional[date]]:
        """
        Consulta datos espaciales agregados por cuenca para una fecha.
        Retorna (cuencas_data, statistics, used_date).
        """
        import time as time_module

        interval_mode = use_interval or (
            start_date is not None and end_date is not None and start_date != end_date
        )

        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "watershed_spatial",
                url=parquet_url,
                var=variable,
                src=data_source,
                mode="interval" if interval_mode else "single",
                date=str(target_date),
                start=str(start_date),
                end=str(end_date),
                scale=scale,
                freq=frequency,
            )
            if cache_key:
                cached = self.cache.get(cache_key)
                if cached and isinstance(cached, dict) and "cuencas" in cached:
                    return cached["cuencas"], cached["statistics"], cached.get("used_date")
        except Exception:
            cache_key = None

        t0 = time_module.time()

        base = self._build_watershed_base(
            parquet_url, variable, data_source, scale=scale, frequency=frequency
        )
        conn = base["conn"]
        parquet_source = base["parquet_source"]
        date_col = base["date_col"]
        value_expr = base["value_expr"]
        base_where = base["base_where"]

        def run_cell_query(for_date: date) -> pd.DataFrame:
            where = f"{base_where} AND {date_col} = CAST('{for_date}' AS DATE)"
            q = f"""
            SELECT
                cell_id,
                AVG(CAST({value_expr} AS DOUBLE)) as value
            FROM {parquet_source}
            WHERE {where}
            GROUP BY cell_id
            """
            return conn.execute(q).fetchdf()

        def run_cell_query_interval(s: date, e: date) -> pd.DataFrame:
            where = f"{base_where} AND {date_col} BETWEEN CAST('{s}' AS DATE) AND CAST('{e}' AS DATE)"
            q = f"""
            SELECT
                cell_id,
                AVG(CAST({value_expr} AS DOUBLE)) as value
            FROM {parquet_source}
            WHERE {where}
            GROUP BY cell_id
            """
            return conn.execute(q).fetchdf()

        used_date = None if interval_mode else target_date

        if interval_mode:
            cell_df = run_cell_query_interval(start_date, end_date)
        else:
            cell_df = run_cell_query(target_date)
            if cell_df.empty:
                nearest_q = f"""
                SELECT CAST({date_col} AS DATE) AS d
                FROM {parquet_source}
                WHERE {base_where} AND {value_expr} IS NOT NULL
                GROUP BY 1
                ORDER BY ABS(DATEDIFF('day', d, '{target_date}'::DATE))
                LIMIT 1
                """
                row = conn.execute(nearest_q).fetchone()
                if row and row[0] is not None:
                    used_date = row[0]
                    cell_df = run_cell_query(used_date)

        t1 = time_module.time()
        print(f"⚡ watershed spatial query: {t1-t0:.2f}s | var={variable} src={data_source} cells={len(cell_df)}")

        cuencas = self._aggregate_by_cuenca(
            cell_df, base["relations"], base["is_drought_index"], variable
        )

        # Statistics
        vals = [c["value"] for c in cuencas if c["value"] is not None]
        statistics = {
            "mean": float(np.mean(vals)) if vals else None,
            "min": float(np.min(vals)) if vals else None,
            "max": float(np.max(vals)) if vals else None,
            "std": float(np.std(vals)) if vals else None,
            "count": len(vals),
            "total_cells": sum(c["cell_count"] for c in cuencas),
            "valid_cells": len(vals),
            "null_cells": len(cuencas) - len(vals),
        }

        if cache_key:
            self.cache.set(cache_key, {
                "cuencas": cuencas,
                "statistics": statistics,
                "used_date": str(used_date) if used_date else None,
            }, expire=900)

        total = time_module.time() - t0
        print(f"   ↳ total watershed spatial: {total:.2f}s")

        return cuencas, statistics, used_date

    def query_watershed_timeseries(
        self,
        parquet_url: str,
        variable: str,
        data_source: str,
        cuenca_dn: int,
        start_date: date,
        end_date: date,
        scale: Optional[int] = None,
        frequency: Optional[str] = None,
    ) -> Tuple[List[dict], Dict[str, Any]]:
        """
        Consulta serie de tiempo para una cuenca (promedio ponderado por fecha).
        Retorna (data_points, statistics).
        """
        import time as time_module

        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "watershed_ts",
                url=parquet_url,
                var=variable,
                src=data_source,
                dn=cuenca_dn,
                start=str(start_date),
                end=str(end_date),
                scale=scale,
                freq=frequency,
            )
            if cache_key:
                cached = self.cache.get(cache_key)
                if cached and isinstance(cached, dict) and "data" in cached:
                    return cached["data"], cached["statistics"]
        except Exception:
            cache_key = None

        t0 = time_module.time()

        base = self._build_watershed_base(
            parquet_url, variable, data_source, scale=scale, frequency=frequency
        )
        conn = base["conn"]
        parquet_source = base["parquet_source"]
        date_col = base["date_col"]
        value_expr = base["value_expr"]
        base_where = base["base_where"]
        relations = base["relations"]

        # Filter relations to only this cuenca
        cuenca_rels = [r for r in relations if r["dn"] == cuenca_dn]
        if not cuenca_rels:
            raise ValueError(f"No hay relaciones para cuenca DN={cuenca_dn} con fuente {data_source}")

        # Build cell_id → area mapping for this cuenca
        cell_areas = {}
        for r in cuenca_rels:
            cell_areas[r["cell_id"]] = r["area_m2"]

        # Query: weighted average pushed into DuckDB
        cuenca_cell_ids = list(cell_areas.keys())
        cell_list_sql = ", ".join(f"'{c}'" for c in cuenca_cell_ids)

        # Build VALUES clause for cell areas
        values_parts = [f"('{cid}', {area})" for cid, area in cell_areas.items()]
        values_clause = ", ".join(values_parts)

        where = (
            f"{base_where} AND {date_col} BETWEEN CAST('{start_date}' AS DATE) AND CAST('{end_date}' AS DATE)"
            f" AND cell_id IN ({cell_list_sql})"
        )

        query = f"""
        WITH cell_values AS (
            SELECT
                CAST({date_col} AS DATE) as date,
                cell_id,
                AVG(CAST({value_expr} AS DOUBLE)) as value
            FROM {parquet_source}
            WHERE {where}
            GROUP BY date, cell_id
        ),
        areas(cell_id, area_m2) AS (
            SELECT * FROM (VALUES {values_clause}) AS t(cell_id, area_m2)
        )
        SELECT
            cv.date,
            SUM(cv.value * a.area_m2) / NULLIF(SUM(a.area_m2), 0) as value
        FROM cell_values cv
        JOIN areas a ON cv.cell_id = a.cell_id
        WHERE cv.value IS NOT NULL AND isfinite(cv.value)
        GROUP BY cv.date
        ORDER BY cv.date
        """
        df = conn.execute(query).fetchdf()

        t1 = time_module.time()
        print(f"⚡ watershed timeseries query: {t1-t0:.2f}s | var={variable} src={data_source} dn={cuenca_dn} rows={len(df)}")

        if df.empty:
            return [], {"mean": None, "min": None, "max": None, "std": None, "count": 0, "missing": 0}

        # Results already aggregated by DuckDB
        data_points = []
        for _, row in df.iterrows():
            dt = row["date"]
            val = row["value"]
            data_points.append({
                "date": str(dt.date() if hasattr(dt, 'date') else dt),
                "value": float(val) if val is not None and np.isfinite(val) else None,
            })

        # Apply drought scale coloring to points if needed
        if base["is_drought_index"] and data_points:
            temp_df = pd.DataFrame(data_points)
            temp_df["value"] = pd.to_numeric(temp_df["value"], errors="coerce")
            temp_df = self._apply_drought_scale(temp_df, variable)
            for i, pt in enumerate(data_points):
                row = temp_df.iloc[i]
                pt["category"] = row.get("category") if pd.notna(row.get("category")) else None
                pt["color"] = row.get("color") if pd.notna(row.get("color")) else None
                pt["severity"] = int(row["severity"]) if pd.notna(row.get("severity")) else None

        # Statistics
        vals = [p["value"] for p in data_points if p["value"] is not None]
        statistics = {
            "mean": float(np.mean(vals)) if vals else None,
            "min": float(np.min(vals)) if vals else None,
            "max": float(np.max(vals)) if vals else None,
            "std": float(np.std(vals)) if vals else None,
            "count": len(vals),
            "missing": len(data_points) - len(vals),
        }

        if cache_key:
            self.cache.set(cache_key, {
                "data": data_points,
                "statistics": statistics,
            }, expire=900)

        total = time_module.time() - t0
        print(f"   ↳ total watershed timeseries: {total:.2f}s ({len(data_points)} points)")

        return data_points, statistics
