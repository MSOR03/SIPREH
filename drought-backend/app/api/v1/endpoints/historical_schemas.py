"""
Esquemas Pydantic para los endpoints de análisis histórico.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date


class VariableInfo(BaseModel):
    """Información de una variable o índice."""
    id: str
    name: str
    unit: str
    category: str
    available: bool = True
    supports_prediction: bool = False


class CatalogResponse(BaseModel):
    """Response con catálogo de variables/índices."""
    total: int
    items: List[VariableInfo]


class TimeSeriesPoint(BaseModel):
    """Punto en serie de tiempo."""
    date: date
    value: Optional[float]
    category: Optional[str] = None
    color: Optional[str] = None
    severity: Optional[int] = None


class StatisticsInfo(BaseModel):
    """Estadísticas de los datos."""
    mean: Optional[float]
    min: Optional[float]
    max: Optional[float]
    std: Optional[float]
    count: int
    missing: Optional[int] = 0


class TimeSeriesRequest(BaseModel):
    """Request para serie de tiempo."""
    parquet_file_id: int = Field(..., description="ID del archivo parquet en la base de datos")
    variable: str = Field(..., description="Variable o índice (precip, SPI, SPEI, etc.)")
    start_date: date = Field(..., description="Fecha inicial")
    end_date: date = Field(..., description="Fecha final")
    lat: Optional[float] = Field(None, description="Latitud del punto")
    lon: Optional[float] = Field(None, description="Longitud del punto")
    cell_id: Optional[str] = Field(None, description="ID de celda específica")
    scale: Optional[int] = Field(None, description="Escala temporal en meses (1, 3, 6, 12) — solo para índices de sequía")
    source: Optional[str] = Field(None, description="Fuente de datos (ej: OBS_IDW). Por defecto OBS_IDW para índices")
    frequency: Optional[str] = Field(None, description="Frecuencia deseada: 'D' (diaria) o 'M' (mensual). Si es M y los datos son D, se promedian por mes")
    limit: int = Field(70000, description="Máximo de registros a retornar (default: 70000)")


class TimeSeriesResponse(BaseModel):
    """Response con serie de tiempo."""
    variable: str
    variable_name: str
    unit: str
    frequency: str = "D"
    location: dict
    data: List[TimeSeriesPoint]
    statistics: StatisticsInfo


class SpatialDataRequest(BaseModel):
    """Request para datos espaciales (mapa 2D)."""
    parquet_file_id: int = Field(..., description="ID del archivo parquet")
    variable: str = Field(..., description="Variable o índice")
    target_date: Optional[date] = Field(None, description="Fecha objetivo (modo fecha única)")
    start_date: Optional[date] = Field(None, description="Fecha inicial (modo intervalo)")
    end_date: Optional[date] = Field(None, description="Fecha final (modo intervalo)")
    use_interval: bool = Field(False, description="Si true, usa rango [start_date, end_date] y promedia por celda")
    scale: Optional[int] = Field(None, description="Escala temporal en meses (1, 3, 6, 12) — solo para índices de sequía")
    source: Optional[str] = Field(None, description="Fuente de datos (ej: OBS_IDW). Por defecto OBS_IDW para índices")
    frequency: Optional[str] = Field(None, description="Frecuencia deseada: 'D' (diaria) o 'M' (mensual)")
    min_lat: Optional[float] = None
    max_lat: Optional[float] = None
    min_lon: Optional[float] = None
    max_lon: Optional[float] = None
    limit: int = Field(100000, description="Máximo de celdas a retornar (default: 100000)")


class GridCell(BaseModel):
    """Celda de la malla con datos."""
    cell_id: str
    lat: float
    lon: float
    value: Optional[float]
    category: Optional[str] = None
    color: Optional[str] = None
    severity: Optional[int] = None


class SpatialDataResponse(BaseModel):
    """Response con datos espaciales."""
    variable: str
    variable_name: str
    unit: str
    date: date
    grid_cells: List[GridCell]
    statistics: StatisticsInfo
    bounds: dict


class FileInfoResponse(BaseModel):
    """Información sobre un archivo parquet."""
    file_id: int
    filename: str
    resolution: Optional[float] = None
    dataset_type: Optional[str] = None
    date_range: dict
    spatial_bounds: dict
    size_mb: Optional[float] = None
    record_count: Optional[int] = None


class ColumnInfo(BaseModel):
    """Información de una columna detectada."""
    name: str
    type: str
    source: str = "detected"
    display_name: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    in_catalog: bool = False


class FileColumnsResponse(BaseModel):
    """Response con columnas detectadas de un archivo."""
    file_id: int
    filename: str
    metadata_columns: List[ColumnInfo]
    data_columns: List[ColumnInfo]
    all_columns: List[ColumnInfo]
    summary: dict


class FileValidationResponse(BaseModel):
    """Response de validación de estructura."""
    file_id: int
    filename: str
    valid: bool
    errors: List[str]
    warnings: List[str]
    info: List[str]
