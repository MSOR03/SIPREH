"""
Parquet file processor service.
Handles reading, processing, and transforming parquet data.
"""
import pandas as pd
import pyarrow.parquet as pq
from typing import Dict, List, Any, Optional
from io import BytesIO
from datetime import datetime
import json


class ParquetProcessor:
    """Service for processing parquet files."""
    
    @staticmethod
    def read_parquet(file_data: bytes) -> Optional[pd.DataFrame]:
        """
        Read parquet file from bytes.
        
        Args:
            file_data: Parquet file content as bytes
            
        Returns:
            DataFrame or None if error
        """
        try:
            return pd.read_parquet(BytesIO(file_data))
        except Exception as e:
            print(f"Error reading parquet file: {e}")
            return None
    
    @staticmethod
    def get_parquet_metadata(file_data: bytes) -> Optional[Dict[str, Any]]:
        """
        Extract metadata from parquet file.
        
        Args:
            file_data: Parquet file content as bytes
            
        Returns:
            Dictionary with metadata or None if error
        """
        try:
            parquet_file = pq.ParquetFile(BytesIO(file_data))
            metadata = parquet_file.metadata
            
            return {
                'num_rows': metadata.num_rows,
                'num_columns': metadata.num_columns,
                'num_row_groups': metadata.num_row_groups,
                'format_version': metadata.format_version,
                'created_by': metadata.created_by,
                'schema': str(parquet_file.schema),
                'columns': [field.name for field in parquet_file.schema],
            }
        except Exception as e:
            print(f"Error extracting metadata: {e}")
            return None
    
    @staticmethod
    def validate_parquet_structure(
        df: pd.DataFrame, 
        required_columns: List[str]
    ) -> tuple[bool, str]:
        """
        Validate that parquet has required columns.
        
        Args:
            df: DataFrame to validate
            required_columns: List of required column names
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        missing_columns = set(required_columns) - set(df.columns)
        
        if missing_columns:
            return False, f"Missing required columns: {', '.join(missing_columns)}"
        
        return True, "Valid"
    
    @staticmethod
    def process_drought_data(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Process drought data from parquet file.
        This is a sample implementation - adjust based on your data structure.
        
        Args:
            df: DataFrame with drought data
            
        Returns:
            Processed data dictionary
        """
        try:
            # Example processing - adjust to your needs
            processed_data = {
                'total_records': len(df),
                'date_range': {
                    'start': str(df['date'].min()) if 'date' in df.columns else None,
                    'end': str(df['date'].max()) if 'date' in df.columns else None,
                },
                'summary_stats': {},
            }
            
            # Calculate summary statistics for numeric columns
            numeric_cols = df.select_dtypes(include=['number']).columns
            for col in numeric_cols:
                processed_data['summary_stats'][col] = {
                    'mean': float(df[col].mean()),
                    'min': float(df[col].min()),
                    'max': float(df[col].max()),
                    'std': float(df[col].std()),
                }
            
            return processed_data
            
        except Exception as e:
            print(f"Error processing drought data: {e}")
            return {'error': str(e)}
    
    @staticmethod
    def extract_dashboard_data(
        df: pd.DataFrame,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Extract and format data for dashboard consumption.
        
        Args:
            df: DataFrame with drought data
            filters: Optional filters to apply
            
        Returns:
            List of formatted data dictionaries
        """
        try:
            # Apply filters if provided
            if filters:
                if 'start_date' in filters and 'date' in df.columns:
                    df = df[df['date'] >= filters['start_date']]
                if 'end_date' in filters and 'date' in df.columns:
                    df = df[df['date'] <= filters['end_date']]
                if 'region_ids' in filters and 'region_id' in df.columns:
                    df = df[df['region_id'].isin(filters['region_ids'])]
            
            # Convert to list of dictionaries
            # Handle datetime serialization
            data = df.to_dict(orient='records')
            
            # Convert any datetime objects to strings
            for record in data:
                for key, value in record.items():
                    if isinstance(value, (datetime, pd.Timestamp)):
                        record[key] = value.isoformat()
            
            return data
            
        except Exception as e:
            print(f"Error extracting dashboard data: {e}")
            return []
    
    @staticmethod
    def get_time_series(
        df: pd.DataFrame,
        date_column: str = 'date',
        value_column: str = 'value',
        region_column: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Extract time series data from parquet.
        
        Args:
            df: DataFrame with time series data
            date_column: Name of date column
            value_column: Name of value column
            region_column: Optional region grouping column
            
        Returns:
            Dictionary of time series data
        """
        try:
            if region_column and region_column in df.columns:
                # Group by region
                result = {}
                for region in df[region_column].unique():
                    region_df = df[df[region_column] == region]
                    region_df = region_df.sort_values(date_column)
                    
                    result[str(region)] = [
                        {
                            'date': row[date_column].isoformat() if isinstance(row[date_column], (datetime, pd.Timestamp)) else str(row[date_column]),
                            'value': float(row[value_column]) if pd.notna(row[value_column]) else None
                        }
                        for _, row in region_df.iterrows()
                    ]
                return result
            else:
                # Single time series
                df_sorted = df.sort_values(date_column)
                return {
                    'default': [
                        {
                            'date': row[date_column].isoformat() if isinstance(row[date_column], (datetime, pd.Timestamp)) else str(row[date_column]),
                            'value': float(row[value_column]) if pd.notna(row[value_column]) else None
                        }
                        for _, row in df_sorted.iterrows()
                    ]
                }
        except Exception as e:
            print(f"Error extracting time series: {e}")
            return {}


# Singleton instance
parquet_processor = ParquetProcessor()
