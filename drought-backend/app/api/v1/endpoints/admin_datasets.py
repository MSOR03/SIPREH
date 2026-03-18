"""
Admin endpoints: Dataset lifecycle (catalog, attach, rollover, status, merge-and-rollover).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime
import json
import os
import tempfile

import duckdb

from app.db.session import get_db
from app.api.deps import get_current_admin_user
from app.models.user import User
from app.models.parquet_file import ParquetFile
from app.api.v1.endpoints.admin_schemas import (
    DatasetCatalogResponse,
    DatasetAttachRequest,
    DatasetAttachResponse,
    DatasetRolloverRequest,
    DatasetRolloverResponse,
    DatasetStatusResponse,
    DatasetMergeAndRolloverRequest,
    DatasetMergeAndRolloverResponse,
)
from app.api.v1.endpoints.admin_utils import (
    cloud_service,
    DATASET_CONFIG,
    EXPECTED_SCHEMAS,
    _parse_file_metadata,
    _save_file_metadata,
    _archive_dataset_active_files,
    _next_snapshot_version,
    _dataset_files,
    _sql_ident,
    _duckdb_columns,
    _duckdb_schema,
    _choose_dedup_keys,
    _build_normalized_select,
    validate_parquet_schema,
)


router = APIRouter()


@router.get("/datasets/catalog", response_model=DatasetCatalogResponse)
def get_dataset_catalog(
    current_admin: User = Depends(get_current_admin_user)
):
    """Return supported dataset keys for monthly update workflows."""
    datasets = [
        {
            "dataset_key": key,
            "dataset_type": cfg["dataset_type"],
            "source": cfg["source"],
            "allowed_roles": cfg["allowed_roles"],
            "update_strategy": cfg.get("update_strategy", "single_file"),
            "update_guide": cfg.get("update_guide"),
        }
        for key, cfg in DATASET_CONFIG.items()
    ]
    return {"total": len(datasets), "datasets": datasets}


@router.post("/datasets/attach-file", response_model=DatasetAttachResponse)
def attach_file_to_dataset(
    payload: DatasetAttachRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Assign a previously uploaded file to a logical dataset as snapshot/delta/prediction_monthly.
    This enables monthly operations without DB migrations.
    """
    dataset_cfg = DATASET_CONFIG.get(payload.dataset_key)
    if not dataset_cfg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"dataset_key invalido: {payload.dataset_key}",
        )

    if payload.role not in dataset_cfg["allowed_roles"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Rol '{payload.role}' no permitido para {payload.dataset_key}. "
                f"Permitidos: {', '.join(dataset_cfg['allowed_roles'])}"
            ),
        )

    file = db.query(ParquetFile).filter(ParquetFile.id == payload.file_id).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    # --- Schema validation ---
    schema_warnings = None
    if not payload.skip_schema_validation and file.cloud_key:
        dataset_type = dataset_cfg["dataset_type"]
        file_bytes = cloud_service.download_file(file.cloud_key)
        if file_bytes is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo descargar el archivo desde cloud para validar schema.",
            )

        with tempfile.TemporaryDirectory(prefix="drought_validate_") as tmpdir:
            validate_path = os.path.join(tmpdir, "validate.parquet")
            with open(validate_path, "wb") as vf:
                vf.write(file_bytes)

            conn = duckdb.connect(database=":memory:")
            try:
                actual_schema = _duckdb_schema(conn, validate_path)
            finally:
                conn.close()

        validation = validate_parquet_schema(actual_schema, dataset_type)
        if not validation.is_valid:
            expected = EXPECTED_SCHEMAS.get(dataset_type, {})
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": (
                        f"Schema del parquet no coincide con lo esperado "
                        f"para dataset_type='{dataset_type}'."
                    ),
                    "validation": validation.to_dict(),
                    "expected_columns": sorted(expected.keys()),
                    "hint": "Si necesitas omitir esta validacion, usa skip_schema_validation=true.",
                },
            )
        if validation.type_mismatches:
            schema_warnings = [
                f"{m['col']}: esperado {m['expected']}, encontrado {m['actual']}"
                for m in validation.type_mismatches
            ]

    metadata = _parse_file_metadata(file.file_metadata)
    metadata.update(payload.extra_metadata or {})
    metadata.update({
        "dataset_key": payload.dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "role": payload.role,
        "year_month": payload.year_month,
        "period_start": payload.period_start,
        "period_end": payload.period_end,
        "active_for_queries": False,
        "attached_at": datetime.utcnow().isoformat(),
    })

    archived_count = 0
    if payload.activate_now:
        archived_count = _archive_dataset_active_files(db, payload.dataset_key, exclude_file_id=file.id)
        file.status = "active"
        metadata["active_for_queries"] = True
        metadata["activated_at"] = datetime.utcnow().isoformat()
    else:
        if file.status != "active":
            file.status = "pending"

    _save_file_metadata(file, metadata)
    db.commit()

    return {
        "success": True,
        "file_id": file.id,
        "dataset_key": payload.dataset_key,
        "role": payload.role,
        "status": file.status,
        "archived_previous_active": archived_count,
        "schema_warnings": schema_warnings,
    }


