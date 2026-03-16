"""
Funciones utilitarias para los endpoints de análisis histórico.
"""
import json
import ast
import math
from typing import Optional

import orjson
from fastapi.responses import Response

from app.models.parquet_file import ParquetFile


def get_file_metadata(file: ParquetFile) -> dict:
    """
    Parsea el campo file_metadata (JSON string) a dict.
    Soporta tanto JSON puro como str(dict) de datos legados.
    """
    if not file.file_metadata:
        return {}
    try:
        parsed = json.loads(file.file_metadata)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        try:
            parsed = ast.literal_eval(file.file_metadata)
            return parsed if isinstance(parsed, dict) else {}
        except (ValueError, SyntaxError):
            return {}


def infer_resolution_from_filename(filename: Optional[str]) -> Optional[float]:
    """Infiere la resolución del dataset a partir del nombre del archivo."""
    name = (filename or "").lower()
    if "chirps" in name:
        return 0.05
    if "imerg" in name:
        return 0.10
    if "era5" in name:
        return 0.25
    return None


def to_json_safe(value):
    """Convierte recursivamente valores a tipos seguros para JSON (NaN/Inf → None)."""
    if isinstance(value, dict):
        return {k: to_json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json_safe(v) for v in value]
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    # Soporte para escalares numpy/pandas (np.float64, pd.NA, etc.)
    if hasattr(value, "item") and callable(getattr(value, "item")):
        try:
            return to_json_safe(value.item())
        except Exception:
            pass
    # Captura genérica de NaN
    try:
        if value != value:
            return None
    except Exception:
        pass
    return value


def orjson_response(data: dict) -> Response:
    """
    Serializa un dict a Response usando orjson.
    orjson maneja nativamete: NaN/Inf → null, numpy scalars, pd.NA → null,
    datetime.date → ISO string. 3-10x más rápido que stdlib json en payloads grandes.
    """
    return Response(
        content=orjson.dumps(data, option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY),
        media_type="application/json",
    )
