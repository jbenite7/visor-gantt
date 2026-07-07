# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### v2 — Reescritura Next.js 16 (2026-07-06)

#### Added

- **Editor operativo de planificación**: Gantt/CPM interactivo diferenciado de MS Project/Planner (ruta crítica, dependencias FS/SS/FF/SF + lags, WBS/rollups) sobre `v2/` (Next.js 16 + React 19).
- **Programación matricial simétrica**: paridad 100% con el CPM/Gantt (`buildMatrixPlanFromGantt` ↔ `generateScheduleFromMatrix`); un `.mpp` importado genera su matriz automáticamente en ambas ramas de cálculo (`buildImportedMatrix`).
- **Refactor estético Apple-like 2026**: design system con tokens OKLCH, superficies glass (`backdrop-filter`), modo oscuro e identidad de marca AIA, centralizado en `v2/src/app/globals.css`.

#### Removed

- **Erradicación del backend PHP legacy (DDD)**: eliminados `backend/` (Domain/Services/tests PHP), `docker/Dockerfile` (php:8.2-apache) y `.eslintrc.json`. No queda ninguna ruta de ejecución fuera de Docker + `v2/`.

### Legacy (PHP + Frappe Gantt) — archivado, referencia histórica

### Added

- **Favicon y Logo Corporativo**: Integración de `favicon.png` y `logo.png` en la interfaz principal.
- **Curvas Suaves en Flechas de Dependencias**: Implementación de curvas bezier (radio 8px) para paths SVG de dependencias, mejorando la estética visual.
- **Hitos Críticos Visibles**: Solución definitiva para visualizar hitos de ruta crítica como rombos rojos perfectos, corrigiendo errores de recorte y conflictos de clases en la librería.
- **Popups Personalizados**: Nueva implementación manual de tooltips (bypass de librería) que muestra atributos clave (Desviación, Predecesoras, Estado Crítico) con diseño Mobile First.

### Changed

- **Cache Busting**: Implementación de versionado dinámico en assets CSS/JS para forzar la recarga de cambios en el navegador.
- **Etiquetas de Gantt**: Cambio de etiqueta "Dedv" a "Desv" (Desviación) para mayor claridad.

- **Refactorización de Renderizado**: Simplificación de lógica de `renderTable` y `renderGantt` para mayor mantenibilidad.
- **Top Bar Mejorado**: Refinamiento de estilos del `main-top-bar` con mejor alineación y espaciado utilizando flexbox y gap.
- **Reorganización del Proyecto**: El proyecto fue movido a un directorio independiente: `/Developer/visor-gantt`.
- **Docker - DocumentRoot Dinámico**: Se configuró Apache para leer la variable de entorno `APACHE_DOCUMENT_ROOT` dinámicamente, eliminando rutas hardcodeadas.
- **Docker Compose**: Removida declaración obsoleta `version: '3.8'` (no requerida desde Docker Compose v2+).

### Fixed

- **Referencias DOM**: Corrección de referencias a elementos del DOM en `app.js` (eliminación de código obsoleto de vista dividida).
- **Exclusión de Logs**: Añadido `backend/debug_log.txt` al `.gitignore` para evitar trackear archivos de depuración.

### Removed

- **Vista "Tabla + Gantt" Temporal**: Removida temporalmente la vista dividida para estabilización (pendiente de reintegración).
- **fixGanttDateRange**: Deshabilitada función que causaba desalineación de barras al sobrescribir fechas calculadas por Frappe Gantt.

## [0.5.0] - 2026-01-29

### Fixed

- **Gantt Vista Mes - Alineación de Barras**: Corregido bug de Frappe Gantt v1.0.4 que asumía 30 días fijos por mes, causando desalineación progresiva de barras respecto a encabezados.
  - Nueva función `getXForDateInMonthView()` que calcula posiciones usando días calendario reales.
  - Nueva función `fixMonthViewBarPositions()` que corrige posiciones de barras post-render.
  - Nueva función `fixMonthViewArrows()` que recalcula paths SVG de dependencias.
  - Corrección de timing (setTimeout anidado 150ms) para ejecutar después del `gantt.refresh()`.
  - Actualización de `renderCutoffLine()`, `scrollToStart()` y `renderPreStartZone()`.

### Removed

- **Código Experimental**: Eliminado directorio `frontend/public/js/_experimental/` con código no integrado:
  - `GanttEditor.js` (126 líneas)
  - `GanttChart.js` (98 líneas)
  - `GanttGrid.js` (84 líneas)

## [0.4.0] - 2026-01-27

### Agregado

- Adopción Total de Identidad de Marca AIA ("manual-de-marca-aia.json").
- Implementación de variables CSS semánticas para Colores Corporativos, Alertas y Advertencias.
- Función `scrollToStart` en Gantt para posicionamiento inicial inteligente.

### Modificado

- `style.css`: Reescritura completa usando variables CSS `--aia-*`.
- `app.js`: Ajuste de scroll inicial y fecha de corte por defecto (Hoy).
- `index.php`: Limpieza de scripts obsoletos.

### Eliminado / Archivado

- `backend/src/parser.py`: Eliminado por obsolescencia.
- Archivos de prueba movidos a `test_data/` y scripts experimentales a `_experimental/`.
- Limpieza de archivos XML de la raíz.

## [0.3.0] - 2026-01-27

### Added

- **Gantt Avanzado**:
  - **Controles de Zoom**: Vistas conmutable por Día, Semana y Mes.
  - **Pantalla Completa**: Modo inmersivo que maximiza el área de trabajo y el diagrama verticalmente.
  - **Fecha de Corte**: Selector de fecha que dibuja una línea de referencia visual en el diagrama.
  - **Cálculo de Progreso Teórico**: Tooltip avanzado que compara el avance Real vs Teórico (según fecha de corte) y muestra la desviación.
- **Visualización**:
  - **Hitos tipo Diamante**: Implementación híbrida JS/CSS para renderizar hitos como rombos perfectos.
  - **Mejora de Contraste**: Barras de tareas con texto oscuro sobre fondo claro para mejor legibilidad.
  - **Barras de Progreso**: Estilización forzada para asegurar visibilidad dentro de las barras.

## [0.2.0] - 2026-01-22

### Added

- **Sidebar "Rail" UI**: Nueva navegación lateral colapsable (estilo Desktop Rail / Mobile Drawer).
- **Exportación Excel**: Funcionalidad para descargar tabla visible en formato `.xlsx` usando SheetJS.
  - Soporte para fechas en formato `dd/mm/yyyy`.
  - Formato de texto forzado para columnas jerárquicas (EDT).
  - Conversión de booleanos (Resumen/Crítica) a "Sí/No".
- **Column Reordering**: Capacidad de reordenar columnas mediante Drag & Drop (SortableJS).
- **Control de Visibilidad**: Botón de descarga integrado en la barra de herramientas principal.
- **Librerías CDN**: Integración de `xlsx` y `sortablejs`.

### Changed

- Refactorización de `style.css` para soportar estados colapsados y mejorar la responsividad.
- Optimización de `renderTable` para respetar el orden personalizado de columnas.

## [0.1.0] - 2026-01-22

### Added

- Estructura inicial del proyecto (Scaffolding).
- Configuración de Docker para entorno de desarrollo.
- Documentación base (README, SCAFFOLDING, GEMINI).
- **ROADMAP.md**: Estrategia de desarrollo detallada por fases.
- Configuración de VSCode y Linters.
- "Hello World" frontend y endpoint de salud backend.
