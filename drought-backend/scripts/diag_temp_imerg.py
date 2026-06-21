"""
Diagnóstico: por qué temperatura+IMERG falla en consultas zonales (cuenca/municipio/perímetro).

Determina si el problema es:
  (A) la columna 'source' (temperatura no está bajo SAT_LSCDF), o
  (B) la columna 'cell_id' (temperatura no comparte las celdas de la zona).

USO:
    cd drought-backend
    python -m scripts.diag_temp_imerg <cloud_key_o_path_del_parquet_IMERG> [variable]

Ej.:
    python -m scripts.diag_temp_imerg grid_IMERG.parquet tmean
"""
import sys

from app.services.historical_data_service import HistoricalDataService
from app.services.watershed_relations import get_zone_cell_ids


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    parquet_url = sys.argv[1]
    variable = sys.argv[2] if len(sys.argv) > 2 else "tmean"

    svc = HistoricalDataService()
    conn = svc._get_connection()
    src = svc._resolve_parquet_source(parquet_url)["source_expr"]

    print(f"\n=== Parquet: {parquet_url} | variable: {variable} ===\n")

    cols = [r[1] for r in conn.execute(f"DESCRIBE SELECT * FROM {src} LIMIT 1").fetchall()]
    print("Columnas:", cols)
    has_source = "source" in cols
    has_cellid = "cell_id" in cols
    has_latlon = "lat" in cols and "lon" in cols
    var_col = "var" if "var" in cols else None

    if var_col is None:
        print("\n⚠️  Formato 'wide' (sin columna 'var'); el filtro de source/var no aplica igual.")
        return

    # (A) ¿Bajo qué 'source' está la temperatura?
    if has_source:
        rows = conn.execute(
            f"SELECT source, COUNT(*) FROM {src} WHERE {var_col} = '{variable}' GROUP BY source ORDER BY 2 DESC"
        ).fetchall()
        print(f"\n[A] Valores de 'source' para {variable}:")
        for s, n in rows:
            print(f"     source={s!r:20} filas={n}")
        print("     (la consulta zonal filtra source='SAT_LSCDF' para IMERG)")
    else:
        print("\n[A] El parquet no tiene columna 'source'.")

    # (B) ¿Las celdas de temperatura coinciden con las celdas de la zona?
    if has_cellid:
        total, nonnull, distinct = conn.execute(
            f"SELECT COUNT(*), COUNT(cell_id), COUNT(DISTINCT cell_id) "
            f"FROM {src} WHERE {var_col} = '{variable}'"
        ).fetchone()
        print(f"\n[B] cell_id en filas de {variable}: total={total} no_null={nonnull} distintos={distinct}")
        sample = [r[0] for r in conn.execute(
            f"SELECT DISTINCT cell_id FROM {src} WHERE {var_col} = '{variable}' AND cell_id IS NOT NULL LIMIT 5"
        ).fetchall()]
        print(f"     ejemplos de cell_id ({variable}):", sample)

        for zt in ("cuenca", "municipio", "perimetro"):
            zone_cells = set(get_zone_cell_ids("IMERG", zt))
            data_cells = set(r[0] for r in conn.execute(
                f"SELECT DISTINCT cell_id FROM {src} WHERE {var_col} = '{variable}'"
            ).fetchall())
            overlap = zone_cells & data_cells
            print(f"     zona={zt:10} celdas_zona={len(zone_cells):3} coinciden_con_datos={len(overlap)}")
    elif has_latlon:
        print("\n[B] El parquet usa lat/lon (sin cell_id). El mixin zonal asume cell_id → ahí está el bug.")
    else:
        print("\n[B] No hay cell_id ni lat/lon claros.")

    print("\nInterpretación:")
    print("  - Si [A] muestra source != SAT_LSCDF  → era el filtro de source (lo arregla el fallback).")
    print("  - Si [B] coinciden=0 para las zonas    → es el cell_id (temperatura en otra malla).")


if __name__ == "__main__":
    main()
