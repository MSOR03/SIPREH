"""
Endpoints optimizados para análisis histórico de datos de sequía.
Utiliza DuckDB para consultas rápidas sobre archivos .parquet en Cloudflare.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.services.historical_data_service import HistoricalDataService
from app.services.cache import cache_service
from app.api.v1.endpoints.historical_schemas import (
    VariableInfo,
    CatalogResponse,
    TimeSeriesPoint,
    StatisticsInfo,
    TimeSeriesRequest,
    TimeSeriesResponse,
    SpatialDataRequest,
    GridCell,
    SpatialDataResponse,
    FileInfoResponse,
    ColumnInfo,
    FileColumnsResponse,
    FileValidationResponse,
)
from app.api.v1.endpoints.historical_utils import (
    get_file_metadata,
    infer_resolution_from_filename,
    orjson_response,
)
from app.services.tiered_storage import (
    get_active_cloud_keys_for_dataset,
    encode_multi_keys,
    _parse_meta,
)


# ============================================================================
# ROUTER
# ============================================================================

router = APIRouter()

logger = logging.getLogger("historical")

# Inicializar servicios (usando singleton global)
historical_service = HistoricalDataService(cache_service=cache_service)


def _resolve_cloud_keys(file_id: int, db) -> str:
    """
    Resuelve file_id a cloud_key(s).

    Para datasets con estrategia historical_updates: retorna "key1|key2"
    (historical_base | updates) para que _resolve_parquet_source() los
    descargue a ambos y DuckDB lea en paralelo.

    Para datasets single_file o archivos sin dataset_key: retorna el cloud_key
    del archivo tal cual (comportamiento legacy).

    El resultado se cachea 1h en cache_service.
    """
    cache_key_for_file = f"file_cloud_keys_v2:{file_id}"
    cached = cache_service.get(cache_key_for_file)
    if cached:
        return cached

    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()

    if not file:
        return None

    if not file.cloud_key:
        return None

    # Verificar si pertenece a dataset tiered
    meta = _parse_meta(file.file_metadata)
    dataset_key = meta.get("dataset_key")

    if dataset_key:
        from app.services.tiered_storage import is_tiered
        if is_tiered(dataset_key):
            keys = get_active_cloud_keys_for_dataset(dataset_key, db)
            if len(keys) > 1:
                result = encode_multi_keys(keys)
                cache_service.set(cache_key_for_file, result, expire=3600)
                return result

    # Fallback: single file
    result = file.cloud_key
    cache_service.set(cache_key_for_file, result, expire=3600)
    return result


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
    dataset_type: str = None,
    db: Session = Depends(get_db)
):
    """
    Lista todos los archivos parquet disponibles.

    Args:
        dataset_type: Filtro opcional (historical, hydrological, prediction).
                      Si no se pasa, retorna todos.

    NOTA: No ejecuta queries remotas a Cloudflare para cada archivo.
    Solo retorna metadata local (DB + cache). Los datos de date_range
    y spatial_bounds se obtienen solo si ya están en cache.
    """
    logger.info("GET /files - listing available files")
    files = db.query(ParquetFile).filter(
        ParquetFile.status == "active"
    ).all()

    result = []
    for file in files:
        metadata = get_file_metadata(file)

        # Filtrar por dataset_type si se especificó
        if dataset_type:
            file_dataset_type = metadata.get("dataset_type")
            if file_dataset_type and file_dataset_type != dataset_type:
                continue

        resolution = metadata.get("resolution")
        if resolution is None:
            resolution = infer_resolution_from_filename(file.original_filename) or infer_resolution_from_filename(file.filename)

        file_info = {
            "file_id": file.id,
            "filename": file.filename,
            "resolution": resolution,
            "dataset_type": metadata.get("dataset_type"),
            "date_range": {"start": None, "end": None},
            "spatial_bounds": {},
            "size_mb": file.file_size / (1024 * 1024) if file.file_size else None,
            "record_count": metadata.get("num_rows")
        }

        # Solo usar datos de cache — NO hacer queries remotas aquí
        # Las queries remotas a Cloudflare R2 bloquean el servidor durante ~20-30s
        # y con N archivos bloquea completamente el threadpool de FastAPI.
        try:
            if file.cloud_url:
                import hashlib
                url_hash = hashlib.md5(file.cloud_url.encode()).hexdigest()

                # Intentar leer de cache sin ejecutar queries remotas
                cached_range = cache_service.get(f"date_range:{url_hash}")
                if cached_range:
                    file_info["date_range"] = {
                        "start": cached_range[0],
                        "end": cached_range[1]
                    }

                cached_bounds = cache_service.get(f"spatial_bounds:{url_hash}")
                if cached_bounds:
                    file_info["spatial_bounds"] = cached_bounds
        except Exception:
            pass

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
    logger.info(f"POST /timeseries - file={request.parquet_file_id} var={request.variable} cell={request.cell_id}")
    # 🚀 Caché a nivel de endpoint (bypass completo del servicio)
    # Usar string concatenation (más rápido que MD5)
    endpoint_cache_key = f"endpoint:ts:{request.parquet_file_id}:{request.variable}:{request.start_date}:{request.end_date}:{request.lat}:{request.lon}:{request.cell_id}:{request.scale}:{request.source}:{request.frequency}:{request.limit}"
    
    cached = cache_service.get(endpoint_cache_key)
    if cached and isinstance(cached, dict):
        return orjson_response(cached)
    
    # Resolver cloud_key(s) — soporta tiered (multi-archivo)
    cache_key_for_file = f"file_cloud_keys_v2:{request.parquet_file_id}"
    cloud_key = cache_service.get(cache_key_for_file)

    if not cloud_key:
        cloud_key = _resolve_cloud_keys(request.parquet_file_id, db)

        if not cloud_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo parquet no encontrado o sin cloud_key"
            )
    
    # Consultar datos con DuckDB
    try:
        data_points, statistics, coordinates, returned_freq = historical_service.query_timeseries(
            parquet_url=cloud_key,
            variable=request.variable,
            start_date=request.start_date,
            end_date=request.end_date,
            lat=request.lat,
            lon=request.lon,
            cell_id=request.cell_id,
            scale=request.scale,
            source=request.source,
            frequency=request.frequency,
            limit=request.limit
        )

        # Obtener info de la variable
        var_info = historical_service.COLUMN_MAPPING.get(request.variable, {})

        # 🎯 OPTIMIZACIÓN: Usar coordenadas reales del servicio (punto más cercano)
        response_data = {
            "variable": request.variable,
            "variable_name": var_info.get("name", request.variable),
            "unit": var_info.get("unit", ""),
            "frequency": returned_freq,
            "location": coordinates,
            "data": data_points,
            "statistics": statistics
        }

        # Guardar respuesta completa en caché (15 min)
        cache_service.set(endpoint_cache_key, response_data, expire=900)

        # orjson serializa NaN/Inf→null, np/pd types nativo — sin recursión O(n)
        return orjson_response(response_data)
        
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
    logger.info(f"POST /spatial - file={request.parquet_file_id} var={request.variable} date={request.target_date}")
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
        f"scale:{request.scale}:source:{request.source}:freq:{request.frequency}:"
        f"{request.min_lat}:{request.max_lat}:{request.min_lon}:{request.max_lon}:limit:{request.limit}"
    )
    
    cached = cache_service.get(endpoint_cache_key)
    if cached and isinstance(cached, dict):
        return orjson_response(cached)
    
    # Resolver cloud_key(s) — soporta tiered (multi-archivo)
    cache_key_for_file = f"file_cloud_keys_v2:{request.parquet_file_id}"
    cloud_key = cache_service.get(cache_key_for_file)

    if not cloud_key:
        cloud_key = _resolve_cloud_keys(request.parquet_file_id, db)

        if not cloud_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Archivo parquet no encontrado o sin cloud_key"
            )
    
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
        grid_cells, statistics, used_date, actual_bounds = historical_service.query_spatial_data(
            parquet_url=cloud_key,  # Usar cloud_key cacheado
            variable=request.variable,
            target_date=request.target_date,
            start_date=request.start_date,
            end_date=request.end_date,
            use_interval=interval_mode,
            bounds=bounds,
            scale=request.scale,
            source=request.source,
            frequency=request.frequency,
            limit=request.limit
        )

        # Info de la variable
        var_info = historical_service.COLUMN_MAPPING.get(request.variable, {})

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
        return orjson_response(response_data)
        
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
    logger.info("GET /health - health check")
    return {
        "status": "healthy",
        "service": "historical-data",
        "cache_type": "redis" if cache_service.redis_client else "memory",
        "duckdb_available": True
    }
