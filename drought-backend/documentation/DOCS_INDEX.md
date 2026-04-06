# Índice completo de documentación

Este archivo lista TODA la documentación disponible en el proyecto DroughtMonitor Backend.

## 🎯 Navegación rápida

| Tarea | Documento | Link |
|-------|-----------|------|
| **Empezar desde cero** | Quick Start | [QUICKSTART.md](QUICKSTART.md) |
| **Tengo un problema** | FAQ | [FAQ.md](FAQ.md) |
| **¿Qué endpoint usar?** | Matriz de Endpoints | [ENDPOINTS_GUIDE.md](ENDPOINTS_GUIDE.md) |
| **Hacer consultas de datos** | Flujos 1D/2D | [FLUJOS_CONSULTA.md](FLUJOS_CONSULTA.md) |
| **Subir/gestionar archivos** | Gestión de archivos | [FILE_MANAGEMENT_GUIDE.md](FILE_MANAGEMENT_GUIDE.md) |
| **Sincronizar con Cloudflare** | Sync Cloudflare | [SINCRONIZACION_CLOUDFLARE.md](SINCRONIZACION_CLOUDFLARE.md) |
| **Entender arquitectura** | Arquitectura | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| **Ver variables disponibles** | Catalogo de variables | [VARIABLES_GUIDE.md](VARIABLES_GUIDE.md) |
| **Sistema de prediccion** | Prediccion y historico | [PREDICTION_GUIDE.md](PREDICTION_GUIDE.md) |
| **Copy-paste codigo** | Respuestas rapidas | [RESPUESTAS_RAPIDAS.md](RESPUESTAS_RAPIDAS.md) |
| **Detalles técnicos DuckDB** | Guía DuckDB | [HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md) |

---

## 📂 Documentación por categoría

### 🚀 Instalación y configuración
1. **[README.md](../README.md)** - Documentación principal del proyecto
2. **[QUICKSTART.md](QUICKSTART.md)** - Instalación y configuración inicial
3. **[FAQ.md](FAQ.md)** - Preguntas frecuentes y troubleshooting

### 📊 Uso de la API
4. **[ENDPOINTS_GUIDE.md](ENDPOINTS_GUIDE.md)** - Matriz completa de endpoints
5. **[FLUJOS_CONSULTA.md](FLUJOS_CONSULTA.md)** - Flujos 1D (timeseries) y 2D (mapas)
6. **[RESPUESTAS_RAPIDAS.md](RESPUESTAS_RAPIDAS.md)** - Ejemplos codigo copy-paste

### 🔮 Prediccion
7. **[PREDICTION_GUIDE.md](PREDICTION_GUIDE.md)** - Sistema de prediccion, historico y flujo completo

### 📁 Gestion de datos
8. **[FILE_MANAGEMENT_GUIDE.md](FILE_MANAGEMENT_GUIDE.md)** - Upload, registro, gestion archivos
9. **[SINCRONIZACION_CLOUDFLARE.md](SINCRONIZACION_CLOUDFLARE.md)** - Sync BD ↔ Cloudflare R2
10. **[VARIABLES_GUIDE.md](VARIABLES_GUIDE.md)** - Variables climaticas disponibles

### 🏗️ Arquitectura tecnica
11. **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Diseno general del sistema
12. **[HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md)** - Sistema DuckDB completo
13. **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Resumen de implementacion

### 📜 Otros documentos
13. **[REQUERIMIENTOS_VALIDACION.md](../../drought-frontend/docs/REQUERIMIENTOS_VALIDACION.md)** - Validación de requerimientos (frontend)
14. **[documents/](../documents/)** - Carpeta con documentos adicionales

---

## 📖 Descripción de cada documento

### 1. README.md
**Propósito**: Punto de entrada principal del proyecto.  
**Contenido**:
- Características principales
- Quick start (instalación rápida)
- Configuración (.env)
- API endpoints organizados por categoría
- Ejemplos de uso
- Performance benchmarks
- Índice de toda la documentación

**¿Cuándo leer?**: Siempre primero. Es tu punto de partida.

---

### 2. QUICKSTART.md
**Propósito**: Puesta en marcha rápida del proyecto.  
**Contenido**:
- Instalación paso a paso (Windows/Linux/Mac)
- Configuración de variables de entorno
- Inicialización de base de datos
- Primer uso de la API
- Verificación de instalación

**¿Cuándo leer?**: Al instalar el proyecto por primera vez.

---

### 3. FAQ.md
**Propósito**: Solución rápida a problemas comunes.  
**Contenido**:
- Errores de conexión a base de datos
- Problemas con Cloudflare R2
- Errores en queries de parquet
- Performance issues
- Troubleshooting general

