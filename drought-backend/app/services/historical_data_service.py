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
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import date, datetime, timedelta
from io import BytesIO
import hashlib
import requests
from app.services.cache import CacheService
from app.services.cloud_storage import CloudStorageService


class HistoricalDataService:
    """
    Servicio para consulta rápida de datos históricos usando DuckDB.
    DuckDB puede leer parquet directamente desde URLs y hacer consultas SQL muy rápidas.
    """
    
    # Mapeo de columnas reales en tus archivos .parquet
    COLUMN_MAPPING = {
        # Variables hidrometeorológicas
        "precip": {"name": "Precipitación", "unit": "mm", "category": "meteorological"},
        "tmean": {"name": "Temperatura Media", "unit": "°C", "category": "meteorological"},
        "tmin": {"name": "Temperatura Mínima", "unit": "°C", "category": "meteorological"},
        "tmax": {"name": "Temperatura Máxima", "unit": "°C", "category": "meteorological"},
        "pet": {"name": "Evapotranspiración Potencial", "unit": "mm", "category": "meteorological"},
        "balance": {"name": "Balance Hídrico", "unit": "mm", "category": "hydrological"},
        # Índices de sequía
        "SPI": {"name": "SPI", "unit": "adimensional", "category": "meteorological", "supports_prediction": True},
        "SPEI": {"name": "SPEI", "unit": "adimensional", "category": "meteorological", "supports_prediction": True},
        "RAI": {"name": "RAI", "unit": "adimensional", "category": "meteorological", "supports_prediction": False},
        "EDDI": {"name": "EDDI", "unit": "adimensional", "category": "meteorological", "supports_prediction": True},
        "PDSI": {"name": "PDSI", "unit": "adimensional", "category": "hydrological", "supports_prediction": False},
    }
    
    # Archivos parquet disponibles con diferentes resoluciones
    PARQUET_FILES = {
        "low_res": {
            "name": "Baja Resolución (0.25°)",
            "resolution": 0.25,
            "records": "1M",
            "url_key": "low_res_url"  # Se configurará desde base de datos
        },
        "medium_res": {
            "name": "Media Resolución (0.1°)",
            "resolution": 0.1,
            "records": "10M",
            "url_key": "medium_res_url"
        },
        "high_res": {
            "name": "Alta Resolución",
            "resolution": 0.05,
            "records": "50M",
            "url_key": "high_res_url"
        }
    }
    
      # Escalas de severidad por índice
    # Nota: bins en orden ascendente para pd.cut (intervalos [a,b) con right=False)
    INDEX_DROUGHT_SCALES = {
        "DEFAULT": {  # SPI, SPEI, RAI
            "bins": [-np.inf, -2.0, -1.5, -1.0, 1.0, 1.5, 2.0, np.inf],
            "categories": [
                {"label": "Extremadamente Seco",  "color": "#FF0000", "severity": 6},
                {"label": "Severamente Seco",     "color": "#FFA500", "severity": 5},
                {"label": "Moderadamente Seco",   "color": "#FFFF00", "severity": 4},
                {"label": "Normal",               "color": "#00FF00", "severity": 3},
                {"label": "Moderadamente Húmedo", "color": "#00FFFF", "severity": 2},
                {"label": "Muy Húmedo",           "color": "#0000FF", "severity": 1},
                {"label": "Extremadamente Húmedo","color": "#000080", "severity": 0},
            ],
        },
        "PDSI": {
            "bins": [-np.inf, -4.0, -3.0, -2.0, 2.0, 3.0, 4.0, np.inf],
            "categories": [
                {"label": "Extremadamente Seco",  "color": "#FF0000", "severity": 6},
                {"label": "Severamente Seco",     "color": "#FFA500", "severity": 5},
                {"label": "Moderadamente Seco",   "color": "#FFFF00", "severity": 4},
                {"label": "Normal",               "color": "#00FF00", "severity": 3},
                {"label": "Moderadamente Húmedo", "color": "#00FFFF", "severity": 2},
                {"label": "Muy Húmedo",           "color": "#0000FF", "severity": 1},
                {"label": "Extremadamente Húmedo","color": "#000080", "severity": 0},
            ],
        },
        "EDDI": {  # seco positivo, húmedo negativo
            "bins": [-np.inf, -2.0, -1.5, -1.0, 1.0, 1.5, 2.0, np.inf],
            "categories": [
                {"label": "Extremadamente Húmedo","color": "#000080", "severity": 0},
                {"label": "Muy Húmedo",           "color": "#0000FF", "severity": 1},
                {"label": "Moderadamente Húmedo", "color": "#00FFFF", "severity": 2},
                {"label": "Normal",               "color": "#00FF00", "severity": 3},
                {"label": "Moderadamente Seco",   "color": "#FFFF00", "severity": 4},
                {"label": "Severamente Seco",     "color": "#FFA500", "severity": 5},
                {"label": "Extremadamente Seco",  "color": "#FF0000", "severity": 6},
            ],
        },
    }
    
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
        df["category"] = pd.cut(df["value"], bins=bins, labels=labels,
                                right=False, include_lowest=True).astype("string")
        df["color"]    = pd.cut(df["value"], bins=bins, labels=colors,
                                right=False, include_lowest=True).astype("string")
        df["severity"] = pd.cut(df["value"], bins=bins, labels=severities,
                                right=False, include_lowest=True).astype("Int64")
        null_mask = df["value"].isna()
        if null_mask.any():
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
            try:
                self.conn.execute("INSTALL httpfs;")
                self.conn.execute("LOAD httpfs;")
            except Exception:
                pass  # Ya instalado
            
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
            
            self.conn.execute("SET temp_directory = '/tmp'")
            
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
        
        # 🚀 CACHÉ EFÍMERO: /tmp en producción, local en desarrollo
        cache_dir = '/tmp/parquet_cache' if self.is_production else '.cache_parquet'
        os.makedirs(cache_dir, exist_ok=True)
        
        key_hash = hashlib.md5(cloud_key.encode()).hexdigest()
        local_path = os.path.join(cache_dir, f"{key_hash}.parquet")
        
        # Cache hit → retornar inmediato
        if os.path.exists(local_path) and os.path.getsize(local_path) > 1024:
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
    
    def get_drought_indices(self) -> List[Dict[str, Any]]:
        """
        Obtiene solo los índices de sequía.
        
        Returns:
            Lista de índices
        """
        indices = []
        drought_index_cols = ["SPI", "SPEI", "RAI", "EDDI", "PDSI"]
        
        for col_name in drought_index_cols:
            if col_name in self.COLUMN_MAPPING:
                info = self.COLUMN_MAPPING[col_name]
                indices.append({
                    "id": col_name,
                    "name": info["name"],
                    "unit": info["unit"],
                    "category": info["category"],
                    "available": True,
                    "supports_prediction": info.get("supports_prediction", False)
                })
        return indices
    
    def get_hydrometeorological_variables(self) -> List[Dict[str, Any]]:
        """
        Obtiene solo las variables hidrometeorológicas.
        
        Returns:
            Lista de variables
        """
        variables = []
        var_cols = ["precip", "tmean", "tmin", "tmax", "pet", "balance"]
        
        for col_name in var_cols:
            if col_name in self.COLUMN_MAPPING:
                info = self.COLUMN_MAPPING[col_name]
                variables.append({
                    "id": col_name,
                    "name": info["name"],
                    "unit": info["unit"],
                    "category": info["category"],
                    "available": True
                })
        return variables
    
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
        
    def _detect_parquet_format(self, parquet_url: str) -> dict:
        """
        Detecta el formato del parquet leyendo SOLO metadatos (no descarga archivo completo).
        
        Args:
            parquet_url: URL del parquet o cloud_key
            
        Returns:
            Dict con 'format' ('wide' o 'long') y 'date_column' (nombre de la columna de fecha)
        """
        # Cache para evitar lecturas repetidas de metadatos
        cache_key = f"format:{hashlib.md5(parquet_url.encode()).hexdigest()}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        try:
            conn = self._get_connection()
            url = self._get_parquet_url(parquet_url)
            
            # ✅ DuckDB lee solo metadatos (~10 KB en vez de todo el archivo)
            schema_query = f"DESCRIBE SELECT * FROM read_parquet('{url}') LIMIT 0"
            schema_df = conn.execute(schema_query).fetchdf()
            
            column_names = schema_df['column_name'].tolist()
            
            result = {
                'format': 'wide',
                'date_column': 'date'  # default
            }
            
            # Detectar columna de fecha
            if 'date' in column_names:
                result['date_column'] = 'date'
            elif 'datetime' in column_names:
                result['date_column'] = 'datetime'
            elif 'fecha' in column_names:
                result['date_column'] = 'fecha'
            elif 'time' in column_names:
                result['date_column'] = 'time'
            
            # Long format: tiene columnas 'var' y 'value'
            if 'var' in column_names and 'value' in column_names:
                result['format'] = 'long'
            # Wide format: las variables son columnas
            else:
                known_vars = set(self.COLUMN_MAPPING.keys())
                if any(col in known_vars for col in column_names):
                    result['format'] = 'wide'
            
            # Cache por 24 horas (metadatos nunca cambian)
            self.cache.set(cache_key, result, expire=86400)
            return result
            
        except Exception:
            return {'format': 'wide', 'date_column': 'date'}
    
    def query_timeseries(
        self,
        parquet_url: str,
        variable: str,
        start_date: date,
        end_date: date,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        cell_id: Optional[str] = None,
        limit: int = 70000
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float], Dict[str, Optional[float]]]:
        """
        Consulta serie de tiempo de una variable/índice usando DuckDB.
        
        Soporta dos formatos:
        - Wide: cada variable es una columna (SPI, SPEI, precip, etc.)
        - Long: columna 'var' con el nombre y columna 'value' con el valor
        
        Args:
            parquet_url: Cloud key (e.g., 'parquet/file.parquet') o URL completa del archivo
            variable: Nombre de la variable (precip, SPI, etc.)
            start_date: Fecha inicial
            end_date: Fecha final
            lat: Latitud (opcional)
            lon: Longitud (opcional)
            cell_id: ID de celda (opcional)
            limit: Máximo de registros a retornar (default: 70000)
            
        Returns:
            Tupla (data_points, estadísticas, coordenadas)
            - data_points: Lista de puntos SIN lat/lon (optimizado)
            - estadísticas: Dict con mean, min, max, std, count, missing
            - coordenadas: Dict con lat, lon del punto consultado
        """
        # Generar key de cache con protección contra errores
        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "timeseries",
                url=parquet_url,
                var=variable,
                start=str(start_date),
                end=str(end_date),
                lat=lat,
                lon=lon,
                cell=cell_id,
                limit=limit
            )
            
            # Verificar cache (deserializar dict → tupla)
            if cache_key:
                cached_result = self.cache.get(cache_key)
                if cached_result and isinstance(cached_result, dict) and "data" in cached_result:
                    coords = cached_result.get("coordinates", {"lat": None, "lon": None})
                    return cached_result["data"], cached_result["statistics"], coords
        except Exception:
            cache_key = None  # Si falla, continuar sin caché
        
        try:
            import time as time_module
            t0 = time_module.time()
            
            conn = self._get_connection()
            
            # Detectar formato y columna de fecha (lee solo metadatos, cacheado 24h)
            format_info = self._detect_parquet_format(parquet_url)
            file_format = format_info['format']
            date_col = format_info['date_column']
            
            # ⚡ Obtener URL óptima (pública R2 o local)
            source = self._get_parquet_url(parquet_url)
            
            # 🚀 OPTIMIZACIÓN: Seleccionar SOLO columnas necesarias
            # En vez de SELECT *, seleccionar solo date, lat, lon, value
            # Esto reduce transferencia de datos significativamente
            
            # Construir filtros
            where_clauses = []
            
            # Filtro de fechas - usar la columna detectada
            where_clauses.append(f"{date_col} >= CAST('{start_date}' AS DATE)")
            where_clauses.append(f"{date_col} <= CAST('{end_date}' AS DATE)")
            
            # 🔥 OPTIMIZACIÓN CRÍTICA: BETWEEN en vez de ABS() / cell_id string
            # DuckDB puede usar las estadísticas min/max de cada row-group del parquet
            # con predicados BETWEEN/>=/<= pero NO con ABS() ni cell_id string equality.
            # Esto puede saltar 90%+ de los row-groups en archivos grandes.
            if cell_id:
                # Parsear cell_id (formato LON_LAT) → filtro numérico exacto por lat/lon
                try:
                    _lon_s, _lat_s = cell_id.split('_', 1)
                    _eps = 0.0001  # sub-mm precision para absorber redondeo float
                    _clat, _clon = float(_lat_s), float(_lon_s)
                    where_clauses.append(f"lat BETWEEN {_clat - _eps} AND {_clat + _eps}")
                    where_clauses.append(f"lon BETWEEN {_clon - _eps} AND {_clon + _eps}")
                except (ValueError, IndexError):
                    where_clauses.append(f"cell_id = '{cell_id}'")  # fallback
            elif lat is not None and lon is not None:
                # BETWEEN permite pushdown de row-groups; 0.15° captura celda más cercana en res 0.25°
                tolerance = 0.15
                where_clauses.append(f"lat BETWEEN {lat - tolerance} AND {lat + tolerance}")
                where_clauses.append(f"lon BETWEEN {lon - tolerance} AND {lon + tolerance}")
            
            # 🚀 Construir query SIN ORDER BY (permite early stopping con LIMIT)
            # DuckDB puede usar HTTP Range Requests para leer solo row groups necesarios
            if file_format == 'long':
                where_clauses.append(f"var = '{variable}'")
                where_clause = " AND ".join(where_clauses)
                
                # ⚡ Sin ORDER BY - DuckDB optimiza con HTTP Range
                query = f"""
                SELECT 
                    {date_col} as date,
                    lat,
                    lon,
                    value
                FROM read_parquet('{source}')
                WHERE {where_clause}
                LIMIT {limit}
                """
            else:
                where_clause = " AND ".join(where_clauses)
                
                # ⚡ Sin ORDER BY - permite HTTP Range eficiente
                query = f"""
                SELECT 
                    {date_col} as date,
                    lat,
                    lon,
                    {variable} as value
                FROM read_parquet('{source}')
                WHERE {where_clause}
                LIMIT {limit}
                """
            
            # Ejecutar query
            t5 = time_module.time()
            result_df = conn.execute(query).fetchdf()
            t6 = time_module.time()
            
            # Log de timing siempre (útil para detectar regresiones)
            elapsed = t6 - t5
            level = "⚠️" if elapsed > 5 else "⚡"
            print(f"{level} timeseries query: {elapsed:.2f}s | file={parquet_url} var={variable} cell={cell_id} rows={len(result_df)}")
            
            # 🎯 Si buscamos por lat/lon, filtrar por el punto más cercano (en pandas, rápido)
            if lat is not None and lon is not None and len(result_df) > 0:
                result_df['distance'] = np.sqrt(
                    (result_df['lat'] - lat)**2 + (result_df['lon'] - lon)**2
                )
                closest_point = result_df.loc[result_df['distance'].idxmin()]
                actual_lat, actual_lon = closest_point['lat'], closest_point['lon']
                
                # Filtrar solo ese punto y eliminar columna auxiliar
                result_df = result_df[
                    (result_df['lat'] == actual_lat) & 
                    (result_df['lon'] == actual_lon)
                ].drop(columns=['distance'])
            
            # 🔄 Ordenar en pandas (mucho más rápido que ORDER BY en HTTP Range)
            if len(result_df) > 0:
                result_df = result_df.sort_values('date')
            
            # 🚀 Preparar datos de salida (operaciones vectorizadas, 10-100x más rápido)
            is_drought_index = variable in ["SPI", "SPEI", "RAI", "EDDI", "PDSI"]
            
            # Convertir valores a numérico y añadir quality
            result_df['value'] = pd.to_numeric(result_df['value'], errors='coerce')
            
            # Si es índice de sequía, categorizar vectorizadamente
            if is_drought_index:
                result_df = self._apply_drought_scale(result_df, variable)
            
            # 🎯 OPTIMIZACIÓN: Extraer coordenadas ANTES de convertir a dict
            # Para timeseries, lat/lon son constantes - no repetir en cada punto
            actual_lat = None
            actual_lon = None
            if len(result_df) > 0:
                actual_lat = float(result_df['lat'].iloc[0])
                actual_lon = float(result_df['lon'].iloc[0])
                
                # Eliminar lat/lon del DataFrame (datos repetitivos)
                result_df = result_df.drop(columns=['lat', 'lon'])
            
            # ⚡ Convertir fecha a string ISO ANTES de to_dict
            # Evita pandas.Timestamp en los dicts → FastAPI no necesita llamar
            # jsonable_encoder sobre toda la lista (10-100x más rápido para datasets grandes)
            if len(result_df) > 0 and 'date' in result_df.columns:
                result_df['date'] = result_df['date'].dt.strftime('%Y-%m-%d')
            
            # ⚡ Limpiar Inf→NaN (bug de datos). NaN queda como np.nan en el DataFrame;
            # orjson los serializa a null nativo sin recursión.
            if 'value' in result_df.columns:
                result_df['value'] = result_df['value'].replace([np.inf, -np.inf], np.nan)
            
            # Convertir a lista de diccionarios
            # Ahora solo incluye: date (str), value (float|None), [category, color, severity]
            data_points = result_df.to_dict('records')
            
            # Calcular estadísticas
            values = result_df['value'].dropna()
            statistics = {
                "mean": float(values.mean()) if len(values) > 0 else None,
                "min": float(values.min()) if len(values) > 0 else None,
                "max": float(values.max()) if len(values) > 0 else None,
                "std": float(values.std()) if len(values) > 0 else None,
                "count": len(values),
                "missing": len(result_df) - len(values)
            }
            
            # Guardar en cache (15 minutos) - como dict para serialización JSON
            if cache_key:
                result_dict = {
                    "data": data_points, 
                    "statistics": statistics,
                    "coordinates": {"lat": actual_lat, "lon": actual_lon}
                }
                self.cache.set(cache_key, result_dict, expire=900)
            
            # Retornar coordenadas junto con datos
            return data_points, statistics, {"lat": actual_lat, "lon": actual_lon}
            
        except Exception as e:
            raise Exception(f"Error consultando serie de tiempo: {str(e)}")
    
    def query_spatial_data(
        self,
        parquet_url: str,
        variable: str,
        target_date: date,
        bounds: Optional[Dict[str, float]] = None,
        limit: int = 100000
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float], date]:
        """
        Consulta datos espaciales (2D) para una fecha específica usando DuckDB.
        
        Soporta dos formatos:
        - Wide: cada variable es una columna
        - Long: columna 'var' con el nombre y columna 'value' con el valor
        
        Args:
            parquet_url: Cloud key o URL del archivo parquet
            variable: Nombre de la variable
            target_date: Fecha objetivo
            bounds: Límites espaciales (min_lat, max_lat, min_lon, max_lon)
            limit: Máximo de celdas a retornar (default: 100000)
            
        Returns:
            Tupla (celdas, estadísticas, fecha_usada)
        """
        # Cache key con protección
        cache_key = None
        try:
            cache_key = self.cache._generate_key(
                "spatial",
                url=parquet_url,
                var=variable,
                date=str(target_date),
                bounds=str(bounds) if bounds else None,
                limit=limit
            )
            
            # Verificar cache (deserializar dict → tupla)
            if cache_key:
                cached_result = self.cache.get(cache_key)
                if cached_result and isinstance(cached_result, dict) and "data" in cached_result:
                    used_date = cached_result.get("used_date", str(target_date))
                    return cached_result["data"], cached_result["statistics"], used_date
        except Exception:
            cache_key = None
        
        try:
            conn = self._get_connection()
            
            # Detectar formato y columna de fecha (lee solo metadatos, cacheado 24h)
            format_info = self._detect_parquet_format(parquet_url)
            file_format = format_info['format']
            date_col = format_info['date_column']
            
            # ⚡ Obtener URL óptima (pública R2 o local)
            source = self._get_parquet_url(parquet_url)
            
            # Construir filtros base (sin fecha)
            base_clauses = []
            
            # Filtro de bounds
            if bounds:
                base_clauses.append(f"lat >= {bounds.get('min_lat', -90)}")
                base_clauses.append(f"lat <= {bounds.get('max_lat', 90)}")
                base_clauses.append(f"lon >= {bounds.get('min_lon', -180)}")
                base_clauses.append(f"lon <= {bounds.get('max_lon', 180)}")
            
            # Construir query según formato
            if file_format == 'long':
                base_clauses.append(f"var = '{variable}'")
                value_expr = "value"
            else:
                value_expr = variable

            base_where = " AND ".join(base_clauses) if base_clauses else "1=1"

            def run_spatial_query(for_date: date):
                where_clause = f"{base_where} AND CAST({date_col} AS DATE) = CAST('{for_date}' AS DATE)"
                query = f"""
                SELECT 
                    lat,
                    lon,
                    AVG(CAST({value_expr} AS DOUBLE)) as value,
                    COUNT(*) as records_in_cell
                FROM read_parquet('{source}')
                WHERE {where_clause}
                GROUP BY lat, lon
                LIMIT {limit}
                """
                return conn.execute(query).fetchdf()

            used_date = target_date
            result_df = run_spatial_query(target_date)

            # Si no hay datos exactos para la fecha solicitada, usar la fecha más cercana con datos.
            if result_df.empty:
                nearest_date_query = f"""
                SELECT CAST({date_col} AS DATE) AS d
                FROM read_parquet('{source}')
                WHERE {base_where} AND {value_expr} IS NOT NULL
                GROUP BY 1
                ORDER BY ABS(DATEDIFF('day', d, CAST('{target_date}' AS DATE))) ASC
                LIMIT 1
                """
                nearest_row = conn.execute(nearest_date_query).fetchone()

                if nearest_row and nearest_row[0] is not None:
                    used_date = nearest_row[0]
                    result_df = run_spatial_query(used_date)
            
            # 🚀 Preparar datos espaciales (operaciones vectorizadas)
            is_drought_index = variable in ["SPI", "SPEI", "RAI", "EDDI", "PDSI"]
            
            # Convertir valores y crear cell_id vectorizadamente
            result_df['value'] = pd.to_numeric(result_df['value'], errors='coerce')
            result_df['cell_id'] = result_df.apply(
                lambda row: f"{row['lon']:.6f}_{row['lat']:.6f}", axis=1  # LON_LAT format
            )
            
            # Si es índice de sequía, categorizar vectorizadamente
            if is_drought_index:
                result_df = self._apply_drought_scale(result_df, variable)
            else:
                # Para variables meteorológicas, crear escala de colores basada en percentiles
                def get_color_for_value(value, vmin, vmax):
                    """Genera color de azul (bajo) a rojo (alto) basado en valor normalizado."""
                    if pd.isna(value) or vmin == vmax:
                        return "#CCCCCC"  # Gris para NaN o sin variación
                    
                    # Normalizar valor entre 0 y 1
                    normalized = (value - vmin) / (vmax - vmin)
                    normalized = max(0, min(1, normalized))  # Clamp entre 0-1
                    
                    # Escala de colores: azul (0) -> cyan (0.25) -> verde (0.5) -> amarillo (0.75) -> rojo (1)
                    if normalized < 0.25:
                        # Azul a Cyan
                        r = 0
                        g = int(255 * (normalized / 0.25))
                        b = 255
                    elif normalized < 0.5:
                        # Cyan a Verde
                        r = 0
                        g = 255
                        b = int(255 * (1 - (normalized - 0.25) / 0.25))
                    elif normalized < 0.75:
                        # Verde a Amarillo
                        r = int(255 * ((normalized - 0.5) / 0.25))
                        g = 255
                        b = 0
                    else:
                        # Amarillo a Rojo
                        r = 255
                        g = int(255 * (1 - (normalized - 0.75) / 0.25))
                        b = 0
                    
                    return f"#{r:02x}{g:02x}{b:02x}"
                
                # Calcular min/max para escala de colores
                valid_values = result_df['value'].dropna()
                if len(valid_values) > 0:
                    vmin = float(valid_values.min())
                    vmax = float(valid_values.max())
                    
                    # Aplicar colores vectorizadamente
                    result_df['color'] = result_df['value'].apply(
                        lambda v: get_color_for_value(v, vmin, vmax)
                    )
                else:
                    result_df['color'] = "#CCCCCC"
            
            # Convertir a lista de diccionarios
            grid_cells = result_df.to_dict('records')
            
            # Estadísticas
            values = result_df['value'].dropna()
            total_cells = len(result_df)
            valid_cells = len(values)
            statistics = {
                "mean": float(values.mean()) if len(values) > 0 else None,
                "min": float(values.min()) if len(values) > 0 else None,
                "max": float(values.max()) if len(values) > 0 else None,
                "std": float(values.std()) if len(values) > 0 else None,
                "count": valid_cells,
                "total_cells": total_cells,
                "unique_cells": total_cells,
                "valid_cells": valid_cells,
                "null_cells": total_cells - valid_cells,
                "raw_records_aggregated": int(result_df['records_in_cell'].sum()) if 'records_in_cell' in result_df else len(result_df)
            }
            
            # Cache (15 minutos) - como dict para serialización JSON
            if cache_key:
                result_dict = {
                    "data": grid_cells,
                    "statistics": statistics,
                    "used_date": str(used_date)
                }
                self.cache.set(cache_key, result_dict, expire=900)
            
            return grid_cells, statistics, used_date
            
        except Exception as e:
            raise Exception(f"Error consultando datos espaciales: {str(e)}")
    
    def get_date_range(self, parquet_url: str) -> Tuple[date, date]:
        """
        Obtiene el rango de fechas disponible en un archivo parquet.
        
        Args:
            parquet_url: URL del archivo
            
        Returns:
            Tupla (fecha_inicio, fecha_fin)
        """
        cache_key = f"date_range:{hashlib.md5(parquet_url.encode()).hexdigest()}"
        
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        try:
            conn = self._get_connection()
            url = self._get_parquet_url(parquet_url)
            
            query = f"""
            SELECT 
                MIN(date) as min_date,
                MAX(date) as max_date
            FROM read_parquet('{url}')
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
        Obtiene los límites espaciales del archivo parquet.
        
        Args:
            parquet_url: URL del archivo
            
        Returns:
            Diccionario con min_lat, max_lat, min_lon, max_lon
        """
        cache_key = f"spatial_bounds:{hashlib.md5(parquet_url.encode()).hexdigest()}"
        
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        try:
            conn = self._get_connection()
            url = self._get_parquet_url(parquet_url)
            
            query = f"""
            SELECT 
                MIN(lat) as min_lat,
                MAX(lat) as max_lat,
                MIN(lon) as min_lon,
                MAX(lon) as max_lon
            FROM read_parquet('{url}')
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
        Obtiene los cell_ids únicos de un archivo parquet.
        Útil para navegación jerárquica de grillas (0.25° → 0.1° → 0.05°).
        
        Args:
            parquet_url: URL del archivo parquet
            
        Returns:
            Lista de cell_ids únicos ordenados (formato "LON_LAT")
        """
        cache_key = f"unique_cells:{hashlib.md5(parquet_url.encode()).hexdigest()}"
        
        cached = self.cache.get(cache_key)
        if cached:
            return cached
        
        try:
            conn = self._get_connection()
            url = self._get_parquet_url(parquet_url)
            
            query = f"""
            SELECT DISTINCT cell_id
            FROM read_parquet('{url}')
            ORDER BY cell_id
            """
            
            result = conn.execute(query).fetchall()
            cells = [row[0] for row in result]
            
            # Cache por 24 horas (las celdas son fijas, no cambian)
            self.cache.set(cache_key, cells, expire=86400)
            
            return cells
            
        except Exception as e:
            raise Exception(f"Error obteniendo celdas únicas: {str(e)}")
