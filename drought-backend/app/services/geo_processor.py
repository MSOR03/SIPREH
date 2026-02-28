"""
Geospatial data processor for Leaflet map visualization.
Handles large datasets efficiently for web mapping.
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import json
from shapely.geometry import Point, Polygon, shape, mapping
from shapely.ops import unary_union
import geopandas as gpd


class GeoProcessor:
    """
    Process geospatial data for efficient Leaflet visualization.
    """
    
    @staticmethod
    def create_geojson_features(
        df: pd.DataFrame,
        lat_col: str = 'latitude',
        lon_col: str = 'longitude',
        properties: Optional[List[str]] = None,
        simplify_tolerance: float = 0.001
    ) -> Dict[str, Any]:
        """
        Convert DataFrame to GeoJSON FeatureCollection.
        
        Args:
            df: DataFrame with geospatial data
            lat_col: Latitude column name
            lon_col: Longitude column name
            properties: Columns to include as properties
            simplify_tolerance: Tolerance for geometry simplification
            
        Returns:
            GeoJSON FeatureCollection dictionary
        """
        features = []
        
        if properties is None:
            properties = [col for col in df.columns if col not in [lat_col, lon_col]]
        
        for idx, row in df.iterrows():
            # Skip if coordinates are invalid
            if pd.isna(row[lat_col]) or pd.isna(row[lon_col]):
                continue
            
            feature_properties = {}
            for prop in properties:
                value = row[prop]
                # Convert to JSON-serializable types
                if pd.isna(value):
                    feature_properties[prop] = None
                elif isinstance(value, (pd.Timestamp, np.datetime64)):
                    feature_properties[prop] = str(value)
                elif isinstance(value, (np.integer, np.floating)):
                    feature_properties[prop] = float(value)
                else:
                    feature_properties[prop] = value
            
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row[lon_col]), float(row[lat_col])]
                },
                "properties": feature_properties
            }
            features.append(feature)
        
        return {
            "type": "FeatureCollection",
            "features": features
        }
    
    @staticmethod
    def create_clustered_points(
        df: pd.DataFrame,
        lat_col: str = 'latitude',
        lon_col: str = 'longitude',
        value_col: Optional[str] = None,
        grid_size: float = 0.1
    ) -> List[Dict[str, Any]]:
        """
        Create clustered/aggregated points for better performance.
        
        Args:
            df: DataFrame with points
            lat_col: Latitude column
            lon_col: Longitude column
            value_col: Value to aggregate
            grid_size: Grid cell size in degrees
            
        Returns:
            List of clustered points with aggregated values
        """
        # Create grid cells
        df = df.copy()
        df['grid_lat'] = (df[lat_col] / grid_size).round() * grid_size
        df['grid_lon'] = (df[lon_col] / grid_size).round() * grid_size
        
        # Group by grid cells
        if value_col:
            grouped = df.groupby(['grid_lat', 'grid_lon']).agg({
                value_col: ['mean', 'min', 'max', 'count']
            }).reset_index()
            
            clusters = []
            for _, row in grouped.iterrows():
                clusters.append({
                    'lat': float(row['grid_lat']),
                    'lon': float(row['grid_lon']),
                    'count': int(row[value_col]['count']),
                    'mean': float(row[value_col]['mean']),
                    'min': float(row[value_col]['min']),
                    'max': float(row[value_col]['max'])
                })
        else:
            grouped = df.groupby(['grid_lat', 'grid_lon']).size().reset_index(name='count')
            clusters = [
                {
                    'lat': float(row['grid_lat']),
                    'lon': float(row['grid_lon']),
                    'count': int(row['count'])
                }
                for _, row in grouped.iterrows()
            ]
        
        return clusters
    
    @staticmethod
    def create_heatmap_data(
        df: pd.DataFrame,
        lat_col: str = 'latitude',
        lon_col: str = 'longitude',
        intensity_col: Optional[str] = None,
        max_points: int = 10000
    ) -> List[List[float]]:
        """
        Create heatmap data for Leaflet.HeatLayer.
        
        Args:
            df: DataFrame with points
            lat_col: Latitude column
            lon_col: Longitude column
            intensity_col: Column for intensity values
            max_points: Maximum points to return (sampling if exceeded)
            
        Returns:
            List of [lat, lon, intensity] arrays
        """
        # Sample if too many points
        if len(df) > max_points:
            df = df.sample(n=max_points)
        
        if intensity_col and intensity_col in df.columns:
            # Normalize intensity to 0-1
            min_val = df[intensity_col].min()
            max_val = df[intensity_col].max()
            if max_val > min_val:
                df['normalized_intensity'] = (df[intensity_col] - min_val) / (max_val - min_val)
            else:
                df['normalized_intensity'] = 0.5
            
            return [
                [float(row[lat_col]), float(row[lon_col]), float(row['normalized_intensity'])]
                for _, row in df.iterrows()
                if pd.notna(row[lat_col]) and pd.notna(row[lon_col])
            ]
        else:
            return [
                [float(row[lat_col]), float(row[lon_col])]
                for _, row in df.iterrows()
                if pd.notna(row[lat_col]) and pd.notna(row[lon_col])
            ]
    
    @staticmethod
    def create_choropleth_data(
        df: pd.DataFrame,
        region_col: str,
        value_col: str,
        geometries: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create choropleth data for region-based visualization.
        
        Args:
            df: DataFrame with region data
            region_col: Column with region identifiers
            value_col: Column with values to visualize
            geometries: Optional GeoJSON geometries for regions
            
        Returns:
            Dictionary with region values and optional geometries
        """
        # Aggregate by region
        region_data = df.groupby(region_col)[value_col].agg([
            'mean', 'min', 'max', 'count'
        ]).reset_index()
        
        result = {
            'regions': {}
        }
        
        for _, row in region_data.iterrows():
            region_id = row[region_col]
            result['regions'][str(region_id)] = {
                'mean': float(row['mean']),
                'min': float(row['min']),
                'max': float(row['max']),
                'count': int(row['count'])
            }
        
        if geometries:
            result['geometries'] = geometries
        
        return result
    
    @staticmethod
    def get_bbox(
        df: pd.DataFrame,
        lat_col: str = 'latitude',
        lon_col: str = 'longitude',
        padding: float = 0.1
    ) -> Dict[str, float]:
        """
        Get bounding box for data.
        
        Args:
            df: DataFrame with coordinates
            lat_col: Latitude column
            lon_col: Longitude column
            padding: Padding factor (0.1 = 10% padding)
            
        Returns:
            Dictionary with bounds
        """
        min_lat = df[lat_col].min()
        max_lat = df[lat_col].max()
        min_lon = df[lon_col].min()
        max_lon = df[lon_col].max()
        
        # Add padding
        lat_range = max_lat - min_lat
        lon_range = max_lon - min_lon
        
        return {
            'south': float(min_lat - lat_range * padding),
            'north': float(max_lat + lat_range * padding),
            'west': float(min_lon - lon_range * padding),
            'east': float(max_lon + lon_range * padding),
            'center': {
                'lat': float((min_lat + max_lat) / 2),
                'lng': float((min_lon + max_lon) / 2)
            }
        }
    
    @staticmethod
    def tile_data_by_zoom(
        df: pd.DataFrame,
        zoom_level: int,
        lat_col: str = 'latitude',
        lon_col: str = 'longitude',
        tile_x: Optional[int] = None,
        tile_y: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Filter data by map tile for zoom level.
        
        Args:
            df: Full DataFrame
            zoom_level: Zoom level (0-22)
            lat_col: Latitude column
            lon_col: Longitude column
            tile_x: Tile X coordinate
            tile_y: Tile Y coordinate
            
        Returns:
            Filtered DataFrame for tile
        """
        if tile_x is None or tile_y is None:
            return df
        
        # Calculate tile bounds
        n = 2.0 ** zoom_level
        lon_min = tile_x / n * 360.0 - 180.0
        lon_max = (tile_x + 1) / n * 360.0 - 180.0
        
        lat_min_rad = np.arctan(np.sinh(np.pi * (1 - 2 * (tile_y + 1) / n)))
        lat_max_rad = np.arctan(np.sinh(np.pi * (1 - 2 * tile_y / n)))
        lat_min = np.degrees(lat_min_rad)
        lat_max = np.degrees(lat_max_rad)
        
        # Filter data
        mask = (
            (df[lat_col] >= lat_min) & 
            (df[lat_col] <= lat_max) &
            (df[lon_col] >= lon_min) & 
            (df[lon_col] <= lon_max)
        )
        
        return df[mask]


# Singleton instance
geo_processor = GeoProcessor()