@router.post("/datasets/rollover", response_model=DatasetRolloverResponse)
def rollover_dataset_monthly(
    payload: DatasetRolloverRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Monthly rollover workflow:
    1) Promote new snapshot file as active.
    2) Archive previous active snapshot for same dataset.
    3) Mark merged delta files as archived + merged=true.
    """
    dataset_cfg = DATASET_CONFIG.get(payload.dataset_key)
    if not dataset_cfg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"dataset_key invalido: {payload.dataset_key}",
        )

    if dataset_cfg["dataset_type"] == "prediction":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="prediction_main no usa rollover snapshot; usa attach-file con role=prediction_monthly y activate_now=true",
        )

    new_file = db.query(ParquetFile).filter(ParquetFile.id == payload.new_snapshot_file_id).first()
    if not new_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New snapshot file not found")

    archived_previous = 0
    if payload.archive_previous_snapshot:
        archived_previous = _archive_dataset_active_files(db, payload.dataset_key, exclude_file_id=new_file.id)

    metadata = _parse_file_metadata(new_file.file_metadata)
    snapshot_version = _next_snapshot_version(db, payload.dataset_key)
    metadata.update({
        "dataset_key": payload.dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "role": "snapshot",
        "snapshot_version": snapshot_version,
        "merged_from_file_ids": payload.merged_delta_file_ids,
        "rolled_over_at": datetime.utcnow().isoformat(),
        "active_for_queries": True,
    })
    _save_file_metadata(new_file, metadata)
    new_file.status = "active"

    archived_deltas = 0
    if payload.merged_delta_file_ids:
        deltas = db.query(ParquetFile).filter(ParquetFile.id.in_(payload.merged_delta_file_ids)).all()
        for delta_file in deltas:
            delta_meta = _parse_file_metadata(delta_file.file_metadata)
            if delta_meta.get("dataset_key") and delta_meta.get("dataset_key") != payload.dataset_key:
                continue

            delta_meta.update({
                "dataset_key": payload.dataset_key,
                "dataset_type": dataset_cfg["dataset_type"],
                "source": dataset_cfg["source"],
                "role": "delta",
                "merged": True,
                "merged_into_file_id": new_file.id,
                "merged_at": datetime.utcnow().isoformat(),
                "active_for_queries": False,
            })
            _save_file_metadata(delta_file, delta_meta)
            delta_file.status = "archived"
            archived_deltas += 1

    db.commit()

    return {
        "success": True,
        "dataset_key": payload.dataset_key,
        "active_file_id": new_file.id,
        "snapshot_version": snapshot_version,
        "archived_previous_snapshot": archived_previous,
        "archived_deltas": archived_deltas,
    }


@router.get("/datasets/{dataset_key}/status", response_model=DatasetStatusResponse)
def get_dataset_status(
    dataset_key: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Return active file + pending deltas + recent archived files for a dataset key."""
    dataset_cfg = DATASET_CONFIG.get(dataset_key)
    if not dataset_cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"dataset_key no encontrado: {dataset_key}",
        )

    files = _dataset_files(db, dataset_key)
    files_sorted = sorted(files, key=lambda f: f.created_at or datetime.min, reverse=True)

    def to_status_file(file: ParquetFile) -> Dict[str, Any]:
        meta = _parse_file_metadata(file.file_metadata)
        return {
            "file_id": file.id,
            "filename": file.filename,
            "status": file.status,
            "role": meta.get("role"),
            "year_month": meta.get("year_month"),
            "snapshot_version": meta.get("snapshot_version"),
            "created_at": file.created_at,
        }

    active_candidates = [f for f in files_sorted if f.status == "active"]
    active_file = to_status_file(active_candidates[0]) if active_candidates else None

    pending_deltas = []
    archived_recent = []
    for file in files_sorted:
        info = to_status_file(file)
        role = info.get("role")
        if file.status == "pending" and role in {"delta", "prediction_monthly"}:
            pending_deltas.append(info)
        elif file.status == "archived":
            archived_recent.append(info)

    return {
        "dataset_key": dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "active_file": active_file,
        "pending_deltas": pending_deltas[:24],
        "archived_recent": archived_recent[:24],
    }


