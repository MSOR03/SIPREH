# DroughtMonitor - Plataforma de Monitoreo de Sequias

Sistema web integral para el monitoreo, analisis historico y prediccion de sequias en Colombia. Combina datos hidrometeorológicos de alta resolucion con modelos de prediccion para apoyar la toma de decisiones en gestion de recursos hidricos.

## Descripcion General

DroughtMonitor es una plataforma compuesta por un backend en FastAPI y un frontend en Next.js que permite:

- **Analisis Historico**: Consulta de variables hidrometeorológicas e indices de sequia con mas de 30 anios de datos
- **Prediccion Actual**: Predicciones mensuales de indices de sequia a 12 horizontes (1-12 meses)
- **Historico de Predicciones**: Consulta de predicciones anteriores por fecha de emision
- **Visualizacion Interactiva**: Mapas con celdas CHIRPS (0.05), ERA5 (0.25), IMERG (0.1) y estaciones hidrologicas
- **Administracion**: Panel de gestion de archivos parquet, datasets y usuarios
- **Resumen IA**: Generacion automatica de resumenes via Groq (Llama 3.1)
- **Exportacion**: Descarga de datos en JSON e imagenes PNG

## Stack Tecnologico

### Backend
- **Framework**: FastAPI + Uvicorn
- **Consultas**: DuckDB (consultas SQL directas sobre parquet, 10-100x mas rapido que Pandas)
- **Base de datos**: SQLite con SQLAlchemy ORM
- **Almacenamiento**: Cloudflare R2 (S3-compatible) para archivos .parquet
- **Cache**: Redis (opcional, fallback a memoria)
- **Autenticacion**: JWT (access + refresh tokens)
- **IA**: Groq API (Llama 3.1-8b-instant)

### Frontend
- **Framework**: Next.js 16 (App Router) con React 19
- **Estilos**: Tailwind CSS 4
- **Mapas**: Leaflet con importacion dinamica (SSR-safe)
- **Graficos**: uPlot (series temporales de alto rendimiento) + Canvas 2D (predicciones)
- **Iconos**: Lucide React

## Estructura del Proyecto

```
DroughtMonitor/
├── drought-backend/           # API FastAPI
│   ├── app/
│   │   ├── api/v1/endpoints/  # Endpoints REST
│   │   ├── services/          # Logica de negocio (DuckDB, cache, cloud)
│   │   ├── models/            # Modelos SQLAlchemy
│   │   ├── core/              # Configuracion y seguridad
│   │   └── db/                # Sesion de base de datos
│   ├── documentation/         # Documentacion tecnica detallada
│   ├── init_db.py             # Inicializacion de BD
│   └── run.py                 # Punto de entrada
│
├── drought-frontend/          # Aplicacion Next.js
│   ├── src/
│   │   ├── app/               # Paginas (dashboard, admin)
│   │   ├── components/        # Componentes React
│   │   │   ├── sidebar/       # Secciones del panel lateral
│   │   │   ├── admin/         # Panel de administracion
│   │   │   └── ui/            # Componentes reutilizables
│   │   ├── services/          # Clientes API
│   │   ├── contexts/          # React Context (tema, toast)
│   │   ├── hooks/             # Hooks personalizados
│   │   └── utils/             # Utilidades (exportacion, grid)
│   └── docs/                  # Documentacion del frontend
│
└── documents/                 # Especificaciones del proyecto
```

## Instalacion Rapida

### Requisitos
- Python 3.9+
- Node.js 18+
- Redis (opcional)

### Backend
```bash
cd drought-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # Editar con credenciales
python init_db.py
python run.py
```
Servidor en `http://localhost:8000` | Docs en `http://localhost:8000/docs`

### Frontend
```bash
cd drought-frontend
npm install
cp .env.example .env.local  # Configurar NEXT_PUBLIC_API_URL
npm run dev
```
Aplicacion en `http://localhost:3000`

## Modulos Principales

### 1. Analisis Historico
- Variables: precipitacion, temperatura (media/min/max), evapotranspiracion, balance hidrico
- Indices meteorologicos: SPI, SPEI, RAI, EDDI, PDSI (escalas 1, 3, 6, 12 meses)
- Indices hidrologicos: SDI, SRI, MFI, DDI, HDI
- Visualizacion 1D (serie temporal por celda/estacion) y 2D (mapa espacial)
- Tres resoluciones: ERA5 (0.25), IMERG (0.1), CHIRPS (0.05)

### 2. Prediccion Actual
- Archivo parquet mensual con predicciones a 12 horizontes
- 297 celdas CHIRPS (0.05) sobre el dominio de estudio
- Indices: SPI, SPEI, RAI, EDDI, PDSI con bandas de incertidumbre (Q1, Q3, IQR)
- Visualizacion 1D (12 horizontes por celda) y 2D (mapa con categorias de sequia)
- Resumen IA automatico

### 3. Historico de Predicciones
- Archivo parquet por emision, con fecha de emision (`issued_at`) asignada por el administrador
- Selector de predicciones por fecha de emision en el frontend
- Misma funcionalidad de graficas 1D y 2D que la prediccion actual
- Click en celda del mapa 2D para detalle 1D automatico

### 4. Panel de Administracion
- Gestion de archivos parquet (upload, activar, archivar, eliminar)
- Flujo de datasets: attach, merge-and-rollover, validacion de schema
- Gestion de usuarios (admin/regular)
- Fecha de emision para archivos de prediccion (historico)

## API Endpoints Principales

| Grupo | Prefijo | Descripcion |
|-------|---------|-------------|
| Auth | `/api/v1/auth` | Login, refresh token, perfil |
| Admin | `/api/v1/admin` | Usuarios, archivos, datasets |
| Historical | `/api/v1/historical` | Series temporales y datos espaciales (DuckDB) |
| Prediction | `/api/v1/prediction` | Predicciones 1D/2D, historico, celdas CHIRPS |
| Hydro | `/api/v1/hydro` | Estaciones e indices hidrologicos |
| Dashboard | `/api/v1/dashboard` | Dashboard v2 optimizado |

## Documentacion

### Backend
- [README del Backend](drought-backend/README.md) - Guia completa
- [Indice de documentacion](drought-backend/documentation/DOCS_INDEX.md) - Todas las guias organizadas
- [Guia de endpoints](drought-backend/documentation/ENDPOINTS_GUIDE.md) - Que endpoint usar
- [Flujos de consulta](drought-backend/documentation/FLUJOS_CONSULTA.md) - Consultas 1D y 2D
- [Guia de predicciones](drought-backend/documentation/PREDICTION_GUIDE.md) - Sistema de prediccion y historico

### Frontend
- [README del Frontend](drought-frontend/README.md) - Instalacion y componentes
- [Guia TimeSeriesChart](drought-frontend/docs/TIMESERIES_CHART_GUIDE.md) - Componente uPlot
- [Mejoras recientes](drought-frontend/docs/MEJORAS_TIMESERIES.md) - Changelog de mejoras

## Licencia

Este proyecto esta bajo licencia para uso academico e investigacion.

---

Ultima actualizacion: Abril 2026
