# ❓ Preguntas Frecuentes - Gestión de Archivos

## 1. ¿Debo correr el script para ver qué archivos hay en Cloudflare?

### Respuesta Corta: **Solo si ya tienes archivos allí**

### Explicación Detallada:

**SI ya tienes archivos en Cloudflare R2:**
```bash
# Sí, usa el script para verlos y sincronizarlos
python scripts/manage_cloudflare_files.py
```

El script te mostrará:
- ✅ Archivos que ya están en Cloudflare
- ✅ Cuáles están registrados en la base de datos
- ⚠️  Cuáles necesitan ser sincronizados

**SI vas a subir archivos nuevos:**
```bash
# No necesitas el script, usa el endpoint de upload
curl -X POST http://localhost:8000/api/v1/parquet/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@mi_archivo.parquet"

# El archivo se registra AUTOMÁTICAMENTE
```

---

## 2. ¿Si ya tengo los archivos en Cloudflare, qué hago?

### Respuesta: **Sincronízalos con un click**

```bash
python scripts/manage_cloudflare_files.py
```

**Flujo:**
1. El script conecta a Cloudflare
2. Lista todos los archivos .parquet
3. Compara con la base de datos
4. Te muestra cuáles faltan registrar
5. Con "Opción 3" los registra automáticamente

**Resultado:**
- ✅ Archivos registrados en la base de datos
- ✅ Marcados como `status="active"`
- ✅ Disponibles inmediatamente para consultas en `/historical/*`

---

## 3. ¿Cuando un usuario sube un archivo, queda automáticamente funcional para el dashboard?

### Respuesta: **SÍ, totalmente automático** ✅

### Flujo Automático:

```
Usuario Admin sube archivo:
POST /api/v1/parquet/upload

      ↓ (automático)

1. Archivo → Cloudflare R2
2. Registro → Base de datos
3. Status → "active"
4. Cloud URL → Configurado

      ↓ (inmediato)

✅ YA DISPONIBLE para:
   • GET /historical/files
   • POST /historical/timeseries
   • POST /historical/spatial
```

### Ejemplo Práctico:

```bash
# T=0: Admin sube archivo
curl -X POST http://localhost:8000/api/v1/parquet/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@bogota_drought_2024.parquet"

# Respuesta:
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "id": 5,
    "filename": "bogota_drought_2024.parquet",
    "cloud_url": "https://...",
    "status": "active"  ← ✅ YA ACTIVO
  }
}

# T=1 segundo: Frontend consulta archivos disponibles
curl http://localhost:8000/api/v1/historical/files

# Respuesta incluye el archivo INMEDIATAMENTE:
[
  {
    "file_id": 5,
    "filename": "bogota_drought_2024.parquet",
    ...
  }
]

# T=2 segundos: Frontend consulta datos
curl -X POST http://localhost:8000/api/v1/historical/timeseries \
  -d '{
    "parquet_file_id": 5,  ← Usa el archivo recién subido
    "variable": "SPI",
    ...
  }'

# ✅ FUNCIONA INMEDIATAMENTE
```

### ¿Necesito hacer algo adicional?

**NO.** Cuando usas el endpoint de upload:
- ❌ No necesitas registrar manualmente
- ❌ No necesitas marcar como activo
- ❌ No necesitas configurar URLs
- ❌ No necesitas correr scripts
- ✅ **Todo es automático**

---

## 4. ¿Cuál es la diferencia entre los métodos?

### Comparación:

| Método | Cuándo Usar | Automático | Requiere Script |
|--------|-------------|------------|-----------------|
| **Upload API** | Subir archivos nuevos | ✅ 100% | ❌ No |
| **Sincronización** | Ya tienes archivos en Cloudflare | ⚠️  Semi | ✅ Sí |
| **Registro Manual** | Conoces URL exacta | ❌ No | ✅ Opcional |

### Upload API (Recomendado):
```bash
POST /parquet/upload
→ Archivo nuevo
→ TODO automático
→ ✅ Listo en 1 segundo
```

### Sincronización:
```bash
python scripts/manage_cloudflare_files.py
→ Archivos ya existentes
→ Se registran automáticamente
→ ✅ Listo en 1 click
```

### Registro Manual:
```bash
POST /admin/files/register-external
→ URL específica conocida
→ Registro individual
→ ✅ Control total
```

---

## 5. Flujo de Trabajo Completo

### Para Desarrollo/Testing:

```bash
# Día 1: Subir archivos de prueba
curl -X POST http://localhost:8000/api/v1/parquet/upload \
  -F "file=@datos_test.parquet"

# ✅ Ya disponible

# Día 2: Probar consultas
curl http://localhost:8000/api/v1/historical/files  # Ver archivos
curl -X POST .../timeseries  # Consultar datos

# ✅ Funciona inmediatamente
```

### Para Producción (con archivos existentes):

```bash
# Paso 1: Sincronizar archivos existentes (UNA SOLA VEZ)
python scripts/manage_cloudflare_files.py
# → Opción 3: Sincronizar

# ✅ Archivos registrados

# Paso 2: Para archivos nuevos, usar upload
POST /parquet/upload

# ✅ Automático desde ahora

# Paso 3: Frontend consulta
GET /historical/files
POST /historical/timeseries

# ✅ Todo funciona
```

---

## 6. Verificación Rápida

### ¿Cómo sé que mis archivos están disponibles?

```bash
# 1. Ver archivos registrados
curl http://localhost:8000/api/v1/historical/files

# Debe mostrar tus archivos con:
# - file_id
# - filename
# - date_range (si ya consultó metadata)
# - spatial_bounds (si ya consultó metadata)

# 2. Intentar consulta
curl -X POST http://localhost:8000/api/v1/historical/timeseries \
  -H "Content-Type: application/json" \
  -d '{
    "parquet_file_id": 1,
    "variable": "SPI",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "lat": 4.6,
    "lon": -74.0
  }'

# Si funciona:
# ✅ Archivo disponible y funcional

# Si error "File not found":
# ⚠️  Archivo no registrado → usar sincronización
```

---

## 💡 Resumen Ejecutivo

### Pregunta 1: ¿Necesito script para ver archivos en Cloudflare?
**Respuesta:** Solo si ya los tienes allí. Usa `manage_cloudflare_files.py`

### Pregunta 2: ¿Archivos subidos quedan automáticos?
**Respuesta:** SÍ, 100% automático cuando usas `/parquet/upload`

### Flujo Ideal:
1. Primera vez: Sincroniza archivos existentes (si los hay)
2. Día a día: Usa `/parquet/upload` para nuevos archivos
3. Todo funciona automáticamente ✅

---

## 📚 Más Información

- [FILE_MANAGEMENT_GUIDE.md](FILE_MANAGEMENT_GUIDE.md) - Guía completa
- [scripts/README.md](scripts/README.md) - Documentación de scripts
- [QUICKSTART.md](QUICKSTART.md) - Inicio rápido
