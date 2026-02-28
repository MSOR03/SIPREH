"""
Data aggregation service for pre-processing large datasets.
Creates aggregated views for faster dashboard loading.
"""
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.parquet_file import ParquetFile
from app.services.cloud_storage import cloud_storage
from app.services.parquet_processor import parquet_processor
import json


class DataAggregator:
    """
    Aggregate and pre-process large datasets for performance.
    """
    
    @staticmethod
    def create_aggregations(
        df: pd.DataFrame,
        config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, pd.DataFrame]:
        """
        Create multiple aggregation levels from raw data.
        
        Args:
            df: Raw DataFrame
            config: Aggregation configuration
            
        Returns:
            Dictionary of aggregated DataFrames
        """
        aggregations = {}
        
        # Daily aggregation (if datetime column exists)
        if 'date' in df.columns or 'datetime' in df.columns:
            date_col = 'date' if 'date' in df.columns else 'datetime'
            df_copy = df.copy()
            df_copy[date_col] = pd.to_datetime(df_copy[date_col])
            df_copy['date_only'] = df_copy[date_col].dt.date
            
            # Group by date and region (if exists)
            group_cols = ['date_only']
            if 'region_id' in df.columns:
                group_cols.append('region_id')
            
            numeric_cols = df_copy.select_dtypes(include=[np.number]).columns
            agg_dict = {col: ['mean', 'min', 'max', 'std'] for col in numeric_cols}
            
            daily_agg = df_copy.groupby(group_cols).agg(agg_dict).reset_index()
            aggregations['daily'] = daily_agg
        
        # Regional aggregation
        if 'region_id' in df.columns:
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            agg_dict = {col: ['mean', 'min', 'max', 'count'] for col in numeric_cols}
            
            regional_agg = df.groupby('region_id').agg(agg_dict).reset_index()
            aggregations['regional'] = regional_agg
        
        # Spatial grid aggregation (for geospatial data)
        if 'latitude' in df.columns and 'longitude' in df.columns:
            df_copy = df.copy()
            grid_size = 0.1  # ~11km at equator
            df_copy['grid_lat'] = (df_copy['latitude'] / grid_size).round() * grid_size
            df_copy['grid_lon'] = (df_copy['longitude'] / grid_size).round() * grid_size
            
            numeric_cols = df_copy.select_dtypes(include=[np.number]).columns
            agg_dict = {
                col: ['mean', 'count'] 
                for col in numeric_cols 
                if col not in ['grid_lat', 'grid_lon', 'latitude', 'longitude']
            }
            
            grid_agg = df_copy.groupby(['grid_lat', 'grid_lon']).agg(agg_dict).reset_index()
            aggregations['grid'] = grid_agg
        
        return aggregations
    
    @staticmethod
    def create_summary_statistics(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Create summary statistics for dataset.
        
        Args:
            df: DataFrame
            
        Returns:
            Summary statistics dictionary
        """
        summary = {
            'total_records': len(df),
            'columns': list(df.columns),
            'numeric_stats': {},
            'categorical_stats': {},
            'temporal_range': {},
            'spatial_extent': {}
        }
        
        # Numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            summary['numeric_stats'][col] = {
                'mean': float(df[col].mean()),
                'median': float(df[col].median()),
                'min': float(df[col].min()),
                'max': float(df[col].max()),
                'std': float(df[col].std()),
                'null_count': int(df[col].isna().sum())
            }
        
        # Categorical columns
        categorical_cols = df.select_dtypes(include=['object']).columns
        for col in categorical_cols:
            unique_values = df[col].nunique()
            if unique_values < 50:  # Only for columns with reasonable cardinality
                summary['categorical_stats'][col] = {
                    'unique_count': int(unique_values),
                    'top_values': df[col].value_counts().head(10).to_dict(),
                    'null_count': int(df[col].isna().sum())
                }
        
        # Temporal extent
        date_cols = df.select_dtypes(include=['datetime64']).columns
        if len(date_cols) > 0:
            for col in date_cols:
                summary['temporal_range'][col] = {
                    'start': str(df[col].min()),
                    'end': str(df[col].max()),
                    'span_days': (df[col].max() - df[col].min()).days
                }
        
        # Spatial extent
        if 'latitude' in df.columns and 'longitude' in df.columns:
            summary['spatial_extent'] = {
                'lat_min': float(df['latitude'].min()),
                'lat_max': float(df['latitude'].max()),
                'lon_min': float(df['longitude'].min()),
                'lon_max': float(df['longitude'].max()),
                'center_lat': float(df['latitude'].mean()),
                'center_lon': float(df['longitude'].mean())
            }
        
        return summary
    
    @staticmethod
    def sample_data(
        df: pd.DataFrame,
        method: str = 'random',
        n: int = 10000,
        **kwargs
    ) -> pd.DataFrame:
        """
        Intelligently sample data for faster visualization.
        
        Args:
            df: Full DataFrame
            method: Sampling method ('random', 'stratified', 'spatial')
            n: Number of samples
            **kwargs: Additional parameters for sampling
            
        Returns:
            Sampled DataFrame
        """
        if len(df) <= n:
            return df
        
        if method == 'random':
            return df.sample(n=n)
        
        elif method == 'stratified':
            # Stratified sampling by region or category
            strata_col = kwargs.get('strata_col', 'region_id')
            if strata_col in df.columns:
                return df.groupby(strata_col, group_keys=False).apply(
                    lambda x: x.sample(min(len(x), max(1, n // df[strata_col].nunique())))
                )
            else:
                return df.sample(n=n)
        
        elif method == 'spatial':
            # Spatial sampling to maintain geographic distribution
            if 'latitude' in df.columns and 'longitude' in df.columns:
                grid_size = kwargs.get('grid_size', 0.1)
                df_copy = df.copy()
                df_copy['grid_lat'] = (df_copy['latitude'] / grid_size).round()
                df_copy['grid_lon'] = (df_copy['longitude'] / grid_size).round()
                
                # Sample from each grid cell
                samples_per_cell = max(1, n // df_copy.groupby(['grid_lat', 'grid_lon']).ngroups)
                return df_copy.groupby(['grid_lat', 'grid_lon'], group_keys=False).apply(
                    lambda x: x.sample(min(len(x), samples_per_cell))
                ).drop(['grid_lat', 'grid_lon'], axis=1)
            else:
                return df.sample(n=n)
        
        return df.sample(n=n)
    
    @staticmethod
    def create_time_series_aggregation(
        df: pd.DataFrame,
        date_col: str = 'date',
        value_col: str = 'value',
        frequency: str = 'D',  # D=daily, W=weekly, M=monthly
        agg_func: str = 'mean'
    ) -> pd.DataFrame:
        """
        Create time series aggregation.
        
        Args:
            df: DataFrame with time series data
            date_col: Date column name
            value_col: Value column name
            frequency: Pandas frequency string
            agg_func: Aggregation function
            
        Returns:
            Aggregated time series DataFrame
        """
        df_copy = df.copy()
        df_copy[date_col] = pd.to_datetime(df_copy[date_col])
        df_copy = df_copy.set_index(date_col)
        
        if agg_func == 'mean':
            result = df_copy[value_col].resample(frequency).mean()
        elif agg_func == 'sum':
            result = df_copy[value_col].resample(frequency).sum()
        elif agg_func == 'min':
            result = df_copy[value_col].resample(frequency).min()
        elif agg_func == 'max':
            result = df_copy[value_col].resample(frequency).max()
        else:
            result = df_copy[value_col].resample(frequency).mean()
        
        return result.reset_index()


# Singleton instance
data_aggregator = DataAggregator()
