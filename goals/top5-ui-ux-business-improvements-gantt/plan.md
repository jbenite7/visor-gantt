# Plan: Editor Gantt diferencial frente a MS Project

## Enfoque

El objetivo ya no es solo mejorar una tabla Gantt. La vista debe evolucionar hacia un editor operativo de planificación que compita con MS Project/Planner desde una ventaja propia: unir cronograma, costo, alcance, avance, línea de balance, curvas S y conceptos PMI en una experiencia más rápida, explicable y fácil de adoptar.

La implementación debe reutilizar el modelo actual `GanttTask`/`GanttDependency`, `ProjectContext`, `scheduleEngine`, `project_data`, programación matricial, línea de balance, presupuesto y vistas existentes. No se debe crear un segundo modelo paralelo. La entrega debe ser incremental y cada fase debe quedar usable, persistente y testeada.

## Primera Ola Priorizada

1. Asistente de validación/recomendaciones sin aplicar cambios automáticamente.
2. Editor visual de jerarquía/dependencias con impacto explicado.
3. Escenarios what-if para evaluar impacto antes/después.
4. Plantillas constructivas y reglas repetitivas de dependencias.
5. Línea de balance avanzada con feedback automático.

## Fase 0: Arquitectura de estado, transformaciones y validación

Archivos/sistemas:

- `v2/src/components/gantt/types.ts`
- `v2/src/lib/state/ProjectContext.tsx`
- `v2/src/lib/scheduling/scheduleEngine.ts`
- Nuevo módulo: `v2/src/lib/gantt/taskStructure.ts`
- Nuevo módulo: `v2/src/lib/gantt/dependencyEditing.ts`
- Nuevo módulo: `v2/src/lib/gantt/planningValidation.ts`
- Tests: `v2/src/lib/gantt/*.test.ts`, `v2/src/lib/scheduling/scheduleEngine.test.ts`

Trabajo:

1. Crear funciones puras para jerarquía: mover arriba/abajo, subir/bajar nivel, insertar capítulo/subcapítulo/tarea, recalcular WBS y normalizar `outlineLevel`.
2. Crear funciones puras para dependencias: agregar, quitar, reemplazar predecesoras, reemplazar sucesoras, normalizar `to`, deduplicar y preservar `type` + `lag`.
3. Crear una capa de validación preventiva que use `validateDependencies` y agregue chequeos de WBS, jerarquía, tareas resumen, referencias inválidas y riesgos básicos de planificación.
4. Definir contrato de impacto antes/después: fechas afectadas, ruta crítica, costo, avance, restricciones y mensajes accionables.

Verificación:

- `npm test -- --runInBand taskStructure.test.ts dependencyEditing.test.ts planningValidation.test.ts scheduleEngine.test.ts`
- Casos: múltiples predecesoras/sucesoras, lags distintos, ciclos, autodependencia, mover tarea con hijos, mover entre padres, recalcular WBS, detectar inconsistencia antes de guardar.

## Fase 1: Tabla usable, controles persistentes y eficiencia base

Archivos/sistemas:

- `v2/src/components/gantt/table/GanttTable.tsx`
- `v2/src/components/gantt/table/GanttRow.tsx`
- `v2/src/components/gantt/table/ColumnSelector.tsx`
- `v2/src/components/views/TaskSheetView.tsx`
- `v2/src/lib/mpp/taskColumns.ts`
- `v2/src/app/actions/project.ts`

Trabajo:

1. Mantener selector de columnas siempre visible con scroll horizontal.
2. Mantener `% completado` con 2 decimales.
3. Agregar búsqueda y filtros avanzados reutilizables en Gantt y Task Sheet.
4. Persistir columnas, anchos, filtros, defaults y vistas guardadas por rol en `project_data`.
5. Agregar shortcuts, paleta de comandos y previsualización de cambios antes de aplicar.
6. Agregar modo simple/avanzado, ayuda inline, errores con solución sugerida y onboarding contextual.

Verificación:

- `npm test -- --runInBand GanttTable.test.tsx GanttView.test.tsx`
- E2E: tabla ancha, selector visible, filtros/vistas persisten tras guardar y recargar.
- Revisión visual desktop/mobile.

## Fase 2: Editor visual de jerarquía y plantillas constructivas

Archivos/sistemas:

