"""
Enhanced dashboard endpoints with optimizations for large datasets.
Includes caching, pagination, and geospatial data support.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.services.cloud_storage import cloud_storage
from app.services.parquet_processor import parquet_processor
from app.services.cache import cache_service
from app.services.geo_processor import geo_processor
from app.services.aggregator import data_aggregator


router = APIRouter()


@router.get("/data")
async def get_dashboard_data(
    start_date: Optional[str] = Query(None, description="Start date filter (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date filter (ISO format)"),
    region_ids: Optional[List[str]] = Query(None, description="Region IDs to filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=10000, description="Items per page"),
    aggregation: Optional[str] = Query(None, description="Aggregation level: daily, regional, grid"),
    db: Session = Depends(get_db)
):
    """
    Get processed drought data with pagination and caching.
    
    **Optimizations for large datasets:**
    - Cache results for 15 minutes
    - Pagination support
    - Pre-aggregated data options
    - Efficient filtering
    """
    # Generate cache key
    cache_key = cache_service._generate_key(
        "dashboard_data",
        start_date=start_date,
        end_date=end_date,
        region_ids=region_ids,
        page=page,
        page_size=page_size,
        aggregation=aggregation
    )
    
    # Check cache
    cached_result = cache_service.get(cache_key)
    if cached_result:
        return cached_result
    
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
    
    # Download file from cloud storage (this is cached internally)
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
    
    # Apply filters BEFORE loading all data
    if start_date and 'date' in df.columns:
        df = df[df['date'] >= start_date]
    if end_date and 'date' in df.columns:
        df = df[df['date'] <= end_date]
    if region_ids and 'region_id' in df.columns:
        df = df[df['region_id'].isin(region_ids)]
    
    # Apply aggregation if requested (much smaller dataset)
    if aggregation:
        aggregations = data_aggregator.create_aggregations(df)
        if aggregation in aggregations:
            df = aggregations[aggregation]
    
    # Calculate pagination
    total_records = len(df)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    
    # Apply pagination
    df_page = df.iloc[start_idx:end_idx]
    
    # Convert to records (only the page data)
    data = parquet_processor.extract_dashboard_data(df_page, {})
    
    result = {
        "success": True,
        "data": data,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_records": total_records,
            "total_pages": (total_records + page_size - 1) // page_size,
            "has_next": end_idx < total_records,
            "has_previous": page > 1
        },
        "metadata": {
            "source_file": latest_file.original_filename,
            "last_updated": latest_file.created_at,
            "filters_applied": {
                "start_date": start_date,
                "end_date": end_date,
                "region_ids": region_ids,
                "aggregation": aggregation
            }
        }
    }
    
    # Cache for 15 minutes
    cache_service.set(cache_key, result, expire=900)
    
    return result


@router.get("/geo/geojson")
async def get_geojson_data(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    region_ids: Optional[List[str]] = Query(None),
    max_features: int = Query(5000, le=50000, description="Max features to return"),
    simplify: bool = Query(True, description="Simplify geometries"),
    db: Session = Depends(get_db)
):
    """
    Get data as GeoJSON for Leaflet visualization.
    
    **Optimized for Leaflet:**
    - Returns standard GeoJSON format
    - Limits features for performance
    - Optional geometry simplification
    - Cached for 15 minutes
    """
    # Generate cache key
    cache_key = cache_service._generate_key(
        "geo_geojson",
        start_date=start_date,
        end_date=end_date,
        region_ids=region_ids,
        max_features=max_features
    )
    
    cached_result = cache_service.get(cache_key)
    if cached_result:
        return cached_result
    
    # Get latest file
    latest_file = db.query(ParquetFile)\
        .filter(ParquetFile.status == "active")\
        .order_by(ParquetFile.created_at.desc())\
        .first()
    
    if not latest_file:
        raise HTTPException(status_code=404, detail="No data available")
    
    file_data = cloud_storage.download_file(latest_file.cloud_key)
    df = parquet_processor.read_parquet(file_data)
    
    # Apply filters
    if start_date and 'date' in df.columns:
        df = df[df['date'] >= start_date]
    if end_date and 'date' in df.columns:
        df = df[df['date'] <= end_date]
    if region_ids and 'region_id' in df.columns:
        df = df[df['region_id'].isin(region_ids)]
    
    # Sample if too many features
    if len(df) > max_features:
        df = data_aggregator.sample_data(df, method='spatial', n=max_features)
    
    # Create GeoJSON
    geojson = geo_processor.create_geojson_features(df)
    
    result = {
        "success": True,
        "geojson": geojson,
        "metadata": {
            "feature_count": len(geojson['features']),
            "total_before_sampling": len(df),
            "source_file": latest_file.original_filename
        }
    }
    
    cache_service.set(cache_key, result, expire=900)
    return result


@router.get("/geo/clusters")
async def get_clustered_data(
    grid_size: float = Query(0.1, description="Grid size in degrees"),
    value_col: Optional[str] = Query(None, description="Column to aggregate"),
    db: Session = Depends(get_db)
):
    """
    Get clustered/aggregated points for efficient map rendering.
    
    **For 45M records:**
    - Aggregates data into spatial grid
    - Returns ~1000-10000 clusters instead of millions of points
    - Perfect for initial map load
    - Cached for 1 hour
    """
    cache_key = cache_service._generate_key(
        "geo_clusters",
        grid_size=grid_size,
        value_col=value_col
    )
    
    cached_result = cache_service.get(cache_key)
    if cached_result:
        return cached_result
    
    latest_file = db.query(ParquetFile)\
        .filter(ParquetFile.status == "active")\
        .order_by(ParquetFile.created_at.desc())\
        .first()
    
    if not latest_file:
        raise HTTPException(status_code=404, detail="No data available")
    
    file_data = cloud_storage.download_file(latest_file.cloud_key)
    df = parquet_processor.read_parquet(file_data)
    
    # Create clusters
    clusters = geo_processor.create_clustered_points(
        df,
        lat_col='latitude',
        lon_col='longitude',
        value_col=value_col,
        grid_size=grid_size
    )
    
    result = {
        "success": True,
        "clusters": clusters,
        "metadata": {
            "cluster_count": len(clusters),
            "grid_size": grid_size,
            "source_records": len(df)
        }
    }
    
    # Cache for 1 hour
    cache_service.set(cache_key, result, expire=3600)
    return result


@router.get("/geo/heatmap")
async def get_heatmap_data(
    intensity_col: Optional[str] = Query(None, description="Intensity value column"),
    max_points: int = Query(10000, le=50000),
    db: Session = Depends(get_db)
):
    """
    Get heatmap data for Leaflet.heat plugin.
    
    **Optimized for heatmaps:**
    - Samples data intelligently
    - Returns format: [[lat, lon, intensity], ...]
    - Cached for 30 minutes
    """
    cache_key = cache_service._generate_key(
        "geo_heatmap",
        intensity_col=intensity_col,
        max_points=max_points
    )
    
    cached_result = cache_service.get(cache_key)
    if cached_result:
        return cached_result
    
    latest_file = db.query(ParquetFile)\
        .filter(ParquetFile.status == "active")\
        .order_by(ParquetFile.created_at.desc())\
        .first()
    
    if not latest_file:
        raise HTTPException(status_code=404, detail="No data available")
    
    file_data = cloud_storage.download_file(latest_file.cloud_key)
    df = parquet_processor.read_parquet(file_data)
    
    # Create heatmap data
    heatmap_data = geo_processor.create_heatmap_data(
        df,
        intensity_col=intensity_col,
        max_points=max_points
    )
    
    result = {
        "success": True,
        "heatmap": heatmap_data,
        "metadata": {
            "points": len(heatmap_data),
            "source_records": len(df),
            "intensity_column": intensity_col
        }
    }
    
    cache_service.set(cache_key, result, expire=1800)
    return result


@router.get("/geo/bounds")
async def get_map_bounds(db: Session = Depends(get_db)):
    """
    Get geographic bounds for map initialization.
    
    Returns bounding box and center coordinates.
    """
    cache_key = "geo_bounds"
    cached_result = cache_service.get(cache_key)
    if cached_result:
        return cached_result
    
    latest_file = db.query(ParquetFile)\
        .filter(ParquetFile.status == "active")\
        .order_by(ParquetFile.created_at.desc())\
        .first()
    
    if not latest_file:
        raise HTTPException(status_code=404, detail="No data available")
    
    file_data = cloud_storage.download_file(latest_file.cloud_key)
    df = parquet_processor.read_parquet(file_data)
    
    bounds = geo_processor.get_bbox(df)
    
    result = {
        "success": True,
        "bounds": bounds
    }
    
    # Cache for 1 hour
    cache_service.set(cache_key, result, expire=3600)
    return result


@router.get("/summary")
async def get_data_summary(db: Session = Depends(get_db)):
    """
    Get summary statistics of the dataset.
    
    **Fast overview:**
    - Aggregated statistics
    - No raw data transfer
    - Cached for 1 hour
    """
    cache_key = "dashboard_summary"
    cached_result = cache_service.get(cache_key)
    if cached_result:
        return cached_result
    
    latest_file = db.query(ParquetFile)\
        .filter(ParquetFile.status == "active")\
        .order_by(ParquetFile.created_at.desc())\
        .first()
    
    if not latest_file:
        raise HTTPException(status_code=404, detail="No data available")
    
    file_data = cloud_storage.download_file(latest_file.cloud_key)
    df = parquet_processor.read_parquet(file_data)
    
    summary = data_aggregator.create_summary_statistics(df)
    
    result = {
        "success": True,
        "summary": summary,
        "metadata": {
            "source_file": latest_file.original_filename,
            "last_updated": latest_file.created_at
        }
    }
    
    cache_service.set(cache_key, result, expire=3600)
    return result


@router.post("/clear-cache")
async def clear_dashboard_cache(db: Session = Depends(get_db)):
    """
    Clear dashboard cache (admin use).
    
    Useful after uploading new data.
    """
    count = cache_service.clear_pattern("dashboard*")
    count += cache_service.clear_pattern("geo*")
    
    return {
        "success": True,
        "message": f"Cleared {count} cached entries"
    }


@router.get("/health")
async def health_check():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "dashboard",
        "cache": "enabled" if cache_service.redis_client else "memory-only"
    }
