"""
Datos semilla y función de carga para las relaciones zona ↔ celda.

Aquí viven los literales (antes en ``app/services/watershed_relations.py``). La
función ``seed_zone_relations`` puebla las tablas ``grid_cells``,
``spatial_zones`` y ``zone_cell_relations`` mediante un *upsert idempotente*:
se puede ejecutar tantas veces como se quiera y solo inserta lo nuevo; nunca
duplica filas (las claves naturales + las restricciones UNIQUE lo garantizan).

Para agregar más relaciones en el futuro:
  1. Añadir entradas a las listas/diccionarios de abajo (nuevas celdas, una
     nueva zona en ``*_NAMES`` y/o nuevas filas en ``*_RELATIONS``).
  2. Ejecutar ``python scripts/seed_zones.py`` (o ``python init_db.py``).
No hace falta SQL manual y no hay riesgo de duplicados.

Cada relación es ``{cell_id, nombre, dn, area_m2}`` agrupada por (zona, fuente).
"""

# ──────────────────────────────────────────────────────────
# DN → Nombre por tipo de zona
# ──────────────────────────────────────────────────────────
CUENCA_NAMES = {
    1: "La regadera",
    2: "Chisaca",
    3: "Sisga",
    4: "Chuza",
    5: "Neusa",
    6: "Tomine",
    7: "San Rafael",
}

MUNICIPIO_NAMES = {1: "Bogotá"}
PERIMETRO_NAMES = {1: "Centro Urb"}

# Mapping fuente → resolución (referencia)
SOURCE_RESOLUTION = {
    "ERA5": 0.25,
    "IMERG": 0.1,
    "ERA5_LAND": 0.1,
    "CHIRPS": 0.05,
}

# ──────────────────────────────────────────────────────────
# CUENCAS — ERA5 (0.25°)
# ──────────────────────────────────────────────────────────
ERA5_RELATIONS = [
    {"cell_id": "-74.125000_4.375000", "nombre": "Chisaca", "dn": 2, "area_m2": 162062675.046},
    {"cell_id": "-74.125000_4.375000", "nombre": "La regadera", "dn": 1, "area_m2": 162062675.046},
    {"cell_id": "-73.875000_5.125000", "nombre": "Neusa", "dn": 5, "area_m2": 127254787.992},
    {"cell_id": "-73.875000_5.125000", "nombre": "Tomine", "dn": 6, "area_m2": 127254787.992},
    {"cell_id": "-73.875000_5.125000", "nombre": "Sisga", "dn": 3, "area_m2": 127254787.992},
    {"cell_id": "-73.625000_5.125000", "nombre": "Sisga", "dn": 3, "area_m2": 74784560.394},
    {"cell_id": "-73.875000_4.875000", "nombre": "Tomine", "dn": 6, "area_m2": 359434592.535},
    {"cell_id": "-73.875000_4.875000", "nombre": "Sisga", "dn": 3, "area_m2": 359434592.535},
    {"cell_id": "-73.875000_4.625000", "nombre": "San Rafael", "dn": 7, "area_m2": 75794793.914},
    {"cell_id": "-73.875000_4.625000", "nombre": "Chuza", "dn": 4, "area_m2": 75794793.914},
    {"cell_id": "-73.875000_4.625000", "nombre": "Tomine", "dn": 6, "area_m2": 75794793.914},
    {"cell_id": "-73.625000_4.625000", "nombre": "Chuza", "dn": 4, "area_m2": 65887034.706},
    {"cell_id": "-74.125000_5.125000", "nombre": "Neusa", "dn": 5, "area_m2": 46779471.384},
    {"cell_id": "-74.125000_4.625000", "nombre": "San Rafael", "dn": 7, "area_m2": 44903130.182},
]

