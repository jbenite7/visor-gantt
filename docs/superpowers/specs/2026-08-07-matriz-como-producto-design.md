# P4 · La matriz como producto — diseño

Fecha: 2026-08-07 · Carril **B** · Goal: [`goals/matriz-como-producto/goal.md`](../../../goals/matriz-como-producto/goal.md)
Requisitos: **Bloque E** (10 decisiones) más **M27** y **M28** de
[la spec del grilleo del 2026-08-06](2026-08-06-supergoal-backlog-ux-design.md). Las decisiones están
tomadas; este documento las traduce a código y no las reabre.

Depende de **P3 · Motor de detección**: el generador de matrices desde `.mpp` lo usa para proponer
ubicaciones y sistemas. Sin él propondría los mismos 44 fallos.

---

## 1. Qué hay hoy, leído en el código

La programación matricial no es una maqueta. Son **2.100 líneas** repartidas en siete archivos, con tests,
que ya hacen lo difícil:

| Archivo | Qué resuelve hoy |
|---|---|
| `matrixGenerator.ts` (595) | Genera tareas, resúmenes, WBS, dependencias de receta y provenance desde el plan |
| `matrixSync.ts` (333) | Aplica el plan sobre las tareas, detecta conflictos y devuelve rendimiento observado |
| `tree.ts` (333) | Árboles de alcances y ubicaciones hasta 10 niveles, con reconciliación de celdas |
| `templates.ts` (265) | Una plantilla de fábrica («Vivienda vertical») y tres formas de crear un plan |
| `matrixFromGantt.ts` (270) | Espejo de un cronograma importado: una celda por tarea |
| `MatrixEditorView.tsx` (1.244) | Editor con tres modos (alcances, ubicaciones, matriz) y panel de celda |
| `types/matrix.ts` (155) | El modelo completo |

El problema no es que falte músculo. Es que **cada pieza se quedó a un paso de servir en obra**:

| Lo que hace | Lo que le falta para servir |
|---|---|
| `addWorkDays` salta domingos (`matrixGenerator.ts:56-69`) | El proyecto ya tiene calendario con festivos y jornada (`projectCalendar.ts`). La matriz lo ignora |
| `lineOfBalance.offsetDays` desplaza cada ubicación N días (`getCellStart`, `:243-263`) | Es un **desfase fijo**, no una dependencia: si el piso 1 se atrasa, el piso 2 no se mueve |
| `detectConflicts` los encuentra (`matrixSync.ts:104-157`) | Los devuelve y nadie los muestra: gana el más reciente en silencio |
| `syncMatrixPlanFromTasks` calcula el rendimiento observado y lo deja en `feedback.status = "pendingApproval"` | **No hay ninguna pantalla que apruebe nada.** El ciclo nunca se cierra |
| `DEFAULT_MATRIX_TEMPLATE` existe | Una sola, de fábrica, y no se puede guardar la tuya |
| `buildMatrixPlanFromGantt` refleja un `.mpp` | Una celda por tarea y una única ubicación llamada «Cronograma importado»: es un espejo, no una propuesta |
| El editor edita celda a celda | Ni selección múltiple, ni duplicar, ni crear N ubicaciones, ni editor de recetas |
| El editor pinta una `<table>` completa y recalcula `generateScheduleFromMatrix(draft)` en cada cambio (`:299`) | Con 1000 celdas eso es 1000 nodos y una generación entera por tecla |

## 2. Las diez decisiones, y cómo se implementa cada una

### E1 · Ritmo piso a piso → dependencias reales, configurables por alcance

Hoy: `getCellStart` suma `leafIndex × offsetDays` a la fecha base. Es una foto, no un vínculo.

Se sustituye por un modo de encadenado declarado en la receta y **sobreescribible por alcance**:

