"""
Endpoints para datos hidrológicos de estaciones.
Utiliza DuckDB para consultas sobre archivos parquet con datos de índices
hidrológicos (SDI, SRI, MFI, DDI, HDI) de 29 estaciones fijas.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.services.historical_data_service import HistoricalDataService
from app.services.hydro_data_service import HydroDataService
from app.services.hydro_constants import HYDRO_COLUMN_MAPPING
from app.services.cache import cache_service
from app.api.v1.endpoints.hydro_schemas import (
    HydroStationsResponse,
    HydroIndicesResponse,
    HydroTimeSeriesRequest,
    HydroSpatialRequest,
)
from app.api.v1.endpoints.historical_utils import orjson_response
from app.services.tiered_storage import _parse_meta


# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter()

logger = logging.getLogger("hydro")

# Inicializar servicios
historical_service = HistoricalDataService(cache_service=cache_service)
hydro_service = HydroDataService(historical_service=historical_service)


def _resolve_hydro_cloud_key(file_id: int, db) -> str:
    """Resuelve file_id a cloud_key para archivos hidrológicos."""
    cache_key = f"hydro_cloud_key:{file_id}"
    cached = cache_service.get(cache_key)
    if cached:
        return cached

    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()

    if not file or not file.cloud_key:
        return None

    result = file.cloud_key
    cache_service.set(cache_key, result, expire=3600)
    return result


# ============================================================================
# ESTACIONES
# ============================================================================

@router.get("/stations", response_model=HydroStationsResponse)
def get_stations():
    """
    Retorna las 29 estaciones hidrológicas con coordenadas y nombres.
    """
    stations = hydro_service.get_stations()
    return {
        "total": len(stations),
        "stations": stations,
    }


# ============================================================================
# CATÁLOGO DE ÍNDICES
# ============================================================================

@router.get("/indices", response_model=HydroIndicesResponse)
def get_hydro_indices():
    """
    Retorna el catálogo de índices hidrológicos disponibles.
    Índices: SDI, SRI, MFI, DDI, HDI
    """
    indices = hydro_service.get_indices()
    return {
        "total": len(indices),
        "items": indices,
    }


# ============================================================================
# SERIE DE TIEMPO (1D)
# ============================================================================

@router.post("/timeseries", response_class=JSONResponse)
def get_hydro_timeseries(
    request: HydroTimeSeriesRequest,
    db: Session = Depends(get_db),
):
    """
    Serie de tiempo de un índice hidrológico para una estación específica.

    Retorna valores del índice por fecha, con categoría de severidad.
    Si el índice tiene datos de duración (Fecha_Final, Duracion), los incluye.
    """
    logger.info(f"POST /hydro/timeseries - station={request.station_code} index={request.index_name} scale={request.scale}")

    # Cache a nivel de endpoint
    endpoint_cache_key = (
        f"endpoint:hydro_ts:{request.parquet_file_id}:{request.station_code}:"
        f"{request.index_name}:{request.scale or 'none'}:{request.start_date}:{request.end_date}:{request.limit}"
    )
    cached = cache_service.get(endpoint_cache_key)
    if cached and isinstance(cached, dict):
        return orjson_response(cached)

    # Resolver cloud_key
    cloud_key = _resolve_hydro_cloud_key(request.parquet_file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet hidrológico no encontrado",
        )

    try:
        data_points, statistics, station_info, has_duration = hydro_service.query_hydro_timeseries(
            parquet_url=cloud_key,
            station_code=request.station_code,
            index_name=request.index_name,
            scale=request.scale,
            start_date=request.start_date,
            end_date=request.end_date,
            limit=request.limit,
        )

        index_info = HYDRO_COLUMN_MAPPING.get(request.index_name, {})

        response_data = {
            "index_name": request.index_name,
            "index_display_name": index_info.get("name", request.index_name),
            "unit": index_info.get("unit", "adimensional"),
            "scale": request.scale,
            "station": station_info,
            "has_duration": has_duration,
            "data": data_points,
            "statistics": statistics,
        }

        cache_service.set(endpoint_cache_key, response_data, expire=900)
        return orjson_response(response_data)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando serie de tiempo hidrológica: {str(e)}",
        )


# ============================================================================
# DATOS ESPACIALES (2D)
# ============================================================================

@router.post("/spatial", response_class=JSONResponse)
def get_hydro_spatial(
    request: HydroSpatialRequest,
    db: Session = Depends(get_db),
):
    """
    Datos espaciales (2D) de un índice hidrológico para todas las estaciones.

    Retorna un valor por estación con categoría de severidad y color.
    Soporta fecha única o intervalo (promedio).
    """
    logger.info(f"POST /hydro/spatial - index={request.index_name} scale={request.scale} date={request.target_date}")

    interval_mode = request.use_interval or (
        request.start_date is not None and request.end_date is not None and request.start_date != request.end_date
    )

    if interval_mode:
        if not request.start_date or not request.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para modo intervalo debes enviar start_date y end_date",
            )
        if request.start_date > request.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date no puede ser mayor que end_date",
            )
    elif not request.target_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="En modo fecha única debes enviar target_date",
        )

    # Cache a nivel de endpoint
    endpoint_cache_key = (
        f"endpoint:hydro_sp:{request.parquet_file_id}:{request.index_name}:{request.scale or 'none'}:"
        f"mode:{'interval' if interval_mode else 'single'}:"
        f"target:{request.target_date}:start:{request.start_date}:end:{request.end_date}"
    )
    cached = cache_service.get(endpoint_cache_key)
    if cached and isinstance(cached, dict):
        return orjson_response(cached)

    # Resolver cloud_key
    cloud_key = _resolve_hydro_cloud_key(request.parquet_file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet hidrológico no encontrado",
        )

    try:
        station_data, statistics, used_date, actual_bounds = hydro_service.query_hydro_spatial(
            parquet_url=cloud_key,
            index_name=request.index_name,
            scale=request.scale,
            target_date=request.target_date,
            start_date=request.start_date,
            end_date=request.end_date,
            use_interval=interval_mode,
        )

        index_info = HYDRO_COLUMN_MAPPING.get(request.index_name, {})

        response_data = {
            "index_name": request.index_name,
            "index_display_name": index_info.get("name", request.index_name),
            "unit": index_info.get("unit", "adimensional"),
            "scale": request.scale,
            "date": str(used_date) if used_date else str(request.target_date),
            "requested_date": str(request.target_date),
            "fallback_used": (not interval_mode) and str(used_date) != str(request.target_date),
            "is_interval": interval_mode,
            "period": {
                "start_date": str(request.start_date),
                "end_date": str(request.end_date),
                "aggregation": "mean",
            } if interval_mode else None,
            "stations": station_data,
            "statistics": statistics,
            "bounds": actual_bounds,
        }

        cache_service.set(endpoint_cache_key, response_data, expire=900)
        return orjson_response(response_data)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando datos espaciales hidrológicos: {str(e)}",
        )