# ──────────────────────────────────────────────────────────
# CUENCAS — IMERG (0.1°)
# ──────────────────────────────────────────────────────────
IMERG_RELATIONS = [
    {"cell_id": "-74.250000_4.450000", "nombre": "Chisaca", "dn": 2, "area_m2": 1501528.095},
    {"cell_id": "-74.250000_4.450000", "nombre": "La regadera", "dn": 1, "area_m2": 1501528.095},
    {"cell_id": "-74.150000_4.450000", "nombre": "Chisaca", "dn": 2, "area_m2": 12872377.643},
    {"cell_id": "-74.150000_4.450000", "nombre": "La regadera", "dn": 1, "area_m2": 12872377.643},
    {"cell_id": "-74.250000_4.350000", "nombre": "Chisaca", "dn": 2, "area_m2": 20292545.494},
    {"cell_id": "-74.250000_4.350000", "nombre": "La regadera", "dn": 1, "area_m2": 20292545.494},
    {"cell_id": "-74.150000_4.350000", "nombre": "Chisaca", "dn": 2, "area_m2": 112491018.390},
    {"cell_id": "-74.150000_4.350000", "nombre": "La regadera", "dn": 1, "area_m2": 112491018.390},
    {"cell_id": "-74.250000_4.250000", "nombre": "Chisaca", "dn": 2, "area_m2": 4481082.454},
    {"cell_id": "-74.250000_4.250000", "nombre": "La regadera", "dn": 1, "area_m2": 4481082.454},
    {"cell_id": "-74.150000_4.250000", "nombre": "Chisaca", "dn": 2, "area_m2": 9251456.429},
    {"cell_id": "-74.150000_4.250000", "nombre": "La regadera", "dn": 1, "area_m2": 9251456.429},
    {"cell_id": "-73.850000_5.050000", "nombre": "Tomine", "dn": 6, "area_m2": 14877027.717},
    {"cell_id": "-73.750000_5.050000", "nombre": "Tomine", "dn": 6, "area_m2": 72749188.381},
    {"cell_id": "-73.750000_5.050000", "nombre": "Sisga", "dn": 3, "area_m2": 72749188.381},
    {"cell_id": "-73.950000_4.950000", "nombre": "Tomine", "dn": 6, "area_m2": 5768528.873},
    {"cell_id": "-73.850000_4.950000", "nombre": "Tomine", "dn": 6, "area_m2": 100830383.096},
    {"cell_id": "-73.750000_4.950000", "nombre": "Tomine", "dn": 6, "area_m2": 90248944.030},
    {"cell_id": "-73.750000_4.950000", "nombre": "Sisga", "dn": 3, "area_m2": 90248944.030},
    {"cell_id": "-73.950000_4.850000", "nombre": "Tomine", "dn": 6, "area_m2": 25499691.965},
    {"cell_id": "-73.850000_4.850000", "nombre": "Tomine", "dn": 6, "area_m2": 113526778.778},
    {"cell_id": "-73.750000_4.850000", "nombre": "Tomine", "dn": 6, "area_m2": 11045663.466},
    {"cell_id": "-73.950000_4.750000", "nombre": "Tomine", "dn": 6, "area_m2": 15876099.882},
    {"cell_id": "-73.950000_4.750000", "nombre": "San Rafael", "dn": 7, "area_m2": 15876099.882},
    {"cell_id": "-73.850000_4.750000", "nombre": "Tomine", "dn": 5, "area_m2": 42945624.058},
    {"cell_id": "-73.750000_4.650000", "nombre": "Chuza", "dn": 4, "area_m2": 72113012.483},
    {"cell_id": "-73.650000_4.650000", "nombre": "Chuza", "dn": 4, "area_m2": 543310.248},
    {"cell_id": "-73.750000_4.550000", "nombre": "Chuza", "dn": 4, "area_m2": 34681841.188},
    {"cell_id": "-73.650000_4.550000", "nombre": "Chuza", "dn": 4, "area_m2": 3310617.714},
    {"cell_id": "-74.050000_5.250000", "nombre": "Neusa", "dn": 5, "area_m2": 11189198.351},
    {"cell_id": "-73.950000_5.250000", "nombre": "Neusa", "dn": 5, "area_m2": 22119481.552},
    {"cell_id": "-73.850000_5.250000", "nombre": "Neusa", "dn": 5, "area_m2": 224584.163},
    {"cell_id": "-74.050000_5.150000", "nombre": "Neusa", "dn": 5, "area_m2": 35590273.033},
    {"cell_id": "-73.950000_5.150000", "nombre": "Neusa", "dn": 5, "area_m2": 68459708.627},
    {"cell_id": "-73.850000_5.150000", "nombre": "Neusa", "dn": 5, "area_m2": 4781.514},
    {"cell_id": "-74.050000_4.750000", "nombre": "San Rafael", "dn": 7, "area_m2": 2233105.334},
    {"cell_id": "-74.050000_4.650000", "nombre": "San Rafael", "dn": 7, "area_m2": 28300259.057},
    {"cell_id": "-73.950000_4.650000", "nombre": "San Rafael", "dn": 7, "area_m2": 17191161.879},
    {"cell_id": "-74.050000_4.550000", "nombre": "San Rafael", "dn": 7, "area_m2": 14369765.790},
    {"cell_id": "-73.950000_4.550000", "nombre": "San Rafael", "dn": 7, "area_m2": 434490.522},
    {"cell_id": "-73.650000_5.050000", "nombre": "Sisga", "dn": 3, "area_m2": 23604561.406},
    {"cell_id": "-73.650000_4.950000", "nombre": "Sisga", "dn": 3, "area_m2": 4174673.207},
    {"cell_id": "-74.050000_4.350000", "nombre": "La regadera", "dn": 1, "area_m2": 1172666.872},
]

