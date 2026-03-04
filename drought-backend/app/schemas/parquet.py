"""
Parquet file schemas for API validation.
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class ParquetFileBase(BaseModel):
    """Base parquet file schema."""
    filename: str
    original_filename: str


class ParquetFileCreate(ParquetFileBase):
    """Schema for creating a parquet file record."""
    file_size: int
    cloud_url: str
    cloud_key: str
    file_hash: Optional[str] = None
    file_metadata: Optional[str] = None
    uploaded_by: Optional[int] = None


class ParquetFileUpdate(BaseModel):
    """Schema for updating a parquet file record."""
    status: Optional[str] = None
    file_metadata: Optional[str] = None


class ParquetFile(ParquetFileBase):
    """Parquet file schema for API responses."""
    id: int
    file_size: int
    cloud_url: str
    cloud_key: str
    file_hash: Optional[str] = None
    status: str
    uploaded_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ParquetFileList(BaseModel):
    """Schema for listing parquet files."""
    total: int
    files: list[ParquetFile]


class ParquetUploadResponse(BaseModel):
    """Response after uploading a parquet file."""
    success: bool
    message: str
    file: Optional[ParquetFile] = None
