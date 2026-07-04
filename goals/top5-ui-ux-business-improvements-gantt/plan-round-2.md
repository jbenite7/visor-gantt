# Plan: Mejoras UI/UX y negocio del Gantt

## Enfoque

La vista Gantt debe avanzar hacia un editor operativo de planificación. La implementación debe reutilizar el estado central de `ProjectContext`, el modelo existente `GanttTask`/`GanttDependency`, la persistencia en `project_data` y la validación de `scheduleEngine`. No se debe crear un segundo modelo de tareas paralelo.

El alcance es amplio, así que la ejecución debe partirse en fases incrementales. Cada fase debe dejar una experiencia usable, persistente y verificable antes de avanzar.

## Fase 0: Base de modelo y pruebas

Archivos/sistemas:

- `v2/src/components/gantt/types.ts`
- `v2/src/lib/state/ProjectContext.tsx`
- `v2/src/lib/scheduling/scheduleEngine.ts`
- Nuevo módulo sugerido: `v2/src/lib/gantt/taskStructure.ts`
- Nuevo módulo sugerido: `v2/src/lib/gantt/dependencyEditing.ts`
- Tests: `v2/src/lib/gantt/*.test.ts`, `v2/src/lib/scheduling/scheduleEngine.test.ts`

Trabajo:

1. Crear funciones puras para transformar jerarquía: mover arriba/abajo, subir/bajar nivel, insertar capítulo/subcapítulo/tarea, recalcular WBS y normalizar `outlineLevel`.
2. Crear funciones puras para editar dependencias: agregar, quitar, reemplazar predecesoras, reemplazar sucesoras, normalizar `to`, deduplicar y preservar `type` + `lag`.
3. Reutilizar `validateDependencies` para bloquear ciclos, autodependencias y referencias inválidas, ampliando mensajes si hace falta.
4. Definir cómo se actualizan `isSummary`, duración, fechas, progreso y rollups tras cambios de jerarquía.

Verificación:

- `npm test -- --runInBand taskStructure.test.ts dependencyEditing.test.ts scheduleEngine.test.ts`
- Casos mínimos: múltiples predecesoras, múltiples sucesoras, lags diferentes, ciclos, autodependencia, mover tarea con hijos, mover tarea entre padres, recalcular WBS.

## Fase 1: Tabla usable y controles persistentes

Archivos/sistemas:

- `v2/src/components/gantt/table/GanttTable.tsx`
- `v2/src/components/gantt/table/GanttRow.tsx`
- `v2/src/components/gantt/table/ColumnSelector.tsx`
- `v2/src/components/views/TaskSheetView.tsx`
- `v2/src/lib/mpp/taskColumns.ts`
- `v2/src/app/actions/project.ts`

Trabajo:

1. Mantener el selector de columnas siempre visible con scroll horizontal.
2. Mantener `% completado` con 2 decimales.
3. Agregar búsqueda y filtros avanzados reutilizables para tabla Gantt y Task Sheet.
4. Persistir configuración de columnas, anchos, filtros y defaults de vista en el modelo actual (`taskColumnSettings`/`uiSettings`/`project_data`).
5. Mejorar tooltips/contexto de acciones sin saturar la UI.

Verificación:

- `npm test -- --runInBand GanttTable.test.tsx GanttView.test.tsx`
- E2E para tabla ancha: selector visible después de scroll horizontal, filtros persisten tras guardar/recargar.
- Revisión visual desktop/mobile.

## Fase 2: Controles de jerarquía

Archivos/sistemas:

- `v2/src/components/gantt/table/GanttTable.tsx`
- `v2/src/components/gantt/table/GanttRow.tsx`
- `v2/src/components/gantt/toolbar/ProjectToolbar.tsx`
- `v2/src/lib/state/ProjectContext.tsx`
- `v2/src/lib/gantt/taskStructure.ts`
- `v2/src/components/views/GanttView.tsx`

Trabajo:

1. Exponer acciones en `ProjectContext`: `indentTask`, `outdentTask`, `moveTaskUp`, `moveTaskDown`, `insertTask`, `insertSummary`.
2. Agregar botones para subir/bajar nivel y mover arriba/abajo usando iconos.
3. Agregar creación explícita de capítulo, subcapítulo y tarea.
4. Mantener undo/redo para todas las acciones.
5. Actualizar WBS, `outlineLevel`, `isSummary` y rollups de forma consistente.

Verificación:

- Unit tests para cada transformación.
- Component tests para botones y estados disabled.
- E2E: crear capítulo, agregar subcapítulo, mover tarea dentro/fuera de padre, guardar, recargar y validar estructura.

## Fase 3: Drag-and-drop de filas

Archivos/sistemas:

- `v2/src/components/gantt/table/GanttTable.tsx`
- `v2/src/components/gantt/table/GanttRow.tsx`
- `v2/src/lib/gantt/taskStructure.ts`
- `v2/src/lib/state/ProjectContext.tsx`

