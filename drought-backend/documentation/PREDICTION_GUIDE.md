# Sistema de Prediccion de Sequias

Documentacion del modulo de prediccion y su historico. Cubre el flujo completo desde la carga de archivos parquet hasta la consulta y visualizacion.

## Arquitectura

```
Admin sube .parquet   -->  POST /admin/datasets/attach-file
con issued_at               (role=prediction_monthly, activate_now=true)
                               |
                               v
                        Archivo anterior -> archived
                        Archivo nuevo -> active
                               |
                               v
Frontend consulta  -->  GET /prediction/history/list
por fecha emision       (lista active + archived con issued_at)
                               |
                               v
                        POST /prediction/cells/{file_id}
                        POST /prediction/timeseries
                        POST /prediction/spatial
```

## Schema del Parquet de Prediccion

Cada archivo `.parquet` de prediccion debe tener estas columnas:

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| `ds` | INTEGER | Identificador de serie |
| `freq` | STRING | Frecuencia |
| `date` | TIMESTAMP | Fecha de la prediccion |
| `cell_id` | STRING | ID de celda CHIRPS (formato `lat_lon`) |
| `lon` | DOUBLE | Longitud |
| `lat` | DOUBLE | Latitud |
| `var` | STRING | Indice de sequia: SPI, SPEI, RAI, EDDI, PDSI |
| `scale` | INTEGER | Escala temporal: 1, 3, 6, 12 meses |
| `value` | FLOAT | Valor predicho |
| `conf_interp` | INTEGER | Interpolacion de confianza |
| `conf_flag` | INTEGER | Flag de confianza |
| `n_used` | INTEGER | Numero de observaciones usadas |
| `neff` | INTEGER | Numero efectivo de observaciones |
| `q1` | FLOAT | Percentil 25 |
| `q3` | FLOAT | Percentil 75 |
| `iqr_min` | FLOAT | Limite inferior IQR |
| `iqr_max` | FLOAT | Limite superior IQR |
| `horizon` | INTEGER | Horizonte de prediccion (1-12 meses) |

El dataset contiene 297 celdas CHIRPS (resolucion 0.05) sobre el dominio de estudio.

## Flujo del Administrador

### 1. Subir archivo de prediccion

En el panel de administracion (`/admin/dashboard`):

1. Subir el archivo `.parquet` en la seccion de uploads
2. En el flujo de datasets, seleccionar `prediction_main`
3. Seleccionar el archivo subido y el rol `prediction_monthly`
4. **Ingresar la fecha de emision** (campo `Fecha de emision (prediccion)`)
5. Click en "Adjuntar al dataset"

El sistema automaticamente:
- Archiva el archivo de prediccion anterior (status `archived`)
- Activa el nuevo archivo (status `active`)
- Guarda la fecha de emision en `file_metadata.issued_at`

### 2. Metadata almacenada

Ejemplo de `file_metadata` para un archivo de prediccion:
```json
{
  "dataset_key": "prediction_main",
  "role": "prediction_monthly",
  "active_for_queries": true,
  "snapshot_version": 3,
  "activated_at": "2026-03-15T10:30:00",
  "issued_at": "2026-03-01"
}
```

## Endpoints de Prediccion

### Listar predicciones disponibles

```
GET /api/v1/prediction/history/list
```

Respuesta:
```json
{
  "total": 5,
  "predictions": [
    {
      "file_id": 12,
      "filename": "prediccion_marzo_2026.parquet",
      "status": "active",
      "issued_at": "2026-03-01",
      "created_at": "2026-03-15T10:30:00",
      "is_current": true
    },
    {
      "file_id": 10,
      "filename": "prediccion_febrero_2026.parquet",
      "status": "archived",
      "issued_at": "2026-02-01",
      "created_at": "2026-02-14T09:00:00",
      "is_current": false
    }
  ]
}
```

### Obtener celdas CHIRPS

```
GET /api/v1/prediction/cells/{file_id}
```

