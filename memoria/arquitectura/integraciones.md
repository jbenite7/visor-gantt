---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [scheduling, ui]
fuente: v2/src/lib/integrations/, v2/src/app/api/integrations/last-planner/
resumen: "Genera una vista previa de Last Planner a partir del plan del Gantt"
---
# integraciones

**Qué hace.** Traduce el plan de tareas del Gantt a una vista previa compatible con Last Planner
System (planificación semanal colaborativa de obra).

**Dónde vive.** `v2/src/lib/integrations/lastPlanner.ts`,
`v2/src/app/api/integrations/last-planner/preview/route.ts`.

**Qué consume.** El proyecto y las tareas del módulo [[gantt]].

**Quién lo consume.** El endpoint `/api/integrations/last-planner/preview` se consulta desde la UI
para generar el preview antes de exportarlo.

**Invariantes.** Es la única integración externa implementada hoy; si aparece una segunda
integración, esta página deja de describir "la" integración y debe dividirse.