# ──────────────────────────────────────────────────────────
# CUENCAS — CHIRPS (0.05°)
# ──────────────────────────────────────────────────────────
CHIRPS_RELATIONS = [
    {"cell_id": "-74.225000_4.425000", "nombre": "Chisaca", "dn": 2, "area_m2": 1501528.095},
    {"cell_id": "-74.225000_4.425000", "nombre": "La regadera", "dn": 1, "area_m2": 1501528.095},
    {"cell_id": "-74.175000_4.425000", "nombre": "Chisaca", "dn": 2, "area_m2": 8926377.039},
    {"cell_id": "-74.175000_4.425000", "nombre": "La regadera", "dn": 1, "area_m2": 8926377.039},
    {"cell_id": "-74.125000_4.425000", "nombre": "La regadera", "dn": 1, "area_m2": 3946628.044},
    {"cell_id": "-74.225000_4.375000", "nombre": "Chisaca", "dn": 2, "area_m2": 9298835.181},
    {"cell_id": "-74.225000_4.375000", "nombre": "La regadera", "dn": 1, "area_m2": 9298835.181},
    {"cell_id": "-74.175000_4.375000", "nombre": "Chisaca", "dn": 2, "area_m2": 30685404.387},
    {"cell_id": "-74.175000_4.375000", "nombre": "La regadera", "dn": 1, "area_m2": 30685404.387},
    {"cell_id": "-74.125000_4.375000", "nombre": "La regadera", "dn": 1, "area_m2": 27554933.253},
    {"cell_id": "-74.225000_4.325000", "nombre": "Chisaca", "dn": 2, "area_m2": 10993710.313},
    {"cell_id": "-74.225000_4.325000", "nombre": "La regadera", "dn": 1, "area_m2": 10993710.313},
    {"cell_id": "-74.175000_4.325000", "nombre": "Chisaca", "dn": 2, "area_m2": 30687387.174},
    {"cell_id": "-74.175000_4.325000", "nombre": "La regadera", "dn": 1, "area_m2": 30687387.174},
    {"cell_id": "-74.125000_4.325000", "nombre": "Chisaca", "dn": 2, "area_m2": 23562891.851},
    {"cell_id": "-74.125000_4.325000", "nombre": "La regadera", "dn": 1, "area_m2": 23562891.851},
    {"cell_id": "-74.225000_4.275000", "nombre": "Chisaca", "dn": 2, "area_m2": 4481082.454},
    {"cell_id": "-74.225000_4.275000", "nombre": "La regadera", "dn": 1, "area_m2": 4481082.454},
    {"cell_id": "-74.175000_4.275000", "nombre": "Chisaca", "dn": 2, "area_m2": 8541689.633},
    {"cell_id": "-74.175000_4.275000", "nombre": "La regadera", "dn": 1, "area_m2": 8541689.633},
    {"cell_id": "-74.125000_4.275000", "nombre": "Chisaca", "dn": 2, "area_m2": 709539.877},
    {"cell_id": "-74.125000_4.275000", "nombre": "La regadera", "dn": 1, "area_m2": 709539.877},
    {"cell_id": "-73.825000_5.025000", "nombre": "Tomine", "dn": 6, "area_m2": 14877027.717},
    {"cell_id": "-73.775000_5.025000", "nombre": "Tomine", "dn": 6, "area_m2": 20855321.544},
    {"cell_id": "-73.775000_5.025000", "nombre": "Sisga", "dn": 3, "area_m2": 20855321.544},
    {"cell_id": "-73.725000_5.025000", "nombre": "Sisga", "dn": 3, "area_m2": 30657557.709},
    {"cell_id": "-73.875000_4.975000", "nombre": "Tomine", "dn": 6, "area_m2": 9989246.290},
    {"cell_id": "-73.825000_4.975000", "nombre": "Tomine", "dn": 6, "area_m2": 30218830.942},
    {"cell_id": "-73.775000_4.975000", "nombre": "Tomine", "dn": 6, "area_m2": 30659836.242},
    {"cell_id": "-73.775000_4.975000", "nombre": "Sisga", "dn": 3, "area_m2": 30659836.242},
    {"cell_id": "-73.725000_4.975000", "nombre": "Sisga", "dn": 3, "area_m2": 28898739.271},
    {"cell_id": "-73.925000_4.925000", "nombre": "Tomine", "dn": 6, "area_m2": 5768528.873},
    {"cell_id": "-73.875000_4.925000", "nombre": "Tomine", "dn": 6, "area_m2": 29961360.094},
    {"cell_id": "-73.825000_4.925000", "nombre": "Tomine", "dn": 6, "area_m2": 30662092.033},
    {"cell_id": "-73.775000_4.925000", "nombre": "Tomine", "dn": 6, "area_m2": 26688409.369},
    {"cell_id": "-73.775000_4.925000", "nombre": "Sisga", "dn": 3, "area_m2": 26688409.369},
    {"cell_id": "-73.725000_4.925000", "nombre": "Tomine", "dn": 6, "area_m2": 4000789.899},
    {"cell_id": "-73.725000_4.925000", "nombre": "Sisga", "dn": 3, "area_m2": 4000789.899},
    {"cell_id": "-73.925000_4.875000", "nombre": "Tomine", "dn": 6, "area_m2": 14315027.563},
    {"cell_id": "-73.875000_4.875000", "nombre": "Tomine", "dn": 6, "area_m2": 30664325.081},
    {"cell_id": "-73.825000_4.875000", "nombre": "Tomine", "dn": 6, "area_m2": 30581682.416},
    {"cell_id": "-73.775000_4.875000", "nombre": "Tomine", "dn": 6, "area_m2": 11045663.466},
    {"cell_id": "-73.925000_4.825000", "nombre": "Tomine", "dn": 6, "area_m2": 11184664.401},
    {"cell_id": "-73.875000_4.825000", "nombre": "Tomine", "dn": 6, "area_m2": 30666535.383},
    {"cell_id": "-73.825000_4.825000", "nombre": "Tomine", "dn": 6, "area_m2": 21613586.172},
    {"cell_id": "-73.925000_4.775000", "nombre": "Tomine", "dn": 6, "area_m2": 4293480.845},
    {"cell_id": "-73.875000_4.775000", "nombre": "Tomine", "dn": 6, "area_m2": 29612617.030},
    {"cell_id": "-73.825000_4.775000", "nombre": "Tomine", "dn": 6, "area_m2": 11507734.930},
    {"cell_id": "-73.875000_4.725000", "nombre": "Tomine", "dn": 6, "area_m2": 1824775.562},
    {"cell_id": "-73.775000_4.675000", "nombre": "Chuza", "dn": 4, "area_m2": 18193867.603},
    {"cell_id": "-73.725000_4.675000", "nombre": "Chuza", "dn": 4, "area_m2": 4651190.099},
    {"cell_id": "-73.775000_4.625000", "nombre": "Chuza", "dn": 4, "area_m2": 22335052.538},
    {"cell_id": "-73.725000_4.625000", "nombre": "Chuza", "dn": 4, "area_m2": 26933306.981},
    {"cell_id": "-73.675000_4.625000", "nombre": "Chuza", "dn": 4, "area_m2": 543310.248},
    {"cell_id": "-73.775000_4.575000", "nombre": "Chuza", "dn": 4, "area_m2": 4232826.774},
    {"cell_id": "-73.725000_4.575000", "nombre": "Chuza", "dn": 4, "area_m2": 27223377.038},
    {"cell_id": "-73.675000_4.575000", "nombre": "Chuza", "dn": 4, "area_m2": 2853229.488},
    {"cell_id": "-73.725000_4.525000", "nombre": "Chuza", "dn": 4, "area_m2": 3225232.626},
    {"cell_id": "-73.675000_4.525000", "nombre": "Chuza", "dn": 4, "area_m2": 457388.226},
    {"cell_id": "-74.025000_5.225000", "nombre": "Neusa", "dn": 5, "area_m2": 11189198.351},
    {"cell_id": "-73.975000_5.225000", "nombre": "Neusa", "dn": 5, "area_m2": 9813474.235},
    {"cell_id": "-73.925000_5.225000", "nombre": "Neusa", "dn": 5, "area_m2": 12307142.199},
    {"cell_id": "-73.875000_5.225000", "nombre": "Neusa", "dn": 5, "area_m2": 224584.163},
    {"cell_id": "-74.025000_5.175000", "nombre": "Neusa", "dn": 5, "area_m2": 28611885.145},
    {"cell_id": "-73.975000_5.175000", "nombre": "Neusa", "dn": 5, "area_m2": 30650585.670},
    {"cell_id": "-73.925000_5.175000", "nombre": "Neusa", "dn": 5, "area_m2": 25349714.034},
    {"cell_id": "-73.875000_5.175000", "nombre": "Neusa", "dn": 5, "area_m2": 4781.514},
    {"cell_id": "-74.025000_5.125000", "nombre": "Neusa", "dn": 5, "area_m2": 6978387.888},
    {"cell_id": "-73.975000_5.125000", "nombre": "Neusa", "dn": 5, "area_m2": 10014358.200},
    {"cell_id": "-73.925000_5.125000", "nombre": "Neusa", "dn": 5, "area_m2": 2443915.987},
    {"cell_id": "-74.025000_4.725000", "nombre": "San Rafael", "dn": 7, "area_m2": 2233105.334},
    {"cell_id": "-73.975000_4.725000", "nombre": "San Rafael", "dn": 7, "area_m2": 11582619.037},
    {"cell_id": "-74.025000_4.675000", "nombre": "San Rafael", "dn": 7, "area_m2": 7997914.578},
    {"cell_id": "-73.975000_4.675000", "nombre": "San Rafael", "dn": 7, "area_m2": 12017071.319},
    {"cell_id": "-74.025000_4.625000", "nombre": "San Rafael", "dn": 7, "area_m2": 20302344.479},
    {"cell_id": "-73.975000_4.625000", "nombre": "San Rafael", "dn": 7, "area_m2": 5174090.560},
    {"cell_id": "-74.025000_4.575000", "nombre": "San Rafael", "dn": 7, "area_m2": 14369765.790},
    {"cell_id": "-73.975000_4.575000", "nombre": "San Rafael", "dn": 7, "area_m2": 434490.522},
    {"cell_id": "-73.775000_5.075000", "nombre": "Sisga", "dn": 3, "area_m2": 714854.275},
    {"cell_id": "-73.725000_5.075000", "nombre": "Sisga", "dn": 3, "area_m2": 20522624.100},
    {"cell_id": "-73.675000_5.075000", "nombre": "Sisga", "dn": 3, "area_m2": 11566748.848},
    {"cell_id": "-73.675000_5.025000", "nombre": "Sisga", "dn": 3, "area_m2": 12037812.559},
    {"cell_id": "-73.675000_4.975000", "nombre": "Sisga", "dn": 3, "area_m2": 4174673.207},
    {"cell_id": "-74.075000_4.375000", "nombre": "La regadera", "dn": 1, "area_m2": 1098007.795},
    {"cell_id": "-74.075000_4.325000", "nombre": "La regadera", "dn": 1, "area_m2": 74659.078},
]

