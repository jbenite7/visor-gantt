# P1 · No perder trabajo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ninguna acción del usuario pierda trabajo en silencio: las observaciones se guardan al instante,
existe un solo sistema de líneas base —el que se persiste— que además dibuja la comparación en el Gantt
principal, y la app avisa antes de cerrar con algo pendiente.

**Architecture:** `GanttView` es el único dueño del estado de líneas base y de la política de guardado.
`TrackingGanttView` pasa de tener estado propio a ser un componente controlado por props, igual que ya es
`ProjectToolbar`. El dibujo de la comparación se implementa una sola vez, dentro de `GanttChart`, tras una
prop `showBaseline`, y `GanttView` le pasa las tareas ya enriquecidas con `applyBaselineToTasks`, función que
ya existe y está probada. El guardado inmediato de observaciones va en un efecto propio, separado del efecto
temporizado, porque son dos políticas distintas sobre el mismo estado.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · Jest + Testing Library · Playwright (E2E) · Docker Compose.

Spec: [2026-08-07-no-perder-trabajo-design.md](../specs/2026-08-07-no-perder-trabajo-design.md)
Goal: [goals/no-perder-trabajo/goal.md](../../../goals/no-perder-trabajo/goal.md)

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Sin excepciones.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Comandos de verificación: `npx jest --runInBand`, `npx eslint <archivos>`, `npx tsc --noEmit`, `npx next build`.
- `npx tsc --noEmit` arrastra **38 errores preexistentes** en `*.test.*` y `e2e/`. Filtrar siempre:
  `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`. Ese filtro debe salir **vacío**.
- Copy en **español con tildes**, en lenguaje de obra, sin jerga de infraestructura (ver `docs/POSITIONING.md`).
- No añadir color nuevo: usar los tokens de `src/app/globals.css`. El proyecto **no define** variables
  `--space-*` ni `--font-size-*`; los componentes usan valores literales. No inventar un sistema de espaciado.
- Ninguna capacidad puede desaparecer: lo que sale de un sitio queda accesible por otro.
- Rama: `p1-no-perder-trabajo`, fusionada a `main` al pasar su revisión.
- **Carril A.** Este proyecto sí toca `GanttView.tsx` y `ProjectContext.tsx`. No tocar `src/lib/matrix/*`
  ni `src/lib/scheduling/unitPatterns.ts` / `activityFamily.ts`: son del carril B.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/components/views/GanttView.tsx` | Efecto de guardado inmediato de observaciones | 1 |
| `src/lib/gantt/pendingChanges.ts` | **Nuevo.** Decidir si hay que avisar al cerrar | 2 |
| `src/components/views/GanttView.tsx` | Estado `hasPendingChanges` + listener `beforeunload` | 2 |
| `src/lib/gantt/saveStatusLabel.ts` | El mensaje deja de contener la palabra «Reintentar» | 3 |
| `src/components/views/GanttView.tsx` | Botón «Reintentar» real junto al indicador | 3 |
| `src/components/gantt/GanttChart.tsx` | Capa de barras de línea base tras `showBaseline` | 4 |
| `src/components/views/GanttView.tsx` | Aplica la línea base activa a las tareas del chart | 5 |
| `src/components/gantt/toolbar/BaselineMenu.tsx` | **Nuevo.** Nombrar al guardar, listar y borrar | 6 |
| `src/components/gantt/toolbar/ProjectToolbar.tsx` | Delega el grupo de línea base en `BaselineMenu` | 6 |
| `src/components/views/GanttView.tsx` | `handleSaveBaseline` con nombre, `handleDeleteBaseline` deshacible | 6 |
| `src/components/views/TrackingGanttView.tsx` | Deja de tener estado propio; recibe props; copy en español | 7 |

---

# ENTREGA 1 — El guardado (tareas 1 a 3)

Va primera porque es la pérdida de datos que puede ocurrir hoy mismo, y porque no depende de nada más.

## Task 1: Las observaciones se guardan al instante

**Files:**
- Modify: `src/components/views/GanttView.tsx` (efecto nuevo tras el bloque de líneas 1182-1216)
- Test: `src/components/views/GanttView.test.tsx` (añadir un `describe` al final)

**Interfaces:**
- Consumes: `doSaveRef` (`GanttView.tsx:913`), `autoSaveTimerRef`, `observations` y `addObservation` del
  contexto (`GanttView.tsx:217-220`), `AUTOSAVE_DELAY_MS = 750` (`GanttView.tsx:105`).
- Produces: ningún export nuevo. Efecto interno con su propio `didMountObservationsRef`.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/components/views/GanttView.test.tsx`:

```tsx
describe("las observaciones no se pierden (M24)", () => {
  test("anotar guarda al instante, sin esperar al temporizador", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Obra con observaciones"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    fireEvent.click(screen.getAllByTestId("editable-cell")[0]);
    fireEvent.click(screen.getByTestId("open-observations"));

    const textarea = screen.getByTestId("observation-text");
    fireEvent.change(textarea, {
      target: { value: "Falta acero de refuerzo en el eje 3" },
    });

    mockedSaveProject.mockClear();
    fireEvent.click(screen.getByTestId("observation-save"));

    // Sin avanzar ni un milisegundo: el guardado tiene que haber salido ya.
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSaveProject).toHaveBeenCalled();
    expect(latestSavedProject().observations).toEqual([
      expect.objectContaining({
        taskId: 1,
        text: "Falta acero de refuerzo en el eje 3",
        status: "pending",
      }),
    ]);
  });

  test("atender una observación también guarda al instante", async () => {
    jest.useFakeTimers();

    render(
      <GanttView
        projectId="1"
        projectName="Obra con observaciones"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
        observations={[
          {
            id: "obs-1",
            taskId: 1,
            taskName: "Excavación",
            text: "Falta acero",
            status: "pending",
            createdAt: "2026-08-07T08:00:00.000Z",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getAllByTestId("editable-cell")[0]);
    fireEvent.click(screen.getByTestId("open-observations"));

    mockedSaveProject.mockClear();
    fireEvent.click(screen.getByTestId("observation-toggle-obs-1"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSaveProject).toHaveBeenCalled();
    expect(latestSavedProject().observations[0].status).toBe("done");
  });

  test("abrir el proyecto con observaciones ya guardadas no dispara un guardado", async () => {
    jest.useFakeTimers();

    mockedSaveProject.mockClear();
    render(
      <GanttView
        projectId="1"
        projectName="Obra con observaciones"
        tasks={[makeTask({ id: 1 })]}
        observations={[
          {
            id: "obs-1",
            taskId: 1,
            taskName: "Excavación",
            text: "Falta acero",
            status: "pending",
            createdAt: "2026-08-07T08:00:00.000Z",
          },
        ]}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedSaveProject).not.toHaveBeenCalled();
  });
});
```

