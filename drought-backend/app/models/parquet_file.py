"""
ParquetFile model for tracking uploaded files.
"""
from sqlalchemy import Column, Integer, String, DateTime, BigInteger, Text
from sqlalchemy.sql import func
from app.db.session import Base


class ParquetFile(Base):
    """Model to track uploaded parquet files."""
    
    __tablename__ = "parquet_files"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(BigInteger, nullable=False)  # in bytes
    cloud_url = Column(String, nullable=False)  # URL in cloud storage
    cloud_key = Column(String, nullable=False)  # Key/path in cloud storage
    file_hash = Column(String, nullable=True)  # MD5 or SHA256 hash
    file_metadata = Column(Text, nullable=True)  # JSON string with file metadata
    status = Column(String, default="active")  # active, archived, deleted
    uploaded_by = Column(Integer, nullable=True)  # User ID who uploaded
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
