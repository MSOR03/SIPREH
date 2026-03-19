"""
Funciones utilitarias y constantes compartidas para los endpoints de administracion.
"""
import json
import ast
import os
import tempfile
from typing import Optional, Dict, Any, List
from datetime import datetime

import duckdb
from sqlalchemy.orm import Session

from app.models.parquet_file import ParquetFile
from app.services.cloud_storage import CloudStorageService


# Shared cloud service instance
cloud_service = CloudStorageService()


DATASET_CONFIG: Dict[str, Dict[str, Any]] = {
    "historical_era5": {
        "dataset_type": "historical",
        "source": "ERA5",
        "allowed_roles": ["snapshot", "delta"],
        "update_strategy": "single_file",
        "update_guide": (
            "1. Subir archivo mensual\n"
            "2. POST /datasets/merge-and-rollover → descarga snapshot + delta, "
            "fusiona con DuckDB, sube nuevo snapshot\n"
            "Cada mes se reescribe el archivo completo (~7 MB)"
        ),
    },
    "historical_imerg": {
        "dataset_type": "historical",
        "source": "IMERG",
        "allowed_roles": ["historical_base", "updates"],
        "update_strategy": "historical_updates",
        "update_guide": (
            "1. Subir archivo mensual\n"
            "2. POST /datasets/merge-and-rollover → fusiona delta solo con updates "
            "(NO toca historical_base)\n"
            "3. Cuando updates crezca mucho: POST /datasets/compact → "
            "une historical_base + updates en uno nuevo\n"
            "Cada mes solo se reescribe updates (~pocos MB)"
        ),
    },
    "historical_chirps": {
        "dataset_type": "historical",
        "source": "CHIRPS",
        "allowed_roles": ["historical_base", "updates"],
        "update_strategy": "historical_updates",
        "update_guide": (
            "1. Subir archivo mensual\n"
            "2. POST /datasets/merge-and-rollover → fusiona delta solo con updates "
            "(NO toca historical_base)\n"
            "3. Cuando updates crezca mucho: POST /datasets/compact → "
            "une historical_base + updates en uno nuevo\n"
            "Cada mes solo se reescribe updates (~pocos MB)"
        ),
    },
    "hydro_main": {
        "dataset_type": "hydrological",
        "source": "HYDRO",
        "allowed_roles": ["snapshot", "delta"],
        "update_strategy": "single_file",
        "update_guide": (
            "1. Subir archivo mensual\n"
            "2. POST /datasets/merge-and-rollover → descarga snapshot + delta, "
            "fusiona con DuckDB, sube nuevo snapshot\n"
            "Cada mes se reescribe el archivo completo (~0.7 MB)"
        ),
    },
    "prediction_main": {
        "dataset_type": "prediction",
        "source": "MULTI_SOURCE",
        "allowed_roles": ["prediction_monthly"],
        "update_strategy": "single_file",
        "update_guide": (
            "1. Subir prediccion mensual\n"
            "2. POST /datasets/attach-file con role=prediction_monthly y "
            "activate_now=true\n"
            "Reemplaza la prediccion anterior directamente"
        ),
    },
}


# ---------------------------------------------------------------------------
# Expected parquet schemas per dataset_type
# Values are abstract *type families* (not exact DuckDB types) so that
# INT16 vs INT32, TIMESTAMP vs TIMESTAMP_NS, etc. are all accepted.
# ---------------------------------------------------------------------------

SCHEMA_HISTORICAL: Dict[str, str] = {
    "ds":          "STRING",
    "freq":        "STRING",
    "date":        "TIMESTAMP",
    "cell_id":     "STRING",
    "lon":         "DOUBLE",
    "lat":         "DOUBLE",
    "elevation":   "NUMERIC",
    "kind":        "STRING",
    "var":         "STRING",
    "source":      "STRING",
    "scale":       "INTEGER",
    "value":       "FLOAT",
    "conf_interp": "NUMERIC",
    "conf_flag":   "INTEGER",
    "n_used":      "INTEGER",
    "neff":        "NUMERIC",
}

SCHEMA_HYDRO: Dict[str, str] = {
    "#":              "INTEGER",
    "codigo":         "STRING",
    "latitud":        "DOUBLE",
    "longitud":       "DOUBLE",
    "Indice":         "STRING",
    "Escala":         "INTEGER",
    "Umbral":         "FLOAT",
    "Fecha_inicial":  "TIMESTAMP",
    "Fecha_Final":    "TIMESTAMP",
    "Duracion":       "INTEGER",
    "Valor":          "FLOAT",
}