**Nota sobre los `data-testid`:** el plan asume `observation-text`, `observation-save` y
`observation-toggle-<id>` en `src/components/gantt/observations/ObservationPanel.tsx`. Ese componente hoy no
declara `data-testid`. **Antes del Step 2**, añadirlos al `<textarea>`, al botón de guardar y al control que
alterna el estado de cada observación —son atributos, no cambian comportamiento— y confirmar con
`grep -n "data-testid" src/components/gantt/observations/ObservationPanel.tsx` que los tres existen. Si el
panel usa `<input>` en vez de `<textarea>`, el testid va igual sobre el control de texto real.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/GanttView.test.tsx -t "las observaciones no se pierden"`
Expected: FAIL — el primer test falla con `expect(mockedSaveProject).toHaveBeenCalled()` recibiendo 0
llamadas: hoy anotar no marca el proyecto como sucio porque `observations` no está en las dependencias del
efecto de `GanttView.tsx:1202-1216`. El tercer test ya pasa (es la red de seguridad contra el guardado
espurio al montar).

- [ ] **Step 3: Write minimal implementation**

En `src/components/views/GanttView.tsx`, junto a los demás `useRef` de estado de guardado (cerca de
`didMountSaveStateRef`), añadir:

```tsx
  const didMountObservationsRef = useRef(false);
