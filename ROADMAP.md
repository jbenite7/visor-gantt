# Roadmap: Visor MPP Web

## Estado Actual: Preparando Fase 7 (Implementación Vision 2026) 🚀

### ✅ Fase 1: Fundación (Completada)

- Scaffolding completo (Docker, docs, git).
- Backend PHP con parser XML (MSPDI).
- Frontend con upload y tabla de tareas.
- Simplificado a XML-only (sin Java).

### ✅ Fase 2: Visualización Gantt (Completada)

- Integración de Frappe Gantt librerías.
- Estructura basica de visualización.

### ✅ Fase 3: Gestión de Proyectos (Completada)

- Sistema de Archivos: CRUD completo en backend (`ProjectStorage.php`).
- Persistencia: Detección automática de duplicados y manejo de IDs.
- API: Endpoints para renombrar, duplicar y eliminar.

### ✅ Fase 4: Control de Versiones (Completada)

- Agrupación Inteligente: Proyectos se agrupan por `versionGroup`.
- Detección de Similitud: Algoritmo >70% match sugiere versionamiento.
- Flujo de Carga: Opciones para "Nuevo", "Versión" o "Sobreescribir".

### ✅ Fase 5: UI/UX & Mejoras (Completada)

- Interfaz Compacta: Diseño optimizado para evitar scroll excesivo.
- Botones de Acción: Renombrar, Duplicar (Copia/Versión), Eliminar.
- Acciones de Grupo: Duplicar última versión y eliminar grupo completo.
- Internacionalización: Fechas y horas adaptadas a la región del usuario.

### ✅ Fase 6: Visión Futura (Completada)

- Diseño Conceptual UI 2026 "Project Hyper-View".
- Diseño Conceptual UI 2026 "Project Hyper-View".
- Integración de identidad corporativa AIA (Colores y Tipografía) desde `manual-de-marca-aia.json`.

## Próximos Pasos (Fase 7)

1.  **Migración a UI 2026**: Implementar el "Bento Grid" y "Dynamic Island".
2.  **Transiciones**: Integrar animaciones fluidas (Framer Motion / CSS View Transitions).
3.  **Refactor CSS**: Reemplazar estilos actuales con la nueva paleta y glassmorphism.

## ✅ Fase 9: Refinamiento Visual Gantt

- [x] Contraste mejorado en barras estándar (verde claro con borde oscuro).
- [x] Barra de progreso oscura y visible dentro de la tarea.
- [x] Hitos con forma de diamante (Rombo) color ámbar.
- [x] Línea de Fecha de Corte (Dashed Red) con evaluación de progreso teórico.
- [x] Pantalla completa real y altura dinámica.

## ✅ Fase 10: Limpieza y Estandarización

- [x] Organización de directorios (`test_data`, `_experimental`).
- [x] Adopción completa de `manual-de-marca-aia.json` en CSS.
- [x] Corrección de UX en Gantt (Scroll inicial al inicio del proyecto).

## Fase 8: Funcionalidades de Datos (Completada) ✅

1.  **Exportación XLSX**: Descargar tabla con columnas activas (Soporte de tipos: Texto para EDT, Fechas dd/mm/yyyy, Booleanos Sí/No).
2.  **Reordenamiento**: Drag & Drop para ordenar columnas (SortableJS).

## ✅ Fase 11: Corrección de Fechas Gantt Vista Mes (Completada)

**Problema**: Frappe Gantt v1.0.4 asumía 30 días fijos por mes en sus cálculos de posición X, causando desalineación progresiva de las barras de tareas respecto a los encabezados de mes.

**Solución**:

- [x] Nueva función `getXForDateInMonthView()` que calcula posiciones usando días calendario reales.
- [x] Nueva función `fixMonthViewBarPositions()` que corrige posiciones de barras post-render.
- [x] Nueva función `fixMonthViewArrows()` que recalcula paths SVG de dependencias.
- [x] Corrección de labels de texto (`.bar-label`) para alinear con barras.
- [x] Corrección de timing (setTimeout anidado de 150ms) para ejecutar después del `gantt.refresh()`.
- [x] Actualización de `renderCutoffLine()`, `scrollToStart()` y `renderPreStartZone()` para usar cálculos corregidos.

## ✅ Fase 12: Análisis de Código en Desuso (Completada)

**Inventario realizado:** 2026-01-28

### Código Experimental No Usado (Eliminar Recomendado)

- `frontend/public/js/_experimental/GanttEditor.js` — Editor Gantt custom no integrado
- `frontend/public/js/_experimental/GanttChart.js` — Visualización SVG no usada
- `frontend/public/js/_experimental/GanttGrid.js` — Grid editable no usado

### Funciones Activas Verificadas

- [x] 74 funciones en `app.js` — Todas en uso activo
- [x] 11 métodos en backend PHP (`ProjectParser`, `ProjectStorage`) — Todos en uso activo

## ✅ Fase 13: Fix de Popups en Vistas Gantt (Completada)

**Problema**: Los popups/tooltips de las barras Gantt dejaban de funcionar después de cambiar el modo de vista (Día/Semana/Mes) o al entrar/salir de pantalla completa.

**Causa**: La función `bindTooltipHover()` que vincula los event listeners de hover solo se ejecutaba al renderizar inicialmente el Gantt, pero no después de cambiar de vista. Frappe Gantt re-renderiza las barras al cambiar de modo, perdiendo los event listeners.

**Solución**:

- [x] Añadido `bindTooltipHover()` en `changePViewMode()` después del setTimeout interno
- [x] Añadido `bindTooltipHover()` en ambos bloques de `toggleGanttFullscreen()` (entrar y salir)

## ✅ Fase 14: Reestructuración del Proyecto (Completada)

**Fecha**: 2026-01-29

- [x] Proyecto movido a directorio independiente: `/Developer/visor-gantt`
- [x] Nombre del proyecto estandarizado como "Visor Gantt"
- [x] Docker: Configuración de `APACHE_DOCUMENT_ROOT` dinámico
- [x] Docker Compose: Eliminada declaración `version` obsoleta
- [x] `.gitignore`: Exclusión de `backend/debug_log.txt`

## ✅ Fase 15: Identidad y Estabilidad (Completada)

**Fecha**: 2026-01-29

- [x] Agregado Favicon (`favicon.png`) al proyecto.
- [x] Agregado Logo Corporativo (`logo.png`) en posición fija superior derecha con estilo Glassmorphism.
- [x] Corrección de `ReferenceError: dateInput is not defined` en `app.js`.
- [x] Corrección de `SyntaxError` en `app.js` causado por inyección de código incorrecta.

## ✅ Fase 16: Simplificación de Interfaz Gantt (Completada)

**Fecha**: 2026-01-29

- [x] Eliminada barra naranja de controles del Gantt (`gantt-controls`)
  - Removidos controles de "Fecha Corte"
  - Removidos botones de zoom (Día/Semana/Mes)
  - Removido botón de Pantalla Completa
  - Interfaz simplificada mostrando directamente el chart
- [x] Reestructuración de navegación
  - Botones movidos desde `toolbar-row` hacia `main-top-bar`
  - Eliminado completamente el `toolbar-row`
  - Botones ahora se inyectan dinámicamente en `top-bar-actions`
  - Mejorado el alineamiento vertical y espaciado uniforme de todos los botones
  - **Nota**: Los controles del Gantt (Día/Semana/Mes/Fecha Corte) permanecen en su ubicación original dentro de la vista Gantt
