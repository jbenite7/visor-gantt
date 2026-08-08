# Fusión de carriles A y B — MatrixEditorView

Merge en curso de `claude/suspicious-joliot-8f08ea` sobre `main`. Dos archivos en conflicto, resueltos sin commitear.

## Qué se conservó

### `v2/src/components/views/MatrixEditorView.tsx`

Base: lado `HEAD` (carril B), íntegro.

Del **carril B** (conservado entero, se auto-fusionó salvo el bloque en conflicto):
- Las cinco pantallas montadas: `RecipeEditor`, `TemplatePicker`, `ProposalReview`, `FeedbackPanel`, `LocationBulkActions`.
- Selección múltiple de celdas y edición en lote.
- Dibujo por ventana (`MATRIX_VISIBLE_ROWS = 12`) para aguantar 30 × 40 = 1200 celdas.

Del **carril A** (añadido encima):
- `onDirtyChange?: (dirty: boolean) => void` en la interfaz y en el destructurado, con los imports `useCallback` y `useEffect`, y el `useEffect` que la llama al cambiar el estado y la limpia al desmontar.
- Tildes: `"Capítulo"`, `"Sub-Ubicación"`, `"Ubicación"`, el `return "Ubicación"` de `inferAreaTypeForLabel`, los dos `type: "Sub-Ubicación"`, y de paso los avisos `"Máximo 10 niveles de jerarquía."` y los `aria-label` de ubicación (venían en el mismo diff del carril A y se auto-fusionaron).
- «Descartar cambios»: el botón antes «Deshacer», ahora con `data-testid="matrix-discard"` y confirmación por `window.confirm`; más el chip `data-testid="matrix-dirty"`.

### Cómo se resolvió la duplicación (la decisión de fondo)

El bloque en conflicto (líneas ~131-159) enfrentaba `MATRIX_VISIBLE_ROWS` (carril B) contra `contarDiferenciasDeMatriz` (carril A). Se conservó `MATRIX_VISIBLE_ROWS` y **se descartó `contarDiferenciasDeMatriz`**: su trabajo ya lo hace, mejor, `describeDraftChanges(draft, applied)` de `@/lib/matrix/draftState`, que además detecta los cambios de estructura (alcances, ubicaciones, recetas, fecha de inicio) que la del carril A ignoraba.

El estado del borrador quedó así:

```ts
const cambiosPendientes = useMemo(
  () => describeDraftChanges(draft, matrixPlan),
  [draft, matrixPlan],
);
const tieneCambios = cambiosPendientes.hasChanges;
```

El `useEffect` de `onDirtyChange` se alimenta de `tieneCambios`. El `window.confirm` usa el `message` que ya redacta `describeDraftChanges` (`"Hay N celdas con cambios sin aplicar."`), en vez del recuento propio del carril A: así el aviso también cubre el caso «cambió la estructura», donde no hay celdas que contar pero sí trabajo que perder.

Se añadió el import `describeDraftChanges` desde `@/lib/matrix/draftState`.

### `v2/src/components/views/MatrixEditorView.test.tsx`

Se conservaron **todos** los tests de los dos lados. Los dos carriles habían añadido `describe`s distintos que git enredó porque compartían el mismo `afterEach(jest.restoreAllMocks)`. Se separaron en dos `describe` de primer nivel:

- Los del carril B: `MatrixEditorView · selección de varias celdas`, `· selección y borrados`, `· escala`, `· pantallas enchufadas`.
- El del carril A, ahora al final del archivo con su propio `afterEach`: `el borrador de la matriz no se pierde sin avisar (M28)`.

Único retoque: el helper del carril A usaba `React.ComponentProps<...>` sin importar `React`. Se cambió a `ComponentProps<...>` con `import type { ComponentProps } from "react"`, que es lo que hace el resto del archivo.

**No hubo contradicción de fondo entre los carriles.** Ningún test de un carril afirma el texto de un botón que el otro renombró: el carril B no tocó «Deshacer», así que el rename del carril A a «Descartar cambios» no choca con nada.

