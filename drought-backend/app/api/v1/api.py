"""
API v1 router configuration.
"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, dashboard, dashboard_v2, admin, parquet, drought


api_router = APIRouter()

# Public endpoints - Optimized for large datasets
api_router.include_router(
    dashboard_v2.router,
    prefix="/dashboard",
    tags=["dashboard-optimized"]
)

# Public endpoints - Legacy (keep for compatibility)
# api_router.include_router(
#     dashboard.router,
#     prefix="/dashboard-legacy",
#     tags=["dashboard-legacy"]
# )

# Authentication endpoints
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["authentication"]
)

# Admin endpoints (protected)
api_router.include_router(
    admin.router,
    prefix="/admin",
    tags=["admin"]
)

# Parquet file endpoints (protected)
api_router.include_router(
    parquet.router,
    prefix="/parquet",
    tags=["parquet"]
)

# Drought monitoring endpoints (public - dashboard data)
api_router.include_router(
    drought.router,
    prefix="/drought",
    tags=["drought-monitoring"]
)
