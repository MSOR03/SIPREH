"""
Estrategia de almacenamiento por niveles (Tiered Storage) para datasets parquet.

Regla simple basada en tamano:
  < 30 MB   -> single_file      (un solo parquet, merge completo)
  30-500 MB -> historical_updates (historical.parquet + updates.parquet)

Para datasets historical_updates:
  - historical.parquet : datos historicos, nunca se toca en updates mensuales
  - updates.parquet    : datos nuevos mensuales, crece poco a poco
  - Queries DuckDB: read_parquet(['historical.parquet', 'updates.parquet'])
  - Compactacion ocasional: merge ambos -> nuevo historical, resetear updates

Cache de disco efimero:
  - Los parquets activos se descargan a /tmp/parquet_cache (prod) o .cache_parquet (dev)
  - Se mantienen mientras estan en uso por consultas (touch en cada acceso)
  - Eviccion periodica elimina archivos no accedidos en CACHE_MAX_IDLE_MINUTES
  - Los archivos de merge (admin) usan tempfile.TemporaryDirectory aparte (limpieza automatica)
"""
import os
import time
import asyncio
import hashlib
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger("tiered_storage")

# ---------------------------------------------------------------------------
# Cache settings
# ---------------------------------------------------------------------------

CACHE_MAX_IDLE_MINUTES = int(os.getenv("PARQUET_CACHE_MAX_IDLE_MINUTES", "60"))
CACHE_EVICTION_INTERVAL_MINUTES = int(os.getenv("PARQUET_CACHE_EVICTION_INTERVAL", "15"))

# ---------------------------------------------------------------------------
# Configuracion por dataset
# ---------------------------------------------------------------------------

TIERED_STORAGE_CONFIG: Dict[str, Dict[str, Any]] = {
    "historical_era5": {
        "strategy": "single_file",
        "size_tier": "small",
    },
    "historical_imerg": {
        "strategy": "historical_updates",
        "size_tier": "medium",
    },
    "historical_chirps": {
        "strategy": "historical_updates",
        "size_tier": "large",
    },
    "hydro_main": {
        "strategy": "single_file",
        "size_tier": "small",
    },
    "prediction_main": {
        "strategy": "single_file",
        "size_tier": "small",
    },
}

# Roles validos para cada estrategia
ROLES_BY_STRATEGY = {
    "single_file": ["snapshot", "delta"],
    "historical_updates": ["historical_base", "updates", "delta"],
}


def get_strategy(dataset_key: str) -> str:
    """Retorna la estrategia de storage para un dataset."""
    cfg = TIERED_STORAGE_CONFIG.get(dataset_key)
    if cfg:
        return cfg["strategy"]
    return "single_file"


def is_tiered(dataset_key: str) -> bool:
    """Retorna True si el dataset usa historical_updates."""
    return get_strategy(dataset_key) == "historical_updates"


# ---------------------------------------------------------------------------
# Resolucion de archivos activos para un dataset
# ---------------------------------------------------------------------------

def get_active_cloud_keys_for_dataset(dataset_key: str, db) -> List[str]:
    """
    Busca en la DB todos los archivos activos de un dataset y retorna sus cloud_keys.

    Para historical_updates: retorna [historical_base_key, updates_key]
    Para single_file: retorna [snapshot_key]
    Orden: historical_base primero, updates despues (consistente para DuckDB).
    """
    from app.models.parquet_file import ParquetFile
    import json
    import ast

    files = db.query(ParquetFile).filter(ParquetFile.status == "active").all()
    dataset_files = []

    for f in files:
        meta = _parse_meta(f.file_metadata)
        if meta.get("dataset_key") == dataset_key and f.cloud_key:
            dataset_files.append((f, meta))

    if not dataset_files:
        return []

    strategy = get_strategy(dataset_key)

    if strategy == "historical_updates":
        # Ordenar: historical_base primero, updates despues
        role_order = {"historical_base": 0, "updates": 1, "snapshot": 2}
        dataset_files.sort(key=lambda x: role_order.get(x[1].get("role", "snapshot"), 99))
        return [f.cloud_key for f, _ in dataset_files]
    else:
        # single_file: solo el archivo activo (snapshot)
        return [f.cloud_key for f, _ in dataset_files[:1]]


def _parse_meta(raw: Optional[str]) -> Dict[str, Any]:
    """Parse file metadata JSON string."""
    if not raw:
        return {}
    try:
        import json
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        try:
            import ast
            parsed = ast.literal_eval(raw)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, SyntaxError):
            return {}


# ---------------------------------------------------------------------------
# Path resolution: cloud_keys -> local paths -> DuckDB source expression
# ---------------------------------------------------------------------------

def _get_cache_dir() -> str:
    """Retorna el directorio de cache segun entorno."""
    is_production = bool(
        os.getenv('RAILWAY_ENVIRONMENT') or
        os.getenv('RENDER') or
        os.getenv('FLY_APP_NAME')
    )
    if is_production:
        return '/tmp/parquet_cache'
    return '.cache_parquet'


