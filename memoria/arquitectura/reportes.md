---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [reportes, ui]
fuente: v2/src/lib/gantt/executiveDashboard.ts, v2/src/lib/gantt/executiveReportExport.ts, v2/src/components/reports/
resumen: "Dashboard ejecutivo y exportacion de reportes derivados del Gantt"
---
# reportes

**Que hace.** Agrega el estado del proyecto (avance, presupuesto, hitos) en un dashboard ejecutivo
y permite exportarlo como reporte.

**Donde vive.** `v2/src/lib/gantt/executiveDashboard.ts` (agregacion de datos),
`v2/src/lib/gantt/executiveReportExport.ts` (exportacion), `v2/src/components/reports/ExecutivePlanningDashboard.tsx`.

**Que consume.** El proyecto y las tareas del modulo [[gantt]], los datos de presupuesto de
`v2/src/lib/budget/budgetParser.ts`.

**Quien lo consume.** `v2/src/components/views/GanttView.tsx` monta el dashboard ejecutivo dentro
de la vista de Gantt; no tiene ruta propia.

**Invariantes.** El modulo vive fisicamente dentro de `lib/gantt/` (no en un directorio propio):
si se mueve, hay que actualizar esta pagina y no asumir que "reportes" es un directorio real.
