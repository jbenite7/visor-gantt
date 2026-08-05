---
tipo: modulo
estado: vigente
fecha: 2026-08-05
areas: [importacion, datos]
fuente: v2/src/lib/mpp/
resumen: "Motor que replica los campos calculados de MS Project a partir del JSON crudo de MPXJ"
---
# mpp-calculo

**Qué hace.** MPXJ expone campos crudos de un `.mpp`, pero no todos los campos calculados que
Microsoft Project muestra (fórmulas custom, campos derivados). Este módulo audita qué campos
calculados hacen falta, los calcula, y detecta cuándo el cálculo del motor diverge del valor
esperado.

**Dónde vive.** `v2/src/lib/mpp/mppCalculationEngine.ts` (motor de cálculo),
`v2/src/lib/mpp/calculatedFields.ts`, `v2/src/lib/mpp/customFormula.ts`,
`v2/src/lib/mpp/calculationCoverage.ts`, `v2/src/lib/mpp/calculationRequirements.ts`,
`v2/src/lib/mpp/mppParityAudit.ts` (compara el cálculo propio contra el valor de referencia),
`v2/src/lib/mpp/fieldInspector.ts`, `v2/src/lib/mpp/fieldLabels.ts`,
`v2/src/lib/mpp/standardFields.ts`, `v2/src/lib/mpp/taskColumns.ts`, `v2/src/lib/mpp/recordValues.ts`.

**Qué consume.** El JSON normalizado que produce el módulo [[memoria/arquitectura/importacion-modulo|importacion]] (tareas y campos crudos
de MPXJ).

**Quién lo consume.** `v2/src/components/gantt/table/GanttTable.tsx` y las vistas que muestran
columnas de tarea (`taskColumns.ts` define qué columnas exponer).

**Invariantes.** El trabajo está organizado en tres capas — inventario, estado, pendientes — según
[[capas-del-motor-de-calculo-mpp]]; ese documento es la referencia de qué campos ya están cubiertos
antes de tocar el motor.