SCHEMA_PREDICTION: Dict[str, str] = {
    "ds":          "INTEGER",
    "freq":        "STRING",
    "date":        "TIMESTAMP",
    "cell_id":     "STRING",
    "lon":         "DOUBLE",
    "lat":         "DOUBLE",
    "var":         "STRING",
    "scale":       "INTEGER",
    "value":       "FLOAT",
    "conf_interp": "INTEGER",
    "conf_flag":   "INTEGER",
    "n_used":      "INTEGER",
    "neff":        "INTEGER",
    "q1":          "FLOAT",
    "q3":          "FLOAT",
    "iqr_min":     "FLOAT",
    "iqr_max":     "FLOAT",
    "horizon":     "INTEGER",
}

EXPECTED_SCHEMAS: Dict[str, Dict[str, str]] = {
    "historical":   SCHEMA_HISTORICAL,
    "hydrological": SCHEMA_HYDRO,
    "prediction":   SCHEMA_PREDICTION,
}


# ---------------------------------------------------------------------------
# Type family normalization: DuckDB type → abstract family
# ---------------------------------------------------------------------------

_TYPE_FAMILIES: Dict[str, str] = {}

for _family, _variants in {
    "STRING":    ["VARCHAR", "TEXT", "STRING", "CHAR", "BPCHAR", "NAME", "UUID"],
    "INTEGER":   ["TINYINT", "SMALLINT", "INTEGER", "BIGINT", "HUGEINT",
                  "UTINYINT", "USMALLINT", "UINTEGER", "UBIGINT",
                  "INT8", "INT16", "INT32", "INT64", "INT128"],
    "FLOAT":     ["FLOAT", "REAL", "FLOAT4"],
    "DOUBLE":    ["DOUBLE", "FLOAT8"],
    "NUMERIC":   ["DECIMAL", "NUMERIC"],
    "TIMESTAMP": ["TIMESTAMP", "TIMESTAMP WITH TIME ZONE", "TIMESTAMPTZ",
                  "TIMESTAMP_S", "TIMESTAMP_MS", "TIMESTAMP_NS"],
    "BOOLEAN":   ["BOOLEAN", "BOOL"],
    "DATE":      ["DATE"],
    "BLOB":      ["BLOB", "BYTEA"],
}.items():
    for _v in _variants:
        _TYPE_FAMILIES[_v.upper()] = _family

# FLOAT / DOUBLE / NUMERIC are all acceptable for each other in lenient mode
_NUMERIC_FAMILIES = {"FLOAT", "DOUBLE", "NUMERIC"}
# INTEGER variants are interchangeable
_INTEGER_FAMILIES = {"INTEGER"}
# TIMESTAMP / DATE are close enough
_TEMPORAL_FAMILIES = {"TIMESTAMP", "DATE"}


def _normalize_duckdb_type(duckdb_type: str) -> str:
    """Map a DuckDB column type string to an abstract type family."""
    clean = duckdb_type.strip().upper()
    base = clean.split("(")[0].strip()
    return _TYPE_FAMILIES.get(base, clean)


def _types_compatible(expected_family: str, actual_family: str) -> bool:
    """Check if two type families are compatible (lenient)."""
    if expected_family == actual_family:
        return True
    # All numeric types are interchangeable
    if expected_family in _NUMERIC_FAMILIES | _INTEGER_FAMILIES and actual_family in _NUMERIC_FAMILIES | _INTEGER_FAMILIES:
        return True
    # FLOAT ↔ DOUBLE ↔ NUMERIC
    if expected_family in _NUMERIC_FAMILIES and actual_family in _NUMERIC_FAMILIES:
        return True
    # TIMESTAMP ↔ DATE
    if expected_family in _TEMPORAL_FAMILIES and actual_family in _TEMPORAL_FAMILIES:
        return True
    return False


class SchemaValidationResult:
    """Result of validating a parquet file's schema against the expected schema."""

    def __init__(self):
        self.is_valid: bool = True
        self.missing_columns: List[str] = []
        self.extra_columns: List[str] = []
        self.type_mismatches: List[Dict[str, str]] = []

    @property
    def error_message(self) -> str:
        parts = []
        if self.missing_columns:
            parts.append(
                f"Columnas requeridas faltantes: {', '.join(sorted(self.missing_columns))}"
            )
        if self.type_mismatches:
            mm = "; ".join(
                f"{m['col']}: esperado {m['expected']}, encontrado {m['actual']}"
                for m in self.type_mismatches
            )
            parts.append(f"Tipos incompatibles: {mm}")
        return " | ".join(parts) if parts else "Schema valido"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.is_valid,
            "missing_columns": self.missing_columns,
            "extra_columns": self.extra_columns,
            "type_mismatches": self.type_mismatches,
        }