Trabajo:

1. Implementar drag-and-drop de filas sobre el mismo motor de transformación de Fase 2.
2. Soportar reordenar tareas y moverlas entre capítulos/subcapítulos.
3. Mostrar destino de drop claro: antes, después o como hijo.
4. Mantener accesibilidad mediante alternativa por botones y teclado.
5. Evitar que drag de filas choque con edición de celdas o selección de texto.

Verificación:

- Component tests de estados de drop cuando sea posible.
- E2E desktop para reordenar y mover entre padres.
- Revisión visual desktop/mobile.
- Benchmark con proyecto grande.

## Fase 4: Editor visual de dependencias

Archivos/sistemas:

- `v2/src/components/gantt/table/GanttRow.tsx`
- Nuevo componente sugerido: `v2/src/components/gantt/dependencies/DependencyPopover.tsx`
- Nuevo componente sugerido: `v2/src/components/gantt/dependencies/DependencyPanel.tsx`
- `v2/src/components/gantt/interaction/useCreateDependency.ts`
- `v2/src/lib/gantt/dependencyEditing.ts`
- `v2/src/lib/scheduling/scheduleEngine.ts`
- `v2/src/lib/state/ProjectContext.tsx`

Trabajo:

1. Agregar popover desde celda de predecesoras con búsqueda de tareas.
2. Agregar panel lateral para revisar y editar todas las relaciones de la tarea seleccionada.
3. Permitir múltiples predecesoras y múltiples sucesoras.
4. Permitir tipo `FS`/`SS`/`FF`/`SF` y lag positivo/negativo por dependencia.
5. Sincronizar edición textual, popover, panel lateral y drag del chart sobre el mismo estado.
6. Mostrar errores accionables cuando una dependencia sea inválida.

Verificación:

- Unit tests de dependencias: agregar, quitar, editar tipo, editar lag, reemplazar predecesoras, reemplazar sucesoras.
- Component tests para popover y panel.
- E2E: crear múltiples predecesoras/sucesoras con lags distintos, bloquear ciclo, guardar/recargar.

## Fase 5: Persistencia, API y auditoría

Archivos/sistemas:

- `v2/src/app/actions/project.ts`
- `v2/src/app/project/[id]/page.tsx`
- `v2/src/components/views/GanttView.tsx`
- Posibles APIs existentes bajo `v2/src/app/api/*`
- `v2/src/lib/import/*`
- `v2/src/components/upload/*`

Trabajo:

1. Confirmar que todos los cambios se serializan/deserializan por `project_data`.
2. Ajustar endpoints API solo si `project_data` no cubre un flujo requerido.
3. Mantener consistencia entre importación MPP y el modelo editable.
4. Agregar auditoría de cambios relevante para planificación: tipo de acción, tarea(s), timestamp y resumen del cambio.
5. Excluir colaboración multiusuario en esta entrega.

Verificación:

- Tests de serialización/deserialización para tareas, dependencias, jerarquía, settings y auditoría.
- E2E de guardar/recargar.
- Importar MPP, editar jerarquía/dependencias, guardar y recargar sin pérdida.

## Fase 6: Valor de negocio, reporting y performance

Archivos/sistemas:

- `v2/src/components/views/*`
- `v2/src/components/charts/*`
- `v2/e2e/production-gantt-benchmark.spec.ts`
- `v2/scripts/benchmark-gantt-recalculation.ts`

Trabajo:

1. Definir métricas visibles o registrables: tiempo de edición, errores bloqueados, uso de funciones avanzadas, confianza en guardado/recarga.
2. Mejorar reporting gerencial sin convertir el paquete en analítica avanzada completa.
3. Ejecutar benchmark con proyectos grandes para tabla, jerarquía y dependencias.
4. Revisar UX desktop/mobile de controles persistentes, panel lateral, tabla ancha y drag-and-drop.

Verificación:

- `npm run lint`
- `npm run build`
- `npm test -- --runInBand`
- `npm run test:e2e`
- Benchmark específico de Gantt con proyecto grande.
- Capturas o revisión visual manual documentada.

## Riesgos y decisiones abiertas

- El alcance aceptado es grande. La implementación debe permanecer faseada; una sola entrega grande aumentaría mucho el riesgo de regresión.
- Los rollups de tareas resumen deben definirse con precisión antes de implementar jerarquía avanzada.
- Drag-and-drop debe compartir el mismo motor que botones de jerarquía para evitar comportamientos divergentes.
- La edición de sucesoras debe seguir guardando dependencias en el sucesor como modelo canónico actual.
- La auditoría puede crecer rápido; conviene empezar con eventos mínimos dentro de `project_data` antes de crear tablas nuevas.
- La importación MPP puede traer IDs, WBS y jerarquías no triviales; las transformaciones deben probarse con datos importados, no solo proyectos creados manualmente.