# ──────────────────────────────────────────────────────────
# MUNICIPIO (Bogotá) — relaciones por fuente
# ──────────────────────────────────────────────────────────
MUNICIPIO_RELATIONS = {
    "IMERG": [
        {"cell_id": "-74.050000_4.850000", "nombre": "Bogotá", "dn": 1, "area_m2": 27373632.662},
        {"cell_id": "-74.150000_4.750000", "nombre": "Bogotá", "dn": 1, "area_m2": 37070854.464},
        {"cell_id": "-74.050000_4.750000", "nombre": "Bogotá", "dn": 1, "area_m2": 107465503.847},
        {"cell_id": "-74.250000_4.650000", "nombre": "Bogotá", "dn": 1, "area_m2": 8604531.075},
        {"cell_id": "-74.150000_4.650000", "nombre": "Bogotá", "dn": 1, "area_m2": 104112480.869},
        {"cell_id": "-74.050000_4.650000", "nombre": "Bogotá", "dn": 1, "area_m2": 109546395.384},
        {"cell_id": "-73.950000_4.650000", "nombre": "Bogotá", "dn": 1, "area_m2": 2505485.275},
        {"cell_id": "-74.250000_4.550000", "nombre": "Bogotá", "dn": 1, "area_m2": 1833.86},
        {"cell_id": "-74.150000_4.550000", "nombre": "Bogotá", "dn": 1, "area_m2": 98241401.59},
        {"cell_id": "-74.050000_4.550000", "nombre": "Bogotá", "dn": 1, "area_m2": 90077382.567},
        {"cell_id": "-73.950000_4.550000", "nombre": "Bogotá", "dn": 1, "area_m2": 295495.674},
        {"cell_id": "-74.250000_4.450000", "nombre": "Bogotá", "dn": 1, "area_m2": 1670555.226},
        {"cell_id": "-74.150000_4.450000", "nombre": "Bogotá", "dn": 1, "area_m2": 102242707.931},
        {"cell_id": "-74.050000_4.450000", "nombre": "Bogotá", "dn": 1, "area_m2": 13006137.45},
        {"cell_id": "-74.250000_4.350000", "nombre": "Bogotá", "dn": 1, "area_m2": 17983747.542},
        {"cell_id": "-74.150000_4.350000", "nombre": "Bogotá", "dn": 1, "area_m2": 113044608.081},
        {"cell_id": "-74.050000_4.350000", "nombre": "Bogotá", "dn": 1, "area_m2": 1517539.569},
        {"cell_id": "-74.250000_4.250000", "nombre": "Bogotá", "dn": 1, "area_m2": 21295788.592},
        {"cell_id": "-74.150000_4.250000", "nombre": "Bogotá", "dn": 1, "area_m2": 75337325.753},
        {"cell_id": "-74.350000_4.150000", "nombre": "Bogotá", "dn": 1, "area_m2": 8664205.796},
        {"cell_id": "-74.250000_4.150000", "nombre": "Bogotá", "dn": 1, "area_m2": 53514540.431},
        {"cell_id": "-74.150000_4.150000", "nombre": "Bogotá", "dn": 1, "area_m2": 99112976.755},
        {"cell_id": "-74.350000_4.050000", "nombre": "Bogotá", "dn": 1, "area_m2": 68791488.789},
        {"cell_id": "-74.250000_4.050000", "nombre": "Bogotá", "dn": 1, "area_m2": 118209615.623},
        {"cell_id": "-74.150000_4.050000", "nombre": "Bogotá", "dn": 1, "area_m2": 72270416.632},
        {"cell_id": "-74.350000_3.950000", "nombre": "Bogotá", "dn": 1, "area_m2": 74557033.282},
        {"cell_id": "-74.250000_3.950000", "nombre": "Bogotá", "dn": 1, "area_m2": 58774423.302},
        {"cell_id": "-74.450000_3.850000", "nombre": "Bogotá", "dn": 1, "area_m2": 1676132.731},
        {"cell_id": "-74.350000_3.850000", "nombre": "Bogotá", "dn": 1, "area_m2": 89568391.06},
        {"cell_id": "-74.250000_3.850000", "nombre": "Bogotá", "dn": 1, "area_m2": 3264812.393},
        {"cell_id": "-74.450000_3.750000", "nombre": "Bogotá", "dn": 1, "area_m2": 26972621.087},
        {"cell_id": "-74.350000_3.750000", "nombre": "Bogotá", "dn": 1, "area_m2": 13279067.632},
    ],
    "CHIRPS": [
        {"cell_id": "-74.075000_4.825000", "nombre": "Bogotá", "dn": 1, "area_m2": 13573100.04},
        {"cell_id": "-74.025000_4.825000", "nombre": "Bogotá", "dn": 1, "area_m2": 13801197.628},
        {"cell_id": "-74.125000_4.775000", "nombre": "Bogotá", "dn": 1, "area_m2": 8998459.06},
        {"cell_id": "-74.075000_4.775000", "nombre": "Bogotá", "dn": 1, "area_m2": 29973919.657},
        {"cell_id": "-74.025000_4.775000", "nombre": "Bogotá", "dn": 1, "area_m2": 21705558.264},
        {"cell_id": "-74.175000_4.725000", "nombre": "Bogotá", "dn": 1, "area_m2": 3159925.497},
        {"cell_id": "-74.125000_4.725000", "nombre": "Bogotá", "dn": 1, "area_m2": 24912757.954},
        {"cell_id": "-74.075000_4.725000", "nombre": "Bogotá", "dn": 1, "area_m2": 30670887.749},
        {"cell_id": "-74.025000_4.725000", "nombre": "Bogotá", "dn": 1, "area_m2": 25115178.76},
        {"cell_id": "-74.175000_4.675000", "nombre": "Bogotá", "dn": 1, "area_m2": 12190690.25},
        {"cell_id": "-74.125000_4.675000", "nombre": "Bogotá", "dn": 1, "area_m2": 30673029.81},
        {"cell_id": "-74.075000_4.675000", "nombre": "Bogotá", "dn": 1, "area_m2": 30673029.81},
        {"cell_id": "-74.025000_4.675000", "nombre": "Bogotá", "dn": 1, "area_m2": 22544108.98},
        {"cell_id": "-74.225000_4.625000", "nombre": "Bogotá", "dn": 1, "area_m2": 8604531.075},
        {"cell_id": "-74.175000_4.625000", "nombre": "Bogotá", "dn": 1, "area_m2": 30574400.812},
        {"cell_id": "-74.125000_4.625000", "nombre": "Bogotá", "dn": 1, "area_m2": 30675149.121},
        {"cell_id": "-74.075000_4.625000", "nombre": "Bogotá", "dn": 1, "area_m2": 30675149.121},
        {"cell_id": "-74.025000_4.625000", "nombre": "Bogotá", "dn": 1, "area_m2": 25654479.055},
        {"cell_id": "-73.975000_4.625000", "nombre": "Bogotá", "dn": 1, "area_m2": 2505485.275},
        {"cell_id": "-74.225000_4.575000", "nombre": "Bogotá", "dn": 1, "area_m2": 1833.86},
        {"cell_id": "-74.175000_4.575000", "nombre": "Bogotá", "dn": 1, "area_m2": 18225613.742},
        {"cell_id": "-74.125000_4.575000", "nombre": "Bogotá", "dn": 1, "area_m2": 30677245.681},
        {"cell_id": "-74.075000_4.575000", "nombre": "Bogotá", "dn": 1, "area_m2": 30677245.681},
        {"cell_id": "-74.025000_4.575000", "nombre": "Bogotá", "dn": 1, "area_m2": 25608678.613},
        {"cell_id": "-73.975000_4.575000", "nombre": "Bogotá", "dn": 1, "area_m2": 295495.674},
        {"cell_id": "-74.175000_4.525000", "nombre": "Bogotá", "dn": 1, "area_m2": 18658656.49},
        {"cell_id": "-74.125000_4.525000", "nombre": "Bogotá", "dn": 1, "area_m2": 30679319.489},
        {"cell_id": "-74.075000_4.525000", "nombre": "Bogotá", "dn": 1, "area_m2": 27523964.004},
        {"cell_id": "-74.025000_4.525000", "nombre": "Bogotá", "dn": 1, "area_m2": 6266417.099},
        {"cell_id": "-74.175000_4.475000", "nombre": "Bogotá", "dn": 1, "area_m2": 19948278.157},
        {"cell_id": "-74.125000_4.475000", "nombre": "Bogotá", "dn": 1, "area_m2": 30605288.555},
        {"cell_id": "-74.075000_4.475000", "nombre": "Bogotá", "dn": 1, "area_m2": 13006137.45},
        {"cell_id": "-74.225000_4.425000", "nombre": "Bogotá", "dn": 1, "area_m2": 1670555.226},
        {"cell_id": "-74.175000_4.425000", "nombre": "Bogotá", "dn": 1, "area_m2": 28552584.657},
        {"cell_id": "-74.125000_4.425000", "nombre": "Bogotá", "dn": 1, "area_m2": 23136656.427},
        {"cell_id": "-74.225000_4.375000", "nombre": "Bogotá", "dn": 1, "area_m2": 8540512.535},
        {"cell_id": "-74.175000_4.375000", "nombre": "Bogotá", "dn": 1, "area_m2": 30685404.387},
        {"cell_id": "-74.125000_4.375000", "nombre": "Bogotá", "dn": 1, "area_m2": 27477136.851},
        {"cell_id": "-74.075000_4.375000", "nombre": "Bogotá", "dn": 1, "area_m2": 1381129.11},
        {"cell_id": "-74.225000_4.325000", "nombre": "Bogotá", "dn": 1, "area_m2": 9443235.007},
        {"cell_id": "-74.175000_4.325000", "nombre": "Bogotá", "dn": 1, "area_m2": 30687387.174},
        {"cell_id": "-74.125000_4.325000", "nombre": "Bogotá", "dn": 1, "area_m2": 24194442.921},
        {"cell_id": "-74.075000_4.325000", "nombre": "Bogotá", "dn": 1, "area_m2": 136410.46},
        {"cell_id": "-74.225000_4.275000", "nombre": "Bogotá", "dn": 1, "area_m2": 7488678.94},
        {"cell_id": "-74.175000_4.275000", "nombre": "Bogotá", "dn": 1, "area_m2": 30498000.822},
        {"cell_id": "-74.125000_4.275000", "nombre": "Bogotá", "dn": 1, "area_m2": 7794682.794},
        {"cell_id": "-74.225000_4.225000", "nombre": "Bogotá", "dn": 1, "area_m2": 13807109.653},
        {"cell_id": "-74.175000_4.225000", "nombre": "Bogotá", "dn": 1, "area_m2": 30688069.145},
        {"cell_id": "-74.125000_4.225000", "nombre": "Bogotá", "dn": 1, "area_m2": 6356436.778},
        {"cell_id": "-74.225000_4.175000", "nombre": "Bogotá", "dn": 1, "area_m2": 24938662.457},
        {"cell_id": "-74.175000_4.175000", "nombre": "Bogotá", "dn": 1, "area_m2": 30693198.982},
        {"cell_id": "-74.125000_4.175000", "nombre": "Bogotá", "dn": 1, "area_m2": 20239037.958},
        {"cell_id": "-74.325000_4.125000", "nombre": "Bogotá", "dn": 1, "area_m2": 8664205.796},
        {"cell_id": "-74.275000_4.125000", "nombre": "Bogotá", "dn": 1, "area_m2": 945611.18},
        {"cell_id": "-74.225000_4.125000", "nombre": "Bogotá", "dn": 1, "area_m2": 27630300.161},
        {"cell_id": "-74.175000_4.125000", "nombre": "Bogotá", "dn": 1, "area_m2": 30695090.73},
        {"cell_id": "-74.125000_4.125000", "nombre": "Bogotá", "dn": 1, "area_m2": 17485726.314},
        {"cell_id": "-74.375000_4.075000", "nombre": "Bogotá", "dn": 1, "area_m2": 418568.308},
        {"cell_id": "-74.325000_4.075000", "nombre": "Bogotá", "dn": 1, "area_m2": 29330697.51},
        {"cell_id": "-74.275000_4.075000", "nombre": "Bogotá", "dn": 1, "area_m2": 29204107.451},
        {"cell_id": "-74.225000_4.075000", "nombre": "Bogotá", "dn": 1, "area_m2": 30696959.715},
        {"cell_id": "-74.175000_4.075000", "nombre": "Bogotá", "dn": 1, "area_m2": 30696959.715},
        {"cell_id": "-74.125000_4.075000", "nombre": "Bogotá", "dn": 1, "area_m2": 13648746.169},
        {"cell_id": "-74.375000_4.025000", "nombre": "Bogotá", "dn": 1, "area_m2": 8343632.502},
        {"cell_id": "-74.325000_4.025000", "nombre": "Bogotá", "dn": 1, "area_m2": 30698805.937},
        {"cell_id": "-74.275000_4.025000", "nombre": "Bogotá", "dn": 1, "area_m2": 30698805.937},
        {"cell_id": "-74.225000_4.025000", "nombre": "Bogotá", "dn": 1, "area_m2": 27610088.963},
        {"cell_id": "-74.175000_4.025000", "nombre": "Bogotá", "dn": 1, "area_m2": 22125740.26},
        {"cell_id": "-74.125000_4.025000", "nombre": "Bogotá", "dn": 1, "area_m2": 5798655.399},
        {"cell_id": "-74.375000_3.975000", "nombre": "Bogotá", "dn": 1, "area_m2": 7814909.036},
        {"cell_id": "-74.325000_3.975000", "nombre": "Bogotá", "dn": 1, "area_m2": 30700629.394},
        {"cell_id": "-74.275000_3.975000", "nombre": "Bogotá", "dn": 1, "area_m2": 30700629.394},
        {"cell_id": "-74.225000_3.975000", "nombre": "Bogotá", "dn": 1, "area_m2": 8445986.676},
        {"cell_id": "-74.375000_3.925000", "nombre": "Bogotá", "dn": 1, "area_m2": 5339027.292},
        {"cell_id": "-74.325000_3.925000", "nombre": "Bogotá", "dn": 1, "area_m2": 30702430.086},
        {"cell_id": "-74.275000_3.925000", "nombre": "Bogotá", "dn": 1, "area_m2": 19624392.501},
        {"cell_id": "-74.225000_3.925000", "nombre": "Bogotá", "dn": 1, "area_m2": 3034.925},
        {"cell_id": "-74.375000_3.875000", "nombre": "Bogotá", "dn": 1, "area_m2": 17064925.155},
        {"cell_id": "-74.325000_3.875000", "nombre": "Bogotá", "dn": 1, "area_m2": 25685938.258},
        {"cell_id": "-74.275000_3.875000", "nombre": "Bogotá", "dn": 1, "area_m2": 2124076.689},
        {"cell_id": "-74.425000_3.825000", "nombre": "Bogotá", "dn": 1, "area_m2": 1676132.731},
        {"cell_id": "-74.375000_3.825000", "nombre": "Bogotá", "dn": 1, "area_m2": 27845175.934},
        {"cell_id": "-74.325000_3.825000", "nombre": "Bogotá", "dn": 1, "area_m2": 18972173.718},
        {"cell_id": "-74.275000_3.825000", "nombre": "Bogotá", "dn": 1, "area_m2": 1140735.703},
        {"cell_id": "-74.475000_3.775000", "nombre": "Bogotá", "dn": 1, "area_m2": 2879.505},
        {"cell_id": "-74.425000_3.775000", "nombre": "Bogotá", "dn": 1, "area_m2": 19348690.879},
        {"cell_id": "-74.375000_3.775000", "nombre": "Bogotá", "dn": 1, "area_m2": 13130887.48},
        {"cell_id": "-74.475000_3.725000", "nombre": "Bogotá", "dn": 1, "area_m2": 35323.687},
        {"cell_id": "-74.425000_3.725000", "nombre": "Bogotá", "dn": 1, "area_m2": 7585727.016},
        {"cell_id": "-74.375000_3.725000", "nombre": "Bogotá", "dn": 1, "area_m2": 148180.153},
    ],
    "ERA5": [],
    "ERA5_LAND": [],
}

