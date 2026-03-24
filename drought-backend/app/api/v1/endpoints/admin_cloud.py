"""
Admin endpoints: Cloud file management (register-external, cloud/list, cloud/sync).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from datetime import datetime
from urllib.parse import urlparse
import json

from app.db.session import get_db
from app.api.deps import get_current_admin_user
from app.models.user import User
from app.models.parquet_file import ParquetFile
from app.schemas.parquet import ParquetFile as ParquetFileSchema
from app.core.config import settings
from app.api.v1.endpoints.admin_schemas import (
    ExternalParquetFileCreate,
    CloudFileListResponse,
    SyncCloudFilesResponse,
)
from app.api.v1.endpoints.admin_utils import (
    cloud_service,
    detect_resolution_from_filename,
)


router = APIRouter()


@router.post("/files/register-external", response_model=ParquetFileSchema)
def register_external_parquet_file(
    file_data: ExternalParquetFileCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Registra un archivo parquet que ya esta en Cloudflare R2.

    Auto-detecta resolucion basandose en el nombre del archivo:
    - grid_ERA5.parquet -> Baja resolucion (0.25°)
    - grid_IMERG.parquet -> Media resolucion (0.10°)
    - grid_CHIRPS.parquet -> Alta resolucion (mejor, mas pesado)

    Args:
        file_data: Informacion del archivo a registrar

    Returns:
        Archivo parquet registrado con metadata enriquecida
    """
    # Extraer cloud_key desde URL
    try:
        parsed = urlparse(file_data.cloud_url)
        path_parts = parsed.path.strip('/').split('/', 1)
        cloud_key = path_parts[1] if len(path_parts) > 1 else path_parts[0]
    except Exception:
        # Si falla el parsing, usar filename como cloud_key
        cloud_key = f"parquet/{file_data.filename}"

    # Verificar si ya existe
    existing = db.query(ParquetFile).filter(
        (ParquetFile.cloud_url == file_data.cloud_url) |
        (ParquetFile.cloud_key == cloud_key)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un archivo con esta URL o clave (ID: {existing.id})"
        )

    # Auto-detectar resolucion desde filename
    level_name, resolution = detect_resolution_from_filename(file_data.filename)

    # Intentar obtener metadata desde Cloudflare
    file_size = 0
    last_modified = datetime.utcnow()

    try:
        cloud_files = cloud_service.list_files(prefix=cloud_key.rsplit('/', 1)[0] if '/' in cloud_key else '')
        for cf in cloud_files:
            if cf['key'] == cloud_key:
                file_size = cf['size']
                last_modified = cf['last_modified']
                break
    except Exception as e:
        print(f"Warning: Could not fetch cloud metadata: {e}")

    # Preparar metadata enriquecida
    enriched_metadata = file_data.metadata or {}
    enriched_metadata.update({
        "resolution": resolution,
        "resolution_level": level_name,
        "resolution_degrees": resolution,
        "auto_detected": True,
        "last_modified_cloud": last_modified.isoformat() if isinstance(last_modified, datetime) else str(last_modified)
    })

    # Crear entrada en base de datos
    new_file = ParquetFile(
        filename=file_data.filename,
        original_filename=file_data.filename,
        file_size=file_size,
        cloud_url=file_data.cloud_url,
        cloud_key=cloud_key,
        file_hash=None,
        file_metadata=json.dumps(enriched_metadata),
        status="active",
        uploaded_by=current_admin.id
    )

    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return new_file


