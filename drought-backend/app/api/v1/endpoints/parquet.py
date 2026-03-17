"""
Parquet file upload and management endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
import os
from datetime import datetime
from app.db.session import get_db
from app.api.deps import get_current_admin_user
from app.models.user import User
from app.models.parquet_file import ParquetFile
from app.schemas.parquet import ParquetUploadResponse
from app.services.cloud_storage import cloud_storage
from app.services.parquet_processor import parquet_processor
from app.core.config import settings
import json
import ast


router = APIRouter()


def infer_resolution_from_filename(filename: str) -> tuple[str, float] | tuple[None, None]:
    """Infer grid resolution from known historical file naming conventions."""
    name = (filename or "").lower()
    if "chirps" in name:
        return "high", 0.05
    if "imerg" in name:
        return "medium", 0.10
    if "era5" in name:
        return "low", 0.25
    return None, None


def parse_file_metadata(raw_metadata: str | None) -> dict:
    """Parse metadata from DB supporting JSON and legacy python-dict strings."""
    if not raw_metadata:
        return {}

    try:
        parsed = json.loads(raw_metadata)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        # Backward compatibility: old sync stored metadata as str(dict)
        try:
            parsed = ast.literal_eval(raw_metadata)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, SyntaxError):
            return {}


@router.post("/upload", response_model=ParquetUploadResponse)
async def upload_parquet_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Upload a parquet file to cloud storage.
    
    This endpoint:
    1. Validates the file
    2. Uploads to cloud storage
    3. Extracts metadata
    4. Saves record to database
    """
    # Validate file extension
    if not file.filename.lower().endswith('.parquet'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .parquet files are allowed"
        )

    # Get file size without loading full content into memory.
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    
    # Check file size
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE} bytes"
        )
    
    # Validate parquet structure and extract metadata from parquet footer only.
    metadata = parquet_processor.get_parquet_metadata_from_fileobj(file.file)
    if metadata is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid parquet file format"
        )

    resolution_level, resolution = infer_resolution_from_filename(file.filename)
    if resolution is not None and metadata.get("resolution") is None:
        metadata["resolution"] = resolution
        metadata["resolution_level"] = resolution_level
        metadata["resolution_source"] = "filename_inference"
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{file.filename}"
    cloud_key = f"parquet/{unique_filename}"
    
    # Calculate hash and upload from stream (no full-copy in RAM)
    file_hash = cloud_storage.calculate_file_hash(file.file)
    file.file.seek(0)

    # Upload to cloud storage
    success, result = cloud_storage.upload_file(
        file.file,
        cloud_key,
        metadata={'original_name': file.filename}
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to cloud storage: {result}"
        )
    
    cloud_url = result
    
    # Save to database
    db_file = ParquetFile(
        filename=unique_filename,
        original_filename=file.filename,
        file_size=file_size,
        cloud_url=cloud_url,
        cloud_key=cloud_key,
        file_hash=file_hash,
        file_metadata=json.dumps(metadata) if metadata else None,
        status="active",
        uploaded_by=current_admin.id
    )
    
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    return {
        "success": True,
        "message": f"File {file.filename} uploaded successfully",
        "file": db_file
    }


@router.get("/download/{file_id}")
async def download_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get download URL for a parquet file.
    
    Returns a presigned URL for downloading the file.
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Generate presigned URL (valid for 1 hour)
    download_url = cloud_storage.get_file_url(file.cloud_key, expires_in=3600)
    
    if not download_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download URL"
        )
    
    return {
        "success": True,
        "download_url": download_url,
        "filename": file.original_filename,
        "expires_in": 3600
    }


@router.get("/metadata/{file_id}")
async def get_parquet_metadata(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get metadata of a parquet file.
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    metadata = parse_file_metadata(file.file_metadata)
    
    return {
        "success": True,
        "file_id": file.id,
        "filename": file.original_filename,
        "metadata": metadata
    }