# ──────────────────────────────────────────────────────────
# PERÍMETRO URBANO (Centro Urb) — relaciones por fuente
# ──────────────────────────────────────────────────────────
PERIMETRO_RELATIONS = {
    "IMERG": [
        {"cell_id": "-74.050000_4.850000", "nombre": "Centro Urb", "dn": 1, "area_m2": 6635977.361},
        {"cell_id": "-74.150000_4.750000", "nombre": "Centro Urb", "dn": 1, "area_m2": 23571413.444},
        {"cell_id": "-74.050000_4.750000", "nombre": "Centro Urb", "dn": 1, "area_m2": 68579049.574},
        {"cell_id": "-74.250000_4.650000", "nombre": "Centro Urb", "dn": 1, "area_m2": 5107697.326},
        {"cell_id": "-74.150000_4.650000", "nombre": "Centro Urb", "dn": 1, "area_m2": 97894805.004},
        {"cell_id": "-74.050000_4.650000", "nombre": "Centro Urb", "dn": 1, "area_m2": 64007679.936},
        {"cell_id": "-74.250000_4.550000", "nombre": "Centro Urb", "dn": 1, "area_m2": 200.062},
        {"cell_id": "-74.150000_4.550000", "nombre": "Centro Urb", "dn": 1, "area_m2": 67469166.413},
        {"cell_id": "-74.050000_4.550000", "nombre": "Centro Urb", "dn": 1, "area_m2": 23464853.112},
        {"cell_id": "-74.150000_4.450000", "nombre": "Centro Urb", "dn": 1, "area_m2": 4939489.094},
        {"cell_id": "-74.050000_4.450000", "nombre": "Centro Urb", "dn": 1, "area_m2": 735131.168},
    ],
    "CHIRPS": [
        {"cell_id": "-74.075000_4.825000", "nombre": "Centro Urb", "dn": 1, "area_m2": 2665068.949},
        {"cell_id": "-74.025000_4.825000", "nombre": "Centro Urb", "dn": 1, "area_m2": 3970908.919},
        {"cell_id": "-74.125000_4.775000", "nombre": "Centro Urb", "dn": 1, "area_m2": 2297531.446},
        {"cell_id": "-74.075000_4.775000", "nombre": "Centro Urb", "dn": 1, "area_m2": 11230329.72},
        {"cell_id": "-74.025000_4.775000", "nombre": "Centro Urb", "dn": 1, "area_m2": 10997729.769},
        {"cell_id": "-74.175000_4.725000", "nombre": "Centro Urb", "dn": 1, "area_m2": 1679861.502},
        {"cell_id": "-74.125000_4.725000", "nombre": "Centro Urb", "dn": 1, "area_m2": 19594128.174},
        {"cell_id": "-74.075000_4.725000", "nombre": "Centro Urb", "dn": 1, "area_m2": 29202182.594},
        {"cell_id": "-74.025000_4.725000", "nombre": "Centro Urb", "dn": 1, "area_m2": 17148865.853},
        {"cell_id": "-74.175000_4.675000", "nombre": "Centro Urb", "dn": 1, "area_m2": 8423952.281},
        {"cell_id": "-74.125000_4.675000", "nombre": "Centro Urb", "dn": 1, "area_m2": 30054004.575},
        {"cell_id": "-74.075000_4.675000", "nombre": "Centro Urb", "dn": 1, "area_m2": 30626416.883},
        {"cell_id": "-74.025000_4.675000", "nombre": "Centro Urb", "dn": 1, "area_m2": 8789282.641},
        {"cell_id": "-74.225000_4.625000", "nombre": "Centro Urb", "dn": 1, "area_m2": 5107697.326},
        {"cell_id": "-74.175000_4.625000", "nombre": "Centro Urb", "dn": 1, "area_m2": 28757968.838},
        {"cell_id": "-74.125000_4.625000", "nombre": "Centro Urb", "dn": 1, "area_m2": 30659848.26},
        {"cell_id": "-74.075000_4.625000", "nombre": "Centro Urb", "dn": 1, "area_m2": 24559362.306},
        {"cell_id": "-74.025000_4.625000", "nombre": "Centro Urb", "dn": 1, "area_m2": 32559.895},
        {"cell_id": "-74.225000_4.575000", "nombre": "Centro Urb", "dn": 1, "area_m2": 200.062},
        {"cell_id": "-74.175000_4.575000", "nombre": "Centro Urb", "dn": 1, "area_m2": 14706727.922},
        {"cell_id": "-74.125000_4.575000", "nombre": "Centro Urb", "dn": 1, "area_m2": 28657997.185},
        {"cell_id": "-74.075000_4.575000", "nombre": "Centro Urb", "dn": 1, "area_m2": 16850881.857},
        {"cell_id": "-74.175000_4.525000", "nombre": "Centro Urb", "dn": 1, "area_m2": 3257692.103},
        {"cell_id": "-74.125000_4.525000", "nombre": "Centro Urb", "dn": 1, "area_m2": 20845672.032},
        {"cell_id": "-74.075000_4.525000", "nombre": "Centro Urb", "dn": 1, "area_m2": 6613971.255},
        {"cell_id": "-74.175000_4.475000", "nombre": "Centro Urb", "dn": 1, "area_m2": 30907.45},
        {"cell_id": "-74.125000_4.475000", "nombre": "Centro Urb", "dn": 1, "area_m2": 4908581.644},
        {"cell_id": "-74.075000_4.475000", "nombre": "Centro Urb", "dn": 1, "area_m2": 735131.168},
    ],
    "ERA5": [],
    "ERA5_LAND": [],
}


