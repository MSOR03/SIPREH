"""
Tests de cuencas / watershed:
  POST /historical/watershed/spatial
  POST /historical/watershed/timeseries

Cubre los 3 sources (CHIRPS / IMERG / ERA5) y los 7 DNs definidos en
watershed_relations.py. El parquet de prueba tiene las celdas CHIRPS, por lo
que CHIRPS dará resultados con datos reales; IMERG/ERA5 retornarán cuencas con
value=null (no hay celdas de esa resolución en el parquet) — lo que es
comportamiento válido que también se prueba.
"""

import pytest
from tests.conftest import KNOWN_DATE


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def _spatial_payload(file_id, source="CHIRPS", variable="precip",
                     target_date=KNOWN_DATE, **extra):
    p = {
        "parquet_file_id": file_id,
        "variable": variable,
        "data_source": source,
        "target_date": target_date,
    }
    p.update(extra)
    return p


def _ts_payload(file_id, dn=2, source="CHIRPS", variable="precip",
                start="2000-01-01", end="2002-12-01"):
    return {
        "parquet_file_id": file_id,
        "variable": variable,
        "data_source": source,
        "cuenca_dn": dn,
        "start_date": start,
        "end_date": end,
    }


# ─────────────────────────────────────────────────────────
# WATERSHED SPATIAL
# ─────────────────────────────────────────────────────────

class TestWatershedSpatial:
    def test_chirps_spatial_ok(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS"),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "cuencas" in data
        assert len(data["cuencas"]) == 7  # Siempre retorna los 7 DNs

    def test_cuencas_have_required_fields(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS"),
        )
        for c in resp.json()["cuencas"]:
            assert "dn"     in c
            assert "nombre" in c
            assert "value"  in c  # puede ser null si no hay celdas

    def test_all_7_dn_present(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS"),
        )
        dns = {c["dn"] for c in resp.json()["cuencas"]}
        assert dns == {1, 2, 3, 4, 5, 6, 7}

    def test_chisaca_dn2_has_value(self, client, chirps_file_id):
        """Chisaca (DN=2) tiene celdas CHIRPS → debe tener valor numérico."""
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS"),
        )
        chisaca = next(c for c in resp.json()["cuencas"] if c["dn"] == 2)
        assert chisaca["value"] is not None, "Chisaca debería tener un valor con CHIRPS"

    def test_la_regadera_dn1_has_value(self, client, chirps_file_id):
        """La Regadera (DN=1) también tiene celdas CHIRPS."""
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS"),
        )
        regadera = next(c for c in resp.json()["cuencas"] if c["dn"] == 1)
        assert regadera["value"] is not None, "La Regadera debería tener un valor con CHIRPS"

    def test_spi_index_spatial(self, client, chirps_file_id):
        """SPI1 is a direct wide-format column in the test parquet."""
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS", variable="SPI1"),
        )
        assert resp.status_code == 200

    def test_source_in_response(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS"),
        )
        # El response debe indicar la fuente usada
        assert resp.json().get("data_source") == "CHIRPS"

    def test_interval_mode(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json={
                "parquet_file_id": chirps_file_id,
                "variable": "precip",
                "data_source": "CHIRPS",
                "start_date": "2001-01-01",
                "end_date": "2001-12-01",
                "use_interval": True,
            },
        )
        assert resp.status_code == 200
        assert len(resp.json()["cuencas"]) == 7

    def test_file_not_found(self, client):
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(99999, source="CHIRPS"),
        )
        assert resp.status_code == 404

    def test_invalid_source(self, client, chirps_file_id):
        """Source desconocido debe retornar 400 o cuencas vacías, no 500."""
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="UNKNOWN_SOURCE"),
        )
        assert resp.status_code in (400, 404, 422)


# ─────────────────────────────────────────────────────────
# WATERSHED TIMESERIES
# ─────────────────────────────────────────────────────────

