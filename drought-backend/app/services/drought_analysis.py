"""
Servicio para procesamiento de datos de sequía y análisis histórico.
Maneja variables hidrometeorológicas, índices de sequía y datos espaciales.
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import date, datetime, timedelta
from io import BytesIO
import pyarrow.parquet as pq


class DroughtAnalysisService:
    """Servicio para análisis de datos de sequía."""
    
    # Catálogo de variables hidrometeorológicas (columnas reales del parquet)
    HYDROMETEOROLOGICAL_VARIABLES = {
        "precip": {
            "name": "Precipitación",
            "description": "Precipitación acumulada",
            "unit": "mm",
            "category": "meteorological",
            "column_names": ["precip", "precipitation", "prec"]
        },
        "tmean": {
            "name": "Temperatura Media",
            "description": "Temperatura media del aire",
            "unit": "°C",
            "category": "meteorological",
            "column_names": ["tmean", "t_mean", "temperature"]
        },
        "tmin": {
            "name": "Temperatura Mínima",
            "description": "Temperatura mínima del aire",
            "unit": "°C",
            "category": "meteorological",
            "column_names": ["tmin", "t_min", "temp_min"]
        },
        "tmax": {
            "name": "Temperatura Máxima",
            "description": "Temperatura máxima del aire",
            "unit": "°C",
            "category": "meteorological",
            "column_names": ["tmax", "t_max", "temp_max"]
        },
        "pet": {
            "name": "Evapotranspiración Potencial",
            "description": "Evapotranspiración potencial",
            "unit": "mm",
            "category": "meteorological",
            "column_names": ["pet", "etp", "evapotranspiration"]
        },
        "balance": {
            "name": "Balance Hídrico",
            "description": "Balance entre precipitación y evapotranspiración",
            "unit": "mm",
            "category": "hydrological",
            "column_names": ["balance", "water_balance", "wb"]
        }
    }
    
    # Catálogo de índices de sequía (columnas reales del parquet)
    DROUGHT_INDICES = {
        # Índices meteorológicos
        "SPI": {
            "name": "SPI",
            "description": "Standardized Precipitation Index",
            "category": "meteorological",
            "unit": "adimensional",
            "supports_prediction": True,
            "column_names": ["SPI", "spi"]
        },
        "SPEI": {
            "name": "SPEI",
            "description": "Standardized Precipitation Evapotranspiration Index",
            "category": "meteorological",
            "unit": "adimensional",
            "supports_prediction": True,
            "column_names": ["SPEI", "spei"]
        },
        "RAI": {
            "name": "RAI",
            "description": "Rainfall Anomaly Index",
            "category": "meteorological",
            "unit": "adimensional",
            "supports_prediction": False,
            "column_names": ["RAI", "rai"]
        },
        "EDDI": {
            "name": "EDDI",
            "description": "Evaporative Demand Drought Index",
            "category": "meteorological",
            "unit": "adimensional",
            "supports_prediction": True,
            "column_names": ["EDDI", "eddi"]
        },
        # Índice hidrológico
        "PDSI": {
            "name": "PDSI",
            "description": "Palmer Drought Severity Index",
            "category": "hydrological",
            "unit": "adimensional",
            "supports_prediction": False,
            "column_names": ["PDSI", "pdsi"]
        }
    }
    
    # Categorización estándar de sequía
    DROUGHT_CATEGORIES = {
        "extreme_wet": {"min": 2.0, "max": float('inf'), "label": "Extremadamente Húmedo", "color": "#000080"},
        "very_wet": {"min": 1.5, "max": 2.0, "label": "Muy Húmedo", "color": "#0000FF"},
        "moderately_wet": {"min": 1.0, "max": 1.5, "label": "Moderadamente Húmedo", "color": "#00FFFF"},
        "normal": {"min": -1.0, "max": 1.0, "label": "Normal", "color": "#00FF00"},
        "moderately_dry": {"min": -1.5, "max": -1.0, "label": "Moderadamente Seco", "color": "#FFFF00"},
        "severely_dry": {"min": -2.0, "max": -1.5, "label": "Severamente Seco", "color": "#FFA500"},
        "extremely_dry": {"min": float('-inf'), "max": -2.0, "label": "Extremadamente Seco", "color": "#FF0000"}
    }
    
    def __init__(self):
        """Inicializa el servicio de análisis de sequía."""
        pass
    
    def get_available_variables(self) -> List[Dict[str, Any]]:
        """
        Obtiene lista de variables hidrometeorológicas disponibles.
        
        Returns:
            Lista de diccionarios con información de variables
        """
        variables = []
        for var_id, var_info in self.HYDROMETEOROLOGICAL_VARIABLES.items():
            variables.append({
                "id": var_id,
                "name": var_info["name"],
                "description": var_info["description"],
                "unit": var_info["unit"],
                "category": var_info["category"],
                "available": True
            })
        return variables
    
    def get_available_indices(self) -> List[Dict[str, Any]]:
        """
        Obtiene lista de índices de sequía disponibles.
        
        Returns:
            Lista de diccionarios con información de índices
        """
        indices = []
        for idx_id, idx_info in self.DROUGHT_INDICES.items():
            indices.append({
                "id": idx_id,
                "name": idx_info["name"],
                "description": idx_info["description"],
                "category": idx_info["category"],
                "unit": idx_info.get("unit"),
                "available": True,
                "supports_prediction": idx_info["supports_prediction"]
            })
        return indices
    
    def find_column_in_dataframe(self, df: pd.DataFrame, variable_id: str) -> Optional[str]:
        """
        Encuentra la columna correspondiente a una variable en el DataFrame.
        
        Args:
            df: DataFrame de pandas
            variable_id: ID de la variable o índice a buscar
            
        Returns:
            Nombre de la columna encontrada o None
        """
        # Buscar en variables
        if variable_id in self.HYDROMETEOROLOGICAL_VARIABLES:
            possible_names = self.HYDROMETEOROLOGICAL_VARIABLES[variable_id]["column_names"]
        # Buscar en índices
        elif variable_id in self.DROUGHT_INDICES:
            possible_names = self.DROUGHT_INDICES[variable_id]["column_names"]
        else:
            return None
        
        # Buscar en columnas del DataFrame (case-insensitive)
        df_columns_lower = {col.lower(): col for col in df.columns}
        
        for name in possible_names:
            if name.lower() in df_columns_lower:
                return df_columns_lower[name.lower()]
        
        return None
    
    def categorize_drought_value(self, value: float) -> str:
        """
        Categoriza un valor de índice de sequía.
        
        Args:
            value: Valor del índice
            
        Returns:
            Categoría de sequía
        """
        for category, thresholds in self.DROUGHT_CATEGORIES.items():
            if thresholds["min"] <= value < thresholds["max"]:
                return category
        return "normal"
    
    def get_timeseries_from_parquet(
        self,
        parquet_data: bytes,
        variable_id: str,
        start_date: date,
        end_date: date,
        location_filter: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float]]:
        """
        Extrae serie de tiempo de un archivo parquet.
        
        Args:
            parquet_data: Datos del archivo parquet en bytes
            variable_id: ID de variable o índice
            start_date: Fecha inicial
            end_date: Fecha final
            location_filter: Filtro de ubicación (station_id, cell_id, lat/lon)
            
        Returns:
            Tupla (datos, estadísticas)
        """
        # Leer parquet
        df = pd.read_parquet(BytesIO(parquet_data))
        
        # Encontrar columna de la variable
        value_column = self.find_column_in_dataframe(df, variable_id)
        if not value_column:
            raise ValueError(f"Variable/índice '{variable_id}' no encontrada en los datos")
        
        # Asegurar columna de fecha
        date_columns = ['date', 'time', 'fecha', 'datetime']
        date_col = None
        for col in date_columns:
            if col in df.columns:
                date_col = col
                break
        
        if not date_col:
            raise ValueError("No se encontró columna de fecha en los datos")
        
        # Convertir a datetime
        df[date_col] = pd.to_datetime(df[date_col])
        
        # Filtrar por rango de fechas
        mask = (df[date_col] >= pd.Timestamp(start_date)) & (df[date_col] <= pd.Timestamp(end_date))
        df_filtered = df[mask].copy()
        
        # Aplicar filtro de ubicación si existe
        if location_filter:
            if 'station_id' in location_filter and 'station_id' in df_filtered.columns:
                df_filtered = df_filtered[df_filtered['station_id'] == location_filter['station_id']]
            elif 'cell_id' in location_filter and 'cell_id' in df_filtered.columns:
                df_filtered = df_filtered[df_filtered['cell_id'] == location_filter['cell_id']]
            elif 'lat' in location_filter and 'lon' in location_filter:
                # Buscar punto más cercano
                if 'lat' in df_filtered.columns and 'lon' in df_filtered.columns:
                    distances = np.sqrt(
                        (df_filtered['lat'] - location_filter['lat'])**2 +
                        (df_filtered['lon'] - location_filter['lon'])**2
                    )
                    df_filtered = df_filtered[distances == distances.min()]
        
        # Ordenar por fecha
        df_filtered = df_filtered.sort_values(date_col)
        
        # Preparar datos de salida
        data_points = []
        for _, row in df_filtered.iterrows():
            value = float(row[value_column])
            category = None
            
            # Categorizar si es un índice de sequía
            if variable_id in self.DROUGHT_INDICES:
                category = self.categorize_drought_value(value)
            
            data_points.append({
                "date": row[date_col].date(),
                "value": value,
                "category": category,
                "quality": "good"
            })
        
        # Calcular estadísticas
        values = df_filtered[value_column].dropna()
        statistics = {
            "mean": float(values.mean()) if len(values) > 0 else 0.0,
            "min": float(values.min()) if len(values) > 0 else 0.0,
            "max": float(values.max()) if len(values) > 0 else 0.0,
            "std": float(values.std()) if len(values) > 0 else 0.0,
            "count": len(values)
        }
        
        return data_points, statistics
    
    def get_spatial_data_from_parquet(
        self,
        parquet_data: bytes,
        variable_id: str,
        target_date: date
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float]]:
        """
        Extrae datos espaciales (2D) de un archivo parquet para una fecha específica.
        
        Args:
            parquet_data: Datos del archivo parquet en bytes
            variable_id: ID de variable o índice
            target_date: Fecha objetivo
            
        Returns:
            Tupla (celdas con datos, estadísticas)
        """
        # Leer parquet
        df = pd.read_parquet(BytesIO(parquet_data))
        
        # Encontrar columna de la variable
        value_column = self.find_column_in_dataframe(df, variable_id)
        if not value_column:
            raise ValueError(f"Variable/índice '{variable_id}' no encontrada en los datos")
        
        # Encontrar columna de fecha
        date_columns = ['date', 'time', 'fecha', 'datetime']
        date_col = None
        for col in date_columns:
            if col in df.columns:
                date_col = col
                break
        
        if not date_col:
            raise ValueError("No se encontró columna de fecha en los datos")
        
        # Convertir a datetime
        df[date_col] = pd.to_datetime(df[date_col])
        
        # Filtrar por fecha objetivo
        df_date = df[df[date_col].dt.date == target_date].copy()
        
        # Verificar columnas espaciales
        required_cols = ['lat', 'lon']
        if not all(col in df_date.columns for col in required_cols):
            # Intentar con latitude/longitude
            if 'latitude' in df_date.columns:
                df_date['lat'] = df_date['latitude']
            if 'longitude' in df_date.columns:
                df_date['lon'] = df_date['longitude']
        
        # Preparar datos de celdas
        grid_cells = []
        for idx, row in df_date.iterrows():
            value = float(row[value_column])
            category = None
            
            # Categorizar si es un índice de sequía
            if variable_id in self.DROUGHT_INDICES:
                category = self.categorize_drought_value(value)
            
            cell_id = row.get('cell_id', f"cell_{idx}")
            
            grid_cells.append({
                "cell_id": str(cell_id),
                "lat": float(row['lat']),
                "lon": float(row['lon']),
                "value": value,
                "category": category
            })
        
        # Calcular estadísticas
        values = df_date[value_column].dropna()
        statistics = {
            "mean": float(values.mean()) if len(values) > 0 else 0.0,
            "min": float(values.min()) if len(values) > 0 else 0.0,
            "max": float(values.max()) if len(values) > 0 else 0.0,
            "std": float(values.std()) if len(values) > 0 else 0.0,
            "count": len(values)
        }
        
        return grid_cells, statistics
    
    def get_color_scale(self, variable_id: str) -> Dict[str, Any]:
        """
        Obtiene la escala de colores apropiada para una variable/índice.
        
        Args:
            variable_id: ID de variable o índice
            
        Returns:
            Configuración de escala de colores
        """
        if variable_id in self.DROUGHT_INDICES:
            # Escala de colores para índices de sequía
            return {
                "type": "categorical",
                "categories": self.DROUGHT_CATEGORIES
            }
        else:
            # Escala continua para variables
            return {
                "type": "continuous",
                "colormap": "viridis",
                "min_color": "#440154",
                "max_color": "#FDE724"
            }
