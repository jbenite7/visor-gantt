# Predecesoras y sucesoras usan ID de fila

## Enfoque

Separar el identificador interno de la tarea del identificador visible de MS Project. En importacion, las relaciones pueden llegar por `UID`, pero las columnas visibles `Predecessors` y `Successors`, la tabla Gantt y las ediciones del usuario deben hablar en `ID` de fila. Los campos `Unique ID Predecessors` y `Unique ID Successors` se mantienen como salida separada basada en `Unique ID`.

## Pasos

1. Localizar y fijar el contrato de identificadores en v2.
   - Archivos: `v2/src/components/upload/mpp-to-gantt.ts`, `v2/src/components/gantt/types.ts`, `v2/src/lib/mpp/mppCalculationEngine.ts`.
   - Definir una forma unica de obtener el ID visible de fila desde una `GanttTask`, preferiblemente desde `mppFields.ID` o un campo preservado equivalente, con fallback controlado.
   - Definir una forma unica de obtener el Unique ID desde `mppFields.UNIQUE_ID`, con fallback controlado.
   - Verificacion: prueba unitaria con una tarea donde `ID=7` y `UID/UNIQUE_ID=101`.

2. Corregir la conversion de importacion MPP.
   - Archivo: `v2/src/components/upload/mpp-to-gantt.ts`.
   - Al convertir `MSPTask[]`, construir un mapa `UID -> ID de fila`.
   - Convertir `PredecessorLink.PredecessorUID` y el `task.UID` de destino a los ID de fila antes de crear `GanttDependency`.
   - Preservar `UID`/`UNIQUE_ID` en `mppFields` para que los campos Unique ID sigan disponibles.
   - Verificacion: ampliar `v2/src/components/upload/mpp-to-gantt.test.ts` con tareas donde `UID` e `ID` no coinciden y una dependencia importada por `PredecessorUID`.

3. Corregir los campos calculados MPP.
   - Archivo: `v2/src/lib/mpp/mppCalculationEngine.ts`.
   - Hacer que `fields.ID`, `fields.PREDECESSORS` y `fields.SUCCESSORS` usen el ID de fila.
   - Mantener `fields.UNIQUE_ID_PREDECESSORS` y `fields.UNIQUE_ID_SUCCESSORS` usando `UNIQUE_ID`.
   - Revisar `dependencyLabel()` para que no imprima `dep.from` directamente si ese valor puede ser interno.
   - Verificacion: ajustar o agregar prueba en `v2/src/lib/mpp/mppCalculationEngine.test.ts` con `ID != UNIQUE_ID`, esperando `PREDECESSORS: "7SS-1d"` y `UNIQUE_ID_PREDECESSORS: "101"`.

4. Corregir edicion visible de predecesoras y sucesoras.
   - Archivos: `v2/src/components/gantt/table/GanttRow.tsx`, `v2/src/components/gantt/dependencies/DependencyPopover.tsx`, `v2/src/components/gantt/dependencies/DependencyPanel.tsx`, `v2/src/lib/gantt/dependencyEditing.ts`.
   - Asegurar que `formatDependencies()` y `parsePredecessors()` muestran/aceptan ID de fila.
   - Si internamente se mantiene otro identificador, resolver el texto ingresado contra un mapa `ID de fila -> task.id` antes de guardar.
   - En el panel de sucesoras, mostrar y guardar relaciones equivalentes al ID de fila visible.
   - Verificacion: ampliar `v2/src/components/gantt/table/GanttTable.test.tsx` con `id/UID` distintos y entradas por ID visible.

5. Verificar persistencia y recalculo.
   - Archivos: `v2/src/lib/state/ProjectContext.tsx`, `v2/src/components/views/GanttView.test.tsx`, posibles actions de guardado si aparece una conversion adicional.
   - Confirmar que `updateTask(..., "dependencies")` y `updateTask(..., "successors")` guardan la relacion canonica correcta y que al recargar se vuelve a mostrar con ID de fila.
   - Verificacion: ampliar `v2/src/components/views/GanttView.test.tsx` para guardar una relacion editada con ID visible cuando `Unique ID` es diferente.

6. Verificacion final.
   - Ejecutar pruebas enfocadas:
     - `docker compose run --rm frontend npm test -- mpp-to-gantt.test.ts mppCalculationEngine.test.ts GanttTable.test.tsx GanttView.test.tsx`
   - Luego ejecutar:
     - `docker compose run --rm frontend npm run lint`
     - `docker compose run --rm frontend npm run build`
   - Levantar o refrescar Docker con el codigo actual y hacer chequeo en navegador: importar o abrir un proyecto con `ID != Unique ID`, editar una predecesora usando ID de fila, guardar, recargar y confirmar que la columna visible conserva el ID de fila.

## Riesgos y preguntas abiertas

- Hay que evitar romper flechas, recalculo y autosave si el motor actual usa `task.id` como clave canonica. Si cambiar `task.id` a ID de fila causa menos superficie que traducir en bordes, elegir esa ruta solo despues de revisar asignaciones, recursos y referencias cruzadas.
- El backend legacy guarda `successor_uid` y `predecessor_uid`. Queda fuera del alcance inicial porque el objetivo aceptado es v2, salvo que se demuestre que una ruta viva de v2 depende de esa tabla.
- Algunos fixtures actuales probablemente tienen `ID == UID`, lo que oculta el bug. Las pruebas nuevas deben forzar IDs divergentes.
