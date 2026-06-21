"""
Endpoints para prediccion de sequia.
Consulta datos del parquet prediction_main via DuckDB.
"""
import json
import logging
from datetime import date
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
    PredictionWatershedSpatialRequest,
    PredictionWatershedTimeSeriesRequest,
)
from app.api.v1.endpoints.historical_utils import orjson_response
from app.services.tiered_storage import _parse_meta, get_active_cloud_keys_for_dataset, encode_multi_keys

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


def _is_current_prediction_file(file_id: int, db: Session) -> bool:
    """True si corresponde al archivo activo de prediction_main."""
    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status.in_(["active", "archived"]),
    ).first()
    if not file or file.status != "active":
        return False

    meta = _parse_meta(file.file_metadata)
    return str(meta.get("dataset_key") or "").lower() == "prediction_main"


def _resolve_historical_cloud_key_for_prediction(file_id: int, db) -> str:
    """
    Resuelve cloud_key(s) del dataset historico compatible con la prediccion.

    Prioridad de fuente:
    - metadata.data_source o metadata.source del archivo de prediccion
    - fallback CHIRPS
    """
    cache_key = f"pred_hist_cloud_key:v2:{file_id}"
    cached = cache_service.get(cache_key)
    if cached:
        return cached

    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        or_(ParquetFile.status.in_(["active", "archived"]), ParquetFile.status.is_(None)),
    ).first()

    if not file:
        return None

    _ = _parse_meta(file.file_metadata)
    # Regla de negocio: la prediccion sale del parquet prediction_main,
    # pero la climatologia para anomalia siempre se toma de CHIRPS historico.
    source = "CHIRPS"
    dataset_key = "historical_chirps"

    def _infer_source_for_candidate(candidate: ParquetFile, candidate_meta: dict) -> str:
        """Infer source for legacy files where metadata is incomplete."""
        direct = str(candidate_meta.get("data_source") or candidate_meta.get("source") or "").upper()
        if direct in {"CHIRPS", "IMERG", "ERA5"}:
            return direct

        hints = " ".join([
            str(candidate_meta.get("dataset_key") or ""),
            str(candidate.filename or ""),
            str(candidate.original_filename or ""),
            str(candidate.cloud_key or ""),
        ]).upper()

        if "CHIRPS" in hints:
            return "CHIRPS"
        if "IMERG" in hints:
            return "IMERG"
        if "ERA5" in hints:
            return "ERA5"
        return ""

    keys = get_active_cloud_keys_for_dataset(dataset_key, db)
    if not keys:
        # Fallback: buscar archivos historicos activos/archivados por metadata,
        # para instalaciones antiguas donde no existe dataset_key estandarizado.
        candidates = db.query(ParquetFile).filter(
            or_(ParquetFile.status.in_(["active", "archived"]), ParquetFile.status.is_(None)),
            ParquetFile.cloud_key.isnot(None),
            ParquetFile.id != file_id,
        ).all()

        fallback_keys = []
        for candidate in candidates:
            cmeta = _parse_meta(candidate.file_metadata)
            c_dataset = str(cmeta.get("dataset_key") or "").lower()
            c_source = _infer_source_for_candidate(candidate, cmeta)
            c_fingerprint = " ".join([
                c_dataset,
                str(candidate.filename or ""),
                str(candidate.original_filename or ""),
                str(candidate.cloud_key or ""),
            ]).upper()

            # Excluir datasets de prediccion y priorizar coincidencia de fuente.
            if "PREDICTION" in c_fingerprint:
                continue
            if "HYDRO" in c_fingerprint:
                continue
            if c_source and c_source != source:
                continue

            # Priorizacion estricta por fuente esperada.
            if source == "CHIRPS" and "CHIRPS" not in c_fingerprint:
                continue
            if source == "IMERG" and "IMERG" not in c_fingerprint:
                continue
            if source == "ERA5" and "ERA5" not in c_fingerprint:
                continue

            fallback_keys.append(candidate.cloud_key)

        keys = fallback_keys

    if not keys:
        return None

    result = encode_multi_keys(keys) if len(keys) > 1 else keys[0]
    cache_service.set(cache_key, result, expire=3600)
    return result


