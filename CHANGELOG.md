# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Fixed

- **Persistencia de atributos XML**: Se implementó una columna JSONB (`extra_data`) para guardar todos los atributos del archivo MPP (como Critical, Active, etc.) que se perdían al guardar en base de datos.
- **Persistencia de Dependencias (Gantt)**: Se corrigió el parser XML para extraer correctamente la estructura `PredecessorLink` completa. Se implementó la tabla `dependencies` y la lógica para guardar y recuperar las relaciones predecesoras, restaurando las flechas en el diagrama de Gantt.
- **Persistencia de columnas disponibles**: Se corrigió un error donde la lista de columnas disponibles (filtros) desaparecía al recargar un proyecto guardado. Ahora se persiste en el campo `settings` del proyecto.
- **Bug de campos faltantes en carga desde DB**: Corregida inconsistencia entre el parser XML y el método `getProject()` de `ProjectStorage`.
- **Bug de campos faltantes en carga desde DB**: Corregida inconsistencia entre el parser XML y el método `getProject()` de `ProjectStorage`.

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
