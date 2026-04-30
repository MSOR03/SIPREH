'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MapArea from '@/components/MapArea';
import Footer from '@/components/Footer';
import GuidedTour from '@/components/GuidedTour';
import { useToast } from '@/contexts/ToastContext';
import { downloadAnalysisImage, downloadAnalysisJson } from '@/utils/exporters';

export default function Home() {
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  
  // Selection state
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null); // Cuenca o Embalse seleccionado
  
  // Historical Analysis State
  const [analysisState, setAnalysisState] = useState({
    dataCategory: 'hydromet',   // 'hydromet' | 'hydrological'
    visualizationType: '1D',    // '1D' = Serie Temporal, '2D' = Mapa Espacial
    spatialUnit: 'grid',        // 'grid' | 'cuencas' | 'embalses' | 'estaciones'
    dataSource: 'CHIRPS',        // 'ERA5' | 'IMERG' | 'CHIRPS' (hydromet only) — matches spatialResolution: 0.05
    spatialResolution: 0.05,    // Resolución para modo 2D (0.25, 0.1, 0.05)
    variable: '',
    droughtIndex: '',
    indexScale: 1,              // Escala temporal para índices (1, 3, 6, 12 meses)
    frequency: 'D',             // Frecuencia para variables: 'D' (diaria) o 'M' (mensual)
    startDate: '',
    endDate: '',
    useSpatialInterval: false,
  });

  // Prediction State
  const [predictionState, setPredictionState] = useState({
    visualizationType: '1D',  // '1D' | '2D'
    spatialUnit: 'grid',      // 'grid' | 'cuencas'
    droughtIndex: '',
    scale: 1,
    horizon: 1,
  });

  // AI Summary state
  const [aiSummary, setAiSummary] = useState({ open: false, loading: false, summary: null, index: '', type: '1d' });

  // Prediction History State
  const [predictionHistoryState, setPredictionHistoryState] = useState({
    selectedFileId: '',
    visualizationType: '1D',  // '1D' | '2D'
    spatialUnit: 'grid',      // 'grid' | 'cuencas'
    droughtIndex: '',
    scale: 1,
    horizon: 1,
  });

  // Plot data state
  const [plotData, setPlotData] = useState(null);

  // Prediction section open state (lifted from Sidebar so MapArea can react)
  const [predictionOpen, setPredictionOpen] = useState(false);

  // Prediction History section open state (lifted so MapArea can react)
  const [predictionHistoryOpen, setPredictionHistoryOpen] = useState(false);

  // Prediction cells (loaded from backend when prediction section opens)
  const [predictionCells, setPredictionCells] = useState(null);

  // Map layer visibility state
  const [mapLayers, setMapLayers] = useState({
    grid: true,        // Celdas del grid
    stations: false,   // Estaciones hidrológicas
    cuencas: false,    // Cuencas hidrográficas
    embalses: false,   // Embalses
    boundary: true,    // Límite del área de estudio
  });

  // Auto-switch visible layers when data category changes
  useEffect(() => {
    const cat = analysisState.dataCategory;
    if (cat === 'hydromet') {
      setMapLayers(prev => ({ ...prev, grid: true, stations: false }));
    } else if (cat === 'hydrological') {
      setMapLayers(prev => ({ ...prev, grid: false, stations: true }));
    }
  }, [analysisState.dataCategory]);

  // Ensure grid is visible when prediction or prediction history section opens
  useEffect(() => {
    if (predictionOpen || predictionHistoryOpen) {
      setMapLayers(prev => ({ ...prev, grid: true }));
    }
  }, [predictionOpen, predictionHistoryOpen]);

  // Background: preload prediction CHIRPS cells on mount
  // The 297 CHIRPS cells are the same for all prediction files, so load once from any available file
  useEffect(() => {
    if (predictionCells) return;
    let cancelled = false;
    async function loadPredictionCells() {
      try {
        const { historicalApi, predictionApi } = await import('@/services/api');
        const files = await historicalApi.getFiles();
        const predFile = files.find(f => f.dataset_type === 'prediction');
        if (!predFile || cancelled) return;
        const result = await predictionApi.getCells(predFile.file_id);
        if (!cancelled && result?.cells) {
          setPredictionCells({
            fileId: predFile.file_id,
            cells: result.cells,
            resolution: result.resolution || 0.05,
          });
        }
      } catch (err) {
        console.error('Error loading prediction cells:', err);
      }
    }
    loadPredictionCells();
    return () => { cancelled = true; };
  }, [predictionCells]);

  // Handle Analysis Plot
  const handleAnalysisPlot = useCallback(async () => {
    const is2DMode = analysisState.visualizationType === '2D';
    const useSpatialInterval = is2DMode && Boolean(analysisState.useSpatialInterval);
    
    // Validaciones: para 1D requiere celda/estación/cuenca, para 2D no
    if (!is2DMode && !selectedStation && !selectedCell && !(selectedEntity?.type === 'cuenca')) {
      showError(
        'Debes seleccionar una estación, celda o cuenca del mapa antes de graficar',
        'Selección Requerida'
      );
      return;
    }
    
    if (!analysisState.variable && !analysisState.droughtIndex) {
      showWarning('Por favor selecciona una variable o índice de sequía', 'Datos incompletos');
      return;
    }
    
    if (!analysisState.startDate) {
      showWarning('Por favor selecciona la fecha', 'Fecha requerida');
      return;
    }
    
    if (!is2DMode && !analysisState.endDate) {
      showWarning('Por favor selecciona el rango de fechas completo', 'Fechas requeridas');
      return;
    }

    if (useSpatialInterval && !analysisState.endDate) {
      showWarning('Por favor selecciona la fecha final del intervalo', 'Fechas requeridas');
      return;
    }

    if (useSpatialInterval && analysisState.startDate > analysisState.endDate) {
      showWarning('La fecha inicial no puede ser mayor que la fecha final', 'Rango inválido');
      return;
    }

    try {
      showInfo(is2DMode ? 'Consultando datos espaciales...' : 'Consultando datos históricos...', 'Cargando');

      // Importar API
      const { historicalApi, hydroApi } = await import('@/services/api');
      const { INDICES_WITHOUT_SCALE } = await import('@/utils/hydroStations');

      // Determinar variable a consultar (priorizar índice de sequía)
      const variable = analysisState.droughtIndex || analysisState.variable;

      // Obtener archivos disponibles
      const files = await historicalApi.getFiles();
      
      // ===== MODO 2D: VISUALIZACIÓN ESPACIAL =====
      if (is2DMode) {
        const isHydrological = analysisState.dataCategory === 'hydrological';

        if (isHydrological) {
          // ===== 2D HIDROLÓGICO: estaciones =====
          const hydroFile = files.find(f => {
            const meta = f.filename || '';
            return meta.toLowerCase().includes('hydro');
          });

          if (!hydroFile) {
            showError('No se encontró archivo de datos hidrológicos. Sube uno desde el panel admin con dataset_key "hydro_main".', 'Error');
            return;
          }

          const index = analysisState.droughtIndex;
          const noScale = INDICES_WITHOUT_SCALE.has(index);
          const scale = noScale ? null : (analysisState.indexScale || 1);

          const response = await hydroApi.getSpatialData({
            fileId: hydroFile.file_id,
            indexName: index,
            scale: scale,
            targetDate: useSpatialInterval ? null : analysisState.startDate,
            startDate: useSpatialInterval ? analysisState.startDate : null,
            endDate: useSpatialInterval ? analysisState.endDate : null,
            useInterval: useSpatialInterval,
          });

          const periodSubtitle = response.is_interval
            ? `Periodo: ${response.period?.start_date} a ${response.period?.end_date} (promedio)`
            : `Fecha: ${response.date}`;

          const scaleLabel = noScale ? '' : ` (Escala ${scale})`;

          setPlotData({
            type: '2D',
            title: `${response.index_display_name}${scaleLabel} - Estaciones`,
            subtitle: `${periodSubtitle}`,
            variable: response.index_name,
            variable_name: response.index_display_name,
            unit: response.unit,
            date: response.date,
            period: response.period,
            isInterval: Boolean(response.is_interval),
            gridCells: response.stations,
            statistics: response.statistics,
            bounds: response.bounds,
            isHydro: true,
          });

          const validStations = response.statistics?.valid_stations ?? response.stations.length;
          showSuccess(
            `Mapa 2D generado: ${validStations} estaciones con dato válido`,
            '¡Listo!'
          );

        } else if (analysisState.spatialUnit === 'cuencas') {
          // ===== 2D CUENCAS: promedio ponderado por cuenca =====
          // spatialResolution is kept in sync with the UI selector (RadioCard), so use it as primary truth
          const SOURCE_BY_RES = { 0.25: 'ERA5', 0.1: 'IMERG', 0.05: 'CHIRPS' };
          const dataSource = SOURCE_BY_RES[analysisState.spatialResolution] || analysisState.dataSource || 'CHIRPS';
          const sourceResMap = { ERA5: 0.25, IMERG: 0.1, CHIRPS: 0.05 };
          const targetResolution = sourceResMap[dataSource] || 0.05;
          const historicalFiles = files.filter(f => !f.dataset_type || f.dataset_type === 'historical');
          const file = historicalFiles.find(f => Math.abs((f.resolution || 0.1) - targetResolution) < 0.01);

          if (!file) {
            showError(`No se encontró archivo para ${dataSource} (${targetResolution}°)`, 'Error');
            return;
          }

          const response = await historicalApi.getWatershedSpatial({
            fileId: file.file_id,
            variable: variable,
            dataSource: dataSource,
            targetDate: useSpatialInterval ? null : analysisState.startDate,
            startDate: useSpatialInterval ? analysisState.startDate : null,
            endDate: useSpatialInterval ? analysisState.endDate : null,
            useInterval: useSpatialInterval,
            scale: analysisState.droughtIndex ? analysisState.indexScale : null,
            frequency: (!analysisState.droughtIndex && analysisState.variable === 'precip') ? analysisState.frequency : null,
          });

          const periodSubtitle = response.is_interval
            ? `Periodo: ${response.period?.start_date} a ${response.period?.end_date} (promedio)`
            : `Fecha: ${response.date}`;

          setPlotData({
            type: '2D',
            title: `${response.variable_name} - Cuencas`,
            subtitle: `${periodSubtitle} | Fuente: ${dataSource}`,
            variable: response.variable,
            unit: response.unit,
            date: response.date,
            cuencasData: response.cuencas,
            statistics: response.statistics,
            isCuencas: true,
            dataSource: dataSource,
          });

          // Auto-enable cuencas layer
          setMapLayers(prev => ({ ...prev, cuencas: true }));

          const validCuencas = response.cuencas?.filter(c => c.value !== null).length || 0;
          showSuccess(
            `Mapa de cuencas generado: ${validCuencas} cuencas con dato válido (${dataSource})`,
            '¡Listo!'
          );

        } else {
        // Usar la resolución seleccionada por el usuario (solo archivos historicos)
        const targetResolution = analysisState.spatialResolution || 0.05;
        const historicalFiles = files.filter(f => !f.dataset_type || f.dataset_type === 'historical');
        const file = historicalFiles.find(f => Math.abs((f.resolution || 0.1) - targetResolution) < 0.01);
        
        if (!file) {
          showError(`No se encontró archivo para resolución ${targetResolution}°`, 'Error');
          return;
        }
        
        const fileResolution = file.resolution || 0.1;
        
        // Llamar API para datos espaciales
        const response = await historicalApi.getSpatialData({
          fileId: file.file_id,
          variable: variable,
          targetDate: useSpatialInterval ? null : analysisState.startDate,
          startDate: useSpatialInterval ? analysisState.startDate : null,
          endDate: useSpatialInterval ? analysisState.endDate : null,
          useInterval: useSpatialInterval,
          scale: analysisState.droughtIndex ? analysisState.indexScale : null,
          frequency: (!analysisState.droughtIndex && analysisState.variable === 'precip') ? analysisState.frequency : null,
        });

        const periodSubtitle = response.is_interval
          ? `Periodo: ${response.period?.start_date} a ${response.period?.end_date} (promedio)`
          : `Fecha: ${response.date}`;

        const freqNote = !analysisState.droughtIndex && analysisState.frequency
          ? ` | Freq: ${analysisState.frequency === 'M' ? 'Mensual' : 'Diaria'}`
          : '';
        const sourceByResolution = { 0.25: 'ERA5', 0.1: 'IMERG', 0.05: 'CHIRPS' };
        const inferredSource = sourceByResolution[targetResolution] || analysisState.dataSource || null;

        // Procesar respuesta y actualizar plotData para modo 2D
        setPlotData({
          type: '2D',
          title: `${response.variable_name} - Mapa Espacial`,
          subtitle: `${periodSubtitle}${freqNote} | Resolución: ${targetResolution}°`,
          variable: response.variable,
          unit: response.unit,
          frequency: response.frequency || analysisState.frequency || null, // <- agregar
          date: response.date,
          period: response.period,
          isInterval: Boolean(response.is_interval),
          gridCells: response.grid_cells,
          statistics: response.statistics,
          bounds: response.bounds,
          resolution: fileResolution,
          dataSource: inferredSource,
        });

        const uniqueCells = response.statistics?.unique_cells ?? response.grid_cells.length;
        const validCells = response.statistics?.valid_cells ?? response.statistics?.count ?? response.grid_cells.length;
        const usedFallbackDate = Boolean(response.fallback_used);
        const dateNote = usedFallbackDate
          ? ` | fecha solicitada ${response.requested_date}, usada ${response.date}`
          : '';
        const intervalNote = response.is_interval
          ? ` | promedio ${response.period?.start_date} a ${response.period?.end_date}`
          : '';

        showSuccess(
          `Mapa 2D generado: ${uniqueCells} celdas únicas, ${validCells} con dato válido (${targetResolution}°)${intervalNote}${dateNote}`,
          '¡Listo!'
        );
        } // cierre else (hidrometeorológico 2D)
      } 
      // ===== MODO 1D: SERIE TEMPORAL =====
      else {
        let fileId;
        
        if (selectedCell) {
          // Si hay celda seleccionada, buscar archivo con la resolución de la celda
          const resolution = selectedCell.resolution || 0.1;
          const historicalOnly = files.filter(f => !f.dataset_type || f.dataset_type === 'historical');
          const file = historicalOnly.find(f => Math.abs((f.resolution || 0.1) - resolution) < 0.01);
          
          if (!file) {
            showError(`No se encontró archivo para resolución ${resolution}°`, 'Error');
            return;
          }
          
          fileId = file.file_id;
          
          // Llamar API con cell_id para serie de tiempo 1D
          const response = await historicalApi.getTimeSeries({
            fileId: fileId,
            variable: variable,
            startDate: analysisState.startDate,
            endDate: analysisState.endDate,
            cellId: selectedCell.cell_id,
            scale: analysisState.droughtIndex ? analysisState.indexScale : null,
            frequency: !analysisState.droughtIndex ? analysisState.frequency : null,
          });

          // Procesar respuesta y mostrar gráfico
          const freqLabel = response.frequency === 'M' ? 'Mensual' : 'Diaria';
          setPlotData({
            type: '1D',
            title: `${response.variable_name} - Serie de Tiempo`,
            subtitle: `Celda: ${selectedCell.cell_id} | Frecuencia: ${freqLabel}`,
            variable: String(response.variable || variable || '').trim().toUpperCase(),
            unit: response.unit,
            frequency: response.frequency,
            data: response.data,
            statistics: response.statistics,
            location: response.location,
          });

          showSuccess(
            `Serie de tiempo generada para celda ${selectedCell.cell_id}`,
            '¡Listo!'
          );

        } else if (selectedStation) {
          // ===== 1D HIDROLÓGICO: estación seleccionada =====
          const hydroFile = files.find(f => {
            const meta = (f.filename || '').toLowerCase();
            return meta.includes('hydro');
          });

          if (!hydroFile) {
            showError('No se encontró archivo de datos hidrológicos. Sube uno desde el panel admin con dataset_key "hydro_main".', 'Error');
            return;
          }

          if (!analysisState.droughtIndex) {
            showWarning('Selecciona un índice de sequía (SDI, SRI, MFI, DDI, HDI)', 'Índice requerido');
            return;
          }

          const index = analysisState.droughtIndex;
          const noScale = INDICES_WITHOUT_SCALE.has(index);
          const scale = noScale ? null : (analysisState.indexScale || 1);

          const response = await hydroApi.getTimeSeries({
            fileId: hydroFile.file_id,
            stationCode: selectedStation.codigo,
            indexName: index,
            scale: scale,
            startDate: analysisState.startDate,
            endDate: analysisState.endDate,
          });

          const scaleLabel1D = noScale ? '' : ` (Escala ${scale})`;

          // Para DDI/HDI (eventos con duración), expandir cada evento en dos
          // puntos (fecha_inicial, valor) y (fecha_final, valor) para que el
          // chart dibuje un pulso/step constante entre ambas fechas.
          let chartData = response.data;
          if (response.has_duration && response.data?.length > 0) {
            const expanded = [];
            for (const evt of response.data) {
              if (evt.fecha_final && evt.fecha_final !== 'None' && evt.fecha_final !== 'NaT') {
                // Punto inicio del pulso
                expanded.push({ ...evt, date: evt.date });
                // Punto fin del pulso (misma value)
                expanded.push({ ...evt, date: evt.fecha_final });
                // Separador (gap) para que no conecte con el siguiente evento
                const gapDate = new Date(new Date(evt.fecha_final).getTime() + 86400000);
                expanded.push({ date: gapDate.toISOString().split('T')[0], value: null });
              } else {
                expanded.push(evt);
              }
            }
            chartData = expanded;
          }

          setPlotData({
            type: '1D',
            title: `${response.index_display_name}${scaleLabel1D}`,
            subtitle: `Estación: ${selectedStation.codigo} - ${selectedStation.name}`,
            variable: response.index_name,
            variable_name: response.index_display_name,
            unit: response.unit,
            data: chartData,
            rawData: response.data,
            statistics: response.statistics,
            location: response.station,
            hasDuration: response.has_duration,
          });

          showSuccess(
            `Serie generada para estación ${selectedStation.name} (${response.statistics?.count || 0} registros)`,
            '¡Listo!'
          );
        } else if (selectedEntity?.type === 'cuenca') {
          // ===== 1D CUENCA: serie temporal ponderada =====
          const SOURCE_BY_RES = { 0.25: 'ERA5', 0.1: 'IMERG', 0.05: 'CHIRPS' };
          const dataSource = SOURCE_BY_RES[analysisState.spatialResolution] || analysisState.dataSource || 'CHIRPS';
          const sourceResMap = { ERA5: 0.25, IMERG: 0.1, CHIRPS: 0.05 };
          const targetResolution = sourceResMap[dataSource] || 0.05;
          const historicalFiles = files.filter(f => !f.dataset_type || f.dataset_type === 'historical');
          const file = historicalFiles.find(f => Math.abs((f.resolution || 0.1) - targetResolution) < 0.01);

          if (!file) {
            showError(`No se encontró archivo para ${dataSource} (${targetResolution}°)`, 'Error');
            return;
          }

          const response = await historicalApi.getWatershedTimeSeries({
            fileId: file.file_id,
            variable: variable,
            dataSource: dataSource,
            cuencaDn: selectedEntity.dn,
            startDate: analysisState.startDate,
            endDate: analysisState.endDate,
            scale: analysisState.droughtIndex ? analysisState.indexScale : null,
            frequency: (!analysisState.droughtIndex) ? analysisState.frequency : null,
          });

          const freqLabel = response.frequency === 'M' ? 'Mensual' : 'Diaria';
          const cuencaName = response.cuenca?.nombre || selectedEntity.layer;

          setPlotData({
            type: '1D',
            title: `${response.variable_name} - Cuenca ${cuencaName}`,
            subtitle: `Fuente: ${dataSource} | Frecuencia: ${freqLabel}`,
            variable: String(response.variable || variable || '').trim().toUpperCase(),
            unit: response.unit,
            frequency: response.frequency,
            data: response.data,
            statistics: response.statistics,
            isCuencaTimeSeries: true,
          });

          showSuccess(
            `Serie de tiempo generada para cuenca ${cuencaName} (${response.statistics?.count || 0} registros)`,
            '¡Listo!'
          );
        }
      }

    } catch (error) {
      console.error('Error plotting historical analysis:', error);
      showError(
        error.message || 'Error al consultar datos históricos',
        'Error en la consulta'
      );
    }
  }, [analysisState, selectedCell, selectedStation, selectedEntity, showError, showWarning, showInfo, showSuccess]);

  // Handle Prediction Plot
  const handlePredictionPlot = useCallback(async () => {
    const is2D = predictionState.visualizationType === '2D';
    const isCuencas = predictionState.spatialUnit === 'cuencas';

    // Validations
    if (!predictionState.droughtIndex) {
      showWarning('Por favor selecciona un indice de sequia', 'Datos incompletos');
      return;
    }
    if (!predictionState.scale) {
      showWarning('Por favor selecciona una escala temporal', 'Escala requerida');
      return;
    }
    if (!is2D && isCuencas && selectedEntity?.type !== 'cuenca') {
      showError('Selecciona una cuenca del mapa para la prediccion 1D por cuencas', 'Seleccion Requerida');
      return;
    }
    if (!is2D && !isCuencas && !selectedCell) {
      showError('Selecciona una celda del mapa para la prediccion 1D', 'Seleccion Requerida');
      return;
    }
    if (is2D && !predictionState.horizon) {
      showWarning('Por favor selecciona un horizonte de prediccion', 'Horizonte requerido');
      return;
    }

    try {
      showInfo(is2D ? 'Consultando prediccion espacial...' : 'Consultando prediccion temporal...', 'Cargando');

      const { historicalApi, predictionApi } = await import('@/services/api');

      // Use cached prediction file ID if available, otherwise find it
      let predFileId;
      if (predictionCells?.fileId) {
        predFileId = predictionCells.fileId;
      } else {
        const files = await historicalApi.getFiles();
        const predFile = files.find(f => f.dataset_type === 'prediction');
        if (!predFile) {
          showError('No se encontro archivo de prediccion. Sube uno desde el panel admin con dataset_key "prediction_main".', 'Error');
          return;
        }
        predFileId = predFile.file_id;
      }

      if (is2D) {
        if (isCuencas) {
          // === 2D CUENCAS: promedio ponderado por horizonte ===
          const response = await predictionApi.getWatershedSpatial({
            fileId: predFileId,
            var: predictionState.droughtIndex,
            scale: predictionState.scale,
            horizon: predictionState.horizon,
          });

          setPlotData({
            type: 'prediction-2d',
            title: `Prediccion ${predictionState.droughtIndex} (${predictionState.scale}m) - Horizonte ${predictionState.horizon} - Cuencas`,
            subtitle: `${response.cuencas?.length || 0} cuencas | Escala: ${predictionState.scale} meses`,
            variable: predictionState.droughtIndex,
            cuencasData: response.cuencas,
            statistics: response.statistics,
            isCuencas: true,
            resolution: 0.05,
            predictionMeta: { index: predictionState.droughtIndex, scale: predictionState.scale, horizon: predictionState.horizon },
          });

          setMapLayers(prev => ({ ...prev, cuencas: true }));

          const validCuencas = response.cuencas?.filter(c => c.value !== null).length || 0;
          showSuccess(
            `Mapa de cuencas prediccion generado: ${validCuencas} cuencas`,
            '!Listo!'
          );
        } else {
          // === 2D CELDAS: Spatial grid ===
          const response = await predictionApi.getSpatialData({
            fileId: predFileId,
            var: predictionState.droughtIndex,
            scale: predictionState.scale,
            horizon: predictionState.horizon,
          });

          setPlotData({
            type: 'prediction-2d',
            title: `Prediccion ${predictionState.droughtIndex} (${predictionState.scale}m) - Horizonte ${predictionState.horizon}`,
            subtitle: `${response.statistics?.unique_cells || 0} celdas | Escala: ${predictionState.scale} meses`,
            variable: predictionState.droughtIndex,
            gridCells: response.grid_cells,
            statistics: response.statistics,
            bounds: response.bounds,
            resolution: 0.05,
            predictionMeta: { index: predictionState.droughtIndex, scale: predictionState.scale, horizon: predictionState.horizon },
          });

          showSuccess(
            `Mapa de prediccion generado: ${response.statistics?.unique_cells || 0} celdas`,
            '!Listo!'
          );
        }
      } else {
        if (isCuencas) {
          // === 1D CUENCA: 12 horizontes ponderados por area ===
          const response = await predictionApi.getWatershedTimeSeries({
            fileId: predFileId,
            var: predictionState.droughtIndex,
            scale: predictionState.scale,
            cuencaDn: selectedEntity.dn,
          });

          const cuencaName = response.cuenca_nombre || selectedEntity.layer;

          setPlotData({
            type: 'prediction-1d',
            title: `Prediccion ${predictionState.droughtIndex} (${predictionState.scale}m) - Cuenca ${cuencaName}`,
            subtitle: `12 horizontes | Ponderado por area`,
            variable: predictionState.droughtIndex,
            data: response.data,
            statistics: response.statistics,
            predictionMeta: { index: predictionState.droughtIndex, scale: predictionState.scale, cuencaDn: selectedEntity.dn },
            isCuencaTimeSeries: true,
          });

          showSuccess(
            `Prediccion generada para cuenca ${cuencaName} (${response.data?.length || 0} horizontes)`,
            '!Listo!'
          );
        } else {
          // === 1D CELDAS: Time series for cell ===
          const response = await predictionApi.getTimeSeries({
            fileId: predFileId,
            cellId: selectedCell.cell_id,
            var: predictionState.droughtIndex,
            scale: predictionState.scale,
          });

          setPlotData({
            type: 'prediction-1d',
            title: `Prediccion ${predictionState.droughtIndex} (${predictionState.scale}m)`,
            subtitle: `Celda: ${selectedCell.cell_id} | 12 horizontes`,
            variable: predictionState.droughtIndex,
            data: response.data,
            statistics: response.statistics,
            predictionMeta: { index: predictionState.droughtIndex, scale: predictionState.scale, cellId: selectedCell.cell_id },
          });

          showSuccess(
            `Prediccion generada para celda ${selectedCell.cell_id} (${response.data?.length || 0} horizontes)`,
            '!Listo!'
          );
        }
      }
    } catch (error) {
      console.error('Error plotting prediction:', error);
      showError(error.message || 'Error al consultar prediccion', 'Error en la consulta');
    }
  }, [predictionState, predictionCells, selectedCell, selectedEntity, showError, showWarning, showInfo, showSuccess]);

  // Handle AI Summary
  const handleAiSummary = useCallback(async () => {
    if (!plotData) return;

    const isPred1d = plotData.type === 'prediction-1d' || plotData.type === 'prediction-history-1d';
    const isPred2d = plotData.type === 'prediction-2d' || plotData.type === 'prediction-history-2d';
    if (!isPred1d && !isPred2d) {
      showWarning('El resumen IA solo esta disponible para predicciones', 'No disponible');
      return;
    }

    const summaryType = isPred1d ? '1d' : '2d';
    const index = plotData.predictionMeta?.index || plotData.variable;
    const scale = plotData.predictionMeta?.scale || 1;

    setAiSummary({ open: true, loading: true, summary: null, index, type: summaryType });

    try {
      const { predictionApi } = await import('@/services/api');

      let result;
      if (isPred1d) {
        const values = (plotData.data || []).map(d => d.value).filter(v => v != null);
        result = await predictionApi.getAiSummary({ type: '1d', index, scale, values });
      } else {
        const gridSummary = {
          mean: plotData.statistics?.mean,
          min: plotData.statistics?.min,
          max: plotData.statistics?.max,
          pct_severe: plotData.statistics?.pct_severe || 0,
          pct_moderate: plotData.statistics?.pct_moderate || 0,
          pct_normal: plotData.statistics?.pct_normal || 0,
        };
        const horizon = plotData.predictionMeta?.horizon || 1;
        result = await predictionApi.getAiSummary({ type: '2d', index, scale, gridSummary, horizon });
      }

      setAiSummary(prev => ({ ...prev, loading: false, summary: result.summary }));
    } catch (error) {
      console.error('Error getting AI summary:', error);
      setAiSummary(prev => ({ ...prev, loading: false, summary: 'Error al generar resumen: ' + (error.message || 'intenta de nuevo') }));
    }
  }, [plotData, showWarning]);

  // Handle Save functions
  const handleAnalysisSave = useCallback(() => {
    if (!plotData) {
      showWarning('Primero genera un analisis para poder guardar datos', 'Sin datos');
      return;
    }

    try {
      const result = downloadAnalysisJson({
        plotData,
        analysisState,
        selectedCell,
      });

      showSuccess(
        `JSON guardado: ${result.fileName} (${result.rows} filas, ${result.type})`,
        'Datos exportados'
      );
    } catch (error) {
      console.error('Error saving analysis JSON:', error);
      showError(error.message || 'No se pudo guardar el JSON', 'Error de exportacion');
    }
  }, [plotData, analysisState, selectedCell, showWarning, showSuccess, showError]);

  const handleAnalysisImageExport = useCallback(async () => {
    if (!plotData) {
      showWarning('Primero genera un analisis para exportar imagen', 'Sin datos');
      return;
    }

    try {
      const result = await downloadAnalysisImage({
        plotData,
        analysisState,
        selectedCell,
      });

      showSuccess(`Imagen exportada: ${result.fileName}`, 'Exportacion completada');
    } catch (error) {
      console.error('Error exporting analysis image:', error);
      showError(error.message || 'No se pudo exportar la imagen', 'Error de exportacion');
    }
  }, [plotData, analysisState, selectedCell, showWarning, showSuccess, showError]);


  // Handle Prediction History Plot
  const handlePredictionHistoryPlot = useCallback(async () => {
    const is2D = predictionHistoryState.visualizationType === '2D';
    const isCuencas = predictionHistoryState.spatialUnit === 'cuencas';

    if (!predictionHistoryState.selectedFileId) {
      showWarning('Por favor selecciona una prediccion (fecha de emision)', 'Prediccion requerida');
      return;
    }
    if (!predictionHistoryState.droughtIndex) {
      showWarning('Por favor selecciona un indice de sequia', 'Datos incompletos');
      return;
    }
    if (!predictionHistoryState.scale) {
      showWarning('Por favor selecciona una escala temporal', 'Escala requerida');
      return;
    }
    if (!is2D && isCuencas && selectedEntity?.type !== 'cuenca') {
      showError('Selecciona una cuenca del mapa para la prediccion 1D por cuencas', 'Seleccion Requerida');
      return;
    }
    if (!is2D && !isCuencas && !selectedCell) {
      showError('Selecciona una celda del mapa para la prediccion 1D', 'Seleccion Requerida');
      return;
    }
    if (is2D && !predictionHistoryState.horizon) {
      showWarning('Por favor selecciona un horizonte de prediccion', 'Horizonte requerido');
      return;
    }

    try {
      showInfo(is2D ? 'Consultando prediccion historica espacial...' : 'Consultando prediccion historica temporal...', 'Cargando');

      const { predictionHistoryApi } = await import('@/services/api');
      const predFileId = Number(predictionHistoryState.selectedFileId);

      if (is2D) {
        if (isCuencas) {
          // === 2D CUENCAS: prediccion historica por cuenca ===
          const response = await predictionHistoryApi.getWatershedSpatial({
            fileId: predFileId,
            var: predictionHistoryState.droughtIndex,
            scale: predictionHistoryState.scale,
            horizon: predictionHistoryState.horizon,
          });

          setPlotData({
            type: 'prediction-history-2d',
            title: `Historico ${predictionHistoryState.droughtIndex} (${predictionHistoryState.scale}m) - Horizonte ${predictionHistoryState.horizon} - Cuencas`,
            subtitle: `${response.cuencas?.length || 0} cuencas | Escala: ${predictionHistoryState.scale} meses | Prediccion historica`,
            variable: predictionHistoryState.droughtIndex,
            cuencasData: response.cuencas,
            statistics: response.statistics,
            isCuencas: true,
            resolution: 0.05,
            predictionMeta: {
              index: predictionHistoryState.droughtIndex,
              scale: predictionHistoryState.scale,
              horizon: predictionHistoryState.horizon,
              fileId: predFileId,
              isHistory: true,
            },
          });

          setMapLayers(prev => ({ ...prev, cuencas: true }));

          const validCuencas = response.cuencas?.filter(c => c.value !== null).length || 0;
          showSuccess(
            `Mapa de cuencas prediccion historica generado: ${validCuencas} cuencas`,
            '!Listo!'
          );
        } else {
          // === 2D CELDAS: Spatial grid ===
          const response = await predictionHistoryApi.getSpatialData({
            fileId: predFileId,
            var: predictionHistoryState.droughtIndex,
            scale: predictionHistoryState.scale,
            horizon: predictionHistoryState.horizon,
          });

          setPlotData({
            type: 'prediction-history-2d',
            title: `Historico ${predictionHistoryState.droughtIndex} (${predictionHistoryState.scale}m) - Horizonte ${predictionHistoryState.horizon}`,
            subtitle: `${response.statistics?.unique_cells || 0} celdas | Escala: ${predictionHistoryState.scale} meses | Prediccion historica`,
            variable: predictionHistoryState.droughtIndex,
            gridCells: response.grid_cells,
            statistics: response.statistics,
            bounds: response.bounds,
            resolution: 0.05,
            predictionMeta: {
              index: predictionHistoryState.droughtIndex,
              scale: predictionHistoryState.scale,
              horizon: predictionHistoryState.horizon,
              fileId: predFileId,
              isHistory: true,
            },
          });

          showSuccess(
            `Mapa de prediccion historica generado: ${response.statistics?.unique_cells || 0} celdas`,
            '!Listo!'
          );
        }
      } else {
        if (isCuencas) {
          // === 1D CUENCA: prediccion historica por cuenca ===
          const response = await predictionHistoryApi.getWatershedTimeSeries({
            fileId: predFileId,
            var: predictionHistoryState.droughtIndex,
            scale: predictionHistoryState.scale,
            cuencaDn: selectedEntity.dn,
          });

          const cuencaName = response.cuenca_nombre || selectedEntity.layer;

          setPlotData({
            type: 'prediction-history-1d',
            title: `Historico ${predictionHistoryState.droughtIndex} (${predictionHistoryState.scale}m) - Cuenca ${cuencaName}`,
            subtitle: `12 horizontes | Ponderado por area | Prediccion historica`,
            variable: predictionHistoryState.droughtIndex,
            data: response.data,
            statistics: response.statistics,
            predictionMeta: {
              index: predictionHistoryState.droughtIndex,
              scale: predictionHistoryState.scale,
              cuencaDn: selectedEntity.dn,
              fileId: predFileId,
              isHistory: true,
            },
            isCuencaTimeSeries: true,
          });

          showSuccess(
            `Prediccion historica generada para cuenca ${cuencaName} (${response.data?.length || 0} horizontes)`,
            '!Listo!'
          );
        } else {
          // === 1D CELDAS: Time series for cell ===
          const response = await predictionHistoryApi.getTimeSeries({
            fileId: predFileId,
            cellId: selectedCell.cell_id,
            var: predictionHistoryState.droughtIndex,
            scale: predictionHistoryState.scale,
          });

          setPlotData({
            type: 'prediction-history-1d',
            title: `Historico ${predictionHistoryState.droughtIndex} (${predictionHistoryState.scale}m)`,
            subtitle: `Celda: ${selectedCell.cell_id} | 12 horizontes | Prediccion historica`,
            variable: predictionHistoryState.droughtIndex,
            data: response.data,
            statistics: response.statistics,
            predictionMeta: {
              index: predictionHistoryState.droughtIndex,
              scale: predictionHistoryState.scale,
              cellId: selectedCell.cell_id,
              fileId: predFileId,
              isHistory: true,
            },
          });

          showSuccess(
            `Prediccion historica generada para celda ${selectedCell.cell_id} (${response.data?.length || 0} horizontes)`,
            '!Listo!'
          );
        }
      }
    } catch (error) {
      console.error('Error plotting prediction history:', error);
      showError(error.message || 'Error al consultar prediccion historica', 'Error en la consulta');
    }
  }, [predictionHistoryState, selectedCell, selectedEntity, showError, showWarning, showInfo, showSuccess]);

  // Handle Reset
  const handleReset = useCallback(() => {
    setPlotData(null);
    setSelectedStation(null);
    setSelectedCell(null);
    console.log('Map and selections reset');
  }, []);

  // Handle entity (cuenca/embalse) selection — drill-down to 1D when in cuencas 2D
  const handleEntitySelect = useCallback(async (entity) => {
    setSelectedEntity(entity);
    if (!entity || entity.type !== 'cuenca' || !plotData?.isCuencas) return;

    // Drill-down: cuenca 2D → cuenca 1D
    try {
      const { historicalApi, predictionApi, predictionHistoryApi } = await import('@/services/api');

      // === Prediction cuencas drill-down ===
      if (plotData.predictionMeta) {
        const meta = plotData.predictionMeta;
        const index = meta.index;
        const scale = meta.scale;

        let fileId;
        if (meta.fileId) {
          fileId = meta.fileId;
        } else if (predictionCells?.fileId) {
          fileId = predictionCells.fileId;
        } else {
          const files = await historicalApi.getFiles();
          const predFile = files.find(f => f.dataset_type === 'prediction');
          if (!predFile) return;
          fileId = predFile.file_id;
        }

        showInfo(`Consultando prediccion para cuenca ${entity.layer}...`, 'Cargando');

        const api = meta.isHistory ? predictionHistoryApi : predictionApi;
        const response = await api.getWatershedTimeSeries({
          fileId: fileId,
          var: index,
          scale: scale,
          cuencaDn: entity.dn,
        });

        const cuencaName = response.cuenca_nombre || entity.layer;
        const typePrefix = meta.isHistory ? 'prediction-history' : 'prediction';

        if (meta.isHistory) {
          setPredictionHistoryState(prev => ({ ...prev, visualizationType: '1D' }));
        } else {
          setPredictionState(prev => ({ ...prev, visualizationType: '1D' }));
        }

        setPlotData({
          type: `${typePrefix}-1d`,
          title: `${meta.isHistory ? 'Historico ' : 'Prediccion '}${index} (${scale}m) - Cuenca ${cuencaName}`,
          subtitle: `12 horizontes | Ponderado por area${meta.isHistory ? ' | Prediccion historica' : ''}`,
          variable: index,
          data: response.data,
          statistics: response.statistics,
          predictionMeta: { ...meta, cuencaDn: entity.dn },
          isCuencaTimeSeries: true,
        });

        showSuccess(`Prediccion generada para cuenca ${cuencaName}`, '¡Listo!');
        return;
      }

      // === Historical cuencas drill-down ===
      const variable = analysisState.droughtIndex || analysisState.variable;
      if (!variable) return;

      const SOURCE_BY_RES = { 0.25: 'ERA5', 0.1: 'IMERG', 0.05: 'CHIRPS' };
      const dataSource = plotData.dataSource || SOURCE_BY_RES[analysisState.spatialResolution] || analysisState.dataSource || 'CHIRPS';
      const sourceResMap = { ERA5: 0.25, IMERG: 0.1, CHIRPS: 0.05 };
      const targetResolution = sourceResMap[dataSource] || 0.05;

      const files = await historicalApi.getFiles();
      const historicalFiles = files.filter(f => !f.dataset_type || f.dataset_type === 'historical');
      const file = historicalFiles.find(f => Math.abs((f.resolution || 0.1) - targetResolution) < 0.01);
      if (!file) return;

      showInfo(`Consultando serie temporal para cuenca ${entity.layer}...`, 'Cargando');

      const response = await historicalApi.getWatershedTimeSeries({
        fileId: file.file_id,
        variable: variable,
        dataSource: dataSource,
        cuencaDn: entity.dn,
        startDate: analysisState.startDate,
        endDate: analysisState.endDate,
        scale: analysisState.droughtIndex ? analysisState.indexScale : null,
        frequency: (!analysisState.droughtIndex) ? analysisState.frequency : null,
      });

      const freqLabel = response.frequency === 'M' ? 'Mensual' : 'Diaria';
      const cuencaName = response.cuenca?.nombre || entity.layer;

      setAnalysisState(prev => ({ ...prev, visualizationType: '1D' }));

      setPlotData({
        type: '1D',
        title: `${response.variable_name} - Cuenca ${cuencaName}`,
        subtitle: `Fuente: ${dataSource} | Frecuencia: ${freqLabel}`,
        variable: String(response.variable || variable || '').trim().toUpperCase(),
        unit: response.unit,
        frequency: response.frequency,
        data: response.data,
        statistics: response.statistics,
        isCuencaTimeSeries: true,
      });

      showSuccess(`Serie de tiempo generada para cuenca ${cuencaName}`, '¡Listo!');
    } catch (error) {
      console.error('Error in cuenca drill-down:', error);
      showError(error.message || 'Error al consultar serie de cuenca', 'Error');
    }
  }, [plotData, analysisState, predictionCells, showInfo, showSuccess, showError]);

  // Handle Spatial Cell Click from 2D view -> auto-query 1D detail
  const handleSpatialCellClick = useCallback(async (cell) => {
    if (!plotData) return;

    try {
      const { historicalApi, hydroApi, predictionApi, predictionHistoryApi } = await import('@/services/api');

      // === Prediction 2D -> Prediction 1D ===
      if (plotData.type === 'prediction-2d') {
        const cellId = cell.cell_id || `${Number(cell.lon).toFixed(6)}_${Number(cell.lat).toFixed(6)}`;
        const index = plotData.predictionMeta?.index || predictionState.droughtIndex;
        const scale = plotData.predictionMeta?.scale || predictionState.scale;

        // Use cached prediction file ID
        let predFileId = predictionCells?.fileId;
        if (!predFileId) {
          const files = await historicalApi.getFiles();
          const predFile = files.find(f => f.dataset_type === 'prediction');
          if (!predFile) { showError('No se encontro archivo de prediccion', 'Error'); return; }
          predFileId = predFile.file_id;
        }

        showInfo(`Consultando prediccion 1D para celda ${cellId}...`, 'Cargando');

        const response = await predictionApi.getTimeSeries({
          fileId: predFileId,
          cellId: cellId,
          var: index,
          scale: scale,
        });

        // Update selected cell visually
        const halfRes = 0.05 / 2;
        setSelectedCell({
          id: cellId,
          cell_id: cellId,
          center: [cell.lat, cell.lon],
          bounds: [[cell.lat - halfRes, cell.lon - halfRes], [cell.lat + halfRes, cell.lon + halfRes]],
          resolution: 0.05,
          lat: cell.lat,
          lon: cell.lon,
        });
        setSelectedStation(null);

        // Switch prediction sidebar to 1D mode
        setPredictionState(prev => ({ ...prev, visualizationType: '1D' }));

        setPlotData({
          type: 'prediction-1d',
          title: `Prediccion ${index} (${scale}m)`,
          subtitle: `Celda: ${cellId} | 12 horizontes`,
          variable: index,
          data: response.data,
          statistics: response.statistics,
          predictionMeta: { index, scale, cellId },
        });

        showSuccess(`Prediccion 1D generada para celda ${cellId}`, '!Listo!');
        return;
      }

      // === Prediction History 2D -> Prediction History 1D ===
      if (plotData.type === 'prediction-history-2d') {
        const cellId = cell.cell_id || `${Number(cell.lon).toFixed(6)}_${Number(cell.lat).toFixed(6)}`;
        const index = plotData.predictionMeta?.index || predictionHistoryState.droughtIndex;
        const scale = plotData.predictionMeta?.scale || predictionHistoryState.scale;
        const fileId = plotData.predictionMeta?.fileId;

        if (!fileId) { showError('No se encontro archivo de prediccion historica', 'Error'); return; }

        showInfo(`Consultando prediccion historica 1D para celda ${cellId}...`, 'Cargando');

        const response = await predictionHistoryApi.getTimeSeries({
          fileId: fileId,
          cellId: cellId,
          var: index,
          scale: scale,
        });

        // Update selected cell visually
        const halfRes = 0.05 / 2;
        setSelectedCell({
          id: cellId,
          cell_id: cellId,
          center: [cell.lat, cell.lon],
          bounds: [[cell.lat - halfRes, cell.lon - halfRes], [cell.lat + halfRes, cell.lon + halfRes]],
          resolution: 0.05,
          lat: cell.lat,
          lon: cell.lon,
        });
        setSelectedStation(null);

        // Switch prediction history sidebar to 1D mode
        setPredictionHistoryState(prev => ({ ...prev, visualizationType: '1D' }));

        setPlotData({
          type: 'prediction-history-1d',
          title: `Historico ${index} (${scale}m)`,
          subtitle: `Celda: ${cellId} | 12 horizontes | Prediccion historica`,
          variable: index,
          data: response.data,
          statistics: response.statistics,
          predictionMeta: { index, scale, cellId, fileId, isHistory: true },
        });

        showSuccess(`Prediccion historica 1D generada para celda ${cellId}`, '!Listo!');
        return;
      }

      // === Historical 2D (hydro stations) -> Historical 1D ===
      if (plotData.type === '2D' && plotData.isHydro && cell.codigo) {
        const { INDICES_WITHOUT_SCALE } = await import('@/utils/hydroStations');
        const stationCode = cell.codigo;
        const stationName = cell.station_name || cell.codigo;
        const index = analysisState.droughtIndex;
        if (!index) { showWarning('No hay indice de sequia seleccionado', 'Error'); return; }

        const files = await historicalApi.getFiles();
        const hydroFile = files.find(f => (f.filename || '').toLowerCase().includes('hydro'));
        if (!hydroFile) { showError('No se encontro archivo hidrologico', 'Error'); return; }

        const noScale = INDICES_WITHOUT_SCALE.has(index);
        const scale = noScale ? null : (analysisState.indexScale || 1);

        showInfo(`Consultando serie 1D para estacion ${stationName}...`, 'Cargando');

        const response = await hydroApi.getTimeSeries({
          fileId: hydroFile.file_id,
          stationCode: stationCode,
          indexName: index,
          scale: scale,
          startDate: analysisState.startDate,
          endDate: analysisState.endDate,
        });

        // Find the station object for selection
        const { HYDRO_STATIONS } = await import('@/utils/hydroStations');
        const stationObj = HYDRO_STATIONS.find(s => String(s.codigo) === String(stationCode));
        if (stationObj) {
          setSelectedStation({
            id: stationObj.codigo,
            codigo: stationObj.codigo,
            position: [stationObj.lat, stationObj.lon],
            name: stationObj.name,
            area: `Código: ${stationObj.codigo}`,
            type: 'secundaria',
          });
          setSelectedCell(null);
        }

        // Switch to 1D mode
        setAnalysisState(prev => ({ ...prev, visualizationType: '1D' }));

        const scaleLabel = noScale ? '' : ` (Escala ${scale})`;

        let chartData = response.data;
        if (response.has_duration && response.data?.length > 0) {
          const expanded = [];
          for (const evt of response.data) {
            if (evt.fecha_final && evt.fecha_final !== 'None' && evt.fecha_final !== 'NaT') {
              expanded.push({ ...evt, date: evt.date });
              expanded.push({ ...evt, date: evt.fecha_final });
              const gapDate = new Date(new Date(evt.fecha_final).getTime() + 86400000);
              expanded.push({ date: gapDate.toISOString().split('T')[0], value: null });
            } else {
              expanded.push(evt);
            }
          }
          chartData = expanded;
        }

        setPlotData({
          type: '1D',
          title: `${response.index_display_name}${scaleLabel}`,
          subtitle: `Estación: ${stationCode} - ${stationName}`,
          variable: response.index_name,
          variable_name: response.index_display_name,
          unit: response.unit,
          data: chartData,
          rawData: response.data,
          statistics: response.statistics,
          location: response.station,
          hasDuration: response.has_duration,
        });

        showSuccess(`Serie 1D generada para estacion ${stationName}`, '!Listo!');
        return;
      }

      // === Historical 2D (meteorological grid) -> Historical 1D ===
      if (plotData.type === '2D' && !plotData.isHydro) {
        const cellId = cell.cell_id || `${Number(cell.lon).toFixed(6)}_${Number(cell.lat).toFixed(6)}`;
        const variable = analysisState.droughtIndex || analysisState.variable;
        if (!variable) { showWarning('No hay variable seleccionada', 'Error'); return; }

        const resolution = plotData.resolution || 0.05;
        const files = await historicalApi.getFiles();
        const historicalOnly = files.filter(f => !f.dataset_type || f.dataset_type === 'historical');
        const file = historicalOnly.find(f => Math.abs((f.resolution || 0.1) - resolution) < 0.01);
        if (!file) { showError(`No se encontro archivo para resolucion ${resolution}°`, 'Error'); return; }

        showInfo(`Consultando serie 1D para celda ${cellId}...`, 'Cargando');

        const response = await historicalApi.getTimeSeries({
          fileId: file.file_id,
          variable: variable,
          startDate: analysisState.startDate,
          endDate: analysisState.endDate,
          cellId: cellId,
          scale: analysisState.droughtIndex ? analysisState.indexScale : null,
          frequency: !analysisState.droughtIndex ? analysisState.frequency : null,
        });

        // Update selected cell visually
        const halfRes = resolution / 2;
        setSelectedCell({
          id: cellId,
          cell_id: cellId,
          center: [cell.lat, cell.lon],
          bounds: [[cell.lat - halfRes, cell.lon - halfRes], [cell.lat + halfRes, cell.lon + halfRes]],
          resolution: resolution,
          lat: cell.lat,
          lon: cell.lon,
        });
        setSelectedStation(null);

        // Switch to 1D mode
        setAnalysisState(prev => ({ ...prev, visualizationType: '1D' }));

        const freqLabel = response.frequency === 'M' ? 'Mensual' : 'Diaria';
        setPlotData({
          type: '1D',
          title: `${response.variable_name} - Serie de Tiempo`,
          subtitle: `Celda: ${cellId} | Frecuencia: ${freqLabel}`,
          variable: String(response.variable || variable || '').trim().toUpperCase(),
          unit: response.unit,
          frequency: response.frequency,
          data: response.data,
          statistics: response.statistics,
          location: response.location,
        });

        showSuccess(`Serie 1D generada para celda ${cellId}`, '!Listo!');
        return;
      }

    } catch (error) {
      console.error('Error in spatial cell click -> 1D:', error);
      showError(error.message || 'Error al consultar datos 1D', 'Error');
    }
  }, [plotData, predictionState, predictionHistoryState, predictionCells, analysisState, showError, showWarning, showInfo, showSuccess]);

  return (
    <div className="flex flex-col h-screen bg-linear-to-br from-blue-50/30 via-blue-50/20 to-blue-50/20 dark:from-[#0f1419] dark:via-[#0a0e13] dark:to-[#0f1419] p-4">
      <Header />
      
      <div className="flex flex-1 min-h-0 overflow-hidden gap-3 mt-3 mb-3">
        <Sidebar
          analysisState={analysisState}
          setAnalysisState={setAnalysisState}
          predictionState={predictionState}
          setPredictionState={setPredictionState}
          predictionOpen={predictionOpen}
          setPredictionOpen={setPredictionOpen}
          predictionHistoryOpen={predictionHistoryOpen}
          setPredictionHistoryOpen={setPredictionHistoryOpen}
          predictionHistoryState={predictionHistoryState}
          setPredictionHistoryState={setPredictionHistoryState}
          onAnalysisPlot={handleAnalysisPlot}
          onPredictionPlot={handlePredictionPlot}
          onPredictionHistoryPlot={handlePredictionHistoryPlot}
          selectedStation={selectedStation}
          selectedCell={selectedCell}
          selectedEntity={selectedEntity}
        />

        <MapArea
          plotData={plotData}
          onReset={handleReset}
          onSaveData={handleAnalysisSave}
          onExportImage={handleAnalysisImageExport}
          onAiSummary={handleAiSummary}
          aiSummary={aiSummary}
          setAiSummary={setAiSummary}
          predictionOpen={predictionOpen}
          predictionHistoryOpen={predictionHistoryOpen}
          predictionCells={predictionCells}
          selectedStation={selectedStation}
          selectedCell={selectedCell}
          onStationSelect={setSelectedStation}
          onCellSelect={setSelectedCell}
          onSpatialCellClick={handleSpatialCellClick}
          mapLayers={mapLayers}
          setMapLayers={setMapLayers}
          selectedEntity={selectedEntity}
          onEntitySelect={handleEntitySelect}
        />
      </div>
      
      <Footer />

      <GuidedTour />
    </div>
  );
}
