---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [gantt, ui]
fuente: v2/src/lib/gantt/, v2/src/components/gantt/
resumen: "Edición y presentación del Gantt: dependencias, IDs de tarea, plantillas y paste inteligente"
---
# gantt

**Qué hace.** Implementa la edición interactiva del diagrama de Gantt: edición de dependencias
(incluidos lags), cálculo de Row ID / Unique ID por tarea, filtros, smart paste desde hoja de
cálculo, plantillas de estructura de proyecto, presets de vista por rol, y el layout del diagrama
de red (network).

**Dónde vive.** `v2/src/lib/gantt/dependencyEditing.ts`, `dependencyLag.ts`, `taskIds.ts`,
`taskFilters.ts`, `taskStructure.ts`, `smartPaste.ts`, `structureTemplates.ts`,
`roleViewPresets.ts`, `planningValidation.ts`, `planningRecommendations.ts`, `scenarios.ts`,
`scheduleExchange.ts`; `v2/src/lib/layout/networkLayout.ts` (layout del diagrama de red);
`v2/src/components/gantt/` (tabla, barras, edición en UI) y `v2/src/components/network/`.

**Qué consume.** El proyecto normalizado (importación) y los resultados de CPM/calendario del
módulo [[memoria/arquitectura/scheduling-modulo|scheduling]].

**Quién lo consume.** `v2/src/components/views/GanttView.tsx` y `NetworkView`, y el módulo
[[reportes]] (dashboard y export ejecutivo usan `taskFilters`/`taskStructure`).

**Invariantes.** Predecesoras y sucesoras se muestran y editan siempre por Row ID (columna ID
visible), nunca por Unique ID — ver [[row-id-en-predecesoras-y-sucesoras]] y el concepto
[[unique-id-vs-row-id-en-codigo]] sobre cómo `taskIds.ts` calcula ambos por separado.
