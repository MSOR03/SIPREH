"""
Admin endpoints: Parquet file CRUD (list, get, delete, activate, download-url).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.api.deps import get_current_admin_user
from app.models.user import User
from app.models.parquet_file import ParquetFile
from app.schemas.parquet import ParquetFile as ParquetFileSchema, ParquetFileList
from app.api.v1.endpoints.admin_utils import (
    cloud_service,
    _parse_file_metadata,
    _save_file_metadata,
    _file_dataset_key,
    _archive_dataset_active_files,
)


router = APIRouter()


@router.get("/files", response_model=ParquetFileList)
def list_parquet_files(
    skip: int = 0,
    limit: int = 100,
    status_filter: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    List all parquet files (admin only).
    """
    query = db.query(ParquetFile)

    if status_filter:
        query = query.filter(ParquetFile.status == status_filter)

    total = query.count()
    files = query.order_by(ParquetFile.created_at.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "files": files
    }


@router.get("/files/{file_id}", response_model=ParquetFileSchema)
def get_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get details of a specific parquet file (admin only).
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    return file


@router.delete("/files/{file_id}")
def delete_parquet_file(
    file_id: int,
    delete_from_cloud: bool = True,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Delete a parquet file (admin only).

    Elimina el archivo de la base de datos y opcionalmente de Cloudflare.

    Args:
        file_id: ID del archivo a eliminar
        delete_from_cloud: Si True, tambien elimina de Cloudflare R2 (default: True)

    Returns:
        Resultado de la eliminacion
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    result = {
        "success": True,
        "message": f"File {file.filename} deleted from database",
        "deleted_from_cloud": False
    }

    # Eliminar de Cloudflare si se solicita
    if delete_from_cloud and file.cloud_key:
        try:
            cloud_deleted = cloud_service.delete_file(file.cloud_key)
            if cloud_deleted:
                result["deleted_from_cloud"] = True
                result["message"] += " and Cloudflare R2"
            else:
                result["message"] += " (Warning: could not delete from Cloudflare)"
        except Exception as e:
            result["message"] += f" (Error deleting from Cloudflare: {str(e)})"

    # Eliminar de base de datos
    db.delete(file)
    db.commit()

    return result


@router.post("/files/{file_id}/activate")
def activate_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Activate a parquet file for use in the dashboard.

    This makes the file the active data source.
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    dataset_key = _file_dataset_key(file)
    archived_count = 0
    if dataset_key:
        archived_count = _archive_dataset_active_files(db, dataset_key, exclude_file_id=file.id)

        meta = _parse_file_metadata(file.file_metadata)
        meta["active_for_queries"] = True
        meta["activated_at"] = datetime.utcnow().isoformat()
        _save_file_metadata(file, meta)

    file.status = "active"
    db.commit()

    return {
        "success": True,
        "message": f"File {file.filename} is now active",
        "dataset_key": dataset_key,
        "archived_previous_active": archived_count,
    }


@router.get("/files/{file_id}/download-url")
def get_file_download_url(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """Generate a presigned download URL for a parquet file."""
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found",
        )
    if not file.cloud_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no tiene cloud_key asignado.",
        )
    url = cloud_service.get_file_url(file.cloud_key, expires_in=3600)
    if not url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo generar la URL de descarga.",
        )
    return {
        "download_url": url,
        "filename": file.original_filename or file.filename,
        "expires_in": 3600,
    }
