'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MapArea from '@/components/MapArea';
import Footer from '@/components/Footer';
import { useToast } from '@/contexts/ToastContext';
import { downloadAnalysisImage, downloadAnalysisJson } from '@/utils/exporters';

export default function Home() {
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  
  // Selection state
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  
  // Historical Analysis State
  const [analysisState, setAnalysisState] = useState({
    dataCategory: 'hydromet',   // 'hydromet' | 'hydrological'
    visualizationType: '1D',    // '1D' = Serie Temporal, '2D' = Mapa Espacial
    spatialUnit: 'grid',        // 'grid' | 'cuencas' | 'embalses' | 'estaciones'
    dataSource: 'ERA5',         // 'ERA5' | 'IMERG' | 'CHIRPS' (hydromet only)
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
    droughtIndex: '',
    scale: 1,
    horizon: 1,
  });

  // AI Summary state
  const [aiSummary, setAiSummary] = useState({ open: false, loading: false, summary: null, index: '', type: '1d' });

  // Prediction History State
  const [predictionHistoryState, setPredictionHistoryState] = useState({
    droughtIndex: '',
    timeHorizon: '',
    predictionDate: '',
  });

  // Plot data state
  const [plotData, setPlotData] = useState(null);

  // Prediction section open state (lifted from Sidebar so MapArea can react)
  const [predictionOpen, setPredictionOpen] = useState(true);

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

  // Load prediction cells when prediction section opens
  useEffect(() => {
    if (!predictionOpen || predictionCells) return;
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
  }, [predictionOpen, predictionCells]);

  // Handle Analysis Plot
  const handleAnalysisPlot = useCallback(async () => {
    const is2DMode = analysisState.visualizationType === '2D';
    const useSpatialInterval = is2DMode && Boolean(analysisState.useSpatialInterval);
    
    // Validaciones: para 1D requiere celda/estación, para 2D no
    if (!is2DMode && !selectedStation && !selectedCell) {
      showError(
        'Debes seleccionar una estación o celda del mapa antes de graficar',
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

        // Procesar respuesta y actualizar plotData para modo 2D
        setPlotData({
          type: '2D',
          title: `${response.variable_name} - Mapa Espacial`,
          subtitle: `${periodSubtitle}${freqNote} | Resolución: ${targetResolution}°`,
          variable: response.variable,
          unit: response.unit,
          date: response.date,
          period: response.period,
          isInterval: Boolean(response.is_interval),
          gridCells: response.grid_cells,  // Array de celdas con lat, lon, value, color, etc.
          statistics: response.statistics,
          bounds: response.bounds,
          resolution: fileResolution, // Pasar resolución del archivo
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
            showWarning('Selecciona un índice hidrológico (SDI, SRI, MFI, DDI, HDI)', 'Índice requerido');
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
        }
      }

    } catch (error) {
      console.error('Error plotting historical analysis:', error);
      showError(
        error.message || 'Error al consultar datos históricos',
        'Error en la consulta'
      );
    }
  }, [analysisState, selectedCell, selectedStation, showError, showWarning, showInfo, showSuccess]);

  // Handle Prediction Plot
  const handlePredictionPlot = useCallback(async () => {
    const is2D = predictionState.visualizationType === '2D';

    // Validations
    if (!predictionState.droughtIndex) {
      showWarning('Por favor selecciona un indice de sequia', 'Datos incompletos');
      return;
    }
    if (!predictionState.scale) {
      showWarning('Por favor selecciona una escala temporal', 'Escala requerida');
      return;
    }
    if (!is2D && !selectedCell) {
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
        // === 2D: Spatial grid ===
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
      } else {
        // === 1D: Time series for cell ===
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
    } catch (error) {
      console.error('Error plotting prediction:', error);
      showError(error.message || 'Error al consultar prediccion', 'Error en la consulta');
    }
  }, [predictionState, predictionCells, selectedCell, showError, showWarning, showInfo, showSuccess]);

  // Handle AI Summary
  const handleAiSummary = useCallback(async () => {
    if (!plotData) return;

    const isPred1d = plotData.type === 'prediction-1d';
    const isPred2d = plotData.type === 'prediction-2d';
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
      });

      showSuccess(`Imagen exportada: ${result.fileName}`, 'Exportacion completada');
    } catch (error) {
      console.error('Error exporting analysis image:', error);
      showError(error.message || 'No se pudo exportar la imagen', 'Error de exportacion');
    }
  }, [plotData, analysisState, showWarning, showSuccess, showError]);


  // Handle Prediction History Plot
  const handlePredictionHistoryPlot = useCallback(async () => {
    if (!selectedStation && !selectedCell) {
      showError('Debes seleccionar una estación o celda del mapa', 'Selección Requerida');
      return;
    }
    if (!predictionHistoryState.droughtIndex) {
      showWarning('Por favor selecciona un índice de sequía', 'Datos incompletos');
      return;
    }
    if (!predictionHistoryState.predictionDate) {
      showWarning('Por favor selecciona la fecha de emisión de la predicción', 'Fecha requerida');
      return;
    }

    const location = selectedStation
      ? `Estación: ${selectedStation.name}`
      : `Celda: [${selectedCell.center[0].toFixed(3)}, ${selectedCell.center[1].toFixed(3)}]`;

    console.log('Querying prediction history:', {
      ...predictionHistoryState,
      location: selectedStation || selectedCell,
    });

    showSuccess(`Histórico de predicción consultado para ${location}`, '¡Listo!');

    setPlotData({
      title: `Histórico Predicción: ${predictionHistoryState.droughtIndex} - ${predictionHistoryState.timeHorizon}`,
      type: 'Histórico de Predicción',
      data: predictionHistoryState,
    });
  }, [predictionHistoryState, selectedStation, selectedCell, showError, showWarning, showSuccess]);

  // Handle Reset
  const handleReset = useCallback(() => {
    setPlotData(null);
    setSelectedStation(null);
    setSelectedCell(null);
    console.log('Map and selections reset');
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50/30 via-blue-50/20 to-blue-50/20 dark:from-[#0f1419] dark:via-[#0a0e13] dark:to-[#0f1419] p-4">
      <Header />
      
      <div className="flex flex-1 overflow-hidden gap-3 mt-3 mb-3">
        <Sidebar
          analysisState={analysisState}
          setAnalysisState={setAnalysisState}
          predictionState={predictionState}
          setPredictionState={setPredictionState}
          predictionOpen={predictionOpen}
          setPredictionOpen={setPredictionOpen}
          predictionHistoryState={predictionHistoryState}
          setPredictionHistoryState={setPredictionHistoryState}
          onAnalysisPlot={handleAnalysisPlot}
          onPredictionPlot={handlePredictionPlot}
          onPredictionHistoryPlot={handlePredictionHistoryPlot}
          selectedStation={selectedStation}
          selectedCell={selectedCell}
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
          predictionCells={predictionCells}
          selectedStation={selectedStation}
          selectedCell={selectedCell}
          onStationSelect={setSelectedStation}
          onCellSelect={setSelectedCell}
          mapLayers={mapLayers}
          setMapLayers={setMapLayers}
        />
      </div>
      
      <Footer />
    </div>
  );
}
