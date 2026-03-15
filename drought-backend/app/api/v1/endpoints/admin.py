"""
Admin endpoints for file management and user administration.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.api.deps import get_current_admin_user
from app.models.user import User
from app.models.parquet_file import ParquetFile
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from app.schemas.parquet import ParquetFile as ParquetFileSchema, ParquetFileList
from app.services.auth import create_user, update_user, get_user_by_id
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Dict, Any, List as ListType
from datetime import datetime
from app.services.cloud_storage import CloudStorageService
import json
import ast
import os
import tempfile

import duckdb


router = APIRouter()
cloud_service = CloudStorageService()


DATASET_CONFIG: Dict[str, Dict[str, Any]] = {
    "historical_era5": {
        "dataset_type": "historical",
        "source": "ERA5",
        "allowed_roles": ["snapshot", "delta"],
    },
    "historical_imerg": {
        "dataset_type": "historical",
        "source": "IMERG",
        "allowed_roles": ["snapshot", "delta"],
    },
    "historical_chirps": {
        "dataset_type": "historical",
        "source": "CHIRPS",
        "allowed_roles": ["snapshot", "delta"],
    },
    "hydro_main": {
        "dataset_type": "hydrological",
        "source": "HYDRO",
        "allowed_roles": ["snapshot", "delta"],
    },
    "prediction_main": {
        "dataset_type": "prediction",
        "source": "MULTI_SOURCE",
        "allowed_roles": ["prediction_monthly"],
    },
}


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


def _dataset_files(db: Session, dataset_key: str) -> ListType[ParquetFile]:
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


def _duckdb_columns(conn: duckdb.DuckDBPyConnection, parquet_path: str) -> ListType[str]:
    """Return parquet column names from a local parquet file path."""
    rows = conn.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{parquet_path}')"
    ).fetchall()
    return [r[0] for r in rows]


def _choose_dedup_keys(columns: ListType[str], dataset_key: str) -> ListType[str]:
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


# Helper Functions

def detect_resolution_from_filename(filename: str) -> tuple[str, float]:
    """
    Detecta la resolución basándose en el nombre del archivo.
    
    Convenciones:
    - grid_ERA5.parquet → Baja resolución (0.25°)
    - grid_IMERG.parquet → Media resolución (0.10°)
    - grid_CHIRPS.parquet → Alta resolución (mejor, más pesado)
    
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
        # Default: intentar adivinar por tamaño o usar medium como default
        return ('unknown', 0.10)


# User Management Endpoints

@router.post("/users", response_model=UserSchema)
def create_new_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Create a new user (admin only).
    """
    user = create_user(db, user_in)
    return user


@router.get("/users", response_model=List[UserSchema])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    List all users (admin only).
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get a specific user by ID (admin only).
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/users/{user_id}", response_model=UserSchema)
def update_user_endpoint(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Update a user (admin only).
    """
    user = update_user(db, user_id, user_in)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


# Parquet File Management Endpoints

