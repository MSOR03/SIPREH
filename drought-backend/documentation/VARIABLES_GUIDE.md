# 📊 Variables y Columnas - Catálogo vs Detección Automática

## ❓ Tu Pregunta: ¿Las variables vienen de los .parquet o están fijas para el GET?

### Respuesta: **AMBAS OPCIONES** ✅

He implementado un **sistema híbrido** que te da lo mejor de ambos mundos:

---

## 🎯 Opción 1: Catálogo FIJO (Rápido)

### ¿Cuándo usar?
- Consulta rápida de variables documentadas
- No necesitas leer el archivo
- Quieres ver qué variables soporta el sistema

### Endpoints:

```bash
# Variables hidrometeorológicas (catálogo fijo)
GET /api/v1/historical/catalog/variables

# Índices de sequía (catálogo fijo)
GET /api/v1/historical/catalog/drought-indices

# Todas las variables (catálogo fijo)
GET /api/v1/historical/catalog/all
```

### Ejemplo:

```bash
curl http://localhost:8000/api/v1/historical/catalog/all
```

**Respuesta:**
```json
{
  "total": 11,
  "items": [
    {
      "id": "precip",
      "name": "Precipitación",
      "unit": "mm",
      "category": "meteorological",
      "source": "catalog",  ← Viene del catálogo fijo
      "available": true
    },
    {
      "id": "SPI",
      "name": "SPI",
      "unit": "adimensional",
      "category": "meteorological",
      "source": "catalog",  ← Viene del catálogo fijo
      "supports_prediction": true
    },
    ...
  ]
}
```

### ⚡ Ventajas:
- ✅ **Súper rápido** (~5ms)
- ✅ No necesita leer el .parquet
- ✅ Documentación consistente
- ✅ Nombres bonitos y unidades

### ⚠️ Limitaciones:
- ❌ No sabe si TU archivo tiene esas columnas
- ❌ No detecta columnas adicionales

---

## 🔍 Opción 2: Detección AUTOMÁTICA (Precisión)

### ¿Cuándo usar?
- Quieres ver QUÉ columnas tiene TU archivo específico
- Verificar antes de hacer consultas
- Descubrir columnas adicionales

### Endpoints NUEVOS:

```bash
# Ver columnas reales de un archivo
GET /api/v1/historical/files/{file_id}/columns

# Validar estructura de un archivo
GET /api/v1/historical/files/{file_id}/validate
```

### Ejemplo 1: Ver Columnas Reales

```bash
curl http://localhost:8000/api/v1/historical/files/1/columns
```

**Respuesta:**
```json
{
  "file_id": 1,
  "filename": "bogota_drought.parquet",
  "metadata_columns": [
    {
      "name": "date",
      "type": "date32[day]",
      "source": "detected",  ← Leído del archivo real
      "in_catalog": false
    },
    {
      "name": "lat",
      "type": "double",
      "source": "detected",
      "in_catalog": false
    }
  ],
  "data_columns": [
    {
      "name": "precip",
      "type": "double",
      "source": "detected",  ← Leído del archivo real
      "display_name": "Precipitación",
      "unit": "mm",
      "category": "meteorological",
      "in_catalog": true  ← Reconocida en el catálogo
    },
    {
      "name": "SPI",
      "type": "double",
      "source": "detected",
      "display_name": "SPI",
      "unit": "adimensional",
      "in_catalog": true
    },
    {
      "name": "custom_index",  ← Columna NO en el catálogo
      "type": "double",
      "source": "detected",
      "in_catalog": false  ← NO reconocida
    }
  ],
  "summary": {
    "total_columns": 15,
    "data_columns": 12,
    "metadata_columns": 3,
    "in_catalog": 11,
    "unknown": 1  ← 1 columna desconocida
  }
}
```

### Ejemplo 2: Validar Estructura

```bash
curl http://localhost:8000/api/v1/historical/files/1/validate
```

**Respuesta:**
```json
{
  "file_id": 1,
  "filename": "bogota_drought.parquet",
  "valid": true,
  "errors": [],
  "warnings": [
    "Columnas no reconocidas en el catálogo: custom_index"
  ],
  "info": [
    "Columnas reconocidas: precip, tmean, tmin, tmax, pet, balance, SPI, SPEI, RAI, EDDI, PDSI"
  ]
}
```

### ⚡ Ventajas:
- ✅ **Precisión 100%** - Lee tu archivo real
- ✅ Detecta columnas adicionales
- ✅ Verifica estructura antes de consultar
- ✅ Descubre qué puedes consultar

### ⚠️ Consideraciones:
- ⏱️ Más lento (~200-500ms primera vez, luego caché)
- 📁 Necesita descargar el archivo

---

## 📋 Comparación

