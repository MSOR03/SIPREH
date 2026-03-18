"""
Admin endpoints: Tiered storage (setup-tiered, compact, storage-info).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
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
    SetupTieredRequest,
    SetupTieredResponse,
    CompactRequest,
    CompactResponse,
)
from app.api.v1.endpoints.admin_utils import (
    cloud_service,
    DATASET_CONFIG,
    _parse_file_metadata,
    _save_file_metadata,
    _dataset_files,
    _next_snapshot_version,
    _sql_ident,
    _duckdb_columns,
    _choose_dedup_keys,
    _build_normalized_select,
)


router = APIRouter()


@router.post("/datasets/setup-tiered", response_model=SetupTieredResponse)
def setup_tiered_storage(
    payload: SetupTieredRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Configura un dataset para usar estrategia historical_updates (tiered).

    Flujo:
    1. Re-etiqueta el snapshot existente como role=historical_base
    2. Crea un updates.parquet vacio con el mismo schema y lo sube a R2
    3. Ambos archivos quedan como active

    Si no hay snapshot existente, solo prepara la estructura para recibir
    el historical_base manualmente.
    """
    dataset_cfg = DATASET_CONFIG.get(payload.dataset_key)
    if not dataset_cfg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"dataset_key invalido: {payload.dataset_key}",
        )

    strategy = dataset_cfg.get("update_strategy", "single_file")
    if strategy != "historical_updates":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El dataset {payload.dataset_key} usa estrategia '{strategy}', no requiere setup tiered.",
        )

    # Buscar archivo fuente (por file_id o el snapshot activo)
    source_file = None
    if payload.historical_file_id:
        source_file = db.query(ParquetFile).filter(
            ParquetFile.id == payload.historical_file_id
        ).first()
        if not source_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Archivo {payload.historical_file_id} no encontrado",
            )
    else:
        files = _dataset_files(db, payload.dataset_key)
        active = [f for f in files if f.status == "active"]
        if active:
            source_file = active[0]

    if not source_file:
        return {
            "success": True,
            "dataset_key": payload.dataset_key,
            "strategy": strategy,
            "historical_base_file_id": None,
            "updates_file_id": None,
            "message": "No hay snapshot activo. Sube un historical_base manualmente con attach-file.",
        }

    if not source_file.cloud_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo fuente no tiene cloud_key.",
        )

    # 1. Re-etiquetar como historical_base
    meta = _parse_file_metadata(source_file.file_metadata)
    meta.update({
        "dataset_key": payload.dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "role": "historical_base",
        "active_for_queries": True,
        "setup_tiered_at": datetime.utcnow().isoformat(),
    })
    _save_file_metadata(source_file, meta)
    source_file.status = "active"

    # 2. Crear updates.parquet vacio con el mismo schema
    updates_file_id = None
    try:
        with tempfile.TemporaryDirectory(prefix="drought_setup_tiered_") as tmpdir:
            # Descargar solo metadatos del source para obtener el schema
            source_bytes = cloud_service.download_file(source_file.cloud_key)
            if source_bytes:
                source_path = os.path.join(tmpdir, "source.parquet")
                empty_path = os.path.join(tmpdir, "empty_updates.parquet")

                with open(source_path, "wb") as f:
                    f.write(source_bytes)

                conn = duckdb.connect(database=':memory:')
                try:
                    # Crear parquet vacio con el mismo schema
                    conn.execute(f"""
                        COPY (
                            SELECT * FROM read_parquet('{source_path}') WHERE 1=0
                        ) TO '{empty_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
                    """)
                finally:
                    conn.close()

                # Subir a R2
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                updates_filename = f"{payload.dataset_key}_updates_{timestamp}.parquet"
                updates_key = f"parquet/tiered/{payload.dataset_key}/{updates_filename}"

                with open(empty_path, "rb") as uf:
                    upload_hash = cloud_service.calculate_file_hash(uf)
                    success, upload_url = cloud_service.upload_file(
                        uf,
                        updates_key,
                        metadata={
                            "dataset_key": payload.dataset_key,
                            "role": "updates",
                        },
                    )

                if success:
                    updates_size = os.path.getsize(empty_path)
                    updates_meta = {
                        "dataset_key": payload.dataset_key,
                        "dataset_type": dataset_cfg["dataset_type"],
                        "source": dataset_cfg["source"],
                        "role": "updates",
                        "active_for_queries": True,
                        "num_rows": 0,
                        "created_by": "setup-tiered",
                        "created_at": datetime.utcnow().isoformat(),
                    }

                    new_updates = ParquetFile(
                        filename=updates_filename,
                        original_filename=updates_filename,
                        file_size=int(updates_size),
                        cloud_url=upload_url,
                        cloud_key=updates_key,
                        file_hash=upload_hash,
                        file_metadata=json.dumps(updates_meta),
                        status="active",
                        uploaded_by=current_admin.id,
                    )
                    db.add(new_updates)
                    db.flush()
                    updates_file_id = new_updates.id

    except Exception as e:
        # Si falla la creacion del updates, al menos el historical_base queda configurado
        print(f"Warning: no se pudo crear updates.parquet vacio: {e}")

    db.commit()

    return {
        "success": True,
        "dataset_key": payload.dataset_key,
        "strategy": strategy,
        "historical_base_file_id": source_file.id,
        "updates_file_id": updates_file_id,
        "message": f"Dataset configurado como tiered. historical_base=file:{source_file.id}"
                   + (f", updates=file:{updates_file_id}" if updates_file_id else ", updates pendiente"),
    }


