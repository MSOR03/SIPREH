"""
Esquemas Pydantic para los endpoints de datos hidrológicos de estaciones.
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date


class HydroStationInfo(BaseModel):
    """Información de una estación hidrológica."""
    codigo: str
    lat: float
    lon: float
    name: str


class HydroStationsResponse(BaseModel):
    """Response con lista de estaciones."""
    total: int
    stations: List[HydroStationInfo]


class HydroIndexInfo(BaseModel):
    """Información de un índice hidrológico."""
    id: str
    name: str
    unit: str
    category: str


class HydroIndicesResponse(BaseModel):
    """Response con catálogo de índices hidrológicos."""
    total: int
    items: List[HydroIndexInfo]


class HydroTimeSeriesRequest(BaseModel):
    """Request para serie de tiempo hidrológica."""
    parquet_file_id: int = Field(..., description="ID del archivo parquet")
    station_code: str = Field(..., description="Código de la estación (e.g., '2749')")
    index_name: str = Field(..., description="Índice hidrológico (SDI, SRI, MFI, DDI, HDI)")
    scale: Optional[int] = Field(None, description="Escala temporal en meses (1, 3, 6, 12). Null para DDI/HDI")
    start_date: date = Field(..., description="Fecha inicial")
    end_date: date = Field(..., description="Fecha final")
    limit: int = Field(70000, description="Máximo de registros")


class HydroSpatialRequest(BaseModel):
    """Request para datos espaciales hidrológicos."""
    parquet_file_id: int = Field(..., description="ID del archivo parquet")
    index_name: str = Field(..., description="Índice hidrológico (SDI, SRI, MFI, DDI, HDI)")
    scale: Optional[int] = Field(None, description="Escala temporal en meses (1, 3, 6, 12). Null para DDI/HDI")
    target_date: Optional[date] = Field(None, description="Fecha objetivo (modo fecha única)")
    start_date: Optional[date] = Field(None, description="Fecha inicial (modo intervalo)")
    end_date: Optional[date] = Field(None, description="Fecha final (modo intervalo)")
    use_interval: bool = Field(False, description="Si true, promedia entre start_date y end_date")
