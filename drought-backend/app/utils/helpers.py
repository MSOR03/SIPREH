"""
Utility helper functions.
"""
import os
from typing import Any, Dict
from datetime import datetime


def ensure_dir_exists(directory: str) -> None:
    """
    Ensure a directory exists, create if it doesn't.
    
    Args:
        directory: Path to directory
    """
    if not os.path.exists(directory):
        os.makedirs(directory)


def format_datetime(dt: datetime) -> str:
    """
    Format datetime to ISO string.
    
    Args:
        dt: Datetime object
        
    Returns:
        ISO formatted string
    """
    return dt.isoformat()


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename by removing special characters.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename
    """
    # Remove path components
    filename = os.path.basename(filename)
    
    # Replace special characters
    valid_chars = "-_.() "
    filename = ''.join(c for c in filename if c.isalnum() or c in valid_chars)
    
    return filename.strip()


def get_file_extension(filename: str) -> str:
    """
    Get file extension from filename.
    
    Args:
        filename: Filename
        
    Returns:
        File extension (including dot)
    """
    return os.path.splitext(filename)[1].lower()


def bytes_to_human_readable(num_bytes: int) -> str:
    """
    Convert bytes to human readable format.
    
    Args:
        num_bytes: Number of bytes
        
    Returns:
        Human readable string (e.g., "1.5 MB")
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if num_bytes < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} PB"
