"""
Siembra (upsert idempotente) de las relaciones zona ↔ celda en la base de datos.

Crea las tablas si no existen y carga/actualiza las relaciones definidas en
``app/db/seed_zones.py``. Re-ejecutar es seguro: solo agrega lo nuevo y nunca
duplica filas.

USO:
    cd drought-backend
    python -m scripts.seed_zones            # upsert idempotente
    python -m scripts.seed_zones --force    # borra y reconstruye desde cero

Para agregar más relaciones: editar las listas en app/db/seed_zones.py y volver
a ejecutar este script.
"""
import sys

from app.db.base import Base
from app.db.session import engine, get_db
from app.db.seed_zones import seed_zone_relations
from app.services.watershed_relations import refresh_zone_cache


def main():
    force = "--force" in sys.argv

    print("Creando tablas (si no existen)...")
    Base.metadata.create_all(bind=engine)

    db = next(get_db())
    try:
        if force:
            print("⚠️  --force: borrando y reconstruyendo todas las relaciones...")
        stats = seed_zone_relations(db, force=force)
    finally:
        db.close()

    # Invalidar el caché en memoria para que el proceso refleje los cambios.
    refresh_zone_cache()

    print(
        "✓ Relaciones sembradas: "
        f"+{stats['cells_added']} celdas, "
        f"+{stats['zones_added']} zonas, "
        f"+{stats['relations_added']} relaciones, "
        f"~{stats['relations_updated']} actualizadas"
    )
    if not any(stats.values()):
        print("  (todo ya estaba al día; no se insertó ni actualizó nada)")


if __name__ == "__main__":
    main()