```

Y justo **después** del efecto temporizado que termina en la línea 1216, añadir:

```tsx
  /**
   * Las observaciones se guardan al instante, sin pasar por el temporizador.
   *
   * Anotar en obra es un acto único: no hay nada que agrupar, y quien anota
   * cierra la pestaña a los dos segundos. Esperar 750 ms es exactamente la
   * ventana en la que se perdía lo escrito (M24).
   */
  useEffect(() => {
    if (!didMountObservationsRef.current) {
      didMountObservationsRef.current = true;
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    isDirtyRef.current = true;
    void doSaveRef.current();
  }, [observations]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/GanttView.test.tsx`
Expected: PASS — los 3 tests nuevos y los ~40 existentes del archivo.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx src/components/gantt/observations/ObservationPanel.tsx
git commit -m "fix(observaciones): guardar al instante en vez de esperar al temporizador (M24)"
```

---

## Task 2: Aviso al cerrar solo si hay algo pendiente

**Files:**
- Create: `src/lib/gantt/pendingChanges.ts`
- Test: `src/lib/gantt/pendingChanges.test.ts`
- Modify: `src/components/views/GanttView.tsx`
- Test: `src/components/views/GanttView.test.tsx`

**Interfaces:**
- Produces: `export function shouldWarnBeforeUnload(state: { hasPendingChanges: boolean; saveStatus: SaveStatus }): boolean`
- Consumes: `SaveStatus` de `src/lib/gantt/saveStatusLabel.ts`.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/gantt/pendingChanges.test.ts`:

```ts
import { shouldWarnBeforeUnload } from "./pendingChanges";

describe("aviso al cerrar (M33)", () => {
  test("no molesta cuando no hay nada pendiente", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "idle" }),
    ).toBe(false);
  });

  test("avisa cuando quedan cambios sin guardar", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: true, saveStatus: "idle" }),
    ).toBe(true);
  });

  test("avisa mientras se está guardando: cerrar ahora corta el envío", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "saving" }),
    ).toBe(true);
  });

  test("avisa si el último intento falló, aunque el estado ya esté limpio", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "error" }),
    ).toBe(true);
  });

  test("no avisa tras un guardado correcto", () => {
    expect(
      shouldWarnBeforeUnload({ hasPendingChanges: false, saveStatus: "saved" }),
    ).toBe(false);
  });
});
```

Y añadir a `src/components/views/GanttView.test.tsx`:

```tsx
describe("aviso al cerrar con cambios pendientes (M33)", () => {
  test("sin tocar nada, cerrar no pregunta", () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  test("tras editar y antes de que guarde, cerrar pregunta", async () => {
    jest.useFakeTimers();
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    const cells = screen.getAllByTestId("editable-cell");
    fireEvent.doubleClick(cells[0]);
    const input = screen.getByDisplayValue("Excavación");
    fireEvent.change(input, { target: { value: "Excavación manual" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await act(async () => {
      await Promise.resolve();
    });

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/pendingChanges.test.ts src/components/views/GanttView.test.tsx -t "aviso al cerrar"`
Expected: FAIL — `Cannot find module './pendingChanges'` en el primero; en el segundo, el test «cerrar
pregunta» falla con `expect(event.defaultPrevented).toBe(true)` recibiendo `false`, porque hoy no hay ningún
listener de `beforeunload` en toda la app.

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/gantt/pendingChanges.ts`:

```ts
import type { SaveStatus } from "./saveStatusLabel";

/**
 * ¿Hay que preguntar antes de cerrar?
 *
 * Solo si algo se puede perder. Preguntar siempre entrena al usuario a
 * ignorar el diálogo, que es como se pierde el trabajo de verdad.
 *
 * «Guardando» también cuenta: cerrar la pestaña corta la petición en vuelo.
 * «Error» también: lo último no llegó al servidor.
 */
export function shouldWarnBeforeUnload(state: {
  hasPendingChanges: boolean;
  saveStatus: SaveStatus;
}): boolean {
  if (state.saveStatus === "saving" || state.saveStatus === "error") return true;
  return state.hasPendingChanges;
}
```

En `src/components/views/GanttView.tsx`:

1. Importar: `import { shouldWarnBeforeUnload } from "@/lib/gantt/pendingChanges";`
2. Junto a `const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");` (línea 297), añadir:
   ```tsx
   const [hasPendingChanges, setHasPendingChanges] = useState(false);
   ```
3. En `doSave` (línea 864), tras `isDirtyRef.current = false;` añadir `setHasPendingChanges(false);` y, en
   las tres ramas de fallo (`else` de `result.success`, y el `catch`), añadir `setHasPendingChanges(true);`
   junto a `setSaveStatus("error")`.
4. En el efecto temporizado (línea 1188) y en el efecto de observaciones de la Tarea 1, junto a
   `isDirtyRef.current = true;` añadir `setHasPendingChanges(true);`.
5. Añadir el efecto del listener, después del efecto de observaciones:

```tsx
  useEffect(() => {
    if (!shouldWarnBeforeUnload({ hasPendingChanges, saveStatus })) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // El navegador no deja personalizar el texto; solo pedir la confirmación.
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasPendingChanges, saveStatus]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/pendingChanges.test.ts src/components/views/GanttView.test.tsx`
Expected: PASS (5 tests nuevos del módulo + 2 de la vista + los existentes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/pendingChanges.ts src/lib/gantt/pendingChanges.test.ts src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx
git commit -m "feat(guardado): avisar al cerrar solo si queda algo pendiente (M33)"
```

---

## Task 3: «Reintentar» como botón de verdad

**Files:**
- Modify: `src/lib/gantt/saveStatusLabel.ts:19`
- Test: `src/lib/gantt/saveStatusLabel.test.ts` (crear si no existe)
- Modify: `src/components/views/GanttView.tsx:1262-1269`
- Test: `src/components/views/GanttView.test.tsx`

**Interfaces:**
- Consumes: `handleManualSave` (`GanttView.tsx:919-926`), que fuerza `isDirtyRef.current = true` antes de guardar.
- Produces: `saveStatusLabel` deja de devolver la palabra «Reintentar».

- [ ] **Step 1: Write the failing test**

En `src/lib/gantt/saveStatusLabel.test.ts`:

```ts
import { saveStatusLabel } from "./saveStatusLabel";

describe("indicador de guardado", () => {
  test("el mensaje de error no incluye la acción: esa es del botón", () => {
    expect(saveStatusLabel("error", null)).toBe("No se pudo guardar");
    expect(saveStatusLabel("error", null)).not.toMatch(/reintentar/i);
  });

  test("sigue diciendo la hora del último guardado", () => {
    expect(saveStatusLabel("idle", new Date(2026, 7, 7, 9, 5))).toBe(
      "Guardado a las 09:05",
    );
  });
});
```

Y en `src/components/views/GanttView.test.tsx`:

```tsx
describe("reintentar el guardado es un botón", () => {
  test("aparece solo cuando falla y vuelve a guardar al pulsarlo", async () => {
    render(<GanttView projectId="1" tasks={[makeTask({ id: 1 })]} />);

    expect(screen.queryByTestId("save-retry")).not.toBeInTheDocument();

    mockedSaveProject.mockResolvedValueOnce({
      success: false,
      error: "sin conexión",
    });

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    const retry = await screen.findByTestId("save-retry");
    expect(retry.tagName).toBe("BUTTON");
    expect(retry).toHaveTextContent("Reintentar");

    mockedSaveProject.mockClear();
    mockedSaveProject.mockResolvedValueOnce({ success: true, id: "1" });
    fireEvent.click(retry);

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());
  });
});
```

**Nota:** si `⌘S` no está enlazado en `GanttView`, provocar el fallo abriendo la paleta con `⌘K` y ejecutando
el comando `save-now` (`GanttView.tsx:957-962`), que es la vía que el propio producto ofrece:
`fireEvent.keyDown(window, { key: "k", metaKey: true })`, escribir «Guardar» en el campo y pulsar `Enter`.
Comprobar cuál de las dos vías existe con `grep -n '"s"' src/components/views/GanttView.tsx` antes de
escribir el test, y usar la que exista. No añadir un atajo nuevo en esta tarea.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/saveStatusLabel.test.ts src/components/views/GanttView.test.tsx -t "reintentar"`
Expected: FAIL — el primero con `Expected: "No se pudo guardar" / Received: "No se pudo guardar. Reintentar"`;
el segundo con `Unable to find an element by: [data-testid="save-retry"]`.

- [ ] **Step 3: Write minimal implementation**

En `src/lib/gantt/saveStatusLabel.ts` línea 19:

```ts
  if (status === "error") return "No se pudo guardar";
```

En `src/components/views/GanttView.tsx`, sustituir el `<span>` de las líneas 1262-1269 por:

```tsx
        <span
          className="gantt-save-status"
          data-status={saveStatus}
          data-testid="save-status"
          role="status"
        >
          {saveStatusLabel(saveStatus, lastSavedAt)}
        </span>
        {saveStatus === "error" && (
          <button
            type="button"
            data-testid="save-retry"
            onClick={handleManualSave}
            className="apple-button-secondary shrink-0 rounded-[var(--radius-lg)] px-[var(--gantt-topbar-control-padding-inline)] text-[length:var(--gantt-topbar-font-size)] font-semibold"
          >
            Reintentar
          </button>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/saveStatusLabel.test.ts src/components/views/GanttView.test.tsx`
Expected: PASS. Comprobar de paso que ningún test existente afirma el texto antiguo:
`grep -rn "No se pudo guardar. Reintentar" src e2e` debe salir vacío.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/saveStatusLabel.ts src/lib/gantt/saveStatusLabel.test.ts src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx
git commit -m "fix(guardado): Reintentar pasa a ser un boton real"
```

---

## Verificación de la Entrega 1

- [ ] `npx jest --runInBand` — suite completa en verde.
- [ ] `npx eslint src/components/views/GanttView.tsx src/lib/gantt/pendingChanges.ts src/lib/gantt/saveStatusLabel.ts src/components/gantt/observations/ObservationPanel.tsx`
- [ ] `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` — vacío.
- [ ] `npx next build`.

---

# ENTREGA 2 — Un solo sistema de líneas base (tareas 4 a 7)

## Task 4: El Gantt principal sabe dibujar la línea base

**Files:**
- Modify: `src/components/gantt/GanttChart.tsx` (interfaz de props en línea 31, capa nueva antes de la línea 272)
- Test: `src/components/gantt/GanttChart.test.tsx`

**Interfaces:**
- Produces: `GanttChartProps` gana `showBaseline?: boolean` (default `false`).
- Consumes: `task.baselineStart` / `task.baselineFinish` (`src/components/gantt/types.ts:16-22`),
  `getDatePosition` y `getTaskWidth` (`./utils`), `GANTT_ROW_HEIGHT` (`./layout`).

- [ ] **Step 1: Write the failing test**

Añadir a `src/components/gantt/GanttChart.test.tsx`:

```tsx
describe("comparación con la línea base en el Gantt principal (M13)", () => {
  const withBaseline = task({
    id: 1,
    name: "Excavación",
    start: new Date("2026-01-08"),
    finish: new Date("2026-01-12"),
    baselineStart: new Date("2026-01-05"),
    baselineFinish: new Date("2026-01-09"),
    baselineDuration: 5,
  });

  test("sin activar la comparación no se dibuja nada nuevo", () => {
    const { container } = render(<GanttChart tasks={[withBaseline]} />);

    expect(container.querySelector("g.baseline-bars")).not.toBeInTheDocument();
  });

  test("con la comparación activa dibuja una barra fantasma por tarea", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline]} showBaseline />,
    );

    const layer = container.querySelector("g.baseline-bars");
    expect(layer).toBeInTheDocument();
    expect(layer!.querySelectorAll("rect")).toHaveLength(1);
  });

  test("la barra fantasma va detrás de la barra real", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline]} showBaseline />,
    );

    const baseline = container.querySelector("g.baseline-bars");
    const tasks = container.querySelector("g.tasks");
    expect(baseline!.compareDocumentPosition(tasks!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("una tarea sin línea base no aporta barra fantasma", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline, task({ id: 2 })]} showBaseline />,
    );

    expect(
      container.querySelectorAll("g.baseline-bars rect"),
    ).toHaveLength(1);
  });

  test("la barra fantasma ocupa las fechas de la línea base, no las reales", () => {
    const { container } = render(
      <GanttChart tasks={[withBaseline]} showBaseline />,
    );

    const ghost = container.querySelector<SVGRectElement>(
      "g.baseline-bars rect",
    )!;
    const real = container.querySelector<SVGRectElement>(
      'g.tasks [data-testid="task-bar"]',
    );

    // La línea base empieza 3 días antes que lo real: tiene que quedar a la izquierda.
    expect(Number(ghost.getAttribute("x"))).toBeLessThan(
      Number(real?.getAttribute("x") ?? Number.POSITIVE_INFINITY),
    );
  });
});
```

**Nota:** si `TaskBar` no expone `data-testid="task-bar"`, sustituir ese selector por
`container.querySelector('g.tasks rect')`. Confirmarlo con
`grep -n "data-testid" src/components/gantt/bars/TaskBar.tsx` antes de escribir el test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/GanttChart.test.tsx -t "comparación con la línea base"`
Expected: FAIL — el primer test pasa (no existe la capa), y del segundo en adelante fallan con
`expect(layer).toBeInTheDocument()` recibiendo `null`: hoy `GanttChart` no conoce la línea base
(`grep -n baseline src/components/gantt/GanttChart.tsx` no devuelve nada). TypeScript además rechaza la prop
`showBaseline`.

