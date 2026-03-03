# 📁 Guía: Gestión de Archivos .parquet en Cloudflare

## 🎯 Dos Formas de Trabajar con Archivos

### ✅ FORMA 1: Subir Archivos via API (Recomendado)

**Cuando subes archivos usando el endpoint de upload, TODO es automático:**

```bash
# Admin sube archivo
curl -X POST http://localhost:8000/api/v1/parquet/upload \
  -H "Authorization: Bearer TU_TOKEN" \
  -F "file=@mi_archivo.parquet"
```

**¿Qué pasa automáticamente?**
1. ✅ Archivo se sube a Cloudflare R2
2. ✅ Se registra en la base de datos
3. ✅ Se marca como `status="active"`
4. ✅ **Ya está disponible** para consultas en `/historical/*`
5. ✅ No necesitas hacer nada más!

### ✅ FORMA 2: Ya tienes archivos en Cloudflare

**Si subiste archivos manualmente a Cloudflare, necesitas sincronizarlos:**

#### Opción A: Script Interactivo (Más Fácil)

```bash
python scripts/manage_cloudflare_files.py
```

El script te mostrará un menú:
```
1. Ver archivos en CLOUDFLARE (todos los .parquet)
2. Ver archivos en BASE DE DATOS (disponibles para consultas)
3. SINCRONIZAR archivos (Cloudflare → Base de Datos)
4. Salir
```

**Flujo recomendado:**
1. Opción 1: Ver qué archivos tienes en Cloudflare
2. Opción 3: Sincronizar (registrarlos automáticamente)
3. Opción 2: Verificar que ya están disponibles

#### Opción B: API Directa

```bash
# 1. Login
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=admin@droughtmonitor.com&password=tu_password" \
  | jq -r '.access_token')

# 2. Ver archivos en Cloudflare
curl -X GET "http://localhost:8000/api/v1/admin/files/cloud/list" \
  -H "Authorization: Bearer $TOKEN"

# 3. Sincronizar automáticamente
curl -X POST "http://localhost:8000/api/v1/admin/files/cloud/sync" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Endpoints Disponibles

### Para Administradores

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/admin/files/cloud/list` | GET | Lista archivos en Cloudflare |
| `/admin/files/cloud/sync` | POST | Sincroniza Cloudflare → DB |
| `/admin/files/register-external` | POST | Registra archivo individual |
| `/parquet/upload` | POST | Sube archivo nuevo |

### Para Usuarios (Público)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/historical/files` | GET | Archivos disponibles |
| `/historical/timeseries` | POST | Consultar serie de tiempo |
| `/historical/spatial` | POST | Consultar datos espaciales |

---

## 🔄 Flujo Completo de Trabajo

### Escenario 1: Usuario Admin Sube Archivo Nuevo

```
1. Admin → POST /parquet/upload
   └─→ Archivo se sube a Cloudflare
   └─→ Se registra en DB automáticamente
   └─→ status = "active"
   └─→ ✅ YA DISPONIBLE para consultas

2. Frontend → GET /historical/files
   └─→ Ve el archivo nuevo inmediatamente

3. Frontend → POST /historical/timeseries
   └─→ Consulta datos del archivo
   └─→ ✅ FUNCIONA
```

### Escenario 2: Ya Tienes Archivos en Cloudflare

```
1. Archivos ya están en Cloudflare R2
   └─→ Subidos manualmente o por otro medio

2. Admin → python scripts/manage_cloudflare_files.py
   └─→ Opción 1: Ver archivos en Cloudflare
   └─→ Muestra cuáles NO están en DB

3. Admin → Opción 3: Sincronizar
   └─→ Se registran automáticamente en DB
   └─→ status = "active"
   └─→ ✅ YA DISPONIBLES

4. Frontend → GET /historical/files
   └─→ Ve todos los archivos
   
5. Frontend → POST /historical/timeseries
   └─→ ✅ FUNCIONA
```

---

## 🚀 Quick Start

### Si ya tienes archivos en Cloudflare:

```bash
# 1. Ejecuta el script
python scripts/manage_cloudflare_files.py

# 2. Ingresa credenciales de admin

# 3. Selecciona opción 1 (ver archivos)
# Verás algo como:
# ✅ ARCHIVOS REGISTRADOS (2)
#    └─ archivo1.parquet - ✓ YA DISPONIBLE
# ⚠️  ARCHIVOS NO REGISTRADOS (3)
#    └─ archivo2.parquet - ⚠ NECESITA sincronización

# 4. Selecciona opción 3 (sincronizar)
# Los archivos NO registrados se agregan automáticamente

# 5. ¡Listo! Ahora están disponibles para consultas
```

### Si vas a subir archivos nuevos:

```bash
# Simplemente usa el endpoint de upload
curl -X POST http://localhost:8000/api/v1/parquet/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@datos_bogota.parquet"

# ✅ Ya está disponible automáticamente!
```

---

## ❓ Preguntas Frecuentes

### ¿Debo correr un script cada vez que subo archivos?

**No!** Solo en dos casos:

1. **Ya tienes archivos en Cloudflare** que no están registrados
2. **Subiste archivos manualmente** (no via API)

Si usas el endpoint `/parquet/upload`, **todo es automático**.

### ¿Los archivos subidos quedan disponibles automáticamente?

**Sí!** Cuando usas `/parquet/upload`:
- ✅ Se registra en DB
- ✅ Se marca como activo
- ✅ Inmediatamente disponible en `/historical/*`

### ¿Qué pasa si tengo 50 archivos en Cloudflare?

Usa el script de sincronización:
```bash
python scripts/manage_cloudflare_files.py
```

Selecciona "Opción 3: Sincronizar" y **todos** los archivos .parquet se registrarán automáticamente.

### ¿Puedo ver qué archivos tengo antes de sincronizar?

**Sí!** Usa:
```bash
python scripts/manage_cloudflare_files.py
# Opción 1: Ver archivos en Cloudflare
```

Te mostrará:
- ✅ Archivos registrados (ya disponibles)
- ⚠️  Archivos no registrados (necesitan sync)

### ¿Hay límite de archivos?

No hay límite. Puedes tener:
- Múltiples resoluciones (0.25°, 0.1°, alta)
- Múltiples períodos
- Múltiples zonas geográficas

El sistema detecta automáticamente cuál usar según el `file_id` en las consultas.

---

## 🔧 Troubleshooting

### Error: "No se pueden listar archivos de Cloudflare"

**Verifica tu `.env`:**
```env
CLOUD_STORAGE_ENDPOINT=https://...
CLOUD_STORAGE_ACCESS_KEY=...
CLOUD_STORAGE_SECRET_KEY=...
CLOUD_STORAGE_BUCKET=drought-data
```

### Error: "Archivo ya existe"

El archivo ya está registrado. Usa:
```bash
GET /historical/files
```
Para ver archivos disponibles.

### ¿Cómo actualizar un archivo?

1. Sube el nuevo archivo con nombre diferente
2. Marca el viejo como inactivo:
```bash
DELETE /admin/files/{old_file_id}
```

---

## 📚 Ver También

- [HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md) - Guía completa de consultas
- [QUICKSTART.md](QUICKSTART.md) - Inicio rápido
- [scripts/manage_cloudflare_files.py](scripts/manage_cloudflare_files.py) - Script de gestión

---

## 💡 Resumen Ejecutivo

**Para empezar ahora:**

```bash
# 1. ¿Ya tienes archivos en Cloudflare?
python scripts/manage_cloudflare_files.py

# Selecciona:
# → Opción 1: Ver archivos
# → Opción 3: Sincronizar
# → ✅ ¡Listo!

# 2. Verifica que están disponibles
curl http://localhost:8000/api/v1/historical/files

# 3. Consulta datos
curl -X POST http://localhost:8000/api/v1/historical/timeseries \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "SPI",
    "start_date": "2020-01-01",
    "end_date": "2024-12-31",
    "lat": 4.6097,
    "lon": -74.0817
  }'
```

**¡Ya funciona!** 🎉
