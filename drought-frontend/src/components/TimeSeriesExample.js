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
  const [variableSeleccionada, setVariableSeleccionada] = useState('temperatura'); // Nuevo estado

  // Generar datos de ejemplo
  useEffect(() => {
    generateData(dataSize);
  }, [dataSize]);

  const generateData = (size) => {
    const startDate = new Date('2023-01-01');
    const simple = Array.from({ length: size }, (_, i) => {
      const date = new Date(startDate);
      date.setHours(date.getHours() + i);
      return {
        date: date.toISOString(),
        value: 50 + Math.sin(i / 100) * 20 + Math.random() * 10,
      };
    });
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

// Etiqueta dinámica para el eje Y
const yLabel =
  variableSeleccionada === 'precipitacion'
    ? 'Precipitación (mm)'
    : variableSeleccionada === 'evaporacion' || variableSeleccionada === 'pet' || variableSeleccionada === 'evapotranspiracion'
    ? 'PET (mm)'
    : 'Temperatura (°C)'; // Por defecto, para cualquier temperatura (máxima, mínima, promedio)

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Selector de variable */}
      <div className="mb-6">
        <label className="mr-2 font-medium">Variable:</label>
        <select
          value={variableSeleccionada}
          onChange={e => setVariableSeleccionada(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="temperatura">Temperatura</option>
          <option value="precipitacion">Precipitación</option>
          <option value="evaporacion">Evaporación</option>
        </select>
      </div>

      {/* Ejemplo de gráfica usando yLabel dinámico */}
      <TimeSeriesChart
        data={simpleData}
        xKey="date"
        dataKey="value"
        height={300}
        stroke="#2563eb"
        type="line"
        title="Serie Temporal"
        yLabel={yLabel}
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