# Estructura unificada consumida por la función de seed:
#   {zone_type: {source: [ {cell_id, nombre, dn, area_m2}, ... ]}}
ZONE_RELATIONS_SEED = {
    "cuenca": {
        "ERA5": ERA5_RELATIONS,
        "IMERG": IMERG_RELATIONS,
        "CHIRPS": CHIRPS_RELATIONS,
        "ERA5_LAND": [],
    },
    "municipio": MUNICIPIO_RELATIONS,
    "perimetro": PERIMETRO_RELATIONS,
}

# Nombres autoritativos por tipo de zona (garantiza que toda zona exista aunque
# no tenga relaciones en alguna fuente).
ZONE_NAMES_SEED = {
    "cuenca": CUENCA_NAMES,
    "municipio": MUNICIPIO_NAMES,
    "perimetro": PERIMETRO_NAMES,
}


def _parse_lonlat(cell_id: str):
    """Deriva (lon, lat) de un cell_id 'lon_lat'. Retorna (None, None) si falla."""
    try:
        lon_s, lat_s = cell_id.split("_")
        return float(lon_s), float(lat_s)
    except (ValueError, AttributeError):
        return None, None


def seed_zone_relations(db, force: bool = False) -> dict:
    """
    Puebla grid_cells / spatial_zones / zone_cell_relations de forma idempotente.

    - Upsert por claves naturales: zona (zone_type, dn), celda (source, cell_id),
      relación (zone_id, cell_id_ref). Re-ejecutar solo agrega lo nuevo.
    - ``force=True`` borra todo y reconstruye desde cero (opt-in).

    Retorna {'cells_added', 'zones_added', 'relations_added', 'relations_updated'}.
    """
    # Import local para evitar ciclos de importación con app.db.base.
    from app.models.zone_relation import GridCell, SpatialZone, ZoneCellRelation

    stats = {"cells_added": 0, "zones_added": 0, "relations_added": 0, "relations_updated": 0}

    if force:
        # Orden: relaciones → zonas → celdas (la junción referencia a ambas).
        db.query(ZoneCellRelation).delete()
        db.query(SpatialZone).delete()
        db.query(GridCell).delete()
        db.commit()

    zone_cache: dict = {}  # (zone_type, dn) -> SpatialZone
    cell_cache: dict = {}  # (source, cell_id) -> GridCell

    def get_or_create_zone(zone_type: str, dn: int, nombre: str) -> SpatialZone:
        key = (zone_type, dn)
        zone = zone_cache.get(key)
        if zone is None:
            zone = (
                db.query(SpatialZone)
                .filter_by(zone_type=zone_type, dn=dn)
                .one_or_none()
            )
            if zone is None:
                zone = SpatialZone(zone_type=zone_type, dn=dn, nombre=nombre)
                db.add(zone)
                db.flush()
                stats["zones_added"] += 1
            elif nombre and zone.nombre != nombre:
                zone.nombre = nombre
            zone_cache[key] = zone
        return zone

    def get_or_create_cell(source: str, cell_id: str) -> GridCell:
        key = (source, cell_id)
        cell = cell_cache.get(key)
        if cell is None:
            cell = (
                db.query(GridCell)
                .filter_by(source=source, cell_id=cell_id)
                .one_or_none()
            )
            if cell is None:
                lon, lat = _parse_lonlat(cell_id)
                cell = GridCell(source=source, cell_id=cell_id, lon=lon, lat=lat)
                db.add(cell)
                db.flush()
                stats["cells_added"] += 1
            cell_cache[key] = cell
        return cell

    # 1) Asegurar que existan todas las zonas (incluso sin relaciones).
    for zone_type, names in ZONE_NAMES_SEED.items():
        for dn, nombre in names.items():
            get_or_create_zone(zone_type, dn, nombre)

    # 2) Crear celdas y relaciones.
    for zone_type, by_source in ZONE_RELATIONS_SEED.items():
        for source, rels in by_source.items():
            for rel in rels:
                zone = get_or_create_zone(zone_type, rel["dn"], rel["nombre"])
                cell = get_or_create_cell(source, rel["cell_id"])
                relation = (
                    db.query(ZoneCellRelation)
                    .filter_by(zone_id=zone.id, cell_id_ref=cell.id)
                    .one_or_none()
                )
                if relation is None:
                    db.add(
                        ZoneCellRelation(
                            zone_id=zone.id, cell_id_ref=cell.id, area_m2=rel["area_m2"]
                        )
                    )
                    stats["relations_added"] += 1
                elif relation.area_m2 != rel["area_m2"]:
                    relation.area_m2 = rel["area_m2"]
                    stats["relations_updated"] += 1

    db.commit()
    return stats
