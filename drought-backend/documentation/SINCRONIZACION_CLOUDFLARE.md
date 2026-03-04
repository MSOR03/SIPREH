# Sincronización Bidireccional: Base de Datos ↔ Cloudflare R2

## 🎯 Problema Resuelto

Antes había **inconsistencias** entre lo que estaba en la base de datos y lo que estaba en Cloudflare:
- ❌ Eliminabas de BD pero el archivo seguía en Cloudflare
- ❌ Eliminabas de Cloudflare pero seguía apareciendo en BD
- ❌ Subías a Cloudflare manualmente y tenías que registrar manualmente en BD

## ✅ Solución Implementada

### 1. **Eliminación Bidireccional**

Cuando eliminas un archivo desde la API, ahora se elimina de **AMBOS lados**:

```bash
DELETE /api/v1/admin/files/{file_id}?delete_from_cloud=true
```

**Comportamiento:**
- ✅ Elimina el registro de la base de datos
- ✅ Elimina el archivo físico de Cloudflare R2
- ✅ Retorna confirmación de ambas operaciones

**Parámetros:**
- `delete_from_cloud=true` (default): Elimina de BD + Cloudflare
- `delete_from_cloud=false`: Solo elimina de BD (útil si ya eliminaste manualmente de Cloudflare)

**Response:**
```json
{
  "success": true,
  "message": "File grid_ERA5.parquet deleted from database and Cloudflare R2",
  "deleted_from_cloud": true
}
```

---

### 2. **Sincronización Bidireccional Automática**

Endpoint mejorado que sincroniza **en ambas direcciones**:

```bash
POST /api/v1/admin/files/cloud/sync
Content-Type: application/json

{
  "prefix": "parquet/",
  "auto_activate": true,
  "bidirectional": true
}
```

**Qué hace:**

**📥 Cloudflare → BD (Registra nuevos archivos)**
- Lista todos los `.parquet` en Cloudflare
- Detecta cuáles NO están en la base de datos
- Los registra automáticamente con auto-detección de resolución

**📤 BD → Cloudflare (Limpia registros huérfanos)**
- Si `bidirectional=true`: Elimina de BD archivos que YA NO existen en Cloudflare
- Mantiene coherencia: solo archivos que realmente existen en Cloudflare están en BD

**Response:**
```json
{
  "success": true,
  "registered": 2,           // Archivos nuevos registrados desde Cloudflare
  "skipped": 1,              // Archivos que ya estaban en BD
  "deleted_from_db": 1,      // Registros eliminados de BD (no existen en Cloudflare)
  "errors": 0,
  "files": [
    {
      "filename": "grid_ERA5.parquet",
      "action": "registered",
      "file_id": 1,
      "resolution": "low (0.25°)",
      "size_mb": 30.5
    },
    {
      "filename": "grid_IMERG.parquet",
      "action": "skipped",
      "reason": "Ya existe en BD"
    },
    {
      "filename": "old_file.parquet",
      "action": "deleted_from_db",
      "file_id": 3,
      "reason": "No existe en Cloudflare"
    }
  ]
}
```

---

### 3. **Auto-detección de Resolución por Nombre de Archivo**

El sistema ahora **detecta automáticamente** la resolución basándose en el nombre del archivo:

| Nombre del Archivo | Nivel | Resolución | Descripción |
|-------------------|-------|------------|-------------|
| `grid_ERA5.parquet` | `low` | 0.25° | Baja resolución, más rápido |
| `grid_IMERG.parquet` | `medium` | 0.10° | Media resolución, balance |
| `grid_CHIRPS.parquet` | `high` | 0.05° | Alta resolución, más pesado |
| Otros archivos | `unknown` | 0.10° | Default si no se reconoce |

**Metadata enriquecida automáticamente:**
```json
{
  "resolution_level": "low",
  "resolution_degrees": 0.25,
  "auto_detected": true,
  "last_modified_cloud": "2024-01-15T10:30:00Z"
}
```

---

### 4. **Registro Manual con Auto-detección**

Cuando registras un archivo manualmente, ahora se auto-detecta la resolución:

```bash
POST /api/v1/admin/files/register-external
Content-Type: application/json

{
  "filename": "grid_ERA5.parquet",
  "cloud_url": "https://endpoint/bucket/parquet/grid_ERA5.parquet",
  "description": "Datos históricos ERA5"
}
```

