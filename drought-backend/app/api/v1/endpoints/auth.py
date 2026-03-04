"""
Authentication endpoints.
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import UserLogin, User as UserSchema
from app.schemas.token import Token
from app.services.auth import authenticate_user
from app.core.security import create_access_token
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.user import User


router = APIRouter()


@router.post("/login", response_model=Token)
def login(
    user_credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Login endpoint for admin users.
    
    Returns JWT access token on successful authentication.
    """
    user = authenticate_user(db, user_credentials.email, user_credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.email,
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserSchema)
def read_users_me(
    current_user: User = Depends(get_current_user)
):
    """
    Get current authenticated user information.
    """
    return current_user


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user)
):
    """
    Logout endpoint.
    
    Note: With JWT tokens, actual logout is handled client-side by
    removing the token. This endpoint exists for consistency.
    """
    return {"message": "Successfully logged out"}
