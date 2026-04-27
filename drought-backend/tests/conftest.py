"""
conftest.py — fixtures compartidas para toda la suite de tests.

Estrategia:
- Base de datos SQLite en memoria (por sesión de test, aislada).
- Archivo parquet local (tests/data/sample_chirps.parquet) registrado como
  cloud_key/cloud_url para que DuckDB lo lea directamente (sin Cloudflare).
- Token de admin disponible como fixture.
"""

import hashlib
import json
import os
import shutil
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Forzar DB de test ANTES de importar la app
TEST_DB_URL = "sqlite:///./test_drought.db"
os.environ["DATABASE_URL"] = TEST_DB_URL

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.parquet_file import ParquetFile
from app.models.user import User
from app.services.auth import create_user, get_user_by_email
from app.schemas.user import UserCreate

# ────────────────────────────────────────────────────────────────────────────
# Path absoluto al parquet de prueba
# ────────────────────────────────────────────────────────────────────────────
TESTS_DIR   = os.path.dirname(__file__)
SAMPLE_PARQUET = os.path.abspath(os.path.join(TESTS_DIR, "data", "sample_chirps.parquet"))


# ────────────────────────────────────────────────────────────────────────────
# DB engine / session de test
# ────────────────────────────────────────────────────────────────────────────
engine_test = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def _populate_parquet_cache(local_file: str) -> None:
    """
    Copia el parquet local al directorio de caché efímero de DuckDB.

    HistoricalDataService._get_parquet_url() usa:
      cache_dir = '.cache_parquet'          (en desarrollo, is_production=False)
      key_hash  = md5(cloud_key).hexdigest()
      local_path = f"{cache_dir}/{key_hash}.parquet"

    Si el archivo ya está en ese path, el servicio lo retorna directamente
    sin intentar descargarlo de Cloudflare R2.
    """
    cloud_key = local_file  # tal cual se guarda en ParquetFile.cloud_key
    key_hash = hashlib.md5(cloud_key.encode()).hexdigest()
    cache_dir = ".cache_parquet"
    os.makedirs(cache_dir, exist_ok=True)
    dest = os.path.join(cache_dir, f"{key_hash}.parquet")
    if not os.path.exists(dest):
        shutil.copy(local_file, dest)


# ────────────────────────────────────────────────────────────────────────────
# Fixtures de sesión — se crean UNA vez para toda la corrida de tests
# ────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Crea tablas + usuario admin + archivo parquet de prueba."""
    Base.metadata.create_all(bind=engine_test)
    app.dependency_overrides[get_db] = override_get_db

    # ── Limpiar claves Redis que pueden quedar obsoletas entre ejecuciones ──
    # La cache Redis persiste entre tests; una ejecución anterior puede haber
    # guardado pred_cloud_key o format: con IDs/rutas que ya no son válidas.
    try:
        from app.services.cache import cache_service as _cs
        if hasattr(_cs, 'redis_client') and _cs.redis_client:
            for pattern in (b'pred_cloud_key:*', b'format:*', b'endpoint:*',
                            b'pred:*', b'hydro_cloud_key:*'):
                stale = _cs.redis_client.keys(pattern)
                if stale:
                    _cs.redis_client.delete(*stale)
    except Exception:
        pass

    db = TestingSessionLocal()

    # Crear admin si no existe
    if not get_user_by_email(db, "admin@test.com"):
        create_user(
            db,
            UserCreate(
                email="admin@test.com",
                password="testpassword123",
                full_name="Test Admin",
                is_active=True,
                is_superuser=True,
            ),
        )

    # Registrar parquet de prueba (CHIRPS 0.05°)
    chirps_meta = json.dumps({
        "resolution": 0.05,
        "dataset_type": "historical",
        "dataset_key": "historical_main",
        "num_rows": 648,
    })
    chirps_file = ParquetFile(
        filename="sample_chirps.parquet",
        original_filename="sample_chirps.parquet",
        file_size=os.path.getsize(SAMPLE_PARQUET),
        cloud_url=SAMPLE_PARQUET,   # DuckDB puede leer paths locales
        cloud_key=SAMPLE_PARQUET,
        file_metadata=chirps_meta,
        status="active",
    )
    db.add(chirps_file)
    db.commit()
    db.refresh(chirps_file)

    # Guardar IDs en el módulo para que los tests los lean
    import tests.conftest as _self
    _self.CHIRPS_FILE_ID = chirps_file.id

    db.close()

    # ── Pre-poblar caché efímero de DuckDB ──────────────────────────────────
    # historical_data_service._get_parquet_url() almacena archivos como
    #   .cache_parquet/{md5(cloud_key)}.parquet
    # Al copiar el parquet de prueba con el hash correcto evitamos que el
    # servicio intente descargar el archivo desde Cloudflare R2 durante tests.
    _populate_parquet_cache(SAMPLE_PARQUET)

    yield

    # Teardown: borrar DB de test
    Base.metadata.drop_all(bind=engine_test)
    if os.path.exists("test_drought.db"):
        os.remove("test_drought.db")


# ID del archivo CHIRPS registrado (se rellena en setup_test_db)
CHIRPS_FILE_ID: int = None


# ────────────────────────────────────────────────────────────────────────────
# Fixtures reutilizables por tests individuales
# ────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    """Login y retorna el JWT del admin de test."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "testpassword123"},
    )
    assert resp.status_code == 200, f"Login falló: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def chirps_file_id():
    """ID del archivo CHIRPS de prueba registrado en la DB."""
    import tests.conftest as _self
    return _self.CHIRPS_FILE_ID


# Celda conocida del parquet de prueba (primera de CHIRPS_CELLS)
KNOWN_CELL_ID = "-74.225000_4.425000"
KNOWN_DATE    = "2001-06-01"
