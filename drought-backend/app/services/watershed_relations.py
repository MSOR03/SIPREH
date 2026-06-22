"""
Repositorio de relaciones zona ↔ celda — respaldado por la base de datos.

Las relaciones (cuenca / municipio / perímetro) viven ahora en las tablas
``grid_cells``, ``spatial_zones`` y ``zone_cell_relations`` (ver
``app/models/zone_relation.py``). Los datos semilla y la carga idempotente están
en ``app/db/seed_zones.py``.

Este módulo conserva **la misma API pública** que la versión anterior basada en
literales, por lo que ningún consumidor cambia:

    get_zone_names(zone_type)               -> {dn: nombre}
    get_zone_relations(source, zone_type)   -> [{cell_id, nombre, dn, area_m2}]
    get_zone_cell_ids(source, zone_type)    -> [cell_id, ...]

Internamente se lee de la base de datos una sola vez y se cachea en memoria
(los datos son estáticos). Si las tablas están vacías se auto-siembran (útil en
entornos nuevos, tests y primer arranque). ``refresh_zone_cache()`` invalida el
caché tras una re-siembra.
"""
from threading import Lock
from typing import Optional

from app.db.session import SessionLocal
from app.db.seed_zones import seed_zone_relations, SOURCE_RESOLUTION  # re-export

# Tipos de zona válidos (preserva el contrato de ValueError ante tipos desconocidos).
KNOWN_ZONE_TYPES = ("cuenca", "municipio", "perimetro")

# ──────────────────────────────────────────────────────────
# ERA5 Land (0.1°) — 75 centroides. Catálogo de celdas legacy conservado para
# compatibilidad de get_cell_ids_for_source(); no lo consume ningún flujo activo.
# ──────────────────────────────────────────────────────────
ERA5_LAND_CELL_IDS = [
    "-73.600000_4.500000", "-73.600000_4.600000", "-73.600000_4.700000",
    "-73.600000_5.000000", "-73.600000_5.100000", "-73.700000_4.500000",
    "-73.700000_4.600000", "-73.700000_4.700000", "-73.700000_4.900000",
    "-73.700000_5.000000", "-73.700000_5.100000", "-73.800000_4.500000",
    "-73.800000_4.600000", "-73.800000_4.700000", "-73.800000_4.800000",
    "-73.800000_4.900000", "-73.800000_5.000000", "-73.800000_5.100000",
    "-73.800000_5.200000", "-73.800000_5.300000", "-73.900000_4.600000",
    "-73.900000_4.700000", "-73.900000_4.800000", "-73.900000_4.900000",
    "-73.900000_5.000000", "-73.900000_5.100000", "-73.900000_5.200000",
    "-73.900000_5.300000", "-74.000000_4.500000", "-74.000000_4.600000",
    "-74.000000_4.700000", "-74.000000_4.800000", "-74.000000_4.900000",
    "-74.000000_5.000000", "-74.000000_5.100000", "-74.000000_5.200000",
    "-74.000000_5.300000", "-74.100000_4.000000", "-74.100000_4.100000",
    "-74.100000_4.200000", "-74.100000_4.300000", "-74.100000_4.400000",
    "-74.100000_4.500000", "-74.100000_4.600000", "-74.100000_4.700000",
    "-74.100000_4.800000", "-74.100000_4.900000", "-74.100000_5.000000",
    "-74.100000_5.100000", "-74.100000_5.200000", "-74.200000_3.900000",
    "-74.200000_4.000000", "-74.200000_4.100000", "-74.200000_4.200000",
    "-74.200000_4.300000", "-74.200000_4.400000", "-74.200000_4.500000",
    "-74.200000_4.600000", "-74.200000_4.700000", "-74.200000_4.800000",
    "-74.300000_3.800000", "-74.300000_3.900000", "-74.300000_4.000000",
    "-74.300000_4.100000", "-74.300000_4.200000", "-74.300000_4.300000",
    "-74.300000_4.400000", "-74.300000_4.600000", "-74.400000_3.700000",
    "-74.400000_3.800000", "-74.400000_3.900000", "-74.400000_4.000000",
    "-74.400000_4.100000", "-74.500000_3.700000", "-74.500000_3.800000",
]