@router.get("/files", response_model=ParquetFileList)
def list_parquet_files(
    skip: int = 0,
    limit: int = 100,
    status_filter: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    List all parquet files (admin only).
    """
    query = db.query(ParquetFile)
    
    if status_filter:
        query = query.filter(ParquetFile.status == status_filter)
    
    total = query.count()
    files = query.order_by(ParquetFile.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "files": files
    }


@router.get("/files/{file_id}", response_model=ParquetFileSchema)
def get_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get details of a specific parquet file (admin only).
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    return file


@router.delete("/files/{file_id}")
def delete_parquet_file(
    file_id: int,
    delete_from_cloud: bool = True,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Delete a parquet file (admin only).
    
    Elimina el archivo de la base de datos y opcionalmente de Cloudflare.
    
    Args:
        file_id: ID del archivo a eliminar
        delete_from_cloud: Si True, también elimina de Cloudflare R2 (default: True)
    
    Returns:
        Resultado de la eliminación
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    result = {
        "success": True,
        "message": f"File {file.filename} deleted from database",
        "deleted_from_cloud": False
    }
    
    # Eliminar de Cloudflare si se solicita
    if delete_from_cloud and file.cloud_key:
        try:
            cloud_deleted = cloud_service.delete_file(file.cloud_key)
            if cloud_deleted:
                result["deleted_from_cloud"] = True
                result["message"] += " and Cloudflare R2"
            else:
                result["message"] += " (Warning: could not delete from Cloudflare)"
        except Exception as e:
            result["message"] += f" (Error deleting from Cloudflare: {str(e)})"
    
    # Eliminar de base de datos
    db.delete(file)
    db.commit()
    
    return result


@router.post("/files/{file_id}/activate")
def activate_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Activate a parquet file for use in the dashboard.
    
    This makes the file the active data source.
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    dataset_key = _file_dataset_key(file)
    archived_count = 0
    if dataset_key:
        archived_count = _archive_dataset_active_files(db, dataset_key, exclude_file_id=file.id)

        meta = _parse_file_metadata(file.file_metadata)
        meta["active_for_queries"] = True
        meta["activated_at"] = datetime.utcnow().isoformat()
        _save_file_metadata(file, meta)
    
    file.status = "active"
    db.commit()
    
    return {
        "success": True,
        "message": f"File {file.filename} is now active",
        "dataset_key": dataset_key,
        "archived_previous_active": archived_count,
    }


class DatasetDefinition(BaseModel):
    """Logical dataset configuration."""
    dataset_key: str
    dataset_type: str
    source: str
    allowed_roles: ListType[str]


class DatasetCatalogResponse(BaseModel):
    """Catalog of supported logical datasets."""
    total: int
    datasets: ListType[DatasetDefinition]


class DatasetAttachRequest(BaseModel):
    """Attach file to a logical dataset with role and lifecycle metadata."""
    file_id: int
    dataset_key: str
    role: str
    year_month: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    activate_now: bool = False
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)


class DatasetAttachResponse(BaseModel):
    """Result of attaching a file to a dataset."""
    success: bool
    file_id: int
    dataset_key: str
    role: str
    status: str
    archived_previous_active: int = 0


class DatasetRolloverRequest(BaseModel):
    """Promote a new snapshot and archive merged monthly deltas."""
    dataset_key: str
    new_snapshot_file_id: int
    merged_delta_file_ids: ListType[int] = Field(default_factory=list)
    archive_previous_snapshot: bool = True


class DatasetRolloverResponse(BaseModel):
    """Result of monthly rollover."""
    success: bool
    dataset_key: str
    active_file_id: int
    snapshot_version: int
    archived_previous_snapshot: int
    archived_deltas: int


class DatasetStatusFile(BaseModel):
    """File snapshot for dataset status endpoint."""
    file_id: int
    filename: str
    status: str
    role: Optional[str] = None
    year_month: Optional[str] = None
    snapshot_version: Optional[int] = None
    created_at: datetime


class DatasetStatusResponse(BaseModel):
    """Current status and history for a logical dataset."""
    dataset_key: str
    dataset_type: str
    source: str
    active_file: Optional[DatasetStatusFile] = None
    pending_deltas: ListType[DatasetStatusFile]
    archived_recent: ListType[DatasetStatusFile]


class DatasetMergeAndRolloverRequest(BaseModel):
    """Automatic monthly merge request."""
    dataset_key: str
    monthly_file_id: int
    year_month: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    archive_previous_snapshot: bool = True


class DatasetMergeAndRolloverResponse(BaseModel):
    """Automatic monthly merge response."""
    success: bool
    dataset_key: str
    new_snapshot_file_id: int
    previous_snapshot_file_id: Optional[int] = None
    merged_monthly_file_id: int
    dedup_keys: ListType[str]
    snapshot_version: int
    output_rows: int
    output_size_mb: float


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
            detail=f"dataset_key inválido: {payload.dataset_key}",
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
            detail=f"dataset_key inválido: {payload.dataset_key}",
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
            detail=f"dataset_key inválido: {payload.dataset_key}",
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
    dedup_keys: ListType[str] = []

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
            # Inspect schema and choose best dedup keys.
            snapshot_cols = _duckdb_columns(conn, snapshot_path)
            monthly_cols = _duckdb_columns(conn, monthly_path)
            common_cols = sorted(set(snapshot_cols).intersection(set(monthly_cols)))
            dedup_keys = _choose_dedup_keys(common_cols, payload.dataset_key)

            if dedup_keys:
                partition_expr = ", ".join(_sql_ident(col) for col in dedup_keys)
                merge_sql = f"""
                COPY (
                    WITH unioned AS (
                        SELECT *, 0 AS __source_priority FROM read_parquet('{snapshot_path}')
                        UNION ALL BY NAME
                        SELECT *, 1 AS __source_priority FROM read_parquet('{monthly_path}')
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
                merge_sql = f"""
                COPY (
                    SELECT * FROM read_parquet('{snapshot_path}')
                    UNION ALL BY NAME
                    SELECT * FROM read_parquet('{monthly_path}')
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


# Schema for external file registration
class ExternalParquetFileCreate(BaseModel):
    """Schema for registering external parquet files."""
    filename: str = Field(..., description="Nombre del archivo")
    cloud_url: str = Field(..., description="URL completa del archivo en Cloudflare")
    description: Optional[str] = Field("", description="Descripción del archivo")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadatos adicionales")


@router.post("/files/register-external", response_model=ParquetFileSchema)
def register_external_parquet_file(
    file_data: ExternalParquetFileCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Registra un archivo parquet que ya está en Cloudflare R2.
    
    Auto-detecta resolución basándose en el nombre del archivo:
    - grid_ERA5.parquet → Baja resolución (0.25°)
    - grid_IMERG.parquet → Media resolución (0.10°)
    - grid_CHIRPS.parquet → Alta resolución (mejor, más pesado)
    
    Args:
        file_data: Información del archivo a registrar
        
    Returns:
        Archivo parquet registrado con metadata enriquecida
    """
    # Extraer cloud_key desde URL
    from urllib.parse import urlparse
    from app.core.config import settings
    
    try:
        parsed = urlparse(file_data.cloud_url)
        path_parts = parsed.path.strip('/').split('/', 1)
        cloud_key = path_parts[1] if len(path_parts) > 1 else path_parts[0]
    except Exception:
        # Si falla el parsing, usar filename como cloud_key
        cloud_key = f"parquet/{file_data.filename}"
    
    # Verificar si ya existe
    existing = db.query(ParquetFile).filter(
        (ParquetFile.cloud_url == file_data.cloud_url) | 
        (ParquetFile.cloud_key == cloud_key)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un archivo con esta URL o clave (ID: {existing.id})"
        )
    
    # Auto-detectar resolución desde filename
    level_name, resolution = detect_resolution_from_filename(file_data.filename)
    
    # Intentar obtener metadata desde Cloudflare
    file_size = 0
    last_modified = datetime.utcnow()
    
    try:
        cloud_files = cloud_service.list_files(prefix=cloud_key.rsplit('/', 1)[0] if '/' in cloud_key else '')
        for cf in cloud_files:
            if cf['key'] == cloud_key:
                file_size = cf['size']
                last_modified = cf['last_modified']
                break
    except Exception as e:
        print(f"Warning: Could not fetch cloud metadata: {e}")
    
    # Preparar metadata enriquecida
    enriched_metadata = file_data.metadata or {}
    enriched_metadata.update({
        "resolution": resolution,
        "resolution_level": level_name,
        "resolution_degrees": resolution,
        "auto_detected": True,
        "last_modified_cloud": last_modified.isoformat() if isinstance(last_modified, datetime) else str(last_modified)
    })
    
    # Crear entrada en base de datos
    new_file = ParquetFile(
        filename=file_data.filename,
        original_filename=file_data.filename,
        file_size=file_size,
        cloud_url=file_data.cloud_url,
        cloud_key=cloud_key,
        file_hash=None,
        file_metadata=json.dumps(enriched_metadata),
        status="active",
        uploaded_by=current_admin.id
    )
    
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    return new_file


# Schema for cloud file listing
class CloudFileInfo(BaseModel):
    """Información de archivo en Cloudflare."""
    key: str
    filename: str
    size_mb: float
    last_modified: datetime
    cloud_url: str
    registered: bool = False
    file_id: Optional[int] = None


class CloudFileListResponse(BaseModel):
    """Response con lista de archivos en cloud."""
    total: int
    files: ListType[CloudFileInfo]
    bucket: str


@router.get("/files/cloud/list", response_model=CloudFileListResponse)
def list_cloudflare_files(
    prefix: str = "parquet/",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Lista todos los archivos .parquet en Cloudflare R2.
    
    Útil para ver qué archivos tienes en la nube y cuáles están registrados en la DB.
    
    Args:
        prefix: Prefijo para filtrar (por defecto "parquet/")
        
    Returns:
        Lista de archivos con su estado de registro
    """
    try:
        # Listar archivos desde Cloudflare
        cloud_files = cloud_service.list_files(prefix=prefix)
        
        # Filtrar solo .parquet
        parquet_files = [
            f for f in cloud_files 
            if f['key'].endswith('.parquet')
        ]
        
        # Obtener archivos ya registrados en DB
        registered_files = db.query(ParquetFile).all()
        registered_urls = {f.cloud_url for f in registered_files}
        registered_keys = {f.cloud_key for f in registered_files if f.cloud_key}
        
        # Mapear archivos registrados por cloud_key
        file_map = {
            f.cloud_key: f for f in registered_files if f.cloud_key
        }
        
        # Preparar respuesta
        from app.core.config import settings
        result_files = []
        
        for cloud_file in parquet_files:
            key = cloud_file['key']
            filename = key.split('/')[-1]
            size_mb = cloud_file['size'] / (1024 * 1024)
            
            # URL pública
            cloud_url = f"{settings.CLOUD_STORAGE_ENDPOINT}/{settings.CLOUD_STORAGE_BUCKET}/{key}"
            
            # Verificar si está registrado
            is_registered = key in registered_keys or cloud_url in registered_urls
            db_file = file_map.get(key)
            
            result_files.append({
                "key": key,
                "filename": filename,
                "size_mb": round(size_mb, 2),
                "last_modified": cloud_file['last_modified'],
                "cloud_url": cloud_url,
                "registered": is_registered,
                "file_id": db_file.id if db_file else None
            })
        
        return {
            "total": len(result_files),
            "files": result_files,
            "bucket": settings.CLOUD_STORAGE_BUCKET
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listando archivos de Cloudflare: {str(e)}"
        )


class SyncCloudFilesResponse(BaseModel):
    """Response de sincronización de archivos."""
    success: bool
    registered: int
    skipped: int
    deleted_from_db: int
    errors: int
    files: ListType[Dict[str, Any]]


@router.post("/files/cloud/sync", response_model=SyncCloudFilesResponse)
def sync_cloudflare_files(
    prefix: str = "parquet/",
    auto_activate: bool = True,
    bidirectional: bool = True,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Sincronización BIDIRECCIONAL entre Cloudflare R2 y base de datos.
    
    Este endpoint:
    1. Lista todos los archivos .parquet en Cloudflare
    2. Registra archivos nuevos de Cloudflare que no están en BD (con auto-detección de resolución)
    3. Si bidirectional=True: Elimina de BD archivos que ya NO existen en Cloudflare
    4. Auto-detecta resolución: ERA5 (0.25°), IMERG (0.10°), CHIRPS (alta res)
    
    Args:
        prefix: Prefijo para filtrar archivos (default: "parquet/")
        auto_activate: Si True, marca los archivos nuevos como activos
        bidirectional: Si True, elimina de BD archivos que no están en Cloudflare
        
    Returns:
        Resumen de sincronización
    """
    try:
        from app.core.config import settings
        
        # Listar archivos en Cloudflare
        cloud_files = cloud_service.list_files(prefix=prefix)
        parquet_files = [
            f for f in cloud_files 
            if f['key'].endswith('.parquet')
        ]
        
        # Crear set de cloud_keys existentes en Cloudflare
        cloud_keys_set = {f['key'] for f in parquet_files}
        
        # Obtener archivos ya registrados en BD
        registered_files = db.query(ParquetFile).all()
        
        # Contadores
        registered_count = 0
        skipped_count = 0
        deleted_count = 0
        error_count = 0
        results = []
        
        # PASO 1: Registrar archivos nuevos de Cloudflare → BD
        registered_keys = {f.cloud_key for f in registered_files if f.cloud_key}
        
        for cloud_file in parquet_files:
            key = cloud_file['key']
            filename = key.split('/')[-1]
            size_bytes = cloud_file['size']
            size_mb = size_bytes / (1024 * 1024)
            cloud_url = f"{settings.CLOUD_STORAGE_ENDPOINT}/{settings.CLOUD_STORAGE_BUCKET}/{key}"
            
            # Verificar si ya está registrado
            if key in registered_keys:
                skipped_count += 1
                results.append({
                    "filename": filename,
                    "action": "skipped",
                    "reason": "Ya existe en BD"
                })
                continue
            
            # Registrar archivo nuevo con auto-detección de resolución
            try:
                level_name, resolution = detect_resolution_from_filename(filename)
                
                metadata = {
                    "source": "cloudflare_sync",
                    "last_modified_cloud": cloud_file['last_modified'].isoformat(),
                    "size_bytes": size_bytes,
                    "resolution": resolution,
                    "resolution_level": level_name,
                    "resolution_degrees": resolution,
                    "auto_detected": True
                }
                
                new_file = ParquetFile(
                    filename=filename,
                    original_filename=filename,
                    file_size=size_bytes,
                    cloud_url=cloud_url,
                    cloud_key=key,
                    file_hash=cloud_file.get('etag', '').strip('\"'),
                    file_metadata=json.dumps(metadata),
                    status="active" if auto_activate else "pending",
                    uploaded_by=current_admin.id
                )
                
                db.add(new_file)
                db.commit()
                db.refresh(new_file)
                
                registered_count += 1
                results.append({
                    "filename": filename,
                    "action": "registered",
                    "file_id": new_file.id,
                    "resolution": f"{level_name} ({resolution}°)",
                    "size_mb": round(size_mb, 2)
                })
                
            except Exception as e:
                error_count += 1
                results.append({
                    "filename": filename,
                    "action": "error",
                    "reason": str(e)
                })
        
        # PASO 2: Si bidirectional, eliminar de BD archivos que NO están en Cloudflare
        if bidirectional:
            for db_file in registered_files:
                # Si el archivo de BD no tiene cloud_key, skip
                if not db_file.cloud_key:
                    continue
                
                # Si el cloud_key de BD NO está en Cloudflare, eliminarlo de BD
                if db_file.cloud_key not in cloud_keys_set:
                    try:
                        filename = db_file.filename
                        file_id = db_file.id
                        
                        db.delete(db_file)
                        db.commit()
                        
                        deleted_count += 1
                        results.append({
                            "filename": filename,
                            "action": "deleted_from_db",
                            "file_id": file_id,
                            "reason": "No existe en Cloudflare"
                        })
                    except Exception as e:
                        error_count += 1
                        results.append({
                            "filename": db_file.filename,
                            "action": "error_deleting",
                            "reason": str(e)
                        })
        
        return {
            "success": True,
            "registered": registered_count,
            "skipped": skipped_count,
            "deleted_from_db": deleted_count,
            "errors": error_count,
            "files": results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sincronizando archivos: {str(e)}"
        )

