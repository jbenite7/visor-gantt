# Roadmap: Visor MPP Web

## Estado Actual: Fase 21 (Corrección de Cálculo de Fechas) 🚀

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

1.- [x] **Configuración de Días No Laborables**:

- [x] Crear archivo de configuración `holidays.php`
- [x] Implementar `CalendarService` (Sábados laborales, Domingos festivos)
- [x] Integrar servicio en el cálculo de fechas del Backend
- [x] **Gestión Frontend**: Interfaz UI para administrar festivos (Base de datos).

2.  **Optimización de Carga**: Implementar caché para archivos grandes.
3.  **Transiciones**: Integrar animaciones fluidas (Framer Motion / CSS View Transitions).
4.  **Refactor CSS**: Reemplazar estilos actuales con la nueva paleta y glassmorphism.

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
- [x] Corrección de navegación (Botones en `main-top-bar`)

## ✅ Fase 17: Motor CPM Backend (Completada)

**Fecha**: 2026-01-30

- [x] **Arquitectura DDD Implementada**:
  - `Task` Entity (Inmutable) & `Dependency` VO.
  - `CalendarService` (Manejo de Fines de Semana).
  - `CPMCalculatorService` (Algoritmo Forward/Backward Pass).
- [x] **Algoritmo Verificado**: Script de pruebas (`test_cpm.php`) confirma cálculo correcto de Start/Finish Dates, Holgura y Ruta Crítica.
- [x] **Infraestructura**: Autoloader PSR-4 personalizado para namespace `Domain`.

## ✅ Fase 18: Auditoría y Corrección Visual Gantt (Completada)

**Fecha**: 2026-01-30

- [x] **Corrección de Duración Visual**: El Gantt ahora utiliza directamente las fechas de inicio y fin (`start_date`, `end_date` Objects) en lugar de encajar una duración pre-calculada, asegurando que tareas de 1 día (8h) o parciales se visualicen con precisión.
- [x] **Soporte de Fechas ISO**: Configuración de `gantt.config.xml_date` actualizada y paso de objetos Date nativos para evitar errores de parseo de strings.
- [x] **Estabilidad de Vistas**: Verificación de escalas en Día, Semana y Mes para asegurar consistencia con los nuevos datos de fecha precisos.

## ✅ Fase 19: Simplificación y Zoom (Completada)

**Fecha**: 2026-01-30

- [x] **Eliminación de Botones de Escala**: Removidos los selectores de Día/Semana/Mes para simplificar la interfaz.
- [x] **Implementación de Zoom Manual (Ctrl + Rueda)**: Se ha agregado un controlador de eventos que permite hacer zoom in/out (modificar el ancho de las columnas) al usar `Ctrl + Scroll`, ofreciendo flexibilidad sin cambiar la escala de tiempo base (Día).
- [x] **Accesibilidad de Zoom**: Añadidos botones `+` / `-` en pantalla y atajos de teclado (`Ctrl` + `+/-`) para usuarios sin mouse.
- [x] **Unificación de Lógica de Bbloqueo de Scroll**: Refactorizada la función `applyScrollLock` en `setupGanttEvents` para gestionar tanto el scroll diagonal seguro como el nuevo zoom horizontal desde un único punto de entrada.

## ✅ Fase 20: Modos de Visualización (Completada)

**Fecha**: 2026-01-30

- [x] **Nuevas Opciones de Vista**: Se han definido e implementado 3 modos claros de visualización:
  - **Tabla**: HTML puro para revisión de datos.
  - **Tabla + Gantt**: Vista estándar de DHTMLX con columnas (Grid) y gráfico.
  - **Gantt**: Vista de solo gráfico, ocultando la grilla interna (`show_grid = false`) para una experiencia de visualización pura.
- [x] **Renombrado de Botones**: El botón "Gantt" anterior se renombra a "Tabla + Gantt" para mayor claridad.

## ✅ Fase 21: Corrección de Cálculo de Fechas (Completada)

**Fecha**: 2026-01-30

- [x] **Motor de Cálculo Ajustado**: Se identificó que el servicio de cálculo CPM automático estaba sobrescribiendo las fechas programadas en el archivo XML original, causando desplazamientos incorrectos en el tiempo para tareas resumen y tareas con restricciones específicas.
- [x] **Importación Fiel**: Se ha deshabilitado el recálculo forzado durante la importación para garantizar que las fechas visualizadas en la aplicación coincidan exactamente con las definidas en el archivo `.mpp`/XML original, respetando la programación del usuario.

## ✅ Fase 22: Corrección Fecha Fin Global (Completada)

**Fecha**: 2026-02-02

- [x] **Recálculo Dinámico**: Se añadió lógica en el `ProjectParser` para ignorar la metadata de fechas del encabezado XML (a menudo desactualizada) y en su lugar calcular el Inicio y Fin real del proyecto basándose en el rango (Min/Max) de todas las tareas importadas. Esto asegura que la fecha "Fin" del proyecto coincida con la fecha de la última tarea.

## ✅ Fase 23: Mejora de Legibilidad (Completada)

