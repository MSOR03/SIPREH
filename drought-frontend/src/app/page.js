'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MapArea from '@/components/MapArea';
import Footer from '@/components/Footer';
import { useToast } from '@/contexts/ToastContext';

export default function Home() {
  const { showError, showSuccess, showInfo, showWarning } = useToast();
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
    if (!analysisState.variable && !analysisState.droughtIndex) {
      showWarning('Por favor selecciona una variable o índice de sequía', 'Datos incompletos');
      return;
    }
    
    if (!analysisState.startDate || !analysisState.endDate) {
      showWarning('Por favor selecciona el rango de fechas completo', 'Fechas requeridas');
      return;
    }

    // TODO: Call backend API
    console.log('Plotting historical analysis:', analysisState);
    
    showSuccess('Gráfico generado exitosamente', '¡Listo!');
    
    // use mock data for now
    const { generateMockSeries } = await import('@/utils/mockData');
    const mock = generateMockSeries({ years: 10 });

    // Set plot data for display
    setPlotData({
      title: `Análisis Histórico: ${analysisState.variable || analysisState.droughtIndex}`,
      type: 'Serie de Tiempo',
      data: mock,
    });
  };

  // Handle Prediction Plot
  const handlePredictionPlot = async () => {
    if (!predictionState.droughtIndex) {
      showWarning('Por favor selecciona un índice de sequía', 'Datos incompletos');
      return;
    }
    
    if (!predictionState.timeHorizon) {
      showWarning('Por favor selecciona un horizonte de predicción', 'Horizonte requerido');
      return;
    }

    // TODO: Call backend API
    console.log('Plotting prediction:', predictionState);
    
    showSuccess('Predicción generada exitosamente', '¡Listo!');
    
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
    console.log('Map reset');
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
        />
        
        <MapArea
          plotData={plotData}
          onReset={handleReset}
        />
      </div>
      
      <Footer />
    </div>
  );
}
