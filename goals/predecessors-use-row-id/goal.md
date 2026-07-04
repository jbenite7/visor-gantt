# Predecesoras y sucesoras usan ID de fila

Corregir `visor-gantt` para que las predecesoras y sucesoras visibles y editables usen el ID de fila de Microsoft Project, no el Unique ID. La importacion puede recibir relaciones por UID, pero v2 debe traducirlas correctamente para mostrar, editar, guardar y recalcular con el ID consecutivo de fila.

La comprension compartida esta en `goals/predecessors-use-row-id/facts.md`.

El plan de ejecucion aprobado esta en `goals/predecessors-use-row-id/plan.md`.

Done condition: todas las facts aceptadas estan implementadas y verificadas con pruebas enfocadas, lint/build cuando aplique, y un chequeo en navegador sobre la app servida por Docker.