- [ ] **Step 3: Write minimal implementation**

En `src/components/gantt/GanttChart.tsx`, dentro de `interface GanttChartProps` (línea 31), añadir:

```tsx
  /** Dibuja la línea base activa como barra fantasma detrás de cada barra. */
  showBaseline?: boolean;
```

Añadir `showBaseline = false` a la desestructuración de props del componente, y **justo antes** del comentario
`{/* ── Layer 6: Task Bars ── */}` (línea 272), insertar:

```tsx
          {/* ── Layer 5b: Línea base (detrás de las barras reales) ── */}
          {showBaseline && (
            <g
              className="baseline-bars"
              transform={`translate(0, ${finalConfig.headerHeight})`}
              pointerEvents="none"
            >
              {tasks.map((task, i) => {
                if (!task.baselineStart || !task.baselineFinish) return null;

                const x = getDatePosition(task.baselineStart, fittedViewport);
                const width = getTaskWidth(
                  task.baselineStart,
                  task.baselineFinish,
                  fittedViewport,
                );

                return (
                  <rect
                    key={`baseline-${task.id}`}
                    x={x}
                    y={i * finalConfig.rowHeight + BASELINE_BAR_OFFSET_Y}
                    width={Math.max(width, 1)}
                    height={BASELINE_BAR_HEIGHT}
                    rx={2}
                    fill="var(--color-text-muted)"
                    opacity={0.35}
                  />
                );
              })}
            </g>
          )}
```

Y junto a las constantes de la cabecera del archivo (cerca de `LABEL_HEIGHT`, línea 73):

```tsx
const BASELINE_BAR_HEIGHT = 6;
const BASELINE_BAR_OFFSET_Y = 4;
```

Sin color nuevo: `--color-text-muted` ya existe en `globals.css` y es el que usa Seguimiento para lo mismo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/GanttChart.test.tsx`
Expected: PASS (5 nuevos + los existentes del archivo).

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/GanttChart.tsx src/components/gantt/GanttChart.test.tsx
git commit -m "feat(gantt): dibujar la linea base como barra fantasma tras showBaseline (M13)"
```

---

## Task 5: La línea base activa se dibuja donde se pulsó el botón

**Files:**
- Modify: `src/components/views/GanttView.tsx` (estado de líneas base, líneas 325-327 y 548-568; montaje de `GanttChart`)
- Test: `src/components/views/GanttView.test.tsx`

