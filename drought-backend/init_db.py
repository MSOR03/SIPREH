"""
Script to initialize the database and create an admin user.
Run this script to set up the initial database.
"""
import ast
import json

from app.db.base import Base
from app.db.session import engine, get_db
from app.services.auth import create_user, get_user_by_email
from app.schemas.user import UserCreate
from app.core.config import settings
from app.models.parquet_file import ParquetFile
from app.db.seed_zones import seed_zone_relations


def _normalize_parquet_metadata(db) -> int:
    """Normalize legacy parquet metadata strings to valid JSON dicts."""
    updated = 0
    files = db.query(ParquetFile).filter(ParquetFile.file_metadata.isnot(None)).all()

    for file in files:
        raw = file.file_metadata
        if not raw:
            continue

        parsed = None
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            try:
                # Backward compatibility with legacy str(dict) records.
                parsed = ast.literal_eval(raw)
            except (ValueError, SyntaxError):
                continue

        if not isinstance(parsed, dict):
            continue

        if "resolution" not in parsed and "resolution_degrees" in parsed:
            parsed["resolution"] = parsed["resolution_degrees"]

        normalized = json.dumps(parsed)
        if normalized != raw:
            file.file_metadata = normalized
            updated += 1

    if updated > 0:
        db.commit()

    return updated


def init_db():
    """Initialize database with tables and default admin user."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created")
    
    # Create default admin user
    db = next(get_db())
    try:
        admin_user = get_user_by_email(db, settings.ADMIN_EMAIL)
        
        if not admin_user:
            print(f"Creating admin user: {settings.ADMIN_EMAIL}")
            admin_data = UserCreate(
                email=settings.ADMIN_EMAIL,
                password=settings.ADMIN_PASSWORD,
                full_name="System Administrator",
                is_active=True,
                is_superuser=True
            )
            create_user(db, admin_data)
            print("✓ Admin user created successfully")
            print(f"  Email: {settings.ADMIN_EMAIL}")
            print(f"  Password: {settings.ADMIN_PASSWORD}")
            print("\n⚠️  IMPORTANT: Change the default password in production!")
        else:
            print(f"✓ Admin user already exists: {settings.ADMIN_EMAIL}")

        # Normalize old metadata formats to keep sync/upload behavior stable across machines.
        normalized_count = _normalize_parquet_metadata(db)
        if normalized_count:
            print(f"✓ Normalized metadata for {normalized_count} parquet file(s)")
        else:
            print("✓ Parquet metadata already normalized")

        # Seed zone↔cell relations (cuenca/municipio/perimetro). Idempotent upsert.
        zone_stats = seed_zone_relations(db)
        if any(zone_stats.values()):
            print(
                "✓ Zone relations seeded: "
                f"+{zone_stats['cells_added']} cells, "
                f"+{zone_stats['zones_added']} zones, "
                f"+{zone_stats['relations_added']} relations, "
                f"~{zone_stats['relations_updated']} updated"
            )
        else:
            print("✓ Zone relations already up to date")
    finally:
        db.close()
    
    print("\n✓ Database initialization complete!")


if __name__ == "__main__":
    init_db()