class TestWatershedTimeSeries:
    def test_timeseries_chisaca_ok(self, client, chirps_file_id):
        """Chisaca (DN=2) con CHIRPS debe retornar serie temporal."""
        resp = client.post(
            "/api/v1/historical/watershed/timeseries",
            json=_ts_payload(chirps_file_id, dn=2, source="CHIRPS"),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "data" in data
        assert len(data["data"]) > 0

    def test_timeseries_la_regadera_ok(self, client, chirps_file_id):
        """La Regadera (DN=1) con CHIRPS."""
        resp = client.post(
            "/api/v1/historical/watershed/timeseries",
            json=_ts_payload(chirps_file_id, dn=1, source="CHIRPS"),
        )
        assert resp.status_code == 200
        assert len(resp.json()["data"]) > 0

    def test_timeseries_data_has_date_value(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/timeseries",
            json=_ts_payload(chirps_file_id, dn=2, source="CHIRPS"),
        )
        for pt in resp.json()["data"]:
            assert "date"  in pt
            assert "value" in pt

    def test_timeseries_spi_with_scale(self, client, chirps_file_id):
        """SPI3 is a direct wide-format column; no separate scale field needed."""
        resp = client.post(
            "/api/v1/historical/watershed/timeseries",
            json=_ts_payload(chirps_file_id, dn=2, source="CHIRPS", variable="SPI3"),
        )
        assert resp.status_code == 200

    def test_timeseries_all_cuencas_iterate(self, client, chirps_file_id):
        """Iterar por todos los DNs no debe explotar (algunos tendrán lista vacía)."""
        for dn in range(1, 8):
            resp = client.post(
                "/api/v1/historical/watershed/timeseries",
                json=_ts_payload(chirps_file_id, dn=dn, source="CHIRPS"),
            )
            assert resp.status_code == 200, f"DN={dn} causó {resp.status_code}"

    def test_timeseries_file_not_found(self, client):
        resp = client.post(
            "/api/v1/historical/watershed/timeseries",
            json=_ts_payload(99999, dn=2),
        )
        assert resp.status_code == 404

    def test_timeseries_invalid_dn(self, client, chirps_file_id):
        """DN=99 no existe en watershed_relations → data vacía o 404, no 500."""
        resp = client.post(
            "/api/v1/historical/watershed/timeseries",
            json=_ts_payload(chirps_file_id, dn=99, source="CHIRPS"),
        )
        assert resp.status_code in (200, 404, 400)
        if resp.status_code == 200:
            assert resp.json()["data"] == []

    def test_timeseries_missing_required_fields(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/timeseries",
            json={"parquet_file_id": chirps_file_id, "variable": "precip"},
        )
        assert resp.status_code == 422


# ─────────────────────────────────────────────────────────
# SOURCE RESOLUTION CONSISTENCY
# ─────────────────────────────────────────────────────────

class TestSourceResolutionConsistency:
    """
    Verifica que el mapping fuente↔resolución es consistent:
    ERA5=0.25, IMERG=0.1, CHIRPS=0.05.
    El parquet de prueba solo tiene celdas CHIRPS, así que ERA5/IMERG
    retornarán cuencas con value=null — eso es correcto y no debe crashear.
    """

    def test_era5_source_no_crash(self, client, chirps_file_id):
        """ERA5 no tiene celdas en el parquet de prueba; no debe dar 500."""
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="ERA5"),
        )
        # 404 es aceptable (archivo de resolución 0.25 no existe),
        # 200 con valores null también es aceptable
        assert resp.status_code in (200, 404)

    def test_imerg_source_no_crash(self, client, chirps_file_id):
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="IMERG"),
        )
        assert resp.status_code in (200, 404)

    def test_chirps_returns_data(self, client, chirps_file_id):
        """CHIRPS sí tiene datos en el parquet de prueba."""
        resp = client.post(
            "/api/v1/historical/watershed/spatial",
            json=_spatial_payload(chirps_file_id, source="CHIRPS"),
        )
        assert resp.status_code == 200
        values_with_data = [c for c in resp.json()["cuencas"] if c["value"] is not None]
        assert len(values_with_data) > 0, "CHIRPS debería tener al menos 1 cuenca con dato"