@router.get("/files/cloud/list", response_model=CloudFileListResponse)
def list_cloudflare_files(
    prefix: str = "parquet/",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Lista todos los archivos .parquet en Cloudflare R2.

    Util para ver que archivos tienes en la nube y cuales estan registrados en la DB.

    Args:
        prefix: Prefijo para filtrar (por defecto "parquet/")

    Returns:
        Lista de archivos con su estado de registro
    """
    try:
        # Listar archivos desde Cloudflare
        cloud_files = cloud_service.list_files(prefix=prefix)

        # Filtrar solo .parquet
        parquet_files = [
            f for f in cloud_files
            if f['key'].endswith('.parquet')
        ]

        # Obtener archivos ya registrados en DB
        registered_files = db.query(ParquetFile).all()
        registered_urls = {f.cloud_url for f in registered_files}
        registered_keys = {f.cloud_key for f in registered_files if f.cloud_key}

        # Mapear archivos registrados por cloud_key
        file_map = {
            f.cloud_key: f for f in registered_files if f.cloud_key
        }

        # Preparar respuesta
        result_files = []

        for cloud_file in parquet_files:
            key = cloud_file['key']
            filename = key.split('/')[-1]
            size_mb = cloud_file['size'] / (1024 * 1024)

            # URL publica
            cloud_url = f"{settings.CLOUD_STORAGE_ENDPOINT}/{settings.CLOUD_STORAGE_BUCKET}/{key}"

            # Verificar si esta registrado
            is_registered = key in registered_keys or cloud_url in registered_urls
            db_file = file_map.get(key)

            result_files.append({
                "key": key,
                "filename": filename,
                "size_mb": round(size_mb, 2),
                "last_modified": cloud_file['last_modified'],
                "cloud_url": cloud_url,
                "registered": is_registered,
                "file_id": db_file.id if db_file else None
            })

        return {
            "total": len(result_files),
            "files": result_files,
            "bucket": settings.CLOUD_STORAGE_BUCKET
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listando archivos de Cloudflare: {str(e)}"
        )


@router.post("/files/cloud/sync", response_model=SyncCloudFilesResponse)
def sync_cloudflare_files(
    prefix: str = "parquet/",
    auto_activate: bool = True,
    bidirectional: bool = True,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Sincronizacion BIDIRECCIONAL entre Cloudflare R2 y base de datos.

    Este endpoint:
    1. Lista todos los archivos .parquet en Cloudflare
    2. Registra archivos nuevos de Cloudflare que no estan en BD (con auto-deteccion de resolucion)
    3. Si bidirectional=True: Elimina de BD archivos que ya NO existen en Cloudflare
    4. Auto-detecta resolucion: ERA5 (0.25°), IMERG (0.10°), CHIRPS (alta res)

    Args:
        prefix: Prefijo para filtrar archivos (default: "parquet/")
        auto_activate: Si True, marca los archivos nuevos como activos
        bidirectional: Si True, elimina de BD archivos que no estan en Cloudflare

    Returns:
        Resumen de sincronizacion
    """
    try:
        # Listar archivos en Cloudflare
        cloud_files = cloud_service.list_files(prefix=prefix)
        parquet_files = [
            f for f in cloud_files
            if f['key'].endswith('.parquet')
        ]

        # Crear set de cloud_keys existentes en Cloudflare
        cloud_keys_set = {f['key'] for f in parquet_files}

        # Obtener archivos ya registrados en BD
        registered_files = db.query(ParquetFile).all()

        # Contadores
        registered_count = 0
        skipped_count = 0
        deleted_count = 0
        error_count = 0
        results = []

        # PASO 1: Registrar archivos nuevos de Cloudflare -> BD
        registered_keys = {f.cloud_key for f in registered_files if f.cloud_key}

        for cloud_file in parquet_files:
            key = cloud_file['key']
            filename = key.split('/')[-1]
            size_bytes = cloud_file['size']
            size_mb = size_bytes / (1024 * 1024)
            cloud_url = f"{settings.CLOUD_STORAGE_ENDPOINT}/{settings.CLOUD_STORAGE_BUCKET}/{key}"

            # Verificar si ya esta registrado
            if key in registered_keys:
                skipped_count += 1
                results.append({
                    "filename": filename,
                    "action": "skipped",
                    "reason": "Ya existe en BD"
                })
                continue

            # Registrar archivo nuevo con auto-deteccion de resolucion
            try:
                level_name, resolution = detect_resolution_from_filename(filename)

                metadata = {
                    "source": "cloudflare_sync",
                    "last_modified_cloud": cloud_file['last_modified'].isoformat(),
                    "size_bytes": size_bytes,
                    "resolution": resolution,
                    "resolution_level": level_name,
                    "resolution_degrees": resolution,
                    "auto_detected": True
                }

                new_file = ParquetFile(
                    filename=filename,
                    original_filename=filename,
                    file_size=size_bytes,
                    cloud_url=cloud_url,
                    cloud_key=key,
                    file_hash=cloud_file.get('etag', '').strip('\"'),
                    file_metadata=json.dumps(metadata),
                    status="active" if auto_activate else "pending",
                    uploaded_by=current_admin.id
                )

                db.add(new_file)
                db.commit()
                db.refresh(new_file)

                registered_count += 1
                results.append({
                    "filename": filename,
                    "action": "registered",
                    "file_id": new_file.id,
                    "resolution": f"{level_name} ({resolution}°)",
                    "size_mb": round(size_mb, 2)
                })

            except Exception as e:
                error_count += 1
                results.append({
                    "filename": filename,
                    "action": "error",
                    "reason": str(e)
                })

        # PASO 2: Si bidirectional, eliminar de BD archivos que NO estan en Cloudflare
        if bidirectional:
            for db_file in registered_files:
                # Si el archivo de BD no tiene cloud_key, skip
                if not db_file.cloud_key:
                    continue

                # Si el cloud_key de BD NO esta en Cloudflare, eliminarlo de BD
                if db_file.cloud_key not in cloud_keys_set:
                    try:
                        filename = db_file.filename
                        file_id = db_file.id

                        db.delete(db_file)
                        db.commit()

                        deleted_count += 1
                        results.append({
                            "filename": filename,
                            "action": "deleted_from_db",
                            "file_id": file_id,
                            "reason": "No existe en Cloudflare"
                        })
                    except Exception as e:
                        error_count += 1
                        results.append({
                            "filename": db_file.filename,
                            "action": "error_deleting",
                            "reason": str(e)
                        })

        return {
            "success": True,
            "registered": registered_count,
            "skipped": skipped_count,
            "deleted_from_db": deleted_count,
            "errors": error_count,
            "files": results
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sincronizando archivos: {str(e)}"
        )
