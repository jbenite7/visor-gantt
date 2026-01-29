# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Changed

- **Reorganización del Proyecto**: El proyecto fue movido a un directorio independiente: `/Developer/visor-gantt`.
- **Docker - DocumentRoot Dinámico**: Se configuró Apache para leer la variable de entorno `APACHE_DOCUMENT_ROOT` dinámicamente, eliminando rutas hardcodeadas.
- **Docker Compose**: Removida declaración obsoleta `version: '3.8'` (no requerida desde Docker Compose v2+).

### Fixed

- **Exclusión de Logs**: Añadido `backend/debug_log.txt` al `.gitignore` para evitar trackear archivos de depuración.

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
