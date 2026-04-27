"""
Tests de análisis histórico:
  - GET  /historical/catalog/variables
  - GET  /historical/catalog/drought-indices
  - GET  /historical/catalog/all
  - GET  /historical/files
  - GET  /historical/files/{id}/info  (no disponible sin cloud real → skip)
  - GET  /historical/files/{id}/cells
  - POST /historical/timeseries
  - POST /historical/spatial
"""

import pytest
from tests.conftest import KNOWN_CELL_ID, KNOWN_DATE


# ─────────────────────────────────────────────────────────
# CATÁLOGOS (no requieren archivo)
# ─────────────────────────────────────────────────────────

class TestCatalogs:
    def test_catalog_variables(self, client):
        resp = client.get("/api/v1/historical/catalog/variables")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0
        ids = [v["id"] for v in data["items"]]
        assert "precip" in ids
        assert "tmean"  in ids

    def test_catalog_drought_indices(self, client):
        resp = client.get("/api/v1/historical/catalog/drought-indices")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0
        ids = [v["id"] for v in data["items"]]
        for expected in ("SPI", "SPEI", "RAI", "EDDI", "PDSI"):
            assert expected in ids, f"Índice {expected} no encontrado en catálogo"

    def test_catalog_all(self, client):
        resp = client.get("/api/v1/historical/catalog/all")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0

    def test_catalog_items_have_required_fields(self, client):
        resp = client.get("/api/v1/historical/catalog/variables")
        for item in resp.json()["items"]:
            assert "id"       in item
            assert "name"     in item
            assert "unit"     in item
            assert "category" in item


# ─────────────────────────────────────────────────────────
# LISTADO DE ARCHIVOS
# ─────────────────────────────────────────────────────────

class TestFilesList:
    def test_list_files_returns_list(self, client, chirps_file_id):
        resp = client.get("/api/v1/historical/files")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_list_files_contains_test_file(self, client, chirps_file_id):
        resp = client.get("/api/v1/historical/files")
        ids = [f["file_id"] for f in resp.json()]
        assert chirps_file_id in ids

    def test_list_files_filter_historical(self, client, chirps_file_id):
        resp = client.get("/api/v1/historical/files?dataset_type=historical")
        assert resp.status_code == 200
        for f in resp.json():
            assert f["dataset_type"] in (None, "historical")

    def test_list_files_filter_unknown_type(self, client):
        resp = client.get("/api/v1/historical/files?dataset_type=nonexistent_type")
        assert resp.status_code == 200
        # Puede retornar lista vacía — no debe explotar
        assert isinstance(resp.json(), list)


# ─────────────────────────────────────────────────────────
# CELDAS DEL ARCHIVO
# ─────────────────────────────────────────────────────────

class TestFileCells:
    def test_file_cells_ok(self, client, chirps_file_id):
        resp = client.get(f"/api/v1/historical/files/{chirps_file_id}/cells")
        assert resp.status_code == 200
        data = resp.json()
        assert "cells" in data
        assert len(data["cells"]) > 0
        assert data["total_cells"] == len(data["cells"])

    def test_file_cells_contains_known_cell(self, client, chirps_file_id):
        resp = client.get(f"/api/v1/historical/files/{chirps_file_id}/cells")
        cells = resp.json()["cells"]
        assert KNOWN_CELL_ID in cells, f"Celda {KNOWN_CELL_ID} no encontrada en el archivo"

    def test_file_cells_not_found(self, client):
        resp = client.get("/api/v1/historical/files/99999/cells")
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────
# SERIE DE TIEMPO (1D)
# ─────────────────────────────────────────────────────────

