# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DroughtMonitor (SIPREH) is a drought monitoring platform for Colombia. It is a **monorepo with two independent apps**:

- `drought-backend/` — FastAPI API. Queries hydrometeorological data with DuckDB, stores metadata in SQLAlchemy.
- `drought-frontend/` — Next.js 16 (App Router) / React dashboard with Leaflet maps and uPlot/Canvas charts.

The two are developed and run separately. There is no root-level build; `cd` into the app you are working on.

Documentation and the LaTeX manual live in `documents/`. Detailed backend guides are in `drought-backend/documentation/` (start at `DOCS_INDEX.md`).

## Commands

### Backend (`cd drought-backend`)
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt          # add requirements-dev.txt for pytest/dev tools
python init_db.py                         # create tables + default admin + normalize old metadata
python run.py                             # dev server with reload on http://localhost:8000 (docs at /docs)

pytest                                    # run all tests (config in pytest.ini, tests in tests/)
pytest tests/test_historical.py           # single file
pytest tests/test_historical.py::test_name  # single test
pytest --cov=app                          # with coverage
```
Runtime is Python 3.11. `run.py` disables reload when `RAILWAY_ENVIRONMENT`/`RENDER` is set or `DEBUG` is unset.

### Frontend (`cd drought-frontend`)
```bash
npm install
npm run dev      # http://localhost:3000 (uses --webpack, not turbopack)
npm run build
npm run lint     # eslint (eslint-config-next)
```
No frontend test suite exists. Requires `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`.

## Backend architecture

**The relational DB only stores metadata, not the science data.** SQLAlchemy (`DATABASE_URL`, default `sqlite:///./droughtmonitor.db`; PostgreSQL also supported) holds users and the parquet-file registry. All actual time-series/spatial data lives in **`.parquet` files on Cloudflare R2** and is queried on demand with **DuckDB**. Understanding this split is essential before touching data flow.

**Data access path (the hot path):**
1. A `historical`/`prediction`/`hydro` endpoint receives a query (1D timeseries for one cell, or 2D spatial for one date).
2. The service resolves which parquet file(s) back the requested dataset, via the tiered-storage layer.
3. `tiered_storage.py` ensures the parquet is in an **ephemeral disk cache** (`/tmp/parquet_cache` in prod, `.cache_parquet` in dev), downloading from R2 on first access and `touch`-ing it on reuse. A background task preloads active files at startup and periodically evicts idle ones (see `background_preload`/`periodic_cache_eviction` wired in `app/main.py` lifespan).
4. DuckDB runs a minimal SQL query directly over the parquet path(s); results are cached in Redis (or in-memory fallback) keyed by query hash.

**Tiered storage strategies** (`tiered_storage.py`, `TIERED_STORAGE_CONFIG`): small datasets are a `single_file` (full merge on update); larger ones use `historical_updates` (an immutable `historical.parquet` plus a growing `updates.parquet`, both passed together to `read_parquet([...])`, compacted occasionally). Admin merge operations use a separate temp dir.

**Service layer is mixin-composed.** `HistoricalDataService` is assembled from `TimeseriesMixin`, `SpatialMixin`, `WatershedMixin` (files `historical_*_mixin.py`); `HydroDataService` follows the same pattern. Dataset/column configuration (column name mapping, available scales, index keys) is centralized in `historical_constants.py` / `hydro_constants.py` — edit those, not the mixins, to change variable/index catalogs.

**API routing.** `app/api/v1/api.py` mounts routers under `/api/v1`: `auth`, `admin`, `parquet`, `drought`, `historical`, `hydro`, `prediction`, and `dashboard` (v2 is mounted; v1 `dashboard.py` is legacy/commented out). The `admin` router is itself an aggregator (`admin.py`) that re-includes `admin_users`, `admin_files`, `admin_datasets`, `admin_tiered`, `admin_cloud`. When adding admin functionality, add it to the relevant sub-module, not the aggregator.

**Endpoint duplication is intentional but has a recommended path.** `historical/` (raw fast DuckDB), `drought/` (analysis + clustering + export), and `dashboard/` overlap. For plain fast queries prefer `historical/timeseries` (1D) and `historical/spatial` (2D). See `documentation/ENDPOINTS_GUIDE.md` for which to use.

**Other services:** `cloud_storage.py` (R2 / S3-compatible client), `cache.py` (two-level Redis+memory), `ai_summary_service.py` (Groq Llama for auto-summaries), `export_service.py`, `geo_processor.py`/`watershed_relations.py` (geospatial).

**Key env vars** (`.env` in `drought-backend/`, loaded in `app/core/config.py`): `DATABASE_URL`, `SECRET_KEY`, `BACKEND_CORS_ORIGINS`, `CLOUD_STORAGE_*` (R2 credentials), `REDIS_URL`, `GROQ_API_KEY`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`. Almost everything is optional with defaults — the app boots without R2/Redis/Groq, degrading gracefully.

## Frontend architecture

Single-page dashboard. `src/app/page.js` is the main view; `src/app/admin/dashboard/page.js` is the admin panel. The dashboard is driven by a **`Sidebar` with mode sections** (`components/sidebar/`): `HistoricalSection`, `PredictionSection`, `PredictionHistorySection`. The selected mode + parameters drive `MapArea` (which hosts the map, charts, and AI summary) and `LeafletMap`.

- **Maps**: Leaflet via `react-leaflet`, dynamically imported to stay SSR-safe. The grid renders at 3 hierarchical zoom levels (LOW/MED/HIGH) with drill-down; see `utils/gridLevels.js` and `hooks/useGridNavigation.js`.
- **Charts**: historical 1D uses `TimeSeriesChart.js` (uPlot, with LTTB downsampling in `utils/prepareTimeSeriesData.js`); predictions use `PredictionTimeSeriesChart.js` (native Canvas 2D with Q1/Q3/IQR uncertainty bands).
- **Backend integration**: all calls go through `services/api.js` (public: `historicalApi`, `predictionApi`, `predictionHistoryApi`, `hydroApi`) and `services/adminApi.js` (`filesApi`, `datasetsApi`, `usersApi`). Add new endpoints here rather than calling fetch inline.
- **State**: React Context for cross-cutting concerns only — `ThemeContext` (light/dark) and `ToastContext` (notifications).

## Data model concepts

- **Resolutions / sources**: CHIRPS (0.05°), IMERG (0.1°), ERA5 & ERA5-Land (0.25°).
- **Drought indices**: meteorological (SPI, SPEI, RAI, EDDI, PDSI at scales 1/3/6/12 months) and hydrological (SDI, SRI, MFI, DDI, HDI).
- **Predictions**: monthly parquet over 297 CHIRPS cells, 12 monthly horizons, with Q1/Q3/IQR uncertainty. "Prediction history" files carry an admin-assigned `issued_at` emission date used by the frontend selector.

## Conventions

- Code comments and docstrings are predominantly **Spanish**; match the surrounding language when editing a file.
- The data-access split (metadata in SQLAlchemy, science data in parquet/DuckDB/R2) is the architecture's load-bearing decision — keep heavy data out of the relational DB.