```ts
type LocationChainingMode = "encadenado" | "paralelo";
interface LocationChaining {
  mode: LocationChainingMode;
  lagDays?: number;
  /** Si se indica, solo esa actividad engancha con la ubicación siguiente. Por defecto, todas. */
  activityId?: string;
  /** Invierte el orden de las ubicaciones (de arriba abajo). */
  reverse?: boolean;
}
```

- `encadenado`: se emite una dependencia **FS real** entre cada actividad de una ubicación y **la misma
  actividad** en la ubicación siguiente. Es el modelo de cuadrilla: la que termina la mampostería del piso
  1 empieza la del piso 2. Retrasar el piso 1 mueve el piso 2, porque lo mueve el motor de cálculo, no una
  suma de días. Con `activityId` el enganche se reduce a una sola actividad, para las obras donde solo un
  oficio marca el ritmo.
- `paralelo`: no se emite dependencia. Es lo que pide el grilleo para los acabados de torres distintas.

`lineOfBalance.offsetDays` **se conserva** y sigue funcionando para los planes que ya existan: si una
receta no declara `locationChaining`, se comporta exactamente como hoy. Nada de lo guardado se rompe.

«Configurable por alcance» se resuelve con `ScopeNode.locationChaining`, que gana a la de la receta. Es el
alcance quien sabe si encadena («estructura») o no («acabados»).

### E2 · Calendario del proyecto

`generateScheduleFromMatrix(plan)` pasa a `generateScheduleFromMatrix(plan, options?)` con
`options.calendar?: ProjectCalendar`. Sin calendario, el comportamiento actual —saltar domingos— se
mantiene intacto, de modo que ningún test existente cambia.

Con calendario, `addWorkDays` usa `isProjectWorkingDay` de `projectCalendar.ts`, que ya resuelve festivos,
días laborables y excepciones por fecha. **No se escribe lógica de calendario nueva**: se enchufa la que
hay.

El aviso que pide el grilleo («avisa si al aplicarlo las fechas se desplazan mucho») es una función pura
que genera dos veces y compara: `describeCalendarShift(plan, calendar)` devuelve la tarea más desplazada y
cuántos días. Umbral: **más de 3 días laborables** en alguna tarea. Se elige 3 porque por debajo el
desplazamiento es el ruido normal de un festivo suelto, y por encima significa que el calendario cambia el
plan de verdad.

### E3 · Plantillas: de fábrica, propias y generadas desde un `.mpp`

Tres cosas distintas que la decisión agrupa:

1. **De fábrica por tipo de obra.** Hoy hay una. Se añaden dos más, con el vocabulario que ya aparece en
   los archivos reales del repositorio: *Vivienda vertical* (la que hay), *Urbanismo y obras exteriores*
   (vías, redes externas, andenes, zonas verdes) y *Obra lineal por tramos* (estaciones y tramos, como el
   `.mpp` de la Estación 16). Un catálogo, no una constante suelta.
2. **Guardar la tuya.** `templateFromPlan(plan, name)` extrae del plan actual su árbol de alcances, sus
   ubicaciones y sus recetas, **sin las celdas ni las fechas**: una plantilla es la forma de la obra, no
   una obra concreta.
3. **Generar desde un `.mpp` cargado.** Es lo más grande de este bloque y merece su propia sección.

### E3b · El generador de matrices desde un cronograma

Lo que existe (`buildMatrixPlanFromGantt`) es un **espejo**: una celda por tarea, una sola ubicación
llamada «Cronograma importado». Sirve para no perder nada al importar, y se conserva tal cual.

Lo que pide el grilleo es otra cosa: **una propuesta que el usuario revisa**. Módulo nuevo,
`matrixProposal.ts`, que con el motor de P3 deduce:

