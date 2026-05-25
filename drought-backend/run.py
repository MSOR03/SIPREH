"""
Script to run the FastAPI application.
Convenience script for development.
"""
import os
import uvicorn


if __name__ == "__main__":
    is_production = os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or not os.getenv("DEBUG")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_production,
        reload_excludes=["*.parquet", ".cache_parquet", "uploads", "exports", "*.db", "*.db-journal"],
        log_level="info"
    )
