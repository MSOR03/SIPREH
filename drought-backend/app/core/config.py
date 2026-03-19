"""
Core configuration settings for DroughtMonitor backend.
"""
from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend root directory
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "DroughtMonitor API"
    VERSION: str = "1.0.0"
    
    # CORS Settings
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:8000"]
    
    # Security Settings
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database Settings
    DATABASE_URL: str = "sqlite:///./droughtmonitor.db"
    
    # Cloud Storage Settings
    CLOUD_STORAGE_PROVIDER: str = "cloudflare-r2"  # or "aws-s3", "backblaze-b2"
    CLOUD_STORAGE_ENDPOINT: Optional[str] = None
    CLOUD_ACCOUNT_ID: Optional[str] = None  # For Cloudflare R2
    CLOUD_STORAGE_TOKEN: str | None = None
    CLOUD_STORAGE_BUCKET: str = "drought-data"
    CLOUD_STORAGE_ACCESS_KEY: Optional[str] = None
    CLOUD_STORAGE_SECRET_KEY: Optional[str] = None
    CLOUD_STORAGE_ACCOUNT_ID: Optional[str] = None  # For Cloudflare R2
    CLOUD_STORAGE_REGION: str = "auto"
    
    # File Upload Settings
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS: list = [".parquet"]
    UPLOAD_DIR: str = "./uploads"
    
    # Export Settings
    EXPORT_DIR: str = "./exports"
    EXPORT_MAX_AGE_HOURS: int = 24  # Files older than this are deleted
    
    # 🚀 Cache Strategy: Direct Cloudflare + Redis only
    # DEPRECADO: Cache de disco local removido por problemas de performance
    # PARQUET_CACHE_DIR: str = ".cache_parquet"
    # PARQUET_CACHE_MAX_SIZE_GB: float = 10.0
    # PARQUET_CACHE_ENABLED: bool = False
    
    # Admin Settings
    ADMIN_EMAIL: str = "admin@droughtmonitor.com"
    ADMIN_PASSWORD: str = "change-this-password"
    
    # Cache Settings (Redis - optional, falls back to memory cache)
    REDIS_URL: Optional[str] = None  # e.g., "redis://localhost:6379/0"
    CACHE_DEFAULT_EXPIRE: int = 900  # 15 minutes

    # AI Summary Settings (Groq API for Llama 3.1-8b-instant)
    GROQ_API_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