**¿Cuándo leer?**: Cuando encuentres un error o problema.

---

### 4. ENDPOINTS_GUIDE.md 🆕
**Propósito**: Guía definitiva para elegir el endpoint correcto.  
**Contenido**:
- Matriz de decisión (¿qué endpoint usar?)
- Endpoints duplicados y sus diferencias
- `/historical/*` vs `/drought/*` (cuándo usar cuál)
- Performance comparisons
- Ejemplos comparativos
- Cheat sheet de decisiones rápidas

**¿Cuándo leer?**: 
- Antes de implementar consultas de datos
- Cuando no sepas qué endpoint usar
- Para optimizar queries existentes

**Destacado**: Este documento es CLAVE para evitar usar endpoints lentos cuando hay alternativas rápidas.

---

### 5. FLUJOS_CONSULTA.md
**Propósito**: Flujos completos de consulta 1D (timeseries) y 2D (mapas).  
**Contenido**:
- Flujo 1D: Serie temporal de celda única
- Flujo 2D: Mapa espacial con zoom de 3 niveles
- Ejemplos con JavaScript/Python
- Frontend integration
- Manejo de estados de zoom

**¿Cuándo leer?**: Al implementar visualizaciones de datos históricos.

---

### 6. RESPUESTAS_RAPIDAS.md
**Propósito**: Código copy-paste para tareas comunes.  
**Contenido**:
- Ejemplos de autenticación
- Consultas timeseries
- Consultas espaciales
- Upload de archivos
- Sync con Cloudflare
- Exportación de datos

**¿Cuándo leer?**: Cuando necesites código rápido sin leer toda la documentación.

---

### 7. FILE_MANAGEMENT_GUIDE.md
**Propósito**: Gestión completa de archivos parquet.  
**Contenido**:
- Upload de archivos locales
- Registro de archivos en Cloudflare
- Listar y filtrar archivos
- Activar/desactivar archivos
- Eliminar archivos (BD + cloud)
- Metadata y columnas

**¿Cuándo leer?**: Al trabajar con gestión de archivos parquet.

---

### 8. SINCRONIZACION_CLOUDFLARE.md
**Propósito**: Sincronización bidireccional BD ↔ Cloudflare R2.  
**Contenido**:
- Flujo de sincronización automática
- Registro de archivos externos
- Eliminación coordinada
- Auto-detección de metadata
- Troubleshooting sync

**¿Cuándo leer?**: Al configurar almacenamiento en nube o sincronizar datos.

---

### 9. VARIABLES_GUIDE.md
**Propósito**: Catálogo de variables climáticas.  
**Contenido**:
- Variables hidrometeorológicas (precip, temp, ET, caudal)
- Índices de sequía (SPI, SPEI, PDSI, etc.)
- Unidades y descripciones
- Disponibilidad por dataset

**¿Cuándo leer?**: Para saber qué variables puedes consultar.

---

### 10. ARCHITECTURE.md
**Propósito**: Diseño general del sistema.  
**Contenido**:
- Componentes principales
- Flujo de datos
- Servicios y capas
- Patrones de diseño
- Decisiones arquitectónicas

**¿Cuándo leer?**: Para entender la estructura general antes de contribuir código.

---

### 11. HISTORICAL_DATA_GUIDE.md
**Propósito**: Documentación técnica completa del sistema DuckDB.  
**Contenido**:
- Arquitectura del servicio histórico
- Cómo funciona DuckDB
- Auto-detección de formatos (long/wide)
- Auto-detección de columnas de fecha
- Performance optimization
- Caché strategies
- Benchmarks detallados

**¿Cuándo leer?**: 
- Para entender cómo funciona el sistema de queries
- Al optimizar performance
- Al extender funcionalidad de consultas

---

### 12. IMPLEMENTATION_SUMMARY.md
**Propósito**: Resumen de la implementación realizada.  
**Contenido**:
- Features implementadas
- Cambios realizados
- Próximos pasos
- Notas de implementación

**¿Cuándo leer?**: Para ver qué se ha implementado y qué falta.

---

## 🎓 Rutas de aprendizaje

### Ruta 1: Usuario nuevo (quiero empezar)
```
1. README.md (overview)
   ↓
2. QUICKSTART.md (instalación)
   ↓
3. ENDPOINTS_GUIDE.md (qué endpoints usar)
   ↓
4. FLUJOS_CONSULTA.md (hacer consultas)
```

### Ruta 2: Desarrollador frontend (integrar API)
```
1. README.md (section "API Endpoints")
   ↓
2. ENDPOINTS_GUIDE.md (elegir endpoints correctos)
   ↓
3. FLUJOS_CONSULTA.md (ejemplos JS)
   ↓
4. RESPUESTAS_RAPIDAS.md (código copy-paste)
```

