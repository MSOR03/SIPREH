"""
Endpoints para prediccion de sequia.
Consulta datos del parquet prediction_main via DuckDB.
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.services.prediction_data_service import PredictionDataService
from app.services.historical_data_service import HistoricalDataService
from app.services.cache import cache_service
from app.api.v1.endpoints.prediction_schemas import (
    PredictionTimeSeriesRequest,
    PredictionSpatialRequest,
    AiSummaryRequest,
)
from app.api.v1.endpoints.historical_utils import orjson_response
from app.services.tiered_storage import _parse_meta

router = APIRouter()
logger = logging.getLogger("prediction")

# Servicios singleton
_historical_service = HistoricalDataService(cache_service=cache_service)
_prediction_service = PredictionDataService(
    historical_service=_historical_service,
    cache_service=cache_service,
)


def _resolve_prediction_cloud_key(file_id: int, db) -> str:
    """Resuelve file_id a cloud_key para archivo de prediccion (active o archived)."""
    cached = cache_service.get(f"pred_cloud_key:{file_id}")
    if cached:
        return cached

    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status.in_(["active", "archived"]),
    ).first()

    if not file or not file.cloud_key:
        return None

    cache_service.set(f"pred_cloud_key:{file_id}", file.cloud_key, expire=3600)
    return file.cloud_key


# ============================================================================
# HISTORICO DE PREDICCIONES: listar archivos con fecha de emision
# ============================================================================

@router.get("/history/list", response_class=JSONResponse)
def list_prediction_history(
    db: Session = Depends(get_db),
):
    """
    Lista todas las predicciones disponibles (activas + archivadas)
    con su fecha de emision (issued_at).
    Usado para el selector de historico de predicciones en el frontend.
    """
    logger.info("GET /prediction/history/list")

    files = db.query(ParquetFile).filter(
        ParquetFile.status.in_(["active", "archived"]),
    ).all()

    predictions = []
    for f in files:
        meta = {}
        if f.file_metadata:
            try:
                meta = json.loads(f.file_metadata)
            except (json.JSONDecodeError, TypeError):
                pass

        if meta.get("dataset_key") != "prediction_main":
            continue

        issued_at = meta.get("issued_at")
        if not issued_at:
            # Fallback: use year_month or activated_at or created_at
            issued_at = meta.get("year_month") or meta.get("activated_at")
            if not issued_at and f.created_at:
                issued_at = f.created_at.strftime("%Y-%m-%d")

        predictions.append({
            "file_id": f.id,
            "filename": f.original_filename or f.filename,
            "status": f.status,
            "issued_at": issued_at,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "is_current": f.status == "active",
        })

    # Sort by issued_at descending (most recent first)
    predictions.sort(
        key=lambda p: p["issued_at"] or "",
        reverse=True,
    )

    return orjson_response({
        "total": len(predictions),
        "predictions": predictions,
    })


# ============================================================================
# CELDAS UNICAS DEL PARQUET DE PREDICCION (297 celdas CHIRPS)
# ============================================================================

@router.get("/cells/{file_id}", response_class=JSONResponse)
def prediction_cells(
    file_id: int,
    db: Session = Depends(get_db),
):
    """
    Retorna las celdas unicas del parquet de prediccion.
    Usado para renderizar las 297 celdas CHIRPS en el mapa.
    """
    logger.info("GET /prediction/cells/%s", file_id)

    cloud_key = _resolve_prediction_cloud_key(file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de prediccion no encontrado o sin cloud_key",
        )

    try:
        result = _prediction_service.query_cells(parquet_url=cloud_key)
        return orjson_response(result)
    except Exception as e:
        logger.error("Error obteniendo celdas de prediccion: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo celdas: {str(e)}",
        )


# ============================================================================
# SERIE TEMPORAL 1D (por celda)
# ============================================================================

@router.post("/timeseries", response_class=JSONResponse)
def prediction_timeseries(
    request: PredictionTimeSeriesRequest,
    db: Session = Depends(get_db),
):
    """
    Obtiene la serie de prediccion (12 horizontes) para una celda,
    incluyendo value, q1, q3, iqr_min, iqr_max.
    """
    logger.info(
        "POST /prediction/timeseries - file=%s cell=%s var=%s scale=%s",
        request.parquet_file_id, request.cell_id, request.var, request.scale,
    )

    cloud_key = _resolve_prediction_cloud_key(request.parquet_file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de prediccion no encontrado o sin cloud_key",
        )

    try:
        result = _prediction_service.query_timeseries(
            parquet_url=cloud_key,
            cell_id=request.cell_id,
            var=request.var,
            scale=request.scale,
        )
        return orjson_response(result)
    except Exception as e:
        logger.error("Error en prediction timeseries: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando prediccion: {str(e)}",
        )


# ============================================================================
# DATOS ESPACIALES 2D (grid 297 celdas)
# ============================================================================

@router.post("/spatial", response_class=JSONResponse)
def prediction_spatial(
    request: PredictionSpatialRequest,
    db: Session = Depends(get_db),
):
    """
    Obtiene datos espaciales de prediccion para un indice, escala y horizonte.
    Retorna ~297 celdas con value, color y categoria de sequia.
    """
    logger.info(
        "POST /prediction/spatial - file=%s var=%s scale=%s horizon=%s",
        request.parquet_file_id, request.var, request.scale, request.horizon,
    )

    cloud_key = _resolve_prediction_cloud_key(request.parquet_file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de prediccion no encontrado o sin cloud_key",
        )

    try:
        result = _prediction_service.query_spatial(
            parquet_url=cloud_key,
            var=request.var,
            scale=request.scale,
            horizon=request.horizon,
        )
        return orjson_response(result)
    except Exception as e:
        logger.error("Error en prediction spatial: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando datos espaciales de prediccion: {str(e)}",
        )


# ============================================================================
# RESUMEN CON IA
# ============================================================================

@router.post("/ai-summary", response_class=JSONResponse)
def prediction_ai_summary(request: AiSummaryRequest):
    """
    Genera un resumen interpretativo de la prediccion usando IA (Groq Llama 3.1-8b).
    Soporta resumen temporal (1D) y espacial (2D).
    """
    logger.info("POST /prediction/ai-summary - type=%s index=%s", request.type, request.index)

    from app.services.ai_summary_service import generate_1d_summary, generate_2d_summary

    try:
        if request.type == "1d":
            if not request.values:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Se requiere 'values' para resumen tipo 1d",
                )
            summary = generate_1d_summary(
                index=request.index,
                scale=request.scale,
                values=request.values,
            )
        elif request.type == "2d":
            if not request.grid_summary:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Se requiere 'grid_summary' para resumen tipo 2d",
                )
            summary = generate_2d_summary(
                index=request.index,
                scale=request.scale,
                horizon=request.horizon or 1,
                grid_summary=request.grid_summary,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tipo debe ser '1d' o '2d'",
            )

        return orjson_response({"summary": summary})

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error en AI summary: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando resumen IA: {str(e)}",
        )
