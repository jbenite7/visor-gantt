---
tipo: concepto
estado: vigente
fecha: 2026-08-05
areas: [scheduling]
fuente: v2/src/lib/gantt/taskIds.ts
resumen: "Como taskIds.ts calcula Row ID (campo MPP ID) y Unique ID (campo MPP UNIQUE_ID) por separado"
---
`v2/src/lib/gantt/taskIds.ts` mantiene dos funciones separadas para las dos identidades de una
tarea: `taskRowId()` lee el campo MPP `ID` vía `getMppRecordValue(..., "ID")` y solo cae al
índice de fila (`fallback`) si el campo no existe; `taskUniqueId()` lee `UNIQUE_ID` con
`numericRecordValue()`, que exige que el valor sea un entero (número o string numérico), sin
fallback a posición. `findTaskByRowId()` y `dependencyRowId()` construyen sobre `taskRowId()` para
resolver referencias de predecesoras/sucesoras por la identidad visible.
