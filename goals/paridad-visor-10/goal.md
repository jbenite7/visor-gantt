# Goal: Paridad funcional con Visor de Cronogramas (.mpp)

**Slug:** `paridad-visor-10`
**Status:** `active`
**Creado:** 2026-07-08
**Estimado:** ~38h

## Proposición

Lograr paridad funcional con la app destilada `project-viewer-501614.web.app` adoptando sus 10 ideas principales en Visor Gantt.

## Acceptance Criteria

1. **Vista Conflictos** — Nueva pestaña con detección de violaciones de restricción (FS/SS/FF/SF contradichas por fechas) y desviaciones atípicas. Tablas con columnas detalladas y contadores.
2. **Vista Unidad Típica** — Nueva pestaña que detecta sistemas repetidos en ≥3 niveles usando UNIT_PATTERNS + WBS. Toggle Por Nivel / Consolidado. Análisis de productividad (unidades/día). Degradación limpia.
3. **Mejoras LOB** — Mensaje de degradación alineado, etiqueta de ubicación/nivel, selector de escala (semanas/meses).
4. **Vista Calendario** — Nueva pestaña con grid mensual, celdas coloreadas (laboral/finde/festivo/laboral especial), barra de resumen, task overlay.
5. **Jerarquía dinámica** — Botones L1–LX según outlineLevel máximo del proyecto. Expandir todo / Colapsar todo.
6. **Toolbar + Banner** — ProjectToolbar mejorado (duración, % completado, dependencias). Banner sutil con resumen del proyecto.
7. **Escala Trimestres** — 4ta opción de escala temporal (junto a Día/Semana/Mes).
8. **% Completado en barras** — Fill proporcional dentro de cada barra de tarea en GanttChart.
9. **Feriados Colombia** — Festivos colombianos (fijos + móviles con Ley de Emiliani) cargados automáticamente al importar .mpp.
10. **ViewType infrastructure** — Registro de los 3 nuevos ViewTypes (conflictos, unidadTipica, calendario) en el enum, ViewSwitcher, routing y toolbar.

## Dependencias

- Task #1 (ViewType infra) debe completarse antes de #2, #3, #5
- Tasks #4, #6, #7, #8, #9, #10 son independientes y paralelizables

## Archivos

- `interview.json` — Respuestas de la entrevista inicial
- `interview-result.json` — Resultado de la entrevista
- `facts-review.json` — Facts generados
- `facts-result.json` — Facts aprobados
- `facts.md` / `facts.meta.json` — Facts en formato definitivo
- `plan-review.json` / `plan-review.md` — Plan revisado
- `goal.md` / `goal.meta.json` — Este goal

## Skills requeridas

- TypeScript, React, Next.js (App Router)
- CSS Grid, SVG
- Algoritmos de scheduling / CPM
- Algoritmos de fechas (festivos móviles)
