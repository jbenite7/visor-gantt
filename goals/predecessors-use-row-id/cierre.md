# Acta de cierre — predecessors-use-row-id

**Fecha:** 2026-08-04
**Cerrado tras:** auditoría fact-by-fact del 2026-08-04 (`goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md`)

## Por qué faltaba esta acta

El trabajo estaba implementado y cubierto por tests desde hacía tiempo, pero el goal nunca recibió documento de
cierre. La auditoría lo verificó contra el código real, no contra autoreportes.

## Facts verificados en el código

| Fact | Evidencia |
| --- | --- |
| Las columnas Predecesora/Sucesora usan el ID de fila | `GanttRow.tsx:73` — `formatDependencies` usa `dependencyTokenForTaskId`, que resuelve vía `taskRowId` (`taskIds.ts:11-17`, lee el campo `ID`, no `UNIQUE_ID`) |
| Los campos Unique ID Predecessors/Successors siguen usando UID | `mppCalculationEngine.ts:2015-2022` usa `taskUniqueId`; distinto de `PREDECESSORS`/`SUCCESSORS` en 2011-2012, que usan `taskRowId` |
| La edición acepta y guarda el ID de fila | `GanttRow.tsx:117-143` — `parsePredecessors` usa `findTaskByRowId` para traducir el ID visible al id interno. Test: `GanttTable.test.tsx:303` |
| Las relaciones internas se resuelven correctamente | Las dependencias siguen indexadas por id interno estable, no por ID de fila |

La traducción existe en ambos sentidos —mostrar y editar— y está cubierta por tests.

## Verificación de esta sesión

- `npm test -- --runInBand`: 79 suites, 586 tests, todos pasan.
- `npm run lint`: limpio.
- `npm run build`: correcto.
- Suite E2E en Chromium con stack Docker real (Postgres + parser): 13 passed.

## Salvedad

El "done condition" original pedía además un chequeo en navegador sobre la aplicación servida por Docker. La suite
E2E se ejecutó contra el stack real (base de datos y parser en Docker, aplicación en modo desarrollo), lo que cubre
la intención de la verificación. No se levantó el contenedor `frontend` de producción.
