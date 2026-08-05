---
tipo: flujo
estado: vigente
fecha: 2026-08-05
areas: [reportes, gantt]
fuente: v2/src/lib/gantt/scenarios.ts, v2/src/lib/gantt/executiveDashboard.ts, v2/src/lib/scheduling/lob.ts
resumen: "Asistente, what-if, dashboard ejecutivo, LOB y curva S: análisis que no tocan el plan hasta aplicarse"
---
# Flujo: análisis y reportes

Regla común ([[AGENTS]]): todo esto es **análisis/preview**. Nada altera ni persiste el cronograma
base hasta que el usuario lo aplica explícitamente.

- **Asistente preventivo.** `planningValidation.ts` y `planningRecommendations.ts` revisan el plan
   y sugieren mejoras dentro del Gantt (`components/gantt/assistant/`).
- **Escenarios what-if.** `scenarios.ts` simula cambios sobre una copia y muestra el preview
   (`components/gantt/scenarios/`); solo al aplicar entra al flujo [[edicion-y-recalculo]].
- **Dashboard ejecutivo.** `executiveDashboard.ts` agrega avance, presupuesto
   (`v2/src/lib/budget/budgetParser.ts`) e hitos; `ExecutivePlanningDashboard.tsx` lo monta
   **dentro de `GanttView.tsx`** — no tiene ruta propia — y `executiveReportExport.ts` exporta
   CSV/PDF.
- **Línea de balance y curva S.** `lob.ts` + `typicalUnit.ts` agrupan actividades por familia
   (clasificación semiautomática con metadatos de confianza, ver
   [[clasificacion-semiautomatica-de-familia]] y
   [[matchedby-confidence-breadcrumb-en-clasificacion-de-familia]]) y alimentan
   `LineOfBalance.tsx`; `scurve.ts` alimenta `SCurve.tsx`.
- **Diagrama de red.** `networkLayout.ts` + `components/network/` dibujan las dependencias como
   red.

Ver los módulos [[reportes]], [[gantt]] y [[memoria/arquitectura/scheduling-modulo|scheduling]].
