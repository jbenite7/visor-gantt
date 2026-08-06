# Plan de mejora visor-gantt v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bajar el menú lateral de 14 a 9 vistas sin perder ninguna capacidad, hacer que cada vista explique para qué sirve, volver legible la espera de la importación y cerrar el deshacer que quedó a medias.

**Architecture:** Cuatro entregas independientes y desplegables por separado. La lista de vistas vive en una sola fuente (`VIEW_TABS`), así que el recorte es un cambio de datos más el enrutado de lo absorbido; las vistas absorbidas se convierten en presets del selector «Vista rol» que ya existe. La ayuda por vista se extrae de los 18 textos ya escritos en la paleta de comandos a un módulo único que alimenta tanto el panel de ayuda como los estados vacíos.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · Jest + Testing Library · Playwright (E2E) · Docker Compose.

Spec: [2026-08-05-plan-mejora-v2-design.md](../specs/2026-08-05-plan-mejora-v2-design.md)

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Sin excepciones.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Comandos de verificación: `npx jest --runInBand`, `npx eslint <archivos>`, `npx tsc --noEmit`, `npx next build`.
- `npx tsc --noEmit` arrastra **38 errores preexistentes** en archivos `*.test.*` y `e2e/`. Filtrar siempre: `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`. Ese filtro debe salir **vacío**.
- Copy en **español con tildes**, en lenguaje de obra, sin jerga de infraestructura (ver `docs/POSITIONING.md`).
- No añadir color nuevo: usar los tokens de `src/app/globals.css`.
- Verificación en navegador: `docker compose up -d --build frontend` desde la raíz, esperar y abrir `http://localhost:3000/gantt-demo`.
- Ninguna capacidad puede desaparecer: lo que sale del menú queda accesible por otra vía.

---

## File Structure

| Archivo | Responsabilidad | Entrega |
|---|---|---|
| `src/components/gantt/toolbar/ViewSidebar.tsx` | Única fuente de `VIEW_TABS` (la lista del menú) | 1 |
| `src/types/ui.ts` | `RoleViewPresetId` — se amplía con los dos presets nuevos | 1 |
| `src/lib/gantt/roleViewPresets.ts` | Presets del selector «Vista rol» | 1 |
| `src/components/views/ProblemsView.tsx` | **Nuevo.** Une Cuellos y Conflictos en una vista de dos secciones | 1 |
| `src/app/project/new/NewProjectForm.tsx` | Recibe la creación de matriz | 1 |
| `src/app/page.tsx` | Deja de anunciar la demo de desarrollo (C6) | 1 |
| `src/lib/gantt/viewHelp.ts` | **Nuevo.** Mapa `ViewType → ayuda`, fuente única de los textos | 2 |
| `src/components/gantt/ViewHelpPanel.tsx` | **Nuevo.** Panel «¿Qué es esta vista?» | 2 |
| `src/components/upload/HomeMppUploadAction.tsx` | Fases, cancelar y resumen de importación | 3 |
| `src/app/api/import-mpp/route.ts` | Timeout y conteos en la respuesta | 3 |
| `src/components/views/GanttView.tsx` | Envolver acciones sueltas con `runUndoable`; indicador de guardado | 4 |
| `src/lib/state/ProjectContext.tsx` | Anuncio de qué se deshizo | 4 |

---

# ENTREGA 1 — El recorte (14 → 9)

Va primera porque toca `ViewType`, que consumen los E2E. No se avanza a la Entrega 2 sin la suite completa en verde.

## Task 1: Vista «Problemas» que une Cuellos y Conflictos

**Files:**
- Create: `src/components/views/ProblemsView.tsx`
- Test: `src/components/views/ProblemsView.test.tsx`

**Interfaces:**
- Consumes: `BottlenecksView` (props `{ issues: ScheduleIssue[]; bottlenecks: Bottleneck[] }`), `ConflictsView` (props `{ tasks: GanttTask[] }`).
- Produces: `export default function ProblemsView(props: { tasks: GanttTask[]; issues: ScheduleIssue[]; bottlenecks: Bottleneck[] }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ProblemsView from "./ProblemsView";
import type { GanttTask } from "@/components/gantt/types";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Tarea ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-09T17:00:00"),
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

describe("ProblemsView (C2: Cuellos + Conflictos en una vista)", () => {
  test("muestra las dos secciones en una sola pantalla", () => {
    render(<ProblemsView tasks={[task({ id: 1 })]} issues={[]} bottlenecks={[]} />);

    expect(screen.getByTestId("problems-section-bottlenecks")).toBeInTheDocument();
    expect(screen.getByTestId("problems-section-conflicts")).toBeInTheDocument();
  });

  test("cada sección lleva su encabezado en español", () => {
    render(<ProblemsView tasks={[task({ id: 1 })]} issues={[]} bottlenecks={[]} />);

    expect(
      screen.getByRole("heading", { name: /cuellos de botella/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /conflictos/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/ProblemsView.test.tsx`
Expected: FAIL — `Cannot find module './ProblemsView'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import BottlenecksView from "@/components/views/BottlenecksView";
import ConflictsView from "@/components/views/ConflictsView";
import type { GanttTask } from "@/components/gantt/types";
import type { Bottleneck, ScheduleIssue } from "@/lib/scheduling/types";

interface ProblemsViewProps {
  tasks: GanttTask[];
  issues: ScheduleIssue[];
  bottlenecks: Bottleneck[];
}

/**
 * Cuellos y Conflictos respondían la misma pregunta («¿qué está mal en el
 * plan?») desde dos entradas distintas del menú, con el mismo icono.
 */
export default function ProblemsView({
  tasks,
  issues,
  bottlenecks,
}: ProblemsViewProps) {
  return (
    <div className="apple-module h-full overflow-auto">
      <section data-testid="problems-section-bottlenecks">
        <h2 className="sr-only">Cuellos de botella</h2>
        <BottlenecksView issues={issues} bottlenecks={bottlenecks} />
      </section>

      <section data-testid="problems-section-conflicts">
        <h2 className="sr-only">Conflictos</h2>
        <ConflictsView tasks={tasks} />
      </section>
    </div>
  );
}
```