**El sistema automáticamente:**
- ✅ Detecta que es `ERA5` → resolución baja (0.25°)
- ✅ Extrae metadatos de Cloudflare (tamaño, fecha de modificación)
- ✅ Calcula `cloud_key` desde la URL
- ✅ Enriquece metadata con información de resolución

**Response:**
```json
{
  "id": 1,
  "filename": "grid_ERA5.parquet",
  "cloud_key": "parquet/grid_ERA5.parquet",
  "cloud_url": "https://...",
  "file_size": 32000000,
  "file_metadata": "{\"resolution_level\": \"low\", \"resolution_degrees\": 0.25, \"auto_detected\": true, ...}",
  "status": "active"
}
```

---

## 🚀 Flujos de Trabajo Recomendados

### Flujo 1: Subir un nuevo archivo

```bash
# 1. Sube el archivo a Cloudflare R2 manualmente
#    Nombre: grid_IMERG.parquet
#    Ubicación: parquet/grid_IMERG.parquet

# 2. Sincroniza automáticamente
curl -X POST http://localhost:8000/api/v1/admin/files/cloud/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "parquet/",
    "auto_activate": true,
    "bidirectional": true
  }'

# Resultado: El archivo se registra automáticamente con resolución 0.10° detectada
```

### Flujo 2: Eliminar un archivo

```bash
# Elimina el archivo de BD + Cloudflare en una sola operación
curl -X DELETE http://localhost:8000/api/v1/admin/files/3?delete_from_cloud=true \
  -H "Authorization: Bearer YOUR_TOKEN"

# Resultado: Eliminado de ambos lados, coherencia garantizada
```

### Flujo 3: Limpiar registros huérfanos

Si eliminaste archivos desde Cloudflare manualmente, limpia la BD:

```bash
curl -X POST http://localhost:8000/api/v1/admin/files/cloud/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "parquet/",
    "bidirectional": true
  }'

# Resultado: Registros de archivos que no existen en Cloudflare son eliminados de BD
```

### Flujo 4: Ver qué archivos están en Cloudflare

```bash
curl -X GET http://localhost:8000/api/v1/admin/files/cloud/list?prefix=parquet/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "total": 3,
  "bucket": "drought-data",
  "files": [
    {
      "key": "parquet/grid_ERA5.parquet",
      "filename": "grid_ERA5.parquet",
      "size_mb": 30.5,
      "last_modified": "2024-01-15T10:30:00Z",
      "cloud_url": "https://...",
      "registered": true,
      "file_id": 1
    },
    {
      "key": "parquet/grid_IMERG.parquet",
      "filename": "grid_IMERG.parquet",
      "size_mb": 6.2,
      "last_modified": "2024-01-16T14:20:00Z",
      "cloud_url": "https://...",
      "registered": true,
      "file_id": 2
    },
    {
      "key": "parquet/grid_CHIRPS.parquet",
      "filename": "grid_CHIRPS.parquet",
      "size_mb": 130.8,
      "last_modified": "2024-01-17T09:15:00Z",
      "cloud_url": "https://...",
      "registered": false,    // ← No está en BD
      "file_id": null
    }
  ]
}
```

---

## 📋 Convenciones de Nombres de Archivo

Para aprovechar la auto-detección de resolución, usa estos nombres:

### ✅ Nombres Recomendados

```
grid_ERA5.parquet          → Baja resolución (0.25°)
grid_IMERG.parquet         → Media resolución (0.10°)  
grid_CHIRPS.parquet        → Alta resolución (0.05°)
```

### ⚠️ Variaciones Aceptadas

El sistema detecta por contenido del nombre (case-insensitive):

```
Grid_ERA5_v2.parquet       → "era5" detectado → Baja (0.25°)
colombia_IMERG_2024.parquet → "imerg" detectado → Media (0.10°)
CHIRPS_daily.parquet       → "chirps" detectado → Alta (0.05°)
other_data.parquet         → No reconocido → Default (0.10°)
```

---

## 🔧 Endpoints Disponibles

### Gestión de Archivos

| Endpoint | Método | Descripción | Sincronización |
|----------|--------|-------------|----------------|
| `/admin/files` | GET | Listar archivos en BD | - |
| `/admin/files/{id}` | GET | Ver detalles de un archivo | - |
| `/admin/files/{id}` | DELETE | **Eliminar archivo** | ✅ BD + Cloudflare |
| `/admin/files/{id}/activate` | POST | Activar archivo | - |
| `/admin/files/register-external` | POST | **Registrar archivo manual** | ✅ Auto-detección |
| `/admin/files/cloud/list` | GET | Listar archivos en Cloudflare | - |
| `/admin/files/cloud/sync` | POST | **Sincronización bidireccional** | ✅ BD ↔ Cloudflare |