**Fecha**: 2026-02-02

- [x] **Scroll Horizontal en Tablas**: Se desactivó el ajuste automático de columnas (`autofit = false`) para evitar que el texto se corte en pantallas pequeñas. Ahora las columnas respetan su ancho definido y la tabla permite desplazamiento horizontal independiente del gráfico Gantt.
- [x] **Ancho de Columnas Optimizado**: Se aumentó el ancho base de la columna "Nombre" a 350px para visualizar títulos largos sin truncamiento.

## ✅ Fase 24: Corrección Alineación de Flechas (Completada)

**Fecha**: 2026-02-02

- [x] **Anclaje de Hitos**: Se corrigió un problema donde tareas con duración > 0 pero marcadas como "Hitos" (Diamantes) tenían sus flechas de dependencia desconectadas. Ahora el sistema fuerza una duración lógica de 0 para el motor gráfico (alineando la flecha con el diamante), mientras conserva y muestra la duración original en la tabla de datos.
- [x] **Renderizado Robusto**: Se añadió un paso de renderizado explícito final para asegurar que todas las lineas SVG se recalculen correctamente después de la carga de datos.

## ✅ Fase 25: Ajuste de Identidad Visual (Completada)

**Fecha**: 2026-02-02

- [x] **Esquema de Colores Semánticos**: Se reasignaron los colores de las barras para cumplir con la nueva lógica de negocio:
  - **Resumen (Cualquiera)**: Verde Corporativo (Prioridad Alta).
  - **Crítica (No Resumen)**: Rojo Alerta.
  - **Estándar (No Crítica)**: Azul Arquitectura.
- [x] **Intercambio CSS**: Se actualizaron las variables CSS para invertir la lógica anterior (donde Estándar era Verde y Resumen era Azul), asegurando consistencia en toda la aplicación.

## ✅ Fase 26: Lógica de Datos Avanzada (Completada)

**Fecha**: 2026-02-02

- [x] **Gestión de Sucesoras**: Implementada la lógica de backend y frontend para parsear y visualizar la columna de "Sucesoras", invirtiendo las relaciones de predecesoras existentes.
- [x] **Formato de Dependencias Detallado**: Visualización enriquecida de vínculos (ej. `12FC+5d`) mostrando ID, Tipo (FF, FC, CC, CF) y Retardo (días/horas) en las tablas.
- [x] **Cálculo de Duración Robusto**: Nuevo motor de parsing en `ProjectParser.php` que interpreta formatos ISO 8601 y códigos numéricos de Project, convirtiéndolos a días laborables.
- [x] **Recálculo de Fechas (Semana 6 Días)**: Lógica de servidor para proyectar la Fecha Fin Real sumando la duración a la Fecha Inicio, respetando una semana laboral de lunes a sábado (excluyendo domingos).

## ✅ Fase 27: Detección Inteligente de Fechas (Completada)

**Fecha**: 2026-02-02

- [x] **Soporte Multiformato**: Implementación de `parseDate` en el importador XML para detectar y normalizar fechas en formato americano (`mm/dd/yyyy`) automáticamente a ISO 8601, manteniendo compatibilidad con formatos estándar.

## ✅ Fase 28: Estandarización de Unidades (Completada)

**Fecha**: 2026-02-02

- [x] **Restricción de Formato**: Se forzó la visualización de retardos en dependencias a solo **Días (d)** o **Porcentaje (%)**, convirtiendo automáticamente valores en horas o minutos a días laborales (base 8h) para cumplir con la regla de negocio.

## ✅ Fase 29: Lógica CPM Completa (Completada)

**Fecha**: 2026-02-02

- [x] **Parsing Avanzado de XML**: Integración de lectura de calendarios (`<Calendar>`) y atributos de `LinkLag` en décimas de minuto.
- [x] **Normalización de Unidades**: Conversión asegurada de retardos y duraciones a minutos/días en el Mapper.
- [x] **Calendario Dinámico**: actualización del `CalendarService` (Domain) para soportar configuración de días no laborales y festivos desde el XML.
- [x] **Aritmética de Fechas**: Implementación de `addDuration` y `subtractDuration` con lógica de días laborables para el cálculo de ruta crítica.
- [x] **Rollup de Resumen**: Verificación del algoritmo de fechas de tareas resumen basado en sus sub-tareas (Min Start / Max Finish).

---

# Track v2: Reescritura Next.js (`v2/`)

> **Nota de arquitectura**: Las Fases 1–29 de arriba documentan la implementación legacy (PHP + parser XML/MSPDI + Frappe Gantt/DHTMLX). El producto activo es la reescritura en `v2/` (Next.js 16 / React 19 / TypeScript / PostgreSQL con parser `.mpp` vía servicio Docker mpxj). Este track se documenta por separado para no desincronizar ambas capas. El roadmap legacy se conserva como referencia histórica, no como estado vigente.

## ✅ Fase v2-G1: Editor operativo de planificación + Refactor apple-like + Paridad matriz/Gantt (Completada)

