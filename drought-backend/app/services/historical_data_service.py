"""
Servicio optimizado para consulta de datos históricos de sequía usando DuckDB.

ESTRATEGIA OPTIMIZADA (Plan Gratuito):
1. Caché local efímero (/tmp en producción, persiste durante vida del container)
2. Redis: Cache de resultados de queries (KB en vez de MB)
3. DuckDB: Queries minimalistas (solo columnas necesarias)
4. Cloudflare R2: Storage gratuito hasta 10 GB

PERFORMANCE:
- Cache hit (Redis): ~10ms
- Primera query (descarga a /tmp): ~20-30s
- Queries siguientes (desde /tmp): ~50-200ms ⚡
- Ephemeral storage: 10 GB en Railway, 3 GB en Fly.io
"""
import duckdb
import logging
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import date
import hashlib
import requests
from app.services.cache import CacheService
from app.services.cloud_storage import CloudStorageService
from app.services.historical_constants import (
    COLUMN_MAPPING,
    PARQUET_FILES,
    INDEX_DROUGHT_SCALES,
    DROUGHT_INDEX_KEYS,
    HYDROMETEOROLOGICAL_KEYS,
)
from app.services.historical_timeseries_mixin import TimeseriesMixin
from app.services.historical_spatial_mixin import SpatialMixin
from app.services.tiered_storage import decode_multi_keys, build_duckdb_source, touch_cache_file


