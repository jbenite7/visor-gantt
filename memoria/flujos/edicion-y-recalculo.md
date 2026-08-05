---
tipo: flujo
estado: vigente
fecha: 2026-08-05
areas: [gantt, scheduling]
fuente: v2/src/lib/state/ProjectContext.tsx, v2/src/lib/scheduling/scheduleEngine.ts, v2/src/lib/gantt/
resumen: "De una edición en el Gantt al cronograma recalculado: CPM, calendarios y ruta crítica"
---
# Flujo: edición y recálculo del cronograma

- **Edición.** El usuario edita en el Gantt (`v2/src/components/gantt/`): fechas, duración,
   jerarquía, o dependencias FS/SS/FF/SF con lag (`dependencyEditing.ts`, `dependencyLag.ts`).
   Predecesoras y sucesoras se escriben **siempre por Row ID**, nunca por Unique ID — ver
   [[row-id-en-predecesoras-y-sucesoras]] y [[unique-id-vs-row-id-en-codigo]]; `taskIds.ts` traduce.
- **Estado.** El cambio entra a `v2/src/lib/state/ProjectContext.tsx`, que mantiene el estado
   editable y el historial (undo/redo, `history.ts`) y dispara el recálculo.
- **Recálculo.** `scheduleEngine.ts` orquesta un único motor determinista (no hay segundo modelo
   de scheduling): `cpm.ts` corre forward/backward pass y marca ruta crítica y holguras;
   `calendar.ts`/`projectCalendar.ts` aplican días laborables, excepciones y festivos
   (`colombiaHolidays.ts`); los rollups suben por la jerarquía/WBS.
- **Datos inválidos.** Ciclos, autodependencias, referencias huérfanas o calendarios inválidos no
   rompen el cronograma: se muestran como issues accionables y se **conserva el último cronograma
   válido**.
- **Propagación.** El resultado alimenta la vista Gantt y las derivadas: la matriz vía
   [[sincronizacion-matriz-gantt]], y los análisis de [[analisis-y-reportes]].
- **Persistencia.** El estado editado se guarda explícitamente por el flujo [[guardar-y-reabrir]].

Ver los módulos [[memoria/arquitectura/scheduling-modulo|scheduling]] y [[gantt]].
