"""
Dashboard data schemas for API responses.
"""
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime


class GeographicPoint(BaseModel):
    """Geographic point with coordinates."""
    lat: float
    lon: float
    value: Optional[float] = None


class DroughtData(BaseModel):
    """Drought data for a specific region and time."""
    region_id: str
    region_name: str
    date: datetime
    drought_index: float
    severity: str  # e.g., "normal", "moderate", "severe", "extreme"
    coordinates: List[List[float]]  # GeoJSON-like coordinates
    additional_data: Optional[Dict[str, Any]] = None


class TimeSeriesData(BaseModel):
    """Time series data for drought monitoring."""
    dates: List[str]
    values: List[float]
    region_id: str


class DashboardSummary(BaseModel):
    """Summary data for dashboard."""
    total_regions: int
    regions_with_drought: int
    last_updated: datetime
    severity_distribution: Dict[str, int]


class DashboardDataResponse(BaseModel):
    """Complete dashboard data response."""
    summary: DashboardSummary
    regions: List[DroughtData]
    time_series: Optional[List[TimeSeriesData]] = None


class FilterParams(BaseModel):
    """Parameters for filtering dashboard data."""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    region_ids: Optional[List[str]] = None
    severity_levels: Optional[List[str]] = None
