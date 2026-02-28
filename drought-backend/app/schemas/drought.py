"""
Schemas específicos para monitoreo y predicción de sequías.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date


# ============================================================================
# VARIABLES HIDROMETEOROLÓGICAS
# ============================================================================

class HydroMetVariable(BaseModel):
    """Variable hidrometeorológica disponible."""
    id: str
    name: str
    description: str
    unit: str
    category: Literal["meteorological", "hydrological"]
    available: bool = True


class VariableListResponse(BaseModel):
    """Lista de variables disponibles."""
    total: int
    variables: List[HydroMetVariable]


# ============================================================================
# ÍNDICES DE SEQUÍA
# ============================================================================

class DroughtIndex(BaseModel):
    """Índice de sequía disponible."""
    id: str
    name: str
    description: str
    category: Literal["meteorological", "hydrological", "agricultural"]
    unit: Optional[str] = None
    available: bool = True
    supports_prediction: bool = False


class DroughtIndexListResponse(BaseModel):
    """Lista de índices de sequía disponibles."""
    total: int
    indices: List[DroughtIndex]


# ============================================================================
# DATOS DE SERIES DE TIEMPO (1D)
# ============================================================================

class TimeSeriesDataPoint(BaseModel):
    """Punto de datos en serie de tiempo."""
    date: date
    value: float
    category: Optional[str] = None  # Para clasificación de sequía
    quality: Optional[str] = "good"  # good, fair, poor


class TimeSeriesRequest(BaseModel):
    """Request para obtener serie de tiempo."""
    file_id: int
    variable_or_index: str  # ID de variable o índice
    start_date: date
    end_date: date
    station_id: Optional[str] = None  # ID de estación
    cell_id: Optional[str] = None  # ID de celda
    lat: Optional[float] = None
    lon: Optional[float] = None


class TimeSeriesResponse(BaseModel):
    """Response con serie de tiempo."""
    variable_or_index: str
    location_type: Literal["station", "cell", "point"]
    location_id: Optional[str] = None
    coordinates: Dict[str, float]  # {lat, lon}
    unit: str
    data: List[TimeSeriesDataPoint]
    statistics: Dict[str, float]  # mean, min, max, std, etc.


# ============================================================================
# DATOS ESPACIALES (2D)
# ============================================================================

class SpatialDataRequest(BaseModel):
    """Request para obtener datos espaciales (mapa 2D)."""
    file_id: int
    variable_or_index: str
    target_date: date
    bounds: Optional[Dict[str, float]] = None  # {min_lat, max_lat, min_lon, max_lon}


class GridCell(BaseModel):
    """Celda de la malla con datos."""
    cell_id: str
    lat: float
    lon: float
    value: float
    category: Optional[str] = None


class SpatialDataResponse(BaseModel):
    """Response con datos espaciales para mapa 2D."""
    variable_or_index: str
    date: date
    unit: str
    grid_cells: List[GridCell]
    statistics: Dict[str, float]
    color_scale: Dict[str, Any]  # Configuración de escala de colores


# ============================================================================
# ESTACIONES Y MALLA
# ============================================================================

class Station(BaseModel):
    """Estación de monitoreo."""
    station_id: str
    name: str
    lat: float
    lon: float
    elevation: Optional[float] = None
    type: Optional[str] = None  # meteorological, hydrological
    active: bool = True
    available_variables: List[str] = []


class StationListResponse(BaseModel):
    """Lista de estaciones."""
    total: int
    stations: List[Station]


class GridMesh(BaseModel):
    """Información de la malla de celdas."""
    grid_id: str
    resolution: float  # En grados o km
    rows: int
    cols: int
    bounds: Dict[str, float]
    projection: str = "WGS84"


class GridMeshResponse(BaseModel):
    """Response con información de malla."""
    mesh: GridMesh
    cells: List[Dict[str, Any]]  # {cell_id, lat, lon, row, col}


# ============================================================================
# PREDICCIÓN
# ============================================================================

class PredictionRequest(BaseModel):
    """Request para obtener predicción."""
    file_id: int
    drought_index: str
    horizon: Literal["1m", "3m", "6m"]  # 1, 3 o 6 meses
    reference_date: Optional[date] = None  # Fecha de referencia, default=hoy


class PredictionDataPoint(BaseModel):
    """Punto de datos predicho."""
    forecast_date: date
    value: float
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    category: Optional[str] = None


class PredictionResponse(BaseModel):
    """Response con predicción."""
    drought_index: str
    horizon: str
    reference_date: date
    forecast_range: Dict[str, date]  # {start, end}
    spatial_data: List[GridCell]  # Datos espaciales predichos
    statistics: Dict[str, Any]


# ============================================================================
# CORRELACIONES MACROCLIMÁTICAS
# ============================================================================

class MacroClimateIndex(BaseModel):
    """Índice de fenómeno macroclimático."""
    id: str
    name: str
    description: str
    available: bool = True


class CorrelationRequest(BaseModel):
    """Request para correlaciones."""
    file_id: int
    drought_index: str
    macro_index: str  # ENSO, NAO, PDO, etc.
    start_date: date
    end_date: date
    lag_months: Optional[int] = 0  # Desfase temporal


class CorrelationResponse(BaseModel):
    """Response con análisis de correlación."""
    drought_index: str
    macro_index: str
    period: Dict[str, date]
    correlation_coefficient: float
    p_value: float
    significance: bool
    lag_months: int
    time_series: List[Dict[str, Any]]  # Datos para gráfica


# ============================================================================
# EXPORTACIÓN
# ============================================================================

class ExportRequest(BaseModel):
    """Request para exportar datos o gráficas."""
    export_type: Literal["timeseries_csv", "spatial_csv", "chart_png", "chart_jpeg"]
    file_id: int
    variable_or_index: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    target_date: Optional[date] = None
    location_id: Optional[str] = None
    chart_config: Optional[Dict[str, Any]] = None  # Configuración de gráfica


class ExportResponse(BaseModel):
    """Response con información de exportación."""
    success: bool
    download_url: str
    filename: str
    file_size: int
    expires_at: datetime


# ============================================================================
# ANÁLISIS HISTÓRICO
# ============================================================================

class HistoricalAnalysisRequest(BaseModel):
    """Request para análisis histórico completo."""
    file_id: int
    variables: List[str]  # Lista de variables o índices
    start_date: date
    end_date: date
    analysis_type: Literal["1D", "2D"]  # Serie de tiempo o espacial
    location_id: Optional[str] = None  # Para análisis 1D
    aggregation: Optional[Literal["daily", "weekly", "monthly", "yearly"]] = "daily"


class HistoricalAnalysisResponse(BaseModel):
    """Response con análisis histórico."""
    analysis_type: str
    period: Dict[str, date]
    variables: List[str]
    data: Dict[str, Any]  # Estructura flexible según tipo de análisis
    statistics: Dict[str, Dict[str, float]]  # Estadísticas por variable


# ============================================================================
# CONFIGURACIÓN DE DASHBOARD
# ============================================================================

class DashboardConfig(BaseModel):
    """Configuración del dashboard."""
    study_area: Dict[str, Any]  # Información del área de estudio
    map_config: Dict[str, Any]  # Configuración del mapa
    available_periods: Dict[str, date]  # Periodos disponibles
    color_scales: Dict[str, Any]  # Escalas de color por variable/índice
    thresholds: Dict[str, List[float]]  # Umbrales de categorización


class DashboardConfigResponse(BaseModel):
    """Response con configuración del dashboard."""
    config: DashboardConfig
    last_updated: datetime
