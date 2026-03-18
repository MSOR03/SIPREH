"""
Esquemas Pydantic para los endpoints de administración.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


# --- Dataset lifecycle schemas ---

class DatasetDefinition(BaseModel):
    """Logical dataset configuration."""
    dataset_key: str
    dataset_type: str
    source: str
    allowed_roles: List[str]
    update_strategy: str = "single_file"
    update_guide: Optional[str] = None


class DatasetCatalogResponse(BaseModel):
    """Catalog of supported logical datasets."""
    total: int
    datasets: List[DatasetDefinition]


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
    skip_schema_validation: bool = Field(
        default=False,
        description="Omitir validacion de schema del parquet. Usar solo en casos excepcionales.",
    )


class DatasetAttachResponse(BaseModel):
    """Result of attaching a file to a dataset."""
    success: bool
    file_id: int
    dataset_key: str
    role: str
    status: str
    archived_previous_active: int = 0
    schema_warnings: Optional[List[str]] = None


class DatasetRolloverRequest(BaseModel):
    """Promote a new snapshot and archive merged monthly deltas."""
    dataset_key: str
    new_snapshot_file_id: int
    merged_delta_file_ids: List[int] = Field(default_factory=list)
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
    pending_deltas: List[DatasetStatusFile]
    archived_recent: List[DatasetStatusFile]


class DatasetMergeAndRolloverRequest(BaseModel):
    """Automatic monthly merge request."""
    dataset_key: str
    monthly_file_id: int
    year_month: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    archive_previous_snapshot: bool = True
    skip_schema_validation: bool = Field(
        default=False,
        description="Omitir validacion de schema del delta mensual. Usar solo en casos excepcionales.",
    )


class DatasetMergeAndRolloverResponse(BaseModel):
    """Automatic monthly merge response."""
    success: bool
    dataset_key: str
    new_snapshot_file_id: int
    previous_snapshot_file_id: Optional[int] = None
    merged_monthly_file_id: int
    dedup_keys: List[str]
    snapshot_version: int
    output_rows: int
    output_size_mb: float


# --- Tiered storage schemas ---

class SetupTieredRequest(BaseModel):
    """Request para configurar un dataset con estrategia historical_updates."""
    dataset_key: str
    historical_file_id: Optional[int] = None


class SetupTieredResponse(BaseModel):
    """Response del setup tiered."""
    success: bool
    dataset_key: str
    strategy: str
    historical_base_file_id: Optional[int] = None
    updates_file_id: Optional[int] = None
    message: str


class CompactRequest(BaseModel):
    """Request para compactacion de dataset tiered."""
    dataset_key: str


class CompactResponse(BaseModel):
    """Response de compactacion."""
    success: bool
    dataset_key: str
    new_historical_file_id: int
    new_updates_file_id: Optional[int] = None
    output_rows: int
    output_size_mb: float
    message: str


# --- Cloud file management schemas ---

class ExternalParquetFileCreate(BaseModel):
    """Schema for registering external parquet files."""
    filename: str = Field(..., description="Nombre del archivo")
    cloud_url: str = Field(..., description="URL completa del archivo en Cloudflare")
    description: Optional[str] = Field("", description="Descripcion del archivo")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadatos adicionales")


class CloudFileInfo(BaseModel):
    """Informacion de archivo en Cloudflare."""
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
    files: List[CloudFileInfo]
    bucket: str


class SyncCloudFilesResponse(BaseModel):
    """Response de sincronizacion de archivos."""
    success: bool
    registered: int
    skipped: int
    deleted_from_db: int
    errors: int
    files: List[Dict[str, Any]]
