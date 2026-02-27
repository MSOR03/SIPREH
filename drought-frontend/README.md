# Drought Monitoring Platform - Frontend

Plataforma web de monitoreo y predicción de sequías para Bogotá, Colombia.

## 🚀 Características

- **Análisis Histórico**: Visualización de variables hidrometeorológicas e índices de sequía de los últimos 30 años
- **Predicción**: Modelos predictivos de sequía con horizontes de 1, 3 y 6 meses
- **Visualización Interactiva**: Mapas interactivos con estaciones de monitoreo y celdas de análisis
- **Modo Claro/Oscuro**: Interfaz adaptable con temas claro y oscuro
- **Exportación de Datos**: Descarga de datos en formato CSV y gráficos en PNG/JPEG
- **Diseño Responsivo**: Optimizado para diferentes tamaños de pantalla

## 🛠️ Tecnologías

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **Mapas**: Leaflet, React-Leaflet
- **Gráficos**: Recharts (preparado para integración)
- **Iconos**: Lucide React
- **Lenguaje**: JavaScript (ES6+)

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Construcción para producción
npm run build

# Iniciar servidor de producción
npm start
```

El servidor de desarrollo estará disponible en `http://localhost:3000`

## 🏗️ Estructura del Proyecto

```
drought-frontend/
├── src/
│   ├── app/
│   │   ├── layout.js          # Layout principal con ThemeProvider
│   │   ├── page.js             # Página principal del dashboard
│   │   └── globals.css         # Estilos globales y variables CSS
│   ├── components/
│   │   ├── Header.js           # Encabezado con logo y toggle de tema
│   │   ├── Sidebar.js          # Panel lateral con controles
│   │   ├── MapArea.js          # Área del mapa y visualizaciones
│   │   ├── Footer.js           # Pie de página con información
│   │   └── ui/
│   │       ├── Button.js       # Componente de botón reutilizable
│   │       ├── Select.js       # Componente de selección
│   │       └── DateRangePicker.js  # Selector de rango de fechas
│   ├── contexts/
│   │   └── ThemeContext.js     # Contexto para manejo de tema
│   └── config/
│       └── constants.js        # Configuración y constantes de la API
├── public/                     # Archivos estáticos
├── package.json
└── next.config.mjs
```

## 🎨 Paleta de Colores

### Modo Claro
- **Fondo**: `#f8f9fa`
- **Primario**: `#2563eb` (Azul para hidrología)
- **Sequía Extrema**: `#991b1b`
- **Sequía Severa**: `#dc2626`
- **Sequía Moderada**: `#f59e0b`
- **Normal**: `#10b981`

### Modo Oscuro
- **Fondo**: `#0f1419`
- **Primario**: `#3b82f6`
- **Tarjetas**: `#1a1f2e`

## 📋 Componentes Principales

### 1. Análisis Histórico
- **Menu (1)**: Variables hidrometeorológicas (precipitación, temperatura, ET, caudal)
- **Menu (2)**: Índices de sequía (SPI, SPEI, PDSI, SSI, SWI)
- **Slidebar (1)**: Selector de rango de fechas
- **Botones**: Graficar y Guardar

### 2. Predicción
- **Menu (3)**: Índices de sequía para predicción
- **Menu (3A)**: Correlaciones con fenómenos macroclimáticos (ENSO, PDO, NAO)
- **Menu (4)**: Horizonte de tiempo (1m, 3m, 6m)
- **Botones**: Graficar y Guardar

### 3. Zona de Visualización
- **Mapa Interactivo**: Mapa de Bogotá con estaciones y celdas
- **Área de Gráficos**: Visualización de series temporales y mapas 2D
- **Botón Reset**: Reinicia la visualización

## 🔌 Integración con Backend

El frontend está preparado para conectarse con un backend FastAPI. Configura la URL del backend en el archivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Endpoints Esperados

- `POST /api/historical/data` - Obtener datos históricos
- `POST /api/prediction/drought-index` - Obtener predicciones
- `GET /api/stations` - Obtener lista de estaciones
- `POST /api/export/csv` - Exportar datos a CSV
- `POST /api/export/chart` - Exportar gráfico

## 🎯 Próximas Características

- [ ] Integración completa con backend FastAPI
- [ ] Visualización de gráficos con Recharts
- [ ] Exportación de datos (CSV, PNG, JPEG)
- [ ] Carga de archivos Parquet
- [ ] Animaciones de series temporales
- [ ] Sistema de notificaciones
- [ ] Comparación de múltiples períodos
- [ ] Generación de reportes PDF

## 📱 Responsive Design

La interfaz se adapta automáticamente a:
- 💻 Desktop (1920x1080+)
- 💻 Laptop (1366x768)
- 📱 Tablet (768x1024)
- 📱 Mobile (375x667)

## 🔒 Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

## 🤝 Contribución

1. Clona el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo licencia para uso académico e investigación.

## 📞 Contacto

Para más información sobre el proyecto, consulta la documentación completa o contacta al equipo de desarrollo.

---

**Desarrollado para el monitoreo y predicción de sequías en Bogotá** 🌧️💧
