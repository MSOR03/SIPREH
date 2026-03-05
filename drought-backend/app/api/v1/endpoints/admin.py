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
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Dict, Any, List as ListType
from datetime import datetime
from app.services.cloud_storage import CloudStorageService
import json


router = APIRouter()
cloud_service = CloudStorageService()


# Helper Functions

def detect_resolution_from_filename(filename: str) -> tuple[str, float]:
    """
    Detecta la resolución basándose en el nombre del archivo.
    
    Convenciones:
    - grid_ERA5.parquet → Baja resolución (0.25°)
    - grid_IMERG.parquet → Media resolución (0.10°)
    - grid_CHIRPS.parquet → Alta resolución (mejor, más pesado)
    
    Args:
        filename: Nombre del archivo
        
    Returns:
        Tupla (level_name, resolution_degrees)
    """
    filename_lower = filename.lower()
    
    if 'era5' in filename_lower:
        return ('low', 0.25)
    elif 'imerg' in filename_lower:
        return ('medium', 0.10)
    elif 'chirps' in filename_lower:
        return ('high', 0.05)
    else:
        # Default: intentar adivinar por tamaño o usar medium como default
        return ('unknown', 0.10)


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
    delete_from_cloud: bool = True,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Delete a parquet file (admin only).
    
    Elimina el archivo de la base de datos y opcionalmente de Cloudflare.
    
    Args:
        file_id: ID del archivo a eliminar
        delete_from_cloud: Si True, también elimina de Cloudflare R2 (default: True)
    
    Returns:
        Resultado de la eliminación
    """
    file = db.query(ParquetFile).filter(ParquetFile.id == file_id).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    result = {
        "success": True,
        "message": f"File {file.filename} deleted from database",
        "deleted_from_cloud": False
    }
    
    # Eliminar de Cloudflare si se solicita
    if delete_from_cloud and file.cloud_key:
        try:
            cloud_deleted = cloud_service.delete_file(file.cloud_key)
            if cloud_deleted:
                result["deleted_from_cloud"] = True
                result["message"] += " and Cloudflare R2"
            else:
                result["message"] += " (Warning: could not delete from Cloudflare)"
        except Exception as e:
            result["message"] += f" (Error deleting from Cloudflare: {str(e)})"
    
    # Eliminar de base de datos
    db.delete(file)
    db.commit()
    
    return result


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


# Schema for external file registration
class ExternalParquetFileCreate(BaseModel):
    """Schema for registering external parquet files."""
    filename: str = Field(..., description="Nombre del archivo")
    cloud_url: str = Field(..., description="URL completa del archivo en Cloudflare")
    description: Optional[str] = Field("", description="Descripción del archivo")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadatos adicionales")


@router.post("/files/register-external", response_model=ParquetFileSchema)
def register_external_parquet_file(
    file_data: ExternalParquetFileCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Registra un archivo parquet que ya está en Cloudflare R2.
    
    Auto-detecta resolución basándose en el nombre del archivo:
    - grid_ERA5.parquet → Baja resolución (0.25°)
    - grid_IMERG.parquet → Media resolución (0.10°)
    - grid_CHIRPS.parquet → Alta resolución (mejor, más pesado)
    
    Args:
        file_data: Información del archivo a registrar
        
    Returns:
        Archivo parquet registrado con metadata enriquecida
    """
    # Extraer cloud_key desde URL
    from urllib.parse import urlparse
    from app.core.config import settings
    
    try:
        parsed = urlparse(file_data.cloud_url)
        path_parts = parsed.path.strip('/').split('/', 1)
        cloud_key = path_parts[1] if len(path_parts) > 1 else path_parts[0]
    except Exception:
        # Si falla el parsing, usar filename como cloud_key
        cloud_key = f"parquet/{file_data.filename}"
    
    # Verificar si ya existe
    existing = db.query(ParquetFile).filter(
        (ParquetFile.cloud_url == file_data.cloud_url) | 
        (ParquetFile.cloud_key == cloud_key)
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe un archivo con esta URL o clave (ID: {existing.id})"
        )
    
    # Auto-detectar resolución desde filename
    level_name, resolution = detect_resolution_from_filename(file_data.filename)
    
    # Intentar obtener metadata desde Cloudflare
    file_size = 0
    last_modified = datetime.utcnow()
    
    try:
        cloud_files = cloud_service.list_files(prefix=cloud_key.rsplit('/', 1)[0] if '/' in cloud_key else '')
        for cf in cloud_files:
            if cf['key'] == cloud_key:
                file_size = cf['size']
                last_modified = cf['last_modified']
                break
    except Exception as e:
        print(f"Warning: Could not fetch cloud metadata: {e}")
    
    # Preparar metadata enriquecida
    enriched_metadata = file_data.metadata or {}
    enriched_metadata.update({
        "resolution": resolution,
        "resolution_level": level_name,
        "resolution_degrees": resolution,
        "auto_detected": True,
        "last_modified_cloud": last_modified.isoformat() if isinstance(last_modified, datetime) else str(last_modified)
    })
    
    # Crear entrada en base de datos
    new_file = ParquetFile(
        filename=file_data.filename,
        original_filename=file_data.filename,
        file_size=file_size,
        cloud_url=file_data.cloud_url,
        cloud_key=cloud_key,
        file_hash=None,
        file_metadata=json.dumps(enriched_metadata),
        status="active",
        uploaded_by=current_admin.id
    )
    
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    return new_file


