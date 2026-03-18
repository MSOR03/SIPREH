"""
Admin endpoints — aggregated router.

This module re-exports a single ``router`` that includes every admin
sub-module so that ``api.py`` continues to work with a single import::

    from app.api.v1.endpoints.admin import router
"""
from fastapi import APIRouter

from app.api.v1.endpoints.admin_users import router as users_router
from app.api.v1.endpoints.admin_files import router as files_router
from app.api.v1.endpoints.admin_datasets import router as datasets_router
from app.api.v1.endpoints.admin_tiered import router as tiered_router
from app.api.v1.endpoints.admin_cloud import router as cloud_router

router = APIRouter()

router.include_router(users_router)
router.include_router(files_router)
router.include_router(datasets_router)
router.include_router(tiered_router)
router.include_router(cloud_router)