@router.post("/datasets/merge-and-rollover", response_model=DatasetMergeAndRolloverResponse)
def merge_and_rollover_dataset(
    payload: DatasetMergeAndRolloverRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Fully automatic monthly update:
    - Takes active snapshot + monthly delta.
    - Merges and de-duplicates server-side using DuckDB.
    - Uploads new consolidated snapshot to R2.
    - Activates new snapshot and archives previous active + merged monthly delta.
    """
    dataset_cfg = DATASET_CONFIG.get(payload.dataset_key)
    if not dataset_cfg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"dataset_key invalido: {payload.dataset_key}",
        )

    if dataset_cfg["dataset_type"] == "prediction":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "prediction_main no requiere merge con snapshot gigante. "
                "Usa /admin/datasets/attach-file con role=prediction_monthly y activate_now=true."
            ),
        )

    monthly_file = db.query(ParquetFile).filter(ParquetFile.id == payload.monthly_file_id).first()
    if not monthly_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="monthly_file_id no encontrado")

    monthly_meta = _parse_file_metadata(monthly_file.file_metadata)
    monthly_meta.update({
        "dataset_key": payload.dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "role": "delta",
        "year_month": payload.year_month,
        "period_start": payload.period_start,
        "period_end": payload.period_end,
        "merged": False,
        "active_for_queries": False,
    })

    files = _dataset_files(db, payload.dataset_key)
    active_candidates = [f for f in files if f.status == "active"]
    active_snapshot = active_candidates[0] if active_candidates else None

    # Bootstrap case: no previous snapshot yet -> promote monthly as first snapshot.
    if not active_snapshot:
        snapshot_version = _next_snapshot_version(db, payload.dataset_key)
        monthly_meta.update({
            "role": "snapshot",
            "snapshot_version": snapshot_version,
            "merged_from_file_ids": [monthly_file.id],
            "active_for_queries": True,
            "activated_at": datetime.utcnow().isoformat(),
        })
        _save_file_metadata(monthly_file, monthly_meta)
        monthly_file.status = "active"
        db.commit()

        return {
            "success": True,
            "dataset_key": payload.dataset_key,
            "new_snapshot_file_id": monthly_file.id,
            "previous_snapshot_file_id": None,
            "merged_monthly_file_id": monthly_file.id,
            "dedup_keys": [],
            "snapshot_version": snapshot_version,
            "output_rows": monthly_meta.get("num_rows", 0) or 0,
            "output_size_mb": round((monthly_file.file_size or 0) / (1024 * 1024), 3),
        }

    if not active_snapshot.cloud_key or not monthly_file.cloud_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los archivos para merge deben tener cloud_key.",
        )

    # --- Elegir flujo segun estrategia de storage ---
    update_strategy = dataset_cfg.get("update_strategy", "single_file")

    if update_strategy == "historical_updates":
        # TIERED: buscar el archivo updates activo (no el historical_base)
        updates_file = None
        for f in active_candidates:
            fm = _parse_file_metadata(f.file_metadata)
            if fm.get("role") == "updates":
                updates_file = f
                break

        if updates_file and updates_file.cloud_key:
            # Merge delta INTO updates (no tocar historical_base)
            updates_bytes = cloud_service.download_file(updates_file.cloud_key)
            monthly_bytes = cloud_service.download_file(monthly_file.cloud_key)
            if updates_bytes is None or monthly_bytes is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No se pudo descargar updates o delta mensual desde cloud.",
                )

            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            new_updates_filename = f"{payload.dataset_key}_updates_{timestamp}.parquet"
            new_updates_key = f"parquet/tiered/{payload.dataset_key}/{new_updates_filename}"

            output_rows = 0
            dedup_keys: List[str] = []

            with tempfile.TemporaryDirectory(prefix="drought_tiered_") as tmpdir:
                updates_path = os.path.join(tmpdir, "updates.parquet")
                monthly_path = os.path.join(tmpdir, "monthly_delta.parquet")
                merged_path = os.path.join(tmpdir, "new_updates.parquet")

                with open(updates_path, "wb") as f:
                    f.write(updates_bytes)
                with open(monthly_path, "wb") as f:
                    f.write(monthly_bytes)

                conn = duckdb.connect(database=':memory:')
                try:
                    # Validate monthly delta schema before merge
                    if not payload.skip_schema_validation:
                        monthly_schema = _duckdb_schema(conn, monthly_path)
                        validation = validate_parquet_schema(
                            monthly_schema, dataset_cfg["dataset_type"]
                        )
                        if not validation.is_valid:
                            raise HTTPException(
                                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail={
                                    "message": (
                                        f"Schema del delta mensual no coincide con "
                                        f"lo esperado para '{payload.dataset_key}'."
                                    ),
                                    "validation": validation.to_dict(),
                                    "expected_columns": sorted(
                                        EXPECTED_SCHEMAS.get(dataset_cfg["dataset_type"], {}).keys()
                                    ),
                                    "hint": "Si necesitas omitir esta validacion, usa skip_schema_validation=true.",
                                },
                            )

                    updates_cols = _duckdb_columns(conn, updates_path)
                    monthly_cols = _duckdb_columns(conn, monthly_path)
                    common_cols = sorted(set(updates_cols).intersection(set(monthly_cols)))
                    dedup_keys = _choose_dedup_keys(common_cols, payload.dataset_key)

                    # Build normalized SELECTs that cast mismatched timestamp types
                    sel_updates, sel_monthly = _build_normalized_select(
                        conn, updates_path, monthly_path,
                        source_priority_a=0, source_priority_b=1,
                    )

                    if dedup_keys:
                        partition_expr = ", ".join(_sql_ident(col) for col in dedup_keys)
                        merge_sql = f"""
                        COPY (
                            WITH unioned AS (
                                {sel_updates}
                                UNION ALL BY NAME
                                {sel_monthly}
                            ), ranked AS (
                                SELECT *,
                                       ROW_NUMBER() OVER (
                                           PARTITION BY {partition_expr}
                                           ORDER BY __source_priority DESC
                                       ) AS __rn
                                FROM unioned
                            )
                            SELECT * EXCLUDE (__source_priority, __rn)
                            FROM ranked
                            WHERE __rn = 1
                        ) TO '{merged_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
                        """
                    else:
                        # Strip __source_priority since no dedup needed
                        sel_updates_nodp = sel_updates.replace(", 0 AS __source_priority", "")
                        sel_monthly_nodp = sel_monthly.replace(", 1 AS __source_priority", "")
                        merge_sql = f"""
                        COPY (
                            {sel_updates_nodp}
                            UNION ALL BY NAME
                            {sel_monthly_nodp}
                        ) TO '{merged_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
                        """

                    conn.execute(merge_sql)
                    output_rows = int(conn.execute(f"SELECT COUNT(*) FROM read_parquet('{merged_path}')").fetchone()[0])
                finally:
                    conn.close()

                merged_size = os.path.getsize(merged_path)
                with open(merged_path, "rb") as merged_file:
                    merged_hash = cloud_service.calculate_file_hash(merged_file)
                    success, upload_result = cloud_service.upload_file(
                        merged_file,
                        new_updates_key,
                        metadata={
                            "dataset_key": payload.dataset_key,
                            "source": dataset_cfg["source"],
                            "role": "updates",
                            "merged_at": datetime.utcnow().isoformat(),
                        },
                    )

                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Error subiendo updates consolidado: {upload_result}",
                    )

            snapshot_version = _next_snapshot_version(db, payload.dataset_key)

            new_updates_meta = {
                "dataset_key": payload.dataset_key,
                "dataset_type": dataset_cfg["dataset_type"],
                "source": dataset_cfg["source"],
                "role": "updates",
                "snapshot_version": snapshot_version,
                "year_month": payload.year_month,
                "period_start": payload.period_start or monthly_meta.get("period_start"),
                "period_end": payload.period_end or monthly_meta.get("period_end"),
                "merged_from_file_ids": [updates_file.id, monthly_file.id],
                "dedup_keys": dedup_keys,
                "num_rows": output_rows,
                "active_for_queries": True,
                "created_by": "merge-and-rollover-tiered",
                "merged_at": datetime.utcnow().isoformat(),
            }

            new_updates_db = ParquetFile(
                filename=new_updates_filename,
                original_filename=new_updates_filename,
                file_size=int(merged_size),
                cloud_url=upload_result,
                cloud_key=new_updates_key,
                file_hash=merged_hash,
                file_metadata=json.dumps(new_updates_meta),
                status="active",
                uploaded_by=current_admin.id,
            )

            db.add(new_updates_db)
            db.flush()

            # Archivar el updates anterior
            old_updates_meta = _parse_file_metadata(updates_file.file_metadata)
            old_updates_meta.update({
                "active_for_queries": False,
                "superseded_by_file_id": new_updates_db.id,
                "superseded_at": datetime.utcnow().isoformat(),
            })
            _save_file_metadata(updates_file, old_updates_meta)
            updates_file.status = "archived"

            # Archivar el delta mensual
            monthly_meta.update({
                "merged": True,
                "merged_into_file_id": new_updates_db.id,
                "merged_at": datetime.utcnow().isoformat(),
                "active_for_queries": False,
            })
            _save_file_metadata(monthly_file, monthly_meta)
            monthly_file.status = "archived"

            db.commit()
            db.refresh(new_updates_db)

            return {
                "success": True,
                "dataset_key": payload.dataset_key,
                "new_snapshot_file_id": new_updates_db.id,
                "previous_snapshot_file_id": updates_file.id,
                "merged_monthly_file_id": monthly_file.id,
                "dedup_keys": dedup_keys,
                "snapshot_version": snapshot_version,
                "output_rows": output_rows,
                "output_size_mb": round((new_updates_db.file_size or 0) / (1024 * 1024), 3),
            }
        # else: no updates file found, fall through to standard merge

    # --- STANDARD single_file merge (flujo original) ---

    snapshot_bytes = cloud_service.download_file(active_snapshot.cloud_key)
    monthly_bytes = cloud_service.download_file(monthly_file.cloud_key)
    if snapshot_bytes is None or monthly_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo descargar snapshot activo o delta mensual desde cloud.",
        )

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    merged_filename = f"{payload.dataset_key}_snapshot_{timestamp}.parquet"
    merged_key = f"parquet/merged/{payload.dataset_key}/{merged_filename}"

    output_rows = 0
    dedup_keys: List[str] = []

    with tempfile.TemporaryDirectory(prefix="drought_merge_") as tmpdir:
        snapshot_path = os.path.join(tmpdir, "active_snapshot.parquet")
        monthly_path = os.path.join(tmpdir, "monthly_delta.parquet")
        merged_path = os.path.join(tmpdir, "merged_snapshot.parquet")

        with open(snapshot_path, "wb") as f:
            f.write(snapshot_bytes)
        with open(monthly_path, "wb") as f:
            f.write(monthly_bytes)

        conn = duckdb.connect(database=':memory:')
        try:
            # Validate monthly delta schema before merge
            if not payload.skip_schema_validation:
                monthly_schema = _duckdb_schema(conn, monthly_path)
                validation = validate_parquet_schema(
                    monthly_schema, dataset_cfg["dataset_type"]
                )
                if not validation.is_valid:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={
                            "message": (
                                f"Schema del delta mensual no coincide con "
                                f"lo esperado para '{payload.dataset_key}'."
                            ),
                            "validation": validation.to_dict(),
                            "expected_columns": sorted(
                                EXPECTED_SCHEMAS.get(dataset_cfg["dataset_type"], {}).keys()
                            ),
                            "hint": "Si necesitas omitir esta validacion, usa skip_schema_validation=true.",
                        },
                    )

            # Inspect schema and choose best dedup keys.
            snapshot_cols = _duckdb_columns(conn, snapshot_path)
            monthly_cols = _duckdb_columns(conn, monthly_path)
            common_cols = sorted(set(snapshot_cols).intersection(set(monthly_cols)))
            dedup_keys = _choose_dedup_keys(common_cols, payload.dataset_key)

            # Build normalized SELECTs that cast mismatched timestamp types
            sel_snapshot, sel_monthly = _build_normalized_select(
                conn, snapshot_path, monthly_path,
                source_priority_a=0, source_priority_b=1,
            )

            if dedup_keys:
                partition_expr = ", ".join(_sql_ident(col) for col in dedup_keys)
                merge_sql = f"""
                COPY (
                    WITH unioned AS (
                        {sel_snapshot}
                        UNION ALL BY NAME
                        {sel_monthly}
                    ), ranked AS (
                        SELECT *,
                               ROW_NUMBER() OVER (
                                   PARTITION BY {partition_expr}
                                   ORDER BY __source_priority DESC
                               ) AS __rn
                        FROM unioned
                    )
                    SELECT * EXCLUDE (__source_priority, __rn)
                    FROM ranked
                    WHERE __rn = 1
                ) TO '{merged_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """
            else:
                # Strip __source_priority since no dedup needed
                sel_snapshot_nodp = sel_snapshot.replace(", 0 AS __source_priority", "")
                sel_monthly_nodp = sel_monthly.replace(", 1 AS __source_priority", "")
                merge_sql = f"""
                COPY (
                    {sel_snapshot_nodp}
                    UNION ALL BY NAME
                    {sel_monthly_nodp}
                ) TO '{merged_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """

            conn.execute(merge_sql)
            output_rows = int(conn.execute(f"SELECT COUNT(*) FROM read_parquet('{merged_path}')").fetchone()[0])
        finally:
            conn.close()

        merged_size = os.path.getsize(merged_path)
        with open(merged_path, "rb") as merged_file:
            merged_hash = cloud_service.calculate_file_hash(merged_file)
            success, upload_result = cloud_service.upload_file(
                merged_file,
                merged_key,
                metadata={
                    "dataset_key": payload.dataset_key,
                    "source": dataset_cfg["source"],
                    "merged_at": datetime.utcnow().isoformat(),
                },
            )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error subiendo snapshot consolidado: {upload_result}",
            )

    snapshot_version = _next_snapshot_version(db, payload.dataset_key)

    new_snapshot_meta = {
        "dataset_key": payload.dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "role": "snapshot",
        "snapshot_version": snapshot_version,
        "year_month": payload.year_month,
        "period_start": payload.period_start or monthly_meta.get("period_start"),
        "period_end": payload.period_end or monthly_meta.get("period_end"),
        "merged_from_file_ids": [active_snapshot.id, monthly_file.id],
        "dedup_keys": dedup_keys,
        "num_rows": output_rows,
        "active_for_queries": True,
        "created_by": "merge-and-rollover",
        "merged_at": datetime.utcnow().isoformat(),
    }

    new_snapshot_file = ParquetFile(
        filename=merged_filename,
        original_filename=merged_filename,
        file_size=int(merged_size),
        cloud_url=upload_result,
        cloud_key=merged_key,
        file_hash=merged_hash,
        file_metadata=json.dumps(new_snapshot_meta),
        status="active",
        uploaded_by=current_admin.id,
    )

    # Try to refresh exact size from cloud listing when immediately available.
    cloud_list = cloud_service.list_files(prefix=f"parquet/merged/{payload.dataset_key}/")
    for item in cloud_list:
        if item.get("key") == merged_key:
            new_snapshot_file.file_size = int(item.get("size", new_snapshot_file.file_size))
            break

    db.add(new_snapshot_file)
    db.flush()

    if payload.archive_previous_snapshot:
        old_meta = _parse_file_metadata(active_snapshot.file_metadata)
        old_meta.update({
            "active_for_queries": False,
            "superseded_by_file_id": new_snapshot_file.id,
            "superseded_at": datetime.utcnow().isoformat(),
        })
        _save_file_metadata(active_snapshot, old_meta)
        active_snapshot.status = "archived"

    monthly_meta.update({
        "merged": True,
        "merged_into_file_id": new_snapshot_file.id,
        "merged_at": datetime.utcnow().isoformat(),
        "active_for_queries": False,
    })
    _save_file_metadata(monthly_file, monthly_meta)
    monthly_file.status = "archived"

    db.commit()
    db.refresh(new_snapshot_file)

    return {
        "success": True,
        "dataset_key": payload.dataset_key,
        "new_snapshot_file_id": new_snapshot_file.id,
        "previous_snapshot_file_id": active_snapshot.id,
        "merged_monthly_file_id": monthly_file.id,
        "dedup_keys": dedup_keys,
        "snapshot_version": snapshot_version,
        "output_rows": output_rows,
        "output_size_mb": round((new_snapshot_file.file_size or 0) / (1024 * 1024), 3),
    }
