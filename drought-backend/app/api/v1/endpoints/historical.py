"""
Endpoints optimizados para análisis histórico de datos de sequía.
Utiliza DuckDB para consultas rápidas sobre archivos .parquet en Cloudflare.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
import math
import orjson

from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.services.historical_data_service import HistoricalDataService
from app.services.cache import cache_service
from pydantic import BaseModel, Field
import json
import ast


# ============================================================================
# SCHEMAS
# ============================================================================

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
    limit: int = Field(70000, description="Máximo de registros a retornar (default: 70000)")


class TimeSeriesResponse(BaseModel):
    """Response con serie de tiempo."""
    variable: str
    variable_name: str
    unit: str
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
    date_range: dict
    spatial_bounds: dict
    size_mb: Optional[float] = None
    record_count: Optional[int] = None


# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter()

# Inicializar servicios (usando singleton global)
historical_service = HistoricalDataService(cache_service=cache_service)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_file_metadata(file: ParquetFile) -> dict:
    """
    Parse file_metadata JSON string to dict.
    
    Args:
        file: ParquetFile instance
        
    Returns:
        Dict with metadata or empty dict if parsing fails
    """
    if file.file_metadata:
        try:
            parsed = json.loads(file.file_metadata)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            # Compatibilidad con datos viejos guardados como str(dict)
            try:
                parsed = ast.literal_eval(file.file_metadata)
                return parsed if isinstance(parsed, dict) else {}
            except (ValueError, SyntaxError):
                return {}
    return {}


def to_json_safe(value):
    """Recursively convert values to JSON-safe types (replace NaN/Inf with None)."""
    if isinstance(value, dict):
        return {k: to_json_safe(v) for k, v in value.items()}

    if isinstance(value, list):
        return [to_json_safe(v) for v in value]

    if isinstance(value, tuple):
        return [to_json_safe(v) for v in value]

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    # numpy/pandas scalar support (e.g., np.float64, np.int64, pd.NA)
    if hasattr(value, "item") and callable(getattr(value, "item")):
        try:
            return to_json_safe(value.item())
        except Exception:
            pass

    # Generic NaN check for remaining scalar-like values
    try:
        if value != value:  # NaN is not equal to itself
            return None
    except Exception:
        pass

    return value


def _orjson_response(data: dict) -> Response:
    """
    Serialize a dict to a JSON Response using orjson.
    orjson handles natively: float NaN/Inf → null, numpy scalars, pd.NA → null,
    datetime.date → ISO string.  3-10x faster than stdlib json for large payloads.
    """
    return Response(
        content=orjson.dumps(data, option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY),
        media_type="application/json",
    )


# ============================================================================
# CATÁLOGOS
# ============================================================================

@router.get("/catalog/variables", response_model=CatalogResponse)
def get_hydrometeorological_variables():
    """
    Obtiene catálogo de variables hidrometeorológicas disponibles.
    
    Menu (1): Variables hidrometeorológicas
    Retorna: precip, tmean, tmin, tmax, pet, balance
    """
    variables = historical_service.get_hydrometeorological_variables()
    return {
        "total": len(variables),
        "items": variables
    }


@router.get("/catalog/drought-indices", response_model=CatalogResponse)
def get_drought_indices():
    """
    Obtiene catálogo de índices de sequía disponibles.
    
    Menu (2) y Menu (3): Índices de sequía
    Retorna: SPI, SPEI, RAI, EDDI, PDSI
    """
    indices = historical_service.get_drought_indices()
    return {
        "total": len(indices),
        "items": indices
    }


@router.get("/catalog/all", response_model=CatalogResponse)
def get_all_variables_and_indices():
    """
    Obtiene catálogo completo de variables e índices PREDEFINIDO.
    
    Nota: Este es el catálogo fijo del sistema. Para ver las columnas reales
    de un archivo específico, usa GET /files/{file_id}/columns
    """
    all_items = historical_service.get_available_variables()
    return {
        "total": len(all_items),
        "items": all_items
    }


# ============================================================================
# DETECCIÓN AUTOMÁTICA DE COLUMNAS
# ============================================================================

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


@router.get("/files/{file_id}/columns", response_model=FileColumnsResponse)
def get_file_columns(
    file_id: int,
    db: Session = Depends(get_db)
):
    """
    Detecta automáticamente las columnas disponibles en un archivo .parquet.
    
    A diferencia de /catalog/*, este endpoint LEE el archivo real y te muestra:
    - Todas las columnas que realmente tiene el archivo
    - Cuáles están en el catálogo conocido
    - Cuáles son desconocidas
    - Tipos de datos de cada columna
    
    Útil para:
    - Verificar qué variables tiene tu archivo antes de consultar
    - Descubrir columnas adicionales no documentadas
    - Validar la estructura del archivo
    """
    # Buscar archivo
    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado"
        )
    
    if not file.cloud_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no tiene cloud_key configurado"
        )
    
    try:
        columns_info = historical_service.get_columns_from_file(file.cloud_key)
        
        return {
            "file_id": file.id,
            "filename": file.filename,
            **columns_info
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error detectando columnas: {str(e)}"
        )


@router.get("/files/{file_id}/validate", response_model=FileValidationResponse)
def validate_file_structure(
    file_id: int,
    db: Session = Depends(get_db)
):
    """
    Valida la estructura de un archivo .parquet.
    
    Verifica:
    - Tiene las columnas requeridas (date, lat, lon)
    - Tiene columnas de datos
    - Las columnas son reconocidas en el catálogo
    
    Returns:
    - valid: true/false
    - errors: Problemas críticos
    - warnings: Advertencias (columnas desconocidas)
    - info: Información adicional
    """
    # Buscar archivo
    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado"
        )
    
    if not file.cloud_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no tiene cloud_key configurado"
        )
    
    try:
        validation = historical_service.validate_file_structure(file.cloud_key)
        
        return {
            "file_id": file.id,
            "filename": file.filename,
            **validation
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validando archivo: {str(e)}"
        )


# ============================================================================
# INFORMACIÓN DE ARCHIVOS
# ============================================================================

@router.get("/files", response_model=List[FileInfoResponse])
def list_available_files(
    db: Session = Depends(get_db)
):
    """
    Lista todos los archivos parquet disponibles.
    """
    files = db.query(ParquetFile).filter(
        ParquetFile.status == "active"
    ).all()
    
    result = []
    for file in files:
        metadata = get_file_metadata(file)
        file_info = {
            "file_id": file.id,
            "filename": file.filename,
            "resolution": metadata.get("resolution"),
            "date_range": {"start": None, "end": None},
            "spatial_bounds": {},
            "size_mb": file.file_size / (1024 * 1024) if file.file_size else None,
            "record_count": metadata.get("num_rows")
        }
        
        # Intentar obtener rango de fechas y bounds (si está en cache)
        try:
            if file.cloud_url:
                date_range = historical_service.get_date_range(file.cloud_url)
                file_info["date_range"] = {
                    "start": date_range[0],
                    "end": date_range[1]
                }
                
                bounds = historical_service.get_spatial_bounds(file.cloud_url)
                file_info["spatial_bounds"] = bounds
        except:
            pass  # Si falla, continuar sin esa info
        
        result.append(file_info)
    
    return result


@router.get("/files/{file_id}/info", response_model=FileInfoResponse)
def get_file_info(
    file_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene información detallada de un archivo parquet.
    """
    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado"
        )
    
    # Obtener rango de fechas y bounds
    try:
        date_range = historical_service.get_date_range(file.cloud_url)
        bounds = historical_service.get_spatial_bounds(file.cloud_url)
        metadata = get_file_metadata(file)
        
        return {
            "file_id": file.id,
            "filename": file.filename,
            "resolution": metadata.get("resolution"),
            "date_range": {
                "start": date_range[0],
                "end": date_range[1]
            },
            "spatial_bounds": bounds,
            "size_mb": file.file_size / (1024 * 1024) if file.file_size else None,
            "record_count": metadata.get("num_rows")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo información del archivo: {str(e)}"
        )


@router.get("/files/{file_id}/cells")
def get_file_cells(
    file_id: int,
    db: Session = Depends(get_db)
):
    """
    Obtiene los cell_ids únicos de un archivo parquet.
    Útil para navegación jerárquica de grillas.
    
    Returns:
        {
            "file_id": int,
            "resolution": float,
            "total_cells": int,
            "cells": List[str]  # ["LON_LAT", ...]
        }
    """
    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado"
        )
    
    # Obtener celdas únicas del servicio
    try:
        cells = historical_service.get_unique_cells(file.cloud_url)
        metadata = get_file_metadata(file)
        
        return {
            "file_id": file.id,
            "filename": file.filename,
            "resolution": metadata.get("resolution"),
            "total_cells": len(cells),
            "cells": cells
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo celdas: {str(e)}"
        )


# ============================================================================
# ANÁLISIS HISTÓRICO - SERIE DE TIEMPO (1D)
# ============================================================================

@router.post("/timeseries", response_class=JSONResponse)
def get_timeseries(
    request: TimeSeriesRequest,
    db: Session = Depends(get_db)
):
    """
    Obtiene serie de tiempo histórica para una ubicación específica.
    
    Implementa:
    - Slidebar (1): Periodo de tiempo (start_date, end_date)
    - Click en celda: Usa lat/lon o cell_id
    - Graficar en 1D: Serie de tiempo
    
    Respuesta rápida gracias a DuckDB + cache.
    """
    # 🚀 Caché a nivel de endpoint (bypass completo del servicio)
    # Usar string concatenation (más rápido que MD5)
    endpoint_cache_key = f"endpoint:ts:{request.parquet_file_id}:{request.variable}:{request.start_date}:{request.end_date}:{request.lat}:{request.lon}:{request.cell_id}:{request.limit}"
    
    cached = cache_service.get(endpoint_cache_key)
    if cached and isinstance(cached, dict):
        return _orjson_response(cached)
    
    # Cachear el cloud_key para evitar consulta DB en cada request
    cache_key_for_file = f"file_cloud_key:{request.parquet_file_id}"
    cloud_key = cache_service.get(cache_key_for_file)
    
    if not cloud_key:
        # Solo consultar DB si no está en caché
        file = db.query(ParquetFile).filter(
            ParquetFile.id == request.parquet_file_id,
            ParquetFile.status == "active"
        ).first()
        
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo parquet no encontrado"
            )
        
        if not file.cloud_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo no tiene cloud_key configurado"
            )
        
        cloud_key = file.cloud_key
        # Cachear por 1 hora
        cache_service.set(cache_key_for_file, cloud_key, expire=3600)
    
    # Consultar datos con DuckDB
    try:
        data_points, statistics, coordinates = historical_service.query_timeseries(
            parquet_url=cloud_key,
            variable=request.variable,
            start_date=request.start_date,
            end_date=request.end_date,
            lat=request.lat,
            lon=request.lon,
            cell_id=request.cell_id,
            limit=request.limit
        )
        
        # Obtener info de la variable
        var_info = historical_service.COLUMN_MAPPING.get(request.variable, {})
        
        # 🎯 OPTIMIZACIÓN: Usar coordenadas reales del servicio (punto más cercano)
        response_data = {
            "variable": request.variable,
            "variable_name": var_info.get("name", request.variable),
            "unit": var_info.get("unit", ""),
            "location": coordinates,
            "data": data_points,
            "statistics": statistics
        }

        # Guardar respuesta completa en caché (15 min)
        cache_service.set(endpoint_cache_key, response_data, expire=900)

        # orjson serializa NaN/Inf→null, np/pd types nativo — sin recursión O(n)
        return _orjson_response(response_data)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando datos: {str(e)}"
        )


# ============================================================================
# ANÁLISIS HISTÓRICO - DATOS ESPACIALES (2D)
# ============================================================================

@router.post("/spatial", response_class=JSONResponse)
def get_spatial_data(
    request: SpatialDataRequest,
    db: Session = Depends(get_db)
):
    """
    Obtiene datos espaciales (mapa 2D) para una fecha específica.
    
    Implementa:
    - Graficar en 2D: Todas las celdas del dominio
    - Fecha única: target_date
    - Filtro espacial opcional: bounds
    
    Respuesta rápida gracias a DuckDB + cache.
    """
    # 🚀 Caché a nivel de endpoint
    interval_mode = request.use_interval or (
        request.start_date is not None and request.end_date is not None and request.start_date != request.end_date
    )

    if interval_mode:
        if not request.start_date or not request.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Para modo intervalo debes enviar start_date y end_date"
            )
        if request.start_date > request.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date no puede ser mayor que end_date"
            )
    elif not request.target_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="En modo fecha única debes enviar target_date"
        )

    endpoint_cache_key = (
        f"endpoint:spatial:{request.parquet_file_id}:{request.variable}:"
        f"mode:{'interval' if interval_mode else 'single'}:"
        f"target:{request.target_date}:start:{request.start_date}:end:{request.end_date}:"
        f"{request.min_lat}:{request.max_lat}:{request.min_lon}:{request.max_lon}:limit:{request.limit}"
    )
    
    cached = cache_service.get(endpoint_cache_key)
    if cached and isinstance(cached, dict):
        return _orjson_response(cached)
    
    # Cachear el cloud_key para evitar consulta DB
    cache_key_for_file = f"file_cloud_key:{request.parquet_file_id}"
    cloud_key = cache_service.get(cache_key_for_file)
    
    if not cloud_key:
        # Solo consultar DB si no está en caché
        file = db.query(ParquetFile).filter(
            ParquetFile.id == request.parquet_file_id,
            ParquetFile.status == "active"
        ).first()
        
        if not file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo parquet no encontrado"
            )
        
        if not file.cloud_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo no tiene cloud_key configurado"
            )
        
        cloud_key = file.cloud_key
        # Cachear por 1 hora
        cache_service.set(cache_key_for_file, cloud_key, expire=3600)
    
    # Construir bounds si se proporcionaron
    bounds = None
    if any(v is not None for v in [request.min_lat, request.max_lat, request.min_lon, request.max_lon]):
        bounds = {
            "min_lat": request.min_lat or -90,
            "max_lat": request.max_lat or 90,
            "min_lon": request.min_lon or -180,
            "max_lon": request.max_lon or 180
        }
    
    # Consultar datos
    try:
        grid_cells, statistics, used_date = historical_service.query_spatial_data(
            parquet_url=cloud_key,  # Usar cloud_key cacheado
            variable=request.variable,
            target_date=request.target_date,
            start_date=request.start_date,
            end_date=request.end_date,
            use_interval=interval_mode,
            bounds=bounds,
            limit=request.limit
        )
        
        # Info de la variable
        var_info = historical_service.COLUMN_MAPPING.get(request.variable, {})
        
        # Calcular bounds reales de los datos
        if grid_cells:
            lats = [cell["lat"] for cell in grid_cells]
            lons = [cell["lon"] for cell in grid_cells]
            actual_bounds = {
                "min_lat": min(lats),
                "max_lat": max(lats),
                "min_lon": min(lons),
                "max_lon": max(lons)
            }
        else:
            actual_bounds = bounds or {}
        
        response_data = {
            "variable": request.variable,
            "variable_name": var_info.get("name", request.variable),
            "unit": var_info.get("unit", ""),
            "date": used_date if not interval_mode else request.end_date,
            "requested_date": request.target_date,
            "fallback_used": (not interval_mode) and str(used_date) != str(request.target_date),
            "is_interval": interval_mode,
            "period": {
                "start_date": request.start_date,
                "end_date": request.end_date,
                "aggregation": "mean"
            } if interval_mode else None,
            "grid_cells": grid_cells,
            "statistics": statistics,
            "bounds": actual_bounds
        }

        # 🚀 Cachear respuesta completa (15 min)
        cache_service.set(endpoint_cache_key, response_data, expire=900)

        # orjson serializa NaN/Inf→null, np/pd types nativo — sin recursión O(n)
        return _orjson_response(response_data)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando datos espaciales: {str(e)}"
        )


# ============================================================================
# UTILIDADES
# ============================================================================

@router.get("/cache/stats")
def get_cache_stats():
    """
    Obtiene estadísticas del cache de disco local.
    
    Incluye:
    - Número de archivos cacheados
    - Tamaño total en disco
    - Uso de espacio (%)
    - Hit rate
    - Top archivos más accedidos
    
    DEPRECADO: Este endpoint ya no se usa con el enfoque de consultas directas.
    """
    # COMENTADO: Sistema de cache de disco eliminado
    # from app.services.parquet_cache_manager import parquet_cache_manager
    
    return {
        "message": "Cache de disco deshabilitado - usando consultas directas a Cloudflare",
        "stats": {
            "disk_cache_enabled": False,
            "strategy": "Direct Cloudflare queries + Redis for results"
        }
    }


@router.post("/cache/clear")
def clear_cache(
    clear_disk: bool = False
):
    """
    Limpia el cache del servicio.
    
    Args:
        clear_disk: DEPRECADO - ya no se usa cache de disco
    
    Limpia:
    - Cache en memoria (siempre)
    - Redis (siempre)
    """
    # COMENTADO: Sistema de cache de disco eliminado
    # from app.services.parquet_cache_manager import parquet_cache_manager
    
    try:
        # Limpiar cache en memoria
        cache_service.memory_cache.clear()
        
        # Limpiar Redis si está disponible
        redis_cleared = False
        if cache_service.redis_client:
            cache_service.redis_client.flushdb()
            redis_cleared = True
        
        return {
            "message": "Cache limpiado exitosamente",
            "memory_cleared": True,
            "redis_cleared": redis_cleared,
            "disk_cleared": False,
            "note": "Cache de disco deshabilitado - usando consultas directas"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error limpiando cache: {str(e)}"
        )


@router.get("/health")
def health_check():
    """
    Verifica el estado del servicio.
    """
    return {
        "status": "healthy",
        "service": "historical-data",
        "cache_type": "redis" if cache_service.redis_client else "memory",
        "duckdb_available": True
    }
