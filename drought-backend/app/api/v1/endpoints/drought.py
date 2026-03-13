"""
Endpoints para monitoreo y predicción de sequías.
Implementa funcionalidad de análisis histórico, predicción y exportación.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta

from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.services.cloud_storage import CloudStorageService
from app.services.drought_analysis import DroughtAnalysisService
from app.services.export_service import ExportService
from app.schemas.drought import (
    HydroMetVariable, VariableListResponse,
    DroughtIndex, DroughtIndexListResponse,
    TimeSeriesRequest, TimeSeriesResponse,
    SpatialDataRequest, SpatialDataResponse,
    Station, StationListResponse,
    GridMeshResponse,
    PredictionRequest, PredictionResponse,
    CorrelationRequest, CorrelationResponse,
    ExportRequest, ExportResponse,
    HistoricalAnalysisRequest, HistoricalAnalysisResponse,
    DashboardConfigResponse
)
from app.core.config import settings


router = APIRouter()

# Servicios
drought_service = DroughtAnalysisService()
cloud_service = CloudStorageService()
export_service = ExportService()


# ============================================================================
# CATÁLOGOS - Variables e Índices
# ============================================================================

@router.get("/variables", response_model=VariableListResponse)
def get_available_variables():
    """
    Obtiene el catálogo de variables hidrometeorológicas disponibles.
    
    Menu (1): Variables hidrometeorológicas (precipitación, temperatura, ET, caudal)
    """
    variables = drought_service.get_available_variables()
    return {
        "total": len(variables),
        "variables": variables
    }


@router.get("/drought-indices", response_model=DroughtIndexListResponse)
def get_available_drought_indices():
    """
    Obtiene el catálogo de índices de sequía disponibles.
    
    Menu (2) y Menu (3): Índices de sequía (meteorológicos, hidrológicos, agrícolas)
    """
    indices = drought_service.get_available_indices()
    return {
        "total": len(indices),
        "indices": indices
    }


# ============================================================================
# ANÁLISIS HISTÓRICO - Series de Tiempo (1D)
# ============================================================================

@router.post("/historical/timeseries", response_model=TimeSeriesResponse)
def get_historical_timeseries(
    request: TimeSeriesRequest,
    db: Session = Depends(get_db)
):
    """
    Obtiene serie de tiempo histórica para una ubicación específica.
    
    - Permite graficar en 1D (serie de tiempo en celda o estación)
    - Slidebar (1): Utiliza start_date y end_date del request
    - Click en celda/estación: Usa station_id, cell_id o lat/lon
    """
    # Buscar archivo parquet
    parquet_file = db.query(ParquetFile).filter(
        ParquetFile.id == request.file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not parquet_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet no encontrado"
        )
    
    try:
        # Descargar archivo de la nube
        file_data = cloud_service.download_file(parquet_file.cloud_key)
        
        # Preparar filtro de ubicación
        location_filter = {}
        location_type = "point"
        location_id = None
        coordinates = {}
        
        if request.station_id:
            location_filter['station_id'] = request.station_id
            location_type = "station"
            location_id = request.station_id
        elif request.cell_id:
            location_filter['cell_id'] = request.cell_id
            location_type = "cell"
            location_id = request.cell_id
        elif request.lat is not None and request.lon is not None:
            location_filter['lat'] = request.lat
            location_filter['lon'] = request.lon
            coordinates = {"lat": request.lat, "lon": request.lon}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe especificar station_id, cell_id o coordenadas lat/lon"
            )
        
        # Extraer serie de tiempo
        data_points, statistics = drought_service.get_timeseries_from_parquet(
            parquet_data=file_data,
            variable_id=request.variable_or_index,
            start_date=request.start_date,
            end_date=request.end_date,
            location_filter=location_filter
        )
        
        # Obtener información de la variable
        var_info = None
        if request.variable_or_index in drought_service.HYDROMETEOROLOGICAL_VARIABLES:
            var_info = drought_service.HYDROMETEOROLOGICAL_VARIABLES[request.variable_or_index]
        elif request.variable_or_index in drought_service.DROUGHT_INDICES:
            var_info = drought_service.DROUGHT_INDICES[request.variable_or_index]
        
        unit = var_info.get("unit", "") if var_info else ""
        
        return {
            "variable_or_index": request.variable_or_index,
            "location_type": location_type,
            "location_id": location_id,
            "coordinates": coordinates,
            "unit": unit,
            "data": data_points,
            "statistics": statistics
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando datos: {str(e)}"
        )


# ============================================================================
# ANÁLISIS HISTÓRICO - Datos Espaciales (2D)
# ============================================================================

@router.post("/historical/spatial", response_model=SpatialDataResponse)
def get_historical_spatial(
    request: SpatialDataRequest,
    db: Session = Depends(get_db)
):
    """
    Obtiene datos espaciales (2D) para una fecha específica.
    
    - Permite graficar en 2D (todas las celdas del dominio)
    - Muestra datos para la fecha especificada en target_date
    """
    # Buscar archivo parquet
    parquet_file = db.query(ParquetFile).filter(
        ParquetFile.id == request.file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not parquet_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet no encontrado"
        )
    
    try:
        # Descargar archivo de la nube
        file_data = cloud_service.download_file(parquet_file.cloud_key)
        
        # Extraer datos espaciales
        grid_cells, statistics = drought_service.get_spatial_data_from_parquet(
            parquet_data=file_data,
            variable_id=request.variable_or_index,
            target_date=request.target_date
        )
        
        # Obtener información de la variable
        var_info = None
        if request.variable_or_index in drought_service.HYDROMETEOROLOGICAL_VARIABLES:
            var_info = drought_service.HYDROMETEOROLOGICAL_VARIABLES[request.variable_or_index]
        elif request.variable_or_index in drought_service.DROUGHT_INDICES:
            var_info = drought_service.DROUGHT_INDICES[request.variable_or_index]
        
        unit = var_info.get("unit", "") if var_info else ""
        
        # Obtener escala de colores
        color_scale = drought_service.get_color_scale(request.variable_or_index)
        
        return {
            "variable_or_index": request.variable_or_index,
            "date": request.target_date,
            "unit": unit,
            "grid_cells": grid_cells,
            "statistics": statistics,
            "color_scale": color_scale
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando datos: {str(e)}"
        )


# ============================================================================
# PREDICCIÓN
# ============================================================================

@router.post("/prediction/forecast", response_model=PredictionResponse)
def get_drought_prediction(
    request: PredictionRequest,
    db: Session = Depends(get_db)
):
    """
    Obtiene predicción de índice de sequía.
    
    - Menu (3): Selección de índice de sequía
    - Menu (4): Horizonte de tiempo (1m, 3m, 6m)
    - Despliega predicción en 2D
    """
    # Buscar archivo parquet
    parquet_file = db.query(ParquetFile).filter(
        ParquetFile.id == request.file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not parquet_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet no encontrado"
        )
    
    # Verificar que el índice soporte predicción
    if request.drought_index not in drought_service.DROUGHT_INDICES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Índice de sequía '{request.drought_index}' no encontrado"
        )
    
    if not drought_service.DROUGHT_INDICES[request.drought_index].get("supports_prediction", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El índice '{request.drought_index}' no soporta predicción"
        )
    
    try:
        # Fecha de referencia
        ref_date = request.reference_date or date.today()
        
        # Calcular rango de predicción
        horizon_months = int(request.horizon[:-1])  # Extraer número de meses
        forecast_end = ref_date + timedelta(days=horizon_months * 30)
        
        # Por ahora retornamos estructura de ejemplo
        # En producción, aquí se llamaría a un modelo de ML o método estadístico
        
        # Descargar archivo de la nube
        file_data = cloud_service.download_file(parquet_file.cloud_key)
        
        # Obtener últimos datos disponibles como base
        grid_cells, statistics = drought_service.get_spatial_data_from_parquet(
            parquet_data=file_data,
            variable_id=request.drought_index,
            target_date=ref_date
        )
        
        # Nota: Aquí se aplicaría el modelo de predicción real
        # Por ahora devolvemos los datos actuales como placeholder
        
        return {
            "drought_index": request.drought_index,
            "horizon": request.horizon,
            "reference_date": ref_date,
            "forecast_range": {
                "start": ref_date,
                "end": forecast_end
            },
            "spatial_data": grid_cells,
            "statistics": {
                **statistics,
                "model": "baseline",
                "confidence": 0.75
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando predicción: {str(e)}"
        )


# ============================================================================
# EXPORTACIÓN
# ============================================================================

@router.post("/export", response_model=ExportResponse)
def export_data(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """
    Exporta datos o gráficas.
    
    - Botón Guardar: formato CSV para datos, PNG/JPEG para gráficas
    - Soporta exportar 1D (serie de tiempo) o 2D (datos espaciales)
    - Puede exportar múltiples arreglos 2D para un intervalo de tiempo
    """
    # Buscar archivo parquet
    parquet_file = db.query(ParquetFile).filter(
        ParquetFile.id == request.file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not parquet_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet no encontrado"
        )
    
    try:
        file_data = cloud_service.download_file(parquet_file.cloud_key)
        
        if request.export_type == "timeseries_csv":
            # Exportar serie de tiempo
            if not request.start_date or not request.end_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Se requieren start_date y end_date para exportar serie de tiempo"
                )
            
            location_filter = {}
            if request.location_id:
                # Intentar determinar si es station_id o cell_id
                location_filter['station_id'] = request.location_id
            
            data_points, statistics = drought_service.get_timeseries_from_parquet(
                parquet_data=file_data,
                variable_id=request.variable_or_index,
                start_date=request.start_date,
                end_date=request.end_date,
                location_filter=location_filter if location_filter else None
            )
            
            filepath, file_size = export_service.export_timeseries_csv(
                data=data_points,
                variable_name=request.variable_or_index,
                location_info={"location_id": request.location_id},
                metadata={"statistics": statistics}
            )
            
        elif request.export_type == "spatial_csv":
            # Exportar datos espaciales
            if not request.target_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Se requiere target_date para exportar datos espaciales"
                )
            
            grid_cells, statistics = drought_service.get_spatial_data_from_parquet(
                parquet_data=file_data,
                variable_id=request.variable_or_index,
                target_date=request.target_date
            )
            
            filepath, file_size = export_service.export_spatial_csv(
                grid_cells=grid_cells,
                variable_name=request.variable_or_index,
                target_date=request.target_date,
                metadata={"statistics": statistics}
            )
            
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de exportación '{request.export_type}' no soportado aún"
            )
        
        # Generar URL de descarga
        filename = filepath.split("/")[-1]
        download_url = f"{settings.API_V1_STR}/drought/download/{filename}"
        
        # Tiempo de expiración (24 horas)
        expires_at = datetime.now() + timedelta(hours=24)
        
        return {
            "success": True,
            "download_url": download_url,
            "filename": filename,
            "file_size": file_size,
            "expires_at": expires_at
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exportando datos: {str(e)}"
        )


# ============================================================================
# ESTACIONES Y MALLA
# ============================================================================

@router.get("/stations", response_model=StationListResponse)
def get_stations(
    file_id: int = Query(..., description="ID del archivo parquet"),
    db: Session = Depends(get_db)
):
    """
    Obtiene lista de estaciones disponibles en los datos.
    
    - Muestra estaciones sobre el mapa en Zona (1)
    """
    # Buscar archivo parquet
    parquet_file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not parquet_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet no encontrado"
        )
    
    # Por ahora retornar estaciones de ejemplo
    # En producción, se extraerían del parquet
    stations = [
        {
            "station_id": "BOG001",
            "name": "Bogotá Centro",
            "lat": 4.6097,
            "lon": -74.0817,
            "elevation": 2640,
            "type": "meteorological",
            "active": True,
            "available_variables": ["precipitation", "temperature"]
        }
    ]
    
    return {
        "total": len(stations),
        "stations": stations
    }


@router.get("/grid-mesh")
def get_grid_mesh(
    file_id: int = Query(..., description="ID del archivo parquet"),
    db: Session = Depends(get_db)
):
    """
    Obtiene información de la malla de celdas.
    
    - Muestra la malla (celdas) que discretizan la zona de estudio
    """
    # Buscar archivo parquet
    parquet_file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status == "active"
    ).first()
    
    if not parquet_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo parquet no encontrado"
        )
    
    # Retornar estructura de malla de ejemplo
    # En producción, se calcularía del parquet
    return {
        "mesh": {
            "grid_id": "bogota_0.1deg",
            "resolution": 0.1,
            "rows": 50,
            "cols": 50,
            "bounds": {
                "min_lat": 3.5,
                "max_lat": 5.5,
                "min_lon": -75.0,
                "max_lon": -73.0
            },
            "projection": "WGS84"
        },
        "cells": []  # Se llenaría con las celdas reales
    }


# ============================================================================
# CONFIGURACIÓN DEL DASHBOARD
# ============================================================================

@router.get("/config", response_model=DashboardConfigResponse)
def get_dashboard_config():
    """
    Obtiene configuración general del dashboard.
    
    - Información del área de estudio (Bogotá)
    - Configuración de mapas
    - Escalas de color
    - Umbrales de categorización
    """
    config = {
        "study_area": {
            "name": "Bogotá D.C.",
            "country": "Colombia",
            "bounds": {
                "min_lat": 3.5,
                "max_lat": 5.5,
                "min_lon": -75.0,
                "max_lon": -73.0
            },
            "center": {
                "lat": 4.6097,
                "lon": -74.0817
            }
        },
        "map_config": {
            "default_zoom": 10,
            "min_zoom": 8,
            "max_zoom": 15,
            "show_scale": True,
            "show_north_arrow": True
        },
        "available_periods": {
            "start": "1990-01-01",
            "end": datetime.now().strftime("%Y-%m-%d")
        },
        "color_scales": drought_service.INDEX_DROUGHT_SCALES,
        "thresholds": {
            "spi": [-2.0, -1.5, -1.0, 1.0, 1.5, 2.0],
            "spei": [-2.0, -1.5, -1.0, 1.0, 1.5, 2.0]
        }
    }
    
    return {
        "config": config,
        "last_updated": datetime.now()
    }
