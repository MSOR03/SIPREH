"""
Relaciones Cuenca ↔ Celda para cada fuente de datos (ERA5, IMERG, CHIRPS).

Cada entrada contiene:
  - cell_id: identificador de la celda (lon_lat)
  - nombre: nombre de la cuenca
  - dn: identificador numérico de la cuenca
  - area_m2: área de intersección celda-cuenca en m²

El promedio ponderado por área de intersección se calcula como:
  valor_cuenca = Σ(valor_celda * area_interseccion) / Σ(area_interseccion)
"""

# DN → Nombre mapping
CUENCA_NAMES = {
    1: "La regadera",
    2: "Chisaca",
    3: "Sisga",
    4: "Chuza",
    5: "Neusa",
    6: "Tomine",
    7: "San Rafael",
}

# Source resolution mapping
SOURCE_RESOLUTION = {
    "ERA5": 0.25,
    "IMERG": 0.1,
    "CHIRPS": 0.05,
}

# ──────────────────────────────────────────────────────────
# ERA5 (resolución 0.25°)
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
# IMERG (resolución 0.1°)
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
# CHIRPS (resolución 0.05°)
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


def get_relations_for_source(source: str) -> list:
    """Retorna las relaciones cuenca-celda para una fuente dada."""
    source_upper = source.upper()
    if source_upper == "ERA5":
        return ERA5_RELATIONS
    elif source_upper == "IMERG":
        return IMERG_RELATIONS
    elif source_upper == "CHIRPS":
        return CHIRPS_RELATIONS
    else:
        raise ValueError(f"Fuente desconocida: {source}. Usar ERA5, IMERG o CHIRPS.")


def get_cell_ids_for_source(source: str) -> list:
    """Retorna lista única de cell_ids para una fuente."""
    relations = get_relations_for_source(source)
    return list({r["cell_id"] for r in relations})


def get_cuencas_for_source(source: str) -> list:
    """Retorna lista de cuencas únicas [{dn, nombre}] para una fuente."""
    relations = get_relations_for_source(source)
    seen = {}
    for r in relations:
        if r["dn"] not in seen:
            seen[r["dn"]] = {"dn": r["dn"], "nombre": r["nombre"]}
    return list(seen.values())