def _cloud_key_to_local_path(cloud_key: str) -> str:
    """Convierte un cloud_key al path local esperado en cache."""
    cache_dir = _get_cache_dir()
    key_hash = hashlib.md5(cloud_key.encode()).hexdigest()
    return os.path.join(cache_dir, f"{key_hash}.parquet")


def is_file_cached(cloud_key: str) -> bool:
    """Verifica si un archivo ya esta en cache local."""
    local_path = _cloud_key_to_local_path(cloud_key)
    return os.path.exists(local_path) and os.path.getsize(local_path) > 1024


def build_duckdb_source(local_paths: List[str]) -> str:
    """
    Construye la expresion DuckDB FROM a partir de paths locales.

    - 1 path: read_parquet('/path/to/file.parquet')
    - N paths: read_parquet(['/path1.parquet', '/path2.parquet'], union_by_name=true)
    """
    if len(local_paths) == 1:
        return f"read_parquet('{local_paths[0]}')"
    paths_str = ", ".join(f"'{p}'" for p in local_paths)
    return f"read_parquet([{paths_str}], union_by_name=true)"


def encode_multi_keys(cloud_keys: List[str]) -> str:
    """
    Codifica multiples cloud_keys en un solo string usando '|' como separador.
    Compatible con el flujo existente que pasa un solo string como parquet_url.
    """
    return "|".join(cloud_keys)


def decode_multi_keys(parquet_url: str) -> List[str]:
    """
    Decodifica un parquet_url que puede contener multiples keys separadas por '|'.
    Si no contiene '|', retorna [parquet_url] (comportamiento single file).
    """
    if "|" in parquet_url:
        return [k.strip() for k in parquet_url.split("|") if k.strip()]
    return [parquet_url]


# ---------------------------------------------------------------------------
# Background preload de archivos grandes al inicio de la app
# ---------------------------------------------------------------------------

async def background_preload():
    """
    Descarga archivos parquet grandes al disco efimero en background.

    Prioridad:
    1. Archivos updates (pequenos, rapido)
    2. Archivos historical_base (grandes, lento)

    No bloquea el startup de la app.
    """
    try:
        # Esperar un poco para que la app termine de inicializar
        await asyncio.sleep(2)

        logger.info("Background preload: iniciando descarga de archivos parquet...")

        from app.db.session import SessionLocal
        from app.models.parquet_file import ParquetFile
        from app.services.cloud_storage import CloudStorageService
        import requests

        db = SessionLocal()
        cloud_service = CloudStorageService()
        cache_dir = _get_cache_dir()
        os.makedirs(cache_dir, exist_ok=True)

        try:
            # Obtener todos los archivos activos
            active_files = db.query(ParquetFile).filter(
                ParquetFile.status == "active"
            ).all()

            if not active_files:
                logger.info("Background preload: no hay archivos activos")
                return

            # Clasificar por prioridad: updates primero, luego historical_base, luego snapshots
            role_priority = {"updates": 0, "historical_base": 1, "snapshot": 2}
            files_to_download = []

            for f in active_files:
                if not f.cloud_key:
                    continue
                meta = _parse_meta(f.file_metadata)
                role = meta.get("role", "snapshot")
                priority = role_priority.get(role, 99)
                files_to_download.append((priority, f.cloud_key, f.filename, f.file_size or 0))

            files_to_download.sort(key=lambda x: (x[0], x[3]))

            downloaded = 0
            skipped = 0

            for _, cloud_key, filename, file_size in files_to_download:
                local_path = _cloud_key_to_local_path(cloud_key)

                # Si ya esta en cache, touch y skip
                if os.path.exists(local_path) and os.path.getsize(local_path) > 1024:
                    touch_cache_file(local_path)
                    skipped += 1
                    continue

                size_mb = file_size / (1024 * 1024) if file_size else 0
                logger.info(f"Background preload: descargando {filename} ({size_mb:.1f} MB)...")

                try:
                    # Usar asyncio.to_thread para no bloquear el event loop
                    file_data = await asyncio.to_thread(
                        cloud_service.download_file, cloud_key
                    )
                    if file_data:
                        await asyncio.to_thread(
                            _write_file, local_path, file_data
                        )
                        downloaded += 1
                        logger.info(f"Background preload: {filename} descargado OK")
                    else:
                        # Fallback: presigned URL
                        url = cloud_service.get_file_url(cloud_key, expires_in=3600)
                        if url:
                            await asyncio.to_thread(
                                _download_via_url, url, local_path
                            )
                            downloaded += 1
                            logger.info(f"Background preload: {filename} descargado via URL OK")
                except Exception as e:
                    logger.warning(f"Background preload: error descargando {filename}: {e}")

            logger.info(
                f"Background preload completado: {downloaded} descargados, {skipped} ya en cache"
            )

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Background preload error: {e}")


