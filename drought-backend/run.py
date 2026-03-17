"""
Script to run the FastAPI application.
Convenience script for development.
"""
import uvicorn


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=["*.parquet", ".cache_parquet", "uploads", "exports", "*.db", "*.db-journal"],
        log_level="info"
    )