| Eje | De dónde sale |
|---|---|
| **Ubicaciones** | `resolveTaskLocation` sobre cada tarea: los pisos y sótanos detectados, ordenados por su número. Las tareas de obra general van a una ubicación «Obra general» |
| **Alcances** | El nombre de la actividad sin su ubicación (`Mampostería piso 3` → `Mampostería`), agrupado |
| **Recetas** | Un alcance que aparece en tres o más ubicaciones con las mismas actividades en el mismo orden es una receta. El orden sale de las fechas de inicio |
| **Rendimientos** | La duración mediana observada de esa actividad en las ubicaciones donde aparece. **Mediana, no media**: un piso con un paro de dos semanas no debe fijar el ritmo de la torre |

El resultado **no es un `MatrixPlan`**, es una `MatrixProposal`: cada elemento propuesto lleva su confianza
y su evidencia («aparece en 12 pisos con 5 días de mediana»), y el usuario **acepta o descarta elemento a
elemento** antes de que se construya nada. Convertirla en plan es un paso explícito y aparte
(`planFromProposal`).

Esto también obliga a decir algo incómodo con claridad: **el generador propone, no adivina.** Si el
cronograma no tiene patrón repetido, la propuesta sale casi vacía y lo dice, en vez de inventar una matriz
que nadie pidió.

### E4 · Editor de recetas completo

Operaciones puras sobre `ActivityRecipe`, en `recipes.ts`: `addRecipeActivity`, `removeRecipeActivity`,
`moveRecipeActivity`, `setRecipeDependency`, `removeRecipeDependency`.

Dos reglas que el editor debe garantizar y que por tanto van en las funciones, no en la interfaz:

- **Quitar una actividad quita sus dependencias.** Si no, la receta queda con vínculos a algo que ya no
  existe y `generateScheduleFromMatrix` los ignora en silencio (`:536`, `if (!from || !to) continue`).
- **Una dependencia no puede apuntar a una actividad posterior a sí misma en ciclo.** `setRecipeDependency`
  rechaza un ciclo directo (A→B y B→A) devolviendo la receta sin cambios y un motivo.

### E5 · Panel para aprobar rendimientos observados

El dato ya existe: `syncMatrixPlanFromTasks` escribe `cell.feedback` con `observedDurationDays`,
`suggestedProductivityPerDay` y `status: "pendingApproval"`. Nadie lo lee.

Se añaden las transiciones puras (`approveCellFeedback`, `dismissCellFeedback`) y el panel que las llama.
Aprobar escribe `productivityOverridePerDay` en la celda: **la próxima torre se programa con los datos de
la anterior**, que es literalmente lo que pide la decisión.

### E6 · Conflictos con elección

`detectConflicts` ya los encuentra pero solo devuelve un mensaje. Se enriquece con **las dos versiones**,
para que el usuario pueda elegir con la información delante:

```ts
interface MatrixSyncConflict {
  taskId: string | number;
  cellId: string;
  field: "name" | "duration" | "start" | "finish";
  matrixValue: string;   // lo que dice la matriz
  ganttValue: string;    // lo que se editó en el Gantt
  message: string;
}
```

Y `applyMatrixUpdate` acepta `resolutions: Record<string, "matriz" | "gantt">`. Sin resolución explícita se
conserva **el comportamiento actual** (gana lo generado por la matriz), para que nada existente cambie de
significado por accidente.

### E7 · Duplicar y crear N ubicaciones

`duplicateAreaNode(plan, areaId)` y `duplicateScopeNode(plan, scopeId)`: copian el nodo con sus hijos y
**crean las celdas equivalentes** con la misma receta, cantidad y estado. Duplicar sin las celdas sería
duplicar el encabezado y dejar la fila vacía.

`createAreaRange(plan, { parentId, pattern, from, to, type })` con `pattern` que lleva `{n}`:
`"Piso {n}"`, de 1 a 20, crea 20 ubicaciones y sus celdas de una vez. `from` puede ser mayor que `to` para
crear sótanos descendentes.

### E8 · Edición en lote

`applyBulkCellEdit(plan, cellIds, patch)` donde `patch` es
`{ recipeId?, quantity?, unit?, active?, productivityOverridePerDay? }`. Solo se aplican los campos
presentes: pasar `{ active: false }` no borra la receta.