def validate_parquet_schema(
    actual_schema: Dict[str, str],
    dataset_type: str,
) -> SchemaValidationResult:
    """
    Validate a parquet file's schema against the expected schema for a dataset_type.

    Args:
        actual_schema: {col_name: duckdb_type} from _duckdb_schema().
        dataset_type: one of "historical", "hydrological", "prediction".

    Returns:
        SchemaValidationResult with is_valid, missing_columns, type_mismatches, etc.
    """
    expected = EXPECTED_SCHEMAS.get(dataset_type)
    if expected is None:
        return SchemaValidationResult()

    result = SchemaValidationResult()

    actual_names = set(actual_schema.keys())
    expected_names = set(expected.keys())

    # Missing columns → FAIL
    result.missing_columns = sorted(expected_names - actual_names)
    if result.missing_columns:
        result.is_valid = False

    # Extra columns → informational (not a failure)
    result.extra_columns = sorted(actual_names - expected_names)

    # Type mismatches on columns that exist in both → WARNING only
    for col in sorted(expected_names & actual_names):
        expected_family = expected[col]
        actual_family = _normalize_duckdb_type(actual_schema[col])
        if not _types_compatible(expected_family, actual_family):
            result.type_mismatches.append({
                "col": col,
                "expected": expected_family,
                "actual": f"{actual_family} (raw: {actual_schema[col]})",
            })

    return result


def _parse_file_metadata(raw_metadata: Optional[str]) -> Dict[str, Any]:
    """Parse file metadata supporting JSON and legacy python-dict strings."""
    if not raw_metadata:
        return {}

    try:
        parsed = json.loads(raw_metadata)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        try:
            parsed = ast.literal_eval(raw_metadata)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, SyntaxError):
            return {}


def _save_file_metadata(file: ParquetFile, metadata: Dict[str, Any]) -> None:
    file.file_metadata = json.dumps(metadata, ensure_ascii=False)


def _file_dataset_key(file: ParquetFile) -> Optional[str]:
    meta = _parse_file_metadata(file.file_metadata)
    return meta.get("dataset_key")


def _archive_dataset_active_files(
    db: Session,
    dataset_key: str,
    exclude_file_id: Optional[int] = None,
) -> int:
    """Archive active files from the same logical dataset, excluding one file id if provided."""
    files = db.query(ParquetFile).filter(ParquetFile.status == "active").all()
    archived = 0

    for file in files:
        if exclude_file_id and file.id == exclude_file_id:
            continue

        meta = _parse_file_metadata(file.file_metadata)
        if meta.get("dataset_key") != dataset_key:
            continue

        file.status = "archived"
        meta["active_for_queries"] = False
        meta["archived_at"] = datetime.utcnow().isoformat()
        _save_file_metadata(file, meta)
        archived += 1

    return archived


def _next_snapshot_version(db: Session, dataset_key: str) -> int:
    """Compute next snapshot version for a dataset from existing metadata."""
    max_version = 0
    for file in db.query(ParquetFile).all():
        meta = _parse_file_metadata(file.file_metadata)
        if meta.get("dataset_key") != dataset_key:
            continue
        version = meta.get("snapshot_version")
        if isinstance(version, int) and version > max_version:
            max_version = version
    return max_version + 1


def _dataset_files(db: Session, dataset_key: str) -> List[ParquetFile]:
    """Get all files that belong to a logical dataset key."""
    files = db.query(ParquetFile).all()
    result = []
    for file in files:
        meta = _parse_file_metadata(file.file_metadata)
        if meta.get("dataset_key") == dataset_key:
            result.append(file)
    return result


def _sql_ident(name: str) -> str:
    """Quote SQL identifier safely for DuckDB."""
    escaped = name.replace('"', '""')
    return f'"{escaped}"'


def _duckdb_columns(conn: duckdb.DuckDBPyConnection, parquet_path: str) -> List[str]:
    """Return parquet column names from a local parquet file path."""
    rows = conn.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{parquet_path}')"
    ).fetchall()
    return [r[0] for r in rows]


def _duckdb_schema(conn: duckdb.DuckDBPyConnection, parquet_path: str) -> dict:
    """Return {column_name: column_type} for a parquet file."""
    rows = conn.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{parquet_path}')"
    ).fetchall()
    return {r[0]: r[1] for r in rows}


_TIMESTAMP_TYPES = {"TIMESTAMP", "TIMESTAMP WITH TIME ZONE", "TIMESTAMPTZ",
                    "TIMESTAMP_S", "TIMESTAMP_MS", "TIMESTAMP_NS"}