**Interfaces:**
- Consumes: `applyBaselineToTasks(tasks, baseline)` y `saveBaseline(tasks, name)` de
  `@/lib/scheduling/baseline` — ambas ya probadas en `src/lib/scheduling/baseline.test.ts`, ninguna muta.
- Produces: `GanttView` pasa `showBaseline` y las tareas enriquecidas a `GanttChart`.

- [ ] **Step 1: Write the failing test**

```tsx
describe("la línea base se dibuja donde se guarda (M13)", () => {
  test("al guardar y seleccionar una línea base, el Gantt principal la dibuja", async () => {
    const { container } = render(
      <GanttView
        projectId="1"
        projectName="Obra"
        tasks={[makeTask({ id: 1, name: "Excavación" })]}
      />,
    );

    expect(container.querySelector("g.baseline-bars")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Guardar línea base"));

    await waitFor(() =>
      expect(container.querySelector("g.baseline-bars")).toBeInTheDocument(),
    );
    expect(
      container.querySelectorAll("g.baseline-bars rect"),
    ).toHaveLength(1);
  });

  test("una línea base cargada del proyecto no se dibuja hasta seleccionarla", () => {
    const { container } = render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        baselines={[
          {
            id: "bl-1",
            name: "Línea base 1",
            createdAt: new Date("2026-08-01"),
            tasks: [
              {
                taskId: 1,
                baselineStart: createProjectDate("2026-01-05"),
                baselineFinish: createProjectDate("2026-01-10"),
                baselineDuration: 5,
              },
            ],
          },
        ]}
      />,
    );

    expect(container.querySelector("g.baseline-bars")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/GanttView.test.tsx -t "la línea base se dibuja"`
Expected: FAIL — el primer test falla en el `waitFor` con `Unable to find g.baseline-bars`: hoy
`activeBaselineId` (`GanttView.tsx:327`) solo alimenta la etiqueta del desplegable de `ProjectToolbar` y
nada más. El segundo test ya pasa.

- [ ] **Step 3: Write minimal implementation**

En `src/components/views/GanttView.tsx`:

1. Importar: `import { applyBaselineToTasks, saveBaseline } from "@/lib/scheduling/baseline";`
2. Sustituir el cuerpo de `handleSaveBaseline` (líneas 548-564) por el que reutiliza la función probada.
   El nombre pasa a español; el argumento de nombre llega en la Tarea 6:

```tsx
  const handleSaveBaseline = useCallback(() => {
    const nueva = saveBaseline(calculatedTasks, `Línea base ${baselines.length + 1}`);
    setBaselines((prev) => [...prev, nueva]);
    setActiveBaselineId(nueva.id);
  }, [baselines.length, calculatedTasks]);
```

3. Añadir, cerca de donde se calculan las tareas que consume la vista:

```tsx
  const activeBaseline = useMemo(
    () => baselines.find((b) => b.id === activeBaselineId) ?? null,
    [baselines, activeBaselineId],
  );

  /**
   * El botón «Línea base» está en la barra principal: la comparación tiene que
   * verse aquí, no solo dentro de Seguimiento (M13).
   */
  const tasksForChart = useMemo(
    () =>
      activeBaseline
        ? applyBaselineToTasks(calculatedTasks, activeBaseline)
        : calculatedTasks,
    [activeBaseline, calculatedTasks],
  );
```

4. En el montaje de `<GanttChart ...>` dentro de la vista `gantt`, cambiar la prop `tasks` para que reciba
   `tasksForChart` y añadir `showBaseline={Boolean(activeBaseline)}`. Localizarlo con
   `grep -n "<GanttChart" src/components/views/GanttView.tsx`.

**Cuidado:** `tasksForChart` es solo para el dibujo. **No** sustituir `calculatedTasks` en el objeto que
arma `doSave` (línea 875) ni en lo que consume la tabla: los campos `baselineStart`/`baselineFinish` son
derivados de la línea base y no deben persistirse dentro de cada tarea.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/GanttView.test.tsx`
Expected: PASS. El test existente `autosaves baseline snapshots` (`GanttView.test.tsx:1129`) debe seguir en
verde: sigue pulsando `getByTitle("Guardar línea base")` y sigue guardando en un paso. Si falla por el nombre
`Línea base 1` en vez de `Baseline 1`, actualizar la aserción del nombre en ese test — el cambio de idioma es
deliberado.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx
git commit -m "feat(linea-base): dibujar la comparacion en el Gantt principal (M13)"
```

---

## Task 6: Nombrar la línea base al guardarla y poder borrarla

**Files:**
- Create: `src/components/gantt/toolbar/BaselineMenu.tsx`
- Test: `src/components/gantt/toolbar/BaselineMenu.test.tsx`
- Modify: `src/components/gantt/toolbar/ProjectToolbar.tsx:252-310` (el grupo pasa a delegar)
- Modify: `src/components/views/GanttView.tsx` (`handleSaveBaseline` recibe nombre; `handleDeleteBaseline`)
- Test: `src/components/views/GanttView.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface BaselineMenuProps {
    baselines: { id: string; name: string }[];
    activeBaselineId?: string;
    proposedName: string;
    onSave: (name: string) => void;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
  }
  export default function BaselineMenu(props: BaselineMenuProps): JSX.Element;
  ```
- Consumes: `runUndoable({ description, execute, undo })` del contexto
  (`src/lib/state/ProjectContext.tsx`), la misma primitiva que ya hace deshacible borrar un recurso.

- [ ] **Step 1: Write the failing test**

