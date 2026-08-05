---
tipo: flujo
estado: vigente
fecha: 2026-08-05
areas: [gantt, ui]
fuente: v2/src/lib/matrix/matrixSync.ts, v2/src/lib/matrix/matrixFromGantt.ts
resumen: "Cómo la matriz unidad × actividad se deriva del Gantt y devuelve sus ediciones sin pisar nada"
---
# Flujo: sincronización Matriz ↔ Gantt

- **Derivación.** La matriz (unidad × actividad) **se deriva del Gantt, no al revés**:
   `matrixFromGantt.ts` y `matrixGenerator.ts` la construyen desde `GanttTask`/`GanttDependency`;
   `tree.ts` arma su jerarquía. Se puede partir de una plantilla guardada (`templates.ts`, tabla
   `matrix_templates` en [[persistencia]]).
- **Edición en la matriz.** El usuario edita en `v2/src/components/views/MatrixEditorView.tsx`.
- **Reconciliación.** `matrixSync.ts` es el **único** punto que devuelve cambios de la matriz
   hacia las tareas del Gantt. El contrato ([[AGENTS]]) exige simetría en ambas direcciones —
   `matrixPlan`, dependencias, jerarquía y `matrixSource` — sin sincronización unilateral ni
   pérdida de ediciones recientes de ningún lado.
- **Recálculo.** Los cambios reconciliados entran al flujo [[edicion-y-recalculo]] como cualquier
   edición del Gantt.

Nota: `v2/src/lib/matrix/` no importa nada de `scheduling/`; la clasificación de familia la
consume `TypicalUnitView.tsx`, no la matriz. Ver el módulo [[matriz]].
