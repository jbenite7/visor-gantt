# P4 · La matriz como producto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la programación matricial en el módulo que arma un cronograma de obra y aprende de lo ejecutado: calendario del proyecto, dependencias reales piso a piso, editor de recetas, plantillas propias y generadas desde un `.mpp`, aprobación de rendimientos, conflictos con elección, edición en lote y escala para más de 1000 celdas.

**Architecture:** Tres fases. La **Fase 1** amplía el motor puro de `v2/src/lib/matrix/` sin tocar interfaz; cada capacidad nueva es opcional, de modo que un plan guardado hoy genera exactamente las mismas fechas mañana. La **Fase 2** construye el editor sobre ese motor, dentro de `MatrixEditorView.tsx` y componentes nuevos en `src/components/matrix/`. La **Fase 3** cablea la matriz en la aplicación y **depende del carril A**.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · Jest + Testing Library · Playwright (E2E) · Docker Compose.

Spec: [2026-08-07-matriz-como-producto-design.md](../specs/2026-08-07-matriz-como-producto-design.md) · Goal: [`goals/matriz-como-producto/goal.md`](../../../goals/matriz-como-producto/goal.md)

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Sin excepciones.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Comandos de verificación: `npx jest --runInBand`, `npx eslint <archivos>`, `npx tsc --noEmit`, `npx next build`.
- `npx tsc --noEmit` arrastra **38 errores preexistentes** en archivos `*.test.*` y `e2e/`. Filtrar siempre: `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`. Ese filtro debe salir **vacío**.
- Copy en **español con tildes**, en lenguaje de obra, sin jerga de infraestructura (ver `docs/POSITIONING.md`).
- No añadir color nuevo: usar los tokens de `src/app/globals.css`.
- **Prohibido tocar `src/components/views/GanttView.tsx` y `src/lib/state/ProjectContext.tsx` en las Fases 1 y 2.** Son del carril A. Solo la Fase 3 los toca, y solo después de que el carril A haya fusionado.
- **Compatibilidad hacia atrás obligatoria:** toda capacidad nueva del motor entra como parámetro o campo **opcional**. Un `MatrixPlan` guardado antes de este proyecto debe generar exactamente el mismo cronograma después. Los tests que ya existen en `matrixGenerator.test.ts`, `matrixSync.test.ts`, `tree.test.ts` y `matrixFromGantt.test.ts` **no se editan**: si alguno se pone rojo, el cambio está mal.
- **P3 va antes.** La Tarea 14 importa `@/lib/scheduling/detection`. No se empieza sin P3 fusionado.
- Rama: `carril-b/matriz-como-producto`, creada desde `main` después de fusionar P3.

---

## File Structure

| Archivo | Responsabilidad | Fase · Tarea |
|---|---|---|
| `src/types/matrix.ts` | Tipos nuevos: `LocationChaining`, `MatrixProposal`, conflicto con dos versiones | 1 · 4, 12, 14 |
| `src/lib/matrix/matrixCalendar.ts` | Días laborables según el calendario del proyecto | 1 · 1 |
| `src/lib/matrix/matrixCalendarShift.ts` | Aviso de cuánto desplaza las fechas aplicar el calendario | 1 · 3 |
| `src/lib/matrix/matrixChaining.ts` | Modo de encadenado efectivo de una celda (el alcance gana a la receta) | 1 · 4 |
| `src/lib/matrix/matrixCache.ts` | Firma de celda y caché de generación | 1 · 6 |
| `src/lib/matrix/matrixGenerator.ts` | Acepta calendario, encadenado y caché | 1 · 2, 5, 7 |
| `src/lib/matrix/recipes.ts` | Operaciones puras del editor de recetas | 1 · 8 |
| `src/lib/matrix/bulk.ts` | Edición en lote, duplicar, crear N ubicaciones | 1 · 9, 10 |
| `src/lib/matrix/feedback.ts` | Aprobar y descartar rendimientos observados | 1 · 11 |
| `src/lib/matrix/matrixSync.ts` | Conflictos con las dos versiones y resolución elegida | 1 · 12 |
| `src/lib/matrix/templateCatalog.ts` | Plantillas de fábrica y plantilla propia desde un plan | 1 · 13 |
| `src/lib/matrix/matrixProposal.ts` | Propuesta de matriz desde un cronograma cargado | 1 · 14, 15 |
| `src/lib/matrix/draftState.ts` | `hasUnappliedChanges` | 1 · 16 |
| `src/lib/matrix/removeArea.ts` | Borrar una ubicación sin perder las tareas que generó | 1 · 17 |
| `src/components/matrix/RecipeEditor.tsx` | Editor de recetas | 2 · 18 |
| `src/components/matrix/TemplatePicker.tsx` | Elegir plantilla o generar desde el cronograma | 2 · 19 |
| `src/components/matrix/ProposalReview.tsx` | Revisar la propuesta elemento a elemento | 2 · 20 |
| `src/components/matrix/FeedbackPanel.tsx` | Aprobar rendimientos observados | 2 · 21 |
| `src/components/matrix/ConflictChooser.tsx` | Elegir qué gana en cada conflicto | 2 · 22 |
| `src/components/matrix/LocationBulkActions.tsx` | Duplicar y crear N ubicaciones | 2 · 23 |
| `src/components/views/MatrixEditorView.tsx` | Selección múltiple, panel de lote, dibujo por ventana | 2 · 23, 24 |
| `src/components/gantt/toolbar/ViewSidebar.tsx` | La matriz vuelve al menú (M27) | 3 · 26 |
| `src/components/views/GanttView.tsx` | Cableado: calendario, aviso al salir, conflictos | 3 · 26 |

---

# FASE 1 — El motor (tareas 1-17)

Nada de esta fase cambia lo que el usuario ve. Es motor puro, probado, que la Fase 2 enchufa.

## Task 1: Días laborables según el calendario del proyecto

**Files:**
- Create: `src/lib/matrix/matrixCalendar.ts`
- Test: `src/lib/matrix/matrixCalendar.test.ts`

**Interfaces:**
- Consumes: `isProjectWorkingDay`, `normalizeProjectCalendar` de `@/lib/scheduling/projectCalendar`; `ProjectCalendar`, `DEFAULT_PROJECT_CALENDAR` de `@/types/calendar`.
- Produces:
  - `export function matrixAddWorkDays(start: Date, days: number, calendar?: ProjectCalendar): Date`
  - `export function matrixFinishFromDuration(start: Date, durationDays: number, calendar?: ProjectCalendar): Date`
  - `export function matrixNextWorkDay(date: Date, lagDays?: number, calendar?: ProjectCalendar): Date`

- [ ] **Step 1: Write the failing test**

```ts
import {
  matrixAddWorkDays,
  matrixFinishFromDuration,
  matrixNextWorkDay,
} from "./matrixCalendar";
import type { ProjectCalendar } from "@/types/calendar";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";

/** Lunes a viernes, con el 20 de julio (festivo colombiano) fuera. */
const calendarioObra: ProjectCalendar = {
  ...DEFAULT_PROJECT_CALENDAR,
  workDays: [1, 2, 3, 4, 5],
  nonWorkingDays: [{ id: "f1", date: "2026-07-20", name: "Día de la Independencia" }],
};

describe("matrixAddWorkDays", () => {
  test("sin calendario mantiene el comportamiento de siempre: solo salta el domingo", () => {
    // Viernes 2026-07-17 + 2 días laborables = lunes 20: trabaja el sábado 18
    // y salta el domingo 19. Es la regla histórica del generador, y este test
    // es lo único que impide que alguien la cambie sin darse cuenta.
    const result = matrixAddWorkDays(new Date("2026-07-17T00:00:00"), 2);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  test("con calendario de lunes a viernes salta también el sábado", () => {
    // Viernes 17 + 2 laborables = martes 21 (salta sábado 18 y domingo 19; el lunes 20 es festivo)
    const result = matrixAddWorkDays(
      new Date("2026-07-17T00:00:00"),
      2,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-22");
  });

  test("respeta los festivos del proyecto", () => {
    // Viernes 17 + 1 laborable: el lunes 20 es festivo, así que cae en martes 21
    const result = matrixAddWorkDays(
      new Date("2026-07-17T00:00:00"),
      1,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-21");
  });

  test("cero días devuelve el mismo día", () => {
    const result = matrixAddWorkDays(new Date("2026-07-17T00:00:00"), 0, calendarioObra);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-17");
  });
});

describe("matrixFinishFromDuration", () => {
  test("una tarea de un día empieza y termina el mismo día", () => {
    const result = matrixFinishFromDuration(
      new Date("2026-07-15T00:00:00"),
      1,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  test("una tarea de cinco días cruzando festivo termina un día después", () => {
    // Miércoles 15 + 5 días = 15, 16, 17, 21, 22 (salta finde y el festivo del 20)
    const result = matrixFinishFromDuration(
      new Date("2026-07-15T00:00:00"),
      5,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
});

describe("matrixNextWorkDay", () => {
  test("el siguiente día laborable salta el fin de semana y el festivo", () => {
    const result = matrixNextWorkDay(new Date("2026-07-17T00:00:00"), 0, calendarioObra);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-21");
  });

  test("con desfase suma días laborables adicionales", () => {
    const result = matrixNextWorkDay(new Date("2026-07-17T00:00:00"), 1, calendarioObra);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixCalendar.test.ts`
Expected: FAIL — `Cannot find module './matrixCalendar' from 'src/lib/matrix/matrixCalendar.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { ProjectCalendar } from "@/types/calendar";
import {
  isProjectWorkingDay,
  normalizeProjectCalendar,
} from "@/lib/scheduling/projectCalendar";

/**
 * Aritmética de días laborables para la matriz.
 *
 * Sin calendario se conserva el comportamiento histórico del generador
 * —trabajar todos los días menos el domingo—, para que un plan guardado antes
 * de este proyecto genere exactamente las mismas fechas.
 *
 * Con calendario se usa el del proyecto, que ya resuelve jornada, días
 * laborables y festivos. Aquí no se escribe lógica de calendario nueva: se
 * enchufa la que existe en `projectCalendar.ts`.
 */
function isWorkingDay(date: Date, calendar?: ProjectCalendar): boolean {
  if (!calendar) return date.getDay() !== 0;
  return isProjectWorkingDay(date, normalizeProjectCalendar(calendar));
}

export function matrixAddWorkDays(
  start: Date,
  days: number,
  calendar?: ProjectCalendar,
): Date {
  const result = new Date(start);
  result.setHours(0, 0, 0, 0);

  let added = 0;
  let guard = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    // Una obra sin ningún día laborable colgaría el bucle: 3.650 días es
    // una década, muy por encima de cualquier cronograma real.
    guard += 1;
    if (guard > 3650) break;
    if (isWorkingDay(result, calendar)) added += 1;
  }

  return result;
}

export function matrixFinishFromDuration(
  start: Date,
  durationDays: number,
  calendar?: ProjectCalendar,
): Date {
  return matrixAddWorkDays(start, Math.max(1, durationDays) - 1, calendar);
}

export function matrixNextWorkDay(
  date: Date,
  lagDays = 0,
  calendar?: ProjectCalendar,
): Date {
  return matrixAddWorkDays(date, 1 + Math.max(0, lagDays), calendar);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixCalendar.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixCalendar.ts src/lib/matrix/matrixCalendar.test.ts
git commit -m "feat(matriz): dias laborables segun el calendario del proyecto"
```

---

## Task 2: El generador acepta el calendario del proyecto

**Files:**
- Modify: `src/lib/matrix/matrixGenerator.ts:56-77` (sustituir `addWorkDays`, `finishFromDuration`, `nextWorkDay`), `:295-297` (firma de `generateScheduleFromMatrix`), `:490-530` (uso del cursor)
- Modify: `src/lib/matrix/matrixGenerator.test.ts` (añadir un `describe`; **no editar los tests existentes**)

**Interfaces:**
- Consumes: `matrixAddWorkDays`, `matrixFinishFromDuration`, `matrixNextWorkDay` de `./matrixCalendar`.
- Produces: `export interface MatrixGenerationOptions { calendar?: ProjectCalendar }` y `generateScheduleFromMatrix(plan: MatrixPlan, options?: MatrixGenerationOptions): MatrixGenerationResult`.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/matrix/matrixGenerator.test.ts`:

```ts
import { generateScheduleFromMatrix as generar } from "./matrixGenerator";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { MatrixPlan } from "@/types/matrix";

function planDeUnaCelda(): MatrixPlan {
  return {
    id: "plan-cal",
    name: "Torre con festivos",
    startDate: "2026-07-15",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "receta-estructura",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 5 },
        ],
        dependencies: [],
      },
    ],
    cells: [
      {
        id: "celda-1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "receta-estructura",
        active: true,
      },
    ],
  };
}