Las celdas que no existen todavía (un par alcance × ubicación que nunca se tocó) **se crean** con el parche
aplicado. Si no, seleccionar una fila entera y activarla dejaría la mitad sin efecto y el usuario no
sabría por qué.

La selección (rango con mayúsculas, fila, columna) es de la interfaz y vive en el editor.

### E9 · Escala para más de 1000 celdas

Dos cuellos, medidos leyendo el código:

1. **`generateScheduleFromMatrix(draft)` corre entero en cada cambio del borrador** (`MatrixEditorView.tsx:299`).
   Con 1000 celdas × 4 actividades son 4000 tareas regeneradas por tecla.
   **Solución:** caché por celda. `generateScheduleFromMatrix(plan, { cache })` reutiliza el resultado de
   toda celda cuya firma (`id`, `recipeId`, `active`, `quantity`, `productividad`, overrides, fecha base)
   no cambió. Editar una celda recalcula una.
2. **La tabla pinta todas las celdas** y por cada una recorre la receta y sus overrides
   (`MatrixEditorView.tsx:1039-1084`). **Solución:** dibujar solo las filas visibles, con una ventana
   calculada a partir del desplazamiento, y precalcular el resumen de cada celda una sola vez en un mapa.

**Cifra objetivo, dicha como test, no como intención:** un plan de **1200 celdas** (30 alcances × 40
ubicaciones) se genera con caché en menos de una décima parte de las celdas recalculadas tras editar una,
y el editor monta menos de 200 celdas en el DOM.

### E10 · M27 y M28 — la matriz vuelve al menú y avisa antes de salir

**M27 (fuera del menú)** es un cambio en el menú lateral, que vive en `ViewSidebar.tsx` y lo monta
`GanttView.tsx`. **Es territorio del carril A.** Va en la Fase 3.

**M28 (el borrador se pierde sin aviso)** tiene dos mitades:
- Saber si hay cambios sin aplicar es del editor: `hasUnappliedChanges(draft, applied)`, función pura, Fase 1.
- Interceptar la salida de la vista es de `GanttView.tsx`. Fase 3.

## 3. Arquitectura y fases

### Fase 1 — El motor (sin interfaz)

Todo en `v2/src/lib/matrix/`. Ninguna dependencia del carril A.

| Archivo | Responsabilidad | Estado |
|---|---|---|
| `matrixCalendar.ts` | `matrixAddWorkDays`, `matrixFinishFromDuration`, `matrixNextWorkDay` | nuevo |
| `matrixCalendarShift.ts` | `describeCalendarShift` — va aparte: usa el generador, que ya usa el calendario | nuevo |
| `matrixGenerator.ts` | Acepta `options.calendar` y `options.cache`; emite el encadenado entre ubicaciones | se amplía |
| `matrixChaining.ts` | Resuelve el modo de encadenado efectivo de una celda (alcance gana a receta) | nuevo |
| `matrixCache.ts` | Firma de celda y caché de generación | nuevo |
| `recipes.ts` | Operaciones puras del editor de recetas | nuevo |
| `bulk.ts` | `applyBulkCellEdit`, `duplicateAreaNode`, `duplicateScopeNode`, `createAreaRange` | nuevo |
| `feedback.ts` | `approveCellFeedback`, `dismissCellFeedback`, `listPendingFeedback` | nuevo |
| `matrixSync.ts` | Conflictos con las dos versiones y con resolución elegida | se amplía |
| `templateCatalog.ts` | Catálogo de fábrica + `templateFromPlan` | nuevo |
| `matrixProposal.ts` | Propuesta desde un `.mpp` usando el motor de P3 | nuevo |
| `draftState.ts` | `hasUnappliedChanges` | nuevo |
| `types/matrix.ts` | Tipos nuevos y campos añadidos | se amplía |

### Fase 2 — El editor

Solo `MatrixEditorView.tsx` y componentes nuevos bajo `src/components/matrix/`. **No toca `GanttView.tsx`.**