# Schema for cloud file listing
class CloudFileInfo(BaseModel):
    """Información de archivo en Cloudflare."""
    key: str
    filename: str
    size_mb: float
    last_modified: datetime
    cloud_url: str
    registered: bool = False
    file_id: Optional[int] = None


class CloudFileListResponse(BaseModel):
    """Response con lista de archivos en cloud."""
    total: int
    files: ListType[CloudFileInfo]
    bucket: str


@router.get("/files/cloud/list", response_model=CloudFileListResponse)
def list_cloudflare_files(
    prefix: str = "parquet/",
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Lista todos los archivos .parquet en Cloudflare R2.
    
    Útil para ver qué archivos tienes en la nube y cuáles están registrados en la DB.
    
    Args:
        prefix: Prefijo para filtrar (por defecto "parquet/")
        
    Returns:
        Lista de archivos con su estado de registro
    """
    try:
        # Listar archivos desde Cloudflare
        cloud_files = cloud_service.list_files(prefix=prefix)
        
        # Filtrar solo .parquet
        parquet_files = [
            f for f in cloud_files 
            if f['key'].endswith('.parquet')
        ]
        
        # Obtener archivos ya registrados en DB
        registered_files = db.query(ParquetFile).all()
        registered_urls = {f.cloud_url for f in registered_files}
        registered_keys = {f.cloud_key for f in registered_files if f.cloud_key}
        
        # Mapear archivos registrados por cloud_key
        file_map = {
            f.cloud_key: f for f in registered_files if f.cloud_key
        }
        
        # Preparar respuesta
        from app.core.config import settings
        result_files = []
        
        for cloud_file in parquet_files:
            key = cloud_file['key']
            filename = key.split('/')[-1]
            size_mb = cloud_file['size'] / (1024 * 1024)
            
            # URL pública
            cloud_url = f"{settings.CLOUD_STORAGE_ENDPOINT}/{settings.CLOUD_STORAGE_BUCKET}/{key}"
            
            # Verificar si está registrado
            is_registered = key in registered_keys or cloud_url in registered_urls
            db_file = file_map.get(key)
            
            result_files.append({
                "key": key,
                "filename": filename,
                "size_mb": round(size_mb, 2),
                "last_modified": cloud_file['last_modified'],
                "cloud_url": cloud_url,
                "registered": is_registered,
                "file_id": db_file.id if db_file else None
            })
        
        return {
            "total": len(result_files),
            "files": result_files,
            "bucket": settings.CLOUD_STORAGE_BUCKET
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listando archivos de Cloudflare: {str(e)}"
        )


class SyncCloudFilesResponse(BaseModel):
    """Response de sincronización de archivos."""
    success: bool
    registered: int
    skipped: int
    deleted_from_db: int
    errors: int
    files: ListType[Dict[str, Any]]


@router.post("/files/cloud/sync", response_model=SyncCloudFilesResponse)
def sync_cloudflare_files(
    prefix: str = "parquet/",
    auto_activate: bool = True,
    bidirectional: bool = True,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user)
):
    """
    Sincronización BIDIRECCIONAL entre Cloudflare R2 y base de datos.
    
    Este endpoint:
    1. Lista todos los archivos .parquet en Cloudflare
    2. Registra archivos nuevos de Cloudflare que no están en BD (con auto-detección de resolución)
    3. Si bidirectional=True: Elimina de BD archivos que ya NO existen en Cloudflare
    4. Auto-detecta resolución: ERA5 (0.25°), IMERG (0.10°), CHIRPS (alta res)
    
    Args:
        prefix: Prefijo para filtrar archivos (default: "parquet/")
        auto_activate: Si True, marca los archivos nuevos como activos
        bidirectional: Si True, elimina de BD archivos que no están en Cloudflare
        
    Returns:
        Resumen de sincronización
    """
    try:
        from app.core.config import settings
        
        # Listar archivos en Cloudflare
        cloud_files = cloud_service.list_files(prefix=prefix)
        parquet_files = [
            f for f in cloud_files 
            if f['key'].endswith('.parquet')
        ]
        
        # Crear set de cloud_keys existentes en Cloudflare
        cloud_keys_set = {f['key'] for f in parquet_files}
        
        # Obtener archivos ya registrados en BD
        registered_files = db.query(ParquetFile).all()
        
        # Contadores
        registered_count = 0
        skipped_count = 0
        deleted_count = 0
        error_count = 0
        results = []
        
        # PASO 1: Registrar archivos nuevos de Cloudflare → BD
        registered_keys = {f.cloud_key for f in registered_files if f.cloud_key}
        
        for cloud_file in parquet_files:
            key = cloud_file['key']
            filename = key.split('/')[-1]
            size_bytes = cloud_file['size']
            size_mb = size_bytes / (1024 * 1024)
            cloud_url = f"{settings.CLOUD_STORAGE_ENDPOINT}/{settings.CLOUD_STORAGE_BUCKET}/{key}"
            
            # Verificar si ya está registrado
            if key in registered_keys:
                skipped_count += 1
                results.append({
                    "filename": filename,
                    "action": "skipped",
                    "reason": "Ya existe en BD"
                })
                continue
            
            # Registrar archivo nuevo con auto-detección de resolución
            try:
                level_name, resolution = detect_resolution_from_filename(filename)
                
                metadata = {
                    "source": "cloudflare_sync",
                    "last_modified_cloud": cloud_file['last_modified'].isoformat(),
                    "size_bytes": size_bytes,
                    "resolution": resolution,
                    "resolution_level": level_name,
                    "resolution_degrees": resolution,
                    "auto_detected": True
                }
                
                new_file = ParquetFile(
                    filename=filename,
                    original_filename=filename,
                    file_size=size_bytes,
                    cloud_url=cloud_url,
                    cloud_key=key,
                    file_hash=cloud_file.get('etag', '').strip('\"'),
                    file_metadata=json.dumps(metadata),
                    status="active" if auto_activate else "pending",
                    uploaded_by=current_admin.id
                )
                
                db.add(new_file)
                db.commit()
                db.refresh(new_file)
                
                registered_count += 1
                results.append({
                    "filename": filename,
                    "action": "registered",
                    "file_id": new_file.id,
                    "resolution": f"{level_name} ({resolution}°)",
                    "size_mb": round(size_mb, 2)
                })
                
            except Exception as e:
                error_count += 1
                results.append({
                    "filename": filename,
                    "action": "error",
                    "reason": str(e)
                })
        
        # PASO 2: Si bidirectional, eliminar de BD archivos que NO están en Cloudflare
        if bidirectional:
            for db_file in registered_files:
                # Si el archivo de BD no tiene cloud_key, skip
                if not db_file.cloud_key:
                    continue
                
                # Si el cloud_key de BD NO está en Cloudflare, eliminarlo de BD
                if db_file.cloud_key not in cloud_keys_set:
                    try:
                        filename = db_file.filename
                        file_id = db_file.id
                        
                        db.delete(db_file)
                        db.commit()
                        
                        deleted_count += 1
                        results.append({
                            "filename": filename,
                            "action": "deleted_from_db",
                            "file_id": file_id,
                            "reason": "No existe en Cloudflare"
                        })
                    except Exception as e:
                        error_count += 1
                        results.append({
                            "filename": db_file.filename,
                            "action": "error_deleting",
                            "reason": str(e)
                        })
        
        return {
            "success": True,
            "registered": registered_count,
            "skipped": skipped_count,
            "deleted_from_db": deleted_count,
            "errors": error_count,
            "files": results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sincronizando archivos: {str(e)}"
        )

