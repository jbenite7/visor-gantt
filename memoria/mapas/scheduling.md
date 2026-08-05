---
tipo: mapa
estado: vigente
fecha: 2026-08-05
areas: [scheduling]
fuente: AGENTS.md
resumen: "Qué documentos mandan en scheduling y qué trampas hay puestas"
---
# Mapa de scheduling

## Qué manda

- [[AGENTS]] — contrato no negociable: mantener relaciones FS/SS/FF/SF con sus lags, calendarios,
  restricciones, jerarquía/WBS, rollups, holgura total/libre y ruta crítica. El recálculo debe ser
  determinista y no crear un segundo modelo de scheduling. Ante ciclos, autodependencias,
  referencias huérfanas o calendarios inválidos: mostrar issues accionables y conservar el último
  cronograma válido. Distingue `Unique ID` (identidad interna estable) de `Row ID` (contrato
  visible/editable para predecesoras y sucesoras).
- [[v2/AGENTS|v2/AGENTS]] — mantener funciones de dominio puras y testeables para scheduling; la
  UI orquesta, no duplica reglas de cálculo.
- [[docs/ms-project-calculated-fields|campos calculados MS Project]] — familia "Cronograma CPM":
  `Early/Late Start/Finish`, `Total/Free/Start/Finish/Negative Slack`, `Critical`, `Active`,
  predecesoras/sucesoras por ID visible, WBS y Unique ID.

## Dónde vive en el código

- `v2/src/lib/scheduling/cpm.ts` — algoritmo forward/backward pass y ruta crítica.
- `v2/src/lib/scheduling/scheduleEngine.ts` — motor de recálculo del cronograma.
- `v2/src/lib/scheduling/calendar.ts`, `projectCalendar.ts`, `colombiaHolidays.ts` — calendarios
  de proyecto/recurso, excepciones laborales y festivos.
- `v2/src/lib/scheduling/baseline.ts` — línea base y variancias.
- `v2/src/lib/scheduling/assignments.ts` — asignaciones de recursos y su impacto en trabajo/costo.
- `v2/src/lib/scheduling/conflicts.ts`, `bottlenecks.ts` — detección de conflictos y cuellos de
  botella del cronograma.
- `v2/src/lib/scheduling/lob.ts`, `scurve.ts` — línea de balance y curva S.
- `v2/src/lib/scheduling/activityFamily.ts`, `typicalUnit.ts`, `unitPatterns.ts`, `typeBridge.ts` —
  clasificación de familias de actividad y unidades típicas.
- `v2/src/lib/gantt/taskIds.ts` — traducción entre `Unique ID` y `Row ID`.
- `v2/src/lib/gantt/dependencyEditing.ts`, `dependencyLag.ts` — edición de dependencias FS/SS/FF/SF
  con lags.
- `v2/src/lib/state/ProjectContext.tsx` — estado editable e historial que dispara el recálculo.

## Trampas y decisiones del área

Se llena en la pasada de ingest.