| Archivo | Responsabilidad |
|---|---|
| `components/matrix/RecipeEditor.tsx` | Añadir, quitar, reordenar actividades y encadenarlas |
| `components/matrix/TemplatePicker.tsx` | Plantillas de fábrica, propias y «generar desde el cronograma» |
| `components/matrix/ProposalReview.tsx` | Revisar la propuesta elemento a elemento antes de aceptarla |
| `components/matrix/FeedbackPanel.tsx` | Aprobar o descartar rendimientos observados |
| `components/matrix/ConflictChooser.tsx` | Elegir qué gana, tarea por tarea |
| `components/matrix/LocationBulkActions.tsx` | Duplicar y crear N ubicaciones |
| `views/MatrixEditorView.tsx` | Selección múltiple, panel de lote y dibujo por ventana |

### Fase 3 — Integración · **DEPENDE DEL CARRIL A**

**No se empieza hasta que el carril A haya fusionado su trabajo a `main`.** Toca los dos archivos que el
goal maestro le asigna: `GanttView.tsx` (1.889 líneas, 15 vistas) y `ProjectContext.tsx`.

Contenido: la matriz en el menú lateral dentro de «Trabajo» (M27), el aviso al salir con cambios sin
aplicar (M28), el paso del calendario del proyecto al generador, y la persistencia del diccionario de
correcciones de P3 junto al plan.

Es una fase corta —cuatro puntos de cableado— precisamente porque todo lo demás se hizo antes.

## 4. Riesgos

**R1 · Cambiar el encadenado cambia cronogramas ya generados.** Mitigación: `locationChaining` es opcional;
sin él, el comportamiento es idéntico al de hoy. Un plan guardado no cambia de fechas por actualizar la app.

**R2 · La caché puede servir datos viejos.** Es el riesgo clásico. Mitigación: la firma de celda incluye
**todo** lo que entra en su cálculo, incluida la fecha base del plan y el calendario, y hay un test que
edita cada campo del modelo uno a uno y comprueba que la firma cambia.

**R3 · El generador desde `.mpp` puede proponer basura convincente.** Mitigación de diseño: la propuesta
nunca se aplica sola, cada elemento lleva su evidencia en lenguaje de obra, y el umbral para proponer una
receta son **tres ubicaciones**, el mismo que ya usa Unidad Típica.

**R4 · La Fase 3 puede quedarse esperando al carril A.** Es aceptable y previsto: las Fases 1 y 2 dejan la
matriz completa y probada; lo único que falta sin la Fase 3 es llegar a ella por el menú, y hoy ya se llega
por `⌘K`. Si el carril A se retrasa, este proyecto se fusiona sin su Fase 3 y esta se ejecuta después.

## 5. Preguntas abiertas

Se anotan porque la spec del grilleo no las resuelve y no se ha inventado una respuesta.

1. **Cuál es el orden de las ubicaciones para encadenar.** Con el motor de P3 el orden natural es el número
   de ubicación (sótano 3 → sótano 1 → piso 1 → cubierta). Pero una obra puede construir la estructura de
   abajo arriba y los acabados de arriba abajo — PDC V2 tiene incluso un `classifyBuildDirection` para eso.
   **Se implementa el orden ascendente**, con `LocationChaining.reverse?: boolean` para invertirlo por
   alcance. Qué obras necesitan el descendente por defecto es una pregunta para el usuario.
2. **Qué pasa con las celdas de una ubicación que se borra tras haber generado tareas.** Hoy
   `removeAreaNode` quita el nodo y sus celdas, y las tareas generadas quedan huérfanas hasta la siguiente
   aplicación. No hay decisión del grilleo al respecto. **No se cambia** en este proyecto; queda anotado.
3. **Umbral del aviso de calendario: 3 días.** Elegido aquí, no por el usuario. Es un valor, no una
   arquitectura: cambiarlo es tocar una constante.
