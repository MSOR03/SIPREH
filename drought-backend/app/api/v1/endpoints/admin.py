"""
Admin endpoints for file management and user administration.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.api.deps import get_current_admin_user
from app.models.user import User
from app.models.parquet_file import ParquetFile
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate
from app.schemas.parquet import ParquetFile as ParquetFileSchema, ParquetFileList
from app.services.auth import create_user, update_user, get_user_by_id


router = APIRouter()


# User Management Endpoints

@router.post("/users", response_model=UserSchema)
def create_new_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Create a new user (admin only).
    """
    user = create_user(db, user_in)
    return user


@router.get("/users", response_model=List[UserSchema])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    List all users (admin only).
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get a specific user by ID (admin only).
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/users/{user_id}", response_model=UserSchema)
def update_user_endpoint(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Update a user (admin only).
    """
    user = update_user(db, user_id, user_in)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


# Parquet File Management Endpoints

@router.get("/files", response_model=ParquetFileList)
def list_parquet_files(
    skip: int = 0,
    limit: int = 100,
    status_filter: str = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    List all parquet files (admin only).
    """
    query = db.query(ParquetFile)
    
    if status_filter:
        query = query.filter(ParquetFile.status == status_filter)
    
    total = query.count()
    files = query.order_by(ParquetFile.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "files": files
    }


@router.get("/files/{file_id}", response_model=ParquetFileSchema)
def get_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Get details of a specific parquet file (admin only).
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    return file


@router.delete("/files/{file_id}")
def delete_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Delete a parquet file (admin only).
    
    This marks the file as deleted in the database.
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    file.status = "deleted"
    db.commit()
    
    return {
        "success": True,
        "message": f"File {file.filename} marked as deleted"
    }


@router.post("/files/{file_id}/activate")
def activate_parquet_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Activate a parquet file for use in the dashboard.
    
    This makes the file the active data source.
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    file.status = "active"
    db.commit()
    
    return {
        "success": True,
        "message": f"File {file.filename} is now active"
    }