| Característica | Catálogo Fijo | Detección Automática |
|----------------|---------------|----------------------|
| **Endpoint** | `GET /catalog/*` | `GET /files/{id}/columns` |
| **Fuente** | Código (hardcoded) | Archivo .parquet real |
| **Velocidad** | ⚡ ~5ms | ⏱️ ~200ms (cacheado: ~50ms) |
| **Precisión** | Genérica | 100% específica |
| **Detecta columnas extras** | ❌ No | ✅ Sí |
| **Cuándo usar** | Vista general | Antes de consultar |

---

## 🚀 Flujo de Trabajo Recomendado

### Escenario 1: Desarrollo/Testing

```bash
# 1. Ver catálogo general (rápido)
GET /catalog/all
→ "Ah, el sistema soporta SPI, SPEI, precip..."

# 2. Subir tu archivo
POST /parquet/upload

# 3. Ver QUÉ tiene TU archivo específico
GET /files/1/columns
→ "Mi archivo tiene: precip, SPI, SPEI, y también custom_var"

# 4. Validar que está bien
GET /files/1/validate
→ "✅ Válido, warning: 1 columna desconocida"

# 5. Consultar datos
POST /historical/timeseries
→ Usa cualquier columna detectada
```

### Escenario 2: Producción - Frontend

```javascript
// 1. Cargar catálogo para UI (menús)
const catalog = await fetch('/catalog/all');
// Mostrar en Menu (1) y Menu (2)

// 2. Cuando usuario selecciona archivo
const selectedFile = 1;

// 3. Verificar columnas reales disponibles
const fileColumns = await fetch(`/files/${selectedFile}/columns`);

// 4. Actualizar UI con columnas reales
// Si el archivo tiene columnas extras, mostrarlas también

// 5. Usuario hace consulta
const data = await fetch('/timeseries', {
  body: {
    parquet_file_id: selectedFile,
    variable: 'SPI',  // ← Validado que existe
    ...
  }
});
```

---

## 🎓 Escenarios de Uso

### Caso 1: Archivo Estándar

Tu archivo tiene exactamente las columnas del catálogo:
```
date, lat, lon, precip, tmean, SPI, SPEI, ...
```

**Puedes usar:**
- `GET /catalog/*` para menús
- No necesitas verificar columnas
- Todo funciona automáticamente ✅

### Caso 2: Archivo con Columnas Extras

Tu archivo tiene columnas adicionales:
```
date, lat, lon, precip, SPI, SPEI, custom_drought_index, my_variable
```

**Debes usar:**
- `GET /files/{id}/columns` para detectarlas
- Puedes consultar las columnas extras
- El sistema las acepta (aunque no las conozca)

**Ejemplo:**
```bash
# Consultar columna custom que no está en el catálogo
POST /historical/timeseries
{
  "parquet_file_id": 1,
  "variable": "custom_drought_index",  ← No está en catálogo pero existe en archivo
  ...
}
# ✅ FUNCIONA - El sistema consulta cualquier columna del archivo
```

### Caso 3: Archivo con Columnas Faltantes

Tu archivo NO tiene alguna variable del catálogo:
```
date, lat, lon, precip, tmean
(falta: SPI, SPEI, ...)
```

**Necesitas:**
- `GET /files/{id}/columns` para ver qué falta
- `GET /files/{id}/validate` para advertencias
- Solo puedes consultar columnas que existen

---

## 💡 Resumen Ejecutivo

### Tu Pregunta Original:
> ¿Las variables vienen de los .parquet o están fijas para el GET?

### Respuesta:
**AMBAS:**

1. **`GET /catalog/*`** → Variables FIJAS del catálogo
   - Rápido
   - Para documentación
   - No lee el .parquet

2. **`GET /files/{id}/columns`** → Variables REALES del .parquet
   - Lee el archivo
   - 100% preciso
   - Detecta todo

### Mejor Práctica:

```bash
# Para UI/Menús (rápido)
GET /catalog/all

# Antes de consultar (validar)
GET /files/1/columns
GET /files/1/validate

# Consultar datos (usar columnas validadas)
POST /timeseries
```

---

## 🔧 Testing

```bash
# 1. Ver catálogo fijo
curl http://localhost:8000/api/v1/historical/catalog/all

# 2. Ver columnas de archivo real (file_id=1)
curl http://localhost:8000/api/v1/historical/files/1/columns

# 3. Validar estructura
curl http://localhost:8000/api/v1/historical/files/1/validate

# 4. Comparar ambos resultados
# Catálogo: lo que el sistema conoce
# Columns: lo que tu archivo realmente tiene
```

---

## 📚 Ver También

- [HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md) - Guía completa
- [FAQ.md](FAQ.md) - Preguntas frecuentes
- [QUICKSTART.md](QUICKSTART.md) - Inicio rápido
