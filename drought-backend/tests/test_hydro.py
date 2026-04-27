"""
Tests de endpoints hidrológicos:
  GET  /hydro/stations   → estático, no requiere parquet
  GET  /hydro/indices    → estático, no requiere parquet
  POST /hydro/timeseries → requiere parquet hidrológico (→ 404 sin él)
  POST /hydro/spatial    → requiere parquet hidrológico (→ 404 sin él)
"""

import pytest


# ─────────────────────────────────────────────────────────
# ESTACIONES (sin parquet, siempre disponible)
# ─────────────────────────────────────────────────────────

class TestHydroStations:
    def test_stations_ok(self, client):
        resp = client.get("/api/v1/hydro/stations")
        assert resp.status_code == 200

    def test_stations_has_total(self, client):
        data = client.get("/api/v1/hydro/stations").json()
        assert "total" in data
        assert data["total"] > 0

    def test_stations_list_is_list(self, client):
        data = client.get("/api/v1/hydro/stations").json()
        assert "stations" in data
        assert isinstance(data["stations"], list)

    def test_stations_count_is_29(self, client):
        """El servicio tiene 29 estaciones hidrológicas fijas."""
        data = client.get("/api/v1/hydro/stations").json()
        assert data["total"] == 29
        assert len(data["stations"]) == 29

    def test_station_item_has_fields(self, client):
        data = client.get("/api/v1/hydro/stations").json()
        first = data["stations"][0]
        for field in ("codigo", "name", "lat", "lon"):
            assert field in first, f"Campo '{field}' faltante en estación"

    def test_station_coords_are_numbers(self, client):
        data = client.get("/api/v1/hydro/stations").json()
        for station in data["stations"]:
            assert isinstance(station["lat"], (int, float))
            assert isinstance(station["lon"], (int, float))


# ─────────────────────────────────────────────────────────
# ÍNDICES (sin parquet, siempre disponible)
# ─────────────────────────────────────────────────────────

class TestHydroIndices:
    def test_indices_ok(self, client):
        resp = client.get("/api/v1/hydro/indices")
        assert resp.status_code == 200

    def test_indices_has_total(self, client):
        data = client.get("/api/v1/hydro/indices").json()
        assert "total" in data
        assert data["total"] > 0

    def test_indices_list_is_list(self, client):
        data = client.get("/api/v1/hydro/indices").json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_known_indices_present(self, client):
        """SDI, SRI, MFI, DDI, HDI deben estar en el catálogo (campo 'id')."""
        data = client.get("/api/v1/hydro/indices").json()
        codes = {item.get("id") for item in data["items"]}
        for expected in ("SDI", "SRI", "MFI", "DDI", "HDI"):
            assert expected in codes, f"Índice '{expected}' no encontrado en catálogo"


# ─────────────────────────────────────────────────────────
# TIMESERIES HIDROLÓGICA (requiere parquet)
# ─────────────────────────────────────────────────────────

class TestHydroTimeSeries:
    def test_ts_file_not_found_returns_404(self, client):
        resp = client.post(
            "/api/v1/hydro/timeseries",
            json={
                "parquet_file_id": 99999,
                "station_code": "2120051",
                "index_name": "SDI",
                "scale": 3,
                "start_date": "2000-01-01",
                "end_date": "2002-12-01",
            },
        )
        assert resp.status_code == 404

    def test_ts_no_crash_with_missing_file(self, client):
        """Garantiza que un file_id inexistente no produce 500."""
        resp = client.post(
            "/api/v1/hydro/timeseries",
            json={
                "parquet_file_id": 88888,
                "station_code": "2120051",
                "index_name": "SRI",
                "scale": 1,
                "start_date": "2000-01-01",
                "end_date": "2002-12-01",
            },
        )
        assert resp.status_code != 500

    def test_ts_missing_required_fields_422(self, client):
        resp = client.post("/api/v1/hydro/timeseries", json={})
        assert resp.status_code == 422


# ─────────────────────────────────────────────────────────
# SPATIAL HIDROLÓGICO (requiere parquet)
# ─────────────────────────────────────────────────────────

class TestHydroSpatial:
    def test_spatial_file_not_found_returns_404(self, client):
        resp = client.post(
            "/api/v1/hydro/spatial",
            json={
                "parquet_file_id": 99999,
                "index_name": "SDI",
                "scale": 3,
                "target_date": "2001-06-01",
            },
        )
        assert resp.status_code == 404

    def test_spatial_no_crash_with_missing_file(self, client):
        resp = client.post(
            "/api/v1/hydro/spatial",
            json={
                "parquet_file_id": 88888,
                "index_name": "MFI",
                "scale": 1,
                "target_date": "2001-06-01",
            },
        )
        assert resp.status_code != 500

    def test_spatial_missing_required_fields_422(self, client):
        resp = client.post("/api/v1/hydro/spatial", json={})
        assert resp.status_code == 422
