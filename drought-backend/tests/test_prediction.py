"""
Tests de endpoints de predicción:
  GET  /prediction/history/list
  POST /prediction/timeseries
  POST /prediction/spatial
  POST /prediction/watershed/spatial
  POST /prediction/watershed/timeseries

El parquet de predicción tiene formato long con columnas:
  var, scale, horizon, date, cell_id, lat, lon, value, q1, q3, iqr_min, iqr_max
"""

import json
import os
import pytest

from sqlalchemy.orm import Session
from tests.conftest import TestingSessionLocal

TESTS_DIR = os.path.dirname(__file__)
SAMPLE_PREDICTION_PARQUET = os.path.abspath(
    os.path.join(TESTS_DIR, "data", "sample_prediction.parquet")
)

# Celda que existe en el parquet de predicción
KNOWN_PRED_CELL = "-74.225000_4.425000"


# ─────────────────────────────────────────────────────────
# Fixture: registro de un parquet de predicción de prueba
# ─────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def prediction_file_id():
    """
    Registra el parquet de predicción (long format) y pre-puebla su caché.
    """
    import hashlib, shutil
    from tests.conftest import _populate_parquet_cache
    from app.models.parquet_file import ParquetFile

    _populate_parquet_cache(SAMPLE_PREDICTION_PARQUET)

    db: Session = TestingSessionLocal()
    meta = json.dumps({
        "resolution": 0.05,
        "dataset_type": "prediction",
        "dataset_key": "prediction_main",
        "num_rows": 360,
    })
    pf = ParquetFile(
        filename="sample_prediction.parquet",
        original_filename="sample_prediction.parquet",
        file_size=os.path.getsize(SAMPLE_PREDICTION_PARQUET),
        cloud_url=SAMPLE_PREDICTION_PARQUET,
        cloud_key=SAMPLE_PREDICTION_PARQUET,
        file_metadata=meta,
        status="active",
    )
    db.add(pf)
    db.commit()
    db.refresh(pf)
    pred_id = pf.id
    db.close()
    yield pred_id
    # Cleanup
    db2: Session = TestingSessionLocal()
    existing = db2.query(ParquetFile).filter(ParquetFile.id == pred_id).first()
    if existing:
        db2.delete(existing)
        db2.commit()
    db2.close()


# ─────────────────────────────────────────────────────────
# LISTADO HISTÓRICO DE PREDICCIONES
# ─────────────────────────────────────────────────────────

class TestPredictionHistoryList:
    def test_list_returns_ok(self, client):
        resp = client.get("/api/v1/prediction/history/list")
        assert resp.status_code == 200

    def test_list_has_total_and_predictions(self, client):
        data = client.get("/api/v1/prediction/history/list").json()
        assert "total" in data
        assert "predictions" in data
        assert isinstance(data["predictions"], list)

    def test_list_items_have_required_fields(self, client, prediction_file_id):
        data = client.get("/api/v1/prediction/history/list").json()
        for item in data["predictions"]:
            assert "file_id" in item


# ─────────────────────────────────────────────────────────
# PREDICCIÓN TIMESERIES (1D)
# ─────────────────────────────────────────────────────────

class TestPredictionTimeSeries:
    def test_ts_ok(self, client, prediction_file_id):
        resp = client.post(
            "/api/v1/prediction/timeseries",
            json={
                "parquet_file_id": prediction_file_id,
                "var": "SPI",
                "scale": 1,
                "cell_id": KNOWN_PRED_CELL,
            },
        )
        assert resp.status_code == 200

    def test_ts_file_not_found(self, client):
        resp = client.post(
            "/api/v1/prediction/timeseries",
            json={
                "parquet_file_id": 99999,
                "var": "SPI",
                "scale": 1,
                "cell_id": KNOWN_PRED_CELL,
            },
        )
        assert resp.status_code in (404, 400)


# ─────────────────────────────────────────────────────────
# PREDICCIÓN SPATIAL (2D)
# ─────────────────────────────────────────────────────────

class TestPredictionSpatial:
    def test_spatial_ok(self, client, prediction_file_id):
        resp = client.post(
            "/api/v1/prediction/spatial",
            json={
                "parquet_file_id": prediction_file_id,
                "var": "SPI",
                "scale": 1,
                "horizon": 1,
            },
        )
        assert resp.status_code == 200

    def test_spatial_file_not_found(self, client):
        resp = client.post(
            "/api/v1/prediction/spatial",
            json={"parquet_file_id": 99999, "var": "SPI", "scale": 1, "horizon": 1},
        )
        assert resp.status_code in (404, 400)


# ─────────────────────────────────────────────────────────
# PREDICCIÓN WATERSHED SPATIAL
# ─────────────────────────────────────────────────────────

class TestPredictionWatershedSpatial:
    def test_ok(self, client, prediction_file_id):
        resp = client.post(
            "/api/v1/prediction/watershed/spatial",
            json={
                "parquet_file_id": prediction_file_id,
                "var": "SPI",
                "scale": 1,
                "horizon": 1,
            },
        )
        assert resp.status_code == 200

    def test_file_not_found(self, client):
        resp = client.post(
            "/api/v1/prediction/watershed/spatial",
            json={"parquet_file_id": 99999, "var": "SPI", "scale": 1, "horizon": 1},
        )
        assert resp.status_code in (404, 400)


# ─────────────────────────────────────────────────────────
# PREDICCIÓN WATERSHED TIMESERIES
# ─────────────────────────────────────────────────────────

class TestPredictionWatershedTimeSeries:
    def test_ok(self, client, prediction_file_id):
        resp = client.post(
            "/api/v1/prediction/watershed/timeseries",
            json={
                "parquet_file_id": prediction_file_id,
                "var": "SPI",
                "scale": 1,
                "cuenca_dn": 2,
            },
        )
        assert resp.status_code == 200

    def test_file_not_found(self, client):
        resp = client.post(
            "/api/v1/prediction/watershed/timeseries",
            json={"parquet_file_id": 99999, "var": "SPI", "scale": 1, "cuenca_dn": 2},
        )
        assert resp.status_code in (404, 400)