### Ruta 3: Administrador (gestionar datos)
```
1. QUICKSTART.md (configuración)
   ↓
2. FILE_MANAGEMENT_GUIDE.md (gestión archivos)
   ↓
3. SINCRONIZACION_CLOUDFLARE.md (sync cloud)
   ↓
4. FAQ.md (troubleshooting)
```

### Ruta 4: Desarrollador backend (contribuir)
```
1. ARCHITECTURE.md (diseño general)
   ↓
2. HISTORICAL_DATA_GUIDE.md (sistema DuckDB)
   ↓
3. ENDPOINTS_GUIDE.md (estructura endpoints)
   ↓
4. IMPLEMENTATION_SUMMARY.md (estado actual)
```

### Ruta 5: Data scientist (analizar datos)
```
1. VARIABLES_GUIDE.md (qué variables hay)
   ↓
2. ENDPOINTS_GUIDE.md (endpoints de análisis)
   ↓
3. FLUJOS_CONSULTA.md (timeseries/spatial)
   ↓
4. HISTORICAL_DATA_GUIDE.md (detalles técnicos)
```

---

## 🔍 Búsqueda de temas

### Autenticación y seguridad
- [README.md](../README.md) - Sección "Autenticación"
- [QUICKSTART.md](QUICKSTART.md) - Configuración JWT
- [RESPUESTAS_RAPIDAS.md](RESPUESTAS_RAPIDAS.md) - Ejemplos login

### Base de datos
- [README.md](../README.md) - Sección "Configuración"
- [QUICKSTART.md](QUICKSTART.md) - Inicialización BD
- [FAQ.md](FAQ.md) - Errores de conexión

### Cloudflare R2
- [SINCRONIZACION_CLOUDFLARE.md](SINCRONIZACION_CLOUDFLARE.md) - Guía completa
- [FILE_MANAGEMENT_GUIDE.md](FILE_MANAGEMENT_GUIDE.md) - Registro archivos externos
- [FAQ.md](FAQ.md) - Troubleshooting R2

### DuckDB y performance
- [HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md) - Documentación técnica completa
- [README.md](../README.md) - Benchmarks
- [ENDPOINTS_GUIDE.md](ENDPOINTS_GUIDE.md) - Comparación performance endpoints

### Consultas de datos
- [ENDPOINTS_GUIDE.md](ENDPOINTS_GUIDE.md) - ¿Qué endpoint usar?
- [FLUJOS_CONSULTA.md](FLUJOS_CONSULTA.md) - Ejemplos 1D/2D
- [RESPUESTAS_RAPIDAS.md](RESPUESTAS_RAPIDAS.md) - Código rápido

### Archivos parquet
- [FILE_MANAGEMENT_GUIDE.md](FILE_MANAGEMENT_GUIDE.md) - Gestión completa
- [HISTORICAL_DATA_GUIDE.md](HISTORICAL_DATA_GUIDE.md) - Formatos soportados
- [SINCRONIZACION_CLOUDFLARE.md](SINCRONIZACION_CLOUDFLARE.md) - Sync archivos

### Variables e índices
- [VARIABLES_GUIDE.md](VARIABLES_GUIDE.md) - Catálogo completo
- [ENDPOINTS_GUIDE.md](ENDPOINTS_GUIDE.md) - Endpoints de catálogo

---

## 📝 Crear nueva documentación

Si necesitas crear documentación nueva, sigue esta guía:

### Ubicación
- **Guías de usuario**: Raíz del proyecto (`/drought-backend/*.md`)
- **Guías técnicas**: Raíz del proyecto (`/drought-backend/*.md`)
- **Scripts/tools**: `/drought-backend/scripts/README.md`

### Formato recomendado
```markdown
# Título de la guía

Breve descripción de 1-2 líneas del propósito.

## 🎯 Objetivo

Qué aprenderás en esta guía.

## 📋 Prerequisitos

- Requisito 1
- Requisito 2

## [Contenido principal]

...

## 📚 Ver también

- [Documento relacionado 1](link1.md)
- [Documento relacionado 2](link2.md)
```

### Actualizar este índice
Cuando crees nueva documentación:
1. Agregar a la tabla de "Navegación rápida"
2. Agregar a "Documentación por categoría"
3. Agregar descripción en "Descripción de cada documento"
4. Actualizar rutas de aprendizaje si aplica
5. Actualizar búsqueda de temas si aplica

---

## 🔄 Última actualización

Este indice fue actualizado el: **Abril 2026**

---

## 📧 Mantener actualizado

Si encuentras:
- Documentación faltante en este índice
- Links rotos
- Descripciones desactualizadas

Por favor actualiza este archivo o reporta el issue.
