"""Validate SPI anomaly calculation against a manual DuckDB aggregation.

Usage:
  python scripts/validate_spi_anomaly.py

Optional arguments:
  --prediction-file-id 15
  --cell-id -74.075000_5.275000
  --scale 1
  --start-year 1991
  --end-year 2020
  --var SPI

The script compares:
  1) the backend service output for the selected cell, and
  2) a manual anomaly computation from the historical CHIRPS parquet
     restricted to source = SAT_RAW.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import duckdb
import pandas as pd
from sqlalchemy import or_


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.api.v1.endpoints.prediction import (
    _resolve_historical_cloud_key_for_prediction,
    _resolve_prediction_cloud_key,
)
from app.db.session import SessionLocal
from app.models.parquet_file import ParquetFile
from app.services.historical_data_service import HistoricalDataService
from app.services.prediction_data_service import PredictionDataService
from app.services.cache import cache_service


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate SPI anomaly calculation")
    parser.add_argument("--prediction-file-id", type=int, default=None)
    parser.add_argument("--cell-id", default="-74.075000_5.275000")
    parser.add_argument("--scale", type=int, default=1)
    parser.add_argument("--horizon", type=int, default=1)
    parser.add_argument("--month", type=int, default=None)
    parser.add_argument("--start-year", type=int, default=1991)
    parser.add_argument("--end-year", type=int, default=2020)
    parser.add_argument("--var", default="SPI")
    return parser.parse_args()


def find_latest_prediction_file(db_session) -> ParquetFile:
    files = db_session.query(ParquetFile).filter(
        ParquetFile.status.in_(["active", "archived"]),
    ).all()

    for file in files:
        meta = {}
        if file.file_metadata:
            try:
                meta = json.loads(file.file_metadata)
            except (json.JSONDecodeError, TypeError):
                pass
        if meta.get("dataset_key") == "prediction_main" and file.cloud_key:
            if file.status == "active":
                return file

    for file in files:
        meta = {}
        if file.file_metadata:
            try:
                meta = json.loads(file.file_metadata)
            except (json.JSONDecodeError, TypeError):
                pass
        if meta.get("dataset_key") == "prediction_main" and file.cloud_key:
            return file

    raise RuntimeError("No se encontró un archivo de predicción_main")


def manual_anomaly(conn, hist_source_expr: str, cell_id: str, scale: int, start_year: int, end_year: int, target_month: int):
    query = f"""
        SELECT
            COALESCE(
                STDDEV_SAMP(CAST(value AS DOUBLE)),
                STDDEV_POP(CAST(value AS DOUBLE))
            ) AS climatology_std_spi,
            COUNT(*) AS n_rows
        FROM {hist_source_expr}
        WHERE var = 'SPI'
          AND scale = {scale}
          AND UPPER(CAST(source AS VARCHAR)) = 'SAT_RAW'
          AND (freq IS NULL OR UPPER(CAST(freq AS VARCHAR)) IN ('M', 'MON', 'MONTH', 'MONTHLY'))
          AND CAST(EXTRACT(YEAR FROM CAST(date AS DATE)) AS INTEGER) BETWEEN {start_year} AND {end_year}
          AND CAST(EXTRACT(MONTH FROM CAST(date AS DATE)) AS INTEGER) = {target_month}
          AND cell_id = '{cell_id}'
          AND value IS NOT NULL
          AND isfinite(CAST(value AS DOUBLE))
          AND ABS(CAST(value AS DOUBLE)) <= 50
    """
    return conn.execute(query).fetchdf().iloc[0].to_dict()


def fetch_historical_rows(conn, hist_source_expr: str, cell_id: str, scale: int, start_year: int, end_year: int, target_month: int):
    query = f"""
        SELECT
            CAST(date AS DATE) AS date,
            CAST(EXTRACT(YEAR FROM CAST(date AS DATE)) AS INTEGER) AS year,
            CAST(EXTRACT(MONTH FROM CAST(date AS DATE)) AS INTEGER) AS month,
            CAST(value AS DOUBLE) AS value,
            CAST(source AS VARCHAR) AS source,
            CAST(freq AS VARCHAR) AS freq
        FROM {hist_source_expr}
        WHERE var = 'SPI'
          AND scale = {scale}
          AND UPPER(CAST(source AS VARCHAR)) = 'SAT_RAW'
          AND (freq IS NULL OR UPPER(CAST(freq AS VARCHAR)) IN ('M', 'MON', 'MONTH', 'MONTHLY'))
          AND CAST(EXTRACT(YEAR FROM CAST(date AS DATE)) AS INTEGER) BETWEEN {start_year} AND {end_year}
          AND CAST(EXTRACT(MONTH FROM CAST(date AS DATE)) AS INTEGER) = {target_month}
          AND cell_id = '{cell_id}'
          AND value IS NOT NULL
          AND isfinite(CAST(value AS DOUBLE))
          AND ABS(CAST(value AS DOUBLE)) <= 50
        ORDER BY date
    """
    return conn.execute(query).fetchdf()


def get_prediction_month(conn, pred_source_expr: str, cell_id: str, scale: int, horizon: int, var: str):
    query = f"""
        SELECT
            CAST(date AS DATE) AS pred_date,
            CAST(value AS DOUBLE) AS spi_value
        FROM {pred_source_expr}
        WHERE var = '{var}'
          AND scale = {scale}
          AND horizon = {horizon}
          AND cell_id = '{cell_id}'
        ORDER BY pred_date
        LIMIT 1
    """
    df = conn.execute(query).fetchdf()
    if df.empty:
        raise RuntimeError("No se encontró una fila de predicción para la celda/horizonte indicados")
    row = df.iloc[0]
    return pd.to_datetime(row["pred_date"]), float(row["spi_value"])


def main() -> int:
    args = parse_args()

    db_session = SessionLocal()
    try:
        pred_file = None
        if args.prediction_file_id is not None:
            pred_file = db_session.query(ParquetFile).filter(
                ParquetFile.id == args.prediction_file_id,
                ParquetFile.status.in_(["active", "archived"]),
            ).first()
        if pred_file is None:
            pred_file = find_latest_prediction_file(db_session)

        prediction_cloud_key = _resolve_prediction_cloud_key(pred_file.id, db_session)
        historical_cloud_key = _resolve_historical_cloud_key_for_prediction(pred_file.id, db_session)

        if not prediction_cloud_key:
            raise RuntimeError("No se pudo resolver el parquet de predicción")
        if not historical_cloud_key:
            raise RuntimeError("No se pudo resolver el parquet histórico CHIRPS")

        historical_service = HistoricalDataService(cache_service=cache_service)
        prediction_service = PredictionDataService(
            historical_service=historical_service,
            cache_service=cache_service,
        )

        pred_source_info = historical_service._resolve_parquet_source(prediction_cloud_key)
        pred_source_expr = pred_source_info["source_expr"]
        conn = duckdb.connect()

        pred_date, prediction_spi = get_prediction_month(
            conn=conn,
            pred_source_expr=pred_source_expr,
            cell_id=args.cell_id,
            scale=args.scale,
            horizon=args.horizon,
            var=args.var,
        )

        service_result = prediction_service.query_spatial(
            parquet_url=prediction_cloud_key,
            var=args.var,
            scale=args.scale,
            horizon=args.horizon,
            include_anomaly=True,
            map_metric="anomaly",
            clim_start_year=args.start_year,
            clim_end_year=args.end_year,
            historical_parquet_url=historical_cloud_key,
        )

        target_cell = None
        for cell in service_result.get("grid_cells", []):
            if str(cell.get("cell_id")) == str(args.cell_id):
                target_cell = cell
                break

        if target_cell is None:
            raise RuntimeError(f"No se encontró la celda {args.cell_id} en la respuesta del servicio")

        target_month = int(args.month or pred_date.month)

        hist_source_info = historical_service._resolve_parquet_source(historical_cloud_key)
        hist_source_expr = hist_source_info["source_expr"]

        manual_result = manual_anomaly(
            conn=conn,
            hist_source_expr=hist_source_expr,
            cell_id=args.cell_id,
            scale=args.scale,
            start_year=args.start_year,
            end_year=args.end_year,
            target_month=target_month,
        )

        historical_rows = fetch_historical_rows(
            conn=conn,
            hist_source_expr=hist_source_expr,
            cell_id=args.cell_id,
            scale=args.scale,
            start_year=args.start_year,
            end_year=args.end_year,
            target_month=target_month,
        )

        spi_value = float(target_cell.get("spi_value") if target_cell.get("spi_value") is not None else prediction_spi)
        backend_std = target_cell.get("climatology_std_spi")
        backend_anomaly = target_cell.get("anomaly_value")
        manual_std = manual_result.get("climatology_std_spi")
        manual_anomaly_value = None if manual_std is None else spi_value * float(manual_std)

        print("prediction_file_id:", pred_file.id)
        print("prediction_cloud_key:", prediction_cloud_key)
        print("historical_cloud_key:", historical_cloud_key)
        print("cell_id:", args.cell_id)
        print("scale:", args.scale)
        print("horizon:", args.horizon)
        print("target_month:", target_month)
        print("prediction_date:", pred_date.date())
        print("spi_value:", spi_value)
        print("backend_std:", backend_std)
        print("backend_anomaly:", backend_anomaly)
        print("manual_std:", manual_std)
        print("manual_anomaly:", manual_anomaly_value)
        print("manual_rows_used:", manual_result.get("n_rows"))
        print("historical_rows_table:")
        print(historical_rows.to_string(index=False))
        if backend_anomaly is not None and manual_anomaly_value is not None:
            diff = abs(float(backend_anomaly) - float(manual_anomaly_value))
            print("abs_diff:", diff)
        return 0
    finally:
        db_session.close()


if __name__ == "__main__":
    raise SystemExit(main())