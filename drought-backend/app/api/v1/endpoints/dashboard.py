"""
Dashboard endpoints for public data access.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.services.cloud_storage import cloud_storage
from app.services.parquet_processor import parquet_processor
from app.schemas.dashboard import DashboardDataResponse, FilterParams


router = APIRouter()


@router.get("/data")
async def get_dashboard_data(
    start_date: Optional[str] = Query(None, description="Start date filter (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date filter (ISO format)"),
    region_ids: Optional[List[str]] = Query(None, description="Region IDs to filter"),
    db: Session = Depends(get_db)
):
    """
    Get processed drought data for dashboard display.
    
    This endpoint fetches the latest parquet data, processes it,
    and returns formatted data for the frontend dashboard.
    """
    # Get the most recent active parquet file
    latest_file = db.query(ParquetFile)\
        .filter(ParquetFile.status == "active")\
        .order_by(ParquetFile.created_at.desc())\
        .first()
    
    if not latest_file:
        raise HTTPException(
            status_code=404,
            detail="No data available. Please contact administrator."
        )
    
    # Download file from cloud storage
    file_data = cloud_storage.download_file(latest_file.cloud_key)
    if not file_data:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving data from cloud storage"
        )
    
    # Read parquet file
    df = parquet_processor.read_parquet(file_data)
    if df is None:
        raise HTTPException(
            status_code=500,
            detail="Error processing parquet data"
        )
    
    # Apply filters
    filters = {}
    if start_date:
        filters['start_date'] = start_date
    if end_date:
        filters['end_date'] = end_date
    if region_ids:
        filters['region_ids'] = region_ids
    
    # Extract and format data
    dashboard_data = parquet_processor.extract_dashboard_data(df, filters)
    
    return {
        "success": True,
        "data": dashboard_data,
        "metadata": {
            "total_records": len(dashboard_data),
            "source_file": latest_file.original_filename,
            "last_updated": latest_file.created_at
        }
    }


@router.get("/time-series")
async def get_time_series_data(
    region_id: Optional[str] = Query(None, description="Specific region ID"),
    db: Session = Depends(get_db)
):
    """
    Get time series data for drought monitoring.
    """
    # Get the most recent active parquet file
    latest_file = db.query(ParquetFile)\
        .filter(ParquetFile.status == "active")\
        .order_by(ParquetFile.created_at.desc())\
        .first()
    
    if not latest_file:
        raise HTTPException(
            status_code=404,
            detail="No data available"
        )
    
    # Download and process file
    file_data = cloud_storage.download_file(latest_file.cloud_key)
    if not file_data:
        raise HTTPException(
            status_code=500,
            detail="Error retrieving data"
        )
    
    df = parquet_processor.read_parquet(file_data)
    if df is None:
        raise HTTPException(
            status_code=500,
            detail="Error processing data"
        )
    
    # Extract time series
    time_series = parquet_processor.get_time_series(
        df,
        date_column='date',
        value_column='value',
        region_column='region_id' if region_id else None
    )
    
    return {
        "success": True,
        "time_series": time_series
    }


@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "dashboard"
    }