class TestTimeSeries:
    def _payload(self, chirps_file_id, variable="precip", cell_id=KNOWN_CELL_ID,
                 start="2000-01-01", end="2002-12-01"):
        return {
            "parquet_file_id": chirps_file_id,
            "variable": variable,
            "start_date": start,
            "end_date": end,
            "cell_id": cell_id,
        }

    def test_timeseries_precip_ok(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/timeseries",
            json=self._payload(chirps_file_id),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "data"       in data
        assert "statistics" in data
        assert len(data["data"]) > 0

    def test_timeseries_data_has_date_and_value(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/timeseries",
            json=self._payload(chirps_file_id),
        )
        for point in resp.json()["data"]:
            assert "date"  in point
            assert "value" in point

    def test_timeseries_spi_index(self, client, chirps_file_id):
        """SPI1 is a direct column in the wide-format test parquet."""
        resp = client.post(
            "/api/v1/historical/timeseries",
            json=self._payload(chirps_file_id, variable="SPI1", cell_id=KNOWN_CELL_ID),
        )
        assert resp.status_code == 200
        assert len(resp.json()["data"]) > 0

    def test_timeseries_spi_with_scale(self, client, chirps_file_id):
        """SPI3 is a direct wide-format column; no 'scale' param needed."""
        resp = client.post(
            "/api/v1/historical/timeseries",
            json=self._payload(chirps_file_id, variable="SPI3", cell_id=KNOWN_CELL_ID),
        )
        assert resp.status_code == 200

    def test_timeseries_file_not_found(self, client):
        resp = client.post(
            "/api/v1/historical/timeseries",
            json={
                "parquet_file_id": 99999,
                "variable": "precip",
                "start_date": "2000-01-01",
                "end_date": "2001-01-01",
                "cell_id": KNOWN_CELL_ID,
            },
        )
        assert resp.status_code == 404

    def test_timeseries_missing_required_fields(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/timeseries",
            json={"parquet_file_id": chirps_file_id, "variable": "precip"},
        )
        assert resp.status_code == 422

    def test_timeseries_statistics_fields(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/timeseries",
            json=self._payload(chirps_file_id),
        )
        stats = resp.json()["statistics"]
        for field in ("mean", "min", "max", "count"):
            assert field in stats, f"Campo {field} no encontrado en statistics"

    def test_timeseries_frequency_monthly(self, client, chirps_file_id):
        payload = self._payload(chirps_file_id)
        payload["frequency"] = "M"
        resp = client.post("/api/v1/historical/timeseries", json=payload)
        assert resp.status_code == 200
        assert resp.json()["frequency"] in ("M", "MS", "monthly")


# ─────────────────────────────────────────────────────────
# DATOS ESPACIALES (2D)
# ─────────────────────────────────────────────────────────

class TestSpatialData:
    def _payload(self, chirps_file_id, variable="precip", target_date=KNOWN_DATE):
        return {
            "parquet_file_id": chirps_file_id,
            "variable": variable,
            "target_date": target_date,
        }

    def test_spatial_precip_ok(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/spatial",
            json=self._payload(chirps_file_id),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "grid_cells" in data
        assert len(data["grid_cells"]) > 0

    def test_spatial_cells_have_required_fields(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/spatial",
            json=self._payload(chirps_file_id),
        )
        for cell in resp.json()["grid_cells"]:
            assert "cell_id" in cell
            assert "lat"     in cell
            assert "lon"     in cell
            assert "value"   in cell

    def test_spatial_spi_index(self, client, chirps_file_id):
        """SPI1 is a direct column in the wide-format test parquet."""
        resp = client.post(
            "/api/v1/historical/spatial",
            json=self._payload(chirps_file_id, variable="SPI1"),
        )
        assert resp.status_code == 200

    def test_spatial_interval_mode(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/spatial",
            json={
                "parquet_file_id": chirps_file_id,
                "variable": "precip",
                "start_date": "2001-01-01",
                "end_date": "2001-06-01",
                "use_interval": True,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_interval"] is True
        assert len(data["grid_cells"]) > 0

    def test_spatial_interval_invalid_dates(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/spatial",
            json={
                "parquet_file_id": chirps_file_id,
                "variable": "precip",
                "start_date": "2002-01-01",
                "end_date": "2001-01-01",
                "use_interval": True,
            },
        )
        assert resp.status_code == 400

    def test_spatial_no_date_no_interval(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/spatial",
            json={"parquet_file_id": chirps_file_id, "variable": "precip"},
        )
        assert resp.status_code == 400

    def test_spatial_file_not_found(self, client):
        resp = client.post(
            "/api/v1/historical/spatial",
            json={"parquet_file_id": 99999, "variable": "precip", "target_date": KNOWN_DATE},
        )
        assert resp.status_code == 404

    def test_spatial_statistics_present(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/spatial",
            json=self._payload(chirps_file_id),
        )
        stats = resp.json()["statistics"]
        for field in ("mean", "min", "max", "count"):
            assert field in stats
