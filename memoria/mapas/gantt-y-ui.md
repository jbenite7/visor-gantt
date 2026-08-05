---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [gantt, ui, reportes]
fuente: AGENTS.md
resumen: "Qué documentos mandan en Gantt, UI y reportes, y qué trampas hay puestas"
---
# Mapa de Gantt y UI

## Qué manda

- [[AGENTS]] — contrato no negociable: simetría Matriz ↔ Gantt (`matrixPlan`, dependencias,
  jerarquía, `matrixSource`) en ambas direcciones, sin sincronización unilateral ni pérdida de
  ediciones recientes. El asistente, recomendaciones y escenarios what-if son análisis/preview:
  no alteran ni persisten el cronograma base hasta aplicación explícita del usuario.
- [[v2/AGENTS|v2/AGENTS]] — Server Components por defecto, `"use client"` solo donde hacen falta
  estado/efectos/eventos/APIs de navegador; tokens y estilos compartidos centralizados en
  `src/app/globals.css`.

## Dónde vive en el código

- `v2/src/components/gantt/GanttChart.tsx` — componente principal del Gantt, con `bars/`,
  `arrows/`, `dependencies/`, `interaction/`, `table/`, `timescale/`, `toolbar/`, `assistant/`,
  `scenarios/` como subcarpetas.
- `v2/src/components/gantt/SplitPane.tsx`, `layout.ts`, `utils.ts`, `labelPolicy.ts` — layout y
  utilidades visuales del Gantt.
- `v2/src/lib/matrix/matrixFromGantt.ts`, `matrixGenerator.ts`, `matrixSync.ts`, `tree.ts` —
  generación y sincronización bidireccional de la programación matricial.
- `v2/src/components/views/MatrixEditorView.tsx`, `GanttView.tsx`, `TrackingGanttView.tsx`,
  `NetworkDiagramView.tsx`, `CalendarView.tsx`, `TaskSheetView.tsx` — vistas principales de la app.
- `v2/src/lib/gantt/planningRecommendations.ts`, `planningValidation.ts` — asistente preventivo
  (análisis, no persiste cambios).
- `v2/src/lib/gantt/scenarios.ts` — motor what-if con preview.
- `v2/src/lib/gantt/executiveDashboard.ts`, `executiveReportExport.ts` — dashboard ejecutivo y
  export CSV/PDF.
- `v2/src/lib/gantt/roleViewPresets.ts`, `structureTemplates.ts`, `smartPaste.ts`,
  `taskFilters.ts`, `taskStructure.ts` — presets de vista por rol, plantillas de estructura,
  pegado inteligente, filtros y jerarquía de tareas.
- `v2/src/components/charts/LineOfBalance.tsx`, `SCurve.tsx` — componentes de línea de balance y
  curva S.
- `v2/src/components/reports/ExecutivePlanningDashboard.tsx` — reporte ejecutivo consolidado.
- `v2/src/components/network/NetworkNode.tsx`, `NetworkArrow.tsx` (+ `v2/src/lib/layout/networkLayout.ts`) —
  diagrama de red de dependencias.
- `v2/src/components/theme/ThemeToggle.tsx` — modo claro/oscuro.

## Trampas y decisiones del área

**Decisiones**
- Aún no hay decisiones registradas para esta área.

**Trampas**
- [[banner-falso-positivo-por-buscar-la-palabra]]

**Conceptos**
- Aún no hay conceptos registrados para esta área.