# ──────────────────────────────────────────────────────────
# Caché en memoria (cargado desde la base de datos)
# ──────────────────────────────────────────────────────────
_CACHE: Optional[dict] = None
_CACHE_LOCK = Lock()


def _load_cache() -> dict:
    """Lee todas las zonas/relaciones de la base de datos y construye el caché."""
    from app.models.zone_relation import GridCell, SpatialZone, ZoneCellRelation

    names: dict = {}      # zone_type -> {dn: nombre}
    relations: dict = {}  # (zone_type, SOURCE) -> [ {cell_id, nombre, dn, area_m2} ]

    db = SessionLocal()
    try:
        # Auto-siembra si las tablas están vacías (entorno nuevo / tests / primer arranque).
        if db.query(SpatialZone).first() is None:
            seed_zone_relations(db)

        for z in db.query(SpatialZone).all():
            names.setdefault(z.zone_type, {})[z.dn] = z.nombre

        rows = (
            db.query(
                SpatialZone.zone_type,
                GridCell.source,
                GridCell.cell_id,
                SpatialZone.nombre,
                SpatialZone.dn,
                ZoneCellRelation.area_m2,
            )
            .join(SpatialZone, ZoneCellRelation.zone_id == SpatialZone.id)
            .join(GridCell, ZoneCellRelation.cell_id_ref == GridCell.id)
            .all()
        )
        for zone_type, source, cell_id, nombre, dn, area_m2 in rows:
            relations.setdefault((zone_type, source.upper()), []).append(
                {"cell_id": cell_id, "nombre": nombre, "dn": dn, "area_m2": area_m2}
            )
    finally:
        db.close()

    return {"names": names, "relations": relations}


def _ensure_cache() -> dict:
    global _CACHE
    if _CACHE is None:
        with _CACHE_LOCK:
            if _CACHE is None:
                _CACHE = _load_cache()
    return _CACHE


def refresh_zone_cache() -> None:
    """Invalida el caché en memoria (llamar tras re-sembrar la base de datos)."""
    global _CACHE
    with _CACHE_LOCK:
        _CACHE = None


def _validate_zone_type(zone_type: str) -> None:
    if zone_type not in KNOWN_ZONE_TYPES:
        raise ValueError(
            f"Tipo de zona desconocido: {zone_type}. Usar cuenca, municipio o perimetro."
        )


# ──────────────────────────────────────────────────────────
# API pública (compatible con la versión anterior)
# ──────────────────────────────────────────────────────────
def get_zone_names(zone_type: str) -> dict:
    """Retorna el mapping {dn: nombre} para un tipo de zona (cuenca/municipio/perimetro)."""
    _validate_zone_type(zone_type)
    return dict(_ensure_cache()["names"].get(zone_type, {}))


def get_zone_relations(source: str, zone_type: str = "cuenca") -> list:
    """Retorna las relaciones zona-celda para una fuente y tipo de zona dados."""
    _validate_zone_type(zone_type)
    cache = _ensure_cache()
    return list(cache["relations"].get((zone_type, source.upper()), []))


def get_zone_cell_ids(source: str, zone_type: str = "cuenca") -> list:
    """Retorna lista única de cell_ids relevantes para una fuente y tipo de zona."""
    relations = get_zone_relations(source, zone_type)
    return list({r["cell_id"] for r in relations})


# ── Helpers legacy (cuenca) — respaldados por base de datos ────────────────
def get_relations_for_source(source: str) -> list:
    """Retorna las relaciones cuenca-celda para una fuente dada."""
    return get_zone_relations(source, "cuenca")


def get_cell_ids_for_source(source: str) -> list:
    """Retorna lista única de cell_ids (cuenca) para una fuente."""
    if source.upper() == "ERA5_LAND":
        return list(ERA5_LAND_CELL_IDS)
    return get_zone_cell_ids(source, "cuenca")


def get_cuencas_for_source(source: str) -> list:
    """Retorna lista de cuencas únicas [{dn, nombre}] para una fuente."""
    relations = get_relations_for_source(source)
    seen: dict = {}
    for r in relations:
        if r["dn"] not in seen:
            seen[r["dn"]] = {"dn": r["dn"], "nombre": r["nombre"]}
    return list(seen.values())
