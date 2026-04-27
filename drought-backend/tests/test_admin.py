"""
Tests de endpoints de administración:
  GET    /admin/files           → lista archivos (admin)
  GET    /admin/files/{id}      → detalle de archivo (admin)
  DELETE /admin/files/{id}      → elimina archivo (admin, sin borrar de cloud)
  POST   /admin/files/{id}/activate → activa archivo (admin)

Acceso sin token → 401/403
"""

import json
import os
import pytest

from sqlalchemy.orm import Session
from tests.conftest import TestingSessionLocal, SAMPLE_PARQUET


# ─────────────────────────────────────────────────────────
# Fixture: un archivo de prueba extra para operaciones destructivas
# ─────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def temp_file_id():
    """Archivo extra creado solo para testear DELETE y activate."""
    from app.models.parquet_file import ParquetFile

    db: Session = TestingSessionLocal()
    meta = json.dumps({"resolution": 0.05, "dataset_type": "historical"})
    pf = ParquetFile(
        filename="temp_admin_test.parquet",
        original_filename="temp_admin_test.parquet",
        file_size=os.path.getsize(SAMPLE_PARQUET),
        cloud_url=SAMPLE_PARQUET,
        cloud_key=SAMPLE_PARQUET,
        file_metadata=meta,
        status="pending",
    )
    db.add(pf)
    db.commit()
    db.refresh(pf)
    fid = pf.id
    db.close()
    yield fid
    # Cleanup (si no fue eliminado por el test de DELETE)
    db2: Session = TestingSessionLocal()
    existing = db2.query(ParquetFile).filter(ParquetFile.id == fid).first()
    if existing:
        db2.delete(existing)
        db2.commit()
    db2.close()


# ─────────────────────────────────────────────────────────
# ACCESO SIN AUTENTICACIÓN
# ─────────────────────────────────────────────────────────

class TestAdminUnauthorized:
    def test_list_files_no_token_401(self, client):
        resp = client.get("/api/v1/admin/files")
        assert resp.status_code in (401, 403)

    def test_get_file_no_token_401(self, client, chirps_file_id):
        resp = client.get(f"/api/v1/admin/files/{chirps_file_id}")
        assert resp.status_code in (401, 403)

    def test_delete_file_no_token_401(self, client, chirps_file_id):
        resp = client.delete(
            f"/api/v1/admin/files/{chirps_file_id}",
            params={"delete_from_cloud": False},
        )
        assert resp.status_code in (401, 403)

    def test_activate_file_no_token_401(self, client, chirps_file_id):
        resp = client.post(f"/api/v1/admin/files/{chirps_file_id}/activate")
        assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────
# LISTAR ARCHIVOS
# ─────────────────────────────────────────────────────────

class TestAdminListFiles:
    def test_list_ok(self, client, auth_headers):
        resp = client.get("/api/v1/admin/files", headers=auth_headers)
        assert resp.status_code == 200

    def test_list_has_total_and_files(self, client, auth_headers):
        data = client.get("/api/v1/admin/files", headers=auth_headers).json()
        assert "total" in data
        assert "files" in data
        assert isinstance(data["files"], list)

    def test_list_contains_chirps_file(self, client, auth_headers, chirps_file_id):
        data = client.get("/api/v1/admin/files", headers=auth_headers).json()
        ids = [f["id"] for f in data["files"]]
        assert chirps_file_id in ids

    def test_list_files_have_required_fields(self, client, auth_headers):
        data = client.get("/api/v1/admin/files", headers=auth_headers).json()
        for f in data["files"]:
            for field in ("id", "filename", "status"):
                assert field in f, f"Campo '{field}' faltante en archivo"

    def test_list_filter_by_status_active(self, client, auth_headers):
        resp = client.get(
            "/api/v1/admin/files",
            params={"status_filter": "active"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        for f in data["files"]:
            assert f["status"] == "active"

    def test_list_filter_by_status_pending(self, client, auth_headers):
        resp = client.get(
            "/api/v1/admin/files",
            params={"status_filter": "pending"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        # Todos los resultados deben tener status pending
        for f in resp.json()["files"]:
            assert f["status"] == "pending"

    def test_list_pagination_skip_limit(self, client, auth_headers):
        resp = client.get(
            "/api/v1/admin/files",
            params={"skip": 0, "limit": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["files"]) <= 1


# ─────────────────────────────────────────────────────────
# DETALLE DE ARCHIVO
# ─────────────────────────────────────────────────────────

class TestAdminGetFile:
    def test_get_existing_file(self, client, auth_headers, chirps_file_id):
        resp = client.get(f"/api/v1/admin/files/{chirps_file_id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_get_file_has_id(self, client, auth_headers, chirps_file_id):
        data = client.get(f"/api/v1/admin/files/{chirps_file_id}", headers=auth_headers).json()
        assert data["id"] == chirps_file_id

    def test_get_file_not_found(self, client, auth_headers):
        resp = client.get("/api/v1/admin/files/99999", headers=auth_headers)
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────
# ACTIVAR ARCHIVO
# ─────────────────────────────────────────────────────────

class TestAdminActivateFile:
    def test_activate_ok(self, client, auth_headers, temp_file_id):
        resp = client.post(
            f"/api/v1/admin/files/{temp_file_id}/activate",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_activate_response_has_success(self, client, auth_headers, temp_file_id):
        data = client.post(
            f"/api/v1/admin/files/{temp_file_id}/activate",
            headers=auth_headers,
        ).json()
        assert data.get("success") is True

    def test_activate_not_found(self, client, auth_headers):
        resp = client.post("/api/v1/admin/files/99999/activate", headers=auth_headers)
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────
# ELIMINAR ARCHIVO
# ─────────────────────────────────────────────────────────

class TestAdminDeleteFile:
    def test_delete_not_found(self, client, auth_headers):
        resp = client.delete(
            "/api/v1/admin/files/99999",
            params={"delete_from_cloud": False},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_delete_ok(self, client, auth_headers, temp_file_id):
        """Elimina solo de BD, no de cloud (cloud_key es ruta local de test)."""
        resp = client.delete(
            f"/api/v1/admin/files/{temp_file_id}",
            params={"delete_from_cloud": False},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True

    def test_file_gone_after_delete(self, client, auth_headers, temp_file_id):
        """Tras el DELETE, GET debe retornar 404."""
        resp = client.get(f"/api/v1/admin/files/{temp_file_id}", headers=auth_headers)
        assert resp.status_code == 404