- `v2/src/components/gantt/table/GanttTable.tsx`
- `v2/src/components/gantt/table/GanttRow.tsx`
- `v2/src/components/gantt/toolbar/ProjectToolbar.tsx`
- `v2/src/lib/state/ProjectContext.tsx`
- `v2/src/lib/gantt/taskStructure.ts`
- `v2/src/components/views/MatrixEditorView.tsx`
- `v2/src/lib/matrix/templates.ts`

Trabajo:

1. Exponer acciones en `ProjectContext`: `indentTask`, `outdentTask`, `moveTaskUp`, `moveTaskDown`, `insertTask`, `insertSummary`, `applyStructureTemplate`.
2. Agregar botones para subir/bajar nivel y mover arriba/abajo con iconos.
3. Agregar creación explícita de capítulo, subcapítulo y tarea.
4. Agregar drag-and-drop de filas usando el mismo motor de transformación.
5. Agregar plantillas constructivas de capítulos y reglas repetitivas de dependencias.
6. Mantener undo/redo, WBS, `outlineLevel`, `isSummary` y rollups.

Verificación:

- Unit tests de transformaciones.
- Component tests de controles y estados disabled.
- E2E: crear capítulo, aplicar plantilla, mover tarea dentro/fuera de padre, guardar, recargar.

## Fase 3: Editor visual de dependencias con impacto explicado

Archivos/sistemas:

- `v2/src/components/gantt/table/GanttRow.tsx`
- Nuevo componente: `v2/src/components/gantt/dependencies/DependencyPopover.tsx`
- Nuevo componente: `v2/src/components/gantt/dependencies/DependencyPanel.tsx`
- `v2/src/components/gantt/interaction/useCreateDependency.ts`
- `v2/src/lib/gantt/dependencyEditing.ts`
- `v2/src/lib/gantt/planningValidation.ts`
- `v2/src/lib/state/ProjectContext.tsx`

Trabajo:

1. Agregar popover desde celda de predecesoras con búsqueda de tareas.
2. Agregar panel lateral para revisar y editar todas las relaciones de una tarea.
3. Permitir múltiples predecesoras y sucesoras, cada una con tipo `FS`/`SS`/`FF`/`SF` y lag independiente.
4. Sincronizar edición textual, popover, panel lateral y drag del chart sobre el mismo estado.
5. Bloquear ciclos, autodependencias y referencias inválidas con mensajes accionables.
6. Mostrar impacto antes/después al editar dependencias: fechas, ruta crítica, costo/avance cuando aplique.

Verificación:

- Unit tests de dependencia.
- Component tests de popover/panel.
- E2E: múltiples predecesoras/sucesoras con lags distintos, ciclo bloqueado, guardar/recargar.

## Fase 4: Asistente de validación y recomendaciones

Archivos/sistemas:

- `v2/src/lib/gantt/planningValidation.ts`
- Nuevo módulo: `v2/src/lib/gantt/planningRecommendations.ts`
- Nuevo componente: `v2/src/components/gantt/assistant/PlanningAssistantPanel.tsx`
- `v2/src/components/views/GanttView.tsx`
- `v2/src/lib/scheduling/bottlenecks.ts`
- `v2/src/lib/scheduling/scheduleEngine.ts`

Trabajo:

1. Implementar asistente determinístico inicial: detectar inconsistencias, riesgos, dependencias faltantes probables, restricciones conflictivas y problemas de ruta crítica.
2. Proponer recomendaciones priorizadas sin aplicar cambios automáticamente.
3. Permitir revisar cambios antes de aplicar.
4. Generar resumen ejecutivo de estado, riesgos y siguientes acciones.
5. Dejar asistencia con IA generativa como roadmap mediano plazo, con confirmación humana obligatoria.

Verificación:

- Unit tests para reglas de recomendación.
- Component tests del panel.
- E2E: recomendación visible, previsualización, aplicar/cancelar, undo/redo.

## Fase 5: What-if, línea de balance y curvas S con feedback automático

Archivos/sistemas:

- `v2/src/components/charts/LineOfBalance.tsx`
- `v2/src/components/views/SCurveView.tsx`
- `v2/src/lib/scheduling/lob.ts`
- `v2/src/lib/scheduling/scurve.ts`
- Nuevo módulo: `v2/src/lib/gantt/scenarios.ts`

Trabajo:

