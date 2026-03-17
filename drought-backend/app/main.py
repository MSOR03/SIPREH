"""
DroughtMonitor Backend - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.api.v1.api import api_router
from app.db.base import Base
from app.db.session import engine, get_db
from app.models.user import User
from app.services.auth import create_user, get_user_by_email
from app.schemas.user import UserCreate
from app.utils.helpers import ensure_dir_exists


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    """
    # Startup
    print("Starting up DroughtMonitor Backend...")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    print("Database tables created")
    
    # Create upload directory
    ensure_dir_exists(settings.UPLOAD_DIR)
    print(f"Upload directory ensured: {settings.UPLOAD_DIR}")
    
    # Create default admin user if it doesn't exist
    db = next(get_db())
    admin_user = get_user_by_email(db, settings.ADMIN_EMAIL)
    if not admin_user:
        admin_data = UserCreate(
            email=settings.ADMIN_EMAIL,
            password=settings.ADMIN_PASSWORD,
            full_name="System Administrator",
            is_active=True,
            is_superuser=True
        )
        create_user(db, admin_data)
        print(f"Default admin user created: {settings.ADMIN_EMAIL}")
    else:
        print("Admin user already exists")
    db.close()
    
    print("Application startup complete")

    # Lanzar preload de archivos parquet en background (no bloquea startup)
    import asyncio
    from app.services.tiered_storage import background_preload, periodic_cache_eviction
    asyncio.create_task(background_preload())
    asyncio.create_task(periodic_cache_eviction())

    yield
    
    # Shutdown
    print("Shutting down DroughtMonitor Backend...")


# Create FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for DroughtMonitor - Drought monitoring and data management system",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    """
    Root endpoint - API information.
    """
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs": "/docs",
        "api": settings.API_V1_STR
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "droughtmonitor-backend",
        "version": settings.VERSION
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
