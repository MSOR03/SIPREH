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
        "PDSI": {
            "name": "PDSI",
            "description": "Palmer Drought Severity Index",
            "category": "hydrological",
            "unit": "adimensional",
            "supports_prediction": False,
            "column_names": ["PDSI", "pdsi"]
        }
    }

    # Escalas de severidad por índice
    INDEX_DROUGHT_SCALES = {
        # SPI, SPEI, RAI — escala estándar ±1/1.5/2
        "DEFAULT": [
            {"min": float('-inf'), "max": -2.0, "label": "Extremadamente Seco",  "color": "#FF0000"},
            {"min": -2.0,          "max": -1.5, "label": "Severamente Seco",     "color": "#FFA500"},
            {"min": -1.5,          "max": -1.0, "label": "Moderadamente Seco",   "color": "#FFFF00"},
            {"min": -1.0,          "max":  1.0, "label": "Normal",               "color": "#00FF00"},
            {"min":  1.0,          "max":  1.5, "label": "Moderadamente Húmedo", "color": "#00FFFF"},
            {"min":  1.5,          "max":  2.0, "label": "Muy Húmedo",           "color": "#0000FF"},
            {"min":  2.0,          "max": float('inf'), "label": "Extremadamente Húmedo", "color": "#000080"},
        ],
        # PDSI — escala Palmer estándar ±2/3/4
        "PDSI": [
            {"min": float('-inf'), "max": -4.0, "label": "Extremadamente Seco",  "color": "#FF0000"},
            {"min": -4.0,          "max": -3.0, "label": "Severamente Seco",     "color": "#FFA500"},
            {"min": -3.0,          "max": -2.0, "label": "Moderadamente Seco",   "color": "#FFFF00"},
            {"min": -2.0,          "max":  2.0, "label": "Normal",               "color": "#00FF00"},
            {"min":  2.0,          "max":  3.0, "label": "Moderadamente Húmedo", "color": "#00FFFF"},
            {"min":  3.0,          "max":  4.0, "label": "Muy Húmedo",           "color": "#0000FF"},
            {"min":  4.0,          "max": float('inf'), "label": "Extremadamente Húmedo", "color": "#000080"},
        ],
        # EDDI — polaridad invertida: positivo = seco, negativo = húmedo
        "EDDI": [
            {"min":  2.0,          "max": float('inf'), "label": "Extremadamente Seco",  "color": "#FF0000"},
            {"min":  1.5,          "max":  2.0, "label": "Severamente Seco",     "color": "#FFA500"},
            {"min":  1.0,          "max":  1.5, "label": "Moderadamente Seco",   "color": "#FFFF00"},
            {"min": -1.0,          "max":  1.0, "label": "Normal",               "color": "#00FF00"},
            {"min": -1.5,          "max": -1.0, "label": "Moderadamente Húmedo", "color": "#00FFFF"},
            {"min": -2.0,          "max": -1.5, "label": "Muy Húmedo",           "color": "#0000FF"},
            {"min": float('-inf'), "max": -2.0, "label": "Extremadamente Húmedo", "color": "#000080"},
        ],
    }

    def __init__(self):
        """Inicializa el servicio de análisis de sequía."""
        pass

    def _get_scale_for_index(self, variable_id: str) -> List[Dict[str, Any]]:
        """Retorna la escala de severidad correspondiente al índice dado."""
        if variable_id in self.INDEX_DROUGHT_SCALES:
            return self.INDEX_DROUGHT_SCALES[variable_id]
        return self.INDEX_DROUGHT_SCALES["DEFAULT"]

    def get_available_variables(self) -> List[Dict[str, Any]]:
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
        if variable_id in self.HYDROMETEOROLOGICAL_VARIABLES:
            possible_names = self.HYDROMETEOROLOGICAL_VARIABLES[variable_id]["column_names"]
        elif variable_id in self.DROUGHT_INDICES:
            possible_names = self.DROUGHT_INDICES[variable_id]["column_names"]
        else:
            return None
        
        df_columns_lower = {col.lower(): col for col in df.columns}
        for name in possible_names:
            if name.lower() in df_columns_lower:
                return df_columns_lower[name.lower()]
        return None
    
    def categorize_drought_value(self, value: float, variable_id: str = "SPI") -> str:
        """
        Categoriza un valor de índice de sequía usando la escala correcta para el índice.

        Args:
            value: Valor del índice
            variable_id: ID del índice (PDSI y EDDI tienen escalas propias)

        Returns:
            Etiqueta de la categoría
        """
        scale = self._get_scale_for_index(variable_id)
        for cat in scale:
            if cat["min"] <= value < cat["max"]:
                return cat["label"]
        return "Normal"
    
    def get_timeseries_from_parquet(
        self,
        parquet_data: bytes,
        variable_id: str,
        start_date: date,
        end_date: date,
        location_filter: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[Dict[str, Any]], Dict[str, float]]:
        df = pd.read_parquet(BytesIO(parquet_data))
        
        value_column = self.find_column_in_dataframe(df, variable_id)
        if not value_column:
            raise ValueError(f"Variable/índice '{variable_id}' no encontrada en los datos")
        
        date_columns = ['date', 'time', 'fecha', 'datetime']
        date_col = None
        for col in date_columns:
            if col in df.columns:
                date_col = col
                break
        
        if not date_col:
            raise ValueError("No se encontró columna de fecha en los datos")
        
        df[date_col] = pd.to_datetime(df[date_col])
        
        mask = (df[date_col] >= pd.Timestamp(start_date)) & (df[date_col] <= pd.Timestamp(end_date))
        df_filtered = df[mask].copy()
        
        if location_filter:
            if 'station_id' in location_filter and 'station_id' in df_filtered.columns:
                df_filtered = df_filtered[df_filtered['station_id'] == location_filter['station_id']]
            elif 'cell_id' in location_filter and 'cell_id' in df_filtered.columns:
                df_filtered = df_filtered[df_filtered['cell_id'] == location_filter['cell_id']]
            elif 'lat' in location_filter and 'lon' in location_filter:
                if 'lat' in df_filtered.columns and 'lon' in df_filtered.columns:
                    distances = np.sqrt(
                        (df_filtered['lat'] - location_filter['lat'])**2 +
                        (df_filtered['lon'] - location_filter['lon'])**2
                    )
                    df_filtered = df_filtered[distances == distances.min()]
        
        df_filtered = df_filtered.sort_values(date_col)
        
        data_points = []
        for _, row in df_filtered.iterrows():
            value = float(row[value_column])
            category = None
            if variable_id in self.DROUGHT_INDICES:
                category = self.categorize_drought_value(value, variable_id)  # <-- pasa variable_id
            
            data_points.append({
                "date": row[date_col].date(),
                "value": value,
                "category": category,
                "quality": "good"
            })
        
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
        df = pd.read_parquet(BytesIO(parquet_data))
        
        value_column = self.find_column_in_dataframe(df, variable_id)
        if not value_column:
            raise ValueError(f"Variable/índice '{variable_id}' no encontrada en los datos")
        
        date_columns = ['date', 'time', 'fecha', 'datetime']
        date_col = None
        for col in date_columns:
            if col in df.columns:
                date_col = col
                break
        
        if not date_col:
            raise ValueError("No se encontró columna de fecha en los datos")
        
        df[date_col] = pd.to_datetime(df[date_col])
        df_date = df[df[date_col].dt.date == target_date].copy()
        
        required_cols = ['lat', 'lon']
        if not all(col in df_date.columns for col in required_cols):
            if 'latitude' in df_date.columns:
                df_date['lat'] = df_date['latitude']
            if 'longitude' in df_date.columns:
                df_date['lon'] = df_date['longitude']
        
        grid_cells = []
        for idx, row in df_date.iterrows():
            value = float(row[value_column])
            category = None
            if variable_id in self.DROUGHT_INDICES:
                category = self.categorize_drought_value(value, variable_id)  # <-- pasa variable_id
            
            cell_id = row.get('cell_id', f"cell_{idx}")
            grid_cells.append({
                "cell_id": str(cell_id),
                "lat": float(row['lat']),
                "lon": float(row['lon']),
                "value": value,
                "category": category
            })
        
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
        if variable_id in self.DROUGHT_INDICES:
            return {
                "type": "categorical",
                "categories": self._get_scale_for_index(variable_id)
            }
        else:
            return {
                "type": "continuous",
                "colormap": "viridis",
                "min_color": "#440154",
                "max_color": "#FDE724"
            }