def _resolve_prediction_issued_at(file_id: int, db) -> date | None:
    """Resuelve la fecha de emision del archivo de prediccion desde metadata o fallback."""
    file = db.query(ParquetFile).filter(
        ParquetFile.id == file_id,
        ParquetFile.status.in_(["active", "archived"]),
    ).first()

    if not file:
        return None

    meta = _parse_meta(file.file_metadata)
    issued_at = meta.get("issued_at") or meta.get("activated_at") or meta.get("year_month")
    if not issued_at and file.created_at:
        issued_at = file.created_at.strftime("%Y-%m-%d")

    if not issued_at:
        return None

    issued_str = str(issued_at).strip()
    try:
        if len(issued_str) == 7 and issued_str.count("-") == 1:
            year, month = issued_str.split("-")
            return date(int(year), int(month), 1)
        return date.fromisoformat(issued_str[:10])
    except ValueError:
        return None


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

    issued_at = _resolve_prediction_issued_at(request.parquet_file_id, db)

    try:
        result = _prediction_service.query_timeseries(
            parquet_url=cloud_key,
            cell_id=request.cell_id,
            var=request.var,
            scale=request.scale,
            base_date=issued_at,
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
        "POST /prediction/spatial - file=%s var=%s scale=%s horizon=%s include_anomaly=%s map_metric=%s clim=%s-%s",
        request.parquet_file_id,
        request.var,
        request.scale,
        request.horizon,
        request.include_anomaly,
        request.map_metric,
        request.clim_start_year,
        request.clim_end_year,
    )

    cloud_key = _resolve_prediction_cloud_key(request.parquet_file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de prediccion no encontrado o sin cloud_key",
        )

    issued_at = _resolve_prediction_issued_at(request.parquet_file_id, db)

    try:
        historical_cloud_key = _resolve_historical_cloud_key_for_prediction(
            request.parquet_file_id,
            db,
        )

        # Compatibilidad: si la variable es SPI, intentar incluir anomalia
        # aunque el frontend no envie include_anomaly explicitamente.
        effective_include_anomaly = request.include_anomaly or str(request.var).upper() == "SPI"

        result = _prediction_service.query_spatial(
            parquet_url=cloud_key,
            var=request.var,
            scale=request.scale,
            horizon=request.horizon,
            include_anomaly=effective_include_anomaly,
            map_metric=request.map_metric,
            clim_start_year=request.clim_start_year,
            clim_end_year=request.clim_end_year,
            historical_parquet_url=historical_cloud_key,
            align_to_consultation_month=_is_current_prediction_file(request.parquet_file_id, db),
            consultation_date=issued_at,
        )
        return orjson_response(result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Error en prediction spatial: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando datos espaciales de prediccion: {str(e)}",
        )


# ============================================================================
# DATOS ESPACIALES POR CUENCA (7 cuencas, ponderado por area)
# ============================================================================

@router.post("/watershed/spatial", response_class=JSONResponse)
def prediction_watershed_spatial(
    request: PredictionWatershedSpatialRequest,
    db: Session = Depends(get_db),
):
    """
    Obtiene datos espaciales de prediccion agregados por cuenca (7 cuencas).
    Promedio ponderado por area de interseccion celda-cuenca.
    """
    logger.info(
        "POST /prediction/watershed/spatial - file=%s var=%s scale=%s horizon=%s",
        request.parquet_file_id, request.var, request.scale, request.horizon,
    )

    cloud_key = _resolve_prediction_cloud_key(request.parquet_file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de prediccion no encontrado o sin cloud_key",
        )

    if request.zone_type not in ("cuenca", "municipio", "perimetro"):
        raise HTTPException(status_code=400, detail="zone_type debe ser cuenca, municipio o perimetro")

    try:
        result = _prediction_service.query_watershed_spatial(
            parquet_url=cloud_key,
            var=request.var,
            scale=request.scale,
            horizon=request.horizon,
            zone_type=request.zone_type,
        )
        return orjson_response(result)
    except Exception as e:
        logger.error("Error en prediction watershed spatial: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando datos de cuenca: {str(e)}",
        )


# ============================================================================
# SERIE TEMPORAL POR CUENCA (12 horizontes, ponderado por area)
# ============================================================================

@router.post("/watershed/timeseries", response_class=JSONResponse)
def prediction_watershed_timeseries(
    request: PredictionWatershedTimeSeriesRequest,
    db: Session = Depends(get_db),
):
    """
    Obtiene serie de prediccion (12 horizontes) para una cuenca,
    promedio ponderado por area de interseccion.
    """
    logger.info(
        "POST /prediction/watershed/timeseries - file=%s var=%s scale=%s dn=%s",
        request.parquet_file_id, request.var, request.scale, request.cuenca_dn,
    )

    cloud_key = _resolve_prediction_cloud_key(request.parquet_file_id, db)
    if not cloud_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de prediccion no encontrado o sin cloud_key",
        )

    if request.zone_type not in ("cuenca", "municipio", "perimetro"):
        raise HTTPException(status_code=400, detail="zone_type debe ser cuenca, municipio o perimetro")

    issued_at = _resolve_prediction_issued_at(request.parquet_file_id, db)

    try:
        result = _prediction_service.query_watershed_timeseries(
            parquet_url=cloud_key,
            var=request.var,
            scale=request.scale,
            cuenca_dn=request.cuenca_dn,
            base_date=issued_at,
            zone_type=request.zone_type,
        )
        return orjson_response(result)
    except Exception as e:
        logger.error("Error en prediction watershed timeseries: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error consultando serie de cuenca: {str(e)}",
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