@router.post("/datasets/compact", response_model=CompactResponse)
def compact_tiered_dataset(
    payload: CompactRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Compactacion de dataset tiered: merge historical_base + updates -> nuevo historical_base.

    Usa esto periodicamente cuando updates.parquet crece demasiado.
    Resultado:
    - Nuevo historical.parquet con todos los datos
    - Nuevo updates.parquet vacio
    - Archivos anteriores archivados
    """
    dataset_cfg = DATASET_CONFIG.get(payload.dataset_key)
    if not dataset_cfg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"dataset_key invalido: {payload.dataset_key}",
        )

    strategy = dataset_cfg.get("update_strategy", "single_file")
    if strategy != "historical_updates":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Compact solo aplica a datasets con estrategia historical_updates.",
        )

    # Buscar archivos activos
    files = _dataset_files(db, payload.dataset_key)
    active = [f for f in files if f.status == "active"]

    historical_file = None
    updates_file = None
    for f in active:
        fm = _parse_file_metadata(f.file_metadata)
        role = fm.get("role")
        if role == "historical_base":
            historical_file = f
        elif role == "updates":
            updates_file = f

    if not historical_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro archivo historical_base activo para este dataset.",
        )

    if not updates_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontro archivo updates activo. No hay nada que compactar.",
        )

    if not historical_file.cloud_key or not updates_file.cloud_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los archivos deben tener cloud_key.",
        )

    # Descargar ambos
    hist_bytes = cloud_service.download_file(historical_file.cloud_key)
    updates_bytes = cloud_service.download_file(updates_file.cloud_key)
    if hist_bytes is None or updates_bytes is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo descargar historical o updates desde cloud.",
        )

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    output_rows = 0
    dedup_keys: List[str] = []

    with tempfile.TemporaryDirectory(prefix="drought_compact_") as tmpdir:
        hist_path = os.path.join(tmpdir, "historical.parquet")
        updates_path = os.path.join(tmpdir, "updates.parquet")
        merged_path = os.path.join(tmpdir, "compacted.parquet")
        empty_path = os.path.join(tmpdir, "empty_updates.parquet")

        with open(hist_path, "wb") as f:
            f.write(hist_bytes)
        with open(updates_path, "wb") as f:
            f.write(updates_bytes)

        conn = duckdb.connect(database=':memory:')
        try:
            hist_cols = _duckdb_columns(conn, hist_path)
            updates_cols = _duckdb_columns(conn, updates_path)
            common_cols = sorted(set(hist_cols).intersection(set(updates_cols)))
            dedup_keys = _choose_dedup_keys(common_cols, payload.dataset_key)

            # Build normalized SELECTs that cast mismatched timestamp types
            sel_hist, sel_updates = _build_normalized_select(
                conn, hist_path, updates_path,
                source_priority_a=0, source_priority_b=1,
            )

            if dedup_keys:
                partition_expr = ", ".join(_sql_ident(col) for col in dedup_keys)
                merge_sql = f"""
                COPY (
                    WITH unioned AS (
                        {sel_hist}
                        UNION ALL BY NAME
                        {sel_updates}
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
                sel_hist_nodp = sel_hist.replace(", 0 AS __source_priority", "")
                sel_updates_nodp = sel_updates.replace(", 1 AS __source_priority", "")
                merge_sql = f"""
                COPY (
                    {sel_hist_nodp}
                    UNION ALL BY NAME
                    {sel_updates_nodp}
                ) TO '{merged_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
                """

            conn.execute(merge_sql)
            output_rows = int(conn.execute(f"SELECT COUNT(*) FROM read_parquet('{merged_path}')").fetchone()[0])

            # Crear updates vacio con el mismo schema
            conn.execute(f"""
                COPY (
                    SELECT * FROM read_parquet('{merged_path}') WHERE 1=0
                ) TO '{empty_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
            """)
        finally:
            conn.close()

        # Subir nuevo historical
        new_hist_filename = f"{payload.dataset_key}_historical_{timestamp}.parquet"
        new_hist_key = f"parquet/tiered/{payload.dataset_key}/{new_hist_filename}"

        merged_size = os.path.getsize(merged_path)
        with open(merged_path, "rb") as mf:
            merged_hash = cloud_service.calculate_file_hash(mf)
            success, upload_url = cloud_service.upload_file(
                mf,
                new_hist_key,
                metadata={
                    "dataset_key": payload.dataset_key,
                    "role": "historical_base",
                    "compacted_at": datetime.utcnow().isoformat(),
                },
            )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error subiendo historical compactado: {upload_url}",
            )

        # Subir updates vacio
        new_updates_filename = f"{payload.dataset_key}_updates_{timestamp}.parquet"
        new_updates_key = f"parquet/tiered/{payload.dataset_key}/{new_updates_filename}"

        empty_size = os.path.getsize(empty_path)
        with open(empty_path, "rb") as ef:
            empty_hash = cloud_service.calculate_file_hash(ef)
            success2, upload_url2 = cloud_service.upload_file(
                ef,
                new_updates_key,
                metadata={
                    "dataset_key": payload.dataset_key,
                    "role": "updates",
                    "compacted_at": datetime.utcnow().isoformat(),
                },
            )

    if not success2:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error subiendo updates vacio: {upload_url2}",
        )

    snapshot_version = _next_snapshot_version(db, payload.dataset_key)

    # Registrar nuevo historical en DB
    new_hist_meta = {
        "dataset_key": payload.dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "role": "historical_base",
        "snapshot_version": snapshot_version,
        "num_rows": output_rows,
        "dedup_keys": dedup_keys,
        "active_for_queries": True,
        "created_by": "compact",
        "compacted_from_file_ids": [historical_file.id, updates_file.id],
        "compacted_at": datetime.utcnow().isoformat(),
    }

    new_hist_db = ParquetFile(
        filename=new_hist_filename,
        original_filename=new_hist_filename,
        file_size=int(merged_size),
        cloud_url=upload_url,
        cloud_key=new_hist_key,
        file_hash=merged_hash,
        file_metadata=json.dumps(new_hist_meta),
        status="active",
        uploaded_by=current_admin.id,
    )
    db.add(new_hist_db)

    # Registrar updates vacio en DB
    new_updates_meta = {
        "dataset_key": payload.dataset_key,
        "dataset_type": dataset_cfg["dataset_type"],
        "source": dataset_cfg["source"],
        "role": "updates",
        "num_rows": 0,
        "active_for_queries": True,
        "created_by": "compact",
        "compacted_at": datetime.utcnow().isoformat(),
    }

    new_updates_db = ParquetFile(
        filename=new_updates_filename,
        original_filename=new_updates_filename,
        file_size=int(empty_size),
        cloud_url=upload_url2,
        cloud_key=new_updates_key,
        file_hash=empty_hash,
        file_metadata=json.dumps(new_updates_meta),
        status="active",
        uploaded_by=current_admin.id,
    )
    db.add(new_updates_db)
    db.flush()

    # Archivar los viejos
    for old_file in [historical_file, updates_file]:
        old_meta = _parse_file_metadata(old_file.file_metadata)
        old_meta.update({
            "active_for_queries": False,
            "compacted_at": datetime.utcnow().isoformat(),
        })
        _save_file_metadata(old_file, old_meta)
        old_file.status = "archived"

    db.commit()

    return {
        "success": True,
        "dataset_key": payload.dataset_key,
        "new_historical_file_id": new_hist_db.id,
        "new_updates_file_id": new_updates_db.id,
        "output_rows": output_rows,
        "output_size_mb": round(merged_size / (1024 * 1024), 3),
        "message": f"Compactacion completada. historical_base=file:{new_hist_db.id}, updates=file:{new_updates_db.id}",
    }


@router.get("/datasets/{dataset_key}/storage-info")
def get_dataset_storage_info(
    dataset_key: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Retorna informacion detallada sobre la estrategia de storage del dataset.
    Incluye tamano de cada archivo, estrategia, y recomendaciones.
    """
    dataset_cfg = DATASET_CONFIG.get(dataset_key)
    if not dataset_cfg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"dataset_key no encontrado: {dataset_key}",
        )

    strategy = dataset_cfg.get("update_strategy", "single_file")

    files = _dataset_files(db, dataset_key)
    active = [f for f in files if f.status == "active"]

    file_details = []
    total_size = 0

    for f in active:
        meta = _parse_file_metadata(f.file_metadata)
        size = f.file_size or 0
        total_size += size
        file_details.append({
            "file_id": f.id,
            "filename": f.filename,
            "role": meta.get("role", "unknown"),
            "size_mb": round(size / (1024 * 1024), 2),
            "num_rows": meta.get("num_rows"),
            "cloud_key": f.cloud_key,
            "created_by": meta.get("created_by"),
        })

    # Recomendaciones para compactacion
    recommendation = None
    if strategy == "historical_updates":
        updates_size = sum(
            d["size_mb"] for d in file_details if d["role"] == "updates"
        )
        hist_size = sum(
            d["size_mb"] for d in file_details if d["role"] == "historical_base"
        )
        if updates_size > 50:
            recommendation = f"updates.parquet tiene {updates_size:.1f} MB. Considera ejecutar compactacion."
        elif updates_size > 20:
            recommendation = f"updates.parquet tiene {updates_size:.1f} MB. Compactacion recomendada pronto."

    return {
        "dataset_key": dataset_key,
        "strategy": strategy,
        "total_active_files": len(active),
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "files": file_details,
        "recommendation": recommendation,
    }