Crear `src/components/gantt/toolbar/BaselineMenu.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import BaselineMenu from "./BaselineMenu";

function setup(overrides: Partial<React.ComponentProps<typeof BaselineMenu>> = {}) {
  const props = {
    baselines: [
      { id: "bl-1", name: "Antes de la lluvia" },
      { id: "bl-2", name: "Línea base 2" },
    ],
    activeBaselineId: "bl-1",
    proposedName: "Línea base 3",
    onSave: jest.fn(),
    onSelect: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  render(<BaselineMenu {...props} />);
  return props;
}

describe("BaselineMenu — nombrar y borrar (M13)", () => {
  test("guardar pide un nombre y propone uno", () => {
    setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));

    expect(screen.getByTestId("baseline-name-input")).toHaveValue(
      "Línea base 3",
    );
  });

  test("guarda con el nombre que escribe el usuario", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.change(screen.getByTestId("baseline-name-input"), {
      target: { value: "Aprobada por la interventoría" },
    });
    fireEvent.click(screen.getByTestId("baseline-save-confirm"));

    expect(props.onSave).toHaveBeenCalledWith("Aprobada por la interventoría");
  });

  test("un nombre en blanco no bloquea: se guarda con el propuesto", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.change(screen.getByTestId("baseline-name-input"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByTestId("baseline-save-confirm"));

    expect(props.onSave).toHaveBeenCalledWith("Línea base 3");
  });

  test("Escape cancela sin guardar", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.keyDown(screen.getByTestId("baseline-name-input"), {
      key: "Escape",
    });

    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.queryByTestId("baseline-name-input")).not.toBeInTheDocument();
  });

  test("cada línea base guardada se puede borrar, con etiqueta de texto", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-menu-open"));
    const borrar = screen.getByTestId("baseline-delete-bl-2");

    expect(borrar).toHaveTextContent("Borrar");
    fireEvent.click(borrar);
    expect(props.onDelete).toHaveBeenCalledWith("bl-2");
  });

  test("borrar no se confunde con seleccionar", () => {
    const props = setup();

    fireEvent.click(screen.getByTestId("baseline-menu-open"));
    fireEvent.click(screen.getByTestId("baseline-delete-bl-2"));

    expect(props.onSelect).not.toHaveBeenCalled();
  });

  test("sin líneas base guardadas no hay desplegable que abrir", () => {
    setup({ baselines: [], activeBaselineId: undefined });

    expect(screen.queryByTestId("baseline-menu-open")).not.toBeInTheDocument();
    expect(screen.getByTestId("baseline-save-open")).toBeInTheDocument();
  });
});
```

Y en `src/components/views/GanttView.test.tsx`:

```tsx
describe("borrar una línea base es deshacible (M13)", () => {
  test("Ctrl+Z devuelve la línea base borrada", async () => {
    render(
      <GanttView
        projectId="1"
        tasks={[makeTask({ id: 1 })]}
        baselines={[
          {
            id: "bl-1",
            name: "Antes de la lluvia",
            createdAt: new Date("2026-08-01"),
            tasks: [
              {
                taskId: 1,
                baselineStart: createProjectDate("2026-01-05"),
                baselineFinish: createProjectDate("2026-01-10"),
                baselineDuration: 5,
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId("baseline-menu-open"));
    fireEvent.click(screen.getByTestId("baseline-delete-bl-1"));

    expect(screen.queryByTestId("baseline-menu-open")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    await waitFor(() =>
      expect(screen.getByTestId("baseline-menu-open")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/toolbar/BaselineMenu.test.tsx`
Expected: FAIL — `Cannot find module './BaselineMenu'`.
Run: `npx jest src/components/views/GanttView.test.tsx -t "borrar una línea base"`
Expected: FAIL — `Unable to find an element by: [data-testid="baseline-menu-open"]`: hoy el desplegable de
`ProjectToolbar.tsx:269-305` no tiene testid ni opción de borrar.

- [ ] **Step 3: Write minimal implementation**

Crear `src/components/gantt/toolbar/BaselineMenu.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

export interface BaselineMenuProps {
  baselines: { id: string; name: string }[];
  activeBaselineId?: string;
  /** Nombre que se ofrece si el usuario no escribe ninguno. */
  proposedName: string;
  onSave: (name: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Guardar una línea base es un acto con fecha y motivo («antes de la lluvia»,
 * «aprobada por la interventoría»). Un número correlativo no dice nada tres
 * meses después, por eso se pide nombre al guardar.
 */
export default function BaselineMenu({
  baselines,
  activeBaselineId,
  proposedName,
  onSave,
  onSelect,
  onDelete,
}: BaselineMenuProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(proposedName);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeName =
    baselines.find((b) => b.id === activeBaselineId)?.name ?? "Línea base";

  const openNaming = () => {
    setName(proposedName);
    setNaming(true);
  };

  const confirm = () => {
    onSave(name.trim() || proposedName);
    setNaming(false);
  };

  return (
    <div className="gantt-project-toolbar__group gantt-project-toolbar__baseline-group">
      <button
        type="button"
        data-testid="baseline-save-open"
        onClick={openNaming}
        title="Guardar línea base"
        className="gantt-project-toolbar__button gantt-project-toolbar__button--text"
      >
        <Flag className="gantt-topbar__icon" aria-hidden />
        <span>Línea base</span>
      </button>

      {naming && (
        <input
          autoFocus
          data-testid="baseline-name-input"
          value={name}
          aria-label="Nombre de la línea base"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") confirm();
            if (event.key === "Escape") setNaming(false);
          }}
          className="gantt-project-toolbar__baseline-name"
        />
      )}
      {naming && (
        <button
          type="button"
          data-testid="baseline-save-confirm"
          onClick={confirm}
          className="gantt-project-toolbar__button gantt-project-toolbar__button--text"
        >
          Guardar
        </button>
      )}

      {baselines.length > 0 && (
        <div className="gantt-project-toolbar__baseline-select">
          <button
            type="button"
            data-testid="baseline-menu-open"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="gantt-project-toolbar__button gantt-project-toolbar__button--text"
          >
            {activeName}
          </button>

          {menuOpen && (
            <div className="gantt-project-toolbar__baseline-menu">
              {baselines.map((baseline) => (
                <div
                  key={baseline.id}
                  className="gantt-project-toolbar__baseline-option"
                  data-active={baseline.id === activeBaselineId}
                >
                  <button
                    type="button"
                    data-testid={`baseline-select-${baseline.id}`}
                    onClick={() => {
                      onSelect(baseline.id);
                      setMenuOpen(false);
                    }}
                  >
                    {baseline.name}
                  </button>
                  <button
                    type="button"
                    data-testid={`baseline-delete-${baseline.id}`}
                    onClick={() => onDelete(baseline.id)}
                  >
                    Borrar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

En `src/components/gantt/toolbar/ProjectToolbar.tsx`, sustituir todo el bloque de líneas 252-310 por
`<BaselineMenu ... />`, propagando las props que el toolbar ya recibe y añadiendo `onDeleteBaseline` y
`proposedBaselineName` a su interfaz (líneas 66-70). Retirar el `useState` de `baselineDropdownOpen`
(línea 109) y su efecto de cierre por clic fuera (líneas 114-122) si quedan sin uso — el lint lo señalará.

En `src/components/views/GanttView.tsx`:

```tsx
  const handleSaveBaseline = useCallback(
    (name: string) => {
      const nueva = saveBaseline(calculatedTasks, name);
      setBaselines((prev) => [...prev, nueva]);
      setActiveBaselineId(nueva.id);
    },
    [calculatedTasks],
  );

  const handleDeleteBaseline = useCallback(
    (id: string) => {
      const index = baselines.findIndex((b) => b.id === id);
      if (index === -1) return;
      const removed = baselines[index];
      const wasActive = activeBaselineId === id;

      runUndoable({
        description: `Línea base «${removed.name}» eliminada`,
        execute: () => {
          setBaselines((prev) => prev.filter((b) => b.id !== id));
          if (wasActive) setActiveBaselineId(undefined);
        },
        undo: () => {
          setBaselines((prev) => {
            const next = [...prev];
            next.splice(index, 0, removed);
            return next;
          });
          if (wasActive) setActiveBaselineId(id);
        },
      });
    },
    [activeBaselineId, baselines, runUndoable],
  );
