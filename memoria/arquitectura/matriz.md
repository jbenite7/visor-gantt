---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [scheduling, ui]
fuente: v2/src/lib/matrix/
resumen: "Genera y sincroniza la vista de matriz (unidad × actividad) a partir del Gantt"
---
# matriz

**Qué hace.** Deriva una matriz de unidad × actividad a partir de las tareas del Gantt (usando la
familia de actividad calculada por [[memoria/arquitectura/scheduling-modulo|scheduling]]), la mantiene sincronizada con ediciones del
Gantt, y aplica templates de matriz guardados.

**Dónde vive.** `v2/src/lib/matrix/matrixGenerator.ts`, `matrixFromGantt.ts`, `matrixSync.ts`,
`tree.ts` (estructura jerárquica de la matriz), `templates.ts`.

**Qué consume.** El proyecto y la clasificación de familia de actividad del módulo [[memoria/arquitectura/scheduling-modulo|scheduling]].

**Quién lo consume.** Las vistas de matriz en `v2/src/components/views/` y la tabla de plantillas
persistida en Postgres (`matrix_templates`, ver [[persistencia]]).

**Invariantes.** La matriz se deriva del Gantt, no al revés: `matrixSync.ts` es el único punto que
reconcilia cambios hechos en la matriz de vuelta hacia las tareas del Gantt.
