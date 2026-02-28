"""
Token schemas for authentication.
"""
from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    """Access token response."""
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Token payload data."""
    sub: Optional[str] = None