**Fecha**: 2026-07-06
**Paquete de objetivo**: `goals/top5-ui-ux-business-improvements-gantt/` (goal.md / facts.md / plan.md)

Convertir el Gantt en editor operativo diferenciado frente a MS Project/Planner, refactor estético apple-like 2026 en toda la app, y generación automática de programación matricial simétrica al importar `.mpp`.

- [x] **Editor de dependencias** (FS/SS/FF/SF + lags) con popover/panel, detección de ciclos, autosave PostgreSQL y recarga verificada — `dependency-visual-persistence.spec.ts`.
- [x] **Editor de jerarquía** (drag/drop, WBS, outlineLevel, rollups de resumen) con autosave y recarga verificada — `hierarchy-visual-persistence.spec.ts`.
- [x] **Asistente preventivo** (dependencias faltantes, convergencia crítica, capacidad, deadlines, restricciones MPP, baseline) en runtime sin mutar `project_data` — `planning-assistant-runtime.spec.ts`.
- [x] **What-if** con preview sin mutar DB, descartar y aplicar con confirmación — `what-if-persistence.spec.ts`.
- [x] **Integración cronograma/costo/alcance/avance**: Línea de Balance, Curva S, Earned Value, triple restricción, dashboard ejecutivo, export CSV/PDF.
- [x] **Refactor apple-like 2026**: design system OKLCH en `globals.css` (tokens de radio/sombra multicapa, `--ease-spring`, glass/backdrop-blur con prefijos `-webkit-` Safari, dark mode), auditoría visual desktop/mobile — `final-visual-audit.spec.ts` (40 capturas).
- [x] **Programación matricial simétrica**: paridad 100% Gantt↔Matriz (`buildMatrixPlanFromGantt` / `generateScheduleFromMatrix` + `matrixSync`).
- [x] **`.mpp` → matriz automática**: `buildProjectDataFromMpp` genera `matrixPlan` en ambas ramas (con y sin cálculo) vía `buildImportedMatrix` — `mpp-import-matrix-runtime.spec.ts`.
- [x] **Restricción de negocio respetada**: ninguna acción inteligente/IA modifica el cronograma sin confirmación explícita del usuario (facts.md #50, plan.md L250).

**Verificación de cierre** (2026-07-06): lint limpio; Jest 71 suites / 508 tests; `next build` ✓; E2E en vivo 11 passed / 1 skipped (benchmark de producción omitido por requerir `PRODUCTION_SSH_HOST`) contra PostgreSQL + parser `.mpp` reales; benchmark sintético (60 pisos, 20 corridas) `recalculateSchedule` p95 15.4 ms, `combinedMatrixGanttPath` p95 19.3 ms.

**Deuda de release conocida**: la imagen Docker `visor-gantt-frontend:latest` es del 2026-07-02 (anterior a los commits de feature); requiere `docker compose build frontend` antes de desplegar para no correr código viejo.

## 🟡 Fase v2-G2: Erradicación del legacy PHP (Preparada — pendiente de commit/deploy)

**Fecha**: 2026-07-06
**Instrucción**: "Necesitamos erradicar el legacy".

Eliminación del stack PHP legacy (DDD), que ya no tiene ruta de ejecución: `docker-compose.yml` construye solo `./v2` (frontend) + `./services/mpp-parser`, sin referencia a `backend/` ni `docker/`.

- [x] **Borrado de código** staged en git: `backend/` (27 archivos PHP — Domain/Scheduling, Services, tests, config, sql, data JSON), `docker/Dockerfile` (php:8.2-apache) y `.eslintrc.json` (v2 usa flat-config).
- [x] **Metadocs alineados a realidad v2-only**: `AGENTS.md` (reescrito), `SCAFFOLDING.md` (ADR PHP removido), `GEMINI.md` (PHP→TypeScript), `CHANGELOG.md` (hito v2 + divisor legacy).
- [x] **Barrido de referencias colgantes**: `git grep` confirma cero referencias ejecutables a `backend/`, `docker/Dockerfile`, `<?php` o `php:8.2` en código/config activo. Menciones residuales solo en el JSON histórico de entrevista del goal package (documentación) y strings `license: "Apache-2.0"` de dependencias.
- [ ] **Limpieza física** de artefactos untracked `backend/` (uploads/logs) — `rm -rf backend/ docker/`.
- [ ] **Commit + push a `main`** — bloqueado esta sesión por el classifier de Bash (mutaciones no clasificables; read-only sí opera).
- [ ] **Rebuild imagen Docker** `docker compose build frontend` (salda la deuda de release de Fase v2-G1).
- [ ] **Deploy a Hetzner** (`ssh hetzner-vps-openclaw` → `git pull origin main` → `docker compose up -d --build frontend`) + verificación en `http://62.238.11.226:3000`.

> **Estado**: erradicación preparada y verificada a nivel de repo (borrados en index + metadocs + barrido limpio). Los pasos de entrega (commit/push/rebuild/deploy) quedan pendientes por indisponibilidad del classifier de Bash en esta sesión no interactiva.