def _write_file(path: str, data: bytes) -> None:
    """Escribe datos a un archivo (sync, para usar con asyncio.to_thread)."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


def _download_via_url(url: str, local_path: str) -> None:
    """Descarga un archivo desde URL a path local (sync)."""
    import requests
    response = requests.get(url, stream=True, timeout=300)
    response.raise_for_status()
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=65536):
            f.write(chunk)


# ---------------------------------------------------------------------------
# Cache lifecycle: touch on access, evict stale files
# ---------------------------------------------------------------------------

def touch_cache_file(local_path: str) -> None:
    """
    Actualiza el tiempo de acceso de un archivo en cache.
    Llamar cada vez que un archivo se usa en una consulta para que
    la eviccion sepa que sigue activo.
    """
    try:
        if os.path.exists(local_path):
            os.utime(local_path, None)  # sets atime & mtime to now
    except OSError:
        pass


def _get_active_cache_hashes() -> set:
    """
    Consulta la DB para obtener los hashes MD5 de cloud_keys de archivos activos.
    Estos archivos NUNCA deben ser eliminados por eviccion.
    """
    try:
        from app.db.session import SessionLocal
        from app.models.parquet_file import ParquetFile

        db = SessionLocal()
        try:
            active_files = db.query(ParquetFile).filter(
                ParquetFile.status == "active"
            ).all()
            hashes = set()
            for f in active_files:
                if f.cloud_key:
                    h = hashlib.md5(f.cloud_key.encode()).hexdigest()
                    hashes.add(f"{h}.parquet")
            return hashes
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Cache eviction: no se pudo consultar archivos activos: {e}")
        return set()


def evict_stale_cache() -> Dict[str, Any]:
    """
    Elimina archivos de cache que no han sido accedidos en CACHE_MAX_IDLE_MINUTES
    y que NO corresponden a archivos activos en la DB.

    Returns:
        Dict con stats: removed_count, removed_mb, kept_count, protected_count
    """
    cache_dir = _get_cache_dir()
    if not os.path.isdir(cache_dir):
        return {"removed_count": 0, "removed_mb": 0, "kept_count": 0, "protected_count": 0}

    max_idle_seconds = CACHE_MAX_IDLE_MINUTES * 60
    now = time.time()

    # Archivos que NUNCA se eliminan (activos en DB)
    protected_hashes = _get_active_cache_hashes()

    removed_count = 0
    removed_bytes = 0
    kept_count = 0
    protected_count = 0

    for filename in os.listdir(cache_dir):
        if not filename.endswith(".parquet"):
            continue

        filepath = os.path.join(cache_dir, filename)
        if not os.path.isfile(filepath):
            continue

        # Proteger archivos que corresponden a parquets activos en DB
        if filename in protected_hashes:
            protected_count += 1
            continue

        try:
            stat = os.stat(filepath)
            last_access = stat.st_atime
            idle_seconds = now - last_access

            if idle_seconds > max_idle_seconds:
                file_size = stat.st_size
                os.remove(filepath)
                removed_count += 1
                removed_bytes += file_size
                logger.info(
                    f"Cache eviction: eliminado {filename} "
                    f"(idle {idle_seconds / 60:.0f}min, {file_size / 1024 / 1024:.1f}MB)"
                )
            else:
                kept_count += 1
        except OSError as e:
            logger.warning(f"Cache eviction: error procesando {filename}: {e}")

    removed_mb = round(removed_bytes / (1024 * 1024), 2)
    logger.info(
        f"Cache eviction: {removed_count} eliminados ({removed_mb}MB), "
        f"{kept_count} conservados, {protected_count} protegidos (activos)"
    )
    return {
        "removed_count": removed_count,
        "removed_mb": removed_mb,
        "kept_count": kept_count,
        "protected_count": protected_count,
    }


async def periodic_cache_eviction():
    """
    Tarea background que ejecuta eviccion de cache periodicamente.
    Corre cada CACHE_EVICTION_INTERVAL_MINUTES minutos.
    """
    try:
        # Esperar a que la app este lista y el preload haya avanzado
        await asyncio.sleep(60)
        logger.info(
            f"Cache eviction: iniciando ciclo periodico "
            f"(cada {CACHE_EVICTION_INTERVAL_MINUTES}min, "
            f"max idle {CACHE_MAX_IDLE_MINUTES}min)"
        )

        while True:
            try:
                await asyncio.to_thread(evict_stale_cache)
            except Exception as e:
                logger.warning(f"Cache eviction: error en ciclo: {e}")

            await asyncio.sleep(CACHE_EVICTION_INTERVAL_MINUTES * 60)
    except asyncio.CancelledError:
        logger.info("Cache eviction: tarea cancelada")
    except Exception as e:
        logger.error(f"Cache eviction: error fatal: {e}")
