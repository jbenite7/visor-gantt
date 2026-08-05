---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [scheduling]
fuente: v2/src/lib/scheduling/
resumen: "Motor de calendario, CPM y clasificación de familia de actividad (LOB)"
---
# scheduling

**Qué hace.** Calcula el camino crítico (CPM), aplica calendarios de proyecto (incluidos festivos
de Colombia), gestiona baselines, conflictos y asignaciones de recursos, y clasifica actividades
por familia para agrupar unidades típicas (Line of Balance).

**Dónde vive.** `v2/src/lib/scheduling/cpm.ts`, `calendar.ts`, `projectCalendar.ts`,
`colombiaHolidays.ts`, `baseline.ts`, `bottlenecks.ts`, `conflicts.ts`, `assignments.ts`,
`scheduleEngine.ts`, `scurve.ts`, `activityFamily.ts`, `lob.ts`, `typicalUnit.ts`,
`unitPatterns.ts`, `typeBridge.ts`, `types.ts`.

**Qué consume.** El proyecto normalizado por el módulo [[memoria/arquitectura/importacion-modulo|importacion]] (tareas, dependencias,
calendarios) y, para la curva S, los datos de presupuesto (`v2/src/lib/budget/`).

**Quién lo consume.** `v2/src/lib/gantt/` (recomendaciones de planificación, dashboard ejecutivo),
`v2/src/lib/matrix/` (la matriz usa la clasificación de familia para agrupar filas), y las vistas
en `v2/src/components/views/` (`GanttView.tsx`, `SCurveView.tsx`).

**Invariantes.** La clasificación de familia de actividad se implementó completa, no como stub —
ver [[clasificacion-semiautomatica-de-familia]]. El resultado de clasificar trae metadatos de
confianza (`matchedBy`, `confidence`, `breadcrumbLevel`, `reviewReason`) documentados en
[[matchedby-confidence-breadcrumb-en-clasificacion-de-familia]].
