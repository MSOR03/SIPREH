'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MapArea from '@/components/MapArea';
import Footer from '@/components/Footer';
import { useToast } from '@/contexts/ToastContext';

export default function Home() {
  const { showError, showSuccess, showInfo, showWarning } = useToast();
  
  // Selection state
  const [selectedStation, setSelectedStation] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  
  // Historical Analysis State
  const [analysisState, setAnalysisState] = useState({
    variable: '',
    droughtIndex: '',
    startDate: '',
    endDate: '',
  });

  // Prediction State
  const [predictionState, setPredictionState] = useState({
    droughtIndex: '',
    macroclimaticIndex: '',
    timeHorizon: '',
  });

  // Plot data state
  const [plotData, setPlotData] = useState(null);

  // Handle Analysis Plot
  const handleAnalysisPlot = async () => {
    // Validate selection first
    if (!selectedStation && !selectedCell) {
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
    
    if (!analysisState.startDate || !analysisState.endDate) {
      showWarning('Por favor selecciona el rango de fechas completo', 'Fechas requeridas');
      return;
    }

    try {
      showInfo('Consultando datos históricos...', 'Cargando');

      // Importar API
      const { historicalApi } = await import('@/services/api');

      // Determinar variable a consultar (priorizar índice de sequía)
      const variable = analysisState.droughtIndex || analysisState.variable;

      // Obtener archivos disponibles
      const files = await historicalApi.getFiles();
      
      let fileId;
      
      if (selectedCell) {
        // Si hay celda seleccionada, buscar archivo con la resolución de la celda
        const resolution = selectedCell.resolution || 0.1;
        const file = files.find(f => Math.abs((f.resolution || 0.1) - resolution) < 0.01);
        
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
        });

        // Procesar respuesta y mostrar gráfico
        setPlotData({
          type: '1D',
          title: `${response.variable_name} - Serie de Tiempo`,
          subtitle: `Celda: ${selectedCell.cell_id}`,
          variable: response.variable,
          unit: response.unit,
          data: response.data,
          statistics: response.statistics,
          location: response.location,
        });

        showSuccess(
          `Serie de tiempo generada para celda ${selectedCell.cell_id}`,
          '¡Listo!'
        );

      } else if (selectedStation) {
        // TODO: Implementar para estaciones
        showWarning('Análisis para estaciones estará disponible próximamente', 'En desarrollo');
        return;
      }

    } catch (error) {
      console.error('Error plotting historical analysis:', error);
      showError(
        error.message || 'Error al consultar datos históricos',
        'Error en la consulta'
      );
    }
  };

  // Handle Prediction Plot
  const handlePredictionPlot = async () => {
    // Validate selection first
    if (!selectedStation && !selectedCell) {
      showError(
        'Debes seleccionar una estación o celda del mapa antes de graficar',
        'Selección Requerida'
      );
      return;
    }
    
    if (!predictionState.droughtIndex) {
      showWarning('Por favor selecciona un índice de sequía', 'Datos incompletos');
      return;
    }
    
    if (!predictionState.timeHorizon) {
      showWarning('Por favor selecciona un horizonte de predicción', 'Horizonte requerido');
      return;
    }

    // TODO: Call backend API with selected station/cell
    const location = selectedStation 
      ? `Estación: ${selectedStation.name}` 
      : `Celda: [${selectedCell.center[0].toFixed(3)}, ${selectedCell.center[1].toFixed(3)}]`;
    
    console.log('Plotting prediction:', {
      ...predictionState,
      location: selectedStation || selectedCell
    });
    
    showSuccess(
      `Predicción generada para ${location}`,
      '¡Listo!'
    );
    
    // Set plot data for display
    setPlotData({
      title: `Predicción: ${predictionState.droughtIndex} - ${predictionState.timeHorizon}`,
      type: 'Mapa de Predicción',
      data: predictionState,
    });
  };

  // Handle Save functions
  const handleAnalysisSave = () => {
    // TODO: Implement save functionality (CSV/PNG/JPEG export)
    console.log('Saving historical analysis data');
    showInfo('La funcionalidad de guardado estará disponible próximamente', 'En desarrollo');
  };

  const handlePredictionSave = () => {
    // TODO: Implement save functionality
    console.log('Saving prediction data');
    showInfo('La funcionalidad de guardado estará disponible próximamente', 'En desarrollo');
  };

  // Handle Reset
  const handleReset = () => {
    setPlotData(null);
    setSelectedStation(null);
    setSelectedCell(null);
    console.log('Map and selections reset');
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50/30 via-blue-50/20 to-blue-50/20 dark:from-[#0f1419] dark:via-[#0a0e13] dark:to-[#0f1419] p-4">
      <Header />
      
      <div className="flex flex-1 overflow-hidden gap-3 mt-3 mb-3">
        <Sidebar
          analysisState={analysisState}
          setAnalysisState={setAnalysisState}
          predictionState={predictionState}
          setPredictionState={setPredictionState}
          onAnalysisPlot={handleAnalysisPlot}
          onPredictionPlot={handlePredictionPlot}
          onAnalysisSave={handleAnalysisSave}
          onPredictionSave={handlePredictionSave}
          selectedStation={selectedStation}
          selectedCell={selectedCell}
        />
        
        <MapArea
          plotData={plotData}
          onReset={handleReset}
          selectedStation={selectedStation}
          selectedCell={selectedCell}
          onStationSelect={setSelectedStation}
          onCellSelect={setSelectedCell}
        />
      </div>
      
      <Footer />
    </div>
  );
}