Devuelve las 297 celdas unicas con sus coordenadas.

### Consulta 1D: Serie temporal por celda

```
POST /api/v1/prediction/timeseries
Content-Type: application/json

{
  "parquet_file_id": 12,
  "cell_id": "4.625000_-74.075000",
  "var": "SPI",
  "scale": 3
}
```

Respuesta: 12 horizontes con valor, q1, q3, iqr_min, iqr_max.

### Consulta 2D: Mapa espacial

```
POST /api/v1/prediction/spatial
Content-Type: application/json

{
  "parquet_file_id": 12,
  "var": "SPI",
  "scale": 3,
  "horizon": 6
}
```

Respuesta: 297 celdas con valor, color y categoria de sequia.

### Resumen IA

```
POST /api/v1/prediction/ai-summary
Content-Type: application/json

{
  "type": "1d",
  "index": "SPI",
  "scale": 3,
  "values": [-1.2, -0.8, -0.3, 0.1, 0.5, ...]
}
```

Genera un resumen en lenguaje natural usando Groq (Llama 3.1-8b-instant).

## Flujo de Consulta en el Frontend

### Prediccion Actual

1. El usuario abre la seccion "Prediccion Actual" en el sidebar
2. Se cargan las 297 celdas CHIRPS en el mapa automaticamente
3. El usuario selecciona indice, escala y tipo de visualizacion (1D/2D)
4. **1D**: Click en celda del mapa, se consulta `POST /prediction/timeseries`
5. **2D**: Se selecciona horizonte, se consulta `POST /prediction/spatial`
6. Las celdas del mapa se colorean segun categoria de sequia
7. Click en celda coloreada -> transicion automatica a vista 1D

### Historico de Predicciones

1. El usuario abre "Historico de Predicciones" en el sidebar
2. Se cargan las celdas CHIRPS (mismas 297 celdas para todos los archivos)
3. El selector desplegable muestra todas las predicciones por fecha de emision
4. El usuario selecciona una prediccion y configura indice/escala/tipo
5. La consulta se hace con el `file_id` del archivo historico seleccionado
6. Los mismos endpoints (`/prediction/timeseries`, `/prediction/spatial`) se usan
7. Los archivos archivados son accesibles para consulta (status `active` o `archived`)

## Categorias de Sequia

Los valores de los indices se categorizan automaticamente:

| Categoria | Color | Rango tipico (SPI/SPEI) |
|-----------|-------|------------------------|
| Sequia Excepcional | Rojo oscuro | < -2.0 |
| Sequia Extrema | Rojo | -2.0 a -1.6 |
| Sequia Severa | Naranja | -1.6 a -1.3 |
| Sequia Moderada | Amarillo | -1.3 a -0.8 |
| Anormalmente Seco | Beige | -0.8 a -0.5 |
| Normal | Verde | > -0.5 |

## Archivos Clave

### Backend
- `app/api/v1/endpoints/prediction.py` - Endpoints de prediccion + historico
- `app/api/v1/endpoints/prediction_schemas.py` - Schemas Pydantic
- `app/services/prediction_data_service.py` - Servicio DuckDB para consultas
- `app/api/v1/endpoints/admin_utils.py` - Schema del parquet y configuracion de datasets

### Frontend
- `src/components/sidebar/PredictionSection.js` - Panel de prediccion actual
- `src/components/sidebar/PredictionHistorySection.js` - Panel de historico
- `src/components/PredictionTimeSeriesChart.js` - Grafico Canvas con IQR
- `src/services/api.js` - Clientes `predictionApi` y `predictionHistoryApi`

## Ver Tambien

- [Guia de Endpoints](ENDPOINTS_GUIDE.md) - Matriz completa de endpoints
- [Flujos de Consulta](FLUJOS_CONSULTA.md) - Consultas 1D y 2D historicas
- [Gestion de Archivos](FILE_MANAGEMENT_GUIDE.md) - Upload y datasets