Nota: `BottlenecksView` y `ConflictsView` ya renderizan sus propios títulos visibles («Cuellos de botella», «Conflictos»). Los `<h2 className="sr-only">` existen para que la estructura de encabezados sea navegable; si los tests fallan por encontrar dos coincidencias del mismo nombre accesible, quitar el `sr-only` y dejar el título que ya trae cada componente hijo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/ProblemsView.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/views/ProblemsView.tsx src/components/views/ProblemsView.test.tsx
git commit -m "feat(vistas): unir Cuellos y Conflictos en ProblemsView (C2)"
```

---

## Task 2: Presets nuevos para Seguimiento y Hoja de Tareas

**Files:**
- Modify: `src/types/ui.ts:3`
- Modify: `src/lib/gantt/roleViewPresets.ts:25` (array `ROLE_VIEW_PRESETS`)
- Test: `src/lib/gantt/roleViewPresets.test.ts` (crear si no existe)

**Interfaces:**
- Consumes: `RoleViewPreset` (campos `id`, `labelEs`, `labelEn`, `descriptionEs`, `descriptionEn`, `view`, `scale`, `taskFilter`, `visibleTaskColumns`).
- Produces: `RoleViewPresetId` amplía a `"planner" | "executive" | "field" | "tracking" | "taskSheet"`; `ROLE_VIEW_PRESETS` pasa a tener 5 entradas.

- [ ] **Step 1: Write the failing test**

```ts
import { ROLE_VIEW_PRESETS, findRoleViewPreset } from "./roleViewPresets";

