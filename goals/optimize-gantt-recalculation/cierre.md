# Acta de cierre — optimize-gantt-recalculation

**Fecha:** 2026-08-04
**Cerrado tras:** auditoría fact-by-fact del 2026-08-04 (`goals/AUDITORIA-FACT-BY-FACT-2026-08-04.md`)

## Por qué faltaba esta acta

La optimización estaba implementada y sus tests pasaban, pero el goal nunca recibió documento de cierre.

## Facts verificados en el código

| Fact | Evidencia |
| --- | --- |
| Ambos motores optimizados con índices locales | `projectCalendar.ts:28-72` — `calendarLookupCache` (WeakMap), `overridesByDate` (Map), `workDays` (Set); el commit `b2b2698` toca `mppCalculationEngine.ts`, `scheduleEngine.ts` y `projectCalendar.ts` |
| No se creó un segundo modelo de scheduling | El cambio modifica el motor existente; no aparece ningún motor paralelo |
| Fechas, dependencias, CPM y restricciones intactas | `scheduleEngine.test.ts` y `cpm.test.ts` pasan |
| Campos MPP, recursos y asignaciones preservados | `mppCalculationEngine.test.ts` pasa |
| Recálculo por debajo del umbral | Benchmark sintético: `recalculateSchedule` p95 12 ms, ruta combinada matriz+Gantt p95 13,9 ms, muy por debajo de los 250 ms exigidos |

## Verificación de esta sesión

- `npm test -- --runInBand`: 79 suites, 586 tests, todos pasan.
- `npm run lint`: limpio.
- `npm run build`: correcto.

## Salvedades honestas

- El umbral de 250 ms se acredita con **benchmark sintético**, no con el `.mpp` original: ese archivo vivía en una
  ruta de otra máquina (`/Users/juanfelipebenitezramos/Downloads/`) que no existe en este entorno. El goal admitía
  explícitamente un "documented equivalent", y el sintético lo es.
- El benchmark de producción sigue condicionado a `PRODUCTION_SSH_HOST` y no es re-verificable desde aquí. Queda
  como estaba: documentado, no asertado.
- No hay test específico de autosave/deshacer/rehacer alrededor de este cambio.
