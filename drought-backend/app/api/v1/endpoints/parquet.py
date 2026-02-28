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


router = APIRouter()


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
    if not file.filename.endswith('.parquet'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .parquet files are allowed"
        )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Check file size
    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE} bytes"
        )
    
    # Validate parquet structure
    df = parquet_processor.read_parquet(file_content)
    if df is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid parquet file format"
        )
    
    # Extract metadata
    metadata = parquet_processor.get_parquet_metadata(file_content)
    
    # Generate unique filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{file.filename}"
    cloud_key = f"parquet/{unique_filename}"
    
    # Calculate file hash
    from io import BytesIO
    file_hash = cloud_storage.calculate_file_hash(BytesIO(file_content))
    
    # Upload to cloud storage
    success, result = cloud_storage.upload_file(
        BytesIO(file_content),
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
        metadata=json.dumps(metadata) if metadata else None,
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
    
    metadata = json.loads(file.file_metadata) if file.file_metadata else {}
    
    return {
        "success": True,
        "file_id": file.id,
        "filename": file.original_filename,
        "metadata": metadata
    }