describe("presets que absorben vistas del menú (C1)", () => {
  test("existe un preset de Seguimiento que abre la vista tracking", () => {
    const preset = findRoleViewPreset("tracking");
    expect(preset).toBeDefined();
    expect(preset!.view).toBe("tracking");
    expect(preset!.labelEs).toBe("Seguimiento");
  });

  test("existe un preset de Hoja de Tareas que abre la vista taskSheet", () => {
    const preset = findRoleViewPreset("taskSheet");
    expect(preset).toBeDefined();
    expect(preset!.view).toBe("taskSheet");
    expect(preset!.labelEs).toBe("Hoja de Tareas");
  });

  test("los presets nuevos no filtran tareas: mostrar todo es el punto de partida", () => {
    expect(findRoleViewPreset("tracking")!.taskFilter.type).toBe("all");
    expect(findRoleViewPreset("taskSheet")!.taskFilter.type).toBe("all");
  });

  test("cada preset describe para qué sirve, en español", () => {
    for (const preset of ROLE_VIEW_PRESETS) {
      expect(preset.descriptionEs.length).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/roleViewPresets.test.ts`
Expected: FAIL — `findRoleViewPreset("tracking")` devuelve `undefined`; además TypeScript rechaza `"tracking"` como `RoleViewPresetId`.

- [ ] **Step 3: Write minimal implementation**

En `src/types/ui.ts` línea 3, reemplazar:

```ts
export type RoleViewPresetId =
  | "planner"
  | "executive"
  | "field"
  | "tracking"
  | "taskSheet";
```

En `src/lib/gantt/roleViewPresets.ts`, añadir al final del array `ROLE_VIEW_PRESETS` (antes del `];`):

```ts
  {
    id: "tracking",
    labelEs: "Seguimiento",
    labelEn: "Tracking",
    descriptionEs: "Compara el plan contra la línea base para ver qué se atrasó.",
    descriptionEn: "Compare the plan against the baseline to see what slipped.",
    view: "tracking",
    scale: "week",
    taskFilter: { type: "all", text: "" },
    visibleTaskColumns: ["id", "wbs", "name", "start", "finish", "duration", "progress"],
  },
  {
    id: "taskSheet",
    labelEs: "Hoja de Tareas",
    labelEn: "Task Sheet",
    descriptionEs: "Listado completo de actividades para revisar datos en tabla.",
    descriptionEn: "Full activity list for reviewing data as a table.",
    view: "taskSheet",
    scale: "week",
    taskFilter: { type: "all", text: "" },
    visibleTaskColumns: ["id", "wbs", "name", "start", "finish", "duration", "progress"],
  },
```

Nota: si `TaskFilterSettings` exige más campos que `type` y `text`, copiar la forma exacta del preset `planner` que ya existe en el mismo archivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/roleViewPresets.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Verify the whole suite still passes**

Run: `npx jest --runInBand`
Expected: todos verdes. Si algún test asume que hay exactamente 3 presets, actualizarlo a 5 — es un cambio esperado, no una regresión.

- [ ] **Step 6: Commit**

```bash
git add src/types/ui.ts src/lib/gantt/roleViewPresets.ts src/lib/gantt/roleViewPresets.test.ts
git commit -m "feat(vistas): Seguimiento y Hoja de Tareas pasan a presets (C1)"
```

---

## Task 3: Recortar el menú lateral (14 → 9) y el enlace a la demo

**Files:**
- Modify: `src/components/gantt/toolbar/ViewSidebar.tsx:27-42` (array `VIEW_TABS`)
- Modify: `src/app/page.tsx:107-116` (bloque del enlace «Ver Demo Gantt»)
- Test: `src/components/gantt/toolbar/ViewSidebar.test.tsx` (crear si no existe)

**Interfaces:**
- Consumes: `ViewType` de `./ViewSwitcher`.
- Produces: `VIEW_TABS` con 9 entradas. Los `data-testid` sobrevivientes mantienen el patrón `sidebar-view-<id>`.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import ViewSidebar from "./ViewSidebar";

describe("ViewSidebar tras el recorte (C1-C5)", () => {
  test("muestra 9 vistas, no 14", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);
    expect(screen.getAllByRole("tab")).toHaveLength(9);
  });

  test("las vistas absorbidas ya no son entradas del menú", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    expect(screen.queryByTestId("sidebar-view-tracking")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-taskSheet")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-conflictos")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-network")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-view-matrix")).not.toBeInTheDocument();
  });

  test("las vistas que se quedan siguen accesibles", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);

    for (const id of [
      "gantt",
      "executive",
      "resources",
      "lob",
      "scurve",
      "bottlenecks",
      "unidadTipica",
      "calendario",
      "settings",
    ]) {
      expect(screen.getByTestId(`sidebar-view-${id}`)).toBeInTheDocument();
    }
  });

  test("«Cuellos» pasa a llamarse «Problemas» porque ahora incluye los conflictos", () => {
    render(<ViewSidebar activeView="gantt" onViewChange={jest.fn()} />);
    expect(screen.getByTestId("sidebar-view-bottlenecks")).toHaveTextContent(
      /problemas/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/toolbar/ViewSidebar.test.tsx`
Expected: FAIL — encuentra 14 tabs, no 9.

- [ ] **Step 3: Write minimal implementation**

En `src/components/gantt/toolbar/ViewSidebar.tsx`, reemplazar el array `VIEW_TABS` completo por:

```ts
const VIEW_TABS: ViewTab[] = [
  { id: "gantt", labelEs: "Gantt", labelEn: "Gantt", icon: BarChart3 },
  { id: "executive", labelEs: "Ejecutivo", labelEn: "Executive", icon: LayoutDashboard },
  { id: "resources", labelEs: "Recursos", labelEn: "Resources", icon: Users },
  { id: "lob", labelEs: "Línea Balance", labelEn: "Line Balance", icon: TrendingUp },
  { id: "scurve", labelEs: "Curva S", labelEn: "S Curve", icon: LineChart },
  { id: "bottlenecks", labelEs: "Problemas", labelEn: "Problems", icon: AlertTriangle },
  { id: "unidadTipica", labelEs: "Unidad Típica", labelEn: "Typical Unit", icon: Layers3 },
  { id: "calendario", labelEs: "Calendario", labelEn: "Calendar", icon: CalendarDays },
  { id: "settings", labelEs: "Configuración", labelEn: "Settings", icon: Settings },
];
```

Los iconos `GitCompare`, `Table`, `Network` y `Grid3X3` quedan sin usar: eliminarlos del `import` de `lucide-react` en ese archivo para que el lint no falle.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/toolbar/ViewSidebar.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Quitar el enlace a la demo de la home (C6)**

`src/app/page.tsx` enlaza `/gantt-demo` como «Ver Demo Gantt» junto a los proyectos reales del usuario.
Es una demo de desarrollo con 8 tareas de ejemplo: no pertenece a la pantalla de trabajo.

Eliminar el bloque completo:

```tsx
<div className="mt-8 flex gap-4">
  <Link href="/gantt-demo" className="apple-button-secondary …">
    <UploadCloud size={15} aria-hidden />
    Ver Demo Gantt
    <ArrowRight size={15} aria-hidden />
  </Link>
</div>
```

La ruta `/gantt-demo` **se conserva** (la usan las verificaciones en navegador de este plan); solo deja de
anunciarse en la home. Quitar del `import` de `lucide-react` los iconos `UploadCloud` y `ArrowRight` si
dejan de usarse en el archivo, y `Link` si tampoco se usa en otro sitio de la página.

- [ ] **Step 6: Verify the home still builds and renders**

Run: `npx jest --runInBand` y luego `npx eslint src/app/page.tsx`
Expected: verde y sin avisos de imports sin usar.

- [ ] **Step 7: Commit**

```bash
git add src/components/gantt/toolbar/ViewSidebar.tsx src/components/gantt/toolbar/ViewSidebar.test.tsx src/app/page.tsx
git commit -m "feat(vistas): recortar menu de 14 a 9 y quitar el enlace a la demo (C6)"
```

---

## Task 4: Enrutar ProblemsView y conservar los accesos que salieron del menú

**Files:**
- Modify: `src/components/views/GanttView.tsx` (bloque `activeView === "bottlenecks"` y `activeView === "conflictos"`)
- Test: `src/components/views/GanttView.test.tsx` (añadir al final)

**Interfaces:**
- Consumes: `ProblemsView` de Task 1 — `{ tasks, issues, bottlenecks }`.
- Produces: al elegir la vista `bottlenecks` se monta `ProblemsView`. `network` y `matrix` siguen alcanzables por la paleta de comandos.

- [ ] **Step 1: Write the failing test**

```tsx
describe("recorte del menú: nada se pierde (C3, C5)", () => {
  test("la vista Problemas monta las dos secciones", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("sidebar-view-bottlenecks"));

    expect(
      await screen.findByTestId("problems-section-bottlenecks"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("problems-section-conflicts")).toBeInTheDocument();
  });

  test("Diagrama de Red sigue accesible desde la paleta de comandos", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByTestId("command-palette-item-view-network")).toBeInTheDocument();
  });
});
```

Nota: el `data-testid` del comando se construye como `command-palette-item-${command.id}`. Antes de escribir el test, confirmar el `id` real del comando de red con:
`grep -n '"view-network"\|id: "view' src/components/views/GanttView.tsx` y usar ese valor exacto.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/GanttView.test.tsx -t "recorte del menú"`
Expected: FAIL — no existe `problems-section-bottlenecks` porque aún se monta `BottlenecksView` directamente.

- [ ] **Step 3: Write minimal implementation**

En `GanttView.tsx`, sustituir los dos bloques separados por uno solo:

```tsx
{activeView === "bottlenecks" && (
  <ProblemsView
    tasks={calculatedTasks}
    issues={scheduleIssues}
    bottlenecks={bottlenecks}
  />
)}
```

Eliminar el bloque `{activeView === "conflictos" && (<ConflictsView … />)}`. Añadir el import diferido junto a los demás:

```tsx
const ProblemsView = dynamic(() => import("@/components/views/ProblemsView"), { loading: ViewLoading });
```

Los bloques de `network` y `matrix` **se conservan tal cual**: siguen montándose cuando `activeView` toma esos valores desde la paleta de comandos.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/GanttView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx
git commit -m "feat(vistas): enrutar Problemas y conservar Red y Matriz fuera del menu"
```

---

## Task 5: Mover «Crear matriz» a Nuevo Proyecto y reparar los E2E

**Files:**
- Modify: `src/app/project/new/NewProjectForm.tsx`
- Modify: `e2e/matrix-new-project.spec.ts:214`
- Modify: `e2e/matrix-deep-project-evidence.spec.ts:283`

**Interfaces:**
- Consumes: el flujo de creación de matriz que hoy vive tras el botón «Crear matriz» de la vista Matriz.
- Produces: `/project/new` ofrece crear un proyecto matricial; los E2E dejan de depender de `sidebar-view-matrix`.

- [ ] **Step 1: Run the E2E to see them fail**

Run: `npx playwright test e2e/matrix-new-project.spec.ts`
Expected: FAIL — `getByTestId("sidebar-view-matrix")` ya no existe tras Task 3.

Este es el fallo esperado: confirma que el recorte llegó al E2E.

- [ ] **Step 2: Comprobar qué ofrece hoy NewProjectForm**

Run: `grep -n "matrix\|matricial" src/app/project/new/NewProjectForm.tsx | head -20`

`NewProjectForm` ya tiene un modo matricial (es el preseleccionado por defecto). Anotar el `data-testid` o el texto exacto del control que lo activa: los E2E apuntarán ahí.

- [ ] **Step 3: Actualizar los E2E al nuevo camino**

En ambos archivos, reemplazar la línea que hace clic en `sidebar-view-matrix` por la navegación al editor de matriz desde el proyecto ya creado. Si el editor solo es accesible cuando el proyecto tiene matriz, usar la paleta de comandos:

```ts
await page.keyboard.press("Meta+k");
await page.getByTestId("command-palette-item-view-matrix").click();
```

Confirmar el `id` real del comando con `grep -n 'view-matrix' src/components/views/GanttView.tsx` antes de escribirlo.

- [ ] **Step 4: Run the E2E to verify they pass**

Run: `npx playwright test e2e/matrix-new-project.spec.ts e2e/matrix-deep-project-evidence.spec.ts`
Expected: PASS

Si el entorno no puede levantar Playwright, dejarlo anotado explícitamente en el commit en vez de darlo por bueno.

- [ ] **Step 5: Commit**

```bash
git add src/app/project/new/NewProjectForm.tsx e2e/matrix-new-project.spec.ts e2e/matrix-deep-project-evidence.spec.ts
git commit -m "feat(matriz): crear matriz desde Nuevo Proyecto y actualizar E2E"
```

---

## Task 6: Verificación de la Entrega 1

- [ ] **Step 1: Suite completa**

Run: `npx jest --runInBand`
Expected: todos verdes.

- [ ] **Step 2: Lint y tipos**

```bash
npx eslint src/components/views/ProblemsView.tsx src/components/views/GanttView.tsx src/components/gantt/toolbar/ViewSidebar.tsx src/lib/gantt/roleViewPresets.ts
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
```
Expected: lint sin salida; el filtro de tipos, vacío.

- [ ] **Step 3: Build**

Run: `npx next build`
Expected: termina sin error.

- [ ] **Step 4: Navegador**

```bash
cd .. && docker compose up -d --build frontend
until curl -sf -m 3 http://localhost:3000/gantt-demo -o /dev/null; do sleep 5; done
```

Abrir `http://localhost:3000/gantt-demo` y comprobar: 9 entradas en el menú, ninguna etiqueta cortada, y que «Problemas» muestra las dos secciones.

- [ ] **Step 5: Commit de cierre**

```bash
git commit --allow-empty -m "chore(vistas): entrega 1 verificada — menu de 14 a 9 vistas"
```

---

# ENTREGA 2 — Ayuda por vista

## Task 7: Módulo único de ayuda por vista

**Files:**
- Create: `src/lib/gantt/viewHelp.ts`
- Test: `src/lib/gantt/viewHelp.test.ts`

**Interfaces:**
- Consumes: `ViewType` de `@/components/gantt/toolbar/ViewSwitcher`.
- Produces:
  - `export interface ViewHelp { title: string; purpose: string; needs: string }`
  - `export function viewHelpFor(view: ViewType): ViewHelp | null`

- [ ] **Step 1: Write the failing test**

```ts
import { viewHelpFor } from "./viewHelp";

describe("viewHelp: cada vista explica para qué sirve (E8)", () => {
  test("las 9 vistas del menú tienen ayuda", () => {
    for (const view of [
      "gantt",
      "executive",
      "resources",
      "lob",
      "scurve",
      "bottlenecks",
      "unidadTipica",
      "calendario",
      "settings",
    ] as const) {
      expect(viewHelpFor(view)).not.toBeNull();
    }
  });

  test("la ayuda dice para qué sirve y qué necesita el cronograma", () => {
    const help = viewHelpFor("lob")!;
    expect(help.purpose.length).toBeGreaterThan(20);
    expect(help.needs.length).toBeGreaterThan(20);
  });

  test("está escrita en lenguaje de obra, sin jerga de infraestructura", () => {
    const help = viewHelpFor("lob")!;
    const texto = `${help.purpose} ${help.needs}`;
    expect(texto).not.toMatch(/base de datos|endpoint|API|\.env|backend/i);
  });

  test("una vista desconocida devuelve null en vez de romper", () => {
    expect(viewHelpFor("no-existe" as never)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/gantt/viewHelp.test.ts`
Expected: FAIL — `Cannot find module './viewHelp'`

- [ ] **Step 3: Write minimal implementation**

Los textos salen de los `hint` que ya existen en `commandActions` de `GanttView.tsx` (18 de ellos), reescritos al tono de `docs/POSITIONING.md`:

```ts
import type { ViewType } from "@/components/gantt/toolbar/ViewSwitcher";

export interface ViewHelp {
  title: string;
  /** Qué responde esta vista. */
  purpose: string;
  /** Qué necesita el cronograma para que sirva. */
  needs: string;
}

const VIEW_HELP: Partial<Record<ViewType, ViewHelp>> = {
  gantt: {
    title: "Gantt",
    purpose:
      "El cronograma completo: cuándo va cada actividad, de qué depende y cuál no puede atrasarse.",
    needs: "Tareas con fechas. Es la vista base: siempre tiene algo que mostrar.",
  },
  executive: {
    title: "Ejecutivo",
    purpose:
      "Resumen para dirección: cómo van el plazo, el costo y el alcance en una sola pantalla.",
    needs: "Tareas con avance. Con presupuesto cargado además compara costo.",
  },
  resources: {
    title: "Recursos",
    purpose:
      "Quién y qué hace falta en cada actividad, y cuánto se está cargando cada cuadrilla.",
    needs:
      "Recursos asignados a las tareas. Si el .mpp no traía recursos, esta vista sale vacía.",
  },
  lob: {
    title: "Línea de Balance",
    purpose:
      "Compara el ritmo de una misma actividad piso por piso, para ver si la obra avanza parejo.",
    needs:
      "Actividades que se repitan en varios niveles, con el piso en el nombre o en el WBS.",
  },
  scurve: {
    title: "Curva S",
    purpose:
      "Cómo se acumula el avance en el tiempo, para comparar lo planeado con lo real.",
    needs: "Tareas con fechas y porcentaje de avance.",
  },
  bottlenecks: {
    title: "Problemas",
    purpose:
      "Todo lo que está mal en el plan: los cuellos que amarran la obra y las fechas que se contradicen.",
    needs:
      "Dependencias entre tareas. Sin conflictos, esta vista dice que el plan está limpio.",
  },
  unidadTipica: {
    title: "Unidad Típica",
    purpose:
      "La secuencia constructiva de un piso tipo, para ver si se repite igual en toda la torre.",
    needs:
      "La misma actividad repetida en tres o más pisos — por ejemplo «Mampostería piso 1, 2, 3».",
  },
  calendario: {
    title: "Calendario",
    purpose: "Los días que la obra trabaja y los que no, mes a mes.",
    needs: "El calendario del proyecto, que viene en el .mpp o se ajusta en Configuración.",
  },
  settings: {
    title: "Configuración",
    purpose:
      "La jornada, los días laborales y los festivos. Lo que aquí definas manda sobre todas las fechas.",
    needs: "Nada: siempre está disponible.",
  },
};

export function viewHelpFor(view: ViewType): ViewHelp | null {
  return VIEW_HELP[view] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/gantt/viewHelp.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/gantt/viewHelp.ts src/lib/gantt/viewHelp.test.ts
git commit -m "feat(ayuda): modulo unico de ayuda por vista (E8)"
```

---

## Task 8: Panel «¿Qué es esta vista?»

**Files:**
- Create: `src/components/gantt/ViewHelpPanel.tsx`
- Test: `src/components/gantt/ViewHelpPanel.test.tsx`
- Modify: `src/app/globals.css` (añadir al final)

**Interfaces:**
- Consumes: `viewHelpFor` y `ViewHelp` de Task 7.
- Produces: `export default function ViewHelpPanel(props: { view: ViewType; onClose: () => void }): JSX.Element | null`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ViewHelpPanel from "./ViewHelpPanel";

describe("ViewHelpPanel (E8)", () => {
  test("muestra el propósito y lo que necesita la vista", () => {
    render(<ViewHelpPanel view="lob" onClose={jest.fn()} />);

    expect(screen.getByRole("heading")).toHaveTextContent(/línea de balance/i);
    expect(screen.getByTestId("view-help-purpose")).not.toBeEmptyDOMElement();
    expect(screen.getByTestId("view-help-needs")).not.toBeEmptyDOMElement();
  });

  test("se puede cerrar", () => {
    const onClose = jest.fn();
    render(<ViewHelpPanel view="lob" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("una vista sin ayuda no rompe la pantalla", () => {
    const { container } = render(
      <ViewHelpPanel view={"no-existe" as never} onClose={jest.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/ViewHelpPanel.test.tsx`
Expected: FAIL — `Cannot find module './ViewHelpPanel'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { HelpCircle } from "lucide-react";
import type { ViewType } from "@/components/gantt/toolbar/ViewSwitcher";
import { viewHelpFor } from "@/lib/gantt/viewHelp";

interface ViewHelpPanelProps {
  view: ViewType;
  onClose: () => void;
}

export default function ViewHelpPanel({ view, onClose }: ViewHelpPanelProps) {
  const help = viewHelpFor(view);
  if (!help) return null;

  return (
    <aside className="gantt-view-help" role="dialog" aria-label="Ayuda de esta vista">
      <header className="gantt-view-help__header">
        <h2>
          <HelpCircle size={15} aria-hidden /> {help.title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Cerrar ayuda">
          ×
        </button>
      </header>
      <p data-testid="view-help-purpose">{help.purpose}</p>
      <p data-testid="view-help-needs" className="gantt-view-help__needs">
        <strong>Qué necesita:</strong> {help.needs}
      </p>
    </aside>
  );
}
```

Añadir al final de `src/app/globals.css`:

```css
/* Ayuda por vista (E8) */
.gantt-view-help {
  position: absolute;
  right: var(--space-4, 1rem);
  top: var(--space-4, 1rem);
  z-index: 45;
  width: min(20rem, calc(100vw - 2rem));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: var(--radius-lg);
  border: var(--border-width-hairline) solid var(--color-hairline);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-lg, 0 10px 30px rgb(0 0 0 / 18%));
  padding: 0.875rem;
  font-family: var(--font-body), system-ui, sans-serif;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.gantt-view-help__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--color-text-strong);
}

.gantt-view-help__header h2 {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.gantt-view-help__needs {
  border-top: var(--border-width-hairline) solid var(--color-hairline);
  padding-top: 0.5rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/gantt/ViewHelpPanel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/gantt/ViewHelpPanel.tsx src/components/gantt/ViewHelpPanel.test.tsx src/app/globals.css
git commit -m "feat(ayuda): panel Que es esta vista"
```

---

## Task 9: Botón «?» que abre la ayuda de la vista activa

**Files:**
- Modify: `src/components/views/GanttView.tsx`
- Test: `src/components/views/GanttView.test.tsx` (añadir al final)

**Interfaces:**
- Consumes: `ViewHelpPanel` de Task 8.
- Produces: botón con `data-testid="open-view-help"` en la barra superior.

- [ ] **Step 1: Write the failing test**

```tsx
describe("ayuda de la vista activa (E8)", () => {
  test("el botón de ayuda abre el panel de la vista en la que estás", async () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    fireEvent.click(screen.getByTestId("open-view-help"));

    expect(await screen.findByRole("dialog", { name: /ayuda/i })).toHaveTextContent(
      /gantt/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/GanttView.test.tsx -t "ayuda de la vista activa"`
Expected: FAIL — no existe `open-view-help`.

- [ ] **Step 3: Write minimal implementation**

Estado, junto a los demás `useState` de `GanttViewInner`:

```tsx
const [helpOpen, setHelpOpen] = useState(false);
```

Botón en la barra superior, junto al de «Comandos»:

```tsx
<button
  type="button"
  onClick={() => setHelpOpen((open) => !open)}
  data-testid="open-view-help"
  title="Qué es esta vista"
  className="apple-button-secondary gantt-command-button"
>
  <HelpCircle size={15} aria-hidden />
  Ayuda
</button>
```

Panel, junto a `UndoToast` / `RejectionToast`:

```tsx
{helpOpen && (
  <ViewHelpPanel view={activeView} onClose={() => setHelpOpen(false)} />
)}
```

Imports: `HelpCircle` de `lucide-react` y `ViewHelpPanel` (estático, es ligero).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/GanttView.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify suite, lint, types and build**

```bash
npx jest --runInBand
npx eslint src/components/views/GanttView.tsx src/components/gantt/ViewHelpPanel.tsx src/lib/gantt/viewHelp.ts
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
npx next build
```
Expected: todo verde; el filtro de tipos, vacío.

- [ ] **Step 6: Commit**

```bash
git add src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx
git commit -m "feat(ayuda): boton de ayuda por vista en la barra superior (E8)"
```

---

# ENTREGA 3 — Progreso de importación

## Task 10: Resumen de lo importado en la respuesta del API

**Files:**
- Modify: `src/app/api/import-mpp/route.ts`
- Test: `src/app/api/import-mpp/route.test.ts`

**Interfaces:**
- Consumes: `buildProjectDataFromMpp` (ya devuelve `tasks`, `resources` y las dependencias dentro de las tareas).
- Produces: en el éxito, además del redirect 303, la ruta expone los conteos por cabecera:
  `X-Import-Tasks`, `X-Import-Dependencies`, `X-Import-Resources` (enteros como texto).

- [ ] **Step 1: Write the failing test**

Añadir dentro del `describe("/api/import-mpp", …)` existente:

```ts
test("informa cuántas tareas, dependencias y recursos se importaron (E32)", async () => {
  const response = await POST(importRequest());

  expect(response.status).toBe(303);
  expect(response.headers.get("X-Import-Tasks")).toBe("4");
  expect(response.headers.get("X-Import-Dependencies")).toBe("2");
  expect(response.headers.get("X-Import-Resources")).toBe("0");
});
```

Nota: los valores esperados salen del `parsedProject` de ese archivo (4 tareas, 2 `PredecessorLink`, 0 recursos). Si el fixture cambia, ajustar los números al contenido real.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/import-mpp/route.test.ts -t "informa cuántas"`
Expected: FAIL — las cabeceras son `null`.

- [ ] **Step 3: Write minimal implementation**

Donde hoy se construye el redirect 303, calcular los conteos a partir del `ProjectData` ya construido y añadirlos:

```ts
const projectData = buildProjectDataFromMpp(parsed, { calculateFields: false });
// … saveProject(projectData) …

const dependencyCount = projectData.tasks.reduce(
  (total, task) => total + (task.dependencies?.length ?? 0),
  0,
);

const response = NextResponse.redirect(
  buildPublicUrl(request, `/project/${saved.id}`),
  303,
);
response.headers.set("X-Import-Tasks", String(projectData.tasks.length));
response.headers.set("X-Import-Dependencies", String(dependencyCount));
response.headers.set("X-Import-Resources", String(projectData.resources.length));
return response;
```

Adaptar los nombres de variable a los que ya existan en el archivo; no renombrar lo que ya funciona.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/import-mpp/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/import-mpp/route.ts src/app/api/import-mpp/route.test.ts
git commit -m "feat(import): informar conteos de lo importado (E32)"
```

---

## Task 11: Timeout y cancelación en la importación

**Files:**
- Modify: `src/components/upload/HomeMppUploadAction.tsx`
- Test: `src/components/upload/__tests__/HomeMppUploadAction.test.tsx`

**Interfaces:**
- Consumes: la ruta de Task 10.
- Produces: durante la importación se muestra la fase actual y un botón «Cancelar» con `data-testid="cancel-import"`.

- [ ] **Step 1: Write the failing test**

```tsx
test("mientras importa muestra la fase y deja cancelar (E4)", async () => {
  let resolveFetch: (value: Response) => void = () => {};
  global.fetch = jest.fn(
    () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
  ) as jest.Mock;

  render(<HomeMppUploadAction />);

  const input = screen.getByLabelText("Seleccionar archivo .mpp");
  fireEvent.change(input, {
    target: { files: [new File(["mpp"], "obra.mpp")] },
  });

  expect(await screen.findByText(/analizando/i)).toBeInTheDocument();

  const cancel = screen.getByTestId("cancel-import");
  fireEvent.click(cancel);

  expect(await screen.findByText(/importación cancelada/i)).toBeInTheDocument();
  resolveFetch(new Response(null, { status: 200 }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/upload/__tests__/HomeMppUploadAction.test.tsx -t "mientras importa"`
Expected: FAIL — no existe `cancel-import`.

- [ ] **Step 3: Write minimal implementation**

En `HomeMppUploadAction.tsx`:

```tsx
const IMPORT_TIMEOUT_MS = 180000;

const abortRef = useRef<AbortController | null>(null);
const [phase, setPhase] = useState<"idle" | "uploading" | "parsing" | "saving">("idle");
```

Dentro de `handleFile`, envolver el `fetch`:

```tsx
const controller = new AbortController();
abortRef.current = controller;
const timeout = setTimeout(() => controller.abort("timeout"), IMPORT_TIMEOUT_MS);
setPhase("parsing");

try {
  const response = await fetch("/api/import-mpp", {
    method: "POST",
    body,
    signal: controller.signal,
  });
  // … manejo existente …
} catch (error) {
  if (controller.signal.aborted) {
    setError(
      controller.signal.reason === "timeout"
        ? "El análisis tardó demasiado. Vuelve a intentarlo o prueba con un archivo más pequeño."
        : "Importación cancelada.",
    );
  } else {
    setError("No pudimos conectar con el servicio de importación. Reintentar.");
  }
} finally {
  clearTimeout(timeout);
  abortRef.current = null;
  setPhase("idle");
  setIsProcessing(false);
}
```

Y en el JSX, mientras `isProcessing`:

```tsx
{isProcessing && (
  <span className="gantt-import-phase">
    {phase === "uploading" && "Subiendo el archivo…"}
    {phase === "parsing" && "Analizando el cronograma…"}
    {phase === "saving" && "Guardando el proyecto…"}
    <button
      type="button"
      data-testid="cancel-import"
      onClick={() => abortRef.current?.abort("user")}
    >
      Cancelar
    </button>
  </span>
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/upload/__tests__/HomeMppUploadAction.test.tsx`
Expected: PASS. Este archivo tiene un test que roza el timeout de 5 s bajo carga; ejecutarlo aislado si falla en la suite completa.

- [ ] **Step 5: Verify suite, lint, types and build**

```bash
npx jest --runInBand
npx eslint src/components/upload/HomeMppUploadAction.tsx src/app/api/import-mpp/route.ts
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/upload/HomeMppUploadAction.tsx src/components/upload/__tests__/HomeMppUploadAction.test.tsx src/app/globals.css
git commit -m "feat(import): fases visibles, timeout y cancelar (E4)"
```

---

# ENTREGA 4 — Cerrar el deshacer

## Task 12: Editar recurso y editar partida se pueden deshacer

**Files:**
- Modify: `src/components/views/GanttView.tsx` (`handleEditResource`, `handleUpdateBudgetItem`)
- Test: `src/lib/state/undoableCollections.test.ts` (añadir al final)

**Interfaces:**
- Consumes: `runUndoable({ description, execute, undo })` del contexto y `insertAt` / `removeWhere` de `undoableCollections`.
- Produces: `replaceWhere<T>(items: T[], match: (item: T) => boolean, next: T): T[]`

- [ ] **Step 1: Write the failing test**

```ts
import { replaceWhere } from "./undoableCollections";

describe("replaceWhere (E24: editar también se deshace)", () => {
  test("sustituye el elemento que coincide y respeta el resto", () => {
    const items = [{ id: 1, n: "a" }, { id: 2, n: "b" }];
    const next = replaceWhere(items, (i) => i.id === 2, { id: 2, n: "B" });

    expect(next).toEqual([{ id: 1, n: "a" }, { id: 2, n: "B" }]);
  });

  test("no muta la lista original", () => {
    const items = [{ id: 1, n: "a" }];
    replaceWhere(items, (i) => i.id === 1, { id: 1, n: "z" });
    expect(items[0].n).toBe("a");
  });

  test("si nada coincide devuelve una copia igual", () => {
    const items = [{ id: 1, n: "a" }];
    expect(replaceWhere(items, (i) => i.id === 9, { id: 9, n: "x" })).toEqual(items);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/state/undoableCollections.test.ts`
Expected: FAIL — `replaceWhere is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `src/lib/state/undoableCollections.ts`:

```ts
export function replaceWhere<T>(
  items: T[],
  match: (item: T) => boolean,
  next: T,
): T[] {
  return items.map((item) => (match(item) ? next : item));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/state/undoableCollections.test.ts`
Expected: PASS

- [ ] **Step 5: Usar replaceWhere en los dos handlers**

En `GanttView.tsx`, sustituir `handleEditResource`:

```tsx
const handleEditResource = useCallback(
  (resource: Resource) => {
    const previous = resources.find((r) => r.uid === resource.uid);
    if (!previous) return;

    runUndoable({
      description: `Recurso «${resource.name ?? resource.uid}» editado`,
      execute: () =>
        setResources((prev) => replaceWhere(prev, (r) => r.uid === resource.uid, resource)),
      undo: () =>
        setResources((prev) => replaceWhere(prev, (r) => r.uid === resource.uid, previous)),
    });
  },
  [resources, runUndoable],
);
```

Y `handleUpdateBudgetItem` con el mismo patrón, comparando por `item.id` y describiendo
`` `Partida «${item.subcategory ?? item.category}» editada` ``.

Importar `replaceWhere` junto a `insertAt` y `removeWhere`.

- [ ] **Step 6: Run the whole suite**

Run: `npx jest --runInBand`
Expected: todos verdes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/state/undoableCollections.ts src/lib/state/undoableCollections.test.ts src/components/views/GanttView.tsx
git commit -m "feat(deshacer): editar recurso y partida entran al historial (E24)"
```

---

## Task 13: Ctrl+Z dice qué deshizo

**Files:**
- Modify: `src/lib/state/ProjectContext.tsx`
- Modify: `src/hooks/useHistory.ts`
- Test: `src/lib/state/ProjectContext.test.tsx` (añadir al final)

**Interfaces:**
- Consumes: `useHistory(50)`, cuyo `undo()` ya devuelve un booleano y cuyos comandos llevan `description`.
- Produces: tras un `undo()`, `lastAction` describe lo deshecho con el prefijo «Deshecho: ».

- [ ] **Step 1: Write the failing test**

```tsx
describe("el deshacer se anuncia (E12)", () => {
  test("tras Ctrl+Z el aviso dice qué se deshizo", () => {
    let ctx: ProjectContextValue | undefined;

    render(
      <ProjectProvider initialTasks={[task({ id: 1 }), task({ id: 2 })]}>
        <Harness onValue={(value) => (ctx = value)} />
      </ProjectProvider>,
    );

    act(() => ctx!.deleteTasks([2]));
    act(() => ctx!.undo());

    expect(ctx!.lastAction?.description).toMatch(/^Deshecho:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/state/ProjectContext.test.tsx -t "el deshacer se anuncia"`
Expected: FAIL — la descripción sigue siendo «1 tarea eliminada».

- [ ] **Step 3: Comprobar qué devuelve useHistory.undo**

Run: `grep -n "undo\b" -A 8 src/hooks/useHistory.ts | head -20`

Si `undo()` solo devuelve `boolean`, ampliarlo para que devuelva la `description` del comando deshecho (`string | null`). Ese cambio es interno del hook: mantener el booleano equivalente comprobando `!== null` en los llamadores existentes.

- [ ] **Step 4: Write minimal implementation**

En `ProjectContext.tsx`, envolver el `undo` que se expone:

```tsx
const undoWithAnnounce = useCallback(() => {
  const description = history.undo();
  if (!description) return;

  setLastAction({
    kind: "other",
    count: 1,
    description: `Deshecho: ${description}`,
    token: nextActionToken(),
  });
}, [history]);
```

Exponer `undo: undoWithAnnounce` en el value (en lugar de `history.undo`) y usarlo también en el atajo de teclado del mismo archivo. Añadir `undoWithAnnounce` al array de dependencias del `useMemo`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/lib/state/ProjectContext.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useHistory.ts src/lib/state/ProjectContext.tsx src/lib/state/ProjectContext.test.tsx
git commit -m "feat(deshacer): anunciar que se deshizo (E12)"
```

---

## Task 14: Indicador de guardado siempre visible

**Files:**
- Modify: `src/components/views/GanttView.tsx` (bloque `saveStatus !== "idle"`)
- Test: `src/components/views/GanttView.test.tsx` (añadir al final)

**Interfaces:**
- Consumes: el estado `saveStatus` ya existente (`"idle" | "saving" | "saved" | "error"`).
- Produces: el indicador existe siempre, con `role="status"`.

- [ ] **Step 1: Write the failing test**

```tsx
describe("indicador de guardado (E13)", () => {
  test("está visible desde que se abre el proyecto, no solo al guardar", () => {
    render(<GanttView tasks={[makeTask({ id: 1 })]} />);

    const status = screen.getByTestId("save-status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent(/guardado automático/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/GanttView.test.tsx -t "indicador de guardado"`
Expected: FAIL — el bloque solo se renderiza si `saveStatus !== "idle"`.

- [ ] **Step 3: Write minimal implementation**

Reemplazar el bloque condicional por uno permanente:

```tsx
<span className="gantt-save-status" data-status={saveStatus} data-testid="save-status" role="status">
  {saveStatus === "idle" && "Guardado automático activo"}
  {saveStatus === "saving" && "Guardando…"}
  {saveStatus === "saved" && "Guardado"}
  {saveStatus === "error" && "No se pudo guardar. Reintentar"}
</span>
```

Añadir en `globals.css`, junto a las reglas `.gantt-save-status[data-status=…]` existentes:

```css
.gantt-save-status[data-status="idle"] {
  background: var(--color-bg-surface-secondary);
  color: var(--color-text-muted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/GanttView.test.tsx`
Expected: PASS

- [ ] **Step 5: Final verification**

```bash
npx jest --runInBand
npx eslint src/components/views/GanttView.tsx src/lib/state/ProjectContext.tsx src/lib/state/undoableCollections.ts
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
npx next build
cd .. && docker compose up -d --build frontend
until curl -sf -m 3 http://localhost:3000/gantt-demo -o /dev/null; do sleep 5; done
```

Comprobar en `http://localhost:3000/gantt-demo`: 9 vistas, botón de ayuda que abre el panel, indicador de guardado visible al entrar.

- [ ] **Step 6: Commit**

```bash
git add src/components/views/GanttView.tsx src/components/views/GanttView.test.tsx src/app/globals.css
git commit -m "feat(guardado): indicador permanente con estado en reposo (E13)"
```

---

## Criterio de hecho (del spec)

- [ ] El menú lateral muestra **9 vistas**, ninguna con etiqueta truncada.
- [ ] Ninguna capacidad desaparece: Diagrama de Red accesible por `Cmd+K`; el editor de matriz sigue funcionando.
- [ ] Cada una de las 9 vistas explica para qué sirve y qué necesita el cronograma.
- [ ] La importación muestra fase, permite cancelar y expone conteos de lo importado.
- [ ] Toda acción destructiva es deshacible o confirmada; `Ctrl+Z` dice qué deshizo.
- [ ] Suite completa en verde, lint limpio y `next build` correcto.
