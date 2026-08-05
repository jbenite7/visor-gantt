---
tipo: flujo
estado: vigente
fecha: 2026-08-05
areas: [scheduling, ui]
fuente: v2/src/lib/integrations/lastPlanner.ts, v2/src/app/api/integrations/last-planner/preview/route.ts
resumen: "El plan del Gantt se traduce a una vista previa de Last Planner antes de exportar"
---
# Flujo: integración Last Planner

- **Origen.** El plan de tareas del Gantt (módulo [[gantt]]) es la única entrada.
- **Traducción.** `v2/src/lib/integrations/lastPlanner.ts` lo convierte al formato de Last
   Planner System (planificación semanal colaborativa de obra).
- **Preview.** La UI consulta `/api/integrations/last-planner/preview`
   (`v2/src/app/api/integrations/last-planner/preview/route.ts`) y muestra el resultado antes de
   exportarlo; no muta el proyecto.

Es la **única** integración externa hoy; si aparece otra, el módulo [[integraciones]] y este flujo
deben dividirse por integración.
