"""
Servicio para exportación de datos y gráficas (CSV, PNG, JPEG).
"""
import os
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from pathlib import Path
import io
import csv


class ExportService:
    """Servicio para exportar datos y gráficas."""
    
    def __init__(self, export_dir: str = "./exports"):
        """
        Inicializa el servicio de exportación.
        
        Args:
            export_dir: Directorio para archivos exportados
        """
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)
    
    def export_timeseries_csv(
        self,
        data: List[Dict[str, Any]],
        variable_name: str,
        location_info: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple[str, int]:
        """
        Exporta serie de tiempo a formato CSV.
        
        Args:
            data: Lista de puntos de datos
            variable_name: Nombre de la variable
            location_info: Información de ubicación
            metadata: Metadatos adicionales
            
        Returns:
            Tupla (ruta_archivo, tamaño_bytes)
        """
        # Generar nombre de archivo único
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"timeseries_{variable_name}_{timestamp}.csv"
        filepath = self.export_dir / filename
        
        # Preparar datos para CSV
        rows = []
        
        # Encabezado con metadatos
        if metadata:
            rows.append(["# DROUGHT MONITOR - SERIE DE TIEMPO"])
            rows.append([f"# Variable: {variable_name}"])
            rows.append([f"# Ubicación: {location_info.get('location_id', 'N/A')}"])
            rows.append([f"# Coordenadas: Lat {location_info.get('lat', 'N/A')}, Lon {location_info.get('lon', 'N/A')}"])
            rows.append([f"# Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
            rows.append([])
        
        # Encabezado de columnas
        if data and len(data) > 0:
            if 'category' in data[0]:
                rows.append(["Fecha", "Valor", "Categoría", "Calidad"])
            else:
                rows.append(["Fecha", "Valor", "Calidad"])
        
        # Datos
        for point in data:
            if 'category' in point and point['category']:
                rows.append([
                    str(point['date']),
                    point['value'],
                    point.get('category', ''),
                    point.get('quality', 'good')
                ])
            else:
                rows.append([
                    str(point['date']),
                    point['value'],
                    point.get('quality', 'good')
                ])
        
        # Escribir CSV
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        # Obtener tamaño
        file_size = filepath.stat().st_size
        
        return str(filepath), file_size
    
    def export_spatial_csv(
        self,
        grid_cells: List[Dict[str, Any]],
        variable_name: str,
        target_date: date,
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple[str, int]:
        """
        Exporta datos espaciales (2D) a formato CSV.
        
        Args:
            grid_cells: Lista de celdas con datos
            variable_name: Nombre de la variable
            target_date: Fecha de los datos
            metadata: Metadatos adicionales
            
        Returns:
            Tupla (ruta_archivo, tamaño_bytes)
        """
        # Generar nombre de archivo único
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        date_str = target_date.strftime("%Y%m%d")
        filename = f"spatial_{variable_name}_{date_str}_{timestamp}.csv"
        filepath = self.export_dir / filename
        
        # Preparar datos para CSV
        rows = []
        
        # Encabezado con metadatos
        if metadata:
            rows.append(["# DROUGHT MONITOR - DATOS ESPACIALES"])
            rows.append([f"# Variable: {variable_name}"])
            rows.append([f"# Fecha: {target_date}"])
            rows.append([f"# Total de celdas: {len(grid_cells)}"])
            rows.append([f"# Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
            rows.append([])
        
        # Encabezado de columnas
        if grid_cells and len(grid_cells) > 0:
            if 'category' in grid_cells[0]:
                rows.append(["Celda_ID", "Latitud", "Longitud", "Valor", "Categoría"])
            else:
                rows.append(["Celda_ID", "Latitud", "Longitud", "Valor"])
        
        # Datos
        for cell in grid_cells:
            if 'category' in cell and cell['category']:
                rows.append([
                    cell['cell_id'],
                    cell['lat'],
                    cell['lon'],
                    cell['value'],
                    cell.get('category', '')
                ])
            else:
                rows.append([
                    cell['cell_id'],
                    cell['lat'],
                    cell['lon'],
                    cell['value']
                ])
        
        # Escribir CSV
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        # Obtener tamaño
        file_size = filepath.stat().st_size
        
        return str(filepath), file_size
    
    def export_multiple_spatial_csv(
        self,
        data_by_date: Dict[date, List[Dict[str, Any]]],
        variable_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple[str, int]:
        """
        Exporta múltiples arreglos 2D para un intervalo de tiempo.
        
        Args:
            data_by_date: Diccionario de datos por fecha
            variable_name: Nombre de la variable
            metadata: Metadatos adicionales
            
        Returns:
            Tupla (ruta_archivo, tamaño_bytes)
        """
        # Generar nombre de archivo único
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"spatial_series_{variable_name}_{timestamp}.csv"
        filepath = self.export_dir / filename
        
        # Preparar datos para CSV
        rows = []
        
        # Encabezado con metadatos
        dates_list = sorted(data_by_date.keys())
        if metadata:
            rows.append(["# DROUGHT MONITOR - SERIE DE DATOS ESPACIALES"])
            rows.append([f"# Variable: {variable_name}"])
            rows.append([f"# Periodo: {dates_list[0]} a {dates_list[-1]}"])
            rows.append([f"# Total de fechas: {len(dates_list)}"])
            rows.append([f"# Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
            rows.append([])
        
        # Encabezado de columnas
        sample_data = next(iter(data_by_date.values()))
        if sample_data and len(sample_data) > 0:
            if 'category' in sample_data[0]:
                rows.append(["Fecha", "Celda_ID", "Latitud", "Longitud", "Valor", "Categoría"])
            else:
                rows.append(["Fecha", "Celda_ID", "Latitud", "Longitud", "Valor"])
        
        # Datos agrupados por fecha
        for target_date in dates_list:
            grid_cells = data_by_date[target_date]
            for cell in grid_cells:
                if 'category' in cell and cell['category']:
                    rows.append([
                        str(target_date),
                        cell['cell_id'],
                        cell['lat'],
                        cell['lon'],
                        cell['value'],
                        cell.get('category', '')
                    ])
                else:
                    rows.append([
                        str(target_date),
                        cell['cell_id'],
                        cell['lat'],
                        cell['lon'],
                        cell['value']
                    ])
        
        # Escribir CSV
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows)
        
        # Obtener tamaño
        file_size = filepath.stat().st_size
        
        return str(filepath), file_size
    
    def cleanup_old_exports(self, max_age_hours: int = 24):
        """
        Limpia archivos exportados antiguos.
        
        Args:
            max_age_hours: Edad máxima en horas
        """
        now = datetime.now()
        for filepath in self.export_dir.iterdir():
            if filepath.is_file():
                file_age = now - datetime.fromtimestamp(filepath.stat().st_mtime)
                if file_age.total_seconds() > (max_age_hours * 3600):
                    filepath.unlink()
