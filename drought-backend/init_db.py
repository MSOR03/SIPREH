"""
Script to initialize the database and create an admin user.
Run this script to set up the initial database.
"""
from app.db.base import Base
from app.db.session import engine, get_db
from app.services.auth import create_user, get_user_by_email
from app.schemas.user import UserCreate
from app.core.config import settings


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
    finally:
        db.close()
    
    print("\n✓ Database initialization complete!")


if __name__ == "__main__":
    init_db()
