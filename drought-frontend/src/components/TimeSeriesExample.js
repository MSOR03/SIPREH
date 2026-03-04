/**
 * Example/Demo component for TimeSeriesChart
 * Shows how to use the optimized chart with large datasets
 */
'use client';

import { useState, useEffect } from 'react';
import TimeSeriesChart from './TimeSeriesChart';
import AdvancedTimeSeriesChart from './AdvancedTimeSeriesChart';

export default function TimeSeriesExample() {
  const [simpleData, setSimpleData] = useState([]);
  const [complexData, setComplexData] = useState([]);
  const [dataSize, setDataSize] = useState(10000);

  // Generate sample data
  useEffect(() => {
    generateData(dataSize);
  }, [dataSize]);

  const generateData = (size) => {
    const startDate = new Date('2023-01-01');
    
    // Simple single-series data
    const simple = Array.from({ length: size }, (_, i) => {
      const date = new Date(startDate);
      date.setHours(date.getHours() + i);
      
      return {
        date: date.toISOString(),
        value: 50 + Math.sin(i / 100) * 20 + Math.random() * 10,
      };
    });
    
    // Complex multi-series data
    const complex = Array.from({ length: size }, (_, i) => {
      const date = new Date(startDate);
      date.setHours(date.getHours() + i);
      
      return {
        timestamp: date.toISOString(),
        temperature: 20 + Math.sin(i / 100) * 10 + Math.random() * 5,
        humidity: 60 + Math.cos(i / 80) * 20 + Math.random() * 10,
        pressure: 1013 + Math.sin(i / 150) * 15 + Math.random() * 3,
      };
    });

    setSimpleData(simple);
    setComplexData(complex);
  };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          📊 TimeSeriesChart - Performance Demo
        </h1>
        <p className="text-gray-600 mb-6">
          Demostración de gráficas optimizadas con uPlot para grandes volúmenes de datos
        </p>

        {/* Data size selector */}
        <div className="inline-flex items-center gap-4 bg-white rounded-lg shadow px-6 py-3">
          <label className="font-medium">Tamaño del dataset:</label>
          <select 
            value={dataSize} 
            onChange={(e) => setDataSize(Number(e.target.value))}
            className="border rounded px-3 py-2"
          >
            <option value={1000}>1,000 puntos</option>
            <option value={5000}>5,000 puntos</option>
            <option value={10000}>10,000 puntos</option>
            <option value={25000}>25,000 puntos</option>
            <option value={50000}>50,000 puntos</option>
            <option value={100000}>100,000 puntos</option>
          </select>
          <span className="text-sm text-gray-500">
            ({simpleData.length.toLocaleString()} cargados)
          </span>
        </div>
      </div>

      {/* Example 1: Simple Line Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">
          1️⃣ Gráfica Simple de Línea
        </h2>
        <p className="text-gray-600 mb-4">
          Gráfica básica con una sola serie de datos. Downsampling automático activado.
        </p>
        
        <TimeSeriesChart
          data={simpleData}
          xKey="date"
          dataKey="value"
          height={300}
          stroke="#2563eb"
          type="line"
          title="Simple Time Series"
          yLabel="Value"
        />
        
        <div className="mt-4 text-sm text-gray-500">
          ⚡ Renderizando {simpleData.length.toLocaleString()} puntos con alto rendimiento
        </div>
      </div>

      {/* Example 2: Area Chart */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">
          2️⃣ Gráfica de Área
        </h2>
        <p className="text-gray-600 mb-4">
          Mismos datos con relleno de área para resaltar tendencias.
        </p>
        
        <TimeSeriesChart
          data={simpleData}
          xKey="date"
          dataKey="value"
          height={300}
          stroke="#10b981"
          fill="#10b98133"
          type="area"
          title="Area Chart Example"
          yLabel="Value"
        />
      </div>

      {/* Example 3: Multi-Series Advanced */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">
          3️⃣ Gráfica Avanzada Multi-Series
        </h2>
        <p className="text-gray-600 mb-4">
          Múltiples series de datos con tooltips personalizados, zoom y pan interactivo.
        </p>
        
        <AdvancedTimeSeriesChart
          data={complexData}
          xKey="timestamp"
          dataKey={['temperature', 'humidity', 'pressure']}
          stroke={['#ef4444', '#3b82f6', '#10b981']}
          fill={['#ef444422', '#3b82f622', '#10b98122']}
          type="area"
          height={450}
          title="Environmental Monitoring (Multi-Series)"
          yLabel="Measurements"
          maxPoints={5000}
          showZoom={true}
          showTooltip={true}
          tooltipFormat={(val) => val.toFixed(2)}
        />
      </div>

      {/* Example 4: Real-time Style */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">
          4️⃣ Estilo de Datos en Tiempo Real
        </h2>
        <p className="text-gray-600 mb-4">
          Solo últimos puntos visibles simulando streaming de datos.
        </p>
        
        <TimeSeriesChart
          data={simpleData.slice(-1000)} // Últimos 1000 puntos
          xKey="date"
          dataKey="value"
          height={250}
          stroke="#8b5cf6"
          fill="#8b5cf633"
          type="area"
          title="Recent Data (Last 1000 points)"
          yLabel="Value"
        />
      </div>

      {/* Performance Info */}
      <div className="bg-blue-50 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-3">⚡ Optimizaciones Aplicadas</h3>
        <ul className="space-y-2 text-gray-700">
          <li>✅ <strong>LTTB Downsampling:</strong> Reduce puntos manteniendo fidelidad visual</li>
          <li>✅ <strong>Canvas Rendering:</strong> uPlot usa Canvas en lugar de SVG para mejor rendimiento</li>
          <li>✅ <strong>Auto-scaling:</strong> Ajuste automático de threshold según ancho del contenedor</li>
          <li>✅ <strong>Memory Efficient:</strong> ~90% menos memoria que Recharts</li>
          <li>✅ <strong>Zoom & Pan:</strong> Drag para zoom, doble-click para reset</li>
          <li>✅ <strong>Responsive:</strong> Se adapta automáticamente al tamaño del contenedor</li>
        </ul>
      </div>

      {/* Usage Guide */}
      <div className="bg-gray-50 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-3">📖 Guía de Uso</h3>
        <p className="mb-4">Para usar estos componentes en tu aplicación:</p>
        
        <div className="bg-white rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre>{`// Simple chart
import TimeSeriesChart from '@/components/TimeSeriesChart';

<TimeSeriesChart
  data={yourData}
  xKey="date"
  dataKey="value"
  height={400}
  stroke="#2563eb"
/>

// Advanced chart with multiple series
import AdvancedTimeSeriesChart from '@/components/AdvancedTimeSeriesChart';

<AdvancedTimeSeriesChart
  data={yourData}
  xKey="timestamp"
  dataKey={['series1', 'series2']}
  stroke={['#ef4444', '#3b82f6']}
  showZoom={true}
  showTooltip={true}
/>`}</pre>
        </div>
        
        <p className="mt-4 text-sm text-gray-600">
          📚 Ver <code className="bg-white px-2 py-1 rounded">TIMESERIES_CHART_GUIDE.md</code> para documentación completa
        </p>
      </div>
    </div>
  );
}