```

Y pasar a `ProjectToolbar`: `onDeleteBaseline={handleDeleteBaseline}` y
`proposedBaselineName={`Línea base ${baselines.length + 1}`}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/toolbar src/components/views/GanttView.test.tsx`
Expected: PASS (7 nuevos de `BaselineMenu`, 1 nuevo en `GanttView`, más los existentes).
El test `autosaves baseline snapshots` (`GanttView.test.tsx:1129`) **se romperá aquí**: ahora guardar son dos
pasos. Actualizarlo en esta misma tarea a:

```tsx
    fireEvent.click(screen.getByTestId("baseline-save-open"));
    fireEvent.change(screen.getByTestId("baseline-name-input"), {
      target: { value: "Antes de la lluvia" },
    });
    fireEvent.click(screen.getByTestId("baseline-save-confirm"));
```

y añadir la aserción `expect(latestSavedProject().baselines[0].name).toBe("Antes de la lluvia")`. No borrarlo.

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/toolbar/BaselineMenu.tsx src/components/gantt/toolbar/BaselineMenu.test.tsx src/components/gantt/toolbar/ProjectToolbar.tsx src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx
git commit -m "feat(linea-base): nombrar al guardar y borrar deshacible (M13)"
```

---

## Task 7: Seguimiento deja de tener sus propias líneas base

**Files:**
- Modify: `src/components/views/TrackingGanttView.tsx:463-560`
- Test: `src/components/views/TrackingGanttView.test.tsx` (crear: hoy no existe)
- Modify: `src/components/views/GanttView.tsx:1608` (el montaje de `TrackingGanttView`)

**Interfaces:**
- Produces: `TrackingGanttViewProps` gana `baselines: Baseline[]`, `activeBaselineId?: string`,
  `onSaveBaseline: (name: string) => void`, `onSelectBaseline: (id: string | undefined) => void`.
- Elimina: los dos `useState` de las líneas 470-471 y el `handleSaveBaseline` local (478-483).

- [ ] **Step 1: Write the failing test**

