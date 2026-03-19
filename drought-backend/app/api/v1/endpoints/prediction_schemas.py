"""
Pydantic schemas para endpoints de prediccion.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal


# ── Requests ──

class PredictionTimeSeriesRequest(BaseModel):
    parquet_file_id: int = Field(..., description="ID del archivo parquet de prediccion")
    cell_id: str = Field(..., description="ID de celda (formato LON_LAT)")
    var: str = Field(..., description="Indice de sequia: SPI, SPEI, RAI, EDDI, PDSI")
    scale: int = Field(..., description="Escala temporal en meses (1, 3, 6, 12)")


class PredictionSpatialRequest(BaseModel):
    parquet_file_id: int = Field(..., description="ID del archivo parquet de prediccion")
    var: str = Field(..., description="Indice de sequia: SPI, SPEI, RAI, EDDI, PDSI")
    scale: int = Field(..., description="Escala temporal en meses (1, 3, 6, 12)")
    horizon: int = Field(..., ge=1, le=12, description="Horizonte de prediccion (1-12)")


class AiSummaryRequest(BaseModel):
    type: Literal["1d", "2d"] = Field(..., description="Tipo de resumen: 1d (temporal) o 2d (espacial)")
    index: str = Field(..., description="Indice de sequia")
    scale: int = Field(..., description="Escala temporal")
    values: Optional[List[float]] = Field(None, description="Valores temporales (para tipo 1d)")
    grid_summary: Optional[Dict[str, Any]] = Field(None, description="Resumen del grid (para tipo 2d)")
    horizon: Optional[int] = Field(None, description="Horizonte (para tipo 2d)")
