# DroughtMonitor - Frontend

Plataforma web de monitoreo y prediccion de sequias. Interfaz interactiva con mapas, graficos de alta resolucion y panel de administracion.

## Tecnologias

- **Framework**: Next.js 16 (App Router) con React 19
- **Estilos**: Tailwind CSS 4 con modo claro/oscuro
- **Mapas**: Leaflet 1.9 + react-leaflet (importacion dinamica, SSR-safe)
- **Graficos**: uPlot (series temporales alto rendimiento) + Canvas 2D nativo (predicciones con bandas IQR)
- **Iconos**: Lucide React
- **Lenguaje**: JavaScript (ES6+)

## Instalacion

```bash
npm install
npm run dev          # Modo desarrollo (http://localhost:3000)
npm run build        # Compilacion produccion
npm start            # Servidor produccion
```

## Variables de Entorno

Crear `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Estructura del Proyecto

```
drought-frontend/
├── src/
│   ├── app/
│   │   ├── page.js                    # Dashboard principal
│   │   ├── layout.js                  # Layout con ThemeProvider
│   │   ├── admin/dashboard/page.js    # Panel de administracion
│   │   ├── condiciones-de-uso/        # Pagina legal
│   │   └── globals.css                # Estilos globales
│   │
│   ├── components/
│   │   ├── Header.js                  # Encabezado con tema y estado
│   │   ├── Sidebar.js                 # Panel lateral con secciones
│   │   ├── MapArea.js                 # Area de mapa + graficos + IA
│   │   ├── LeafletMap.js              # Mapa Leaflet con grid multi-nivel
│   │   ├── Footer.js                  # Pie de pagina
│   │   ├── TimeSeriesChart.js         # Grafico uPlot (historico 1D)
│   │   ├── PredictionTimeSeriesChart.js  # Grafico Canvas (prediccion 1D con IQR)
│   │   │
│   │   ├── sidebar/
│   │   │   ├── HistoricalSection.js       # Analisis historico
│   │   │   ├── PredictionSection.js       # Prediccion actual
│   │   │   ├── PredictionHistorySection.js # Historico de predicciones
│   │   │   └── primitives.js              # Componentes UI del sidebar
│   │   │
│   │   ├── admin/dashboard/
│   │   │   └── FilesSection.js        # Gestion de archivos y datasets
│   │   │
│   │   └── ui/
│   │       ├── Button.js              # Boton con variantes
│   │       ├── Select.js              # Selector desplegable
│   │       └── DateRangePicker.js     # Selector de rango de fechas
│   │
│   ├── services/
│   │   ├── api.js                     # Cliente API publico (historico, prediccion, etc.)
│   │   └── adminApi.js                # Cliente API admin (archivos, datasets, usuarios)
│   │
│   ├── contexts/
│   │   ├── ThemeContext.js            # Tema claro/oscuro
│   │   └── ToastContext.js            # Notificaciones toast
│   │
│   ├── hooks/
│   │   └── useGridNavigation.js       # Navegacion jerarquica de celdas
│   │
│   └── utils/
│       ├── exporters.js               # Exportacion JSON e imagenes
│       ├── gridLevels.js              # Niveles de zoom (LOW/MED/HIGH)
│       └── prepareTimeSeriesData.js   # Downsampling LTTB para uPlot
│
├── docs/                              # Documentacion del frontend
└── public/                            # Archivos estaticos (favicon, etc.)
```

## Modulos Principales

### 1. Analisis Historico (HistoricalSection)
- **Datos Meteorologicos**: Precipitacion, temperaturas, PET, balance hidrico
- **Datos Hidrologicos**: Estaciones con indices SDI, SRI, MFI, DDI, HDI
- **Indices de Sequia Meteorologicos**: SPI, SPEI, RAI, EDDI, PDSI (escalas 1/3/6/12 meses)
- **Fuentes**: ERA5 (0.25), IMERG (0.1), CHIRPS (0.05)
- **Visualizacion 1D**: Serie temporal por celda o estacion (uPlot con zoom drag)
- **Visualizacion 2D**: Mapa espacial con colores de sequia para todas las celdas

### 2. Prediccion Actual (PredictionSection)
- Celdas CHIRPS (297 celdas de 0.05)
- Indices: SPI, SPEI, RAI, EDDI, PDSI
- **1D**: Grafico Canvas con 12 horizontes y bandas IQR (Q1/Q3/min/max)
- **2D**: Mapa con categorias de sequia coloreadas + leyenda dinamica
- Click en celda del mapa 2D -> detalle 1D automatico
- Resumen IA via Groq API

### 3. Historico de Predicciones (PredictionHistorySection)
- Selector desplegable con predicciones por fecha de emision (`issued_at`)
- Tipo de visualizacion 1D/2D, indice, escala y horizonte
- Misma logica de graficos que prediccion actual
- Click en celda 2D -> 1D automatico

### 4. Panel de Administracion
- Upload de archivos .parquet (drag-and-drop)
- Flujo de datasets: seleccionar dataset, adjuntar archivo con rol y metadata
- Fecha de emision para archivos de prediccion
- Activar/archivar/eliminar archivos

### 5. Mapa Interactivo (LeafletMap)
- Celdas de grid en 3 niveles jerarquicos (LOW/MED/HIGH) con drill-down
- Estaciones hidrologicas con marcadores
- Celdas de prediccion CHIRPS overlay
- Celdas coloreadas espaciales (2D) con click
- Controles de capas (grid, estaciones, cuencas, embalses, limites)

## Integracion con Backend

El frontend se comunica con el backend FastAPI via los clientes en `services/`:

### API Publica (`api.js`)
- `historicalApi` - Catalogo, series temporales 1D, datos espaciales 2D
- `predictionApi` - Celdas, series temporales, datos espaciales, resumen IA
- `predictionHistoryApi` - Lista de predicciones, mismos endpoints de consulta
- `hydroApi` - Estaciones e indices hidrologicos

### API Admin (`adminApi.js`)
- `filesApi` - Upload, listar, eliminar, activar archivos
- `datasetsApi` - Catalogo, attach, merge, estado
- `usersApi` - CRUD de usuarios

## Modo Claro/Oscuro

| Elemento | Claro | Oscuro |
|----------|-------|--------|
| Fondo | `#f8f9fa` | `#0f1419` |
| Primario | `#2563eb` | `#3b82f6` |
| Tarjetas | `#ffffff` | `#1a1f2e` |
| Sidebar | `#f8fafc` | `#141920` |

Categorias de sequia:
- Extrema: rojo oscuro (`#991b1b`)
- Severa: rojo (`#dc2626`)
- Moderada: ambar (`#f59e0b`)
- Normal: verde (`#10b981`)

## Documentacion Adicional

- [Guia TimeSeriesChart](docs/TIMESERIES_CHART_GUIDE.md) - Componente uPlot con LTTB downsampling
- [Mejoras Recientes](docs/MEJORAS_TIMESERIES.md) - Changelog de mejoras UI/UX

---

Ultima actualizacion: Abril 2026