1. Agregar escenarios what-if para comparar cambios sin alterar el plan base hasta confirmar.
2. Generar feedback automático desde línea de balance: ritmo, interferencias, actividades desbalanceadas, ubicaciones críticas.
3. Generar feedback automático desde curvas S: desviación avance/costo, tendencia y alertas.
4. Integrar semáforos accionables y recomendaciones priorizadas.

Verificación:

- Unit tests para escenarios y diagnósticos LOB/S-curve.
- Component tests para comparación.
- E2E: crear escenario, comparar, aplicar o descartar.

## Fase 6: Triple restricción, PMI y reporting ejecutivo

Archivos/sistemas:

- `v2/src/components/views/BottlenecksView.tsx`
- `v2/src/components/views/SCurveView.tsx`
- `v2/src/components/budget/*`
- `v2/src/components/charts/*`
- Nuevo componente: `v2/src/components/reports/ExecutivePlanningDashboard.tsx`

Trabajo:

1. Unificar cronograma, costo, alcance y avance en un dashboard ejecutivo.
2. Explicar variaciones costo/avance y relación con ruta crítica.
3. Mostrar semáforos accionables basados en triple restricción y conceptos PMI.
4. Mantener el reporting acotado: mejorar decisión gerencial sin construir BI completo.
5. Considerar portafolio simple para dirección sin reemplazar PPM empresarial.

Verificación:

- Component tests de métricas.
- E2E de dashboard ejecutivo con datos de costo, avance y cronograma.
- Revisión visual con proyecto grande.

## Fase 7: Integraciones de valor

Archivos/sistemas:

- `v2/src/lib/import/*`
- `v2/src/app/api/import-mpp/*`
- `v2/src/app/api/parse-mpp/*`
- `v2/src/components/upload/*`
- Nuevos módulos/API para Last Planner AIA cuando exista contrato disponible.

Trabajo:

1. Mantener importación/exportación MPP confiable.
2. Agregar Excel bidireccional y smart paste.
3. Mantener integración presupuesto/costos.
4. Agregar reportes PDF/Excel.
5. Priorizar API con Last Planner AIA como integración inicial.
6. Diseñar puntos de extensión para Power BI y herramientas de obra/campo.
7. Excluir ERP profundo, marketplace/plugins y edición móvil completa.

Verificación:

- Tests de import/export.
- E2E de smart paste y reportes.
- Contrato API simulado para Last Planner AIA antes de integrar servicio real.

## Fase 8: Persistencia, auditoría y performance

Archivos/sistemas:

- `v2/src/app/actions/project.ts`
- `v2/src/app/project/[id]/page.tsx`
- `v2/src/components/views/GanttView.tsx`
- `v2/e2e/production-gantt-benchmark.spec.ts`
- `v2/scripts/benchmark-gantt-recalculation.ts`

Trabajo:

1. Confirmar que todos los cambios se serializan/deserializan por `project_data`.
2. Crear endpoints API solo cuando el modelo actual no alcance.
3. Agregar auditoría mínima: tipo de acción, tarea(s), timestamp y resumen.
4. Medir tiempo de edición, errores prevenidos, adopción de funciones avanzadas y confianza en guardado/recarga.
5. Benchmark con proyectos grandes para tabla, jerarquía, dependencias, asistente y escenarios.

Verificación:

- `npm test -- --runInBand`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`
- Benchmark específico con proyecto grande.
- Revisión visual desktop/mobile.

## Riesgos y decisiones

- La ambición aceptada es de producto, no de un solo bugfix. Debe ejecutarse en fases, con commits/PRs pequeños.
- La IA generativa debe quedar como roadmap mediano plazo; en este paquete inicial conviene empezar por reglas determinísticas y recomendaciones explicables.
- Ninguna recomendación o acción inteligente debe modificar el cronograma sin confirmación explícita.
- Last Planner AIA requiere contrato de API antes de implementación real; mientras tanto se debe trabajar con interfaz o mock.
- Los rollups de tareas resumen deben definirse antes de jerarquía avanzada.
- Drag-and-drop debe compartir motor con botones para evitar comportamientos divergentes.
- La edición de sucesoras debe seguir usando el modelo canónico actual: dependencias almacenadas en la tarea sucesora.
- La auditoría debe comenzar mínima en `project_data`; una tabla dedicada solo si el volumen o consultas lo justifican.
- Las integraciones Power BI, ERP profundo y mobile authoring completo no deben bloquear la primera ola.
