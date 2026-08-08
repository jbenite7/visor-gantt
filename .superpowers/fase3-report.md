# Fase 3 · La matriz como producto — informe

Rama: `claude/infallible-ellis-218f73` (con `main` fusionado: merge `3f229fc`).
Directorio: `/Volumes/Crucial X6/Developer/visor-gantt/.claude/worktrees/infallible-ellis-218f73/v2`.

**Sin commits.** Mis reglas de operación prohíben commitear; los cambios quedan
en el árbol de trabajo, listos para que quien coordina los divida en los tres
commits previstos (punto 1, punto 2, punto 3). Por eso no hay hashes.

Archivos tocados:

- `v2/src/components/views/MatrixEditorView.tsx`
- `v2/src/components/views/MatrixEditorView.test.tsx`
- `v2/src/components/views/GanttView.tsx`
- `v2/src/components/views/GanttView.test.tsx`

No se tocó `ProjectContext.tsx`: `runUndoable` ya servía tal cual.
No se tocó el menú: sigue en 11 entradas.

## 1 · El calendario del proyecto llega al generador

- `MatrixEditorView` acepta `calendar?: ProjectCalendar`.
- La vista previa usa `generateScheduleFromMatrix(draft, { calendar })`. Sin
  `calendar` el objeto lleva `calendar: undefined`, que es exactamente el
  camino de antes.
- Se añadió `data-testid="matrix-preview"` con el fin de la vista previa
  (`… · fin YYYY-MM-DD`): sin un dato observable no había forma honesta de
  probar que el calendario entra.
- Al pulsar «Aplicar», si `describeCalendarShift(draft, calendar)` supera el
  umbral, se muestra su `message` en `data-testid="matrix-calendar-warning"`
  con «Aplicar de todas formas» y «Revisar antes». Es aviso, no bloqueo.
- `GanttView` pasa `calendar={calendar}` al editor.

**Lo que no se pudo hacer:** `applyMatrixUpdate` **no admite calendario**. Su
`ApplyMatrixUpdateInput` es `{ tasks, currentPlan, nextPlan, resolutions }` y
por dentro llama `generateScheduleFromMatrix(nextPlan)` sin opciones
(`src/lib/matrix/matrixSync.ts:200`). No se forzó. Consecuencia real: la vista
previa con calendario y las fechas que se aplican **no coinciden** cuando hay
calendario. Es una brecha visible para el usuario y debería cerrarse pronto
(añadir `calendar` al input y pasarlo al generador; el resto ya está listo).

## 2 · Los conflictos se muestran y el usuario elige

- `handleApplyMatrixPlan` calcula `applyMatrixUpdate` y, si
  `result.conflicts.length > 0`, guarda `{ nextPlan, conflicts }` en
  `pendingMatrixConflicts` en vez de aplicar.
- `ConflictChooser` se monta (carga dinámica) encima del editor en la vista
  matriz. `onResolve` llama a `commitMatrixPlan(nextPlan, resolutions)`, que
  **vuelve a llamar** a `applyMatrixUpdate` con las tareas de ahora, no con el
  resultado viejo. `onCancel` limpia el pendiente y no aplica nada.
- Sin conflictos, se aplica directo dentro de `runUndoable`, igual que antes.

## 3 · Borrar una ubicación avisa, deja elegir y se puede deshacer

- `MatrixEditorView` acepta `onRemoveArea?(areaId, policy)`.
- `deleteArea` llama a `describeAreaRemoval(draft, tasks, areaId)`; si hay
  tareas, muestra su `message` en `data-testid="area-removal-choice"` con
  «Borrar también sus tareas», «Conservarlas en el cronograma» y «No borrarla».
  Sin tareas —o sin `onRemoveArea`— se mantiene el borrado de siempre con su
  `window.confirm`.
- `GanttView.handleRemoveMatrixArea` ejecuta
  `removeAreaWithTasks(syncedMatrixPlan ?? matrixPlan, tasks, areaId, policy)`
  dentro de `runUndoable` (`ProjectContext.tsx:719`), con el antes y el después
  que las funciones puras ya devuelven. No hay deshacer nuevo.

## El patrón que ha fallado cuatro veces

Los dos estados nuevos se hicieron para no quedarse viejos:

- **Ubicación pendiente de borrar:** en estado va **solo el `areaId`**. El
  recuento (`describeAreaRemoval`) se recalcula en cada render con el borrador
  y las tareas de ahora, dentro de un `useMemo`. Si la ubicación deja de tener
  tareas, el panel desaparece solo. Esto fue además un fallo real durante la
  implementación: la primera versión guardaba el `preview` y un `useEffect` lo
  limpiaba, y en `GanttView` la identidad de `tasks` cambia en cada render, así
  que el panel se borraba antes de verse.
- **Aviso de calendario:** se calcula al pulsar (comparar dos generaciones es
  caro), pero se guarda junto al `draft` y el `calendar` con los que se calculó
  y solo se muestra mientras siga siendo el mismo par. Nada de `useEffect` que
  limpie.
- **Conflictos pendientes:** la lista mostrada sí es la del momento del clic; si
  el cronograma cambiara por debajo con el diálogo abierto, esa lista podría
  quedar vieja. Se mitiga en el punto que importa: al resolver se recalcula
  `applyMatrixUpdate` con las tareas actuales, así que nunca se aplica un
  resultado viejo. Queda anotado como riesgo residual (cosmético, no de datos).

## Verificación real

### Rojo antes (punto 1)

```
✕ si el calendario mueve las fechas más de la cuenta, avisa antes de aplicar
✕ el aviso no bloquea: se puede aplicar igual
✕ sin calendario la vista previa mantiene el fin de siempre
✓ sin calendario se aplica directo, como hasta ahora
Tests: 3 failed, 34 skipped, 1 passed, 38 total
```

### Rojo antes (punto 2)

```
✓ sin calendario el editor aplica directo, como hasta ahora
✕ el calendario del proyecto llega al editor y avisa antes de aplicar
✕ con conflictos no se aplica a ciegas: se pregunta
✕ elegir «Gantt» conserva el nombre puesto en obra
✕ «No aplicar» deja el cronograma como estaba
Tests: 4 failed, 60 skipped, 1 passed, 65 total
```

### Rojo antes (punto 3)

```
✕ con tareas generadas, avisa y ofrece las dos salidas en vez de confirmar
✕ borrar también las tareas se lo pide al proyecto, que sabe deshacer
✕ conservarlas en el cronograma también se lo pide al proyecto
✓ sin tareas generadas se borra como siempre, con la confirmación de antes
Tests: 3 failed, 38 skipped, 1 passed, 42 total

✕ borrar también las tareas las quita del cronograma y Ctrl+Z las devuelve
✕ conservarlas deja las tareas en el cronograma, sueltas de la matriz
Tests: 2 failed, 65 skipped, 67 total
```

### Verde después

```
$ npx jest
Test Suites: 141 passed, 141 total
Tests:       1312 passed, 1312 total
Time:        11.295 s
```

1297 → 1312: 15 tests nuevos. Ningún test preexistente se puso en rojo.

### Lint

```
$ npx eslint src/components/views/GanttView.tsx src/components/views/MatrixEditorView.tsx src/lib/state/ProjectContext.tsx
src/lib/state/ProjectContext.tsx
  370:5  warning  React Hook useCallback has a missing dependency: 'publishChange'
  415:5  warning  React Hook useCallback has a missing dependency: 'publishChange'
✖ 2 problems (0 errors, 2 warnings)
```

Las dos advertencias son previas y están en un archivo que no toqué.

### Tipos

```
$ npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
(vacío)
```

### Build

```
$ npx next build
… Finalizing page optimization … (build correcto, 12 rutas)
```

## Concerns

1. **`applyMatrixUpdate` ignora el calendario** (detalle arriba). Es la pieza
   que falta para que el punto 1 sea coherente de punta a punta.
2. **Riesgo residual de conflictos viejos** en el `ConflictChooser` si el
   cronograma cambia con el diálogo abierto (solo la lista mostrada; lo que se
   aplica se recalcula).
3. **`console.log` de depuración en un test preexistente**:
   `v2/src/components/views/GanttView.test.tsx:2024` («FILAS TRAS CREAR»),
   commit `baa8070`. No es mío y no lo toqué.
4. **Sin revisión en navegador**: no se abrió el navegador integrado; la
   verificación fue por tests, tipos y build.

---

# Punto 4 · Aplicar con el mismo calendario que la vista previa

El hueco que quedaba abierto: la vista previa prometía unas fechas y al
aplicar salían otras.

## Qué se cambió

`src/lib/matrix/matrixSync.ts`:

- `ApplyMatrixUpdateInput` acepta `calendar?: ProjectCalendar`.
- `buildPreviousExpectedMap(plan, calendar?)` genera con `{ calendar }`.
- `detectConflicts(tasks, plan, calendar?)` se lo pasa al mapa de referencia.
- `applyMatrixUpdate` lo propaga **a las dos**: `generateScheduleFromMatrix(nextPlan, { calendar })`
  y `detectConflicts(..., calendar)`. Si solo una usara el calendario, cada
  aplicación inventaría conflictos fantasma.
- `syncMatrixPlanFromTasks(plan, tasks, calendar?)` también lo propaga a su
  `buildPreviousExpectedMap`: es la referencia con la que decide si la obra se
  desvió, y tenía que medirse con la misma vara.

`src/components/views/GanttView.tsx`: `calendar` va a `applyMatrixUpdate` (en
`commitMatrixPlan` y en el cálculo previo de conflictos) y a
`syncMatrixPlanFromTasks`.

El parámetro es opcional en todas partes. Los tests previos de `matrixSync` no
se tocaron.

## Rojo antes

```
$ npx jest src/lib/matrix/matrixSync.test.ts -t "mismo calendario"
✕ el fin que se aplica es el que prometía la vista previa
✕ con calendario no aparecen conflictos fantasma
✓ sin calendario todo se comporta como siempre
Expected: 1768453200000
Received: 1768280400000
Tests: 2 failed, 12 skipped, 1 passed, 15 total
```

Dos días de diferencia: exactamente los dos festivos del calendario de prueba.

## Verde después

```
$ npx jest src/lib/matrix/matrixSync.test.ts
Tests: 15 passed, 15 total
```

# Los cuatro commits

| # | hash | mensaje |
|---|------|---------|
| 1 | `a5fec7b` | feat(matriz): la matriz genera con el calendario del proyecto y avisa si desplaza las fechas |
| 2 | `f2bd0af` | feat(matriz): mostrar los conflictos y dejar elegir cual gana al aplicar |
| 3 | `fa0743d` | feat(matriz): borrar una ubicacion avisa, deja elegir y se puede deshacer |
| 4 | `ec7d279` | fix(matriz): aplicar con el mismo calendario que usa la vista previa |

**Cómo se repartió.** `GanttView.tsx` es transversal a los cuatro puntos y
`MatrixEditorView.tsx` a los puntos 1 y 3, así que no bastaba con repartir por
archivo: se reconstruyeron cuatro estados intermedios del árbol y se commiteó
cada uno. Cada commit compila y sus tests pasan por separado — el estado 1 y el
2 se ejecutaron antes de commitear. Dos matices honestos:

- El punto 2 **reescribe** el `handleApplyMatrixPlan` que el punto 1 dejó
  intacto; el commit 2 contiene esa reescritura entera, que es donde le toca.
- El commit 1 incluye el `calendar={calendar}` que `GanttView` pasa al editor,
  aunque el consumidor de verdad esté en `MatrixEditorView`: son la misma idea y
  partirlo habría dejado un commit con una prop que nadie recibe.

# Verificación final (después de los cuatro commits)

```
$ npx jest --runInBand
Test Suites: 141 passed, 141 total
Tests:       1315 passed, 1315 total
Time:        18.578 s
```

1297 (antes de la fase) → 1312 (puntos 1-3) → 1315 (punto 4): 18 tests nuevos.
Ningún test preexistente se puso en rojo en ningún momento.

```
$ npx eslint src/components/views/GanttView.tsx src/components/views/MatrixEditorView.tsx src/lib/matrix/matrixSync.ts
(sin salida: limpio)

$ npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
(vacío)

$ npx next build
(build correcto)
```

## Concerns que siguen abiertos

1. **Resuelto** el hueco del calendario al aplicar (era el concern 1).
2. Sigue el riesgo residual de la lista de conflictos mostrada si el cronograma
   cambia con el diálogo abierto (cosmético: lo que se aplica se recalcula).
3. Sigue el `console.log` de depuración preexistente en
   `v2/src/components/views/GanttView.test.tsx:2024`, del commit `baa8070`.
4. **Nuevo, para vigilar:** ahora `syncMatrixPlanFromTasks` mide la desviación
   de obra con el calendario del proyecto. Es lo coherente, pero cambia el
   baseline de los rendimientos observados en proyectos con festivos: si alguien
   ve propuestas de rendimiento distintas a las de ayer, es por esto.
5. Sigue sin revisión en navegador: la verificación fue tests, tipos y build.

---

# Revisión: dos Importantes y cuatro menores