## Verificación (salida real)

### 1. `npx jest src/components/views/MatrixEditorView.test.tsx`

```
  MatrixEditorView · selección de varias celdas
    ✓ sin selección múltiple no aparece el panel de lote (8 ms)
    ✓ marcar dos celdas abre el panel de lote con el recuento (25 ms)
    ✓ seleccionar una fila entera marca todas sus celdas (16 ms)
    ✓ desactivar en lote aplica el cambio a las celdas marcadas (53 ms)
    ✓ limpiar la selección cierra el panel (33 ms)
  MatrixEditorView · selección y borrados
    ✓ borrar un alcance descarta sus coordenadas de la selección (64 ms)
  MatrixEditorView · escala
    ✓ el plan de prueba tiene más de 1000 celdas
    ✓ no monta las 1200 celdas de golpe (124 ms)
    ✓ anuncia cuántas filas se están viendo de cuántas (68 ms)
    ✓ se puede avanzar a las filas siguientes (675 ms)
    ✓ una matriz pequeña no muestra los controles de ventana (7 ms)
    ✓ si la matriz encoge por debajo de la página actual, la ventana retrocede (1601 ms)
  MatrixEditorView · pantallas enchufadas
    ✓ el modo Ubicaciones monta las acciones en lote y duplicar llega al borrador (46 ms)
    ✓ el modo Ubicaciones crea un rango de ubicaciones en el borrador (54 ms)
    ✓ el modo Recetas monta el editor y la actividad nueva llega al borrador (34 ms)
    ✓ el modo Plantillas monta el selector y elegir una reemplaza el borrador (28 ms)
    ✓ guardar como plantilla deja la matriz en las plantillas propias (28 ms)
    ✓ sin cronograma no se puede generar la matriz desde el cronograma (22 ms)
    ✓ generar desde el cronograma enseña la propuesta y aceptarla construye el plan (36 ms)
    ✓ el modo Rendimientos monta el panel y aprobar llega al borrador (30 ms)
    ✓ el modo Rendimientos descarta el rendimiento observado (23 ms)
  el borrador de la matriz no se pierde sin avisar (M28)
    ✓ «Deshacer» pasa a llamarse «Descartar cambios» (8 ms)
    ✓ sin cambios, descartar no pregunta nada (4 ms)
    ✓ con cambios, descartar pide confirmación y dice cuántos se pierden (23 ms)
    ✓ si el usuario dice que no, el borrador sigue ahí (18 ms)
    ✓ el borrador sucio se anuncia al proyecto, para el aviso al cerrar (15 ms)

Test Suites: 1 passed, 1 total
Tests:       34 passed, 34 total
```

### 2. `npx jest --runInBand`

```
Test Suites: 141 passed, 141 total
Tests:       1297 passed, 1297 total
Snapshots:   0 total
Time:        25.805 s
```

Coherente con la suma: el carril B traía 1066 y el carril A declaraba 936 sobre una base común; 1297 sale de sumar lo propio de cada uno sin contar dos veces la base. Sin caídas ni suites saltadas.

### 3. `npx eslint src/components/views/MatrixEditorView.tsx`

```
eslint exit=0
```

(Sin salida; se pasó también el `.test.tsx`, igualmente limpio.)

### 4. `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`

Vacío.

### 5. `npx next build`

```
✓ Generating static pages using 9 workers (11/11) in 243.9ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/auth/microsoft/callback
├ ƒ /api/auth/microsoft/start
├ ƒ /api/import-mpp
├ ƒ /api/integrations/last-planner/preview
├ ƒ /api/parse-mpp
├ ○ /gantt-demo
├ ƒ /login
├ ƒ /project/[id]
├ ƒ /project/new
└ ƒ /upload
```

## Estado del árbol

Los dos archivos resueltos y con `git add`. **El commit de merge queda sin hacer**, a la espera de quien coordina.
