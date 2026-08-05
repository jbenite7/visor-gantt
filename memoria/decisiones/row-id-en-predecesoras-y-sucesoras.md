---
tipo: decision
estado: vigente
fecha: 2026-07-04
areas: [scheduling]
fuente: goals/predecessors-use-row-id/facts.md
resumen: "Predecesoras y sucesoras se muestran y editan por Row ID (columna ID), nunca por Unique ID"
---
Las columnas visibles y editables **Predecesora** y **Sucesora** usan el `Row ID` consecutivo
(el campo MPP `ID`), no el `Unique ID`. `taskRowId()` en `v2/src/lib/gantt/taskIds.ts` lee el
campo `ID` del registro MPP con `getMppRecordValue(..., "ID")` y solo cae al índice de fila si no
existe; `taskUniqueId()` es una función separada que lee `UNIQUE_ID`. Los campos específicos
"Unique ID Predecessors"/"Unique ID Successors" siguen mostrando Unique ID sin traducir.

**Why:** el usuario edita el cronograma con los mismos números que ve en MS Project. Un
`Unique ID` expuesto en la columna de predecesoras es indistinguible de un número de fila y
produce dependencias silenciosamente equivocadas si se edita a mano.

**How to apply:** al tocar importación, edición, guardado o recálculo de dependencias, prueba el
ciclo completo (crear/editar/guardar/recargar) — la traducción se rompe en un solo extremo y el
otro la enmascara porque la importación y el motor CPM sí resuelven internamente por Unique ID.