### Parámetros Clave

**DELETE `/admin/files/{id}`:**
- `delete_from_cloud=true`: Elimina de BD + Cloudflare (default)
- `delete_from_cloud=false`: Solo elimina de BD

**POST `/admin/files/cloud/sync`:**
- `prefix="parquet/"`: Carpeta a sincronizar
- `auto_activate=true`: Marca archivos nuevos como activos
- `bidirectional=true`: Elimina de BD archivos que no existen en Cloudflare

---

## ✅ Verificación de Coherencia

Para verificar que todo está sincronizado:

```bash
# 1. Ver archivos en Cloudflare
curl -X GET http://localhost:8000/api/v1/admin/files/cloud/list

# 2. Ver archivos en BD
curl -X GET http://localhost:8000/api/v1/admin/files

# 3. Sincronizar si hay diferencias
curl -X POST http://localhost:8000/api/v1/admin/files/cloud/sync \
  -d '{"bidirectional": true}'
```

---

## 🎓 Mejores Prácticas

1. **Usa nombres estandarizados**: `grid_ERA5.parquet`, `grid_IMERG.parquet`, `grid_CHIRPS.parquet`
   - Auto-detección de resolución funciona automáticamente
   - Metadata enriquecida sin intervención manual

2. **Ejecuta sync regularmente**:
   ```bash
   POST /admin/files/cloud/sync?bidirectional=true
   ```
   - Mantiene coherencia entre BD y Cloudflare
   - Registra archivos nuevos automáticamente
   - Limpia registros huérfanos

3. **Siempre elimina con `delete_from_cloud=true`**:
   - Evita archivos huérfanos en Cloudflare
   - Una sola operación limpia todo

4. **Verifica con `/cloud/list` antes de eliminar manualmente**:
   - Confirma qué archivos están registrados
   - Evita eliminar archivos en uso

---

## 🐛 Resolución de Problemas

### Problema: "Archivo eliminado de BD pero sigue en Cloudflare"

**Solución:**
```bash
# Opción 1: Eliminar nuevamente con delete_from_cloud=true
curl -X DELETE /api/v1/admin/files/3?delete_from_cloud=true

# Opción 2: Ver archivos en Cloudflare y eliminar manualmente
curl -X GET /api/v1/admin/files/cloud/list
# Luego eliminar desde Cloudflare R2 console o AWS CLI
```

### Problema: "Archivo eliminado de Cloudflare pero sigue en BD"

**Solución:**
```bash
# Sincronizar con bidirectional=true
curl -X POST /api/v1/admin/files/cloud/sync \
  -d '{"bidirectional": true}'
# Resultado: Registros huérfanos eliminados automáticamente
```

### Problema: "Nuevo archivo en Cloudflare no aparece en BD"

**Solución:**
```bash
# Sincronizar para registrar archivos nuevos
curl -X POST /api/v1/admin/files/cloud/sync \
  -d '{"auto_activate": true}'
```

### Problema: "Resolución detectada incorrectamente"

**Solución:**
- Renombra el archivo para incluir: `ERA5`, `IMERG`, o `CHIRPS`
- O actualiza metadata manualmente después de registro

---

## 📊 Resumen de Cambios

| Antes | Ahora |
|-------|-------|
| Eliminar de BD no afectaba Cloudflare | ✅ DELETE elimina de ambos lados |
| Archivos en Cloudflare requerían registro manual | ✅ Sync automático registra nuevos archivos |
| Archivos eliminados de Cloudflare seguían en BD | ✅ Sync bidireccional limpia huérfanos |
| Resolución manual en metadata | ✅ Auto-detección por nombre de archivo |
| Fecha/tamaño desconocidos | ✅ Extraídos de Cloudflare automáticamente |

---

## 🎉 Conclusión

El sistema ahora mantiene **coherencia automática** entre base de datos y Cloudflare:
- ✅ Sincronización bidireccional
- ✅ Auto-detección de resolución
- ✅ Metadata enriquecida desde Cloudflare
- ✅ Eliminación coordinada
- ✅ Una sola fuente de verdad

**Usa sync regularmente para mantener todo sincronizado:**
```bash
POST /api/v1/admin/files/cloud/sync?bidirectional=true
```