## Importante 1 · No aplicar si los conflictos cambiaron mientras decidía

Lo que había anotado como «cosmético» era pérdida silenciosa de trabajo, y la
revisión tiene razón. Entre «Aplicar» y «Aplicar con estas decisiones» el
cronograma puede cambiar —hay un `Ctrl+Z` escuchando en `window`—. Un conflicto
que aparece después no está en la lista que se enseñó, no tiene entrada en
`resolutions`, y `applyMatrixUpdate` lo resuelve por defecto a `"matriz"`: una
edición hecha en obra pisada sin preguntar.

Ahora `handleResolveMatrixConflicts` recalcula y **compara el conjunto de claves
`${taskId}::${field}`** con el que se mostró. Si no coinciden, no aplica: vuelve
a abrir el diálogo con la lista de ahora y el aviso `conflicts-changed`. El
`ConflictChooser` se remonta con `key` derivada de esas claves, para que las
elecciones viejas no se arrastren a la lista nueva.

## Importante 2 · El diálogo no sobrevive al cambio de vista

`setActiveView` es ahora un envoltorio que limpia `pendingMatrixConflicts` antes
de cambiar de vista. Así no reaparece con un `nextPlan` que ya no corresponde al
borrador —el editor se remonta por `matrixEditorKey`—. Es el sexto caso del
mismo patrón en este proyecto.

## Menor 3 · Una sola generación por aplicación

`commitMatrixPlan` se convirtió en `commitMatrixResult(result)`: recibe el
resultado ya calculado en vez de volver a generarlo. Antes, con la matriz de
30 × 40, cada clic generaba el cronograma dos veces.

## Menores 4, 5 y 6 · Tests que prometían más de lo que comprobaban

- `matrixSync.test.ts` «sin calendario todo se comporta como siempre»: ya no
  compara dos llamadas que recorren la misma rama. **Ancla fechas**:
  `2026-01-05` → `2026-01-13`, que son 8 días laborables saltando solo el
  domingo 11. Si la regla histórica cambiara, este test lo caza.
- `GanttView.test.tsx` «"No aplicar" deja el cronograma como estaba»: además de
  que el diálogo se cierre, **comprueba que la tarea sigue llamándose como la
  puso la obra**, mirando la fila en la vista Gantt.
- `MatrixEditorView.test.tsx` «sin calendario la vista previa mantiene el fin de
  siempre»: **ancla el valor**, `Preview: 19 tareas · 2 alertas · fin 2026-01-16`.
- Renombrado: «sin calendario el editor aplica directo» → «con el calendario por
  defecto no se supera el umbral y se aplica directo». `GanttView` usa
  `DEFAULT_PROJECT_CALENDAR`, así que el caso «sin calendario» no existe ahí.

## Tests nuevos

- «si los conflictos cambiaron mientras decidía, no se aplica y se vuelve a
  preguntar»: dos tareas renombradas en obra, se devuelve una a su nombre de
  matriz, se abre el diálogo con un solo conflicto, se pulsa `Ctrl+Z` —que
  resucita el conflicto de la segunda— y al resolver no se aplica: vuelve el
  diálogo con el conflicto nuevo dentro.
- «salir de la matriz cierra el diálogo, no lo deja esperando».

Rojo antes (los dos, por el motivo esperado):

```
✕ si los conflictos cambiaron mientras decidía, no se aplica y se vuelve a preguntar
    Unable to find an element by: [data-testid="conflicts-changed"]
✕ salir de la matriz cierra el diálogo, no lo deja esperando
    expected document not to contain element, found <section data-testid="conflict-chooser">
Tests: 2 failed, 67 skipped, 69 total
```

## Verificación final

```
$ npx jest --runInBand
Test Suites: 141 passed, 141 total
Tests:       1317 passed, 1317 total

$ npx eslint src/components/views/GanttView.tsx src/components/views/MatrixEditorView.tsx src/lib/matrix/matrixSync.ts
(sin salida: limpio)

$ npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
(vacío)

$ npx next build
(build correcto)
```

1315 → 1317: dos tests nuevos. Ningún test preexistente en rojo. Convertir
`setActiveView` en un envoltorio hizo aparecer dos avisos de `exhaustive-deps`
en dos `useCallback` que lo usan; se añadió a sus listas de dependencias (es
estable, con `[]`).

**No se tocó** la propagación del calendario a `syncMatrixPlanFromTasks`, como
indicó la revisión.