class HistoricalDataService(TimeseriesMixin, SpatialMixin):
    """
    Servicio para consulta rápida de datos históricos usando DuckDB.

    La lógica de consulta está dividida en mixins especializados:
    - TimeseriesMixin  → query_timeseries  (historical_timeseries_mixin.py)
    - SpatialMixin     → query_spatial_data (historical_spatial_mixin.py)
    """
    
    # Constantes importadas desde historical_constants  (ver ese módulo para editarlas)
    COLUMN_MAPPING = COLUMN_MAPPING
    PARQUET_FILES = PARQUET_FILES
    INDEX_DROUGHT_SCALES = INDEX_DROUGHT_SCALES
    
    def __init__(self, cache_service: Optional[CacheService] = None, cloud_storage_service: Optional[CloudStorageService] = None):
        """
        Inicializa el servicio de datos históricos.
        
        Args:
            cache_service: Servicio de caché (opcional)
            cloud_storage_service: Servicio de cloud storage (opcional)
        """
        self.cache = cache_service or CacheService()
        self.cloud_service = cloud_storage_service or CloudStorageService()
        self.conn = None  # Conexión DuckDB se creará bajo demanda
        
        
        # Detectar entorno (producción vs desarrollo)
        import os
        self.is_production = bool(
            os.getenv('RAILWAY_ENVIRONMENT') or 
            os.getenv('RENDER') or 
            os.getenv('FLY_APP_NAME')
        )
  
    def _get_scale_for_index(self, variable: str) -> Dict[str, Any]:
        if variable in self.INDEX_DROUGHT_SCALES:
            return self.INDEX_DROUGHT_SCALES[variable]
        return self.INDEX_DROUGHT_SCALES["DEFAULT"]

    def _apply_drought_scale(self, df: pd.DataFrame, variable: str) -> pd.DataFrame:
        scale = self._get_scale_for_index(variable)
        bins = scale["bins"]
        cats = scale["categories"]
        labels     = [c["label"]    for c in cats]
        colors     = [c["color"]    for c in cats]
        severities = [c["severity"] for c in cats]

        # ⚡ Un solo np.searchsorted en vez de 3x pd.cut (3x scan → 1x scan)
        vals = df["value"].values
        # searchsorted con side='right' + right=False equivale a pd.cut(right=False)
        finite_bins = np.array(bins[1:-1], dtype=np.float64)  # sin -inf/+inf
        indices = np.searchsorted(finite_bins, vals, side="right")  # 0..len(cats)-1

        cat_arr = np.empty(len(vals), dtype=object)
        col_arr = np.empty(len(vals), dtype=object)
        sev_arr = np.empty(len(vals), dtype=np.float64)

        for i, cat in enumerate(cats):
            mask = indices == i
            cat_arr[mask] = cat["label"]
            col_arr[mask] = cat["color"]
            sev_arr[mask] = cat["severity"]

        df["category"] = pd.array(cat_arr, dtype="string")
        df["color"]    = pd.array(col_arr, dtype="string")
        df["severity"] = pd.array(sev_arr, dtype="Int64")

        null_mask = np.isnan(vals) if vals.dtype.kind == 'f' else df["value"].isna()
        if np.any(null_mask):
            df.loc[null_mask, ["category", "color", "severity"]] = pd.NA
        return df

    def _get_connection(self) -> duckdb.DuckDBPyConnection:
        """
        Obtiene o crea una conexión DuckDB con soporte para Cloudflare R2.
        Usa CREATE SECRET nativo de DuckDB para R2.
        
        Returns:
            Conexión DuckDB
        """
        if self.conn is None:
            self.conn = duckdb.connect(database=':memory:')
            
            # ✅ Habilitar lectura HTTP/S3/R2
            # Nota: INSTALL httpfs descarga la extensión de internet y puede bloquear
            # en Windows. Usar autoinstall/autoload en su lugar.
            try:
                self.conn.execute("SET autoinstall_known_extensions = true;")
                self.conn.execute("SET autoload_known_extensions = true;")
            except Exception:
                pass
            try:
                self.conn.execute("LOAD httpfs;")
            except Exception:
                print("Warning: httpfs not pre-installed, will autoload on demand")
            
            # 🚀 CONFIGURACIÓN NATIVA R2 (soporte oficial DuckDB)
            from app.core.config import settings
            
            # Obtener ACCOUNT_ID
            account_id = settings.CLOUD_STORAGE_ACCOUNT_ID or settings.CLOUD_ACCOUNT_ID
            if not account_id and settings.CLOUD_STORAGE_ENDPOINT:
                # Extraer de URL: https://ACCOUNT_ID.r2.cloudflarestorage.com
                import re
                match = re.search(r'https?://([a-f0-9]{32})\.r2\.cloudflarestorage\.com', settings.CLOUD_STORAGE_ENDPOINT)
                if match:
                    account_id = match.group(1)
            
            # Crear SECRET nativo de R2
            if account_id and settings.CLOUD_STORAGE_ACCESS_KEY and settings.CLOUD_STORAGE_SECRET_KEY:
                try:
                    self.conn.execute(f"""
                        CREATE SECRET r2_secret (
                            TYPE r2,
                            KEY_ID '{settings.CLOUD_STORAGE_ACCESS_KEY}',
                            SECRET '{settings.CLOUD_STORAGE_SECRET_KEY}',
                            ACCOUNT_ID '{account_id}'
                        )
                    """)
                except Exception as e:
                    # Si ya existe, continuar
                    pass
            
            # Recursos: ajustar según entorno
            if self.is_production:
                self.conn.execute("SET threads TO 2")
                self.conn.execute("SET memory_limit = '512MB'")
            else:
                # Desarrollo: aprovechar todos los cores disponibles
                self.conn.execute("SET threads TO 4")
                self.conn.execute("SET memory_limit = '2GB'")
            
            import tempfile
            self.conn.execute(f"SET temp_directory = '{tempfile.gettempdir().replace(chr(92), '/')}'")

            
            # HTTP/Network optimizations
            self.conn.execute("SET http_timeout = 120000")  # 2 minutos
            self.conn.execute("SET http_retries = 2")
            self.conn.execute("SET enable_http_metadata_cache = true")
            self.conn.execute("SET http_keep_alive = true")
            
            # Performance optimizations
            self.conn.execute("SET force_download = false")
            self.conn.execute("SET enable_object_cache = true")  # Cache footers/metadata de parquet en RAM
            self.conn.execute("SET preserve_insertion_order = false")
            self.conn.execute("SET enable_progress_bar = false")
        
        return self.conn

    def _get_available_freqs(self, parquet_source: str, parquet_url: str, variable: str, file_format: str, var_column: str = 'var') -> list:
        """
        Detecta frecuencias disponibles para una variable en un parquet.
        Resultado cacheado 24h (las frecuencias no cambian).

        Args:
            parquet_source: expresion DuckDB source (read_parquet(...)) o path local
            parquet_url: clave original (para cache key)
            variable: nombre de la variable
            file_format: 'long' o 'wide'
            var_column: nombre de la columna de variable en formato long
        """
        cache_key = f"freqs:{hashlib.md5((parquet_url + ':' + variable).encode()).hexdigest()}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            conn = self._get_connection()
            # Si parquet_source ya es una expresion read_parquet(...), usarla directamente
            # Si es un path local simple, envolverla
            if parquet_source.startswith("read_parquet("):
                from_expr = parquet_source
            else:
                from_expr = f"read_parquet('{parquet_source}')"

            if file_format == 'long':
                freq_query = f"SELECT DISTINCT freq FROM {from_expr} WHERE {var_column} = '{variable}'"
            else:
                freq_query = f"SELECT DISTINCT freq FROM {from_expr} WHERE {variable} IS NOT NULL"
            available_freqs = [r[0] for r in conn.execute(freq_query).fetchall() if r[0]]
        except Exception:
            available_freqs = []

        self.cache.set(cache_key, available_freqs, expire=86400)
        return available_freqs
    
    def _get_parquet_url(self, cloud_key_or_url: str, use_cache: bool = True) -> str:
        """
        Obtiene path local óptimo usando caché efímero.
        
        ESTRATEGIA OPTIMIZADA:
        - Producción: /tmp/parquet_cache (ephemeral storage - Railway 10GB, Fly.io 3GB)
        - Desarrollo: .cache_parquet/ (persiste en disco local)
        - Primera descarga: ~20-30s
        - Consultas siguientes: ~50-200ms ⚡
        
        Args:
            cloud_key_or_url: Cloud key (e.g., 'parquet/file.parquet') o URL
            use_cache: Si True, usa cache local (RECOMENDADO)
            
        Returns:
            Path local al archivo parquet
        """
        from app.core.config import settings
        import os
        
        # Si use_cache desactivado, retornar URL directo (no recomendado - lento)
        if not use_cache:
            bucket = settings.CLOUD_STORAGE_BUCKET
            if cloud_key_or_url.startswith('http'):
                return cloud_key_or_url
            return f"s3://{bucket}/{cloud_key_or_url}"
        
        # Extraer cloud_key limpio
        if cloud_key_or_url.startswith('http://') or cloud_key_or_url.startswith('https://'):
            from urllib.parse import urlparse
            parsed = urlparse(cloud_key_or_url)
            parts = parsed.path.strip('/').split('/', 1)
            cloud_key = parts[1] if len(parts) > 1 else parts[0]
        elif cloud_key_or_url.startswith(('r2://', 's3://')):
            cloud_key = '/'.join(cloud_key_or_url.split('/')[3:])
        else:
            cloud_key = cloud_key_or_url
        
        # 🚀 CACHÉ EFÍMERO: /tmp en producción, .cache_parquet local en desarrollo
        if self.is_production:
            cache_dir = '/tmp/parquet_cache'
        else:
            # Desarrollo: siempre usar directorio local visible
            cache_dir = '.cache_parquet'
        os.makedirs(cache_dir, exist_ok=True)
        
        key_hash = hashlib.md5(cloud_key.encode()).hexdigest()
        local_path = os.path.join(cache_dir, f"{key_hash}.parquet")
        
        # Cache hit → retornar inmediato
        if os.path.exists(local_path) and os.path.getsize(local_path) > 1024:
            touch_cache_file(local_path)
            return local_path
        
        # Cache miss → descargar
        try:
            file_data = self.cloud_service.download_file(cloud_key)
            if file_data:
                with open(local_path, 'wb') as f:
                    f.write(file_data)
                return local_path
        except Exception:
            # Fallback: presigned URL
            try:
                url = self.cloud_service.get_file_url(cloud_key, expires_in=3600)
                if url:
                    response = requests.get(url, stream=True, timeout=120)
                    response.raise_for_status()
                    with open(local_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    return local_path
            except Exception:
                pass
        
        # Si todo falla, retornar URL directo
        return f"s3://{settings.CLOUD_STORAGE_BUCKET}/{cloud_key}"

    def _resolve_parquet_source(self, parquet_url: str) -> Dict[str, Any]:
        """
        Resuelve un parquet_url a una expresion DuckDB valida.

        Soporta:
        - Single key: "parquet/file.parquet" -> read_parquet('/local/path.parquet')
        - Multi key (tiered): "key1|key2" -> read_parquet(['/path1.parquet', '/path2.parquet'])

        El separador '|' es inyectado por historical.py cuando detecta un dataset
        con estrategia historical_updates.

        Returns:
            Dict con:
            - "source_expr": string listo para usar en FROM de DuckDB
            - "local_paths": lista de paths locales
            - "primary_path": primer path (para deteccion de formato, freqs, etc.)
        """
        keys = decode_multi_keys(parquet_url)
        local_paths = [self._get_parquet_url(k) for k in keys]
        source_expr = build_duckdb_source(local_paths)

        return {
            "source_expr": source_expr,
            "local_paths": local_paths,
            "primary_path": local_paths[0],
        }

    def get_available_variables(self) -> List[Dict[str, Any]]:
        """
        Obtiene lista de variables y índices disponibles del CATÁLOGO FIJO.
        
        Nota: Este es el catálogo predefinido. Para ver columnas reales de un archivo
        específico, usa get_columns_from_file().
        
        Returns:
            Lista de variables/índices del catálogo
        """
        variables = []
        for col_name, info in self.COLUMN_MAPPING.items():
            variables.append({
                "id": col_name,
                "name": info["name"],
                "unit": info["unit"],
                "category": info["category"],
                "available": True,
                "supports_prediction": info.get("supports_prediction", False),
                "source": "catalog"  # Indica que viene del catálogo fijo
            })
        return variables
    
    def get_columns_from_file(self, parquet_url: str) -> Dict[str, Any]:
        """
        Detecta automáticamente las columnas disponibles en un archivo .parquet.
        
        Args:
            parquet_url: Cloud key (e.g., 'parquet/file.parquet') o URL completa del archivo
            
        Returns:
            Diccionario con información de columnas detectadas
        """
        cache_key = f"columns:{hashlib.md5(parquet_url.encode()).hexdigest()}"
        
        # Verificar cache
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        try:
            # ✅ Usar DuckDB para leer solo metadatos (no descarga archivo completo)
            conn = self._get_connection()
            url = self._get_parquet_url(parquet_url)
            
            # Leer schema del parquet (solo metadatos, ~10 KB)
            schema_query = f"DESCRIBE SELECT * FROM read_parquet('{url}') LIMIT 0"
            schema_df = conn.execute(schema_query).fetchdf()
            
            # Categorizar columnas
            detected_columns = {
                "metadata_columns": [],
                "data_columns": [],
                "all_columns": []
            }
            
            metadata_cols = ["date", "time", "fecha", "datetime", "ds", "lat", "lon", 
                           "latitude", "longitude", "cell_id", "station_id"]
            
            for _, row in schema_df.iterrows():
                col_name = row['column_name']
                col_type = row['column_type']
                
                col_info = {
                    "name": col_name,
                    "type": col_type,
                    "source": "detected"  # Viene del archivo real
                }
                
                # Verificar si está en el catálogo conocido
                if col_name in self.COLUMN_MAPPING:
                    catalog_info = self.COLUMN_MAPPING[col_name]
                    col_info.update({
                        "display_name": catalog_info["name"],
                        "unit": catalog_info["unit"],
                        "category": catalog_info["category"],
                        "in_catalog": True
                    })
                else:
                    col_info["in_catalog"] = False
                
                # Clasificar
                if col_name.lower() in metadata_cols:
                    detected_columns["metadata_columns"].append(col_info)
                else:
                    detected_columns["data_columns"].append(col_info)
                
                detected_columns["all_columns"].append(col_info)
            
            # Estadísticas
            detected_columns["summary"] = {
                "total_columns": len(detected_columns["all_columns"]),
                "data_columns": len(detected_columns["data_columns"]),
                "metadata_columns": len(detected_columns["metadata_columns"]),
                "in_catalog": len([c for c in detected_columns["data_columns"] if c.get("in_catalog")]),
                "unknown": len([c for c in detected_columns["data_columns"] if not c.get("in_catalog")])
            }
            
            # Cache por 1 hora
            self.cache.set(cache_key, detected_columns, expire=3600)
            
            return detected_columns
            
        except Exception as e:
            raise Exception(f"Error detectando columnas del archivo: {str(e)}")
    
    def validate_file_structure(self, parquet_url: str) -> Dict[str, Any]:
        """
        Valida que un archivo .parquet tenga la estructura esperada.
        
        Args:
            parquet_url: Cloud key (e.g., 'parquet/file.parquet') o URL completa del archivo
            
        Returns:
            Resultado de validación con warnings y errores
        """
        try:
            columns_info = self.get_columns_from_file(parquet_url)
            
            validation = {
                "valid": True,
                "errors": [],
                "warnings": [],
                "info": []
            }
            
            # Verificar columnas requeridas
            required = ["date", "lat", "lon"]
            all_col_names = [c["name"] for c in columns_info["all_columns"]]
            
            for req in required:
                if req not in all_col_names and req.lower() not in [c.lower() for c in all_col_names]:
                    validation["errors"].append(f"Falta columna requerida: '{req}'")
                    validation["valid"] = False
            
            # Verificar columnas de datos
            data_cols = [c["name"] for c in columns_info["data_columns"]]
            
            if len(data_cols) == 0:
                validation["errors"].append("No se encontraron columnas de datos")
                validation["valid"] = False
            
            # Warnings para columnas no conocidas
            unknown_cols = [c["name"] for c in columns_info["data_columns"] if not c.get("in_catalog")]
            if unknown_cols:
                validation["warnings"].append(
                    f"Columnas no reconocidas en el catálogo: {', '.join(unknown_cols)}"
                )
            
            # Info de columnas detectadas
            known_cols = [c["name"] for c in columns_info["data_columns"] if c.get("in_catalog")]
            if known_cols:
                validation["info"].append(
                    f"Columnas reconocidas: {', '.join(known_cols)}"
                )
            
            return validation
            
        except Exception as e:
            return {
                "valid": False,
                "errors": [f"Error validando archivo: {str(e)}"],
                "warnings": [],
                "info": []
            }
    
    def _filter_catalog_by_keys(self, keys: List[str]) -> List[Dict[str, Any]]:
        """Filtra COLUMN_MAPPING por una lista de claves y retorna items del catálogo."""
        return [
            {
                "id": key,
                "name": self.COLUMN_MAPPING[key]["name"],
                "unit": self.COLUMN_MAPPING[key]["unit"],
                "category": self.COLUMN_MAPPING[key]["category"],
                "available": True,
                "supports_prediction": self.COLUMN_MAPPING[key].get("supports_prediction", False),
            }
            for key in keys
            if key in self.COLUMN_MAPPING
        ]

    def get_drought_indices(self) -> List[Dict[str, Any]]:
        """Obtiene solo los índices de sequía."""
        return self._filter_catalog_by_keys(DROUGHT_INDEX_KEYS)

    def get_hydrometeorological_variables(self) -> List[Dict[str, Any]]:
        """Obtiene solo las variables hidrometeorológicas."""
        return self._filter_catalog_by_keys(HYDROMETEOROLOGICAL_KEYS)
    
    def categorize_drought_value(self, value: float, variable: str = "SPI") -> Dict[str, Any]:
        if pd.isna(value):
            return {"category": "no_data", "label": "Sin Datos", "color": "#CCCCCC", "severity": -1}
        scale = self._get_scale_for_index(variable)
        bins = scale["bins"]
        cats = scale["categories"]
        result = pd.cut([value], bins=bins, labels=[c["label"] for c in cats],
                        right=False, include_lowest=True)
        label = str(result[0]) if result[0] is not None else cats[3]["label"]
        cat_info = next((c for c in cats if c["label"] == label), cats[3])
        return {"category": label, "label": label, "color": cat_info["color"],
                "severity": cat_info["severity"], "value": value}
        
    def _detect_parquet_format(self, parquet_url: str, resolved_path: str = None, source_expr: str = None) -> dict:
        """
        Detecta el formato del parquet leyendo SOLO metadatos (no descarga archivo completo).

        Args:
            parquet_url: URL del parquet o cloud_key (usado como cache key)
            resolved_path: Path local ya resuelto (evita llamar _get_parquet_url de nuevo)
            source_expr: Expresion DuckDB source (read_parquet(...)) para multi-archivo

        Returns:
            Dict con 'format' ('wide' o 'long') y 'date_column' (nombre de la columna de fecha)
        """
        # Cache para evitar lecturas repetidas de metadatos
        # v2: incluye 'columns' — invalida cache anterior que no lo tenia
        cache_key = f"format_v2:{hashlib.md5(parquet_url.encode()).hexdigest()}"
        cached = self.cache.get(cache_key)
        if cached and 'columns' in cached:
            return cached

        try:
            conn = self._get_connection()

            # Determinar la expresion FROM para DuckDB
            if source_expr and source_expr.startswith("read_parquet("):
                from_expr = source_expr
            elif resolved_path:
                from_expr = f"read_parquet('{resolved_path}')"
            else:
                url = self._get_parquet_url(parquet_url)
                from_expr = f"read_parquet('{url}')"

            # DuckDB lee solo metadatos (~10 KB en vez de todo el archivo)
            schema_query = f"DESCRIBE SELECT * FROM {from_expr} LIMIT 0"
            schema_df = conn.execute(schema_query).fetchdf()
            
            column_names = schema_df['column_name'].tolist()
            
            result = {
                'format': 'wide',
                'date_column': 'date',
                'var_column': 'var',
                'columns': column_names
            }
            
            # Detectar columna de fecha
            if 'date' in column_names:
                result['date_column'] = 'date'
            elif 'datetime' in column_names:
                result['date_column'] = 'datetime'
            elif 'fecha' in column_names:
                result['date_column'] = 'fecha'
            elif 'ds' in column_names:
                result['date_column'] = 'ds'
            elif 'time' in column_names:
                result['date_column'] = 'time'
            
            # Long format: columnas de variable ('var' o 'kind') + 'value'
            if 'var' in column_names and 'value' in column_names:
                result['format'] = 'long'
                result['var_column'] = 'var'
            elif 'kind' in column_names and 'value' in column_names:
                result['format'] = 'long'
                result['var_column'] = 'kind'
            else:
                known_vars = set(self.COLUMN_MAPPING.keys())
                if any(col in known_vars for col in column_names):
                    result['format'] = 'wide'
            
            # Cache por 24 horas (metadatos nunca cambian)
            self.cache.set(cache_key, result, expire=86400)
            return result
            
        except Exception as e:
            logging.getLogger("historical").warning(
                f"_detect_parquet_format failed for {parquet_url}: {e}"
            )
            return {'format': 'wide', 'date_column': 'date', 'columns': []}
    
    
    def get_date_range(self, parquet_url: str) -> Tuple[date, date]:
        """
        Obtiene el rango de fechas disponible en un archivo parquet.
        Soporta multi-archivo (parquet_url con '|').
        """
        cache_key = f"date_range:{hashlib.md5(parquet_url.encode()).hexdigest()}"

        cached = self.cache.get(cache_key)
        if cached:
            return cached

        try:
            conn = self._get_connection()
            source = self._resolve_parquet_source(parquet_url)

            # Detectar columna de fecha real del parquet
            fmt = self._detect_parquet_format(parquet_url, source_expr=source['source_expr'])
            date_col = fmt.get('date_column', 'date')

            query = f"""
            SELECT
                MIN({date_col}) as min_date,
                MAX({date_col}) as max_date
            FROM {source['source_expr']}
            """

            result = conn.execute(query).fetchone()
            date_range = (result[0], result[1])

            # Cache por 24 horas
            self.cache.set(cache_key, date_range, expire=86400)

            return date_range

        except Exception as e:
            raise Exception(f"Error obteniendo rango de fechas: {str(e)}")
    
    def get_spatial_bounds(self, parquet_url: str) -> Dict[str, float]:
        """
        Obtiene los limites espaciales del archivo parquet.
        Soporta multi-archivo (parquet_url con '|').
        """
        cache_key = f"spatial_bounds:{hashlib.md5(parquet_url.encode()).hexdigest()}"

        cached = self.cache.get(cache_key)
        if cached:
            return cached

        try:
            conn = self._get_connection()
            source = self._resolve_parquet_source(parquet_url)

            query = f"""
            SELECT
                MIN(lat) as min_lat,
                MAX(lat) as max_lat,
                MIN(lon) as min_lon,
                MAX(lon) as max_lon
            FROM {source['source_expr']}
            """
            
            result = conn.execute(query).fetchone()
            bounds = {
                "min_lat": float(result[0]),
                "max_lat": float(result[1]),
                "min_lon": float(result[2]),
                "max_lon": float(result[3])
            }
            
            # Cache por 24 horas
            self.cache.set(cache_key, bounds, expire=86400)
            
            return bounds
            
        except Exception as e:
            raise Exception(f"Error obteniendo límites espaciales: {str(e)}")
    def get_unique_cells(self, parquet_url: str) -> List[str]:
        """
        Obtiene los cell_ids unicos de un archivo parquet.
        Soporta multi-archivo (parquet_url con '|').
        Si el parquet no tiene columna cell_id, la computa desde lon/lat.
        """
        cache_key = f"unique_cells:{hashlib.md5(parquet_url.encode()).hexdigest()}"

        cached = self.cache.get(cache_key)
        if cached:
            return cached

        try:
            conn = self._get_connection()
            source = self._resolve_parquet_source(parquet_url)

            # Detectar formato para saber las columnas reales
            fmt = self._detect_parquet_format(parquet_url, source_expr=source['source_expr'])
            columns = fmt.get('columns', [])

            if 'cell_id' in columns:
                query = f"""
                SELECT DISTINCT cell_id
                FROM {source['source_expr']}
                ORDER BY cell_id
                """
            elif 'lon' in columns and 'lat' in columns:
                query = f"""
                SELECT DISTINCT
                    CAST(PRINTF('%.6f', lon) || '_' || PRINTF('%.6f', lat) AS VARCHAR) as cell_id
                FROM {source['source_expr']}
                ORDER BY cell_id
                """
            else:
                raise Exception(
                    f"El parquet no tiene columnas cell_id ni lon/lat. "
                    f"Columnas disponibles: {columns}"
                )

            result = conn.execute(query).fetchall()
            cells = [row[0] for row in result]

            # Cache por 24 horas (las celdas son fijas, no cambian)
            self.cache.set(cache_key, cells, expire=86400)

            return cells

        except Exception as e:
            raise Exception(f"Error obteniendo celdas únicas: {str(e)}")