def _build_normalized_select(
    conn: duckdb.DuckDBPyConnection,
    path_a: str,
    path_b: str,
    source_priority_a: int = 0,
    source_priority_b: int = 1,
) -> tuple:
    """
    Build SELECT expressions for two parquet files that normalize mismatched
    timestamp types (TIMESTAMP vs TIMESTAMP WITH TIME ZONE) by casting both
    sides to plain TIMESTAMP.

    Returns (select_a: str, select_b: str) — full SELECT statements ready for
    UNION ALL BY NAME.
    """
    schema_a = _duckdb_schema(conn, path_a)
    schema_b = _duckdb_schema(conn, path_b)

    # Find columns where one side is TIMESTAMP and the other is TIMESTAMPTZ
    cast_cols = set()
    for col in set(schema_a.keys()) & set(schema_b.keys()):
        type_a = schema_a[col].upper()
        type_b = schema_b[col].upper()
        if type_a != type_b and type_a in _TIMESTAMP_TYPES and type_b in _TIMESTAMP_TYPES:
            cast_cols.add(col)

    if not cast_cols:
        # No mismatches — use original simple SELECTs
        sel_a = f"SELECT *, {source_priority_a} AS __source_priority FROM read_parquet('{path_a}')"
        sel_b = f"SELECT *, {source_priority_b} AS __source_priority FROM read_parquet('{path_b}')"
        return sel_a, sel_b

    def _make_select(path: str, schema: dict, priority: int) -> str:
        cols = []
        for col_name in schema:
            ident = _sql_ident(col_name)
            if col_name in cast_cols:
                cols.append(f"CAST({ident} AS TIMESTAMP) AS {ident}")
            else:
                cols.append(ident)
        cols.append(f"{priority} AS __source_priority")
        cols_str = ", ".join(cols)
        return f"SELECT {cols_str} FROM read_parquet('{path}')"

    sel_a = _make_select(path_a, schema_a, source_priority_a)
    sel_b = _make_select(path_b, schema_b, source_priority_b)
    return sel_a, sel_b


def _choose_dedup_keys(columns: List[str], dataset_key: str) -> List[str]:
    """Pick best available dedup keys based on known schemas and dataset."""
    cols = set(columns)

    if dataset_key == "prediction_main":
        candidates = [
            ["issue_date", "source_model", "horizon_months", "drought_index", "cell_id"],
            ["issue_date", "source_model", "horizon_months", "drought_index", "station_id"],
            ["issue_date", "source", "horizon", "index", "cell_id"],
        ]
    else:
        candidates = [
            # Long format (one metric per row): keep variable/index dimension.
            ["date", "cell_id", "var"],
            ["date", "cell_id", "variable"],
            ["date", "cell_id", "drought_index"],
            ["date", "cell_id", "index"],
            ["date", "station_id", "var"],
            ["date", "station_id", "variable"],
            ["date", "station_id", "drought_index"],
            ["date", "lat", "lon", "var"],
            ["date", "lat", "lon", "variable"],
            ["date", "lat", "lon", "drought_index"],
            ["datetime", "cell_id", "var"],
            ["datetime", "cell_id", "variable"],
            ["datetime", "cell_id", "drought_index"],
            ["fecha", "cell_id", "var"],
            ["fecha", "cell_id", "variable"],
            ["fecha", "cell_id", "drought_index"],
            ["fecha", "lat", "lon", "var"],
            ["fecha", "lat", "lon", "variable"],
            ["fecha", "lat", "lon", "drought_index"],

            # Wide format (one row with many metric columns).
            ["date", "cell_id"],
            ["date", "station_id"],
            ["date", "lat", "lon"],
            ["datetime", "cell_id"],
            ["fecha", "cell_id"],
            ["fecha", "lat", "lon"],
        ]

    for keyset in candidates:
        if all(k in cols for k in keyset):
            return keyset

    return []


def detect_resolution_from_filename(filename: str) -> tuple[str, float]:
    """
    Detecta la resolucion basandose en el nombre del archivo.

    Convenciones:
    - grid_ERA5.parquet -> Baja resolucion (0.25°)
    - grid_IMERG.parquet -> Media resolucion (0.10°)
    - grid_CHIRPS.parquet -> Alta resolucion (mejor, mas pesado)

    Args:
        filename: Nombre del archivo

    Returns:
        Tupla (level_name, resolution_degrees)
    """
    filename_lower = filename.lower()

    if 'era5' in filename_lower:
        return ('low', 0.25)
    elif 'imerg' in filename_lower:
        return ('medium', 0.10)
    elif 'chirps' in filename_lower:
        return ('high', 0.05)
    else:
        # Default: intentar adivinar por tamano o usar medium como default
        return ('unknown', 0.10)
