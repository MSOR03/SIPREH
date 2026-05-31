"""Validate SPI anomaly using API response vs manual PyArrow computation.

This script avoids duckdb/pandas and is safe in environments where only
sqlite3 + pyarrow are available.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sqlite3
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq


BACKEND_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_ROOT / "droughtmonitor.db"
CACHE_DIR = BACKEND_ROOT / ".cache_parquet"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate SPI anomaly calculation")
    parser.add_argument("--api-url", default="http://127.0.0.1:8000/api/v1/prediction/spatial")
    parser.add_argument("--prediction-file-id", type=int, default=None)
    parser.add_argument("--historical-file-id", type=int, default=13)
    parser.add_argument("--cell-id", default="-74.375000_3.675000")
    parser.add_argument("--scale", type=int, default=6)
    parser.add_argument("--horizon", type=int, default=12)
    parser.add_argument("--var", default="SPI")
    parser.add_argument("--clim-start-year", type=int, default=1991)
    parser.add_argument("--clim-end-year", type=int, default=2020)
    parser.add_argument("--consultation-date", default=None)
    return parser.parse_args()


def cloud_cache_path(cloud_key: str) -> Path:
    digest = hashlib.md5(cloud_key.encode("utf-8")).hexdigest()
    path = CACHE_DIR / f"{digest}.parquet"
    if not path.exists():
        raise RuntimeError(f"Parquet no disponible en cache local: {path}")
    return path


def resolve_prediction_row(conn: sqlite3.Connection, prediction_file_id: int | None) -> tuple[int, str, dict]:
    cur = conn.cursor()
    if prediction_file_id is not None:
        row = cur.execute(
            "SELECT id, cloud_key, file_metadata FROM parquet_files WHERE id = ?",
            (prediction_file_id,),
        ).fetchone()
        if row is None:
            raise RuntimeError(f"No existe parquet_files.id={prediction_file_id}")
        meta = json.loads(row[2]) if row[2] else {}
        return int(row[0]), str(row[1]), meta

    rows = cur.execute(
        """
        SELECT id, cloud_key, file_metadata, status
        FROM parquet_files
        WHERE cloud_key IS NOT NULL
        ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END, id DESC
        """
    ).fetchall()
    for row in rows:
        meta = json.loads(row[2]) if row[2] else {}
        if meta.get("dataset_key") == "prediction_main":
            return int(row[0]), str(row[1]), meta

    raise RuntimeError("No se encontró archivo prediction_main")


def resolve_historical_cloud_key(conn: sqlite3.Connection, historical_file_id: int) -> str:
    row = conn.execute(
        "SELECT cloud_key FROM parquet_files WHERE id = ?",
        (historical_file_id,),
    ).fetchone()
    if row is None or not row[0]:
        raise RuntimeError(f"No existe cloud_key para historical_file_id={historical_file_id}")
    return str(row[0])


def prediction_value_from_parquet(
    pred_path: Path,
    cell_id: str,
    scale: int,
    horizon: int,
    var: str,
) -> tuple[datetime, float]:
    table = pq.read_table(
        str(pred_path),
        columns=["cell_id", "scale", "horizon", "var", "date", "value"],
    )
    mask = pc.equal(table["cell_id"], cell_id)
    mask = pc.and_kleene(mask, pc.equal(table["scale"], scale))
    mask = pc.and_kleene(mask, pc.equal(table["horizon"], horizon))
    mask = pc.and_kleene(mask, pc.equal(table["var"], var))
    sub = table.filter(mask)
    if sub.num_rows == 0:
        raise RuntimeError("No hay fila de predicción para cell/scale/horizon/var")

    rows = sub.select(["date", "value"]).to_pylist()
    rows.sort(key=lambda row: row["date"])
    first = rows[0]
    return first["date"], float(first["value"])


def _freq_allowed_mask(freq_col):
    freq_upper = pc.ascii_upper(pc.fill_null(freq_col, ""))
    return pc.or_kleene(
        pc.equal(freq_upper, ""),
        pc.or_kleene(
            pc.equal(freq_upper, "M"),
            pc.or_kleene(
                pc.equal(freq_upper, "MON"),
                pc.or_kleene(pc.equal(freq_upper, "MONTH"), pc.equal(freq_upper, "MONTHLY")),
            ),
        ),
    )


def std_for_window(
    hist_path: Path,
    cell_id: str,
    scale: int,
    month: int,
    year_start: int,
    year_end: int,
) -> tuple[int, float | None]:
    table = pq.read_table(
        str(hist_path),
        columns=["date", "cell_id", "scale", "var", "value", "source", "freq"],
    )
    mask = pc.equal(table["cell_id"], cell_id)
    mask = pc.and_kleene(mask, pc.equal(table["scale"], scale))
    mask = pc.and_kleene(mask, pc.equal(table["var"], "SPI"))
    mask = pc.and_kleene(mask, pc.equal(pc.ascii_upper(table["source"]), "SAT_RAW"))
    mask = pc.and_kleene(mask, _freq_allowed_mask(table["freq"]))
    mask = pc.and_kleene(mask, pc.greater_equal(pc.year(table["date"]), year_start))
    mask = pc.and_kleene(mask, pc.less_equal(pc.year(table["date"]), year_end))
    mask = pc.and_kleene(mask, pc.equal(pc.month(table["date"]), month))

    sub = table.filter(mask).select(["value"])
    values = [float(row["value"]) for row in sub.to_pylist()]
    values = [value for value in values if math.isfinite(value) and abs(value) <= 50]
    n = len(values)
    if n < 2:
        return n, None

    mean_value = sum(values) / n
    variance = sum((value - mean_value) ** 2 for value in values) / (n - 1)
    return n, variance ** 0.5


def shift_window(start_year: int, end_year: int, issued_month: int, horizon: int) -> tuple[int, int, int]:
    start_total = start_year * 12 + (issued_month - 1) + horizon
    end_total = end_year * 12 + (issued_month - 1) + horizon
    shifted_start_year = start_total // 12
    shifted_end_year = end_total // 12
    shifted_month = (start_total % 12) + 1
    return shifted_start_year, shifted_end_year, shifted_month


def call_api(args: argparse.Namespace, cell_id: str) -> tuple[dict | None, dict | None, str | None]:
    payload = {
        "parquet_file_id": args.prediction_file_id,
        "var": args.var,
        "scale": args.scale,
        "horizon": args.horizon,
        "include_anomaly": True,
        "map_metric": "anomaly",
        "clim_start_year": args.clim_start_year,
        "clim_end_year": args.clim_end_year,
    }
    if args.consultation_date:
        payload["consultation_date"] = args.consultation_date

    req = urllib.request.Request(
        args.api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            body = json.loads(response.read().decode("utf-8"))
        row = next((cell for cell in body.get("grid_cells", []) if str(cell.get("cell_id")) == str(cell_id)), None)
        return body, row, None
    except urllib.error.HTTPError as err:
        return None, None, f"HTTP {err.code}: {err.read().decode('utf-8')}"
    except Exception as err:  # pragma: no cover
        return None, None, f"{type(err).__name__}: {err}"


def main() -> int:
    args = parse_args()
    if not DB_PATH.exists():
        raise RuntimeError(f"No se encontró la base de datos: {DB_PATH}")

    conn = sqlite3.connect(str(DB_PATH))
    try:
        prediction_file_id, prediction_cloud_key, prediction_meta = resolve_prediction_row(conn, args.prediction_file_id)
        args.prediction_file_id = prediction_file_id
        historical_cloud_key = resolve_historical_cloud_key(conn, args.historical_file_id)

        pred_path = cloud_cache_path(prediction_cloud_key)
        hist_path = cloud_cache_path(historical_cloud_key)

        pred_date, spi_value = prediction_value_from_parquet(
            pred_path,
            cell_id=args.cell_id,
            scale=args.scale,
            horizon=args.horizon,
            var=args.var,
        )

        api_body, api_cell, api_error = call_api(args, args.cell_id)

        old_n, old_std = std_for_window(
            hist_path,
            cell_id=args.cell_id,
            scale=args.scale,
            month=pred_date.month,
            year_start=args.clim_start_year,
            year_end=args.clim_end_year,
        )

        issued_at_raw = prediction_meta.get("issued_at")
        issued_month = date.fromisoformat(issued_at_raw[:10]).month if issued_at_raw else 1
        new_start, new_end, new_month = shift_window(
            args.clim_start_year,
            args.clim_end_year,
            issued_month,
            args.horizon,
        )
        new_n, new_std = std_for_window(
            hist_path,
            cell_id=args.cell_id,
            scale=args.scale,
            month=new_month,
            year_start=new_start,
            year_end=new_end,
        )

        old_anom = (spi_value * old_std) if old_std is not None else None
        new_anom = (spi_value * new_std) if new_std is not None else None

        print("prediction_file_id", prediction_file_id)
        print("prediction_cloud_key", prediction_cloud_key)
        print("historical_cloud_key", historical_cloud_key)
        print("cell_id", args.cell_id)
        print("scale", args.scale)
        print("horizon", args.horizon)
        print("issued_at", issued_at_raw)
        print("pred_date", pred_date.date().isoformat())
        print("spi", f"{spi_value:.12f}")

        print("old_window", f"{args.clim_start_year}-{args.clim_end_year}", f"month={pred_date.month}", f"n={old_n}")
        print("old_std", None if old_std is None else f"{old_std:.12f}")
        print("old_anomaly", None if old_anom is None else f"{old_anom:.12f}")

        print("new_window", f"{new_start}-{new_end}", f"month={new_month}", f"n={new_n}")
        print("new_std", None if new_std is None else f"{new_std:.12f}")
        print("new_anomaly", None if new_anom is None else f"{new_anom:.12f}")

        if api_error:
            print("api_error", api_error)
            return 0

        assert api_body is not None
        print("api_effective_horizon", api_body.get("effective_horizon"))
        print("api_target_month", api_body.get("target_month"))
        print("api_climatology_period", api_body.get("anomaly_metadata", {}).get("climatology_period"))

        if api_cell is None:
            print("api_cell", None)
            return 0

        api_std = api_cell.get("climatology_std_spi")
        api_anom = api_cell.get("anomaly_value")
        print("api_std", api_std)
        print("api_anomaly", api_anom)
        if api_std is not None and old_std is not None:
            print("abs_diff_api_vs_old_std", f"{abs(float(api_std) - float(old_std)):.12f}")
        if api_std is not None and new_std is not None:
            print("abs_diff_api_vs_new_std", f"{abs(float(api_std) - float(new_std)):.12f}")
        if api_anom is not None and old_anom is not None:
            print("abs_diff_api_vs_old_anomaly", f"{abs(float(api_anom) - float(old_anom)):.12f}")
        if api_anom is not None and new_anom is not None:
            print("abs_diff_api_vs_new_anomaly", f"{abs(float(api_anom) - float(new_anom)):.12f}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())