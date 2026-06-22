"""
Modelos de relaciones zona ↔ celda (cuenca / municipio / perímetro).

Diseño normalizado many-to-many con tres tablas:

  grid_cells          → las celdas (por fuente/resolución: cell_id lon_lat)
  spatial_zones       → las entidades espaciales (cuenca / municipio / perímetro)
  zone_cell_relations → la relación M:N entre zona y celda, con el área de
                        intersección (area_m2) como atributo de la unión.

El promedio ponderado por área usado por los servicios se calcula como:
  valor_zona = Σ(valor_celda × area_interseccion) / Σ(area_interseccion)

Estas relaciones son *metadata* geográfica, por eso viven en la base de datos
relacional (SQLAlchemy), no en la capa de datos científicos (parquet/DuckDB).
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class GridCell(Base):
    """Una celda del grid, identificada por su fuente/resolución y su cell_id."""

    __tablename__ = "grid_cells"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, nullable=False, index=True)   # ERA5 | ERA5_LAND | IMERG | CHIRPS
    cell_id = Column(String, nullable=False, index=True)  # p.ej. "-74.050000_4.850000"
    lon = Column(Float, nullable=True)                    # derivado de cell_id (conveniencia)
    lat = Column(Float, nullable=True)

    relations = relationship(
        "ZoneCellRelation", back_populates="cell", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("source", "cell_id", name="uq_grid_cell_source_cellid"),
    )


class SpatialZone(Base):
    """Una entidad espacial: cuenca, municipio o perímetro urbano."""

    __tablename__ = "spatial_zones"

    id = Column(Integer, primary_key=True, index=True)
    zone_type = Column(String, nullable=False, index=True)  # cuenca | municipio | perimetro
    dn = Column(Integer, nullable=False)
    nombre = Column(String, nullable=False)

    cell_relations = relationship(
        "ZoneCellRelation", back_populates="zone", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("zone_type", "dn", name="uq_spatial_zone_type_dn"),
    )


class ZoneCellRelation(Base):
    """Relación M:N zona ↔ celda con el área de intersección en m²."""

    __tablename__ = "zone_cell_relations"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(
        Integer,
        ForeignKey("spatial_zones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cell_id_ref = Column(
        Integer,
        ForeignKey("grid_cells.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    area_m2 = Column(Float, nullable=False)

    zone = relationship("SpatialZone", back_populates="cell_relations")
    cell = relationship("GridCell", back_populates="relations")

    __table_args__ = (
        UniqueConstraint("zone_id", "cell_id_ref", name="uq_zone_cell_relation"),
        Index("ix_zcr_zone_cell", "zone_id", "cell_id_ref"),
    )