describe("generateScheduleFromMatrix · calendario del proyecto", () => {
  test("sin calendario las fechas no cambian respecto a lo de siempre", () => {
    const { tasks } = generar(planDeUnaCelda());
    const columnas = tasks.find((task) => !task.isSummary)!;

    // Miércoles 15 + 5 días saltando solo el domingo → lunes 20
    expect(columnas.finish.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  test("con el calendario del proyecto respeta el fin de semana y el festivo", () => {
    const { tasks } = generar(planDeUnaCelda(), {
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        workDays: [1, 2, 3, 4, 5],
        nonWorkingDays: [
          { id: "f1", date: "2026-07-20", name: "Día de la Independencia" },
        ],
      },
    });
    const columnas = tasks.find((task) => !task.isSummary)!;

    // 15, 16, 17, 21, 22 → termina el miércoles 22
    expect(columnas.finish.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixGenerator.test.ts`
Expected: FAIL — el segundo test da `2026-07-20` en vez de `2026-07-22`, y TypeScript avisa de que `generateScheduleFromMatrix` no acepta un segundo argumento (`Expected 1 arguments, but got 2`).

- [ ] **Step 3: Write minimal implementation**

En `src/lib/matrix/matrixGenerator.ts`:

**a)** Añadir el import y borrar las tres funciones locales `addWorkDays`, `finishFromDuration` y `nextWorkDay` (líneas 56-77):

```ts
import type { ProjectCalendar } from "@/types/calendar";
import {
  matrixAddWorkDays,
  matrixFinishFromDuration,
  matrixNextWorkDay,
} from "./matrixCalendar";

export interface MatrixGenerationOptions {
  /**
   * Calendario del proyecto. Sin él, la matriz trabaja todos los días menos
   * el domingo, que es lo que hacía antes de que existiera esta opción.
   */
  calendar?: ProjectCalendar;
}
```

**b)** Cambiar la firma y capturar el calendario:

```ts
export function generateScheduleFromMatrix(
  plan: MatrixPlan,
  options: MatrixGenerationOptions = {},
): MatrixGenerationResult {
  const { calendar } = options;
  const baseStart = createDate(plan.startDate);
```

**c)** Sustituir las tres llamadas dentro del bucle de actividades (líneas ~490 y ~530):

```ts
      const finish = createDateFromUnknown(
        activityOverride?.finish,
        matrixFinishFromDuration(start, duration, calendar),
      );
```

```ts
      cursor = matrixNextWorkDay(finish, 0, calendar);
```

`addCalendarDays` (usado por `getCellStart` para el desfase de línea de balance) **no se toca**: son días
calendario a propósito, y cambiarlo alteraría planes existentes.

Nota: `matrixAddWorkDays` queda importada para la Tarea 5. Si el linter avisa de import sin usar en este
paso, añadirla allí en vez de aquí.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixGenerator.test.ts src/lib/matrix/matrixSync.test.ts`
Expected: PASS — los tests que ya existían más los 2 nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixGenerator.ts src/lib/matrix/matrixGenerator.test.ts
git commit -m "feat(matriz): el generador usa el calendario del proyecto cuando se le pasa"
```

---

## Task 3: Aviso cuando el calendario desplaza mucho las fechas

**Files:**
- Create: `src/lib/matrix/matrixCalendarShift.ts`
- Test: `src/lib/matrix/matrixCalendarShift.test.ts`

**Por qué archivo aparte y no dentro de `matrixCalendar.ts`:** esta función necesita
`generateScheduleFromMatrix`, y el generador ya importa `matrixCalendar.ts`. Meterla ahí crearía un ciclo
de imports entre los dos módulos. `matrixCalendar.ts` se queda siendo aritmética pura de días, sin
depender de nada de la matriz.

**Interfaces:**
- Consumes: `generateScheduleFromMatrix` de `./matrixGenerator`, `MatrixPlan`, `ProjectCalendar`.
- Produces:
  - `export const CALENDAR_SHIFT_THRESHOLD_DAYS = 3`
  - `export interface CalendarShift { maxShiftDays: number; taskName: string | null; exceedsThreshold: boolean; message: string }`
  - `export function describeCalendarShift(plan: MatrixPlan, calendar: ProjectCalendar): CalendarShift`

- [ ] **Step 1: Write the failing test**

```ts
import {
  CALENDAR_SHIFT_THRESHOLD_DAYS,
  describeCalendarShift,
} from "./matrixCalendarShift";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { MatrixPlan } from "@/types/matrix";

function planLargo(): MatrixPlan {
  return {
    id: "plan-shift",
    name: "Torre",
    startDate: "2026-07-15",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "r1",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 30 },
        ],
        dependencies: [],
      },
    ],
    cells: [
      { id: "c1", scopeId: "estructura", areaId: "piso-1", recipeId: "r1", active: true },
    ],
  };
}

describe("describeCalendarShift", () => {
  test("un calendario que solo quita los domingos no desplaza nada", () => {
    const shift = describeCalendarShift(planLargo(), {
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5, 6],
    });

    expect(shift.maxShiftDays).toBe(0);
    expect(shift.exceedsThreshold).toBe(false);
    expect(shift.message).toBe(
      "Aplicar el calendario del proyecto no cambia las fechas de la matriz.",
    );
  });

  test("quitar los sábados de 30 días de trabajo desplaza más del umbral", () => {
    const shift = describeCalendarShift(planLargo(), {
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5],
    });

    expect(shift.maxShiftDays).toBeGreaterThan(CALENDAR_SHIFT_THRESHOLD_DAYS);
    expect(shift.exceedsThreshold).toBe(true);
    expect(shift.taskName).toContain("Columnas");
    expect(shift.message).toContain("días");
  });

  test("el umbral es de tres días, ni más ni menos", () => {
    expect(CALENDAR_SHIFT_THRESHOLD_DAYS).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixCalendarShift.test.ts`
Expected: FAIL — `Cannot find module './matrixCalendarShift' from 'src/lib/matrix/matrixCalendarShift.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { MatrixPlan } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";
import { generateScheduleFromMatrix } from "./matrixGenerator";

/**
 * A partir de aquí un desplazamiento deja de ser el ruido normal de un
 * festivo suelto y significa que el calendario cambia el plan de verdad.
 *
 * **Es un criterio elegido, no medido.** Nadie ha contado cuántos días de
 * desplazamiento le importan a un residente de obra; tres es el punto donde
 * deja de explicarse por un festivo. Cambiarlo es cambiar este número: no
 * hay nada más que dependa de él.
 */
export const CALENDAR_SHIFT_THRESHOLD_DAYS = 3;

export interface CalendarShift {
  maxShiftDays: number;
  taskName: string | null;
  exceedsThreshold: boolean;
  message: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Cuánto se moverían las fechas de la matriz al aplicarle el calendario del
 * proyecto. Genera dos veces y compara: es caro, así que se llama al pulsar,
 * no en cada tecla.
 */
export function describeCalendarShift(
  plan: MatrixPlan,
  calendar: ProjectCalendar,
): CalendarShift {
  const sinCalendario = generateScheduleFromMatrix(plan);
  const conCalendario = generateScheduleFromMatrix(plan, { calendar });

  const finishById = new Map(
    sinCalendario.tasks.map((task) => [task.id, task.finish.getTime()]),
  );

  let maxShiftDays = 0;
  let taskName: string | null = null;

  for (const task of conCalendario.tasks) {
    const before = finishById.get(task.id);
    if (before === undefined) continue;
    const shift = Math.round((task.finish.getTime() - before) / MS_PER_DAY);
    if (shift > maxShiftDays) {
      maxShiftDays = shift;
      taskName = task.name;
    }
  }

  const exceedsThreshold = maxShiftDays > CALENDAR_SHIFT_THRESHOLD_DAYS;

  return {
    maxShiftDays,
    taskName,
    exceedsThreshold,
    message:
      maxShiftDays === 0
        ? "Aplicar el calendario del proyecto no cambia las fechas de la matriz."
        : `Con el calendario del proyecto, «${taskName}» termina ${maxShiftDays} días más tarde. Revisa las fechas antes de aplicar.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixCalendarShift.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixCalendarShift.ts src/lib/matrix/matrixCalendarShift.test.ts
git commit -m "feat(matriz): avisar cuando el calendario del proyecto desplaza las fechas"
```

---

## Task 4: Modo de encadenado efectivo de una celda

**Files:**
- Modify: `src/types/matrix.ts:49-60` (junto a `LineOfBalanceRule`, `ActivityRecipe` y `ScopeNode`)
- Create: `src/lib/matrix/matrixChaining.ts`
- Test: `src/lib/matrix/matrixChaining.test.ts`

**Interfaces:**
- Consumes: `MatrixPlan`, `ScopeNode`, `ActivityRecipe` de `@/types/matrix`.
- Produces:
  - En `types/matrix.ts`: `export type LocationChainingMode = "encadenado" | "paralelo"` y `export interface LocationChaining { mode: LocationChainingMode; lagDays?: number; activityId?: string; reverse?: boolean }`. `ActivityRecipe` y `ScopeNode` ganan `locationChaining?: LocationChaining`.
  - En `matrixChaining.ts`: `export function resolveChaining(scope: ScopeNode | undefined, recipe: ActivityRecipe | undefined): LocationChaining`.

- [ ] **Step 1: Write the failing test**

```ts
import { resolveChaining } from "./matrixChaining";
import type { ActivityRecipe, ScopeNode } from "@/types/matrix";

const receta: ActivityRecipe = {
  id: "r1",
  name: "Estructura",
  activities: [
    { id: "columnas", name: "Columnas", productivityPerDay: 1 },
    { id: "losa", name: "Losa", productivityPerDay: 1 },
  ],
  dependencies: [],
  locationChaining: { mode: "encadenado", lagDays: 1 },
};

const alcance: ScopeNode = { id: "estructura", name: "Estructura", type: "Disciplina" };

describe("resolveChaining", () => {
  test("por defecto las ubicaciones van en paralelo: es lo que hacía la matriz hasta hoy", () => {
    expect(resolveChaining(alcance, { ...receta, locationChaining: undefined })).toEqual({
      mode: "paralelo",
    });
  });

  test("la receta define el encadenado cuando el alcance no dice nada", () => {
    expect(resolveChaining(alcance, receta)).toEqual({
      mode: "encadenado",
      lagDays: 1,
    });
  });

  test("el alcance gana a la receta: es quien sabe si su oficio encadena", () => {
    const acabados: ScopeNode = {
      ...alcance,
      locationChaining: { mode: "paralelo" },
    };

    expect(resolveChaining(acabados, receta)).toEqual({ mode: "paralelo" });
  });

  test("sin alcance ni receta también va en paralelo, sin reventar", () => {
    expect(resolveChaining(undefined, undefined)).toEqual({ mode: "paralelo" });
  });

  test("conserva la actividad de enganche y el sentido invertido", () => {
    const alcanceInvertido: ScopeNode = {
      ...alcance,
      locationChaining: { mode: "encadenado", activityId: "losa", reverse: true },
    };

    expect(resolveChaining(alcanceInvertido, receta)).toEqual({
      mode: "encadenado",
      activityId: "losa",
      reverse: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixChaining.test.ts`
Expected: FAIL — `Cannot find module './matrixChaining'`, y TypeScript avisa de que `locationChaining` no existe en `ActivityRecipe` ni en `ScopeNode`.

- [ ] **Step 3: Write minimal implementation**

**a)** En `src/types/matrix.ts`, junto a `LineOfBalanceRule`:

```ts
export type LocationChainingMode = "encadenado" | "paralelo";

/**
 * Cómo se relaciona una ubicación con la siguiente dentro del mismo alcance.
 *
 * `lineOfBalance.offsetDays` desplazaba cada ubicación un número fijo de días:
 * si el piso 1 se atrasaba, el piso 2 no se movía. Esto genera dependencias
 * de verdad, que sí se mueven.
 */
export interface LocationChaining {
  mode: LocationChainingMode;
  /** Días de espera entre una ubicación y la siguiente. */
  lagDays?: number;
  /** Si se indica, solo esa actividad engancha. Por defecto, todas. */
  activityId?: string;
  /** Invierte el orden: de arriba abajo en vez de abajo arriba. */
  reverse?: boolean;
}
```

Y añadir el campo opcional a las dos interfaces existentes:

```ts
export interface ScopeNode {
  id: string;
  name: string;
  type: string;
  defaultRecipeId?: string;
  /** Gana sobre el de la receta: es el alcance quien sabe si su oficio encadena. */
  locationChaining?: LocationChaining;
  children?: ScopeNode[];
}
```

```ts
export interface ActivityRecipe {
  id: string;
  name: string;
  activities: ActivityRecipeItem[];
  dependencies: ActivityDependencyRule[];
  lineOfBalance?: LineOfBalanceRule;
  locationChaining?: LocationChaining;
}
```

**b)** `src/lib/matrix/matrixChaining.ts`:

```ts
import type { ActivityRecipe, LocationChaining, ScopeNode } from "@/types/matrix";

/**
 * El encadenado que rige una celda.
 *
 * Orden: lo que diga el alcance, si no lo que diga la receta, y si ninguno
 * dice nada, paralelo — que es exactamente el comportamiento que la matriz
 * ha tenido hasta hoy, para que ningún plan guardado cambie de fechas.
 */
export function resolveChaining(
  scope: ScopeNode | undefined,
  recipe: ActivityRecipe | undefined,
): LocationChaining {
  return scope?.locationChaining ?? recipe?.locationChaining ?? { mode: "paralelo" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixChaining.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/types/matrix.ts src/lib/matrix/matrixChaining.ts src/lib/matrix/matrixChaining.test.ts
git commit -m "feat(matriz): modo de encadenado entre ubicaciones, configurable por alcance"
```

---

## Task 5: Dependencias reales entre ubicaciones

**Files:**
- Modify: `src/lib/matrix/matrixGenerator.ts` (bloque final de `generateScheduleFromMatrix`, antes de `recalculateSummaries`)
- Modify: `src/lib/matrix/matrixGenerator.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `resolveChaining` de `./matrixChaining`; `flatAreaById` y `activityTaskIds`, que ya existen dentro de la función.
- Produces: `generateScheduleFromMatrix` emite dependencias `FS` entre la misma actividad de ubicaciones consecutivas del mismo alcance cuando el encadenado es `encadenado`. La firma no cambia.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/matrix/matrixGenerator.test.ts`:

```ts
import type { MatrixPlan } from "@/types/matrix";
import { generateScheduleFromMatrix as generarPlan } from "./matrixGenerator";

function planDeTresPisos(chaining: MatrixPlan["recipes"][number]["locationChaining"]): MatrixPlan {
  return {
    id: "plan-cadena",
    name: "Torre de tres pisos",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [
      { id: "piso-1", name: "Piso 1", type: "Piso" },
      { id: "piso-2", name: "Piso 2", type: "Piso" },
      { id: "piso-3", name: "Piso 3", type: "Piso" },
    ],
    recipes: [
      {
        id: "r1",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 3 },
          { id: "losa", name: "Losa", productivityPerDay: 1, defaultQuantity: 4 },
        ],
        dependencies: [
          { predecessorActivityId: "columnas", successorActivityId: "losa", type: "FS" },
        ],
        locationChaining: chaining,
      },
    ],
    cells: ["piso-1", "piso-2", "piso-3"].map((areaId) => ({
      id: `celda-${areaId}`,
      scopeId: "estructura",
      areaId,
      recipeId: "r1",
      active: true,
    })),
  };
}

describe("generateScheduleFromMatrix · ritmo piso a piso", () => {
  test("en paralelo no hay vínculo entre pisos: es lo de siempre", () => {
    const { dependencies } = generarPlan(planDeTresPisos({ mode: "paralelo" }));
    const entrePisos = dependencies.filter(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(entrePisos).toHaveLength(0);
  });

  test("encadenado vincula cada actividad con la misma del piso siguiente", () => {
    const { dependencies } = generarPlan(planDeTresPisos({ mode: "encadenado" }));
    const columnas12 = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.from).includes("columnas") &&
        String(dependency.to).includes("piso-2") &&
        String(dependency.to).includes("columnas"),
    );

    expect(columnas12).toBeDefined();
    expect(columnas12?.type).toBe("FS");
  });

  test("la cadena llega hasta el último piso", () => {
    const { dependencies } = generarPlan(planDeTresPisos({ mode: "encadenado" }));
    const losa23 = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-2") &&
        String(dependency.from).includes("losa") &&
        String(dependency.to).includes("piso-3") &&
        String(dependency.to).includes("losa"),
    );

    expect(losa23).toBeDefined();
  });

  test("con actividad de enganche solo esa actividad encadena", () => {
    const { dependencies } = generarPlan(
      planDeTresPisos({ mode: "encadenado", activityId: "losa" }),
    );
    const columnas12 = dependencies.filter(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.from).includes("columnas") &&
        String(dependency.to).includes("piso-2"),
    );
    const losa12 = dependencies.filter(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.from).includes("losa") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(columnas12).toHaveLength(0);
    expect(losa12).toHaveLength(1);
  });

  test("el desfase entre pisos se guarda en el vínculo", () => {
    const { dependencies } = generarPlan(
      planDeTresPisos({ mode: "encadenado", lagDays: 2 }),
    );
    const primera = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(primera?.lag).toBe(2);
  });

  test("invertido encadena de arriba abajo", () => {
    const { dependencies } = generarPlan(
      planDeTresPisos({ mode: "encadenado", reverse: true }),
    );
    const desdeElTercero = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-3") &&
        String(dependency.to).includes("piso-2"),
    );

    expect(desdeElTercero).toBeDefined();
  });

  test("la tarea sucesora recibe el vínculo en su lista de dependencias", () => {
    const { tasks, dependencies } = generarPlan(planDeTresPisos({ mode: "encadenado" }));
    const primera = dependencies.find(
      (dependency) =>
        String(dependency.from).includes("piso-1") &&
        String(dependency.to).includes("piso-2"),
    )!;
    const sucesora = tasks.find((task) => task.id === primera.to)!;

    expect(sucesora.dependencies.some((item) => item.from === primera.from)).toBe(true);
  });
});
```

Aviso sobre los identificadores: las tareas generadas se llaman
`mx-task-${cell.id}-${activity.id}`, y `cell.id` en este plan de prueba es `celda-piso-1`, `celda-piso-2`…
Por eso los tests buscan con `String(dependency.from).includes("piso-1")` en vez de construir el
identificador a mano: si `sanitizeId` cambia, el test sigue midiendo lo que importa —qué piso engancha con
cuál— y no la forma del identificador.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixGenerator.test.ts`
Expected: FAIL — el test «encadenado vincula cada actividad con la misma del piso siguiente» falla con
`Received: undefined`, porque hoy no se emite ninguna dependencia entre ubicaciones.

- [ ] **Step 3: Write minimal implementation**

En `src/lib/matrix/matrixGenerator.ts`:

**a)** Añadir el import:

```ts
import { resolveChaining } from "./matrixChaining";
```

**b)** Dentro de `generateScheduleFromMatrix`, declarar el registro antes del bucle `for (const cell of cells)`:

```ts
  /** Por alcance: qué tarea materializa cada actividad en cada ubicación. */
  const chainRegistry = new Map<
    string,
    Array<{
      areaIndex: number;
      recipe: ActivityRecipe;
      activityTaskIds: Map<string, string | number>;
    }>
  >();
```

**c)** Al final del cuerpo del bucle, justo antes de `if (cellTaskIds.length > 0)`, registrar la celda:

```ts
    const chainKey = cell.scopeId;
    const chainEntries = chainRegistry.get(chainKey) ?? [];
    chainEntries.push({ areaIndex: flatArea.leafIndex, recipe, activityTaskIds });
    chainRegistry.set(chainKey, chainEntries);
```

La receta se guarda aquí, con la celda. Resolverla después por `scope.defaultRecipeId` no sirve: un
alcance puede no tener receta por defecto y llevar la receta en cada celda, que es como la trae el plan
generado desde un `.mpp`.

**d)** Después del bucle y **antes** de `recalculateSummaries(tasks, summaries)`:

```ts
  // Ritmo piso a piso: la cuadrilla que termina una actividad en una
  // ubicación empieza la misma en la siguiente. Es una dependencia de verdad,
  // así que un atraso en el piso 1 mueve el piso 2.
  for (const [scopeId, entries] of chainRegistry) {
    const scope = scopeById.get(scopeId);
    const chaining = resolveChaining(scope, entries[0]?.recipe);
    if (chaining.mode !== "encadenado" || entries.length < 2) continue;

    const ordered = [...entries].sort((a, b) =>
      chaining.reverse ? b.areaIndex - a.areaIndex : a.areaIndex - b.areaIndex,
    );

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];

      for (const [activityId, toId] of current.activityTaskIds) {
        if (chaining.activityId && chaining.activityId !== activityId) continue;
        const fromId = previous.activityTaskIds.get(activityId);
        if (!fromId) continue;

        const dependency: GanttDependency = {
          from: fromId,
          to: toId,
          type: "FS",
          lag: chaining.lagDays ?? 0,
        };
        dependencies.push(dependency);

        const successor = tasks.find((task) => task.id === toId);
        if (successor) {
          successor.dependencies = [...successor.dependencies, dependency];
        }
      }
    }
  }
```

Nota sobre la receta: si distintas celdas del mismo alcance usan recetas distintas, manda la de la primera
celda registrada, y por encima de ella el `locationChaining` del alcance. Es la interpretación que el
usuario espera: el encadenado se configura en el alcance porque es el alcance quien sabe si su oficio
encadena, no cada celda.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixGenerator.test.ts src/lib/matrix/matrixSync.test.ts`
Expected: PASS — los tests que ya existían más los 7 nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixGenerator.ts src/lib/matrix/matrixGenerator.test.ts
git commit -m "feat(matriz): dependencias reales entre ubicaciones en vez de un desfase fijo"
```

---

## Task 6: Firma de celda y caché de generación

**Files:**
- Create: `src/lib/matrix/matrixCache.ts`
- Test: `src/lib/matrix/matrixCache.test.ts`

**Interfaces:**
- Consumes: `MatrixCell`, `MatrixPlan`, `ActivityRecipe` de `@/types/matrix`; `ProjectCalendar`.
- Produces:
  - `export function cellSignature(input: { cell: MatrixCell; recipe: ActivityRecipe | undefined; startDate: string; calendarKey: string }): string`
  - `export function calendarKeyOf(calendar?: ProjectCalendar): string`
  - `export interface MatrixGenerationCache { signatures: Map<string, string>; hits: number; misses: number }`
  - `export function createMatrixCache(): MatrixGenerationCache`

- [ ] **Step 1: Write the failing test**

```ts
import { calendarKeyOf, cellSignature, createMatrixCache } from "./matrixCache";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type { ActivityRecipe, MatrixCell } from "@/types/matrix";

const receta: ActivityRecipe = {
  id: "r1",
  name: "Estructura",
  activities: [{ id: "columnas", name: "Columnas", productivityPerDay: 2, defaultQuantity: 6 }],
  dependencies: [],
};

const celda: MatrixCell = {
  id: "c1",
  scopeId: "estructura",
  areaId: "piso-1",
  recipeId: "r1",
  active: true,
  quantity: 10,
  unit: "m2",
};

function firma(overrides: Partial<MatrixCell> = {}, startDate = "2026-03-02"): string {
  return cellSignature({
    cell: { ...celda, ...overrides },
    recipe: receta,
    startDate,
    calendarKey: calendarKeyOf(),
  });
}

describe("cellSignature", () => {
  test("la misma celda da la misma firma", () => {
    expect(firma()).toBe(firma());
  });

  test.each([
    ["la cantidad", { quantity: 11 } as Partial<MatrixCell>],
    ["la receta", { recipeId: "r2" } as Partial<MatrixCell>],
    ["la activación", { active: false } as Partial<MatrixCell>],
    ["la unidad", { unit: "ml" } as Partial<MatrixCell>],
    ["el rendimiento propio", { productivityOverridePerDay: 3 } as Partial<MatrixCell>],
    ["la ubicación", { areaId: "piso-2" } as Partial<MatrixCell>],
    ["el alcance", { scopeId: "acabados" } as Partial<MatrixCell>],
  ])("cambiar %s cambia la firma", (_nombre, overrides) => {
    expect(firma(overrides)).not.toBe(firma());
  });

  test("cambiar una cantidad de actividad cambia la firma", () => {
    expect(
      firma({
        activityOverrides: [
          {
            activityId: "columnas",
            quantity: 99,
            lastEditedAt: "2026-03-02T00:00:00.000Z",
            lastEditedFrom: "matrix" as const,
          },
        ],
      }),
    ).not.toBe(firma());
  });

  test("cambiar la fecha de inicio del plan cambia la firma de todas las celdas", () => {
    expect(firma({}, "2026-04-01")).not.toBe(firma());
  });

  test("cambiar el calendario cambia la clave de calendario", () => {
    expect(calendarKeyOf()).not.toBe(
      calendarKeyOf({ ...DEFAULT_PROJECT_CALENDAR, workDays: [1, 2, 3, 4, 5] }),
    );
  });
});

describe("createMatrixCache", () => {
  test("nace vacía y con los contadores a cero", () => {
    const cache = createMatrixCache();

    expect(cache.signatures.size).toBe(0);
    expect(cache.hits).toBe(0);
    expect(cache.misses).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixCache.test.ts`
Expected: FAIL — `Cannot find module './matrixCache' from 'src/lib/matrix/matrixCache.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { ActivityRecipe, MatrixCell } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";

/**
 * Firma de una celda: todo lo que entra en el cálculo de sus tareas.
 *
 * Es la pieza delicada de la caché. Si falta un campo, la matriz enseña
 * fechas viejas y el usuario no tiene forma de saberlo. Por eso el test
 * recorre campo por campo comprobando que cada uno cambia la firma.
 */
export function cellSignature({
  cell,
  recipe,
  startDate,
  calendarKey,
}: {
  cell: MatrixCell;
  recipe: ActivityRecipe | undefined;
  startDate: string;
  calendarKey: string;
}): string {
  return JSON.stringify([
    cell.id,
    cell.scopeId,
    cell.areaId,
    cell.recipeId,
    cell.active,
    cell.quantity,
    cell.unit,
    cell.productivityOverridePerDay,
    cell.activityOverrides ?? null,
    recipe?.id,
    recipe?.activities,
    recipe?.dependencies,
    recipe?.lineOfBalance ?? null,
    recipe?.locationChaining ?? null,
    startDate,
    calendarKey,
  ]);
}

/** Clave estable del calendario, para que un festivo nuevo invalide la caché. */
export function calendarKeyOf(calendar?: ProjectCalendar): string {
  if (!calendar) return "sin-calendario";
  return JSON.stringify([
    calendar.workDays,
    calendar.startHour,
    calendar.endHour,
    calendar.hoursPerDay,
    calendar.nonWorkingDays,
    calendar.dateOverrides,
  ]);
}

export interface MatrixGenerationCache {
  signatures: Map<string, string>;
  hits: number;
  misses: number;
}

export function createMatrixCache(): MatrixGenerationCache {
  return { signatures: new Map(), hits: 0, misses: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixCache.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixCache.ts src/lib/matrix/matrixCache.test.ts
git commit -m "feat(matriz): firma de celda para no recalcular lo que no cambio"
```

---

## Task 7: El generador cuenta qué celdas recalculó

**Files:**
- Modify: `src/lib/matrix/matrixGenerator.ts` (`MatrixGenerationOptions` y el bucle de celdas)
- Modify: `src/lib/matrix/matrixGenerator.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `cellSignature`, `calendarKeyOf`, `MatrixGenerationCache` de `./matrixCache`.
- Produces: `MatrixGenerationOptions` gana `cache?: MatrixGenerationCache`. Tras generar, `cache.hits` cuenta las celdas cuya firma no cambió y `cache.misses` las que sí. El resultado del generador **es idéntico con y sin caché**: la caché es contabilidad, no atajo de resultados.

**Por qué contabilidad y no atajo:** las tareas de una celda dependen del cursor de fechas y de los resúmenes, que se recalculan juntos. Guardar tareas ya construidas invitaría a servir fechas viejas (R2 de la spec). Lo que la caché permite es que **la interfaz** sepa qué celdas cambiaron y solo repinte esas — que es donde estaba el coste real (`MatrixEditorView.tsx:1039-1084`).

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/matrix/matrixGenerator.test.ts`:

```ts
import { createMatrixCache } from "./matrixCache";

describe("generateScheduleFromMatrix · caché de celdas", () => {
  test("la primera pasada no acierta ninguna: todas son nuevas", () => {
    const cache = createMatrixCache();
    generarPlan(planDeTresPisos({ mode: "paralelo" }), { cache });

    expect(cache.hits).toBe(0);
    expect(cache.misses).toBe(3);
  });

  test("regenerar sin cambios acierta todas", () => {
    const cache = createMatrixCache();
    const plan = planDeTresPisos({ mode: "paralelo" });
    generarPlan(plan, { cache });
    generarPlan(plan, { cache });

    expect(cache.hits).toBe(3);
    expect(cache.misses).toBe(3);
  });

  test("editar una celda solo falla en esa", () => {
    const cache = createMatrixCache();
    const plan = planDeTresPisos({ mode: "paralelo" });
    generarPlan(plan, { cache });

    const editado = {
      ...plan,
      cells: plan.cells.map((cell) =>
        cell.areaId === "piso-2" ? { ...cell, quantity: 99 } : cell,
      ),
    };
    generarPlan(editado, { cache });

    expect(cache.hits).toBe(2);
    expect(cache.misses).toBe(4);
  });

  test("el cronograma sale igual con caché que sin ella", () => {
    const plan = planDeTresPisos({ mode: "encadenado" });
    const conCache = generarPlan(plan, { cache: createMatrixCache() });
    const sinCache = generarPlan(plan);

    expect(conCache.tasks.map((task) => task.id)).toEqual(
      sinCache.tasks.map((task) => task.id),
    );
    expect(conCache.dependencies).toEqual(sinCache.dependencies);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixGenerator.test.ts`
Expected: FAIL — TypeScript avisa de que `cache` no existe en `MatrixGenerationOptions`, y en ejecución `cache.misses` sale `0`.

- [ ] **Step 3: Write minimal implementation**

En `src/lib/matrix/matrixGenerator.ts`:

**a)** Ampliar el import y las opciones:

```ts
import {
  calendarKeyOf,
  cellSignature,
  type MatrixGenerationCache,
} from "./matrixCache";

export interface MatrixGenerationOptions {
  calendar?: ProjectCalendar;
  /**
   * Contabilidad de qué celdas cambiaron desde la generación anterior. No
   * cambia el resultado: sirve para que el editor repinte solo lo que cambió.
   */
  cache?: MatrixGenerationCache;
}
```

**b)** Dentro de `generateScheduleFromMatrix`, tras `const { calendar } = options;`:

```ts
  const cache = options.cache;
  const calendarKey = cache ? calendarKeyOf(calendar) : "";
```

**c)** En el bucle `for (const cell of cells)`, justo después de resolver `recipe` (después de
`const recipe = recipeId ? recipeById.get(recipeId) : undefined;`):

```ts
    if (cache) {
      const signature = cellSignature({
        cell,
        recipe,
        scope,
        area,
        scopeLeafIndex: flatScope?.leafIndex,
        areaLeafIndex: flatArea?.leafIndex,
        startDate: plan.startDate,
        calendarKey,
      });
      if (cache.signatures.get(cell.id) === signature) {
        cache.hits += 1;
      } else {
        cache.misses += 1;
        cache.signatures.set(cell.id, signature);
      }
    }
```

Va **antes** de los `continue` de validación, para que una celda inválida también cuente: si no, borrar su
receta la haría desaparecer de la contabilidad y el editor no repintaría el hueco.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixGenerator.test.ts src/lib/matrix/matrixSync.test.ts src/lib/matrix/matrixFromGantt.test.ts`
Expected: PASS — todo lo anterior más los 4 nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixGenerator.ts src/lib/matrix/matrixGenerator.test.ts
git commit -m "feat(matriz): contabilizar que celdas cambiaron para repintar solo esas"
```

---

## Task 8: Editor de recetas — operaciones puras

**Files:**
- Create: `src/lib/matrix/recipes.ts`
- Test: `src/lib/matrix/recipes.test.ts`

**Interfaces:**
- Consumes: `ActivityRecipe`, `ActivityRecipeItem`, `ActivityDependencyRule` de `@/types/matrix`.
- Produces:
  - `export function addRecipeActivity(recipe: ActivityRecipe, activity: ActivityRecipeItem, atIndex?: number): ActivityRecipe`
  - `export function removeRecipeActivity(recipe: ActivityRecipe, activityId: string): ActivityRecipe`
  - `export function moveRecipeActivity(recipe: ActivityRecipe, activityId: string, toIndex: number): ActivityRecipe`
  - `export interface SetDependencyResult { recipe: ActivityRecipe; rejectedReason?: string }`
  - `export function setRecipeDependency(recipe: ActivityRecipe, rule: ActivityDependencyRule): SetDependencyResult`
  - `export function removeRecipeDependency(recipe: ActivityRecipe, predecessorActivityId: string, successorActivityId: string): ActivityRecipe`

- [ ] **Step 1: Write the failing test**

```ts
import {
  addRecipeActivity,
  moveRecipeActivity,
  removeRecipeActivity,
  removeRecipeDependency,
  setRecipeDependency,
} from "./recipes";
import type { ActivityRecipe } from "@/types/matrix";

function receta(): ActivityRecipe {
  return {
    id: "r1",
    name: "Estructura",
    activities: [
      { id: "columnas", name: "Columnas", productivityPerDay: 1 },
      { id: "losa", name: "Losa", productivityPerDay: 1 },
    ],
    dependencies: [
      { predecessorActivityId: "columnas", successorActivityId: "losa", type: "FS" },
    ],
  };
}

describe("addRecipeActivity", () => {
  test("añade al final por defecto", () => {
    const result = addRecipeActivity(receta(), {
      id: "acero",
      name: "Acero",
      productivityPerDay: 2,
    });

    expect(result.activities.map((item) => item.id)).toEqual([
      "columnas",
      "losa",
      "acero",
    ]);
  });

  test("añade en la posición indicada", () => {
    const result = addRecipeActivity(
      receta(),
      { id: "acero", name: "Acero", productivityPerDay: 2 },
      0,
    );

    expect(result.activities[0].id).toBe("acero");
  });

  test("no muta la receta recibida", () => {
    const original = receta();
    addRecipeActivity(original, { id: "acero", name: "Acero", productivityPerDay: 2 });

    expect(original.activities).toHaveLength(2);
  });
});

describe("removeRecipeActivity", () => {
  test("quita la actividad", () => {
    const result = removeRecipeActivity(receta(), "losa");

    expect(result.activities.map((item) => item.id)).toEqual(["columnas"]);
  });

  test("quita también sus dependencias, para no dejar vínculos huérfanos", () => {
    const result = removeRecipeActivity(receta(), "losa");

    expect(result.dependencies).toHaveLength(0);
  });

  test("quitar algo que no existe no cambia nada", () => {
    const result = removeRecipeActivity(receta(), "inexistente");

    expect(result.activities).toHaveLength(2);
    expect(result.dependencies).toHaveLength(1);
  });
});

describe("moveRecipeActivity", () => {
  test("reordena las actividades", () => {
    const result = moveRecipeActivity(receta(), "losa", 0);

    expect(result.activities.map((item) => item.id)).toEqual(["losa", "columnas"]);
  });

  test("un índice fuera de rango se ajusta al extremo", () => {
    const result = moveRecipeActivity(receta(), "columnas", 99);

    expect(result.activities.map((item) => item.id)).toEqual(["losa", "columnas"]);
  });
});

describe("setRecipeDependency", () => {
  test("añade un vínculo nuevo", () => {
    const conAcero = addRecipeActivity(receta(), {
      id: "acero",
      name: "Acero",
      productivityPerDay: 1,
    });
    const { recipe, rejectedReason } = setRecipeDependency(conAcero, {
      predecessorActivityId: "losa",
      successorActivityId: "acero",
      type: "FS",
    });

    expect(rejectedReason).toBeUndefined();
    expect(recipe.dependencies).toHaveLength(2);
  });

  test("reemplaza el vínculo existente entre las mismas actividades", () => {
    const { recipe } = setRecipeDependency(receta(), {
      predecessorActivityId: "columnas",
      successorActivityId: "losa",
      type: "SS",
      lagDays: 2,
    });

    expect(recipe.dependencies).toHaveLength(1);
    expect(recipe.dependencies[0].type).toBe("SS");
    expect(recipe.dependencies[0].lagDays).toBe(2);
  });

  test("rechaza que una actividad dependa de sí misma", () => {
    const { recipe, rejectedReason } = setRecipeDependency(receta(), {
      predecessorActivityId: "losa",
      successorActivityId: "losa",
      type: "FS",
    });

    expect(rejectedReason).toBe("Una actividad no puede depender de sí misma.");
    expect(recipe.dependencies).toHaveLength(1);
  });

  test("rechaza el ciclo directo: si A va antes que B, B no puede ir antes que A", () => {
    const { recipe, rejectedReason } = setRecipeDependency(receta(), {
      predecessorActivityId: "losa",
      successorActivityId: "columnas",
      type: "FS",
    });

    expect(rejectedReason).toBe(
      "«Columnas» ya va antes que «Losa»: el vínculo contrario dejaría la receta en círculo.",
    );
    expect(recipe.dependencies).toHaveLength(1);
  });

  test("rechaza un vínculo a una actividad que no está en la receta", () => {
    const { rejectedReason } = setRecipeDependency(receta(), {
      predecessorActivityId: "columnas",
      successorActivityId: "fantasma",
      type: "FS",
    });

    expect(rejectedReason).toBe("La actividad enlazada no está en esta receta.");
  });
});

describe("removeRecipeDependency", () => {
  test("quita el vínculo indicado", () => {
    const result = removeRecipeDependency(receta(), "columnas", "losa");

    expect(result.dependencies).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/recipes.test.ts`
Expected: FAIL — `Cannot find module './recipes' from 'src/lib/matrix/recipes.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type {
  ActivityDependencyRule,
  ActivityRecipe,
  ActivityRecipeItem,
} from "@/types/matrix";

/**
 * Operaciones del editor de recetas, puras y sin interfaz.
 *
 * Dos reglas viven aquí y no en la pantalla, porque son del dato:
 * quitar una actividad quita sus vínculos —si no, `generateScheduleFromMatrix`
 * los descarta en silencio— y un vínculo no puede cerrar un círculo.
 */
export function addRecipeActivity(
  recipe: ActivityRecipe,
  activity: ActivityRecipeItem,
  atIndex?: number,
): ActivityRecipe {
  const activities = [...recipe.activities];
  const index = atIndex ?? activities.length;
  activities.splice(Math.max(0, Math.min(index, activities.length)), 0, activity);
  return { ...recipe, activities };
}

export function removeRecipeActivity(
  recipe: ActivityRecipe,
  activityId: string,
): ActivityRecipe {
  return {
    ...recipe,
    activities: recipe.activities.filter((activity) => activity.id !== activityId),
    dependencies: recipe.dependencies.filter(
      (rule) =>
        rule.predecessorActivityId !== activityId &&
        rule.successorActivityId !== activityId,
    ),
  };
}

export function moveRecipeActivity(
  recipe: ActivityRecipe,
  activityId: string,
  toIndex: number,
): ActivityRecipe {
  const from = recipe.activities.findIndex((activity) => activity.id === activityId);
  if (from === -1) return recipe;

  const activities = [...recipe.activities];
  const [moved] = activities.splice(from, 1);
  activities.splice(Math.max(0, Math.min(toIndex, activities.length)), 0, moved);
  return { ...recipe, activities };
}

export interface SetDependencyResult {
  recipe: ActivityRecipe;
  /** Frase en lenguaje de obra cuando el vínculo no se acepta. */
  rejectedReason?: string;
}

export function setRecipeDependency(
  recipe: ActivityRecipe,
  rule: ActivityDependencyRule,
): SetDependencyResult {
  if (rule.predecessorActivityId === rule.successorActivityId) {
    return { recipe, rejectedReason: "Una actividad no puede depender de sí misma." };
  }

  const nameOf = (id: string) =>
    recipe.activities.find((activity) => activity.id === id)?.name;
  const predecessorName = nameOf(rule.predecessorActivityId);
  const successorName = nameOf(rule.successorActivityId);

  if (!predecessorName || !successorName) {
    return { recipe, rejectedReason: "La actividad enlazada no está en esta receta." };
  }

  const inverse = recipe.dependencies.find(
    (item) =>
      item.predecessorActivityId === rule.successorActivityId &&
      item.successorActivityId === rule.predecessorActivityId,
  );
  if (inverse) {
    return {
      recipe,
      rejectedReason: `«${successorName}» ya va antes que «${predecessorName}»: el vínculo contrario dejaría la receta en círculo.`,
    };
  }

  const dependencies = recipe.dependencies.filter(
    (item) =>
      !(
        item.predecessorActivityId === rule.predecessorActivityId &&
        item.successorActivityId === rule.successorActivityId
      ),
  );

  return { recipe: { ...recipe, dependencies: [...dependencies, rule] } };
}

export function removeRecipeDependency(
  recipe: ActivityRecipe,
  predecessorActivityId: string,
  successorActivityId: string,
): ActivityRecipe {
  return {
    ...recipe,
    dependencies: recipe.dependencies.filter(
      (rule) =>
        !(
          rule.predecessorActivityId === predecessorActivityId &&
          rule.successorActivityId === successorActivityId
        ),
    ),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/recipes.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/recipes.ts src/lib/matrix/recipes.test.ts
git commit -m "feat(matriz): operaciones del editor de recetas con rechazo de ciclos"
```

---

## Task 9: Edición en lote de celdas

**Files:**
- Create: `src/lib/matrix/bulk.ts`
- Test: `src/lib/matrix/bulk.test.ts`

**Interfaces:**
- Consumes: `MatrixPlan`, `MatrixCell` de `@/types/matrix`.
- Produces:
  - `export interface CellPatch { recipeId?: string; quantity?: number; unit?: string; active?: boolean; productivityOverridePerDay?: number }`
  - `export interface CellTarget { scopeId: string; areaId: string }`
  - `export function applyBulkCellEdit(plan: MatrixPlan, targets: CellTarget[], patch: CellPatch, editedAt: string): MatrixPlan`

- [ ] **Step 1: Write the failing test**

```ts
import { applyBulkCellEdit } from "./bulk";
import type { MatrixPlan } from "@/types/matrix";

const AHORA = "2026-08-07T12:00:00.000Z";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [
      { id: "estructura", name: "Estructura", type: "Disciplina" },
      { id: "acabados", name: "Acabados", type: "Disciplina" },
    ],
    areas: [
      { id: "piso-1", name: "Piso 1", type: "Piso" },
      { id: "piso-2", name: "Piso 2", type: "Piso" },
    ],
    recipes: [
      { id: "r1", name: "Estructura", activities: [], dependencies: [] },
      { id: "r2", name: "Acabados", activities: [], dependencies: [] },
    ],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        quantity: 10,
      },
    ],
  };
}

describe("applyBulkCellEdit", () => {
  test("aplica el cambio a las celdas seleccionadas", () => {
    const result = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { quantity: 25 },
      AHORA,
    );

    expect(result.cells[0].quantity).toBe(25);
  });

  test("solo toca los campos que se pasan: activar no borra la receta", () => {
    const result = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { active: false },
      AHORA,
    );

    expect(result.cells[0].active).toBe(false);
    expect(result.cells[0].recipeId).toBe("r1");
    expect(result.cells[0].quantity).toBe(10);
  });

  test("crea las celdas que aún no existen, para que seleccionar una fila entera funcione", () => {
    const result = applyBulkCellEdit(
      plan(),
      [
        { scopeId: "estructura", areaId: "piso-1" },
        { scopeId: "estructura", areaId: "piso-2" },
      ],
      { recipeId: "r1", active: true },
      AHORA,
    );

    expect(result.cells).toHaveLength(2);
    const nueva = result.cells.find((cell) => cell.areaId === "piso-2")!;
    expect(nueva.recipeId).toBe("r1");
    expect(nueva.active).toBe(true);
  });

  test("marca cuándo y desde dónde se editó", () => {
    const result = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { quantity: 3 },
      AHORA,
    );

    expect(result.cells[0].lastEditedAt).toBe(AHORA);
    expect(result.cells[0].lastEditedFrom).toBe("matrix");
  });

  test("no toca las celdas que no se seleccionaron", () => {
    const base = applyBulkCellEdit(
      plan(),
      [{ scopeId: "estructura", areaId: "piso-2" }],
      { quantity: 7, active: true },
      AHORA,
    );
    const result = applyBulkCellEdit(
      base,
      [{ scopeId: "estructura", areaId: "piso-1" }],
      { quantity: 99 },
      AHORA,
    );

    expect(result.cells.find((cell) => cell.areaId === "piso-2")?.quantity).toBe(7);
  });

  test("sin celdas seleccionadas devuelve el plan tal cual", () => {
    const original = plan();
    expect(applyBulkCellEdit(original, [], { quantity: 1 }, AHORA).cells).toEqual(
      original.cells,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/bulk.test.ts`
Expected: FAIL — `Cannot find module './bulk' from 'src/lib/matrix/bulk.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { MatrixCell, MatrixPlan } from "@/types/matrix";

export interface CellPatch {
  recipeId?: string;
  quantity?: number;
  unit?: string;
  active?: boolean;
  productivityOverridePerDay?: number;
}

export interface CellTarget {
  scopeId: string;
  areaId: string;
}

const keyOf = (scopeId: string, areaId: string) => `${scopeId}::${areaId}`;

function patched(cell: MatrixCell, patch: CellPatch, editedAt: string): MatrixCell {
  const next: MatrixCell = { ...cell, lastEditedAt: editedAt, lastEditedFrom: "matrix" };
  if (patch.recipeId !== undefined) next.recipeId = patch.recipeId;
  if (patch.quantity !== undefined) next.quantity = patch.quantity;
  if (patch.unit !== undefined) next.unit = patch.unit;
  if (patch.active !== undefined) next.active = patch.active;
  if (patch.productivityOverridePerDay !== undefined) {
    next.productivityOverridePerDay = patch.productivityOverridePerDay;
  }
  return next;
}

/**
 * Aplica un cambio a varias celdas de una vez.
 *
 * Las celdas que aún no existen se crean con el cambio aplicado: si no,
 * seleccionar una fila entera y activarla dejaría la mitad sin efecto y el
 * usuario no tendría forma de saber por qué.
 */
export function applyBulkCellEdit(
  plan: MatrixPlan,
  targets: CellTarget[],
  patch: CellPatch,
  editedAt: string,
): MatrixPlan {
  if (targets.length === 0) return plan;

  const selected = new Set(targets.map((target) => keyOf(target.scopeId, target.areaId)));
  const existing = new Set(plan.cells.map((cell) => keyOf(cell.scopeId, cell.areaId)));

  const updated = plan.cells.map((cell) =>
    selected.has(keyOf(cell.scopeId, cell.areaId))
      ? patched(cell, patch, editedAt)
      : cell,
  );

  const created = targets
    .filter((target) => !existing.has(keyOf(target.scopeId, target.areaId)))
    .map((target) =>
      patched(
        {
          id: `cell-${target.scopeId}-${target.areaId}`,
          scopeId: target.scopeId,
          areaId: target.areaId,
          active: false,
        },
        patch,
        editedAt,
      ),
    );

  return { ...plan, cells: [...updated, ...created] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/bulk.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/bulk.ts src/lib/matrix/bulk.test.ts
git commit -m "feat(matriz): edicion en lote de celdas seleccionadas"
```

---

## Task 10: Duplicar ubicaciones y crear N de golpe

**Files:**
- Modify: `src/lib/matrix/bulk.ts` (añadir al final)
- Modify: `src/lib/matrix/bulk.test.ts` (añadir dos `describe`)

**Interfaces:**
- Consumes: `getAreaLeaves`, `getScopeLeaves` de `./tree`; `AreaNode`, `ScopeNode`, `MatrixPlan`.
- Produces:
  - `export function duplicateAreaNode(plan: MatrixPlan, areaId: string, editedAt: string): MatrixPlan`
  - `export function duplicateScopeNode(plan: MatrixPlan, scopeId: string, editedAt: string): MatrixPlan`
  - `export function createAreaRange(plan: MatrixPlan, input: { pattern: string; from: number; to: number; type?: string }, editedAt: string): MatrixPlan`
  - (`parentId` figuraba en una versión anterior de este contrato y se retiró: ningún consumidor lo pasa y el cuerpo de la función nunca lo usó. Las ubicaciones nuevas se crean en la raíz.)

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/matrix/bulk.test.ts`:

```ts
import { createAreaRange, duplicateAreaNode, duplicateScopeNode } from "./bulk";

describe("duplicateAreaNode", () => {
  test("copia la ubicación con otro nombre", () => {
    const result = duplicateAreaNode(plan(), "piso-1", AHORA);

    expect(result.areas).toHaveLength(3);
    expect(result.areas.map((area) => area.name)).toContain("Piso 1 (copia)");
  });

  test("copia también sus celdas, con la misma receta y cantidad", () => {
    const result = duplicateAreaNode(plan(), "piso-1", AHORA);
    const copia = result.areas.find((area) => area.name === "Piso 1 (copia)")!;
    const celdaCopiada = result.cells.find((cell) => cell.areaId === copia.id)!;

    expect(celdaCopiada.recipeId).toBe("r1");
    expect(celdaCopiada.quantity).toBe(10);
    expect(celdaCopiada.active).toBe(true);
  });

  test("la copia no arrastra las tareas ya generadas de la original", () => {
    const conTareas: MatrixPlan = {
      ...plan(),
      cells: [
        {
          ...plan().cells[0],
          generatedTaskIds: ["mx-task-1"],
          syncedTaskIds: ["mx-task-1"],
        },
      ],
    };
    const result = duplicateAreaNode(conTareas, "piso-1", AHORA);
    const copia = result.areas.find((area) => area.name === "Piso 1 (copia)")!;
    const celdaCopiada = result.cells.find((cell) => cell.areaId === copia.id)!;

    expect(celdaCopiada.generatedTaskIds ?? []).toHaveLength(0);
  });

  test("duplicar algo que no existe no cambia nada", () => {
    const original = plan();
    expect(duplicateAreaNode(original, "fantasma", AHORA).areas).toHaveLength(2);
  });
});

describe("duplicateScopeNode", () => {
  test("copia el alcance con sus celdas", () => {
    const result = duplicateScopeNode(plan(), "estructura", AHORA);
    const copia = result.scopeTree.find((scope) => scope.name === "Estructura (copia)")!;

    expect(copia).toBeDefined();
    expect(result.cells.filter((cell) => cell.scopeId === copia.id)).toHaveLength(1);
  });
});

describe("createAreaRange", () => {
  test("crea las ubicaciones del rango con el patrón indicado", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Piso {n}", from: 3, to: 6, type: "Piso" },
      AHORA,
    );

    expect(result.areas.map((area) => area.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
      "Piso 4",
      "Piso 5",
      "Piso 6",
    ]);
  });

  test("crea las celdas de cada alcance para cada ubicación nueva", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Piso {n}", from: 3, to: 4, type: "Piso" },
      AHORA,
    );

    // 2 alcances × 2 ubicaciones nuevas = 4 celdas nuevas, más la que ya había
    expect(result.cells).toHaveLength(5);
  });

  test("un rango descendente crea sótanos en orden", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Sótano {n}", from: 3, to: 1, type: "Sótano" },
      AHORA,
    );

    expect(result.areas.slice(2).map((area) => area.name)).toEqual([
      "Sótano 3",
      "Sótano 2",
      "Sótano 1",
    ]);
  });

  test("no repite una ubicación que ya existe con ese nombre", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Piso {n}", from: 1, to: 3, type: "Piso" },
      AHORA,
    );

    expect(result.areas.map((area) => area.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
    ]);
  });

  test("un patrón sin {n} crea una sola ubicación y no veinte iguales", () => {
    const result = createAreaRange(
      plan(),
      { pattern: "Cubierta", from: 1, to: 5, type: "Piso" },
      AHORA,
    );

    expect(result.areas.filter((area) => area.name === "Cubierta")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/bulk.test.ts`
Expected: FAIL — `duplicateAreaNode is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir al final de `src/lib/matrix/bulk.ts`, **con los dos `import` movidos arriba del todo**, junto al de
la Tarea 9: aunque los imports se elevan y funcionarían al final, `eslint` los rechaza con
`import/first`.

```ts
// ↑ estos dos van arriba del archivo, con el import de la Tarea 9
import type { AreaNode, ScopeNode } from "@/types/matrix";
import { getAreaLeaves, getScopeLeaves } from "./tree";

function sanitizeId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueId(base: string, taken: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return candidate;
}

/** Una celda copiada arranca sin tareas: las de la original son suyas, no de la copia. */
function copyCell(
  cell: MatrixCell,
  scopeId: string,
  areaId: string,
  editedAt: string,
): MatrixCell {
  return {
    ...cell,
    id: `cell-${scopeId}-${areaId}`,
    scopeId,
    areaId,
    generatedTaskIds: [],
    syncedTaskIds: [],
    feedback: undefined,
    lastEditedAt: editedAt,
    lastEditedFrom: "matrix",
  };
}

export function duplicateAreaNode(
  plan: MatrixPlan,
  areaId: string,
  editedAt: string,
): MatrixPlan {
  const source = getAreaLeaves(plan.areas).find((leaf) => leaf.node.id === areaId)?.node;
  if (!source) return plan;

  const taken = new Set(getAreaLeaves(plan.areas).map((leaf) => leaf.node.id));
  const copy: AreaNode = {
    ...source,
    id: uniqueId(`${source.id}-copia`, taken),
    name: `${source.name} (copia)`,
    children: undefined,
  };

  const copiedCells = plan.cells
    .filter((cell) => cell.areaId === areaId)
    .map((cell) => copyCell(cell, cell.scopeId, copy.id, editedAt));

  return {
    ...plan,
    areas: [...plan.areas, copy],
    cells: [...plan.cells, ...copiedCells],
  };
}

export function duplicateScopeNode(
  plan: MatrixPlan,
  scopeId: string,
  editedAt: string,
): MatrixPlan {
  const source = getScopeLeaves(plan.scopeTree).find(
    (leaf) => leaf.node.id === scopeId,
  )?.node;
  if (!source) return plan;

  const taken = new Set(getScopeLeaves(plan.scopeTree).map((leaf) => leaf.node.id));
  const copy: ScopeNode = {
    ...source,
    id: uniqueId(`${source.id}-copia`, taken),
    name: `${source.name} (copia)`,
    children: undefined,
  };

  const copiedCells = plan.cells
    .filter((cell) => cell.scopeId === scopeId)
    .map((cell) => copyCell(cell, copy.id, cell.areaId, editedAt));

  return {
    ...plan,
    scopeTree: [...plan.scopeTree, copy],
    cells: [...plan.cells, ...copiedCells],
  };
}

/**
 * Crea varias ubicaciones de una vez: «Piso {n}», de 1 a 20.
 *
 * `from` puede ser mayor que `to` para crear sótanos en el orden en que se
 * construyen. Sin `{n}` en el patrón se crea una sola: repetir veinte veces
 * el mismo nombre no es lo que nadie quiere.
 */
export function createAreaRange(
  plan: MatrixPlan,
  input: { pattern: string; from: number; to: number; type?: string },
  editedAt: string,
): MatrixPlan {
  const step = input.from <= input.to ? 1 : -1;
  const numbers: number[] = [];
  for (let n = input.from; step > 0 ? n <= input.to : n >= input.to; n += step) {
    numbers.push(n);
  }

  const names = input.pattern.includes("{n}")
    ? numbers.map((n) => input.pattern.replace("{n}", String(n)))
    : [input.pattern];

  const existingNames = new Set(plan.areas.map((area) => area.name));
  const taken = new Set(getAreaLeaves(plan.areas).map((leaf) => leaf.node.id));

  const created: AreaNode[] = names
    .filter((name) => !existingNames.has(name))
    .map((name) => ({
      id: uniqueId(sanitizeId(name), taken),
      name,
      type: input.type,
    }));

  const scopes = getScopeLeaves(plan.scopeTree).map((leaf) => leaf.node);
  const newCells: MatrixCell[] = created.flatMap((area) =>
    scopes.map((scope) => ({
      id: `cell-${scope.id}-${area.id}`,
      scopeId: scope.id,
      areaId: area.id,
      recipeId: scope.defaultRecipeId,
      active: true,
      lastEditedAt: editedAt,
      lastEditedFrom: "matrix" as const,
    })),
  );

  return {
    ...plan,
    areas: [...plan.areas, ...created],
    cells: [...plan.cells, ...newCells],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/bulk.test.ts src/lib/matrix/tree.test.ts`
Expected: PASS (16 tests en `bulk`, más los de `tree` sin cambios)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/bulk.ts src/lib/matrix/bulk.test.ts
git commit -m "feat(matriz): duplicar alcances y ubicaciones y crear N de golpe"
```

---

## Task 11: Aprobar el rendimiento observado

**Files:**
- Create: `src/lib/matrix/feedback.ts`
- Test: `src/lib/matrix/feedback.test.ts`

**Interfaces:**
- Consumes: `MatrixPlan`, `MatrixCell` de `@/types/matrix`.
- Produces:
  - `export interface PendingFeedback { cellId: string; scopeId: string; areaId: string; observedDurationDays: number; suggestedProductivityPerDay: number; currentProductivityPerDay?: number; message: string }`
  - `export function listPendingFeedback(plan: MatrixPlan): PendingFeedback[]`
  - `export function approveCellFeedback(plan: MatrixPlan, cellId: string, editedAt: string): MatrixPlan`
  - `export function dismissCellFeedback(plan: MatrixPlan, cellId: string, editedAt: string): MatrixPlan`

- [ ] **Step 1: Write the failing test**

```ts
import {
  approveCellFeedback,
  dismissCellFeedback,
  listPendingFeedback,
} from "./feedback";
import type { MatrixPlan } from "@/types/matrix";

const AHORA = "2026-08-07T12:00:00.000Z";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        quantity: 20,
        productivityOverridePerDay: 4,
        feedback: {
          source: "gantt",
          observedDurationDays: 8,
          suggestedProductivityPerDay: 2.5,
          status: "pendingApproval",
        },
      },
      {
        id: "c2",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
      },
    ],
  };
}

describe("listPendingFeedback", () => {
  test("lista solo lo que está esperando aprobación", () => {
    const pendientes = listPendingFeedback(plan());

    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].cellId).toBe("c1");
  });

  test("lo explica en lenguaje de obra, con los dos números", () => {
    expect(listPendingFeedback(plan())[0].message).toBe(
      "En obra tardó 8 días. El rendimiento real es 2,5 por día, frente a 4 planificado.",
    );
  });

  test("un plan sin observaciones devuelve la lista vacía", () => {
    expect(listPendingFeedback({ ...plan(), cells: [] })).toEqual([]);
  });
});

describe("approveCellFeedback", () => {
  test("aprobar escribe el rendimiento observado en la celda", () => {
    const result = approveCellFeedback(plan(), "c1", AHORA);
    const celda = result.cells.find((cell) => cell.id === "c1")!;

    expect(celda.productivityOverridePerDay).toBe(2.5);
    expect(celda.feedback?.status).toBe("approved");
  });

  test("aprobado deja de estar pendiente", () => {
    expect(listPendingFeedback(approveCellFeedback(plan(), "c1", AHORA))).toHaveLength(0);
  });

  test("marca cuándo se aprobó y desde dónde", () => {
    const celda = approveCellFeedback(plan(), "c1", AHORA).cells.find(
      (cell) => cell.id === "c1",
    )!;

    expect(celda.lastEditedAt).toBe(AHORA);
    expect(celda.lastEditedFrom).toBe("matrix");
  });

  test("aprobar una celda sin observación no cambia nada", () => {
    const result = approveCellFeedback(plan(), "c2", AHORA);

    expect(result.cells.find((cell) => cell.id === "c2")?.productivityOverridePerDay)
      .toBeUndefined();
  });
});

describe("dismissCellFeedback", () => {
  test("descartar conserva el rendimiento planificado", () => {
    const celda = dismissCellFeedback(plan(), "c1", AHORA).cells.find(
      (cell) => cell.id === "c1",
    )!;

    expect(celda.productivityOverridePerDay).toBe(4);
    expect(celda.feedback?.status).toBe("dismissed");
  });

  test("descartado deja de estar pendiente", () => {
    expect(listPendingFeedback(dismissCellFeedback(plan(), "c1", AHORA))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/feedback.test.ts`
Expected: FAIL — `Cannot find module './feedback' from 'src/lib/matrix/feedback.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { MatrixCell, MatrixPlan } from "@/types/matrix";

/**
 * El rendimiento que la obra sacó de verdad, esperando visto bueno.
 *
 * `syncMatrixPlanFromTasks` ya lo calcula y lo deja en `cell.feedback` con
 * estado «pendingApproval»; hasta ahora nadie lo leía. Aprobarlo cierra el
 * ciclo: la próxima torre se programa con los datos de la anterior.
 */
export interface PendingFeedback {
  cellId: string;
  scopeId: string;
  areaId: string;
  observedDurationDays: number;
  suggestedProductivityPerDay: number;
  currentProductivityPerDay?: number;
  message: string;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

export function listPendingFeedback(plan: MatrixPlan): PendingFeedback[] {
  return plan.cells
    .filter((cell) => cell.feedback?.status === "pendingApproval")
    .map((cell) => {
      const feedback = cell.feedback!;
      const planificado = cell.productivityOverridePerDay;
      return {
        cellId: cell.id,
        scopeId: cell.scopeId,
        areaId: cell.areaId,
        observedDurationDays: feedback.observedDurationDays,
        suggestedProductivityPerDay: feedback.suggestedProductivityPerDay,
        currentProductivityPerDay: planificado,
        message:
          `En obra tardó ${formatNumber(feedback.observedDurationDays)} días. ` +
          `El rendimiento real es ${formatNumber(feedback.suggestedProductivityPerDay)} por día` +
          (planificado === undefined
            ? "."
            : `, frente a ${formatNumber(planificado)} planificado.`),
      };
    });
}

function updateFeedback(
  plan: MatrixPlan,
  cellId: string,
  editedAt: string,
  update: (cell: MatrixCell) => MatrixCell,
): MatrixPlan {
  return {
    ...plan,
    cells: plan.cells.map((cell) => {
      if (cell.id !== cellId || !cell.feedback) return cell;
      return { ...update(cell), lastEditedAt: editedAt, lastEditedFrom: "matrix" };
    }),
  };
}

export function approveCellFeedback(
  plan: MatrixPlan,
  cellId: string,
  editedAt: string,
): MatrixPlan {
  return updateFeedback(plan, cellId, editedAt, (cell) => ({
    ...cell,
    productivityOverridePerDay: cell.feedback!.suggestedProductivityPerDay,
    feedback: { ...cell.feedback!, status: "approved" },
  }));
}

export function dismissCellFeedback(
  plan: MatrixPlan,
  cellId: string,
  editedAt: string,
): MatrixPlan {
  return updateFeedback(plan, cellId, editedAt, (cell) => ({
    ...cell,
    feedback: { ...cell.feedback!, status: "dismissed" },
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/feedback.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/feedback.ts src/lib/matrix/feedback.test.ts
git commit -m "feat(matriz): aprobar o descartar el rendimiento observado en obra"
```

---

## Task 12: Conflictos con las dos versiones y con elección

**Files:**
- Modify: `src/types/matrix.ts:149-154` (`MatrixSyncConflict`)
- Modify: `src/lib/matrix/matrixSync.ts:104-157` (`detectConflicts`), `:10-20` (entradas de `applyMatrixUpdate`), `:173-198` (`applyMatrixUpdate`)
- Modify: `src/lib/matrix/matrixSync.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `GanttTask`, `MatrixPlan`.
- Produces:
  - `MatrixSyncConflict` gana `matrixValue: string` y `ganttValue: string`.
  - `export type ConflictResolution = "matriz" | "gantt"`
  - `applyMatrixUpdate` acepta `resolutions?: Record<string, ConflictResolution>`, con la clave `` `${taskId}::${field}` ``.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/matrix/matrixSync.test.ts`:

```ts
import { applyMatrixUpdate as aplicar } from "./matrixSync";
import { generateScheduleFromMatrix as generar } from "./matrixGenerator";
import type { MatrixPlan } from "@/types/matrix";

function planSimple(): MatrixPlan {
  return {
    id: "p-conflicto",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [
      {
        id: "r1",
        name: "Estructura",
        activities: [
          { id: "columnas", name: "Columnas", productivityPerDay: 1, defaultQuantity: 5 },
        ],
        dependencies: [],
      },
    ],
    cells: [
      { id: "c1", scopeId: "estructura", areaId: "piso-1", recipeId: "r1", active: true },
    ],
  };
}

describe("applyMatrixUpdate · conflictos con elección", () => {
  test("el conflicto trae las dos versiones para poder elegir con la información delante", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Columnas piso 1 (renombrada en obra)" },
    );

    const { conflicts } = aplicar({
      tasks: editadasEnGantt,
      currentPlan: plan,
      nextPlan: plan,
    });
    const conflictoDeNombre = conflicts.find((item) => item.field === "name")!;

    expect(conflictoDeNombre.ganttValue).toBe("Columnas piso 1 (renombrada en obra)");
    expect(conflictoDeNombre.matrixValue).toContain("Columnas");
    expect(conflictoDeNombre.matrixValue).not.toBe(conflictoDeNombre.ganttValue);
  });

  test("sin elección explícita gana la matriz, como hasta hoy", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Renombrada" },
    );

    const result = aplicar({ tasks: editadasEnGantt, currentPlan: plan, nextPlan: plan });
    const tarea = result.tasks.find((task) => task.matrixSource)!;

    expect(tarea.name).not.toBe("Renombrada");
  });

  test("eligiendo el Gantt se conserva lo que se editó en obra", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const tareaOriginal = tasks.find((task) => task.matrixSource)!;
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Renombrada" },
    );

    const result = aplicar({
      tasks: editadasEnGantt,
      currentPlan: plan,
      nextPlan: plan,
      resolutions: { [`${tareaOriginal.id}::name`]: "gantt" },
    });
    const tarea = result.tasks.find((task) => task.matrixSource)!;

    expect(tarea.name).toBe("Renombrada");
  });

  test("elegir la matriz explícitamente hace lo mismo que no elegir", () => {
    const plan = planSimple();
    const { tasks } = generar(plan);
    const tareaOriginal = tasks.find((task) => task.matrixSource)!;
    const editadasEnGantt = tasks.map((task) =>
      task.isSummary ? task : { ...task, name: "Renombrada" },
    );

    const result = aplicar({
      tasks: editadasEnGantt,
      currentPlan: plan,
      nextPlan: plan,
      resolutions: { [`${tareaOriginal.id}::name`]: "matriz" },
    });
    const tarea = result.tasks.find((task) => task.matrixSource)!;

    expect(tarea.name).toBe(tareaOriginal.name);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixSync.test.ts`
Expected: FAIL — el primero con `Property 'ganttValue' does not exist on type 'MatrixSyncConflict'`, y el tercero con `Expected: "Renombrada" / Received: "Columnas · Piso 1"` (el nombre generado por la matriz).

- [ ] **Step 3: Write minimal implementation**

**a)** En `src/types/matrix.ts`:

```ts
export type ConflictResolution = "matriz" | "gantt";

export interface MatrixSyncConflict {
  taskId: string | number;
  cellId: string;
  field: "name" | "duration" | "start" | "finish";
  /** Lo que dice la matriz. */
  matrixValue: string;
  /** Lo que se editó en el Gantt. */
  ganttValue: string;
  message: string;
}
```

**b)** En `src/lib/matrix/matrixSync.ts`, dentro de `detectConflicts`, añadir a cada uno de los cuatro
`conflicts.push` sus dos valores. Por ejemplo, el de nombre:

```ts
    if (task.name !== expected.name) {
      conflicts.push({
        taskId: task.id,
        cellId: source.cellId,
        field: "name",
        matrixValue: expected.name,
        ganttValue: task.name,
        message: `«${expected.name}» se renombró a «${task.name}» desde el Gantt.`,
      });
    }
```

y análogamente para `duration` (`String(expected.duration)` / `String(task.duration)`), `start` y `finish`
(`dateKey(...)` en ambos lados), con mensajes:

```ts
      `La duración pasó de ${expected.duration} a ${task.duration} días desde el Gantt.`
      `El inicio pasó del ${dateKey(expected.start)} al ${dateKey(task.start)} desde el Gantt.`
      `El fin pasó del ${dateKey(expected.finish)} al ${dateKey(task.finish)} desde el Gantt.`
```

**c)** Ampliar `ApplyMatrixUpdateInput` y aplicar las elecciones en `applyMatrixUpdate`. Añadir
`ConflictResolution` al `import type` que `matrixSync.ts` ya trae de `@/types/matrix`:

```ts
interface ApplyMatrixUpdateInput {
  tasks: GanttTask[];
  currentPlan: MatrixPlan;
  nextPlan: MatrixPlan;
  /**
   * Qué gana en cada conflicto, con la clave `${taskId}::${campo}`. Sin
   * elección gana la matriz, que es lo que hacía antes de que se pudiera
   * elegir.
   */
  resolutions?: Record<string, ConflictResolution>;
}
```

```ts
export function applyMatrixUpdate({
  tasks,
  currentPlan,
  nextPlan,
  resolutions = {},
}: ApplyMatrixUpdateInput): ApplyMatrixUpdateResult {
  const previousBySource = new Map(
    tasks
      .map((task) => [sourceKey(task), task] as const)
      .filter((entry): entry is [string, GanttTask] => entry[0] != null),
  );
  const generated = generateScheduleFromMatrix(nextPlan);
  const conflicts = detectConflicts(tasks, currentPlan);
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const mergedGenerated = generated.tasks.map((task) => {
    const merged = mergeGeneratedTask(task, previousBySource);
    let result = merged;

    for (const conflict of conflicts) {
      if (conflict.taskId !== merged.id) continue;
      if (resolutions[`${conflict.taskId}::${conflict.field}`] !== "gantt") continue;

      const fromGantt = taskById.get(conflict.taskId);
      if (!fromGantt) continue;

      if (conflict.field === "name") result = { ...result, name: fromGantt.name };
      if (conflict.field === "duration") {
        result = { ...result, duration: fromGantt.duration };
      }
      if (conflict.field === "start") result = { ...result, start: fromGantt.start };
      if (conflict.field === "finish") result = { ...result, finish: fromGantt.finish };
    }

    return result;
  });

  const generatedIds = new Set(mergedGenerated.map((task) => task.id));
  const nonMatrixTasks = tasks.filter(
    (task) => !task.matrixSource && !generatedIds.has(task.id),
  );

  return {
    tasks: [...mergedGenerated, ...nonMatrixTasks],
    matrixPlan: attachGeneratedTaskIds(nextPlan, generated.provenance),
    conflicts,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixSync.test.ts`
Expected: PASS — los tests que ya existían más los 4 nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/types/matrix.ts src/lib/matrix/matrixSync.ts src/lib/matrix/matrixSync.test.ts
git commit -m "feat(matriz): conflictos con las dos versiones y eleccion de cual gana"
```

---

## Task 13: Catálogo de plantillas de fábrica y plantilla propia

**Files:**
- Create: `src/lib/matrix/templateCatalog.ts`
- Test: `src/lib/matrix/templateCatalog.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_MATRIX_TEMPLATE` de `./templates`; `MatrixTemplate`, `MatrixPlan`.
- Produces:
  - `export const FACTORY_TEMPLATES: MatrixTemplate[]`
  - `export function listFactoryTemplates(): MatrixTemplate[]`
  - `export function templateFromPlan(plan: MatrixPlan, name: string): MatrixTemplate`

- [ ] **Step 1: Write the failing test**

```ts
import {
  FACTORY_TEMPLATES,
  listFactoryTemplates,
  templateFromPlan,
} from "./templateCatalog";
import { DEFAULT_MATRIX_TEMPLATE } from "./templates";
import type { MatrixPlan } from "@/types/matrix";

describe("catálogo de plantillas de fábrica", () => {
  test("incluye la de vivienda vertical que ya existía", () => {
    expect(FACTORY_TEMPLATES.map((template) => template.id)).toContain(
      DEFAULT_MATRIX_TEMPLATE.id,
    );
  });

  test("hay una plantilla por tipo de obra, no una sola", () => {
    expect(FACTORY_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(FACTORY_TEMPLATES.map((template) => template.projectType)).size)
      .toBeGreaterThanOrEqual(3);
  });

  test("todas tienen alcances, ubicaciones y recetas: ninguna en blanco", () => {
    for (const template of FACTORY_TEMPLATES) {
      expect(template.scopeTree.length).toBeGreaterThan(0);
      expect(template.areas.length).toBeGreaterThan(0);
      expect(template.recipes.length).toBeGreaterThan(0);
    }
  });

  test("todos los identificadores son distintos", () => {
    const ids = FACTORY_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("cada alcance apunta a una receta que existe en su plantilla", () => {
    for (const template of FACTORY_TEMPLATES) {
      const recipeIds = new Set(template.recipes.map((recipe) => recipe.id));
      const walk = (nodes: typeof template.scopeTree) => {
        for (const node of nodes) {
          if (node.defaultRecipeId) expect(recipeIds.has(node.defaultRecipeId)).toBe(true);
          if (node.children) walk(node.children);
        }
      };
      walk(template.scopeTree);
    }
  });

  test("listFactoryTemplates devuelve una copia: nadie puede alterar el catálogo", () => {
    const lista = listFactoryTemplates();
    lista.pop();

    expect(listFactoryTemplates()).toHaveLength(FACTORY_TEMPLATES.length);
  });
});

describe("templateFromPlan", () => {
  const plan: MatrixPlan = {
    id: "p1",
    name: "Torre 3 de Da Porto",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      { id: "c1", scopeId: "estructura", areaId: "piso-1", recipeId: "r1", active: true },
    ],
  };

  test("guarda la forma de la obra: alcances, ubicaciones y recetas", () => {
    const template = templateFromPlan(plan, "Mi torre tipo");

    expect(template.name).toBe("Mi torre tipo");
    expect(template.scopeTree).toEqual(plan.scopeTree);
    expect(template.areas).toEqual(plan.areas);
    expect(template.recipes).toEqual(plan.recipes);
  });

  test("no guarda las celdas ni las fechas: una plantilla no es una obra concreta", () => {
    const template = templateFromPlan(plan, "Mi torre tipo") as Record<string, unknown>;

    expect(template.cells).toBeUndefined();
    expect(template.startDate).toBeUndefined();
  });

  test("la plantilla es independiente del plan del que salió", () => {
    const template = templateFromPlan(plan, "Mi torre tipo");
    template.scopeTree[0].name = "Cambiado";

    expect(plan.scopeTree[0].name).toBe("Estructura");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/templateCatalog.test.ts`
Expected: FAIL — `Cannot find module './templateCatalog' from 'src/lib/matrix/templateCatalog.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { MatrixPlan, MatrixTemplate } from "@/types/matrix";
import { DEFAULT_MATRIX_TEMPLATE } from "./templates";

/**
 * Plantillas de fábrica por tipo de obra.
 *
 * El vocabulario sale de los cronogramas reales del repositorio: la torre de
 * vivienda de Da Porto, el urbanismo con sus vías y redes externas, y la obra
 * lineal por tramos de la Estación 16.
 */
const URBANISMO: MatrixTemplate = {
  id: "template-urbanismo",
  name: "Urbanismo y obras exteriores",
  projectType: "Urbanismo",
  scopeTree: [
    {
      id: "exteriores",
      name: "Obras exteriores",
      type: "Capitulo",
      children: [
        { id: "vias", name: "Vías internas", type: "Disciplina", defaultRecipeId: "receta-vias" },
        {
          id: "redes-externas",
          name: "Redes externas",
          type: "Disciplina",
          defaultRecipeId: "receta-redes",
        },
        {
          id: "zonas-verdes",
          name: "Zonas verdes",
          type: "Disciplina",
          defaultRecipeId: "receta-zonas-verdes",
        },
      ],
    },
  ],
  areas: [
    { id: "zona-1", name: "Zona 1", type: "Zona" },
    { id: "zona-2", name: "Zona 2", type: "Zona" },
  ],
  recipes: [
    {
      id: "receta-vias",
      name: "Vías",
      activities: [
        { id: "perfilacion", name: "Perfilación y nivelación", productivityPerDay: 120, unit: "m2" },
        { id: "cordones", name: "Instalación de cordones", productivityPerDay: 60, unit: "ml" },
        { id: "pavimento", name: "Instalación de pavimento", productivityPerDay: 80, unit: "m2" },
      ],
      dependencies: [
        { predecessorActivityId: "perfilacion", successorActivityId: "cordones", type: "FS" },
        { predecessorActivityId: "cordones", successorActivityId: "pavimento", type: "FS" },
      ],
      locationChaining: { mode: "encadenado" },
    },
    {
      id: "receta-redes",
      name: "Redes externas",
      activities: [
        { id: "excavacion", name: "Excavación de zanjas", productivityPerDay: 40, unit: "ml" },
        { id: "tendido", name: "Tendido de redes", productivityPerDay: 50, unit: "ml" },
        { id: "relleno", name: "Relleno y compactación", productivityPerDay: 60, unit: "ml" },
      ],
      dependencies: [
        { predecessorActivityId: "excavacion", successorActivityId: "tendido", type: "FS" },
        { predecessorActivityId: "tendido", successorActivityId: "relleno", type: "FS" },
      ],
    },
    {
      id: "receta-zonas-verdes",
      name: "Zonas verdes",
      activities: [
        { id: "adecuacion", name: "Adecuación de terreno", productivityPerDay: 150, unit: "m2" },
        { id: "engramado", name: "Engramado", productivityPerDay: 200, unit: "m2" },
      ],
      dependencies: [
        { predecessorActivityId: "adecuacion", successorActivityId: "engramado", type: "FS" },
      ],
    },
  ],
};

const OBRA_LINEAL: MatrixTemplate = {
  id: "template-obra-lineal",
  name: "Obra lineal por tramos",
  projectType: "Infraestructura",
  scopeTree: [
    {
      id: "obra-lineal",
      name: "Obra lineal",
      type: "Capitulo",
      children: [
        {
          id: "cimentacion",
          name: "Cimentación",
          type: "Disciplina",
          defaultRecipeId: "receta-cimentacion",
        },
        {
          id: "superestructura",
          name: "Superestructura",
          type: "Disciplina",
          defaultRecipeId: "receta-superestructura",
        },
      ],
    },
  ],
  areas: [
    { id: "tramo-1", name: "Tramo 1", type: "Tramo" },
    { id: "tramo-2", name: "Tramo 2", type: "Tramo" },
    { id: "tramo-3", name: "Tramo 3", type: "Tramo" },
  ],
  recipes: [
    {
      id: "receta-cimentacion",
      name: "Cimentación",
      activities: [
        { id: "pilotes", name: "Pilotes", productivityPerDay: 2, unit: "un" },
        { id: "descabece", name: "Descabece de pilotes", productivityPerDay: 4, unit: "un" },
        { id: "dados", name: "Dados de cimentación", productivityPerDay: 1, unit: "un" },
      ],
      dependencies: [
        { predecessorActivityId: "pilotes", successorActivityId: "descabece", type: "FS" },
        { predecessorActivityId: "descabece", successorActivityId: "dados", type: "FS" },
      ],
      locationChaining: { mode: "encadenado" },
    },
    {
      id: "receta-superestructura",
      name: "Superestructura",
      activities: [
        { id: "columnas", name: "Columnas", productivityPerDay: 2, unit: "un" },
        { id: "vigas", name: "Vigas", productivityPerDay: 2, unit: "un" },
      ],
      dependencies: [
        { predecessorActivityId: "columnas", successorActivityId: "vigas", type: "FS" },
      ],
      locationChaining: { mode: "encadenado" },
    },
  ],
};

export const FACTORY_TEMPLATES: MatrixTemplate[] = [
  DEFAULT_MATRIX_TEMPLATE,
  URBANISMO,
  OBRA_LINEAL,
];

export function listFactoryTemplates(): MatrixTemplate[] {
  return [...FACTORY_TEMPLATES];
}

/**
 * Guarda la matriz actual como plantilla propia.
 *
 * Se queda con la forma de la obra —alcances, ubicaciones y recetas— y deja
 * fuera las celdas y las fechas: una plantilla no es una obra concreta.
 */
export function templateFromPlan(plan: MatrixPlan, name: string): MatrixTemplate {
  return {
    id: `template-propia-${plan.id}`,
    name,
    projectType: "Propia",
    scopeTree: JSON.parse(JSON.stringify(plan.scopeTree)),
    areas: JSON.parse(JSON.stringify(plan.areas)),
    recipes: JSON.parse(JSON.stringify(plan.recipes)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/templateCatalog.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/templateCatalog.ts src/lib/matrix/templateCatalog.test.ts
git commit -m "feat(matriz): catalogo de plantillas de fabrica y guardar la propia"
```

---

## Task 14: Propuesta de matriz desde un cronograma cargado

Es la tarea que convierte «cargué un `.mpp`» en «tengo una matriz». **Requiere P3 fusionado.**

**Files:**
- Create: `src/lib/matrix/matrixProposal.ts`
- Test: `src/lib/matrix/matrixProposal.test.ts`

**Interfaces:**
- Consumes: `resolveTaskLocation` de `@/lib/scheduling/detection`; `GanttTask`.
- Produces:
  - `export interface ProposedLocation { id: string; name: string; type: string; order: number; taskCount: number; evidence: string }`
  - `export interface ProposedScope { id: string; name: string; locationIds: string[]; evidence: string }`
  - `export interface ProposedActivity { id: string; name: string; medianDurationDays: number; observedIn: number }`
  - `export interface ProposedRecipe { id: string; scopeId: string; name: string; activities: ProposedActivity[]; confidence: number; evidence: string }`
  - `export interface MatrixProposal { locations: ProposedLocation[]; scopes: ProposedScope[]; recipes: ProposedRecipe[]; skippedTaskCount: number; summary: string }`
  - `export const MIN_LOCATIONS_FOR_RECIPE = 3`
  - `export function proposeMatrixFromTasks(tasks: GanttTask[]): MatrixProposal`

- [ ] **Step 1: Write the failing test**

```ts
import { MIN_LOCATIONS_FOR_RECIPE, proposeMatrixFromTasks } from "./matrixProposal";
import type { GanttTask } from "@/components/gantt/types";

function task(
  id: number,
  name: string,
  startDay: number,
  durationDays: number,
  wbs?: string,
): GanttTask {
  const start = new Date(2026, 2, startDay);
  const finish = new Date(2026, 2, startDay + durationDays - 1);
  return {
    id,
    name,
    wbs,
    start,
    finish,
    duration: durationDays,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [],
  };
}

/** Tres pisos con mampostería y pintura, más urbanismo sin ubicación. */
function cronograma(): GanttTask[] {
  return [
    task(1, "Mampostería piso 1", 2, 5),
    task(2, "Pintura piso 1", 8, 3),
    task(3, "Mampostería piso 2", 9, 5),
    task(4, "Pintura piso 2", 15, 4),
    task(5, "Mampostería piso 3", 16, 6),
    task(6, "Pintura piso 3", 23, 3),
    task(7, "Vías internas", 2, 10),
  ];
}

describe("proposeMatrixFromTasks · ubicaciones", () => {
  test("propone una ubicación por piso detectado", () => {
    const { locations } = proposeMatrixFromTasks(cronograma());

    expect(locations.map((location) => location.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
      "Obra general",
    ]);
  });

  test("las ordena como se construye, y deja la obra general al final", () => {
    const conSotano = [...cronograma(), task(8, "Mampostería sótano 2", 1, 4)];
    const { locations } = proposeMatrixFromTasks(conSotano);

    expect(locations.map((location) => location.order)).toEqual([-2, 1, 2, 3, Infinity]);
  });

  test("cada ubicación dice cuántas tareas la sostienen", () => {
    const { locations } = proposeMatrixFromTasks(cronograma());
    const piso1 = locations.find((location) => location.name === "Piso 1")!;

    expect(piso1.taskCount).toBe(2);
    expect(piso1.evidence).toContain("2 tareas");
  });
});

describe("proposeMatrixFromTasks · alcances y recetas", () => {
  test("un alcance es la actividad sin su ubicación", () => {
    const { scopes } = proposeMatrixFromTasks(cronograma());

    expect(scopes.map((scope) => scope.name).sort()).toEqual([
      "Mampostería",
      "Pintura",
      "Vías internas",
    ]);
  });

  test("solo propone receta para lo que se repite en tres o más ubicaciones", () => {
    const { recipes } = proposeMatrixFromTasks(cronograma());

    expect(recipes.map((recipe) => recipe.name).sort()).toEqual([
      "Mampostería",
      "Pintura",
    ]);
    expect(MIN_LOCATIONS_FOR_RECIPE).toBe(3);
  });

  test("el rendimiento propuesto es la duración mediana, no la media", () => {
    // Mampostería: 5, 5 y 6 días → mediana 5. Con un paro largo la media mentiría.
    const conParo = cronograma().map((item) =>
      item.id === 5 ? task(5, "Mampostería piso 3", 16, 40) : item,
    );
    const { recipes } = proposeMatrixFromTasks(conParo);
    const mamposteria = recipes.find((recipe) => recipe.name === "Mampostería")!;

    expect(mamposteria.activities[0].medianDurationDays).toBe(5);
  });

  test("cada receta explica en qué se basa", () => {
    const { recipes } = proposeMatrixFromTasks(cronograma());
    const mamposteria = recipes.find((recipe) => recipe.name === "Mampostería")!;

    expect(mamposteria.evidence).toBe(
      "«Mampostería» aparece en 3 ubicaciones, con 5 días de mediana.",
    );
  });

  test("la confianza sube con el número de ubicaciones donde se repite", () => {
    const { recipes } = proposeMatrixFromTasks(cronograma());

    for (const recipe of recipes) {
      expect(recipe.confidence).toBeGreaterThan(0);
      expect(recipe.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("proposeMatrixFromTasks · honestidad", () => {
  test("un cronograma sin patrón repetido no inventa una matriz", () => {
    const sinPatron = [
      task(1, "Localización y replanteo", 2, 3),
      task(2, "Construcción de campamentos", 5, 4),
      task(3, "Excavación a cota 2110", 9, 8),
    ];
    const proposal = proposeMatrixFromTasks(sinPatron);

    expect(proposal.recipes).toHaveLength(0);
    expect(proposal.summary).toBe(
      "Este cronograma no repite ninguna actividad en tres o más ubicaciones, así que no hay recetas que proponer.",
    );
  });

  test("las tareas resumen no cuentan", () => {
    const conResumen: GanttTask[] = [
      { ...task(10, "ACABADOS", 1, 30), isSummary: true, outlineLevel: 1 },
      ...cronograma(),
    ];
    const proposal = proposeMatrixFromTasks(conResumen);

    expect(proposal.scopes.map((scope) => scope.name)).not.toContain("ACABADOS");
  });

  test("resume lo propuesto en lenguaje de obra", () => {
    expect(proposeMatrixFromTasks(cronograma()).summary).toBe(
      "Se proponen 4 ubicaciones, 3 alcances y 2 recetas a partir de 7 tareas.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixProposal.test.ts`
Expected: FAIL — `Cannot find module './matrixProposal' from 'src/lib/matrix/matrixProposal.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GanttTask } from "@/components/gantt/types";
import { resolveTaskLocation } from "@/lib/scheduling/detection";

/**
 * Propuesta de matriz a partir de un cronograma cargado.
 *
 * No es un `MatrixPlan`: es lo que el usuario revisa antes de que se
 * construya nada. Cada elemento lleva su evidencia en lenguaje de obra, para
 * que aceptarlo sea una decisión y no un acto de fe. Si el cronograma no
 * repite nada, la propuesta sale vacía y lo dice, en vez de inventar una
 * matriz que nadie pidió.
 */
export interface ProposedLocation {
  id: string;
  name: string;
  type: string;
  /** Número ordenable. La obra general va al final. */
  order: number;
  taskCount: number;
  evidence: string;
}

export interface ProposedScope {
  id: string;
  name: string;
  locationIds: string[];
  evidence: string;
}

export interface ProposedActivity {
  id: string;
  name: string;
  medianDurationDays: number;
  observedIn: number;
}

export interface ProposedRecipe {
  id: string;
  scopeId: string;
  name: string;
  activities: ProposedActivity[];
  confidence: number;
  evidence: string;
}

export interface MatrixProposal {
  locations: ProposedLocation[];
  scopes: ProposedScope[];
  recipes: ProposedRecipe[];
  skippedTaskCount: number;
  summary: string;
}

/** El mismo mínimo que usa Unidad Típica: por debajo no hay patrón, hay coincidencia. */
export const MIN_LOCATIONS_FOR_RECIPE = 3;

const GENERAL_LOCATION_ID = "obra-general";

function sanitizeId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/** El nombre de la actividad sin su ubicación: «Mampostería piso 3» → «Mampostería». */
function scopeNameOf(taskName: string, locationRaw: string | null): string {
  if (!locationRaw) return taskName.trim();
  const cleaned = taskName
    .replace(
      new RegExp(
        `\\s*(piso|nivel|planta|sotano|sótano|torre|zona|sector|tramo|etapa)\\s*[-#:]?\\s*${locationRaw}\\b`,
        "iu",
      ),
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || taskName.trim();
}

export function proposeMatrixFromTasks(tasks: GanttTask[]): MatrixProposal {
  const operational = tasks.filter((task) => !task.isSummary && !task.isMilestone);

  const locationsById = new Map<string, ProposedLocation>();
  const scopesById = new Map<
    string,
    { name: string; locations: Set<string>; durations: Map<string, number[]> }
  >();

  for (const task of operational) {
    const resolved = resolveTaskLocation(task, tasks);
    const isGeneral = resolved.location === null;
    const locationName = isGeneral
      ? "Obra general"
      : `${resolved.location!.label} ${resolved.location!.raw}`;
    const locationId = isGeneral ? GENERAL_LOCATION_ID : sanitizeId(locationName);

    const existing = locationsById.get(locationId);
    if (existing) {
      existing.taskCount += 1;
    } else {
      locationsById.set(locationId, {
        id: locationId,
        name: locationName,
        type: isGeneral ? "Obra general" : resolved.location!.label,
        order: isGeneral ? Infinity : resolved.location!.value,
        taskCount: 1,
        evidence: "",
      });
    }

    const scopeName = scopeNameOf(task.name, isGeneral ? null : resolved.location!.raw);
    const scopeId = sanitizeId(scopeName);
    const scope = scopesById.get(scopeId) ?? {
      name: scopeName,
      locations: new Set<string>(),
      durations: new Map<string, number[]>(),
    };
    scope.locations.add(locationId);
    const durations = scope.durations.get(locationId) ?? [];
    durations.push(Math.max(1, task.duration));
    scope.durations.set(locationId, durations);
    scopesById.set(scopeId, scope);
  }

  const locations = [...locationsById.values()]
    .sort((a, b) => a.order - b.order)
    .map((location) => ({
      ...location,
      evidence: `«${location.name}» aparece en ${location.taskCount} tareas del cronograma.`,
    }));

  const scopes: ProposedScope[] = [...scopesById.entries()].map(([id, scope]) => ({
    id,
    name: scope.name,
    locationIds: [...scope.locations],
    evidence: `«${scope.name}» se programa en ${scope.locations.size} ubicaciones.`,
  }));

  const recipes: ProposedRecipe[] = [];
  for (const [scopeId, scope] of scopesById) {
    if (scope.locations.size < MIN_LOCATIONS_FOR_RECIPE) continue;

    const perLocation = [...scope.durations.values()].map((values) => median(values));
    const medianDurationDays = median(perLocation);

    recipes.push({
      id: `receta-${scopeId}`,
      scopeId,
      name: scope.name,
      activities: [
        {
          id: `actividad-${scopeId}`,
          name: scope.name,
          medianDurationDays,
          observedIn: scope.locations.size,
        },
      ],
      confidence: Math.min(1, scope.locations.size / 10),
      evidence: `«${scope.name}» aparece en ${scope.locations.size} ubicaciones, con ${medianDurationDays} días de mediana.`,
    });
  }

  return {
    locations,
    scopes,
    recipes,
    skippedTaskCount: tasks.length - operational.length,
    summary:
      recipes.length === 0
        ? "Este cronograma no repite ninguna actividad en tres o más ubicaciones, así que no hay recetas que proponer."
        : `Se proponen ${locations.length} ubicaciones, ${scopes.length} alcances y ${recipes.length} recetas a partir de ${operational.length} tareas.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixProposal.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixProposal.ts src/lib/matrix/matrixProposal.test.ts
git commit -m "feat(matriz): proponer alcances, ubicaciones, recetas y rendimientos desde un cronograma"
```

---

## Task 15: Convertir la propuesta aceptada en un plan

**Files:**
- Modify: `src/lib/matrix/matrixProposal.ts` (añadir al final)
- Modify: `src/lib/matrix/matrixProposal.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `MatrixProposal` (T14), `MatrixPlan` de `@/types/matrix`.
- Produces:
  - `export interface ProposalAcceptance { locationIds: string[]; scopeIds: string[]; recipeIds: string[] }`
  - `export function planFromProposal(proposal: MatrixProposal, acceptance: ProposalAcceptance, input: { id: string; name: string; startDate: string; editedAt: string }): MatrixPlan`

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/lib/matrix/matrixProposal.test.ts`:

```ts
import { planFromProposal } from "./matrixProposal";

const ENTRADA = {
  id: "plan-nuevo",
  name: "Torre 3",
  startDate: "2026-03-02",
  editedAt: "2026-08-07T12:00:00.000Z",
};

function todoAceptado(proposal: ReturnType<typeof proposeMatrixFromTasks>) {
  return {
    locationIds: proposal.locations.map((location) => location.id),
    scopeIds: proposal.scopes.map((scope) => scope.id),
    recipeIds: proposal.recipes.map((recipe) => recipe.id),
  };
}

describe("planFromProposal", () => {
  test("construye el plan con lo aceptado", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(proposal, todoAceptado(proposal), ENTRADA);

    expect(plan.id).toBe("plan-nuevo");
    expect(plan.areas.map((area) => area.name)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
      "Obra general",
    ]);
    expect(plan.scopeTree).toHaveLength(3);
  });

  test("lo descartado no entra en el plan", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      {
        locationIds: ["piso-1", "piso-2"],
        scopeIds: ["mamposteria"],
        recipeIds: ["receta-mamposteria"],
      },
      ENTRADA,
    );

    expect(plan.areas).toHaveLength(2);
    expect(plan.scopeTree).toHaveLength(1);
    expect(plan.recipes).toHaveLength(1);
  });

  test("crea una celda por cada cruce de alcance y ubicación aceptados", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      {
        locationIds: ["piso-1", "piso-2", "piso-3"],
        scopeIds: ["mamposteria", "pintura"],
        recipeIds: ["receta-mamposteria", "receta-pintura"],
      },
      ENTRADA,
    );

    expect(plan.cells).toHaveLength(6);
  });

  test("el rendimiento propuesto llega a la receta del plan", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(proposal, todoAceptado(proposal), ENTRADA);
    const mamposteria = plan.recipes.find((recipe) => recipe.name === "Mampostería")!;

    // 5 días de mediana con cantidad 1 → rendimiento 1/5 por día
    expect(mamposteria.activities[0].productivityPerDay).toBeCloseTo(1 / 5, 5);
    expect(mamposteria.activities[0].defaultQuantity).toBe(1);
  });

  test("un alcance sin receta aceptada queda con sus celdas inactivas, no roto", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      { locationIds: ["piso-1"], scopeIds: ["vias-internas"], recipeIds: [] },
      ENTRADA,
    );

    expect(plan.cells).toHaveLength(1);
    expect(plan.cells[0].active).toBe(false);
    expect(plan.cells[0].recipeId).toBeUndefined();
  });

  test("aceptar nada devuelve un plan vacío que se puede abrir sin reventar", () => {
    const proposal = proposeMatrixFromTasks(cronograma());
    const plan = planFromProposal(
      proposal,
      { locationIds: [], scopeIds: [], recipeIds: [] },
      ENTRADA,
    );

    expect(plan.cells).toEqual([]);
    expect(plan.areas).toEqual([]);
    expect(plan.scopeTree).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/matrixProposal.test.ts`
Expected: FAIL — `planFromProposal is not a function`.

- [ ] **Step 3: Write minimal implementation**

Añadir al final de `src/lib/matrix/matrixProposal.ts`:

```ts
import type { MatrixCell, MatrixPlan } from "@/types/matrix";

export interface ProposalAcceptance {
  locationIds: string[];
  scopeIds: string[];
  recipeIds: string[];
}

/**
 * Convierte en plan lo que el usuario aceptó de la propuesta.
 *
 * Es un paso aparte a propósito: la propuesta se revisa, el plan se construye.
 * Un alcance aceptado sin su receta entra igualmente, con sus celdas
 * inactivas, para que el usuario complete la receta en el editor en vez de
 * perder el alcance.
 */
export function planFromProposal(
  proposal: MatrixProposal,
  acceptance: ProposalAcceptance,
  input: { id: string; name: string; startDate: string; editedAt: string },
): MatrixPlan {
  const acceptedLocations = new Set(acceptance.locationIds);
  const acceptedScopes = new Set(acceptance.scopeIds);
  const acceptedRecipes = new Set(acceptance.recipeIds);

  const areas = proposal.locations
    .filter((location) => acceptedLocations.has(location.id))
    .map((location) => ({
      id: location.id,
      name: location.name,
      type: location.type,
    }));

  const recipes = proposal.recipes
    .filter((recipe) => acceptedRecipes.has(recipe.id))
    .map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      activities: recipe.activities.map((activity) => ({
        id: activity.id,
        name: activity.name,
        // Con cantidad 1, el rendimiento es el inverso de la duración
        // mediana: es la forma honesta de decir «esto tardó esto» mientras
        // no haya cantidades de obra medidas.
        productivityPerDay: 1 / Math.max(1, activity.medianDurationDays),
        defaultQuantity: 1,
      })),
      dependencies: [],
    }));

  const recipeByScopeId = new Map(
    proposal.recipes
      .filter((recipe) => acceptedRecipes.has(recipe.id))
      .map((recipe) => [recipe.scopeId, recipe.id]),
  );

  const scopeTree = proposal.scopes
    .filter((scope) => acceptedScopes.has(scope.id))
    .map((scope) => ({
      id: scope.id,
      name: scope.name,
      type: "Disciplina",
      defaultRecipeId: recipeByScopeId.get(scope.id),
    }));

  const cells: MatrixCell[] = scopeTree.flatMap((scope) =>
    areas.map((area) => ({
      id: `cell-${scope.id}-${area.id}`,
      scopeId: scope.id,
      areaId: area.id,
      recipeId: scope.defaultRecipeId,
      active: scope.defaultRecipeId !== undefined,
      lastEditedAt: input.editedAt,
      lastEditedFrom: "matrix" as const,
    })),
  );

  return {
    id: input.id,
    name: input.name,
    startDate: input.startDate,
    scopeTree,
    areas,
    recipes,
    cells,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/matrixProposal.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/matrixProposal.ts src/lib/matrix/matrixProposal.test.ts
git commit -m "feat(matriz): construir el plan con lo que el usuario acepto de la propuesta"
```

---

## Task 16: Saber si el borrador tiene cambios sin aplicar

**Files:**
- Create: `src/lib/matrix/draftState.ts`
- Test: `src/lib/matrix/draftState.test.ts`

**Interfaces:**
- Consumes: `MatrixPlan` de `@/types/matrix`.
- Produces:
  - `export interface DraftChanges { hasChanges: boolean; changedCellCount: number; message: string }`
  - `export function describeDraftChanges(draft: MatrixPlan | undefined, applied: MatrixPlan | undefined): DraftChanges`

- [ ] **Step 1: Write the failing test**

```ts
import { describeDraftChanges } from "./draftState";
import type { MatrixPlan } from "@/types/matrix";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        quantity: 10,
      },
    ],
  };
}

describe("describeDraftChanges", () => {
  test("sin cambios no hay nada que avisar", () => {
    expect(describeDraftChanges(plan(), plan())).toEqual({
      hasChanges: false,
      changedCellCount: 0,
      message: "No hay cambios sin aplicar.",
    });
  });

  test("cambiar una cantidad cuenta como un cambio", () => {
    const draft = {
      ...plan(),
      cells: [{ ...plan().cells[0], quantity: 25 }],
    };
    const result = describeDraftChanges(draft, plan());

    expect(result.hasChanges).toBe(true);
    expect(result.changedCellCount).toBe(1);
    expect(result.message).toBe("Hay 1 celda con cambios sin aplicar.");
  });

  test("varias celdas se cuentan en plural", () => {
    const applied = plan();
    const draft = {
      ...applied,
      cells: [
        { ...applied.cells[0], quantity: 25 },
        {
          id: "c2",
          scopeId: "estructura",
          areaId: "piso-2",
          recipeId: "r1",
          active: true,
        },
      ],
    };

    expect(describeDraftChanges(draft, applied).message).toBe(
      "Hay 2 celdas con cambios sin aplicar.",
    );
  });

  test("cambiar los alcances también cuenta, aunque las celdas sigan igual", () => {
    const draft = {
      ...plan(),
      scopeTree: [
        ...plan().scopeTree,
        { id: "acabados", name: "Acabados", type: "Disciplina" },
      ],
    };
    const result = describeDraftChanges(draft, plan());

    expect(result.hasChanges).toBe(true);
    expect(result.message).toBe("Hay cambios en la estructura de la matriz sin aplicar.");
  });

  test("un borrador nuevo sobre nada es un cambio", () => {
    expect(describeDraftChanges(plan(), undefined).hasChanges).toBe(true);
  });

  test("sin borrador no hay cambios que perder", () => {
    expect(describeDraftChanges(undefined, plan()).hasChanges).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/draftState.test.ts`
Expected: FAIL — `Cannot find module './draftState' from 'src/lib/matrix/draftState.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { MatrixCell, MatrixPlan } from "@/types/matrix";

/**
 * Qué se perdería al salir de la matriz sin aplicar.
 *
 * M28: hoy el borrador se pierde sin aviso al cambiar de pestaña o recargar.
 * Saber *si* hay cambios es del dato y vive aquí; interceptar la salida es de
 * la vista y vive en el carril A.
 */
export interface DraftChanges {
  hasChanges: boolean;
  changedCellCount: number;
  message: string;
}

/** Todo lo de una celda que el usuario puede editar. */
function cellFingerprint(cell: MatrixCell): string {
  return JSON.stringify([
    cell.recipeId,
    cell.active,
    cell.quantity,
    cell.unit,
    cell.productivityOverridePerDay,
    cell.notes,
    cell.activityOverrides ?? null,
  ]);
}

function structureFingerprint(plan: MatrixPlan): string {
  return JSON.stringify([plan.scopeTree, plan.areas, plan.recipes, plan.startDate]);
}

export function describeDraftChanges(
  draft: MatrixPlan | undefined,
  applied: MatrixPlan | undefined,
): DraftChanges {
  if (!draft) {
    return { hasChanges: false, changedCellCount: 0, message: "No hay cambios sin aplicar." };
  }

  if (!applied) {
    return {
      hasChanges: true,
      changedCellCount: draft.cells.length,
      message: "Hay una matriz sin aplicar.",
    };
  }

  if (structureFingerprint(draft) !== structureFingerprint(applied)) {
    return {
      hasChanges: true,
      changedCellCount: 0,
      message: "Hay cambios en la estructura de la matriz sin aplicar.",
    };
  }

  const appliedByCellId = new Map(
    applied.cells.map((cell) => [cell.id, cellFingerprint(cell)]),
  );
  const changedCellCount = draft.cells.filter(
    (cell) => appliedByCellId.get(cell.id) !== cellFingerprint(cell),
  ).length;

  if (changedCellCount === 0) {
    return { hasChanges: false, changedCellCount: 0, message: "No hay cambios sin aplicar." };
  }

  return {
    hasChanges: true,
    changedCellCount,
    message:
      changedCellCount === 1
        ? "Hay 1 celda con cambios sin aplicar."
        : `Hay ${changedCellCount} celdas con cambios sin aplicar.`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/draftState.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Verificación parcial (queda la Tarea 17)**

```bash
npx jest --runInBand
```
Expected: toda la suite en verde. Ningún test preexistente de `matrixGenerator`, `matrixSync`, `tree` o `matrixFromGantt` puede haber cambiado.

```bash
npx eslint src/lib/matrix src/types/matrix.ts
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
```
Expected: sin errores; el filtro de tipos, **vacío**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/matrix/draftState.ts src/lib/matrix/draftState.test.ts
git commit -m "feat(matriz): saber cuantos cambios del borrador quedan sin aplicar"
```

---

## Task 17: Borrar una ubicación sin perder trabajo en silencio

Hoy `removeAreaNode` quita el nodo y sus celdas, y **las tareas que esa ubicación ya había generado quedan
huérfanas** hasta la siguiente aplicación. De las 103 decisiones del grilleo, la línea más constante es que
nada se pierde en silencio y que lo destructivo es deshacible: este caso es exactamente eso.

**Files:**
- Create: `src/lib/matrix/removeArea.ts`
- Test: `src/lib/matrix/removeArea.test.ts`

**Interfaces:**
- Consumes: `removeAreaNode` de `./tree`; `MatrixPlan`, `GanttTask`.
- Produces:
  - `export type OrphanTaskPolicy = "borrar" | "conservar"`
  - `export interface AreaRemovalPreview { areaName: string; cellCount: number; taskIds: (string | number)[]; message: string }`
  - `export function describeAreaRemoval(plan: MatrixPlan, tasks: GanttTask[], areaId: string): AreaRemovalPreview`
  - `export function removeAreaWithTasks(plan: MatrixPlan, tasks: GanttTask[], areaId: string, policy: OrphanTaskPolicy): { matrixPlan: MatrixPlan; tasks: GanttTask[] }`

- [ ] **Step 1: Write the failing test**

```ts
import { describeAreaRemoval, removeAreaWithTasks } from "./removeArea";
import type { MatrixPlan } from "@/types/matrix";
import type { GanttTask } from "@/components/gantt/types";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [
      { id: "piso-1", name: "Piso 1", type: "Piso" },
      { id: "piso-2", name: "Piso 2", type: "Piso" },
    ],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        generatedTaskIds: ["mx-1", "mx-2"],
      },
      {
        id: "c2",
        scopeId: "estructura",
        areaId: "piso-2",
        recipeId: "r1",
        active: true,
        generatedTaskIds: ["mx-3"],
      },
    ],
  };
}

function matrixTask(id: string, areaId: string, cellId: string): GanttTask {
  return {
    id,
    name: `Columnas ${areaId}`,
    start: new Date("2026-03-02T08:00:00"),
    finish: new Date("2026-03-06T17:00:00"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 3,
    dependencies: [],
    matrixSource: {
      matrixPlanId: "p1",
      scopeId: "estructura",
      areaId,
      cellId,
      recipeId: "r1",
      activityId: "columnas",
    },
    matrixSync: { lastEditedAt: "2026-03-02T00:00:00.000Z", lastEditedFrom: "matrix" },
  };
}

const tareas: GanttTask[] = [
  matrixTask("mx-1", "piso-1", "c1"),
  matrixTask("mx-2", "piso-1", "c1"),
  matrixTask("mx-3", "piso-2", "c2"),
  { ...matrixTask("suelta", "piso-1", "c1"), matrixSource: undefined },
];

describe("describeAreaRemoval", () => {
  test("cuenta las celdas y las tareas que se llevaría por delante", () => {
    const preview = describeAreaRemoval(plan(), tareas, "piso-1");

    expect(preview.areaName).toBe("Piso 1");
    expect(preview.cellCount).toBe(1);
    expect(preview.taskIds).toEqual(["mx-1", "mx-2"]);
  });

  test("lo dice en lenguaje de obra", () => {
    expect(describeAreaRemoval(plan(), tareas, "piso-1").message).toBe(
      "«Piso 1» tiene 2 tareas ya generadas en el cronograma. Elige qué hacer con ellas antes de borrarla.",
    );
  });

  test("una ubicación sin tareas generadas lo dice también, sin alarmar", () => {
    const sinTareas = describeAreaRemoval(plan(), [], "piso-2");

    expect(sinTareas.taskIds).toEqual([]);
    expect(sinTareas.message).toBe(
      "«Piso 2» no tiene tareas en el cronograma. Se puede borrar sin más.",
    );
  });

  test("una ubicación que no existe no inventa un aviso", () => {
    expect(describeAreaRemoval(plan(), tareas, "fantasma").taskIds).toEqual([]);
  });
});

describe("removeAreaWithTasks", () => {
  test("borrar quita la ubicación, sus celdas y sus tareas", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "borrar");

    expect(result.matrixPlan.areas.map((area) => area.id)).toEqual(["piso-2"]);
    expect(result.matrixPlan.cells.map((cell) => cell.id)).toEqual(["c2"]);
    expect(result.tasks.map((task) => task.id)).toEqual(["mx-3", "suelta"]);
  });

  test("conservar deja las tareas en el cronograma, ya sin dueño en la matriz", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "conservar");

    expect(result.tasks.map((task) => task.id)).toEqual([
      "mx-1",
      "mx-2",
      "mx-3",
      "suelta",
    ]);
    const conservada = result.tasks.find((task) => task.id === "mx-1")!;
    expect(conservada.matrixSource).toBeUndefined();
    expect(conservada.matrixSync).toBeUndefined();
  });

  test("conservar no desengancha las tareas de las otras ubicaciones", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "conservar");

    expect(result.tasks.find((task) => task.id === "mx-3")?.matrixSource).toBeDefined();
  });

  test("no toca las tareas que nunca fueron de la matriz", () => {
    const result = removeAreaWithTasks(plan(), tareas, "piso-1", "borrar");

    expect(result.tasks.find((task) => task.id === "suelta")).toBeDefined();
  });

  test("borrar una ubicación que no existe devuelve todo igual", () => {
    const original = plan();
    const result = removeAreaWithTasks(original, tareas, "fantasma", "borrar");

    expect(result.matrixPlan.areas).toHaveLength(2);
    expect(result.tasks).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/matrix/removeArea.test.ts`
Expected: FAIL — `Cannot find module './removeArea' from 'src/lib/matrix/removeArea.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
import type { GanttTask } from "@/components/gantt/types";
import type { MatrixPlan } from "@/types/matrix";
import { getAreaLeaves, removeAreaNode } from "./tree";

/**
 * Qué hacer con las tareas que una ubicación ya había generado cuando se
 * borra esa ubicación.
 *
 * `removeAreaNode` quitaba el nodo y sus celdas y dejaba las tareas
 * huérfanas hasta la siguiente aplicación. En un producto donde la línea
 * constante es que nada se pierde en silencio, eso es un borrado a ciegas:
 * aquí se cuenta lo que hay y se ofrecen las dos salidas honestas.
 */
export type OrphanTaskPolicy = "borrar" | "conservar";

export interface AreaRemovalPreview {
  areaName: string;
  cellCount: number;
  taskIds: (string | number)[];
  message: string;
}

function areaTaskIds(tasks: GanttTask[], areaId: string): (string | number)[] {
  return tasks
    .filter((task) => task.matrixSource?.areaId === areaId)
    .map((task) => task.id);
}

export function describeAreaRemoval(
  plan: MatrixPlan,
  tasks: GanttTask[],
  areaId: string,
): AreaRemovalPreview {
  const area = getAreaLeaves(plan.areas).find((leaf) => leaf.node.id === areaId)?.node;
  const taskIds = area ? areaTaskIds(tasks, areaId) : [];
  const cellCount = plan.cells.filter((cell) => cell.areaId === areaId).length;
  const areaName = area?.name ?? areaId;

  return {
    areaName,
    cellCount,
    taskIds,
    message:
      taskIds.length === 0
        ? `«${areaName}» no tiene tareas en el cronograma. Se puede borrar sin más.`
        : `«${areaName}» tiene ${taskIds.length} tareas ya generadas en el cronograma. Elige qué hacer con ellas antes de borrarla.`,
  };
}

export function removeAreaWithTasks(
  plan: MatrixPlan,
  tasks: GanttTask[],
  areaId: string,
  policy: OrphanTaskPolicy,
): { matrixPlan: MatrixPlan; tasks: GanttTask[] } {
  const exists = getAreaLeaves(plan.areas).some((leaf) => leaf.node.id === areaId);
  if (!exists) return { matrixPlan: plan, tasks };

  const affected = new Set(areaTaskIds(tasks, areaId));

  const nextTasks =
    policy === "borrar"
      ? tasks.filter((task) => !affected.has(task.id))
      : tasks.map((task) =>
          affected.has(task.id)
            ? { ...task, matrixSource: undefined, matrixSync: undefined }
            : task,
        );

  return { matrixPlan: removeAreaNode(plan, areaId), tasks: nextTasks };
}
```

Nota: **esto no deshace nada por sí solo.** Hacer la acción reversible es cablearla con `runUndoable`, que
vive en `ProjectContext.tsx` — territorio del carril A — y por eso va en la Fase 3. Estas dos funciones son
puras a propósito: `runUndoable` recibe un antes y un después, y eso es exactamente lo que devuelven.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/matrix/removeArea.test.ts src/lib/matrix/tree.test.ts`
Expected: PASS (9 tests nuevos, más los de `tree` sin cambios)

- [ ] **Step 5: Commit**

```bash
git add src/lib/matrix/removeArea.ts src/lib/matrix/removeArea.test.ts
git commit -m "feat(matriz): borrar una ubicacion avisando de las tareas que ya genero"
```

---

# FASE 2 — El editor (tareas 18-25)

Todos los componentes nuevos viven en `src/components/matrix/`. **Ninguna tarea de esta fase toca
`GanttView.tsx` ni `ProjectContext.tsx`.** Cada componente recibe sus datos por props y avisa por
callbacks: quién los guarda es problema de la Fase 3.

Todos los tests de esta fase empiezan por la cabecera de entorno que usa el resto del proyecto:

```tsx
/**
 * @jest-environment jsdom
 */
```

## Task 18: Editor de recetas

**Files:**
- Create: `src/components/matrix/RecipeEditor.tsx`
- Test: `src/components/matrix/RecipeEditor.test.tsx`

**Interfaces:**
- Consumes: `addRecipeActivity`, `removeRecipeActivity`, `moveRecipeActivity`, `setRecipeDependency` de `@/lib/matrix/recipes`; `ActivityRecipe`.
- Produces: `export default function RecipeEditor(props: { recipe: ActivityRecipe; onChange: (recipe: ActivityRecipe) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import RecipeEditor from "./RecipeEditor";
import type { ActivityRecipe } from "@/types/matrix";

function receta(): ActivityRecipe {
  return {
    id: "r1",
    name: "Estructura",
    activities: [
      { id: "columnas", name: "Columnas", productivityPerDay: 2, unit: "un" },
      { id: "losa", name: "Losa", productivityPerDay: 1, unit: "m2" },
    ],
    dependencies: [
      { predecessorActivityId: "columnas", successorActivityId: "losa", type: "FS" },
    ],
  };
}

describe("RecipeEditor", () => {
  test("lista las actividades en su orden", () => {
    render(<RecipeEditor recipe={receta()} onChange={jest.fn()} />);

    const filas = screen.getAllByTestId(/^recipe-activity-/);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Columnas");
    expect(filas[1]).toHaveTextContent("Losa");
  });

  test("añadir una actividad avisa con la receta nueva", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Nombre de la actividad"), {
      target: { value: "Acero de refuerzo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nueva = onChange.mock.calls[0][0] as ActivityRecipe;
    expect(nueva.activities.map((item) => item.name)).toEqual([
      "Columnas",
      "Losa",
      "Acero de refuerzo",
    ]);
  });

  test("no deja agregar una actividad sin nombre", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escribe el nombre de la actividad antes de agregarla.",
    );
  });

  test("quitar una actividad avisa sin ella", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar Losa" }));

    const nueva = onChange.mock.calls[0][0] as ActivityRecipe;
    expect(nueva.activities.map((item) => item.id)).toEqual(["columnas"]);
    expect(nueva.dependencies).toHaveLength(0);
  });

  test("subir una actividad la reordena", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Subir Losa" }));

    const nueva = onChange.mock.calls[0][0] as ActivityRecipe;
    expect(nueva.activities.map((item) => item.id)).toEqual(["losa", "columnas"]);
  });

  test("un vínculo en círculo se rechaza con su motivo, sin cambiar la receta", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Actividad anterior"), {
      target: { value: "losa" },
    });
    fireEvent.change(screen.getByLabelText("Actividad siguiente"), {
      target: { value: "columnas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enlazar actividades" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "«Columnas» ya va antes que «Losa»",
    );
  });

  test("muestra los vínculos que ya tiene la receta", () => {
    render(<RecipeEditor recipe={receta()} onChange={jest.fn()} />);

    expect(screen.getByTestId("recipe-dependencies")).toHaveTextContent(
      "Columnas → Losa",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/matrix/RecipeEditor.test.tsx`
Expected: FAIL — `Cannot find module './RecipeEditor' from 'src/components/matrix/RecipeEditor.test.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { useState } from "react";
import type { ActivityRecipe } from "@/types/matrix";
import {
  addRecipeActivity,
  moveRecipeActivity,
  removeRecipeActivity,
  setRecipeDependency,
} from "@/lib/matrix/recipes";

interface RecipeEditorProps {
  recipe: ActivityRecipe;
  onChange: (recipe: ActivityRecipe) => void;
}

const inputClass =
  "rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm";

/**
 * Editor de la receta: qué actividades tiene, en qué orden y cómo se encadenan.
 *
 * Las reglas (quitar una actividad quita sus vínculos, un vínculo no puede
 * cerrar un círculo) viven en `lib/matrix/recipes.ts`. Aquí solo se enseñan
 * sus motivos.
 */
export default function RecipeEditor({ recipe, onChange }: RecipeEditorProps) {
  const [newName, setNewName] = useState("");
  const [predecessor, setPredecessor] = useState(recipe.activities[0]?.id ?? "");
  const [successor, setSuccessor] = useState(recipe.activities[1]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const nameOf = (id: string) =>
    recipe.activities.find((activity) => activity.id === id)?.name ?? id;

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("Escribe el nombre de la actividad antes de agregarla.");
      return;
    }
    setError(null);
    setNewName("");
    onChange(
      addRecipeActivity(recipe, {
        id: `actividad-${Date.now()}`,
        name: trimmed,
        productivityPerDay: 1,
      }),
    );
  };

  const handleLink = () => {
    const { recipe: next, rejectedReason } = setRecipeDependency(recipe, {
      predecessorActivityId: predecessor,
      successorActivityId: successor,
      type: "FS",
    });
    if (rejectedReason) {
      setError(rejectedReason);
      return;
    }
    setError(null);
    onChange(next);
  };

  return (
    <section className="apple-section space-y-3 p-3" data-testid="recipe-editor">
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
        Actividades de «{recipe.name}»
      </h3>

      <ol className="space-y-1">
        {recipe.activities.map((activity, index) => (
          <li
            key={activity.id}
            data-testid={`recipe-activity-${activity.id}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-hairline)] px-2 py-1 text-sm"
          >
            <span>
              {activity.name}
              <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                {activity.productivityPerDay} {activity.unit ?? "un"}/día
              </span>
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onChange(moveRecipeActivity(recipe, activity.id, index - 1))}
              >
                {`Subir ${activity.name}`}
              </button>
              <button
                type="button"
                disabled={index === recipe.activities.length - 1}
                onClick={() => onChange(moveRecipeActivity(recipe, activity.id, index + 1))}
              >
                {`Bajar ${activity.name}`}
              </button>
              <button
                type="button"
                onClick={() => onChange(removeRecipeActivity(recipe, activity.id))}
              >
                {`Quitar ${activity.name}`}
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Nombre de la actividad
          <input
            className={inputClass}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
        </label>
        <button type="button" onClick={handleAdd}>
          Agregar actividad
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Actividad anterior
          <select
            className={inputClass}
            value={predecessor}
            onChange={(event) => setPredecessor(event.target.value)}
          >
            {recipe.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs">
          Actividad siguiente
          <select
            className={inputClass}
            value={successor}
            onChange={(event) => setSuccessor(event.target.value)}
          >
            {recipe.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleLink}>
          Enlazar actividades
        </button>
      </div>

      <ul data-testid="recipe-dependencies" className="text-xs text-[var(--color-text-muted)]">
        {recipe.dependencies.map((rule) => (
          <li key={`${rule.predecessorActivityId}-${rule.successorActivityId}`}>
            {`${nameOf(rule.predecessorActivityId)} → ${nameOf(rule.successorActivityId)}`}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-xs text-[var(--color-text-strong)]">
          {error}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/matrix/RecipeEditor.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/matrix/RecipeEditor.tsx src/components/matrix/RecipeEditor.test.tsx
git commit -m "feat(matriz): editor de recetas con anadir, quitar, reordenar y encadenar"
```

---

## Task 19: Elegir plantilla o generar desde el cronograma

**Files:**
- Create: `src/components/matrix/TemplatePicker.tsx`
- Test: `src/components/matrix/TemplatePicker.test.tsx`

**Interfaces:**
- Consumes: `listFactoryTemplates` de `@/lib/matrix/templateCatalog`; `MatrixTemplate`.
- Produces: `export default function TemplatePicker(props: { ownTemplates?: MatrixTemplate[]; canGenerateFromSchedule: boolean; onPickTemplate: (template: MatrixTemplate) => void; onGenerateFromSchedule: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import TemplatePicker from "./TemplatePicker";
import { FACTORY_TEMPLATES } from "@/lib/matrix/templateCatalog";

describe("TemplatePicker", () => {
  test("lista las plantillas de fábrica", () => {
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    for (const template of FACTORY_TEMPLATES) {
      expect(screen.getByRole("button", { name: template.name })).toBeInTheDocument();
    }
  });

  test("elegir una plantilla la devuelve entera", () => {
    const onPickTemplate = jest.fn();
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={onPickTemplate}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: FACTORY_TEMPLATES[0].name }));

    expect(onPickTemplate).toHaveBeenCalledWith(FACTORY_TEMPLATES[0]);
  });

  test("las plantillas propias salen en su propia sección", () => {
    render(
      <TemplatePicker
        ownTemplates={[
          {
            id: "propia-1",
            name: "Mi torre tipo",
            scopeTree: [],
            areas: [],
            recipes: [],
          },
        ]}
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    expect(screen.getByTestId("template-picker-own")).toHaveTextContent("Mi torre tipo");
  });

  test("sin plantillas propias lo dice en vez de dejar el hueco vacío", () => {
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    expect(screen.getByTestId("template-picker-own")).toHaveTextContent(
      "Todavía no has guardado ninguna matriz como plantilla.",
    );
  });

  test("con un cronograma cargado ofrece generar la matriz desde él", () => {
    const onGenerateFromSchedule = jest.fn();
    render(
      <TemplatePicker
        canGenerateFromSchedule
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={onGenerateFromSchedule}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Generar matriz desde el cronograma" }),
    );

    expect(onGenerateFromSchedule).toHaveBeenCalledTimes(1);
  });

  test("sin cronograma cargado explica por qué no se puede generar", () => {
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Generar matriz desde el cronograma" }),
    ).toBeDisabled();
    expect(screen.getByTestId("template-picker-generate-hint")).toHaveTextContent(
      "Carga primero un cronograma para que la matriz proponga alcances y ubicaciones.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/matrix/TemplatePicker.test.tsx`
Expected: FAIL — `Cannot find module './TemplatePicker' from 'src/components/matrix/TemplatePicker.test.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import type { MatrixTemplate } from "@/types/matrix";
import { listFactoryTemplates } from "@/lib/matrix/templateCatalog";

interface TemplatePickerProps {
  ownTemplates?: MatrixTemplate[];
  canGenerateFromSchedule: boolean;
  onPickTemplate: (template: MatrixTemplate) => void;
  onGenerateFromSchedule: () => void;
}

export default function TemplatePicker({
  ownTemplates = [],
  canGenerateFromSchedule,
  onPickTemplate,
  onGenerateFromSchedule,
}: TemplatePickerProps) {
  const factory = listFactoryTemplates();

  return (
    <section className="apple-section space-y-4 p-3" data-testid="template-picker">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
          Plantillas por tipo de obra
        </h3>
        <ul className="mt-2 space-y-1">
          {factory.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-[var(--color-hairline)] px-3 py-2 text-left text-sm"
                onClick={() => onPickTemplate(template)}
              >
                {template.name}
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                {`${template.scopeTree.length} alcances · ${template.areas.length} ubicaciones · ${template.recipes.length} recetas`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="template-picker-own">
        <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
          Tus plantillas
        </h3>
        {ownTemplates.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            Todavía no has guardado ninguna matriz como plantilla.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {ownTemplates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-[var(--color-hairline)] px-3 py-2 text-left text-sm"
                  onClick={() => onPickTemplate(template)}
                >
                  {template.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          type="button"
          disabled={!canGenerateFromSchedule}
          onClick={onGenerateFromSchedule}
          className="w-full rounded-lg border border-[var(--color-hairline)] px-3 py-2 text-sm"
        >
          Generar matriz desde el cronograma
        </button>
        {!canGenerateFromSchedule && (
          <p
            data-testid="template-picker-generate-hint"
            className="text-xs text-[var(--color-text-muted)]"
          >
            Carga primero un cronograma para que la matriz proponga alcances y ubicaciones.
          </p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/matrix/TemplatePicker.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/matrix/TemplatePicker.tsx src/components/matrix/TemplatePicker.test.tsx
git commit -m "feat(matriz): elegir plantilla de fabrica, propia o generar desde el cronograma"
```

---

## Task 20: Revisar la propuesta antes de aceptarla

**Files:**
- Create: `src/components/matrix/ProposalReview.tsx`
- Test: `src/components/matrix/ProposalReview.test.tsx`

**Interfaces:**
- Consumes: `MatrixProposal`, `ProposalAcceptance` de `@/lib/matrix/matrixProposal`.
- Produces: `export default function ProposalReview(props: { proposal: MatrixProposal; onAccept: (acceptance: ProposalAcceptance) => void; onCancel: () => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ProposalReview from "./ProposalReview";
import type { MatrixProposal } from "@/lib/matrix/matrixProposal";

function propuesta(): MatrixProposal {
  return {
    locations: [
      {
        id: "piso-1",
        name: "Piso 1",
        type: "Piso",
        order: 1,
        taskCount: 2,
        evidence: "«Piso 1» aparece en 2 tareas del cronograma.",
      },
      {
        id: "piso-2",
        name: "Piso 2",
        type: "Piso",
        order: 2,
        taskCount: 2,
        evidence: "«Piso 2» aparece en 2 tareas del cronograma.",
      },
    ],
    scopes: [
      {
        id: "mamposteria",
        name: "Mampostería",
        locationIds: ["piso-1", "piso-2"],
        evidence: "«Mampostería» se programa en 2 ubicaciones.",
      },
    ],
    recipes: [
      {
        id: "receta-mamposteria",
        scopeId: "mamposteria",
        name: "Mampostería",
        activities: [
          {
            id: "actividad-mamposteria",
            name: "Mampostería",
            medianDurationDays: 5,
            observedIn: 3,
          },
        ],
        confidence: 0.3,
        evidence: "«Mampostería» aparece en 3 ubicaciones, con 5 días de mediana.",
      },
    ],
    skippedTaskCount: 1,
    summary: "Se proponen 2 ubicaciones, 1 alcances y 1 recetas a partir de 4 tareas.",
  };
}

describe("ProposalReview", () => {
  test("enseña el resumen de lo propuesto antes que nada", () => {
    render(
      <ProposalReview proposal={propuesta()} onAccept={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.getByTestId("proposal-summary")).toHaveTextContent(
      "Se proponen 2 ubicaciones",
    );
  });

  test("cada elemento propuesto muestra su evidencia", () => {
    render(
      <ProposalReview proposal={propuesta()} onAccept={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.getByText("«Piso 1» aparece en 2 tareas del cronograma.")).toBeInTheDocument();
    expect(
      screen.getByText("«Mampostería» aparece en 3 ubicaciones, con 5 días de mediana."),
    ).toBeInTheDocument();
  });

  test("todo llega aceptado, porque el usuario pidió generarlo", () => {
    const onAccept = jest.fn();
    render(
      <ProposalReview proposal={propuesta()} onAccept={onAccept} onCancel={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear la matriz" }));

    expect(onAccept).toHaveBeenCalledWith({
      locationIds: ["piso-1", "piso-2"],
      scopeIds: ["mamposteria"],
      recipeIds: ["receta-mamposteria"],
    });
  });

  test("descartar un elemento lo deja fuera de lo aceptado", () => {
    const onAccept = jest.fn();
    render(
      <ProposalReview proposal={propuesta()} onAccept={onAccept} onCancel={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Piso 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear la matriz" }));

    expect(onAccept).toHaveBeenCalledWith({
      locationIds: ["piso-1"],
      scopeIds: ["mamposteria"],
      recipeIds: ["receta-mamposteria"],
    });
  });

  test("una propuesta vacía lo dice y no ofrece crear nada", () => {
    render(
      <ProposalReview
        proposal={{
          locations: [],
          scopes: [],
          recipes: [],
          skippedTaskCount: 0,
          summary:
            "Este cronograma no repite ninguna actividad en tres o más ubicaciones, así que no hay recetas que proponer.",
        }}
        onAccept={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId("proposal-summary")).toHaveTextContent(
      "no repite ninguna actividad",
    );
    expect(screen.getByRole("button", { name: "Crear la matriz" })).toBeDisabled();
  });

  test("cancelar avisa sin construir nada", () => {
    const onCancel = jest.fn();
    render(
      <ProposalReview proposal={propuesta()} onAccept={jest.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Descartar la propuesta" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/matrix/ProposalReview.test.tsx`
Expected: FAIL — `Cannot find module './ProposalReview' from 'src/components/matrix/ProposalReview.test.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { useState } from "react";
import type { MatrixProposal, ProposalAcceptance } from "@/lib/matrix/matrixProposal";

interface ProposalReviewProps {
  proposal: MatrixProposal;
  onAccept: (acceptance: ProposalAcceptance) => void;
  onCancel: () => void;
}

/**
 * Revisión de la propuesta antes de que se construya nada.
 *
 * Todo llega marcado, porque el usuario pidió generarla; lo que se hace aquí
 * es poder quitar lo que no cuadre. Cada elemento enseña su evidencia para
 * que desmarcarlo sea una decisión informada.
 */
export default function ProposalReview({
  proposal,
  onAccept,
  onCancel,
}: ProposalReviewProps) {
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setRejected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const accepted = <T extends { id: string }>(items: T[]) =>
    items.filter((item) => !rejected.has(item.id)).map((item) => item.id);

  const isEmpty =
    proposal.locations.length === 0 &&
    proposal.scopes.length === 0 &&
    proposal.recipes.length === 0;

  const renderGroup = (
    title: string,
    items: Array<{ id: string; name: string; evidence: string }>,
    testId: string,
  ) => (
    <div data-testid={testId}>
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{title}</h3>
      <ul className="mt-1 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                aria-label={item.name}
                checked={!rejected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span>
                {item.name}
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {item.evidence}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="apple-section space-y-4 p-3" data-testid="proposal-review">
      <p data-testid="proposal-summary" className="text-sm">
        {proposal.summary}
      </p>

      {renderGroup("Ubicaciones", proposal.locations, "proposal-locations")}
      {renderGroup("Alcances", proposal.scopes, "proposal-scopes")}
      {renderGroup("Recetas", proposal.recipes, "proposal-recipes")}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isEmpty}
          onClick={() =>
            onAccept({
              locationIds: accepted(proposal.locations),
              scopeIds: accepted(proposal.scopes),
              recipeIds: accepted(proposal.recipes),
            })
          }
        >
          Crear la matriz
        </button>
        <button type="button" onClick={onCancel}>
          Descartar la propuesta
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/matrix/ProposalReview.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/matrix/ProposalReview.tsx src/components/matrix/ProposalReview.test.tsx
git commit -m "feat(matriz): revisar la propuesta elemento a elemento antes de crear la matriz"
```

---

## Task 21: Panel de rendimientos observados

**Files:**
- Create: `src/components/matrix/FeedbackPanel.tsx`
- Test: `src/components/matrix/FeedbackPanel.test.tsx`

**Interfaces:**
- Consumes: `listPendingFeedback` de `@/lib/matrix/feedback`; `MatrixPlan`.
- Produces: `export default function FeedbackPanel(props: { plan: MatrixPlan; onApprove: (cellId: string) => void; onDismiss: (cellId: string) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import FeedbackPanel from "./FeedbackPanel";
import type { MatrixPlan } from "@/types/matrix";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        productivityOverridePerDay: 4,
        feedback: {
          source: "gantt",
          observedDurationDays: 8,
          suggestedProductivityPerDay: 2.5,
          status: "pendingApproval",
        },
      },
    ],
  };
}

describe("FeedbackPanel", () => {
  test("nombra el alcance y la ubicación de cada observación", () => {
    render(<FeedbackPanel plan={plan()} onApprove={jest.fn()} onDismiss={jest.fn()} />);

    expect(screen.getByTestId("feedback-item-c1")).toHaveTextContent("Estructura · Piso 1");
  });

  test("enseña lo observado frente a lo planificado", () => {
    render(<FeedbackPanel plan={plan()} onApprove={jest.fn()} onDismiss={jest.fn()} />);

    expect(screen.getByTestId("feedback-item-c1")).toHaveTextContent(
      "En obra tardó 8 días. El rendimiento real es 2,5 por día, frente a 4 planificado.",
    );
  });

  test("aprobar avisa con la celda", () => {
    const onApprove = jest.fn();
    render(<FeedbackPanel plan={plan()} onApprove={onApprove} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Usar el rendimiento real" }));

    expect(onApprove).toHaveBeenCalledWith("c1");
  });

  test("descartar avisa con la celda", () => {
    const onDismiss = jest.fn();
    render(<FeedbackPanel plan={plan()} onApprove={jest.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Mantener lo planificado" }));

    expect(onDismiss).toHaveBeenCalledWith("c1");
  });

  test("sin observaciones explica qué hace falta para que aparezcan", () => {
    render(
      <FeedbackPanel
        plan={{ ...plan(), cells: [] }}
        onApprove={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByTestId("feedback-empty")).toHaveTextContent(
      "Aún no hay rendimientos observados. Aparecerán cuando se reporte avance real sobre las tareas que generó la matriz.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/matrix/FeedbackPanel.test.tsx`
Expected: FAIL — `Cannot find module './FeedbackPanel' from 'src/components/matrix/FeedbackPanel.test.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import type { MatrixPlan } from "@/types/matrix";
import { listPendingFeedback } from "@/lib/matrix/feedback";
import { getAreaLeaves, getScopeLeaves } from "@/lib/matrix/tree";

interface FeedbackPanelProps {
  plan: MatrixPlan;
  onApprove: (cellId: string) => void;
  onDismiss: (cellId: string) => void;
}

/**
 * Los rendimientos que la obra sacó de verdad, esperando visto bueno.
 *
 * La app ya los calculaba y nadie los veía. Aprobar uno cierra el ciclo: la
 * próxima torre se programa con los datos de la anterior.
 */
export default function FeedbackPanel({
  plan,
  onApprove,
  onDismiss,
}: FeedbackPanelProps) {
  const pending = listPendingFeedback(plan);
  const scopeName = new Map(
    getScopeLeaves(plan.scopeTree).map((leaf) => [leaf.node.id, leaf.node.name]),
  );
  const areaName = new Map(
    getAreaLeaves(plan.areas).map((leaf) => [leaf.node.id, leaf.node.name]),
  );

  if (pending.length === 0) {
    return (
      <section className="apple-section p-3" data-testid="feedback-panel">
        <p data-testid="feedback-empty" className="text-sm text-[var(--color-text-muted)]">
          Aún no hay rendimientos observados. Aparecerán cuando se reporte avance real
          sobre las tareas que generó la matriz.
        </p>
      </section>
    );
  }

  return (
    <section className="apple-section space-y-2 p-3" data-testid="feedback-panel">
      <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
        Rendimientos observados en obra
      </h3>
      <ul className="space-y-2">
        {pending.map((item) => (
          <li
            key={item.cellId}
            data-testid={`feedback-item-${item.cellId}`}
            className="rounded-lg border border-[var(--color-hairline)] p-2 text-sm"
          >
            <p className="font-semibold text-[var(--color-text-strong)]">
              {`${scopeName.get(item.scopeId) ?? item.scopeId} · ${areaName.get(item.areaId) ?? item.areaId}`}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{item.message}</p>
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => onApprove(item.cellId)}>
                Usar el rendimiento real
              </button>
              <button type="button" onClick={() => onDismiss(item.cellId)}>
                Mantener lo planificado
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/matrix/FeedbackPanel.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/matrix/FeedbackPanel.tsx src/components/matrix/FeedbackPanel.test.tsx
git commit -m "feat(matriz): panel para aprobar los rendimientos observados en obra"
```

---

## Task 22: Elegir qué gana en cada conflicto

**Files:**
- Create: `src/components/matrix/ConflictChooser.tsx`
- Test: `src/components/matrix/ConflictChooser.test.tsx`

**Interfaces:**
- Consumes: `MatrixSyncConflict`, `ConflictResolution` de `@/types/matrix`.
- Produces: `export default function ConflictChooser(props: { conflicts: MatrixSyncConflict[]; onResolve: (resolutions: Record<string, ConflictResolution>) => void; onCancel: () => void }): JSX.Element | null`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ConflictChooser from "./ConflictChooser";
import type { MatrixSyncConflict } from "@/types/matrix";

const conflictos: MatrixSyncConflict[] = [
  {
    taskId: "mx-task-c1-columnas",
    cellId: "c1",
    field: "name",
    matrixValue: "Columnas · Piso 1",
    ganttValue: "Columnas piso 1 (revisadas)",
    message: "«Columnas · Piso 1» se renombró a «Columnas piso 1 (revisadas)» desde el Gantt.",
  },
  {
    taskId: "mx-task-c1-columnas",
    cellId: "c1",
    field: "duration",
    matrixValue: "5",
    ganttValue: "8",
    message: "La duración pasó de 5 a 8 días desde el Gantt.",
  },
];

describe("ConflictChooser", () => {
  test("sin conflictos no dibuja nada", () => {
    const { container } = render(
      <ConflictChooser conflicts={[]} onResolve={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("muestra las dos versiones de cada conflicto", () => {
    render(
      <ConflictChooser conflicts={conflictos} onResolve={jest.fn()} onCancel={jest.fn()} />,
    );

    const fila = screen.getByTestId("conflict-mx-task-c1-columnas-name");
    expect(fila).toHaveTextContent("Columnas · Piso 1");
    expect(fila).toHaveTextContent("Columnas piso 1 (revisadas)");
  });

  test("por defecto gana la matriz, y lo dice", () => {
    const onResolve = jest.fn();
    render(
      <ConflictChooser conflicts={conflictos} onResolve={onResolve} onCancel={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    expect(onResolve).toHaveBeenCalledWith({
      "mx-task-c1-columnas::name": "matriz",
      "mx-task-c1-columnas::duration": "matriz",
    });
  });

  test("elegir el Gantt en un conflicto solo cambia ese", () => {
    const onResolve = jest.fn();
    render(
      <ConflictChooser conflicts={conflictos} onResolve={onResolve} onCancel={jest.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: "Conservar lo del Gantt en el nombre" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar con estas decisiones" }));

    expect(onResolve).toHaveBeenCalledWith({
      "mx-task-c1-columnas::name": "gantt",
      "mx-task-c1-columnas::duration": "matriz",
    });
  });

  test("dice cuántos conflictos hay antes de pedir decidir", () => {
    render(
      <ConflictChooser conflicts={conflictos} onResolve={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.getByTestId("conflict-summary")).toHaveTextContent(
      "2 cambios hechos en el Gantt chocan con la matriz. Elige cuál gana en cada uno.",
    );
  });

  test("cancelar no aplica nada", () => {
    const onCancel = jest.fn();
    const onResolve = jest.fn();
    render(
      <ConflictChooser conflicts={conflictos} onResolve={onResolve} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "No aplicar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onResolve).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/matrix/ConflictChooser.test.tsx`
Expected: FAIL — `Cannot find module './ConflictChooser' from 'src/components/matrix/ConflictChooser.test.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { useState } from "react";
import type { ConflictResolution, MatrixSyncConflict } from "@/types/matrix";

interface ConflictChooserProps {
  conflicts: MatrixSyncConflict[];
  onResolve: (resolutions: Record<string, ConflictResolution>) => void;
  onCancel: () => void;
}

const FIELD_LABEL: Record<MatrixSyncConflict["field"], string> = {
  name: "el nombre",
  duration: "la duración",
  start: "el inicio",
  finish: "el fin",
};

/**
 * Qué gana cuando la matriz y el Gantt dicen cosas distintas.
 *
 * Antes se resolvía en silencio con «gana el más reciente» y el usuario se
 * enteraba al ver el cronograma cambiado. Aquí se decide tarea por tarea, con
 * las dos versiones delante.
 */
export default function ConflictChooser({
  conflicts,
  onResolve,
  onCancel,
}: ConflictChooserProps) {
  const keyOf = (conflict: MatrixSyncConflict) =>
    `${conflict.taskId}::${conflict.field}`;

  const [choices, setChoices] = useState<Record<string, ConflictResolution>>(() =>
    Object.fromEntries(
      conflicts.map((conflict) => [keyOf(conflict), "matriz" as ConflictResolution]),
    ),
  );

  if (conflicts.length === 0) return null;

  return (
    <section className="apple-section space-y-3 p-3" data-testid="conflict-chooser">
      <p data-testid="conflict-summary" className="text-sm">
        {`${conflicts.length} cambios hechos en el Gantt chocan con la matriz. Elige cuál gana en cada uno.`}
      </p>

      <ul className="space-y-2">
        {conflicts.map((conflict) => {
          const key = keyOf(conflict);
          const label = FIELD_LABEL[conflict.field];
          return (
            <li
              key={key}
              data-testid={`conflict-${conflict.taskId}-${conflict.field}`}
              className="rounded-lg border border-[var(--color-hairline)] p-2 text-sm"
            >
              <p className="text-xs text-[var(--color-text-muted)]">{conflict.message}</p>
              <label className="mt-1 flex items-center gap-2">
                <input
                  type="radio"
                  name={key}
                  aria-label={`Usar lo de la matriz en ${label}`}
                  checked={choices[key] === "matriz"}
                  onChange={() => setChoices({ ...choices, [key]: "matriz" })}
                />
                <span>{`Matriz: ${conflict.matrixValue}`}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={key}
                  aria-label={`Conservar lo del Gantt en ${label}`}
                  checked={choices[key] === "gantt"}
                  onChange={() => setChoices({ ...choices, [key]: "gantt" })}
                />
                <span>{`Gantt: ${conflict.ganttValue}`}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <button type="button" onClick={() => onResolve(choices)}>
          Aplicar con estas decisiones
        </button>
        <button type="button" onClick={onCancel}>
          No aplicar
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/matrix/ConflictChooser.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/matrix/ConflictChooser.tsx src/components/matrix/ConflictChooser.test.tsx
git commit -m "feat(matriz): elegir que gana en cada conflicto entre matriz y Gantt"
```

---

## Task 23: Duplicar y crear N ubicaciones desde la interfaz

**Files:**
- Create: `src/components/matrix/LocationBulkActions.tsx`
- Test: `src/components/matrix/LocationBulkActions.test.tsx`

**Interfaces:**
- Consumes: nada del motor: recibe callbacks.
- Produces: `export default function LocationBulkActions(props: { locations: Array<{ id: string; name: string }>; onDuplicate: (areaId: string) => void; onCreateRange: (input: { pattern: string; from: number; to: number; type: string }) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import LocationBulkActions from "./LocationBulkActions";

const ubicaciones = [
  { id: "piso-1", name: "Piso 1" },
  { id: "piso-2", name: "Piso 2" },
];

describe("LocationBulkActions", () => {
  test("duplicar avisa con la ubicación elegida", () => {
    const onDuplicate = jest.fn();
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={onDuplicate}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Ubicación a duplicar"), {
      target: { value: "piso-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duplicar ubicación" }));

    expect(onDuplicate).toHaveBeenCalledWith("piso-2");
  });

  test("crear un rango envía el patrón y los números", () => {
    const onCreateRange = jest.fn();
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={onCreateRange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre, con {n} donde va el número"), {
      target: { value: "Piso {n}" },
    });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear ubicaciones" }));

    expect(onCreateRange).toHaveBeenCalledWith({
      pattern: "Piso {n}",
      from: 3,
      to: 20,
      type: "Piso",
    });
  });

  test("anuncia cuántas se van a crear antes de pulsar", () => {
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "20" } });

    expect(screen.getByTestId("range-preview")).toHaveTextContent(
      "Se crearán 20 ubicaciones.",
    );
  });

  test("un rango descendente también se anuncia bien", () => {
    render(
      <LocationBulkActions
        locations={ubicaciones}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "1" } });

    expect(screen.getByTestId("range-preview")).toHaveTextContent(
      "Se crearán 3 ubicaciones.",
    );
  });

  test("sin ubicaciones no se puede duplicar", () => {
    render(
      <LocationBulkActions
        locations={[]}
        onDuplicate={jest.fn()}
        onCreateRange={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Duplicar ubicación" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/matrix/LocationBulkActions.test.tsx`
Expected: FAIL — `Cannot find module './LocationBulkActions' from 'src/components/matrix/LocationBulkActions.test.tsx'`

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { useState } from "react";

interface LocationBulkActionsProps {
  locations: Array<{ id: string; name: string }>;
  onDuplicate: (areaId: string) => void;
  onCreateRange: (input: {
    pattern: string;
    from: number;
    to: number;
    type: string;
  }) => void;
}

const inputClass =
  "rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm";

export default function LocationBulkActions({
  locations,
  onDuplicate,
  onCreateRange,
}: LocationBulkActionsProps) {
  const [selected, setSelected] = useState(locations[0]?.id ?? "");
  const [pattern, setPattern] = useState("Piso {n}");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [type, setType] = useState("Piso");

  const count = Math.abs(to - from) + 1;

  return (
    <section className="apple-section space-y-3 p-3" data-testid="location-bulk-actions">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          Ubicación a duplicar
          <select
            className={inputClass}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={locations.length === 0}
          onClick={() => onDuplicate(selected)}
        >
          Duplicar ubicación
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs">
          {"Nombre, con {n} donde va el número"}
          <input
            className={inputClass}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
        </label>
        <label className="flex flex-col text-xs">
          Desde
          <input
            className={inputClass}
            type="number"
            value={from}
            onChange={(event) => setFrom(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col text-xs">
          Hasta
          <input
            className={inputClass}
            type="number"
            value={to}
            onChange={(event) => setTo(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col text-xs">
          Tipo
          <input
            className={inputClass}
            value={type}
            onChange={(event) => setType(event.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => onCreateRange({ pattern, from, to, type })}
        >
          Crear ubicaciones
        </button>
      </div>

      <p data-testid="range-preview" className="text-xs text-[var(--color-text-muted)]">
        {`Se crearán ${count} ubicaciones.`}
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/matrix/LocationBulkActions.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/matrix/LocationBulkActions.tsx src/components/matrix/LocationBulkActions.test.tsx
git commit -m "feat(matriz): duplicar ubicaciones y crear un rango desde la interfaz"
```

---

## Task 24: Selección de varias celdas y edición en lote

**Files:**
- Modify: `src/components/views/MatrixEditorView.tsx:261-300` (estado) y `:1039-1084` (la celda de la tabla)
- Modify: `src/components/views/MatrixEditorView.test.tsx` (añadir un `describe`; crear el archivo si no existe)

**Interfaces:**
- Consumes: `applyBulkCellEdit`, `type CellTarget` de `@/lib/matrix/bulk`.
- Produces: `MatrixEditorView` gana estado interno `selection: CellTarget[]` y un panel `data-testid="matrix-bulk-panel"`. Sus props no cambian.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import MatrixEditorView from "./MatrixEditorView";
import { createDefaultMatrixPlan } from "@/lib/matrix/templates";

function renderEditor() {
  const onApplyMatrixPlan = jest.fn();
  const plan = createDefaultMatrixPlan({
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
  });
  render(
    <MatrixEditorView
      matrixPlan={plan}
      tasks={[]}
      onApplyMatrixPlan={onApplyMatrixPlan}
      onSyncFromGantt={jest.fn()}
    />,
  );
  return { plan, onApplyMatrixPlan };
}

describe("MatrixEditorView · selección de varias celdas", () => {
  test("sin selección múltiple no aparece el panel de lote", () => {
    renderEditor();

    expect(screen.queryByTestId("matrix-bulk-panel")).not.toBeInTheDocument();
  });

  test("marcar dos celdas abre el panel de lote con el recuento", () => {
    const { plan } = renderEditor();
    const [primera, segunda] = plan.cells;

    fireEvent.click(screen.getByTestId(`matrix-cell-select-${primera.id}`));
    fireEvent.click(screen.getByTestId(`matrix-cell-select-${segunda.id}`));

    expect(screen.getByTestId("matrix-bulk-panel")).toHaveTextContent(
      "2 celdas seleccionadas",
    );
  });

  test("seleccionar una fila entera marca todas sus celdas", () => {
    const { plan } = renderEditor();
    const scopeId = plan.scopeTree[0].children![0].id;

    fireEvent.click(screen.getByTestId(`matrix-select-row-${scopeId}`));

    const enLaFila = plan.cells.filter((cell) => cell.scopeId === scopeId).length;
    expect(screen.getByTestId("matrix-bulk-panel")).toHaveTextContent(
      `${enLaFila} celdas seleccionadas`,
    );
  });

  test("desactivar en lote aplica el cambio a las celdas marcadas", () => {
    const { plan, onApplyMatrixPlan } = renderEditor();
    const [primera, segunda] = plan.cells;

    fireEvent.click(screen.getByTestId(`matrix-cell-select-${primera.id}`));
    fireEvent.click(screen.getByTestId(`matrix-cell-select-${segunda.id}`));
    fireEvent.click(screen.getByRole("button", { name: "Desactivar las seleccionadas" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    const aplicado = onApplyMatrixPlan.mock.calls.at(-1)![0];
    expect(aplicado.cells.find((cell: { id: string }) => cell.id === primera.id).active).toBe(
      false,
    );
    expect(aplicado.cells.find((cell: { id: string }) => cell.id === segunda.id).active).toBe(
      false,
    );
  });

  test("limpiar la selección cierra el panel", () => {
    const { plan } = renderEditor();

    fireEvent.click(screen.getByTestId(`matrix-cell-select-${plan.cells[0].id}`));
    fireEvent.click(screen.getByRole("button", { name: "Quitar la selección" }));

    expect(screen.queryByTestId("matrix-bulk-panel")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/MatrixEditorView.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="matrix-cell-select-cell-estructura-torre-a-piso-1"]` (o el identificador que genere la plantilla): las casillas de selección todavía no existen.

- [ ] **Step 3: Write minimal implementation**

En `src/components/views/MatrixEditorView.tsx`:

**a)** Importar y añadir estado, junto a los `useState` que ya hay (línea ~272):

```tsx
import { applyBulkCellEdit, type CellTarget } from "@/lib/matrix/bulk";
```

```tsx
  const [selection, setSelection] = useState<CellTarget[]>([]);

  const isSelected = (scopeId: string, areaId: string) =>
    selection.some((target) => target.scopeId === scopeId && target.areaId === areaId);

  const toggleSelection = (scopeId: string, areaId: string) =>
    setSelection((current) =>
      isSelected(scopeId, areaId)
        ? current.filter(
            (target) => !(target.scopeId === scopeId && target.areaId === areaId),
          )
        : [...current, { scopeId, areaId }],
    );

  const selectRow = (scopeId: string) =>
    setSelection(areas.map((area) => ({ scopeId, areaId: area.id })));

  const selectColumn = (areaId: string) =>
    setSelection(scopes.map((scope) => ({ scopeId: scope.id, areaId })));

  const applyToSelection = (patch: Parameters<typeof applyBulkCellEdit>[2]) => {
    setDraft((current) =>
      current
        ? applyBulkCellEdit(current, selection, patch, new Date().toISOString())
        : current,
    );
  };
```

**b)** En el encabezado de fila (el `<th>` de cada alcance), junto al botón del nombre:

```tsx
                    <button
                      type="button"
                      data-testid={`matrix-select-row-${scope.id}`}
                      onClick={() => selectRow(scope.id)}
                      className="ml-2 text-xs text-[var(--color-text-muted)]"
                    >
                      Seleccionar fila
                    </button>
```

y el equivalente en el `<th>` de cada ubicación con `data-testid={`matrix-select-column-${area.id}`}`
llamando a `selectColumn(area.id)` con la etiqueta «Seleccionar columna».

**c)** Dentro del `<td>` de cada celda, antes del botón existente:

```tsx
                        {cell && (
                          <input
                            type="checkbox"
                            data-testid={`matrix-cell-select-${cell.id}`}
                            aria-label={`Seleccionar ${scope.name} en ${area.name}`}
                            checked={isSelected(scope.id, area.id)}
                            onChange={() => toggleSelection(scope.id, area.id)}
                          />
                        )}
```

**d)** Encima de la tabla, el panel de lote:

```tsx
        {selection.length > 0 && (
          <div
            data-testid="matrix-bulk-panel"
            className="apple-section flex flex-wrap items-center gap-2 p-2 text-sm"
          >
            <span>{`${selection.length} celdas seleccionadas`}</span>
            <button type="button" onClick={() => applyToSelection({ active: true })}>
              Activar las seleccionadas
            </button>
            <button type="button" onClick={() => applyToSelection({ active: false })}>
              Desactivar las seleccionadas
            </button>
            <label className="flex items-center gap-1 text-xs">
              Cantidad
              <input
                type="number"
                className={matrixInputClass}
                onBlur={(event) =>
                  applyToSelection({ quantity: Number(event.target.value) })
                }
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              Receta
              <select
                className={matrixInputClass}
                defaultValue=""
                onChange={(event) =>
                  event.target.value && applyToSelection({ recipeId: event.target.value })
                }
              >
                <option value="">Sin cambiar</option>
                {draft?.recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setSelection([])}>
              Quitar la selección
            </button>
          </div>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/MatrixEditorView.test.tsx`
Expected: PASS — los tests que ya existieran más los 5 nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/MatrixEditorView.tsx src/components/views/MatrixEditorView.test.tsx
git commit -m "feat(matriz): seleccionar varias celdas, filas o columnas y editarlas en lote"
```

---

## Task 25: Que aguante más de 1000 celdas

**Files:**
- Modify: `src/components/views/MatrixEditorView.tsx:294-300` (memorias) y el cuerpo de la tabla
- Modify: `src/components/views/MatrixEditorView.test.tsx` (añadir un `describe`)

**Interfaces:**
- Consumes: `createMatrixCache` de `@/lib/matrix/matrixCache`.
- Produces: `MatrixEditorView` gana `MATRIX_VISIBLE_ROWS` (exportada para el test) y un resumen precalculado por celda. Sus props no cambian.

- [ ] **Step 1: Write the failing test**

Añadir al final de `src/components/views/MatrixEditorView.test.tsx`:

```tsx
import MatrixEditorViewDefault, { MATRIX_VISIBLE_ROWS } from "./MatrixEditorView";
import type { MatrixPlan } from "@/types/matrix";

function planGrande(): MatrixPlan {
  const scopeTree = Array.from({ length: 30 }, (_, index) => ({
    id: `alcance-${index}`,
    name: `Alcance ${index + 1}`,
    type: "Disciplina",
    defaultRecipeId: "r1",
  }));
  const areas = Array.from({ length: 40 }, (_, index) => ({
    id: `ubicacion-${index}`,
    name: `Piso ${index + 1}`,
    type: "Piso",
  }));

  return {
    id: "grande",
    name: "Torre grande",
    startDate: "2026-03-02",
    scopeTree,
    areas,
    recipes: [
      {
        id: "r1",
        name: "Receta",
        activities: [
          { id: "a1", name: "Actividad", productivityPerDay: 1, defaultQuantity: 2 },
        ],
        dependencies: [],
      },
    ],
    cells: scopeTree.flatMap((scope) =>
      areas.map((area) => ({
        id: `cell-${scope.id}-${area.id}`,
        scopeId: scope.id,
        areaId: area.id,
        recipeId: "r1",
        active: true,
        quantity: 2,
      })),
    ),
  };
}

describe("MatrixEditorView · escala", () => {
  test("el plan de prueba tiene más de 1000 celdas", () => {
    expect(planGrande().cells).toHaveLength(1200);
  });

  test("no monta las 1200 celdas de golpe", () => {
    render(
      <MatrixEditorViewDefault
        matrixPlan={planGrande()}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(screen.getAllByTestId(/^matrix-cell-select-/).length).toBeLessThanOrEqual(
      MATRIX_VISIBLE_ROWS * 40,
    );
    expect(screen.getAllByTestId(/^matrix-cell-select-/).length).toBeLessThan(1200);
  });

  test("anuncia cuántas filas se están viendo de cuántas", () => {
    render(
      <MatrixEditorViewDefault
        matrixPlan={planGrande()}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(screen.getByTestId("matrix-window-status")).toHaveTextContent(
      `Mostrando ${MATRIX_VISIBLE_ROWS} de 30 alcances.`,
    );
  });

  test("se puede avanzar a las filas siguientes", () => {
    render(
      <MatrixEditorViewDefault
        matrixPlan={planGrande()}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );

    expect(screen.getByText("Alcance 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver los siguientes alcances" }));

    expect(screen.queryByText("Alcance 1")).not.toBeInTheDocument();
    expect(
      screen.getByText(`Alcance ${MATRIX_VISIBLE_ROWS + 1}`),
    ).toBeInTheDocument();
  });

  test("una matriz pequeña no muestra los controles de ventana", () => {
    const { plan } = renderEditor();

    expect(plan.cells.length).toBeLessThan(MATRIX_VISIBLE_ROWS * 40);
    expect(screen.queryByTestId("matrix-window-status")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/views/MatrixEditorView.test.tsx`
Expected: FAIL — `MATRIX_VISIBLE_ROWS` sale `undefined` y el segundo test encuentra las 1200 casillas montadas.

- [ ] **Step 3: Write minimal implementation**

En `src/components/views/MatrixEditorView.tsx`:

**a)** Exportar el tamaño de ventana y llevar el desplazamiento en estado:

```tsx
/**
 * Cuántos alcances se dibujan a la vez.
 *
 * La matriz llega a 30 × 40 = 1200 celdas, y montarlas todas hace que cada
 * tecla repinte 1200 nodos. Se dibujan las filas que caben y se avanza por
 * páginas: la matriz sigue completa en el dato, solo se muestra por partes.
 */
export const MATRIX_VISIBLE_ROWS = 12;
```

```tsx
  const [rowOffset, setRowOffset] = useState(0);
  const needsWindow = scopes.length > MATRIX_VISIBLE_ROWS;
  const visibleScopes = needsWindow
    ? scopes.slice(rowOffset, rowOffset + MATRIX_VISIBLE_ROWS)
    : scopes;
```

**b)** Precalcular el resumen de cada celda una sola vez, en vez de recorrer la receta dentro del dibujo:

```tsx
  const cellSummaries = useMemo(() => {
    const summaries = new Map<
      string,
      { recipeName: string; activityCount: number; totalDuration: number; quantitySummary: string }
    >();
    if (!draft) return summaries;

    for (const cell of draft.cells) {
      const recipe = getRecipe(draft, cell);
      const overrides =
        recipe?.activities.map((activity) => getOverride(cell, activity)) ?? [];
      summaries.set(cellKey(cell.scopeId, cell.areaId), {
        recipeName: recipe?.name ?? "Sin receta",
        activityCount: overrides.length,
        totalDuration: overrides.reduce(
          (sum, override) => sum + durationDays(override),
          0,
        ),
        quantitySummary: formatQuantitySummary(overrides),
      });
    }
    return summaries;
  }, [draft]);
```

**c)** Cambiar `scopes.map(...)` del `<tbody>` por `visibleScopes.map(...)`, y dentro del `<td>` usar el
resumen precalculado en vez de recalcularlo:

```tsx
                    const summary = cellSummaries.get(cellKey(scope.id, area.id));
```

sustituyendo las cuatro constantes `recipe`, `overrides`, `totalDuration` y `quantitySummary` por
`summary?.recipeName`, `summary?.activityCount ?? 0`, `summary?.totalDuration ?? 0` y
`summary?.quantitySummary ?? ""`.

**d)** Bajo la tabla, los controles de ventana:

```tsx
          {needsWindow && (
            <div className="flex items-center gap-2 p-2 text-xs">
              <span data-testid="matrix-window-status">
                {`Mostrando ${visibleScopes.length} de ${scopes.length} alcances.`}
              </span>
              <button
                type="button"
                disabled={rowOffset === 0}
                onClick={() =>
                  setRowOffset(Math.max(0, rowOffset - MATRIX_VISIBLE_ROWS))
                }
              >
                Ver los alcances anteriores
              </button>
              <button
                type="button"
                disabled={rowOffset + MATRIX_VISIBLE_ROWS >= scopes.length}
                onClick={() => setRowOffset(rowOffset + MATRIX_VISIBLE_ROWS)}
              >
                Ver los siguientes alcances
              </button>
            </div>
          )}
```

**e)** Reemplazar la vista previa por una que use la caché, para que editar una celda no regenere las 1200:

```tsx
  const previewCache = useMemo(() => createMatrixCache(), []);
  const preview = useMemo(
    () => (draft ? generateScheduleFromMatrix(draft, { cache: previewCache }) : undefined),
    [draft, previewCache],
  );
```

con `import { createMatrixCache } from "@/lib/matrix/matrixCache";` arriba.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/views/MatrixEditorView.test.tsx`
Expected: PASS — todo lo anterior más los 5 nuevos.

- [ ] **Step 5: Verificación de la Fase 2**

```bash
npx jest --runInBand
npx eslint src/lib/matrix src/components/matrix src/components/views/MatrixEditorView.tsx src/types/matrix.ts
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
npx next build
```
Expected: suite en verde, lint sin errores, filtro de tipos **vacío**, build correcto.

- [ ] **Step 6: Comprobación en el navegador**

Desde la raíz del repositorio:

```bash
docker compose up -d --build frontend
```

Abrir `http://localhost:3000`, entrar a un proyecto y abrir la matriz con `⌘K` → «Matriz». Comprobar:

1. El editor de recetas añade, quita y reordena actividades, y **rechaza** un vínculo en círculo con su motivo.
2. «Crear ubicaciones» con «Piso {n}» de 1 a 20 crea las 20 con sus celdas.
3. Seleccionar una fila entera y desactivarla apaga toda la fila.
4. Con más de 12 alcances aparecen los controles «Ver los siguientes alcances» y la matriz responde al escribir.

- [ ] **Step 7: Commit**

```bash
git add src/components/views/MatrixEditorView.tsx src/components/views/MatrixEditorView.test.tsx
git commit -m "perf(matriz): dibujar por ventana y precalcular el resumen de cada celda"
```

---

# FASE 3 — Integración · **BLOQUEADA POR EL CARRIL A**

> ⛔ **No empezar esta fase hasta que el carril A (P1 → P2) haya fusionado su trabajo a `main`.**
>
> Es la única parte de este proyecto que toca `src/components/views/GanttView.tsx` (1.889 líneas, 15 vistas)
> y `src/lib/state/ProjectContext.tsx`, que el goal maestro asigna al carril A. Tocarlos antes garantiza un
> conflicto en cada tarea.
>
> **Antes de empezar:** `git fetch origin && git rebase origin/main`, y comprobar que `git log origin/main`
> incluye los proyectos P1 y P2. Si no están, esta fase espera. Las Fases 1 y 2 se pueden fusionar sin ella:
> la matriz queda completa y se llega por `⌘K`, como hoy.

## Task 26: Cablear la matriz en la aplicación

**Files:**
- Modify: `src/components/gantt/toolbar/ViewSidebar.tsx` (array `VIEW_TABS`, grupo «Trabajo»)
- Modify: `src/components/views/GanttView.tsx:251` (estado), `:293-294` (sincronización), `:791-819` (aplicar la matriz), `:1782-1790` (el montaje de `MatrixEditorView`)
- Modify: `src/lib/state/ProjectContext.tsx` (persistir el diccionario de detección junto al plan)
- Modify: `src/components/gantt/toolbar/ViewSidebar.test.tsx` y `src/components/views/GanttView.test.tsx`

**Interfaces:**
- Consumes: `describeAreaRemoval` y `removeAreaWithTasks` de `@/lib/matrix/removeArea`; `describeDraftChanges` de `@/lib/matrix/draftState`; `describeCalendarShift` de `@/lib/matrix/matrixCalendarShift`; `ConflictChooser` de `@/components/matrix/ConflictChooser`; `applyMatrixUpdate` con `resolutions`.
- Produces: `MatrixEditorView` recibe dos props nuevas: `calendar?: ProjectCalendar` y `onUnappliedChangesChange?: (changes: DraftChanges) => void`.

- [ ] **Step 1: Write the failing test**

En `src/components/gantt/toolbar/ViewSidebar.test.tsx`:

```tsx
describe("ViewSidebar · la matriz vuelve al menú (M27)", () => {
  test("la matriz aparece en el grupo Trabajo", () => {
    render(<ViewSidebar activeView="gantt" onChangeView={jest.fn()} />);

    const matriz = screen.getByRole("button", { name: /matriz/i });
    expect(matriz).toBeInTheDocument();
    expect(matriz.closest("[data-view-group]")).toHaveAttribute(
      "data-view-group",
      "trabajo",
    );
  });

  test("pulsarla cambia de vista", () => {
    const onChangeView = jest.fn();
    render(<ViewSidebar activeView="gantt" onChangeView={onChangeView} />);

    fireEvent.click(screen.getByRole("button", { name: /matriz/i }));

    expect(onChangeView).toHaveBeenCalledWith("matriz");
  });
});
```

En `src/components/views/GanttView.test.tsx`:

```tsx
describe("GanttView · la matriz avisa antes de salir (M28)", () => {
  test("con cambios sin aplicar, cambiar de vista pide confirmación", async () => {
    // Montar GanttView con un plan de matriz, entrar a la vista de matriz,
    // editar una cantidad y pulsar otra vista del menú.
    // Se espera un diálogo con el texto del aviso.
    renderGanttViewConMatriz();

    fireEvent.click(screen.getByRole("button", { name: /matriz/i }));
    fireEvent.change(await screen.findByLabelText("Cantidad"), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: /tabla/i }));

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Hay 1 celda con cambios sin aplicar.",
    );
  });

  test("sin cambios sin aplicar, cambiar de vista no pregunta nada", () => {
    renderGanttViewConMatriz();

    fireEvent.click(screen.getByRole("button", { name: /matriz/i }));
    fireEvent.click(screen.getByRole("button", { name: /tabla/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

**Nota obligatoria para quien ejecute:** `renderGanttViewConMatriz()` no existe todavía. Escribirlo
**leyendo el `GanttView.test.tsx` que haya fusionado el carril A**, reutilizando su forma de montar la
vista. Este plan no puede fijar ese código porque el archivo va a cambiar antes de que esta fase empiece;
inventarlo aquí sería escribir contra una versión que no existirá.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/gantt/toolbar/ViewSidebar.test.tsx src/components/views/GanttView.test.tsx`
Expected: FAIL — la matriz no está en `VIEW_TABS` y no hay ningún diálogo de aviso.

- [ ] **Step 3: Write minimal implementation**

Cuatro cableados, en este orden:

**a) M27 · La matriz en el menú.**

> ⚠️ **Comprobar el recuento del menú antes de añadir la entrada.** El menú se recortó de 14 a 9 vistas en
> el plan del 2026-08-05, y las decisiones pendientes del supergoal lo devuelven a **12**: la Matriz
> (esta), la vista de Observaciones (carril A) y Last Planner (carril A). Cada una es razonable por
> separado; sumadas deshacen medio recorte, y la revisión en frío que dio 6/10 señaló exactamente ese
> problema («catorce puertas y ninguna señal»).
>
> Esta tarea **no decide** el número final: es una decisión de producto del usuario. Lo que sí hace es
> **no añadir la entrada en silencio**. Antes de tocar `VIEW_TABS`, contar las entradas que haya fusionado
> el carril A y dejar el número en el mensaje del commit. Si ya hay 11, decirlo en el resumen final en vez
> de dejar que el menú crezca por acumulación.

En `ViewSidebar.tsx`, añadir la entrada al grupo «Trabajo» del array
`VIEW_TABS`, con el mismo formato que las demás entradas de ese grupo:

```tsx
  { id: "matriz", labelEs: "Matriz", group: "trabajo", icon: MatrixIcon },
```

Si `ViewType` todavía no incluye `"matriz"`, añadirlo en `src/types/ui.ts`.

**b) M28 · Aviso al salir.** En `GanttView.tsx`:

```tsx
  const [matrixDraftChanges, setMatrixDraftChanges] = useState<DraftChanges>({
    hasChanges: false,
    changedCellCount: 0,
    message: "No hay cambios sin aplicar.",
  });
  const [pendingView, setPendingView] = useState<ViewType | null>(null);

  const requestViewChange = useCallback(
    (next: ViewType) => {
      if (activeView === "matriz" && matrixDraftChanges.hasChanges) {
        setPendingView(next);
        return;
      }
      setActiveView(next);
    },
    [activeView, matrixDraftChanges.hasChanges],
  );
```

`requestViewChange` sustituye al manejador que hoy recibe `ViewSidebar`, y el diálogo se dibuja cuando
`pendingView !== null`, con el texto `matrixDraftChanges.message`, un botón «Salir sin aplicar» que hace
`setActiveView(pendingView)` y otro «Seguir editando» que hace `setPendingView(null)`.

`MatrixEditorView` recibe `onUnappliedChangesChange={setMatrixDraftChanges}` y lo llama en un `useEffect`
con `describeDraftChanges(draft, matrixPlan)`.

**c) Calendario.** Pasar el calendario del proyecto al editor:

```tsx
            <MatrixEditorView
              matrixPlan={syncedMatrixPlan}
              calendar={projectCalendar}
              tasks={tasks}
              onApplyMatrixPlan={handleApplyMatrixPlan}
              onSyncFromGantt={handleSyncMatrixFromGantt}
            />
```

y dentro de `MatrixEditorView`, pasar `{ calendar }` a `generateScheduleFromMatrix` y enseñar
`describeCalendarShift(draft, calendar).message` cuando `exceedsThreshold` sea cierto, antes de aplicar.

**d) Conflictos.** En `handleApplyMatrixPlan`, en vez de aplicar directamente, guardar los conflictos en
estado y montar `<ConflictChooser>` cuando los haya; su `onResolve` vuelve a llamar a `applyMatrixUpdate`
con `resolutions`.

**e) Borrar una ubicación con tareas generadas, y poder deshacerlo.** Al borrar una ubicación desde el
editor, llamar primero a `describeAreaRemoval(plan, tasks, areaId)`; si `taskIds` no está vacío, enseñar el
`message` con las dos salidas —«Borrar también sus tareas» y «Conservarlas en el cronograma»— y ejecutar
`removeAreaWithTasks` con la elegida **dentro de `runUndoable`**, igual que el resto de borrados del
proyecto. No inventar un mecanismo de deshacer nuevo: `runUndoable` ya existe en `ProjectContext.tsx:697` y
recibe justo un antes y un después, que es lo que devuelven esas dos funciones puras de la Tarea 17.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --runInBand`
Expected: PASS — toda la suite, incluidos los E2E de Playwright si el proyecto los ejecuta en esa orden.

- [ ] **Step 5: Verificación final del proyecto**

```bash
npx eslint src
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
npx next build
```
Expected: sin errores; el filtro de tipos, **vacío**.

- [ ] **Step 6: Comprobación en el navegador, en la ruta de la matriz**

```bash
docker compose up -d --build frontend
```

Abrir `http://localhost:3000`, entrar a un proyecto y comprobar los ocho puntos de la condición de hecho
del goal, en este orden:

1. La matriz aparece **en el menú lateral**, dentro de «Trabajo».
2. Editar una cantidad y pulsar otra vista **pregunta** antes de salir.
3. Generar el cronograma **respeta los festivos** del calendario del proyecto, y avisa si desplaza más de
   tres días.
4. Un alcance encadenado **mueve el piso 2** al atrasar el piso 1; uno en paralelo, no.
5. «Generar matriz desde el cronograma» produce una **propuesta revisable**.
6. Un rendimiento observado se **aprueba** y la siguiente generación lo usa.
7. Un conflicto se **muestra con las dos versiones** y se puede elegir.
8. Una matriz de 30 × 40 se edita **sin bloquear** la pantalla.
9. Borrar una ubicación con tareas generadas **avisa, deja elegir y se puede deshacer**.

- [ ] **Step 7: Commit**

```bash
git add src/components/gantt/toolbar/ViewSidebar.tsx src/components/views/GanttView.tsx src/lib/state/ProjectContext.tsx src/components/views/MatrixEditorView.tsx src/types/ui.ts
git commit -m "feat(matriz): la matriz vuelve al menu, avisa al salir y usa el calendario del proyecto"
```

---

## Cierre del proyecto

- [ ] Fases 1 y 2 fusionables por sí solas: si el carril A se retrasa, se fusionan sin la Fase 3 y esta se ejecuta después (R4 de la spec).
- [ ] Suite completa, lint, tipos filtrados vacíos y build en verde.
- [ ] Los ocho puntos de la condición de hecho comprobados en navegador, sobre la ruta de la matriz.
- [ ] Revisión con `superpowers:requesting-code-review` antes de fusionar.
- [ ] Fusión de `carril-b/matriz-como-producto` a `main` con `superpowers:finishing-a-development-branch`.
- [ ] Actualizar `goals/matriz-como-producto/goal.md` a `estado: cerrado`, anotando si la Fase 3 quedó pendiente del carril A.
