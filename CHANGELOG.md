# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

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