Crear `src/components/views/TrackingGanttView.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import TrackingGanttView from "./TrackingGanttView";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Tarea ${overrides.id}`,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate("2026-01-10"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

const baseline = {
  id: "bl-1",
  name: "Antes de la lluvia",
  createdAt: new Date("2026-08-01"),
  tasks: [
    {
      taskId: 1,
      baselineStart: createProjectDate("2026-01-05"),
      baselineFinish: createProjectDate("2026-01-08"),
      baselineDuration: 3,
    },
  ],
};

describe("Seguimiento usa las líneas base del proyecto (M13)", () => {
  test("muestra las líneas base que le llegan, sin guardar ninguna antes", () => {
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[baseline]}
        activeBaselineId="bl-1"
        onSaveBaseline={jest.fn()}
        onSelectBaseline={jest.fn()}
      />,
    );

    expect(screen.getByTestId("baseline-select")).toHaveValue("bl-1");
    expect(screen.getByText("Antes de la lluvia")).toBeInTheDocument();
  });

  test("guardar avisa al proyecto en vez de guardarse una copia propia", () => {
    const onSaveBaseline = jest.fn();
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[]}
        onSaveBaseline={onSaveBaseline}
        onSelectBaseline={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("save-baseline-btn"));

    expect(onSaveBaseline).toHaveBeenCalledTimes(1);
    // Sin líneas base previas, el nombre propuesto es el primero.
    expect(onSaveBaseline).toHaveBeenCalledWith("Línea base 1");
  });

  test("cambiar la selección avisa al proyecto", () => {
    const onSelectBaseline = jest.fn();
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[baseline]}
        onSaveBaseline={jest.fn()}
        onSelectBaseline={onSelectBaseline}
      />,
    );

    fireEvent.change(screen.getByTestId("baseline-select"), {
      target: { value: "bl-1" },
    });

    expect(onSelectBaseline).toHaveBeenCalledWith("bl-1");
  });

  test("la sub-barra habla español", () => {
    render(
      <TrackingGanttView
        tasks={[task({ id: 1 })]}
        scale="week"
        selectedTaskIds={[]}
        baselines={[baseline]}
        activeBaselineId="bl-1"
        onSaveBaseline={jest.fn()}
        onSelectBaseline={jest.fn()}
      />,
    );

    expect(screen.getByTestId("save-baseline-btn")).toHaveTextContent(
      "Guardar línea base",
    );
    expect(screen.queryByText(/Save Baseline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/behind/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("baseline-variance-summary")).toHaveTextContent(
      /atrasada|adelantada|en fecha/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/TrackingGanttView.test.tsx`
Expected: FAIL — TypeScript rechaza las props `baselines`, `activeBaselineId`, `onSaveBaseline` y
`onSelectBaseline`, que no existen en `TrackingGanttViewProps`; en ejecución, el primer test falla porque
`baseline-select` no se renderiza (el estado local arranca en `[]`, `TrackingGanttView.tsx:470`).

- [ ] **Step 3: Write minimal implementation**

En `src/components/views/TrackingGanttView.tsx`:

1. Ampliar `TrackingGanttViewProps` con las cuatro props nuevas (`Baseline` ya está importado, línea 5).
2. Borrar los `useState` de las líneas 470-471 y el `handleSaveBaseline` local (478-483). `activeBaseline`
   pasa a derivarse de las props. El botón llama:
   ```tsx
   onClick={() => onSaveBaseline(`Línea base ${baselines.length + 1}`)}
   ```
3. El `<select data-testid="baseline-select">` pasa a `value={activeBaselineId ?? ""}` y
   `onChange={(e) => onSelectBaseline(e.target.value || undefined)}`.
4. Copy: «Save Baseline» → «Guardar línea base»; «Baseline:» → «Línea base:»; `<option value="">None</option>`
   → «Ninguna». El resumen (líneas 540-553) pasa a un `<span data-testid="baseline-variance-summary">` con
   texto de obra: `` `${activeBaseline.tasks.length} actividades · ${atrasadas} atrasadas, ${adelantadas} adelantadas` ``.
5. `saveBaseline`, `applyBaselineToTasks` y `compareWithBaseline` siguen importándose de
   `@/lib/scheduling/baseline`; `saveBaseline` deja de usarse aquí y su import se retira (el lint lo señalará).

En `src/components/views/GanttView.tsx:1608`, pasar al `<TrackingGanttView>`:

```tsx
              baselines={baselines}
              activeBaselineId={activeBaselineId}
              onSaveBaseline={handleSaveBaseline}
              onSelectBaseline={setActiveBaselineId}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/TrackingGanttView.test.tsx src/components/views/GanttView.test.tsx`
Expected: PASS (4 nuevos + los existentes).
Comprobar que no queda estado huérfano: `grep -n "useState" src/components/views/TrackingGanttView.tsx` no
debe devolver ninguna línea con `Baseline`.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/TrackingGanttView.tsx src/components/views/TrackingGanttView.test.tsx src/components/views/GanttView.tsx
git commit -m "refactor(linea-base): Seguimiento pasa a usar las lineas base del proyecto (M13)"
```

---

## Task 8: Verificación completa y cierre

**Files:** ninguno nuevo. Es la comprobación de que el conjunto funciona, no solo cada pieza.

- [ ] **Step 1: Suite completa**

```bash
npx jest --runInBand
```
Expected: 0 fallos. Anotar el número total de tests, que debe ser el de partida más los ~25 nuevos.

- [ ] **Step 2: Lint, tipos y build**

```bash
npx eslint src/components/views/GanttView.tsx src/components/views/TrackingGanttView.tsx src/components/gantt/GanttChart.tsx src/components/gantt/toolbar/BaselineMenu.tsx src/components/gantt/toolbar/ProjectToolbar.tsx src/lib/gantt/pendingChanges.ts src/lib/gantt/saveStatusLabel.ts
```

```bash
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
```
Expected: salida **vacía**.

```bash
npx next build
```

- [ ] **Step 3: Comprobación en navegador**

Desde la raíz del repositorio: `docker compose up -d --build frontend`, esperar a que levante y abrir
`http://localhost:3000/gantt-demo`. Recorrer, en este orden:

1. Seleccionar una tarea → «Observaciones» → anotar «Falta acero de refuerzo en el eje 3» → guardar.
   El indicador debe pasar a «Guardando…» **sin esperar** y luego a «Guardado a las HH:MM».
2. Recargar con F5. La observación sigue ahí.
3. Pulsar «Línea base» → escribir «Antes de la lluvia» → Guardar. Deben aparecer las barras fantasma en el
   Gantt principal, no solo en Seguimiento.
4. Ir a Seguimiento: el desplegable ya muestra «Antes de la lluvia» seleccionada, sin volver a guardarla.
5. Volver al Gantt, abrir el desplegable de línea base, «Borrar». Las barras fantasma desaparecen.
   `Ctrl+Z` las devuelve.
6. Editar la duración de una tarea y cerrar la pestaña en menos de un segundo: el navegador pregunta.
   Repetir sin editar nada: no pregunta.

- [ ] **Step 4: Registrar en EXPERIMENTS.md**

Añadir a `docs/EXPERIMENTS.md` una tarjeta del proyecto P1 con qué se construyó y la evidencia real de los
pasos anteriores (números de tests, salida de los comandos, lo verificado en navegador). No marcar nada como
hecho sin la salida del comando delante.

- [ ] **Step 5: Commit y revisión**

```bash
git add docs/EXPERIMENTS.md
git commit -m "docs(experiments): registrar P1 no perder trabajo con su evidencia"
```

Luego `superpowers:requesting-code-review` sobre la rama completa y, al pasar,
`superpowers:finishing-a-development-branch` para fusionar a `main`.

---

## Preguntas abiertas

1. **Tope de líneas base.** La spec del 2026-08-06 no lo decide. MS Project permite 11;
   `src/lib/scheduling/baseline.ts:1-6` dice explícitamente que el módulo no impone límite. Este proyecto
   **no impone tope**. Si el uso real muestra desplegables inmanejables, se decide entonces.
2. **Qué pasa con las líneas base guardadas antes de este cambio.** Las que ya existan en base de datos se
   llaman «Baseline 1», «Baseline 2»… Se dejan como están: renombrarlas automáticamente sería reescribir un
   dato que el usuario podría reconocer. Los nombres nuevos son en español.
