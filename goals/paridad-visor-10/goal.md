# Goal: Paridad funcional con Visor de Cronogramas (.mpp)

**Slug:** `paridad-visor-10`
**Status:** `completed`
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

## Cierre

Completado el 2026-07-08. Verificado con pruebas unitarias completas, lint, build, Docker rebuild y navegador sobre Docker con importación `.mpp` real.

## Revisión posterior — 2026-08-04

La auditoría fact-by-fact (`goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md`) verificó los 10 criterios contra el código
real. Los 10 están implementados.

Durante la auditoría se reportó erróneamente que el criterio 6 estaba incompleto por faltar el "banner informativo
sutil entre toolbar y SplitPane" (fact 34). **Ese hallazgo fue un falso positivo**: se buscó la palabra "banner" en
el código en lugar de la funcionalidad. El elemento existe con otro nombre, `gantt-project-meta-strip`
(`v2/src/components/views/GanttView.tsx:1155`), está exactamente entre la barra de herramientas y el contenido, y
muestra nombre del proyecto, inicio, fin, duración, avance, número de tareas y número de dependencias.

Se llegó a implementar un componente `ProjectSummaryBanner` y **se revirtió** al detectar que duplicaba esa franja.
El criterio 6 estaba cumplido desde el cierre original.
