# P5 · Analíticos avanzados — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDO: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Entregar los tres analíticos que el goal maestro dejó bloqueados — proyección a fin de obra en la Curva S, historial de cortes con tabla propia y tablero de comparación, y editor de dependencias en el Diagrama de Red — cada uno con un estado vacío que enseña qué falta.

**Arquitectura:** A1 y A3 son funciones puras nuevas más el cableado de dos vistas existentes: la proyección se mide del avance ya registrado (sin palancas) y el editor de red reutiliza `validateDependencies` y `createDependency`, que son la misma fuente de verdad que usa la tabla. A2 es el único trabajo estructural: se establece un migrador de esquema (el repo hoy no tiene ninguno), las fotos salen del blob `project_data` a una tabla `project_snapshots` que solo se lee al abrir el tablero, y las líneas base existentes se copian conservando su `id` para que sigan siendo válidas sin duplicarse.

**Stack:** Next.js 16 (App Router), TypeScript, React, Jest + Testing Library, Playwright E2E

Spec: [2026-08-08-remates-y-analiticos-design.md](../specs/2026-08-08-remates-y-analiticos-design.md), sección «P5 · Analíticos avanzados» (A1, A2, A3). La sección «P6 · Remates» tiene plan propio y no se toca aquí.

## Restricciones globales

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo. Innegociable en este repo.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Suite completa: `cd v2 && npx jest --runInBand` (en paralelo hay flaky conocidos). Hay 1.400 tests verdes en 143 suites: ninguna tarea puede dejar uno en rojo.
- Verificación adicional por tarea tocada: `npx eslint <archivos>` y `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` (ese filtro debe salir vacío; hay errores preexistentes en tests y e2e).
- **Fechas**: nunca `new Date("2026-03-10")` — se interpreta como UTC y en GMT-5 cae el día anterior. Usar `createProjectDate` de `@/lib/date/projectDate` en fixtures y en toda construcción de fecha a partir de texto.
- Código e identificadores en inglés (como está el repo); textos de interfaz y mensajes de commit en **español con tildes**, en lenguaje de obra.
- No añadir color nuevo: usar los tokens de `src/app/globals.css`.
- Tests de componente llevan `/** @jest-environment jsdom */` en la cabecera (el preset global es `node`).
- Ninguna consulta nueva puede entrar en el camino del guardado: `saveProject` sigue escribiendo un solo blob.

---

## Estructura de archivos

| Archivo | Responsabilidad | Bloque |
|---|---|---|
| `src/lib/scheduling/projection.ts` | **Nuevo.** Serie de avance logrado, medición de ritmo y proyección a fin de obra | A1 |
| `src/components/views/SCurveView.tsx` | Sub-vista «Proyección» y su estado vacío que enseña | A1 |
| `src/lib/db/migrator.ts` | **Nuevo.** Migrador de esquema con `schema_migrations`, aplicar y revertir | A2 |
| `src/lib/db/migrations/001_project_snapshots.ts` | **Nuevo.** Tabla `project_snapshots` (up/down) | A2 |
| `src/lib/db/migrations/002_baselines_as_snapshots.ts` | **Nuevo.** Copia de líneas base del blob a la tabla (up/down) | A2 |
| `src/lib/db/migrations/index.ts` | **Nuevo.** `ALL_MIGRATIONS` en orden | A2 |
| `src/types/snapshot.ts` | **Nuevo.** `ProjectSnapshot`, `SnapshotTask`, `ProjectSnapshotSummary` | A2 |
| `src/lib/scheduling/snapshots.ts` | **Nuevo.** Crear foto, convertir línea base, comparar y fusionar fuentes | A2 |
| `src/app/actions/snapshots.ts` | **Nuevo.** Acciones de servidor: listar, cargar, guardar | A2 |
| `src/lib/import/importSnapshot.ts` | **Nuevo.** Foto automática tras cada importación | A2 |
| `src/components/views/SnapshotsBoardView.tsx` | **Nuevo.** Tablero por capas | A2 |
| `src/components/gantt/toolbar/viewTypes.ts` | Alta de la vista `cortes` | A2 |
| `src/components/gantt/toolbar/ViewSidebar.tsx` | Entradas `cortes` y `network` en el menú | A2/A3 |
| `src/lib/gantt/viewHelp.ts` | Ayuda de `cortes` y `network` | A2/A3 |
| `src/lib/gantt/networkDependencyEditing.ts` | **Nuevo.** Resolución de una dependencia dibujada, reutilizando las validaciones | A3 |
| `src/components/views/NetworkDiagramView.tsx` | Conectar, seleccionar flecha y borrar | A3 |
| `src/components/network/NetworkNode.tsx` | Conector por nodo | A3 |
| `src/components/network/NetworkArrow.tsx` | Flecha seleccionable | A3 |
| `src/components/views/GanttView.tsx` | Cableado de las tres vistas al contexto | A1/A2/A3 |

---

# BLOQUE A1 — Proyección en la Curva S

Cuatro tareas. Todo el cálculo es puro y se prueba sin DOM; la vista solo elige entre gráfica y estado vacío.

**El criterio, en una línea:** el ritmo se mide del avance ya registrado, comparando el ritmo medio desde el inicio con el ritmo de los últimos 14 días. La línea probable usa el ritmo reciente; la optimista el más rápido de los dos; la pesimista el más lento. No hay ningún control que el usuario deba configurar.

## Tarea 1: La serie de avance realmente logrado

**Archivos:**
- Crear: `src/lib/scheduling/projection.ts`
- Test: `src/lib/scheduling/projection.test.ts`

**Interfaces:**
- Consume: `GanttTask` de `@/components/gantt/types` (campos `id`, `start`, `duration`, `progress`), `createProjectDate` de `@/lib/date/projectDate`.
- Produce:
  - `export interface ProjectionPoint { date: Date; cumulativeValue: number }`
  - `export function computeAchievedSCurve(tasks: GanttTask[], statusDate: Date): ProjectionPoint[]`

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import { computeAchievedSCurve } from "./projection";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

/** Cuatro bloques consecutivos de 10 días; los dos primeros ejecutados. */
function obraConDosBloquesTerminados(): GanttTask[] {
  return [
    task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: 100 }),
    task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: 100 }),
    task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
    task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
  ];
}

describe("computeAchievedSCurve", () => {
  test("acumula un punto por día desde el inicio de obra hasta la fecha de corte", () => {
    const puntos = computeAchievedSCurve(
      obraConDosBloquesTerminados(),
      createProjectDate("2026-01-20"),
    );

    expect(puntos).toHaveLength(20);
    expect(puntos[0].date.getTime()).toBe(createProjectDate("2026-01-01").getTime());
    expect(puntos[19].date.getTime()).toBe(createProjectDate("2026-01-20").getTime());
  });

  test("con dos bloques de cuatro ejecutados, el avance logrado al corte es del 50 %", () => {
    const puntos = computeAchievedSCurve(
      obraConDosBloquesTerminados(),
      createProjectDate("2026-01-20"),
    );

    expect(puntos[19].cumulativeValue).toBeCloseTo(50, 6);
    expect(puntos[4].cumulativeValue).toBeCloseTo(12.5, 6);
  });

  test("el avance de una tarea no se acredita más allá del porcentaje reportado", () => {
    const puntos = computeAchievedSCurve(
      [task({ id: 1, progress: 30 })],
      createProjectDate("2026-01-10"),
    );

    expect(puntos[2].cumulativeValue).toBeCloseTo(30, 6);
    expect(puntos[9].cumulativeValue).toBeCloseTo(30, 6);
  });

  test("sin tareas la serie está vacía", () => {
    expect(computeAchievedSCurve([], createProjectDate("2026-01-20"))).toEqual([]);
  });

  test("una fecha de corte anterior al inicio de obra no produce serie", () => {
    expect(
      computeAchievedSCurve(obraConDosBloquesTerminados(), createProjectDate("2025-12-20")),
    ).toEqual([]);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/scheduling/projection.test.ts`
Esperado: FALLA con `Cannot find module './projection' from 'src/lib/scheduling/projection.test.ts'`

- [ ] **Paso 3: Implementación mínima**

```ts
import type { GanttTask } from "@/components/gantt/types";

/**
 * Proyección a fin de obra a partir del avance realmente registrado.
 *
 * No hay palancas: el ritmo sale de lo que la obra ya reportó. Una vista que
 * exige configuración para mostrar algo es el fallo que este goal vino a
 * corregir.
 */

export interface ProjectionPoint {
  date: Date;
  cumulativeValue: number;
}

/** Normaliza a medianoche local para comparar solo por día. */
function dateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** Días de calendario entre dos fechas, redondeado para absorber el horario de verano. */
function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function* eachDay(start: Date, finish: Date): Generator<Date> {
  const current = new Date(start);
  while (current <= finish) {
    yield new Date(current);
    current.setDate(current.getDate() + 1);
  }
}

function safeDuration(task: GanttTask): number {
  return Math.max(task.duration, 1);
}

/**
 * Fracción de una tarea acreditada a un día: se reparte linealmente sobre su
 * duración y se topa con el porcentaje reportado. Sin avance reportado, cero.
 */
function achievedFraction(task: GanttTask, day: Date): number {
  const start = dateOnly(task.start);
  if (day < start) return 0;
  const elapsed = dayDiff(start, day) + 1;
  return Math.min(elapsed / safeDuration(task), task.progress / 100);
}

function earliestStart(tasks: GanttTask[]): Date {
  let min = tasks[0].start;
  for (const task of tasks) {
    if (task.start < min) min = task.start;
  }
  return min;
}

/**
 * Serie diaria de avance logrado (0–100), ponderada por duración, desde el
 * inicio de obra hasta la fecha de corte inclusive.
 */
export function computeAchievedSCurve(
  tasks: GanttTask[],
  statusDate: Date,
): ProjectionPoint[] {
  if (tasks.length === 0) return [];

  let totalWork = 0;
  for (const task of tasks) totalWork += safeDuration(task);
  if (totalWork <= 0) return [];

  const start = dateOnly(earliestStart(tasks));
  const end = dateOnly(statusDate);
  if (end < start) return [];

  const points: ProjectionPoint[] = [];
  for (const day of eachDay(start, end)) {
    let done = 0;
    for (const task of tasks) {
      done += safeDuration(task) * achievedFraction(task, day);
    }
    points.push({ date: day, cumulativeValue: (done / totalWork) * 100 });
  }
  return points;
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/scheduling/projection.test.ts`
Esperado: PASA (5 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/scheduling/projection.ts v2/src/lib/scheduling/projection.test.ts && git commit -m "feat(proyeccion): la serie de avance realmente logrado hasta la fecha de corte"
```

## Tarea 2: Medir el ritmo logrado, medio y reciente

**Archivos:**
- Modificar: `src/lib/scheduling/projection.ts` (se añade al final del archivo creado en la Tarea 1)
- Test: `src/lib/scheduling/projection.test.ts` (se añade un `describe` nuevo)

**Interfaces:**
- Consume: `computeAchievedSCurve(tasks: GanttTask[], statusDate: Date): ProjectionPoint[]` y `ProjectionPoint` de la Tarea 1.
- Produce:
  - `export const RECENT_WINDOW_DAYS = 14`
  - `export interface PaceMeasurement { elapsedDays: number; achievedPercent: number; overallPace: number; recentPace: number }`
  - `export function measurePace(points: ProjectionPoint[]): PaceMeasurement | null`

- [ ] **Paso 1: Escribir el test que falla**

```ts
// Se añade al final de src/lib/scheduling/projection.test.ts.
// `task` y `createProjectDate` ya están importados arriba en el archivo;
// se añade `computeAchievedSCurve, measurePace` al import de "./projection".

describe("measurePace", () => {
  /** Cuatro bloques de 10 días; el primero al `primero` %, el segundo al `segundo` %. */
  function obra(primero: number, segundo: number): GanttTask[] {
    return [
      task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: primero }),
      task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: segundo }),
      task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
      task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
    ];
  }

  const corte = createProjectDate("2026-01-20");

  test("ritmo constante: el ritmo medio y el reciente coinciden", () => {
    const pace = measurePace(computeAchievedSCurve(obra(100, 100), corte))!;

    expect(pace.elapsedDays).toBe(20);
    expect(pace.achievedPercent).toBeCloseTo(50, 6);
    expect(pace.overallPace).toBeCloseTo(2.5, 6);
    expect(pace.recentPace).toBeCloseTo(2.5, 6);
  });

  test("ritmo que se acelera: el reciente supera al medio", () => {
    const pace = measurePace(computeAchievedSCurve(obra(30, 100), corte))!;

    expect(pace.achievedPercent).toBeCloseTo(32.5, 6);
    expect(pace.overallPace).toBeCloseTo(1.625, 6);
    expect(pace.recentPace).toBeCloseTo(25 / 14, 6);
    expect(pace.recentPace).toBeGreaterThan(pace.overallPace);
  });

  test("ritmo que se frena: el reciente queda por debajo del medio", () => {
    const pace = measurePace(computeAchievedSCurve(obra(100, 30), corte))!;

    expect(pace.achievedPercent).toBeCloseTo(32.5, 6);
    expect(pace.overallPace).toBeCloseTo(1.625, 6);
    expect(pace.recentPace).toBeCloseTo(1.25, 6);
    expect(pace.recentPace).toBeLessThan(pace.overallPace);
  });

  test("sin avance registrado no hay ritmo que medir", () => {
    expect(measurePace(computeAchievedSCurve(obra(0, 0), corte))).toBeNull();
  });

  test("una serie vacía no produce medición", () => {
    expect(measurePace([])).toBeNull();
  });

  test("si la obra se detuvo en la ventana reciente, el ritmo reciente cae al medio en vez de a cero", () => {
    // Solo se ejecutó el primer bloque, y la fecha de corte está tan lejos que
    // los últimos 14 días son completamente planos.
    const pace = measurePace(
      computeAchievedSCurve(obra(100, 0), createProjectDate("2026-02-09")),
    )!;

    expect(pace.elapsedDays).toBe(40);
    expect(pace.achievedPercent).toBeCloseTo(25, 6);
    expect(pace.overallPace).toBeCloseTo(0.625, 6);
    expect(pace.recentPace).toBeCloseTo(pace.overallPace, 6);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/scheduling/projection.test.ts -t "measurePace"`
Esperado: FALLA con `TypeError: (0 , _projection.measurePace) is not a function`

- [ ] **Paso 3: Implementación mínima**

```ts
/** Ventana de días con la que se mide el ritmo reciente. */
export const RECENT_WINDOW_DAYS = 14;

export interface PaceMeasurement {
  /** Días de obra medidos hasta la fecha de corte, inclusive. */
  elapsedDays: number;
  /** Avance logrado al corte, 0–100. */
  achievedPercent: number;
  /** Puntos porcentuales por día desde el inicio de obra. */
  overallPace: number;
  /** Puntos porcentuales por día en los últimos `RECENT_WINDOW_DAYS`. */
  recentPace: number;
}

/**
 * Mide el ritmo logrado. Devuelve `null` cuando no hay nada que medir: sin
 * serie o sin un solo punto de avance registrado.
 *
 * Si la obra se detuvo justo en la ventana reciente, el ritmo reciente sería
 * cero y la proyección se iría al infinito. En ese caso se cae al ritmo medio,
 * que es el dato que sí existe.
 */
export function measurePace(points: ProjectionPoint[]): PaceMeasurement | null {
  if (points.length === 0) return null;

  const elapsedDays = points.length;
  const achievedPercent = points[points.length - 1].cumulativeValue;
  if (achievedPercent <= 0) return null;

  const overallPace = achievedPercent / elapsedDays;

  const windowSize = Math.min(RECENT_WINDOW_DAYS, points.length - 1);
  const rawRecentPace =
    windowSize > 0
      ? (achievedPercent - points[points.length - 1 - windowSize].cumulativeValue) /
        windowSize
      : overallPace;

  return {
    elapsedDays,
    achievedPercent,
    overallPace,
    recentPace: rawRecentPace > 0 ? rawRecentPace : overallPace,
  };
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/scheduling/projection.test.ts`
Esperado: PASA (11 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/scheduling/projection.ts v2/src/lib/scheduling/projection.test.ts && git commit -m "feat(proyeccion): medir el ritmo medio y el reciente sin pedirle nada al usuario"
```

## Tarea 3: Proyectar a fin de obra, o decir qué falta

**Archivos:**
- Modificar: `src/lib/scheduling/projection.ts` (se añade al final)
- Test: `src/lib/scheduling/projection.test.ts` (se añade un `describe` nuevo)

**Interfaces:**
- Consume: `computeAchievedSCurve`, `measurePace`, `PaceMeasurement`, `ProjectionPoint` de las Tareas 1 y 2.
- Produce:
  - `export const MIN_ELAPSED_DAYS = 7`
  - `export type ProjectionUnavailableReason = "sinTareas" | "sinAvance" | "pocosDias"`
  - `export interface ProjectionLine { label: string; finishDate: Date; points: ProjectionPoint[] }`
  - `export interface ProjectionUnavailable { available: false; reason: ProjectionUnavailableReason; message: string }`
  - `export interface ProjectionAvailable { available: true; statusDate: Date; achieved: ProjectionPoint[]; pace: PaceMeasurement; optimistic: ProjectionLine; probable: ProjectionLine; pessimistic: ProjectionLine }`
  - `export type Projection = ProjectionAvailable | ProjectionUnavailable`
  - `export function projectCompletion(tasks: GanttTask[], statusDate: Date): Projection`

- [ ] **Paso 1: Escribir el test que falla**

```ts
// Se añade al final de src/lib/scheduling/projection.test.ts.
// Se añade `projectCompletion` al import de "./projection".

describe("projectCompletion", () => {
  function obra(primero: number, segundo: number): GanttTask[] {
    return [
      task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: primero }),
      task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: segundo }),
      task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
      task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
    ];
  }

  const corte = createProjectDate("2026-01-20");

  function iso(date: Date): string {
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${mes}-${dia}`;
  }

  test("ritmo constante: las tres líneas caen el mismo día", () => {
    const resultado = projectCompletion(obra(100, 100), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(iso(resultado.probable.finishDate)).toBe("2026-02-09");
    expect(iso(resultado.optimistic.finishDate)).toBe("2026-02-09");
    expect(iso(resultado.pessimistic.finishDate)).toBe("2026-02-09");
  });

  test("ritmo que se acelera: la probable coincide con la optimista y la pesimista se va más lejos", () => {
    const resultado = projectCompletion(obra(30, 100), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(iso(resultado.probable.finishDate)).toBe("2026-02-27");
    expect(iso(resultado.optimistic.finishDate)).toBe("2026-02-27");
    expect(iso(resultado.pessimistic.finishDate)).toBe("2026-03-03");
  });

  test("ritmo que se frena: la probable coincide con la pesimista", () => {
    const resultado = projectCompletion(obra(100, 30), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(iso(resultado.probable.finishDate)).toBe("2026-03-15");
    expect(iso(resultado.optimistic.finishDate)).toBe("2026-03-03");
    expect(iso(resultado.pessimistic.finishDate)).toBe("2026-03-15");
  });

  test("cada línea arranca en el avance logrado y termina en el 100 %", () => {
    const resultado = projectCompletion(obra(100, 100), corte);

    expect(resultado.available).toBe(true);
    if (!resultado.available) return;
    expect(resultado.probable.points).toHaveLength(2);
    expect(resultado.probable.points[0].cumulativeValue).toBeCloseTo(50, 6);
    expect(iso(resultado.probable.points[0].date)).toBe("2026-01-20");
    expect(resultado.probable.points[1].cumulativeValue).toBe(100);
  });

  test("avance cero: no proyecta y dice qué falta", () => {
    const resultado = projectCompletion(obra(0, 0), corte);

    expect(resultado.available).toBe(false);
    if (resultado.available) return;
    expect(resultado.reason).toBe("sinAvance");
    expect(resultado.message).toMatch(/avance/i);
  });

  test("sin tareas: no proyecta y dice qué falta", () => {
    const resultado = projectCompletion([], corte);

    expect(resultado.available).toBe(false);
    if (resultado.available) return;
    expect(resultado.reason).toBe("sinTareas");
    expect(resultado.message).toMatch(/cronograma/i);
  });

  test("por debajo del umbral mínimo de días medidos no se proyecta", () => {
    const resultado = projectCompletion(
      [task({ id: 1, start: createProjectDate("2026-01-01"), duration: 10, progress: 50 })],
      createProjectDate("2026-01-03"),
    );

    expect(resultado.available).toBe(false);
    if (resultado.available) return;
    expect(resultado.reason).toBe("pocosDias");
    expect(resultado.message).toContain("7");
  });

  test("justo en el umbral sí se proyecta", () => {
    const resultado = projectCompletion(
      [task({ id: 1, start: createProjectDate("2026-01-01"), duration: 10, progress: 50 })],
      createProjectDate("2026-01-07"),
    );

    expect(resultado.available).toBe(true);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/scheduling/projection.test.ts -t "projectCompletion"`
Esperado: FALLA con `TypeError: (0 , _projection.projectCompletion) is not a function`

- [ ] **Paso 3: Implementación mínima**

```ts
/** Días de obra medidos por debajo de los cuales el ritmo no es un ritmo. */
export const MIN_ELAPSED_DAYS = 7;

export type ProjectionUnavailableReason = "sinTareas" | "sinAvance" | "pocosDias";

export interface ProjectionLine {
  label: string;
  finishDate: Date;
  points: ProjectionPoint[];
}

export interface ProjectionUnavailable {
  available: false;
  reason: ProjectionUnavailableReason;
  /** Qué falta para poder proyectar, en lenguaje de obra. */
  message: string;
}

export interface ProjectionAvailable {
  available: true;
  statusDate: Date;
  achieved: ProjectionPoint[];
  pace: PaceMeasurement;
  optimistic: ProjectionLine;
  probable: ProjectionLine;
  pessimistic: ProjectionLine;
}

export type Projection = ProjectionAvailable | ProjectionUnavailable;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildLine(
  label: string,
  from: Date,
  achievedPercent: number,
  pace: number,
): ProjectionLine {
  const remaining = Math.max(100 - achievedPercent, 0);
  const days = pace > 0 ? Math.ceil(remaining / pace) : 0;
  const finishDate = addDays(from, days);
  return {
    label,
    finishDate,
    points: [
      { date: from, cumulativeValue: achievedPercent },
      { date: finishDate, cumulativeValue: 100 },
    ],
  };
}

/**
 * Proyecta el fin de obra desde el ritmo real logrado. Tres líneas: la
 * probable sigue el ritmo reciente, la optimista el más rápido de los dos
 * ritmos medidos y la pesimista el más lento.
 */
export function projectCompletion(
  tasks: GanttTask[],
  statusDate: Date,
): Projection {
  if (tasks.length === 0) {
    return {
      available: false,
      reason: "sinTareas",
      message:
        "No hay cronograma que proyectar. Importa un archivo de Microsoft Project o crea las actividades de la obra.",
    };
  }

  const achieved = computeAchievedSCurve(tasks, statusDate);
  const pace = measurePace(achieved);

  if (!pace) {
    return {
      available: false,
      reason: "sinAvance",
      message:
        "Ninguna actividad tiene avance registrado, así que no hay ritmo que medir. Anota el porcentaje ejecutado de las actividades que ya arrancaron y la proyección aparece sola.",
    };
  }

  if (pace.elapsedDays < MIN_ELAPSED_DAYS) {
    return {
      available: false,
      reason: "pocosDias",
      message: `Solo hay ${pace.elapsedDays} día(s) de obra medidos hasta la fecha de corte. Se necesitan al menos ${MIN_ELAPSED_DAYS} para que el ritmo signifique algo.`,
    };
  }

  const from = achieved[achieved.length - 1].date;
  const fastest = Math.max(pace.overallPace, pace.recentPace);
  const slowest = Math.min(pace.overallPace, pace.recentPace);

  return {
    available: true,
    statusDate: from,
    achieved,
    pace,
    optimistic: buildLine("Optimista", from, pace.achievedPercent, fastest),
    probable: buildLine("Probable", from, pace.achievedPercent, pace.recentPace),
    pessimistic: buildLine("Pesimista", from, pace.achievedPercent, slowest),
  };
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/scheduling/projection.test.ts`
Esperado: PASA (19 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/scheduling/projection.ts v2/src/lib/scheduling/projection.test.ts && git commit -m "feat(proyeccion): tres lineas a fin de obra, o el motivo por el que no hay ninguna"
```

## Tarea 4: La sub-vista «Proyección» en la Curva S

**Archivos:**
- Modificar: `src/components/views/SCurveView.tsx:17` (tipo `SubView`), `:19-23` (props), `:60` (estado), `:196-218` (pestañas), `:290-303` (contenido)
- Modificar: `src/components/views/GanttView.tsx:2216-2222` (pasar `statusDate`)
- Test: `src/components/views/SCurveView.projection.test.tsx`

**Interfaces:**
- Consume: `projectCompletion(tasks: GanttTask[], statusDate: Date): Projection` de la Tarea 3; `createProjectDate(value: string | Date): Date` y `formatProjectDate(date: Date, options?): string` de `@/lib/date/projectDate`; `SCurveChart` con props `{ lines: SCurveLineData[]; yFormat?: (v: number) => string; showLegend?: boolean; indices?: { label: string; value: number }[] }`.
- Produce: `SCurveView` acepta además `statusDate?: string`. Testids nuevos: `s-curve-projection`, `s-curve-projection-dates`, `s-curve-projection-empty`.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import SCurveView from "./SCurveView";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

function obraConAvance(): GanttTask[] {
  return [
    task({ id: 1, start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10"), progress: 100 }),
    task({ id: 2, start: createProjectDate("2026-01-11"), finish: createProjectDate("2026-01-20"), progress: 100 }),
    task({ id: 3, start: createProjectDate("2026-01-21"), finish: createProjectDate("2026-01-30"), progress: 0 }),
    task({ id: 4, start: createProjectDate("2026-01-31"), finish: createProjectDate("2026-02-09"), progress: 0 }),
  ];
}

function abrirProyeccion() {
  fireEvent.click(screen.getByRole("button", { name: "Proyección" }));
}

describe("SCurveView · sub-vista Proyección (A1)", () => {
  test("con avance suficiente muestra las tres fechas proyectadas", () => {
    render(
      <SCurveView
        tasks={obraConAvance()}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2026-01-20"
      />,
    );

    abrirProyeccion();

    expect(screen.getByTestId("s-curve-projection")).toBeInTheDocument();
    const fechas = screen.getByTestId("s-curve-projection-dates");
    expect(fechas).toHaveTextContent("Optimista");
    expect(fechas).toHaveTextContent("Probable");
    expect(fechas).toHaveTextContent("Pesimista");
    expect(fechas).toHaveTextContent("09/02/2026");
  });

  test("sin avance registrado la vista dice qué falta en vez de mostrar una línea plana", () => {
    render(
      <SCurveView
        tasks={obraConAvance().map((t) => ({ ...t, progress: 0 }))}
        budgetMappings={[]}
        budgetItems={[]}
        statusDate="2026-01-20"
      />,
    );

    abrirProyeccion();

    expect(screen.queryByTestId("s-curve-projection-dates")).not.toBeInTheDocument();
    expect(screen.getByTestId("s-curve-projection-empty")).toHaveTextContent(
      /porcentaje ejecutado/i,
    );
  });

  test("sin cronograma la vista invita a importar en vez de quedarse en blanco", () => {
    render(
      <SCurveView tasks={[]} budgetMappings={[]} budgetItems={[]} statusDate="2026-01-20" />,
    );

    abrirProyeccion();

    expect(screen.getByTestId("s-curve-projection-empty")).toHaveTextContent(
      /Microsoft Project/i,
    );
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/components/views/SCurveView.projection.test.tsx`
Esperado: FALLA con `Unable to find an accessible element with the role "button" and name "Proyección"`

- [ ] **Paso 3: Implementación mínima**

En `src/components/views/SCurveView.tsx`, añadir a los imports:

```tsx
import { projectCompletion } from "@/lib/scheduling/projection";
import { createProjectDate, formatProjectDate } from "@/lib/date/projectDate";
```

Cambiar el tipo de la línea 17 y las props:

```tsx
type SubView = "schedule" | "budget" | "earnedValue" | "projection";

interface SCurveViewProps {
  tasks: GanttTask[];
  budgetMappings: BudgetMapping[];
  budgetItems: BudgetItem[];
  /** Fecha de corte del proyecto, en formato `YYYY-MM-DD`. */
  statusDate?: string;
}
```

Añadir `statusDate` a la desestructuración del componente y, junto a los demás `useMemo`, el cálculo:

```tsx
  const projection = useMemo(
    () =>
      projectCompletion(
        tasks,
        statusDate ? createProjectDate(statusDate) : new Date(),
      ),
    [tasks, statusDate],
  );

  const projectionLines: SCurveLineData[] = useMemo(() => {
    if (!projection.available) return [];
    return [
      {
        label: "Avance real",
        points: projection.achieved.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-arch-main)",
      },
      {
        label: "Optimista",
        points: projection.optimistic.points.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-proj-main)",
      },
      {
        label: "Probable",
        points: projection.probable.points.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-corp-main)",
      },
      {
        label: "Pesimista",
        points: projection.pessimistic.points.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-alert-main)",
      },
    ];
  }, [projection]);
```

Añadir la cuarta pestaña después del botón «Valor Ganado»:

```tsx
        <button
          onClick={() => setActiveSubView("projection")}
          style={tabStyle(activeSubView === "projection")}
        >
          Proyección
        </button>
```

Y el bloque de contenido después del de `earnedValue`:

```tsx
        {activeSubView === "projection" && (
          <div data-testid="s-curve-projection">
            {projection.available ? (
              <>
                <section
                  data-testid="s-curve-projection-dates"
                  className="mb-4 grid gap-2 md:grid-cols-3"
                >
                  {[projection.optimistic, projection.probable, projection.pessimistic].map(
                    (line) => (
                      <article key={line.label} className="apple-section px-3 py-2">
                        <p className="text-[0.6875rem] font-semibold uppercase text-[var(--color-text-muted)]">
                          {line.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">
                          {formatProjectDate(line.finishDate)}
                        </p>
                      </article>
                    ),
                  )}
                </section>
                <SCurveChart
                  lines={projectionLines}
                  yFormat={(v) => `${Math.round(v)}%`}
                  showLegend={true}
                />
              </>
            ) : (
              <div data-testid="s-curve-projection-empty">
                <EmptyState message={projection.message} />
              </div>
            )}
          </div>
        )}
```

En `src/components/views/GanttView.tsx`, pasar la fecha de corte a la vista (bloque `activeView === "scurve"`):

```tsx
          {activeView === "scurve" && (
            <SCurveView
              tasks={calculatedTasks}
              budgetMappings={budgetMappings}
              budgetItems={budgetItems}
              statusDate={initialStatusDate}
            />
          )}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/components/views/SCurveView.projection.test.tsx src/components/views/SCurveView.test.tsx`
Esperado: PASA — los 3 tests nuevos y los ya existentes de `SCurveView.test.tsx`

- [ ] **Paso 5: Commit**

```bash
git add v2/src/components/views/SCurveView.tsx v2/src/components/views/SCurveView.projection.test.tsx v2/src/components/views/GanttView.tsx && git commit -m "feat(proyeccion): la Curva S responde cuando termino si sigo a este ritmo"
```

---

# BLOQUE A2 — Historial de cortes y tablero por capas

Diez tareas. Es el único trabajo estructural de P5.

**Hallazgo previo, y por qué la primera tarea es un migrador.** El proyecto usa **PostgreSQL con el cliente `pg`** (`v2/src/lib/db.ts`, `new Pool({ connectionString: process.env.DATABASE_URL })`). **No hay Prisma, ni Drizzle, ni ningún sistema de migraciones.** Las tablas se crean hoy de dos formas descoordinadas: un script suelto `v2/scripts/init-schema.sql` que nadie ejecuta desde la app, y `ensureProjectsTable()` en `v2/src/lib/db.ts` con `CREATE TABLE IF NOT EXISTS` que se llama perezosamente. No hay forma de revertir nada. **Por eso la Tarea 5 establece el migrador**: sin él, la migración reversible que el spec exige no es posible.

**Decisión de identidad de proyecto.** `ensureProjectsTable` declara `projects.id` como `UUID`, pero el `init-schema.sql` heredado lo declara `SERIAL`. Para no atarse a ninguno de los dos, `project_snapshots.project_id` es `TEXT` y se guarda siempre `String(projectId)`. Queda escrito aquí porque el spec no lo cubría.

**Decisión sobre las líneas base existentes.** El spec pide que sigan siendo válidas «sin migrarse a la fuerza ni duplicarse», y a la vez que tras migrar «el blob no las contiene por duplicado». Se resuelve así: la migración **copia** cada línea base a la tabla **conservando su `id` original** y **deja el blob intacto**. Como la identidad se conserva, la foto es una sola cosa vista desde dos sitios; el lector las fusiona por `id` y la tabla gana. El `down()` borra solo las filas con `origin = 'baseline'`, así que revertir devuelve el sistema exactamente al estado anterior sin tocar el blob. Esto también hace la migración segura ante un despliegue revertido.

## Tarea 5: Un migrador de esquema, porque no había ninguno

**Archivos:**
- Crear: `src/lib/db/migrator.ts`
- Test: `src/lib/db/migrator.test.ts`

**Interfaces:**
- Consume: `PoolClient` de `pg` (solo para el adaptador).
- Produce:
  - `export interface MigrationClient { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }`
  - `export interface Migration { id: string; up: (client: MigrationClient) => Promise<void>; down: (client: MigrationClient) => Promise<void> }`
  - `export function migrationClient(client: PoolClient): MigrationClient`
  - `export async function appliedMigrationIds(client: MigrationClient): Promise<string[]>`
  - `export async function runMigrations(client: MigrationClient, migrations: Migration[]): Promise<string[]>`
  - `export async function rollbackMigration(client: MigrationClient, migrations: Migration[], id: string): Promise<boolean>`

- [ ] **Paso 1: Escribir el test que falla**

```ts
import {
  appliedMigrationIds,
  rollbackMigration,
  runMigrations,
  type Migration,
  type MigrationClient,
} from "./migrator";

/** Cliente falso: recuerda el SQL ejecutado y simula la tabla schema_migrations. */
function fakeClient(): MigrationClient & { sql: string[] } {
  const applied: string[] = [];
  const sql: string[] = [];

  return {
    sql,
    async query(text: string, params?: unknown[]) {
      sql.push(text.trim());
      if (text.includes("SELECT id FROM schema_migrations")) {
        return { rows: applied.map((id) => ({ id })) };
      }
      if (text.includes("INSERT INTO schema_migrations")) {
        applied.push(String(params?.[0]));
        return { rows: [] };
      }
      if (text.includes("DELETE FROM schema_migrations")) {
        const index = applied.indexOf(String(params?.[0]));
        if (index >= 0) applied.splice(index, 1);
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

function migration(id: string, log: string[]): Migration {
  return {
    id,
    async up() {
      log.push(`up:${id}`);
    },
    async down() {
      log.push(`down:${id}`);
    },
  };
}

describe("migrador de esquema", () => {
  test("crea la tabla de control antes de consultar nada", async () => {
    const client = fakeClient();

    await appliedMigrationIds(client);

    expect(client.sql[0]).toContain("CREATE TABLE IF NOT EXISTS schema_migrations");
  });

  test("aplica las migraciones pendientes en orden de id", async () => {
    const client = fakeClient();
    const log: string[] = [];

    const ejecutadas = await runMigrations(client, [
      migration("002_segunda", log),
      migration("001_primera", log),
    ]);

    expect(log).toEqual(["up:001_primera", "up:002_segunda"]);
    expect(ejecutadas).toEqual(["001_primera", "002_segunda"]);
  });

  test("volver a correrlas no repite ninguna", async () => {
    const client = fakeClient();
    const log: string[] = [];
    const migraciones = [migration("001_primera", log), migration("002_segunda", log)];

    await runMigrations(client, migraciones);
    const segundaVuelta = await runMigrations(client, migraciones);

    expect(segundaVuelta).toEqual([]);
    expect(log).toEqual(["up:001_primera", "up:002_segunda"]);
  });

  test("revertir una migración aplicada ejecuta su down y la borra del registro", async () => {
    const client = fakeClient();
    const log: string[] = [];
    const migraciones = [migration("001_primera", log), migration("002_segunda", log)];
    await runMigrations(client, migraciones);

    const revertida = await rollbackMigration(client, migraciones, "002_segunda");

    expect(revertida).toBe(true);
    expect(log).toEqual(["up:001_primera", "up:002_segunda", "down:002_segunda"]);
    expect(await appliedMigrationIds(client)).toEqual(["001_primera"]);
  });

  test("revertir una migración que no se aplicó no hace nada", async () => {
    const client = fakeClient();
    const log: string[] = [];

    const revertida = await rollbackMigration(client, [migration("001_primera", log)], "001_primera");

    expect(revertida).toBe(false);
    expect(log).toEqual([]);
  });

  test("revertir un id desconocido es un error de programación, no un silencio", async () => {
    const client = fakeClient();
    const log: string[] = [];
    const migraciones = [migration("001_primera", log)];
    await runMigrations(client, migraciones);

    await expect(
      rollbackMigration(client, migraciones, "001_primera_mal_escrita"),
    ).resolves.toBe(false);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/db/migrator.test.ts`
Esperado: FALLA con `Cannot find module './migrator' from 'src/lib/db/migrator.test.ts'`

- [ ] **Paso 3: Implementación mínima**

```ts
import type { PoolClient } from "pg";

/**
 * Migrador de esquema.
 *
 * El repo no tenía ninguno: las tablas se creaban con `CREATE TABLE IF NOT
 * EXISTS` sueltos y no había forma de revertir nada. Este módulo es lo mínimo
 * para que una migración se pueda aplicar una sola vez y deshacer.
 */

/** Lo poco que un `PoolClient` necesita exponer para migrar. */
export interface MigrationClient {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
}

export interface Migration {
  /** Ordena la ejecución: `001_...`, `002_...` */
  id: string;
  up: (client: MigrationClient) => Promise<void>;
  down: (client: MigrationClient) => Promise<void>;
}

/** Envuelve un cliente de `pg` para no arrastrar sus sobrecargas de tipos. */
export function migrationClient(client: PoolClient): MigrationClient {
  return {
    query: async (sql, params) => {
      const result = await client.query(sql, params as unknown[]);
      return { rows: result.rows as Record<string, unknown>[] };
    },
  };
}

const CREATE_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

export async function appliedMigrationIds(
  client: MigrationClient,
): Promise<string[]> {
  await client.query(CREATE_MIGRATIONS_TABLE);
  const result = await client.query("SELECT id FROM schema_migrations ORDER BY id");
  return result.rows.map((row) => String(row.id));
}

/** Aplica las pendientes en orden de `id`. Devuelve las que ejecutó. */
export async function runMigrations(
  client: MigrationClient,
  migrations: Migration[],
): Promise<string[]> {
  const applied = new Set(await appliedMigrationIds(client));
  const executed: string[] = [];

  for (const migration of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (applied.has(migration.id)) continue;
    await migration.up(client);
    await client.query(
      "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
      [migration.id],
    );
    executed.push(migration.id);
  }

  return executed;
}

/** Revierte una migración aplicada. `false` si no estaba aplicada o no existe. */
export async function rollbackMigration(
  client: MigrationClient,
  migrations: Migration[],
  id: string,
): Promise<boolean> {
  const applied = new Set(await appliedMigrationIds(client));
  if (!applied.has(id)) return false;

  const migration = migrations.find((candidate) => candidate.id === id);
  if (!migration) return false;

  await migration.down(client);
  await client.query("DELETE FROM schema_migrations WHERE id = $1", [id]);
  return true;
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/db/migrator.test.ts`
Esperado: PASA (6 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/db/migrator.ts v2/src/lib/db/migrator.test.ts && git commit -m "feat(cortes): el proyecto estrena migrador de esquema, que no tenia ninguno"
```

## Tarea 6: La tabla propia de las fotos

**Archivos:**
- Crear: `src/lib/db/migrations/001_project_snapshots.ts`
- Crear: `src/lib/db/migrations/index.ts`
- Test: `src/lib/db/migrations/001_project_snapshots.test.ts`

**Interfaces:**
- Consume: `Migration` y `MigrationClient` de `@/lib/db/migrator` (Tarea 5).
- Produce:
  - `export const migration001ProjectSnapshots: Migration`
  - `export const ALL_MIGRATIONS: Migration[]` (en `index.ts`)

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { MigrationClient } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";

function fakeClient(): MigrationClient & { sql: string[] } {
  const sql: string[] = [];
  return {
    sql,
    async query(text: string) {
      sql.push(text.trim());
      return { rows: [] };
    },
  };
}

describe("migración 001 · tabla project_snapshots", () => {
  test("el id declara el orden", () => {
    expect(migration001ProjectSnapshots.id).toBe("001_project_snapshots");
  });

  test("up crea la tabla con clave compuesta por proyecto y foto", async () => {
    const client = fakeClient();

    await migration001ProjectSnapshots.up(client);

    const creacion = client.sql.join("\n");
    expect(creacion).toContain("CREATE TABLE IF NOT EXISTS project_snapshots");
    expect(creacion).toContain("project_id TEXT NOT NULL");
    expect(creacion).toContain("origin TEXT NOT NULL");
    expect(creacion).toContain("captured_at TIMESTAMPTZ NOT NULL");
    expect(creacion).toContain("tasks JSONB NOT NULL");
    expect(creacion).toContain("PRIMARY KEY (project_id, id)");
  });

  test("up crea el índice de lectura por proyecto y fecha", async () => {
    const client = fakeClient();

    await migration001ProjectSnapshots.up(client);

    expect(client.sql.join("\n")).toContain(
      "CREATE INDEX IF NOT EXISTS idx_project_snapshots_project",
    );
  });

  test("down deshace el índice y la tabla, en ese orden", async () => {
    const client = fakeClient();

    await migration001ProjectSnapshots.down(client);

    expect(client.sql[0]).toContain("DROP INDEX IF EXISTS idx_project_snapshots_project");
    expect(client.sql[1]).toContain("DROP TABLE IF EXISTS project_snapshots");
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/db/migrations/001_project_snapshots.test.ts`
Esperado: FALLA con `Cannot find module './001_project_snapshots'`

- [ ] **Paso 3: Implementación mínima**

`src/lib/db/migrations/001_project_snapshots.ts`:

```ts
import type { Migration } from "@/lib/db/migrator";

/**
 * Las fotos del plan salen del blob `project_data` y viven en su propia tabla.
 *
 * `project_id` es TEXT a propósito: `ensureProjectsTable` declara `projects.id`
 * como UUID y el `init-schema.sql` heredado como SERIAL. TEXT sirve a los dos
 * sin atarse a ninguno.
 */
export const migration001ProjectSnapshots: Migration = {
  id: "001_project_snapshots",

  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_snapshots (
        project_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        origin TEXT NOT NULL,
        captured_at TIMESTAMPTZ NOT NULL,
        tasks JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (project_id, id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_project_snapshots_project
        ON project_snapshots (project_id, captured_at DESC);
    `);
  },

  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_project_snapshots_project;`);
    await client.query(`DROP TABLE IF EXISTS project_snapshots;`);
  },
};
```

`src/lib/db/migrations/index.ts`:

```ts
import type { Migration } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";

/** Todas las migraciones del proyecto, en orden de id. */
export const ALL_MIGRATIONS: Migration[] = [migration001ProjectSnapshots];
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/db/migrations/001_project_snapshots.test.ts`
Esperado: PASA (4 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/db/migrations && git commit -m "feat(cortes): las fotos del plan estrenan tabla propia, fuera del blob"
```

## Tarea 7: El tipo de una foto y cómo se toma

**Archivos:**
- Crear: `src/types/snapshot.ts`
- Crear: `src/lib/scheduling/snapshots.ts`
- Test: `src/lib/scheduling/snapshots.test.ts`

**Interfaces:**
- Consume: `GanttTask` de `@/components/gantt/types`; `Baseline` y `BaselineTask` de `@/types/baseline`.
- Produce (en `src/types/snapshot.ts`):
  - `export type SnapshotOrigin = "import" | "manual" | "baseline"`
  - `export interface SnapshotTask { taskId: string | number; name?: string; start: Date; finish: Date; duration: number; progress?: number }`
  - `export interface ProjectSnapshot { id: string; projectId: string; name: string; origin: SnapshotOrigin; capturedAt: Date; tasks: SnapshotTask[] }`
  - `export interface ProjectSnapshotSummary { id: string; name: string; origin: SnapshotOrigin; capturedAt: Date; taskCount: number }`
- Produce (en `src/lib/scheduling/snapshots.ts`):
  - `export function createSnapshotFromTasks(tasks: GanttTask[], options: { projectId: string; name: string; origin: SnapshotOrigin; capturedAt: Date; id?: string }): ProjectSnapshot`
  - `export function baselineToSnapshot(baseline: Baseline, projectId: string): ProjectSnapshot`
  - `export function summarizeSnapshot(snapshot: ProjectSnapshot): ProjectSnapshotSummary`

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import { createProjectDate } from "@/lib/date/projectDate";
import {
  baselineToSnapshot,
  createSnapshotFromTasks,
  summarizeSnapshot,
} from "./snapshots";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("createSnapshotFromTasks", () => {
  test("guarda fechas, duración y avance de cada actividad", () => {
    const foto = createSnapshotFromTasks([task({ id: 7, progress: 40 })], {
      projectId: "p1",
      name: "Corte de enero",
      origin: "manual",
      capturedAt: createProjectDate("2026-01-20"),
      id: "foto-1",
    });

    expect(foto).toEqual({
      id: "foto-1",
      projectId: "p1",
      name: "Corte de enero",
      origin: "manual",
      capturedAt: createProjectDate("2026-01-20"),
      tasks: [
        {
          taskId: 7,
          name: "Actividad 7",
          start: createProjectDate("2026-01-01"),
          finish: createProjectDate("2026-01-10"),
          duration: 10,
          progress: 40,
        },
      ],
    });
  });

  test("sin id explícito genera uno", () => {
    const foto = createSnapshotFromTasks([task({ id: 1 })], {
      projectId: "p1",
      name: "Corte",
      origin: "import",
      capturedAt: createProjectDate("2026-01-20"),
    });

    expect(foto.id).toEqual(expect.any(String));
    expect(foto.id.length).toBeGreaterThan(0);
  });
});

describe("baselineToSnapshot", () => {
  test("una línea base ya es una foto: conserva su id, su nombre y su fecha", () => {
    const baseline: Baseline = {
      id: "baseline-3",
      name: "Contractual",
      createdAt: createProjectDate("2026-01-05"),
      tasks: [
        {
          taskId: 7,
          baselineStart: createProjectDate("2026-01-01"),
          baselineFinish: createProjectDate("2026-01-08"),
          baselineDuration: 8,
        },
      ],
    };

    expect(baselineToSnapshot(baseline, "p1")).toEqual({
      id: "baseline-3",
      projectId: "p1",
      name: "Contractual",
      origin: "baseline",
      capturedAt: createProjectDate("2026-01-05"),
      tasks: [
        {
          taskId: 7,
          start: createProjectDate("2026-01-01"),
          finish: createProjectDate("2026-01-08"),
          duration: 8,
        },
      ],
    });
  });
});

describe("summarizeSnapshot", () => {
  test("el resumen lleva el conteo en vez de las tareas", () => {
    const foto = createSnapshotFromTasks([task({ id: 1 }), task({ id: 2 })], {
      projectId: "p1",
      name: "Corte",
      origin: "import",
      capturedAt: createProjectDate("2026-01-20"),
      id: "foto-1",
    });

    expect(summarizeSnapshot(foto)).toEqual({
      id: "foto-1",
      name: "Corte",
      origin: "import",
      capturedAt: createProjectDate("2026-01-20"),
      taskCount: 2,
    });
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/scheduling/snapshots.test.ts`
Esperado: FALLA con `Cannot find module './snapshots' from 'src/lib/scheduling/snapshots.test.ts'`

- [ ] **Paso 3: Implementación mínima**

`src/types/snapshot.ts`:

```ts
/**
 * Fotos del plan: cada versión del cronograma que pasó por la obra.
 *
 * Viven en la tabla `project_snapshots`, no dentro del blob del proyecto: el
 * autoguardado no debe enterarse de que existen.
 */

/** De dónde salió la foto. `baseline` son las líneas base que ya existían. */
export type SnapshotOrigin = "import" | "manual" | "baseline";

export interface SnapshotTask {
  taskId: string | number;
  name?: string;
  start: Date;
  finish: Date;
  /** Días. */
  duration: number;
  /** 0–100. Ausente en las fotos que vienen de una línea base. */
  progress?: number;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  name: string;
  origin: SnapshotOrigin;
  capturedAt: Date;
  tasks: SnapshotTask[];
}

/** Lo que basta para listar las fotos sin traerse todas las tareas. */
export interface ProjectSnapshotSummary {
  id: string;
  name: string;
  origin: SnapshotOrigin;
  capturedAt: Date;
  taskCount: number;
}
```

`src/lib/scheduling/snapshots.ts`:

```ts
import type { GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import type {
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SnapshotOrigin,
} from "@/types/snapshot";

export function createSnapshotFromTasks(
  tasks: GanttTask[],
  options: {
    projectId: string;
    name: string;
    origin: SnapshotOrigin;
    capturedAt: Date;
    id?: string;
  },
): ProjectSnapshot {
  return {
    id: options.id ?? crypto.randomUUID(),
    projectId: options.projectId,
    name: options.name,
    origin: options.origin,
    capturedAt: options.capturedAt,
    tasks: tasks.map((task) => ({
      taskId: task.id,
      name: task.name,
      start: task.start,
      finish: task.finish,
      duration: task.duration,
      progress: task.progress,
    })),
  };
}

/**
 * Cada línea base guardada ya es una foto del plan en una fecha. Se conserva
 * su `id` para que la misma foto no aparezca dos veces al fusionar fuentes.
 */
export function baselineToSnapshot(
  baseline: Baseline,
  projectId: string,
): ProjectSnapshot {
  return {
    id: baseline.id,
    projectId,
    name: baseline.name,
    origin: "baseline",
    capturedAt: baseline.createdAt,
    tasks: baseline.tasks.map((task) => ({
      taskId: task.taskId,
      start: task.baselineStart,
      finish: task.baselineFinish,
      duration: task.baselineDuration,
    })),
  };
}

export function summarizeSnapshot(
  snapshot: ProjectSnapshot,
): ProjectSnapshotSummary {
  return {
    id: snapshot.id,
    name: snapshot.name,
    origin: snapshot.origin,
    capturedAt: snapshot.capturedAt,
    taskCount: snapshot.tasks.length,
  };
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/scheduling/snapshots.test.ts`
Esperado: PASA (4 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/types/snapshot.ts v2/src/lib/scheduling/snapshots.ts v2/src/lib/scheduling/snapshots.test.ts && git commit -m "feat(cortes): una foto del plan, y la linea base que ya lo era"
```

## Tarea 8: La migración que copia las líneas base, y sabe volver atrás

**Archivos:**
- Crear: `src/lib/db/migrations/002_baselines_as_snapshots.ts`
- Modificar: `src/lib/db/migrations/index.ts`
- Test: `src/lib/db/migrations/002_baselines_as_snapshots.test.ts`

**Interfaces:**
- Consume: `Migration` y `MigrationClient` de `@/lib/db/migrator` (Tarea 5); la forma serializada de `Baseline` que ya vive en el blob (`{ id, name, createdAt: string, tasks: [{ taskId, baselineStart: string, baselineFinish: string, baselineDuration: number }] }`).
- Produce:
  - `export const migration002BaselinesAsSnapshots: Migration`
  - `ALL_MIGRATIONS` pasa a tener dos entradas.

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { MigrationClient } from "@/lib/db/migrator";
import { migration002BaselinesAsSnapshots } from "./002_baselines_as_snapshots";

interface FilaInsertada {
  projectId: string;
  id: string;
  name: string;
  origin: string;
  capturedAt: string;
  tasks: string;
}

/** Cliente falso con un proyecto que ya tiene dos líneas base dentro del blob. */
function fakeClient(): MigrationClient & {
  insertadas: FilaInsertada[];
  borrados: string[];
  blobIntacto: () => boolean;
} {
  const insertadas: FilaInsertada[] = [];
  const borrados: string[] = [];
  let blobEscrito = false;

  const projectRow = {
    id: "p1",
    project_data: {
      name: "Estación 16",
      baselines: [
        {
          id: "baseline-1",
          name: "Contractual",
          createdAt: "2026-01-05T00:00:00.000Z",
          tasks: [
            {
              taskId: 7,
              baselineStart: "2026-01-01T00:00:00.000Z",
              baselineFinish: "2026-01-08T00:00:00.000Z",
              baselineDuration: 8,
            },
          ],
        },
        {
          id: "baseline-2",
          name: "Reprogramación",
          createdAt: "2026-02-05T00:00:00.000Z",
          tasks: [],
        },
      ],
    },
  };

  return {
    insertadas,
    borrados,
    blobIntacto: () => !blobEscrito,
    async query(text: string, params?: unknown[]) {
      if (text.includes("SELECT id, project_data FROM projects")) {
        return { rows: [projectRow as unknown as Record<string, unknown>] };
      }
      if (text.includes("INSERT INTO project_snapshots")) {
        insertadas.push({
          projectId: String(params?.[0]),
          id: String(params?.[1]),
          name: String(params?.[2]),
          origin: "baseline",
          capturedAt: String(params?.[3]),
          tasks: String(params?.[4]),
        });
        return { rows: [] };
      }
      if (text.includes("DELETE FROM project_snapshots")) {
        borrados.push(text.trim());
        return { rows: [] };
      }
      if (text.includes("UPDATE projects")) {
        blobEscrito = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

describe("migración 002 · las líneas base pasan a ser fotos", () => {
  test("up copia cada línea base conservando su id", async () => {
    const client = fakeClient();

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.insertadas.map((fila) => fila.id)).toEqual([
      "baseline-1",
      "baseline-2",
    ]);
    expect(client.insertadas[0].projectId).toBe("p1");
    expect(client.insertadas[0].name).toBe("Contractual");
  });

  test("up traduce las tareas de la línea base al formato de foto", async () => {
    const client = fakeClient();

    await migration002BaselinesAsSnapshots.up(client);

    expect(JSON.parse(client.insertadas[0].tasks)).toEqual([
      {
        taskId: 7,
        start: "2026-01-01T00:00:00.000Z",
        finish: "2026-01-08T00:00:00.000Z",
        duration: 8,
      },
    ]);
  });

  test("up no toca el blob: las líneas base siguen donde estaban", async () => {
    const client = fakeClient();

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.blobIntacto()).toBe(true);
  });

  test("la inserción no puede duplicar una foto ya copiada", async () => {
    const client = fakeClient();
    const sqls: string[] = [];
    const espia: MigrationClient = {
      query: async (text, params) => {
        sqls.push(text);
        return client.query(text, params);
      },
    };

    await migration002BaselinesAsSnapshots.up(espia);

    expect(sqls.find((sql) => sql.includes("INSERT INTO project_snapshots"))).toContain(
      "ON CONFLICT (project_id, id) DO NOTHING",
    );
  });

  test("down borra solo lo que esta migración creó", async () => {
    const client = fakeClient();

    await migration002BaselinesAsSnapshots.down(client);

    expect(client.borrados).toHaveLength(1);
    expect(client.borrados[0]).toContain("WHERE origin = 'baseline'");
    expect(client.blobIntacto()).toBe(true);
  });

  test("ida y vuelta: tras up y down no queda ninguna foto de origen línea base", async () => {
    const client = fakeClient();

    await migration002BaselinesAsSnapshots.up(client);
    await migration002BaselinesAsSnapshots.down(client);

    expect(client.insertadas.every((fila) => fila.origin === "baseline")).toBe(true);
    expect(client.borrados[0]).toContain("DELETE FROM project_snapshots");
    expect(client.blobIntacto()).toBe(true);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/db/migrations/002_baselines_as_snapshots.test.ts`
Esperado: FALLA con `Cannot find module './002_baselines_as_snapshots'`

- [ ] **Paso 3: Implementación mínima**

`src/lib/db/migrations/002_baselines_as_snapshots.ts`:

```ts
import type { Migration } from "@/lib/db/migrator";

/**
 * Las líneas base que ya viven dentro del blob se copian a la tabla de fotos
 * **conservando su id**. No se borran del blob: si este despliegue se revierte,
 * la app anterior las sigue encontrando donde siempre estuvieron.
 *
 * Como la identidad se conserva, la misma foto no puede aparecer dos veces: la
 * clave primaria `(project_id, id)` lo impide y el lector fusiona por id.
 */

interface BlobBaselineTask {
  taskId: string | number;
  baselineStart: string;
  baselineFinish: string;
  baselineDuration: number;
}

interface BlobBaseline {
  id: string;
  name: string;
  createdAt: string;
  tasks?: BlobBaselineTask[];
}

export const migration002BaselinesAsSnapshots: Migration = {
  id: "002_baselines_as_snapshots",

  async up(client) {
    const result = await client.query("SELECT id, project_data FROM projects");

    for (const row of result.rows) {
      const projectId = String(row.id);
      const projectData = row.project_data as { baselines?: BlobBaseline[] } | null;

      for (const baseline of projectData?.baselines ?? []) {
        const tasks = (baseline.tasks ?? []).map((task) => ({
          taskId: task.taskId,
          start: task.baselineStart,
          finish: task.baselineFinish,
          duration: task.baselineDuration,
        }));

        await client.query(
          `INSERT INTO project_snapshots (project_id, id, name, origin, captured_at, tasks)
           VALUES ($1, $2, $3, 'baseline', $4, $5)
           ON CONFLICT (project_id, id) DO NOTHING`,
          [
            projectId,
            baseline.id,
            baseline.name,
            baseline.createdAt,
            JSON.stringify(tasks),
          ],
        );
      }
    }
  },

  async down(client) {
    await client.query(`DELETE FROM project_snapshots WHERE origin = 'baseline'`);
  },
};
```

`src/lib/db/migrations/index.ts` pasa a:

```ts
import type { Migration } from "@/lib/db/migrator";
import { migration001ProjectSnapshots } from "./001_project_snapshots";
import { migration002BaselinesAsSnapshots } from "./002_baselines_as_snapshots";

/** Todas las migraciones del proyecto, en orden de id. */
export const ALL_MIGRATIONS: Migration[] = [
  migration001ProjectSnapshots,
  migration002BaselinesAsSnapshots,
];
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/db/migrations`
Esperado: PASA (10 tests entre las dos suites de migración)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/db/migrations && git commit -m "feat(cortes): las lineas base existentes valen como fotos, sin duplicarse ni perderse"
```

## Tarea 9: Leer y escribir fotos, nunca en el camino del guardado

**Archivos:**
- Crear: `src/app/actions/snapshots.ts`
- Test: `src/app/actions/snapshots.test.ts`

**Interfaces:**
- Consume: `pool` de `@/lib/db`; `migrationClient`, `runMigrations` de `@/lib/db/migrator` (Tarea 5); `ALL_MIGRATIONS` de `@/lib/db/migrations` (Tarea 8); `ProjectSnapshot`, `ProjectSnapshotSummary`, `SnapshotOrigin` de `@/types/snapshot` (Tarea 7).
- Produce:
  - `export async function listProjectSnapshots(projectId: string): Promise<ProjectSnapshotSummary[]>`
  - `export async function loadProjectSnapshot(projectId: string, snapshotId: string): Promise<ProjectSnapshot | null>`
  - `export async function saveProjectSnapshot(snapshot: ProjectSnapshot): Promise<{ success: boolean; error?: string }>`

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { ProjectSnapshot } from "@/types/snapshot";
import { createProjectDate } from "@/lib/date/projectDate";

const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect },
}));

import {
  listProjectSnapshots,
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "./snapshots";

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [] });
});

/** Todo el SQL que la acción ejecutó, en un solo texto. */
function sqlEjecutado(): string {
  return query.mock.calls.map((call) => String(call[0])).join("\n");
}

describe("listProjectSnapshots", () => {
  test("devuelve los resúmenes ordenados de la foto más nueva a la más vieja", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("SELECT id, name, origin, captured_at")) {
        return {
          rows: [
            {
              id: "foto-2",
              name: "Corte de febrero",
              origin: "import",
              captured_at: "2026-02-05T00:00:00.000Z",
              task_count: "12",
            },
            {
              id: "foto-1",
              name: "Contractual",
              origin: "baseline",
              captured_at: "2026-01-05T00:00:00.000Z",
              task_count: "9",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const fotos = await listProjectSnapshots("p1");

    expect(fotos).toHaveLength(2);
    expect(fotos[0]).toEqual({
      id: "foto-2",
      name: "Corte de febrero",
      origin: "import",
      capturedAt: new Date("2026-02-05T00:00:00.000Z"),
      taskCount: 12,
    });
    expect(sqlEjecutado()).toContain("ORDER BY captured_at DESC");
  });

  test("aplica las migraciones antes de leer, para que la tabla exista", async () => {
    await listProjectSnapshots("p1");

    expect(sqlEjecutado()).toContain("CREATE TABLE IF NOT EXISTS schema_migrations");
  });

  test("suelta el cliente aunque la consulta falle", async () => {
    query.mockRejectedValue(new Error("sin conexión"));

    await expect(listProjectSnapshots("p1")).resolves.toEqual([]);
    expect(release).toHaveBeenCalled();
  });
});

describe("loadProjectSnapshot", () => {
  test("reconstruye las fechas de la foto", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("SELECT id, name, origin, captured_at, tasks")) {
        return {
          rows: [
            {
              id: "foto-1",
              name: "Contractual",
              origin: "baseline",
              captured_at: "2026-01-05T00:00:00.000Z",
              tasks: [
                {
                  taskId: 7,
                  start: "2026-01-01T00:00:00.000Z",
                  finish: "2026-01-08T00:00:00.000Z",
                  duration: 8,
                },
              ],
            },
          ],
        };
      }
      return { rows: [] };
    });

    const foto = await loadProjectSnapshot("p1", "foto-1");

    expect(foto).not.toBeNull();
    expect(foto!.capturedAt).toEqual(new Date("2026-01-05T00:00:00.000Z"));
    expect(foto!.tasks[0].start).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(foto!.tasks[0].duration).toBe(8);
  });

  test("una foto que no existe devuelve null, no un error", async () => {
    await expect(loadProjectSnapshot("p1", "no-existe")).resolves.toBeNull();
  });
});

describe("saveProjectSnapshot", () => {
  const foto: ProjectSnapshot = {
    id: "foto-1",
    projectId: "p1",
    name: "Corte de enero",
    origin: "manual",
    capturedAt: createProjectDate("2026-01-20"),
    tasks: [
      {
        taskId: 7,
        name: "Excavación",
        start: createProjectDate("2026-01-01"),
        finish: createProjectDate("2026-01-10"),
        duration: 10,
        progress: 40,
      },
    ],
  };

  test("inserta la foto sin pisar una ya existente con el mismo id", async () => {
    const resultado = await saveProjectSnapshot(foto);

    expect(resultado).toEqual({ success: true });
    expect(sqlEjecutado()).toContain("INSERT INTO project_snapshots");
    expect(sqlEjecutado()).toContain("ON CONFLICT (project_id, id) DO NOTHING");
  });

  test("un fallo de base de datos se informa, no se traga", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("INSERT INTO project_snapshots")) {
        throw new Error("disco lleno");
      }
      return { rows: [] };
    });

    const resultado = await saveProjectSnapshot(foto);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toContain("disco lleno");
    expect(release).toHaveBeenCalled();
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/app/actions/snapshots.test.ts`
Esperado: FALLA con `Cannot find module './snapshots' from 'src/app/actions/snapshots.test.ts'`

- [ ] **Paso 3: Implementación mínima**

```ts
"use server";

import pool from "@/lib/db";
import { migrationClient, runMigrations } from "@/lib/db/migrator";
import { ALL_MIGRATIONS } from "@/lib/db/migrations";
import type {
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SnapshotOrigin,
  SnapshotTask,
} from "@/types/snapshot";

/**
 * Acceso a las fotos del plan.
 *
 * Se llama **solo al abrir el tablero**. Nada de esto entra en el camino del
 * guardado: `saveProject` sigue escribiendo un único blob y no sabe que estas
 * filas existen.
 */

interface SerializedSnapshotTask {
  taskId: string | number;
  name?: string;
  start: string;
  finish: string;
  duration: number;
  progress?: number;
}

function deserializeTasks(raw: SerializedSnapshotTask[]): SnapshotTask[] {
  return raw.map((task) => ({
    taskId: task.taskId,
    name: task.name,
    start: new Date(task.start),
    finish: new Date(task.finish),
    duration: task.duration,
    progress: task.progress,
  }));
}

function serializeTasks(tasks: SnapshotTask[]): SerializedSnapshotTask[] {
  return tasks.map((task) => ({
    taskId: task.taskId,
    name: task.name,
    start: task.start.toISOString(),
    finish: task.finish.toISOString(),
    duration: task.duration,
    progress: task.progress,
  }));
}

export async function listProjectSnapshots(
  projectId: string,
): Promise<ProjectSnapshotSummary[]> {
  const client = await pool.connect();
  try {
    await runMigrations(migrationClient(client), ALL_MIGRATIONS);
    const result = await client.query(
      `SELECT id, name, origin, captured_at,
              jsonb_array_length(tasks) AS task_count
         FROM project_snapshots
        WHERE project_id = $1
        ORDER BY captured_at DESC`,
      [projectId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      origin: String(row.origin) as SnapshotOrigin,
      capturedAt: new Date(row.captured_at),
      taskCount: Number(row.task_count),
    }));
  } catch (err) {
    console.error("listProjectSnapshots error:", err);
    return [];
  } finally {
    client.release();
  }
}

export async function loadProjectSnapshot(
  projectId: string,
  snapshotId: string,
): Promise<ProjectSnapshot | null> {
  const client = await pool.connect();
  try {
    await runMigrations(migrationClient(client), ALL_MIGRATIONS);
    const result = await client.query(
      `SELECT id, name, origin, captured_at, tasks
         FROM project_snapshots
        WHERE project_id = $1 AND id = $2`,
      [projectId, snapshotId],
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      id: String(row.id),
      projectId,
      name: String(row.name),
      origin: String(row.origin) as SnapshotOrigin,
      capturedAt: new Date(row.captured_at),
      tasks: deserializeTasks(row.tasks as SerializedSnapshotTask[]),
    };
  } catch (err) {
    console.error("loadProjectSnapshot error:", err);
    return null;
  } finally {
    client.release();
  }
}

export async function saveProjectSnapshot(
  snapshot: ProjectSnapshot,
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await runMigrations(migrationClient(client), ALL_MIGRATIONS);
    await client.query(
      `INSERT INTO project_snapshots (project_id, id, name, origin, captured_at, tasks)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id, id) DO NOTHING`,
      [
        snapshot.projectId,
        snapshot.id,
        snapshot.name,
        snapshot.origin,
        snapshot.capturedAt.toISOString(),
        JSON.stringify(serializeTasks(snapshot.tasks)),
      ],
    );
    return { success: true };
  } catch (err) {
    console.error("saveProjectSnapshot error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido al guardar la foto",
    };
  } finally {
    client.release();
  }
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/app/actions/snapshots.test.ts`
Esperado: PASA (7 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/app/actions/snapshots.ts v2/src/app/actions/snapshots.test.ts && git commit -m "feat(cortes): leer y escribir fotos sin pasar por el camino del guardado"
```

## Tarea 10: La valla que impide que el guardado toque las fotos

**Archivos:**
- Test: `src/app/actions/project.snapshots.test.ts`

**Interfaces:**
- Consume: `saveProject(projectData: ProjectData): Promise<{ success: boolean; id?: string; error?: string }>` de `@/app/actions/project`; `ProjectData` del mismo módulo.
- Produce: ninguna interfaz nueva. Es una valla de regresión: si alguien mete una consulta a `project_snapshots` en el camino del autoguardado, este test se pone rojo.

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { ProjectData } from "./project";
import { createProjectDate } from "@/lib/date/projectDate";

const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect },
}));

jest.mock("@/lib/auth/session", () => ({
  getCurrentUser: jest.fn(async () => ({ id: "user-1", email: "aia@example.com" })),
}));

jest.mock("@/lib/auth/rbac", () => ({
  userHasPermission: jest.fn(async () => true),
}));

import { saveProject } from "./project";

function proyecto(): ProjectData {
  return {
    id: "p1",
    name: "Estación 16",
    tasks: [],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [
      {
        id: "baseline-1",
        name: "Contractual",
        createdAt: createProjectDate("2026-01-05"),
        tasks: [],
      },
    ],
    calendar: {
      timeZone: "America/Bogota",
      workDays: [1, 2, 3, 4, 5],
      startHour: "08:00",
      endHour: "17:00",
      hoursPerDay: 8,
      nonWorkingDays: [],
      dateOverrides: [],
    },
  };
}

beforeEach(() => {
  query.mockReset();
  release.mockReset();
  query.mockResolvedValue({ rows: [{ id: "p1" }] });
});

describe("saveProject no se entera de que las fotos existen (A2)", () => {
  test("guardar un proyecto no consulta project_snapshots", async () => {
    await saveProject(proyecto());

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).not.toContain("project_snapshots");
  });

  test("guardar un proyecto tampoco dispara el migrador", async () => {
    await saveProject(proyecto());

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).not.toContain("schema_migrations");
  });

  test("las líneas base siguen viajando dentro del blob", async () => {
    await saveProject(proyecto());

    const update = query.mock.calls.find((call) =>
      String(call[0]).includes("UPDATE projects"),
    );
    expect(update).toBeDefined();
    const blob = JSON.parse(String((update![1] as unknown[])[1]));
    expect(blob.baselines).toHaveLength(1);
    expect(blob.baselines[0].id).toBe("baseline-1");
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/app/actions/project.snapshots.test.ts`
Esperado: FALLA con `Cannot find module './project.snapshots.test'`… no: falla al crear el archivo por primera vez con `Your test suite must contain at least one test.` si se guarda vacío. Con el contenido de arriba **el test debe pasar en verde de entrada**, porque describe el comportamiento actual que hay que proteger. Para verlo fallar primero, se ejecuta con la valla invertida: cambiar temporalmente `expect(sql).not.toContain("project_snapshots")` por `expect(sql).toContain("project_snapshots")` y comprobar que FALLA con `Expected substring: "project_snapshots"` — eso prueba que la aserción mira de verdad el SQL ejecutado. Después se devuelve el `not` y queda verde.

- [ ] **Paso 3: Implementación mínima**

Ninguna. Esta tarea no añade código de producción: fija por escrito la decisión de A2 de que el autoguardado no crece con las fotos. Restaurar el `not` en las dos primeras aserciones tras la comprobación del Paso 2.

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/app/actions/project.snapshots.test.ts src/app/actions/project.test.ts`
Esperado: PASA — los 3 tests nuevos y toda la suite existente de `project.test.ts`

- [ ] **Paso 5: Commit**

```bash
git add v2/src/app/actions/project.snapshots.test.ts && git commit -m "test(cortes): valla que se pone roja si el guardado vuelve a cargar con las fotos"
```

## Tarea 11: Comparar el plan de hoy contra una foto

**Archivos:**
- Modificar: `src/lib/scheduling/snapshots.ts` (se añade al final del archivo creado en la Tarea 7)
- Test: `src/lib/scheduling/snapshots.test.ts` (se añade un `describe` nuevo)

**Interfaces:**
- Consume: `ProjectSnapshot` y `SnapshotTask` de `@/types/snapshot`; `GanttTask` de `@/components/gantt/types`.
- Produce:
  - `export type SnapshotChangeKind = "atrasada" | "adelantada" | "sinCambio" | "nueva" | "eliminada"`
  - `export interface SnapshotChange { taskId: string | number; taskName: string; kind: SnapshotChangeKind; startShiftDays: number; finishShiftDays: number }`
  - `export interface SnapshotComparison { changes: SnapshotChange[]; delayedCount: number; aheadCount: number; addedCount: number; removedCount: number; unchangedCount: number }`
  - `export function compareSnapshotToTasks(snapshot: ProjectSnapshot, tasks: GanttTask[]): SnapshotComparison`

- [ ] **Paso 1: Escribir el test que falla**

```ts
// Se añade al final de src/lib/scheduling/snapshots.test.ts.
// Se añade `compareSnapshotToTasks` al import de "./snapshots",
// y `import type { ProjectSnapshot } from "@/types/snapshot";` a la cabecera.

describe("compareSnapshotToTasks", () => {
  function foto(tareas: ProjectSnapshot["tasks"]): ProjectSnapshot {
    return {
      id: "foto-1",
      projectId: "p1",
      name: "Corte de enero",
      origin: "import",
      capturedAt: createProjectDate("2026-01-20"),
      tasks: tareas,
    };
  }

  const enFoto = {
    taskId: 1,
    name: "Excavación",
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
  };

  test("una tarea que se atrasó se marca con los días que se corrió", () => {
    const comparacion = compareSnapshotToTasks(foto([enFoto]), [
      task({
        id: 1,
        name: "Excavación",
        start: createProjectDate("2026-01-04"),
        finish: createProjectDate("2026-01-13"),
      }),
    ]);

    expect(comparacion.changes).toEqual([
      {
        taskId: 1,
        taskName: "Excavación",
        kind: "atrasada",
        startShiftDays: 3,
        finishShiftDays: 3,
      },
    ]);
    expect(comparacion.delayedCount).toBe(1);
  });

  test("una tarea que se adelantó lleva los días en negativo", () => {
    const comparacion = compareSnapshotToTasks(foto([enFoto]), [
      task({
        id: 1,
        name: "Excavación",
        start: createProjectDate("2025-12-30"),
        finish: createProjectDate("2026-01-08"),
      }),
    ]);

    expect(comparacion.changes[0].kind).toBe("adelantada");
    expect(comparacion.changes[0].finishShiftDays).toBe(-2);
    expect(comparacion.aheadCount).toBe(1);
  });

  test("una tarea que no se movió se cuenta aparte", () => {
    const comparacion = compareSnapshotToTasks(foto([enFoto]), [
      task({
        id: 1,
        name: "Excavación",
        start: createProjectDate("2026-01-01"),
        finish: createProjectDate("2026-01-10"),
      }),
    ]);

    expect(comparacion.changes[0].kind).toBe("sinCambio");
    expect(comparacion.unchangedCount).toBe(1);
    expect(comparacion.delayedCount).toBe(0);
  });

  test("una tarea que no existía en la foto es nueva", () => {
    const comparacion = compareSnapshotToTasks(foto([]), [
      task({ id: 9, name: "Rejillas" }),
    ]);

    expect(comparacion.changes).toEqual([
      {
        taskId: 9,
        taskName: "Rejillas",
        kind: "nueva",
        startShiftDays: 0,
        finishShiftDays: 0,
      },
    ]);
    expect(comparacion.addedCount).toBe(1);
  });

  test("una tarea que estaba en la foto y ya no está se marca eliminada", () => {
    const comparacion = compareSnapshotToTasks(foto([enFoto]), []);

    expect(comparacion.changes).toEqual([
      {
        taskId: 1,
        taskName: "Excavación",
        kind: "eliminada",
        startShiftDays: 0,
        finishShiftDays: 0,
      },
    ]);
    expect(comparacion.removedCount).toBe(1);
  });

  test("las eliminadas van al final, después de las que siguen vivas", () => {
    const comparacion = compareSnapshotToTasks(
      foto([enFoto, { ...enFoto, taskId: 2, name: "Rellenos" }]),
      [task({ id: 1, name: "Excavación", start: createProjectDate("2026-01-01"), finish: createProjectDate("2026-01-10") })],
    );

    expect(comparacion.changes.map((cambio) => cambio.kind)).toEqual([
      "sinCambio",
      "eliminada",
    ]);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/scheduling/snapshots.test.ts -t "compareSnapshotToTasks"`
Esperado: FALLA con `TypeError: (0 , _snapshots.compareSnapshotToTasks) is not a function`

- [ ] **Paso 3: Implementación mínima**

```ts
export type SnapshotChangeKind =
  | "atrasada"
  | "adelantada"
  | "sinCambio"
  | "nueva"
  | "eliminada";

export interface SnapshotChange {
  taskId: string | number;
  taskName: string;
  kind: SnapshotChangeKind;
  /** Días que se corrió el inicio: positivo se atrasó, negativo se adelantó. */
  startShiftDays: number;
  /** Días que se corrió el fin: positivo se atrasó, negativo se adelantó. */
  finishShiftDays: number;
}

export interface SnapshotComparison {
  changes: SnapshotChange[];
  delayedCount: number;
  aheadCount: number;
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

function dayShift(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Compara el plan actual contra una foto: qué se movió, cuánto y en qué
 * dirección. Las tareas que ya no existen se listan al final, porque son la
 * parte de la historia que el plan de hoy no puede contar por sí solo.
 */
export function compareSnapshotToTasks(
  snapshot: ProjectSnapshot,
  tasks: GanttTask[],
): SnapshotComparison {
  const snapshotById = new Map(
    snapshot.tasks.map((task) => [String(task.taskId), task]),
  );
  const seen = new Set<string>();
  const changes: SnapshotChange[] = [];

  for (const task of tasks) {
    const key = String(task.id);
    const before = snapshotById.get(key);

    if (!before) {
      changes.push({
        taskId: task.id,
        taskName: task.name,
        kind: "nueva",
        startShiftDays: 0,
        finishShiftDays: 0,
      });
      continue;
    }

    seen.add(key);
    const startShiftDays = dayShift(before.start, task.start);
    const finishShiftDays = dayShift(before.finish, task.finish);
    const kind: SnapshotChangeKind =
      finishShiftDays > 0
        ? "atrasada"
        : finishShiftDays < 0
          ? "adelantada"
          : "sinCambio";

    changes.push({
      taskId: task.id,
      taskName: task.name,
      kind,
      startShiftDays,
      finishShiftDays,
    });
  }

  for (const before of snapshot.tasks) {
    const key = String(before.taskId);
    if (seen.has(key)) continue;
    changes.push({
      taskId: before.taskId,
      taskName: before.name ?? String(before.taskId),
      kind: "eliminada",
      startShiftDays: 0,
      finishShiftDays: 0,
    });
  }

  const count = (kind: SnapshotChangeKind) =>
    changes.filter((change) => change.kind === kind).length;

  return {
    changes,
    delayedCount: count("atrasada"),
    aheadCount: count("adelantada"),
    addedCount: count("nueva"),
    removedCount: count("eliminada"),
    unchangedCount: count("sinCambio"),
  };
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/scheduling/snapshots.test.ts`
Esperado: PASA (10 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/scheduling/snapshots.ts v2/src/lib/scheduling/snapshots.test.ts && git commit -m "feat(cortes): comparar el plan de hoy contra una foto, tarea por tarea"
```

## Tarea 12: Fusionar las dos fuentes de fotos sin duplicar ninguna

**Archivos:**
- Modificar: `src/lib/scheduling/snapshots.ts` (se añade al final)
- Test: `src/lib/scheduling/snapshots.test.ts` (se añade un `describe` nuevo)

**Interfaces:**
- Consume: `ProjectSnapshotSummary` de `@/types/snapshot`; `Baseline` de `@/types/baseline`; `baselineToSnapshot(baseline: Baseline, projectId: string): ProjectSnapshot` y `summarizeSnapshot(snapshot: ProjectSnapshot): ProjectSnapshotSummary` de la Tarea 7.
- Produce:
  - `export function mergeSnapshotSources(stored: ProjectSnapshotSummary[], baselines: Baseline[], projectId: string): ProjectSnapshotSummary[]`

- [ ] **Paso 1: Escribir el test que falla**

```ts
// Se añade al final de src/lib/scheduling/snapshots.test.ts.
// Se añade `mergeSnapshotSources` al import de "./snapshots"
// y `import type { ProjectSnapshotSummary } from "@/types/snapshot";` a la cabecera.

describe("mergeSnapshotSources", () => {
  const enTabla: ProjectSnapshotSummary = {
    id: "foto-import",
    name: "Importación del 5 de febrero",
    origin: "import",
    capturedAt: createProjectDate("2026-02-05"),
    taskCount: 12,
  };

  const lineaBase: Baseline = {
    id: "baseline-1",
    name: "Contractual",
    createdAt: createProjectDate("2026-01-05"),
    tasks: [
      {
        taskId: 7,
        baselineStart: createProjectDate("2026-01-01"),
        baselineFinish: createProjectDate("2026-01-08"),
        baselineDuration: 8,
      },
    ],
  };

  test("una línea base que aún no está en la tabla también aparece como foto", () => {
    const fotos = mergeSnapshotSources([enTabla], [lineaBase], "p1");

    expect(fotos.map((foto) => foto.id)).toEqual(["foto-import", "baseline-1"]);
    expect(fotos[1]).toEqual({
      id: "baseline-1",
      name: "Contractual",
      origin: "baseline",
      capturedAt: createProjectDate("2026-01-05"),
      taskCount: 1,
    });
  });

  test("una línea base ya copiada a la tabla no se muestra dos veces", () => {
    const yaCopiada: ProjectSnapshotSummary = {
      id: "baseline-1",
      name: "Contractual",
      origin: "baseline",
      capturedAt: createProjectDate("2026-01-05"),
      taskCount: 1,
    };

    const fotos = mergeSnapshotSources([yaCopiada], [lineaBase], "p1");

    expect(fotos).toHaveLength(1);
    expect(fotos[0].id).toBe("baseline-1");
  });

  test("la foto de la tabla gana cuando las dos fuentes traen el mismo id", () => {
    const yaCopiada: ProjectSnapshotSummary = {
      id: "baseline-1",
      name: "Contractual (renombrada)",
      origin: "baseline",
      capturedAt: createProjectDate("2026-01-05"),
      taskCount: 9,
    };

    const fotos = mergeSnapshotSources([yaCopiada], [lineaBase], "p1");

    expect(fotos[0].name).toBe("Contractual (renombrada)");
    expect(fotos[0].taskCount).toBe(9);
  });

  test("se ordenan de la foto más nueva a la más vieja", () => {
    const vieja: ProjectSnapshotSummary = {
      id: "foto-vieja",
      name: "Diciembre",
      origin: "import",
      capturedAt: createProjectDate("2025-12-01"),
      taskCount: 3,
    };

    const fotos = mergeSnapshotSources([vieja, enTabla], [lineaBase], "p1");

    expect(fotos.map((foto) => foto.id)).toEqual([
      "foto-import",
      "baseline-1",
      "foto-vieja",
    ]);
  });

  test("sin ninguna fuente devuelve lista vacía", () => {
    expect(mergeSnapshotSources([], [], "p1")).toEqual([]);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/scheduling/snapshots.test.ts -t "mergeSnapshotSources"`
Esperado: FALLA con `TypeError: (0 , _snapshots.mergeSnapshotSources) is not a function`

- [ ] **Paso 3: Implementación mínima**

```ts
/**
 * Fusiona las fotos de la tabla con las líneas base que aún viven en el blob.
 *
 * La identidad es el `id`: una línea base copiada a la tabla conserva el suyo,
 * así que la misma foto nunca se lista dos veces. Cuando el id coincide gana la
 * fila de la tabla, que es la que se puede leer entera.
 */
export function mergeSnapshotSources(
  stored: ProjectSnapshotSummary[],
  baselines: Baseline[],
  projectId: string,
): ProjectSnapshotSummary[] {
  const byId = new Map<string, ProjectSnapshotSummary>();

  for (const baseline of baselines) {
    const summary = summarizeSnapshot(baselineToSnapshot(baseline, projectId));
    byId.set(summary.id, summary);
  }
  for (const summary of stored) {
    byId.set(summary.id, summary);
  }

  return [...byId.values()].sort(
    (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
  );
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/scheduling/snapshots.test.ts`
Esperado: PASA (15 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/scheduling/snapshots.ts v2/src/lib/scheduling/snapshots.test.ts && git commit -m "feat(cortes): las lineas base y las fotos nuevas se listan juntas, cada una una sola vez"
```

## Tarea 13: El tablero por capas

**Archivos:**
- Crear: `src/components/views/SnapshotsBoardView.tsx`
- Test: `src/components/views/SnapshotsBoardView.test.tsx`

**Interfaces:**
- Consume: `ProjectSnapshot`, `ProjectSnapshotSummary` de `@/types/snapshot`; `compareSnapshotToTasks(snapshot, tasks): SnapshotComparison` de la Tarea 11; `GanttTask`; `formatProjectDate(date: Date, options?): string`.
- Produce:
  - `export interface SnapshotsBoardViewProps { tasks: GanttTask[]; summaries: ProjectSnapshotSummary[]; isLoading: boolean; loadSnapshot: (snapshotId: string) => Promise<ProjectSnapshot | null>; onMarkSnapshot: (name: string) => void }`
  - `export default function SnapshotsBoardView(props: SnapshotsBoardViewProps): JSX.Element`
  - Testids: `snapshots-board`, `snapshots-board-empty`, `snapshots-board-list`, `snapshots-board-comparison`, `snapshots-board-mark`, `snapshots-board-mark-name`.

La carga de la foto seleccionada la hace el componente al elegirla, no al montarse la app: el `loadSnapshot` que recibe es la acción de servidor de la Tarea 9. Así se cumple «se leen solo al abrir el tablero».

- [ ] **Paso 1: Escribir el test que falla**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import type { ProjectSnapshot, ProjectSnapshotSummary } from "@/types/snapshot";
import { createProjectDate } from "@/lib/date/projectDate";
import SnapshotsBoardView from "./SnapshotsBoardView";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

const resumen: ProjectSnapshotSummary = {
  id: "foto-1",
  name: "Importación del 5 de febrero",
  origin: "import",
  capturedAt: createProjectDate("2026-02-05"),
  taskCount: 1,
};

const foto: ProjectSnapshot = {
  id: "foto-1",
  projectId: "p1",
  name: "Importación del 5 de febrero",
  origin: "import",
  capturedAt: createProjectDate("2026-02-05"),
  tasks: [
    {
      taskId: 1,
      name: "Excavación",
      start: createProjectDate("2026-01-01"),
      finish: createProjectDate("2026-01-10"),
      duration: 10,
    },
  ],
};

describe("SnapshotsBoardView (A2)", () => {
  test("sin ninguna foto, el tablero enseña de dónde salen en vez de quedarse en blanco", () => {
    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[]}
        isLoading={false}
        loadSnapshot={async () => null}
        onMarkSnapshot={() => {}}
      />,
    );

    const vacio = screen.getByTestId("snapshots-board-empty");
    expect(vacio).toHaveTextContent(/cada vez que importas/i);
    expect(vacio).toHaveTextContent(/marcar un corte/i);
  });

  test("lista las fotos con su fecha y de dónde salieron", () => {
    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[resumen]}
        isLoading={false}
        loadSnapshot={async () => foto}
        onMarkSnapshot={() => {}}
      />,
    );

    const lista = screen.getByTestId("snapshots-board-list");
    expect(lista).toHaveTextContent("Importación del 5 de febrero");
    expect(lista).toHaveTextContent("05/02/2026");
    expect(lista).toHaveTextContent("Importación");
  });

  test("al elegir una foto se carga y se compara contra el plan de hoy", async () => {
    const loadSnapshot = jest.fn(async () => foto);

    render(
      <SnapshotsBoardView
        tasks={[
          task({
            id: 1,
            name: "Excavación",
            start: createProjectDate("2026-01-04"),
            finish: createProjectDate("2026-01-13"),
          }),
        ]}
        summaries={[resumen]}
        isLoading={false}
        loadSnapshot={loadSnapshot}
        onMarkSnapshot={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Importación del 5 de febrero/ }));

    await waitFor(() =>
      expect(screen.getByTestId("snapshots-board-comparison")).toBeInTheDocument(),
    );
    expect(loadSnapshot).toHaveBeenCalledWith("foto-1");
    const comparacion = screen.getByTestId("snapshots-board-comparison");
    expect(comparacion).toHaveTextContent("Excavación");
    expect(comparacion).toHaveTextContent("+3 d");
    expect(comparacion).toHaveTextContent("1 atrasada");
  });

  test("marcar un corte a mano exige un nombre", () => {
    const onMarkSnapshot = jest.fn();

    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[]}
        isLoading={false}
        loadSnapshot={async () => null}
        onMarkSnapshot={onMarkSnapshot}
      />,
    );

    fireEvent.click(screen.getByTestId("snapshots-board-mark"));
    expect(onMarkSnapshot).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("snapshots-board-mark-name"), {
      target: { value: "Corte de obra de enero" },
    });
    fireEvent.click(screen.getByTestId("snapshots-board-mark"));

    expect(onMarkSnapshot).toHaveBeenCalledWith("Corte de obra de enero");
  });

  test("mientras carga la lista lo dice, sin fingir que no hay fotos", () => {
    render(
      <SnapshotsBoardView
        tasks={[task({ id: 1 })]}
        summaries={[]}
        isLoading={true}
        loadSnapshot={async () => null}
        onMarkSnapshot={() => {}}
      />,
    );

    expect(screen.queryByTestId("snapshots-board-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("snapshots-board")).toHaveTextContent(/Cargando/i);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/components/views/SnapshotsBoardView.test.tsx`
Esperado: FALLA con `Cannot find module './SnapshotsBoardView'`

- [ ] **Paso 3: Implementación mínima**

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import type {
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SnapshotOrigin,
} from "@/types/snapshot";
import { compareSnapshotToTasks } from "@/lib/scheduling/snapshots";
import { formatProjectDate } from "@/lib/date/projectDate";

const ORIGIN_LABEL: Record<SnapshotOrigin, string> = {
  import: "Importación",
  manual: "Corte marcado",
  baseline: "Línea base",
};

const KIND_LABEL = {
  atrasada: "Se atrasó",
  adelantada: "Se adelantó",
  sinCambio: "Igual",
  nueva: "Nueva",
  eliminada: "Ya no está",
} as const;

export interface SnapshotsBoardViewProps {
  tasks: GanttTask[];
  summaries: ProjectSnapshotSummary[];
  isLoading: boolean;
  loadSnapshot: (snapshotId: string) => Promise<ProjectSnapshot | null>;
  onMarkSnapshot: (name: string) => void;
}

function shiftLabel(days: number): string {
  if (days === 0) return "—";
  return days > 0 ? `+${days} d` : `${days} d`;
}

export default function SnapshotsBoardView({
  tasks,
  summaries,
  isLoading,
  loadSnapshot,
  onMarkSnapshot,
}: SnapshotsBoardViewProps) {
  const [selected, setSelected] = useState<ProjectSnapshot | null>(null);
  const [markName, setMarkName] = useState("");

  const handleSelect = useCallback(
    async (snapshotId: string) => {
      const snapshot = await loadSnapshot(snapshotId);
      setSelected(snapshot);
    },
    [loadSnapshot],
  );

  const comparison = useMemo(
    () => (selected ? compareSnapshotToTasks(selected, tasks) : null),
    [selected, tasks],
  );

  return (
    <div data-testid="snapshots-board" className="apple-module flex h-full flex-col">
      <div className="apple-module-header px-5 py-4">
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Historial de cortes
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8rem",
            color: "var(--color-text-muted)",
            margin: "2px 0 0",
          }}
        >
          Compara el plan de hoy contra cualquier versión anterior del cronograma
        </p>
      </div>

      <div className="apple-subtoolbar flex-wrap gap-2">
        <input
          data-testid="snapshots-board-mark-name"
          value={markName}
          onChange={(event) => setMarkName(event.target.value)}
          placeholder="Nombre del corte, p. ej. «Corte de obra de enero»"
          className="apple-input"
          style={{ minWidth: 260 }}
        />
        <button
          data-testid="snapshots-board-mark"
          type="button"
          className="apple-button"
          onClick={() => {
            const name = markName.trim();
            if (!name) return;
            onMarkSnapshot(name);
            setMarkName("");
          }}
        >
          Marcar corte
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Cargando el historial de cortes…
          </p>
        ) : summaries.length === 0 ? (
          <div data-testid="snapshots-board-empty" className="apple-empty-state">
            <p>
              Todavía no hay ningún corte guardado. Cada vez que importas un
              archivo de Microsoft Project se guarda una foto del cronograma sin
              que tengas que acordarte, y puedes marcar un corte a mano —con
              nombre propio— para los hitos que importan.
            </p>
          </div>
        ) : (
          <>
            <ul data-testid="snapshots-board-list" className="mb-4 grid gap-2">
              {summaries.map((summary) => (
                <li key={summary.id}>
                  <button
                    type="button"
                    className="apple-section w-full px-3 py-2 text-left"
                    onClick={() => {
                      void handleSelect(summary.id);
                    }}
                  >
                    <span className="text-sm font-semibold text-[var(--color-text-strong)]">
                      {summary.name}
                    </span>
                    <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                      {formatProjectDate(summary.capturedAt)} ·{" "}
                      {ORIGIN_LABEL[summary.origin]} · {summary.taskCount} actividades
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {comparison && (
              <section data-testid="snapshots-board-comparison" className="apple-section p-3">
                <p className="mb-2 text-xs text-[var(--color-text-muted)]">
                  {comparison.delayedCount} atrasada(s) · {comparison.aheadCount}{" "}
                  adelantada(s) · {comparison.addedCount} nueva(s) ·{" "}
                  {comparison.removedCount} eliminada(s)
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--color-text-muted)]">
                      <th>Actividad</th>
                      <th>Estado</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.changes.map((change) => (
                      <tr key={String(change.taskId)}>
                        <td>{change.taskName}</td>
                        <td>{KIND_LABEL[change.kind]}</td>
                        <td>{shiftLabel(change.startShiftDays)}</td>
                        <td>{shiftLabel(change.finishShiftDays)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/components/views/SnapshotsBoardView.test.tsx`
Esperado: PASA (5 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/components/views/SnapshotsBoardView.tsx v2/src/components/views/SnapshotsBoardView.test.tsx && git commit -m "feat(cortes): el tablero que compara el plan de hoy contra cualquier foto"
```

## Tarea 14: La vista «Cortes» entra al menú y se cablea

**Archivos:**
- Modificar: `src/components/gantt/toolbar/viewTypes.ts:10-25` (alta de `cortes`)
- Modificar: `src/components/gantt/toolbar/ViewSidebar.tsx:46-61` (entrada del menú)
- Modificar: `src/lib/gantt/viewHelp.ts:11` (ayuda de la vista)
- Modificar: `src/components/views/GanttView.tsx` (importación dinámica junto a las de la línea 19-26, y bloque de render junto al de `scurve`)
- Test: `src/components/views/GanttView.snapshots.test.tsx`

**Interfaces:**
- Consume: `SnapshotsBoardView` con `SnapshotsBoardViewProps` (Tarea 13); `listProjectSnapshots(projectId): Promise<ProjectSnapshotSummary[]>`, `loadProjectSnapshot(projectId, snapshotId): Promise<ProjectSnapshot | null>`, `saveProjectSnapshot(snapshot): Promise<{ success: boolean; error?: string }>` (Tarea 9); `mergeSnapshotSources(stored, baselines, projectId)` (Tarea 12); `createSnapshotFromTasks(tasks, options)` (Tarea 7); `viewHelpFor(view: ViewType): ViewHelp | null` de `@/lib/gantt/viewHelp`.
- Produce: `ViewType` gana el valor `"cortes"`. `VIEW_HELP` gana la entrada `cortes`.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { VIEW_TABS_FOR_TEST } from "@/components/gantt/toolbar/ViewSidebar";
import { viewHelpFor } from "@/lib/gantt/viewHelp";

describe("la vista Cortes existe y se anuncia (A2)", () => {
  test("tiene su entrada en el menú lateral, dentro de Análisis", () => {
    const entrada = VIEW_TABS_FOR_TEST.find((tab) => tab.id === "cortes");

    expect(entrada).toBeDefined();
    expect(entrada!.labelEs).toBe("Cortes");
    expect(entrada!.group).toBe("analisis");
  });

  test("la ayuda dice qué responde y qué necesita", () => {
    const ayuda = viewHelpFor("cortes");

    expect(ayuda).not.toBeNull();
    expect(ayuda!.title).toBe("Cortes");
    expect(ayuda!.purpose).toMatch(/versión anterior|foto/i);
    expect(ayuda!.needs).toMatch(/importa|marca/i);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/components/views/GanttView.snapshots.test.tsx`
Esperado: FALLA con `Module '"@/components/gantt/toolbar/ViewSidebar"' has no exported member 'VIEW_TABS_FOR_TEST'`

- [ ] **Paso 3: Implementación mínima**

En `src/components/gantt/toolbar/viewTypes.ts`, añadir el valor a la unión (después de `"scurve"`):

```ts
  | "scurve"
  | "cortes"
```

En `src/components/gantt/toolbar/ViewSidebar.tsx`, añadir `History` al import de `lucide-react`, la entrada al array y la exportación para test:

```tsx
  { id: "cortes", labelEs: "Cortes", labelEn: "Snapshots", icon: History, group: "analisis" },
```

```tsx
/** Solo para tests: la lista es la fuente única del menú. */
export const VIEW_TABS_FOR_TEST = VIEW_TABS;
```

En `src/lib/gantt/viewHelp.ts`, añadir dentro de `VIEW_HELP`:

```ts
  cortes: {
    title: "Cortes",
    purpose:
      "Compara el cronograma de hoy contra cualquier versión anterior: qué actividades se movieron, cuánto y para dónde.",
    needs:
      "Al menos una foto guardada. Se guarda una sola cada vez que importas un .mpp, y puedes marcar cortes a mano.",
  },
```

En `src/components/views/GanttView.tsx`, junto a las demás importaciones dinámicas:

```tsx
const SnapshotsBoardView = dynamic(() => import("@/components/views/SnapshotsBoardView"), { loading: ViewLoading });
```

Añadir los imports de acciones y utilidades:

```tsx
import {
  listProjectSnapshots,
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "@/app/actions/snapshots";
import { createSnapshotFromTasks, mergeSnapshotSources } from "@/lib/scheduling/snapshots";
import type { ProjectSnapshotSummary } from "@/types/snapshot";
```

Estado y carga perezosa, junto al bloque `/* ── Baselines ── */`:

```tsx
  /* ── Fotos del plan (se leen solo al abrir el tablero) ── */
  const [snapshotSummaries, setSnapshotSummaries] = useState<ProjectSnapshotSummary[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);

  useEffect(() => {
    if (activeView !== "cortes" || snapshotsLoaded || !projectId) return;
    let cancelado = false;
    setSnapshotsLoading(true);
    void listProjectSnapshots(projectId)
      .then((stored) => {
        if (cancelado) return;
        setSnapshotSummaries(mergeSnapshotSources(stored, baselines, projectId));
        setSnapshotsLoaded(true);
      })
      .finally(() => {
        if (!cancelado) setSnapshotsLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [activeView, snapshotsLoaded, projectId, baselines]);

  const handleMarkSnapshot = useCallback(
    (name: string) => {
      if (!projectId) return;
      const snapshot = createSnapshotFromTasks(calculatedTasks, {
        projectId,
        name,
        origin: "manual",
        capturedAt: new Date(),
      });
      void saveProjectSnapshot(snapshot).then((result) => {
        if (!result.success) return;
        setSnapshotSummaries((prev) =>
          mergeSnapshotSources(
            [
              {
                id: snapshot.id,
                name: snapshot.name,
                origin: snapshot.origin,
                capturedAt: snapshot.capturedAt,
                taskCount: snapshot.tasks.length,
              },
              ...prev,
            ],
            baselines,
            projectId,
          ),
        );
      });
    },
    [projectId, calculatedTasks, baselines],
  );
```

Y el bloque de render, junto al de `scurve`:

```tsx
          {activeView === "cortes" && (
            <SnapshotsBoardView
              tasks={calculatedTasks}
              summaries={snapshotSummaries}
              isLoading={snapshotsLoading}
              loadSnapshot={(snapshotId) =>
                projectId
                  ? loadProjectSnapshot(projectId, snapshotId)
                  : Promise.resolve(null)
              }
              onMarkSnapshot={handleMarkSnapshot}
            />
          )}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/components/views/GanttView.snapshots.test.tsx src/components/gantt/toolbar/ViewSidebar.test.tsx`
Esperado: PASA — los 2 tests nuevos y toda la suite existente de `ViewSidebar.test.tsx`

- [ ] **Paso 5: Commit**

```bash
git add v2/src/components/gantt/toolbar/viewTypes.ts v2/src/components/gantt/toolbar/ViewSidebar.tsx v2/src/lib/gantt/viewHelp.ts v2/src/components/views/GanttView.tsx v2/src/components/views/GanttView.snapshots.test.tsx && git commit -m "feat(cortes): el tablero entra al menu y se lee solo cuando lo abres"
```

## Tarea 15: Cada importación deja su foto sin que nadie se acuerde

**Archivos:**
- Crear: `src/lib/import/importSnapshot.ts`
- Modificar: `src/app/api/import-mpp/route.ts:92-99` (tras `saveProject`)
- Test: `src/lib/import/importSnapshot.test.ts`

**Interfaces:**
- Consume: `createSnapshotFromTasks(tasks, options): ProjectSnapshot` (Tarea 7); `saveProjectSnapshot(snapshot): Promise<{ success: boolean; error?: string }>` (Tarea 9); `GanttTask`.
- Produce:
  - `export function importSnapshotName(fileName: string, capturedAt: Date): string`
  - `export async function captureImportSnapshot(params: { projectId: string; tasks: GanttTask[]; fileName: string; capturedAt?: Date }): Promise<{ captured: boolean }>`

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";

const saveProjectSnapshot = jest.fn(async () => ({ success: true }));

jest.mock("@/app/actions/snapshots", () => ({
  saveProjectSnapshot: (...args: unknown[]) => saveProjectSnapshot(...(args as [])),
}));

import { captureImportSnapshot, importSnapshotName } from "./importSnapshot";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-10"),
    duration: 10,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

beforeEach(() => {
  saveProjectSnapshot.mockClear();
  saveProjectSnapshot.mockResolvedValue({ success: true });
});

describe("importSnapshotName", () => {
  test("el nombre dice de qué archivo salió y de qué día", () => {
    expect(
      importSnapshotName("Estación 16 v7.mpp", createProjectDate("2026-02-05")),
    ).toBe("Importación de «Estación 16 v7» — 05/02/2026");
  });
});

describe("captureImportSnapshot", () => {
  test("guarda una foto con origen importación y todas las tareas del archivo", async () => {
    const resultado = await captureImportSnapshot({
      projectId: "p1",
      tasks: [task({ id: 1 }), task({ id: 2 })],
      fileName: "Estación 16 v7.mpp",
      capturedAt: createProjectDate("2026-02-05"),
    });

    expect(resultado).toEqual({ captured: true });
    expect(saveProjectSnapshot).toHaveBeenCalledTimes(1);
    const foto = saveProjectSnapshot.mock.calls[0][0] as {
      projectId: string;
      origin: string;
      name: string;
      tasks: unknown[];
    };
    expect(foto.projectId).toBe("p1");
    expect(foto.origin).toBe("import");
    expect(foto.name).toContain("Estación 16 v7");
    expect(foto.tasks).toHaveLength(2);
  });

  test("un archivo sin tareas no deja foto: no hay nada que fotografiar", async () => {
    const resultado = await captureImportSnapshot({
      projectId: "p1",
      tasks: [],
      fileName: "vacío.mpp",
    });

    expect(resultado).toEqual({ captured: false });
    expect(saveProjectSnapshot).not.toHaveBeenCalled();
  });

  test("si la foto falla, la importación no se cae con ella", async () => {
    saveProjectSnapshot.mockResolvedValue({ success: false, error: "disco lleno" });

    await expect(
      captureImportSnapshot({
        projectId: "p1",
        tasks: [task({ id: 1 })],
        fileName: "Estación 16 v7.mpp",
      }),
    ).resolves.toEqual({ captured: false });
  });

  test("una excepción tampoco tumba la importación", async () => {
    saveProjectSnapshot.mockRejectedValue(new Error("sin conexión"));

    await expect(
      captureImportSnapshot({
        projectId: "p1",
        tasks: [task({ id: 1 })],
        fileName: "Estación 16 v7.mpp",
      }),
    ).resolves.toEqual({ captured: false });
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/import/importSnapshot.test.ts`
Esperado: FALLA con `Cannot find module './importSnapshot' from 'src/lib/import/importSnapshot.test.ts'`

- [ ] **Paso 3: Implementación mínima**

`src/lib/import/importSnapshot.ts`:

```ts
import type { GanttTask } from "@/components/gantt/types";
import { saveProjectSnapshot } from "@/app/actions/snapshots";
import { createSnapshotFromTasks } from "@/lib/scheduling/snapshots";
import { formatProjectDate } from "@/lib/date/projectDate";

/**
 * Cada versión del cronograma que llega de la obra queda registrada sin que
 * nadie se acuerde de guardarla. Si la foto falla, la importación sigue: el
 * proyecto ya está guardado y perder la foto no puede costar el archivo.
 */
export function importSnapshotName(fileName: string, capturedAt: Date): string {
  const base = fileName.replace(/\.mpp$/i, "");
  return `Importación de «${base}» — ${formatProjectDate(capturedAt)}`;
}

export async function captureImportSnapshot({
  projectId,
  tasks,
  fileName,
  capturedAt = new Date(),
}: {
  projectId: string;
  tasks: GanttTask[];
  fileName: string;
  capturedAt?: Date;
}): Promise<{ captured: boolean }> {
  if (tasks.length === 0) return { captured: false };

  try {
    const snapshot = createSnapshotFromTasks(tasks, {
      projectId,
      name: importSnapshotName(fileName, capturedAt),
      origin: "import",
      capturedAt,
    });
    const result = await saveProjectSnapshot(snapshot);
    return { captured: result.success };
  } catch (err) {
    console.error("captureImportSnapshot error:", err);
    return { captured: false };
  }
}
```

En `src/app/api/import-mpp/route.ts`, justo después del bloque que comprueba `result.success` (línea 99) y antes del cálculo de `dependencyCount`:

```ts
  // La foto del cronograma importado se toma después de guardar: si falla, la
  // importación ya está a salvo.
  await captureImportSnapshot({
    projectId: result.id,
    tasks: projectData.tasks,
    fileName: file.name,
  });
```

Y su import en la cabecera del archivo:

```ts
import { captureImportSnapshot } from "@/lib/import/importSnapshot";
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/import/importSnapshot.test.ts`
Esperado: PASA (5 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/import/importSnapshot.ts v2/src/lib/import/importSnapshot.test.ts v2/src/app/api/import-mpp/route.ts && git commit -m "feat(cortes): cada importacion deja su foto sin que nadie se acuerde"
```

---

# BLOQUE A3 — Editor de dependencias en el Diagrama de Red

Cinco tareas. **Ninguna validación se duplica**: las que ya rechazan ciclos viven en `validateDependencies` (`src/lib/scheduling/scheduleEngine.ts:103`), que `recalculateSchedule` invoca dentro de `commitTaskChange` (`src/lib/state/ProjectContext.tsx:377`) — el mismo camino que usa la tabla cuando edita predecesoras vía `updateTask(taskId, "dependencies", …)` (`ProjectContext.tsx:489`) o el diagrama de barras vía `createDependency` (`ProjectContext.tsx:566`). El editor de red se cuelga de ahí y no de una copia.

**Decisión de interacción, que el spec no fijaba.** Conectar es **dos clics** (clic en el conector del origen, clic en el nodo destino), no arrastrar. Motivo doble: el arrastre en SVG no es verificable en jsdom, y en pantalla táctil de obra dos toques son más precisos que un arrastre sostenido. La cancelación es un clic en el fondo o `Escape`.

## Tarea 16: Resolver una dependencia dibujada, reutilizando las validaciones

**Archivos:**
- Crear: `src/lib/gantt/networkDependencyEditing.ts`
- Test: `src/lib/gantt/networkDependencyEditing.test.ts`

**Interfaces:**
- Consume: `validateDependencies(tasks: GanttTask[], dependencies?: GanttDependency[]): ScheduleIssue[]` de `@/lib/scheduling/scheduleEngine`; `addPredecessor(tasks, successorId, dependency): GanttTask[]` y `removeDependency(tasks, dependency): GanttTask[]` de `@/lib/gantt/dependencyEditing`; `GanttDependency` y `GanttTask` de `@/components/gantt/types`.
- Produce:
  - `export type DependencyDraftRejection = "mismaTarea" | "tareaInexistente" | "duplicada" | "ciclo"`
  - `export interface DependencyDraftAccepted { ok: true; dependency: GanttDependency }`
  - `export interface DependencyDraftRejected { ok: false; reason: DependencyDraftRejection; message: string }`
  - `export type DependencyDraftResult = DependencyDraftAccepted | DependencyDraftRejected`
  - `export function resolveDependencyDraft(tasks: GanttTask[], fromId: string | number, toId: string | number, type?: GanttDependency["type"]): DependencyDraftResult`
  - `export function dependenciesAfterRemoval(tasks: GanttTask[], dependency: Pick<GanttDependency, "from" | "to">): GanttDependency[]`

- [ ] **Paso 1: Escribir el test que falla**

```ts
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import {
  dependenciesAfterRemoval,
  resolveDependencyDraft,
} from "./networkDependencyEditing";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-05"),
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

describe("resolveDependencyDraft", () => {
  test("una dependencia válida se acepta con tipo FS por defecto", () => {
    const resultado = resolveDependencyDraft([task({ id: 1 }), task({ id: 2 })], 1, 2);

    expect(resultado).toEqual({
      ok: true,
      dependency: { from: 1, to: 2, type: "FS" },
    });
  });

  test("una actividad no puede depender de sí misma", () => {
    const resultado = resolveDependencyDraft([task({ id: 1 })], 1, 1);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.reason).toBe("mismaTarea");
    expect(resultado.message).toMatch(/sí misma/i);
  });

  test("una dependencia que cerraría un ciclo se rechaza", () => {
    const tareas = [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
      task({ id: 3, dependencies: [{ from: 2, to: 3, type: "FS" }] }),
    ];

    const resultado = resolveDependencyDraft(tareas, 3, 1);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.reason).toBe("ciclo");
    expect(resultado.message).toMatch(/ciclo/i);
  });

  test("una dependencia ya dibujada no se duplica", () => {
    const tareas = [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
    ];

    const resultado = resolveDependencyDraft(tareas, 1, 2);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.reason).toBe("duplicada");
  });

  test("una actividad que ya no existe se rechaza con su motivo", () => {
    const resultado = resolveDependencyDraft([task({ id: 1 })], 1, 99);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.reason).toBe("tareaInexistente");
  });

  test("el mismo par con otro tipo sí se acepta", () => {
    const tareas = [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
    ];

    const resultado = resolveDependencyDraft(tareas, 1, 2, "SS");

    expect(resultado).toEqual({
      ok: true,
      dependency: { from: 1, to: 2, type: "SS" },
    });
  });
});

describe("dependenciesAfterRemoval", () => {
  test("devuelve las predecesoras que le quedan a la sucesora", () => {
    const tareas = [
      task({ id: 1 }),
      task({ id: 2 }),
      task({
        id: 3,
        dependencies: [
          { from: 1, to: 3, type: "FS" },
          { from: 2, to: 3, type: "FS" },
        ],
      }),
    ];

    expect(dependenciesAfterRemoval(tareas, { from: 1, to: 3 })).toEqual([
      { from: 2, to: 3, type: "FS" },
    ]);
  });

  test("borrar la única predecesora deja la lista vacía", () => {
    const tareas = [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
    ];

    expect(dependenciesAfterRemoval(tareas, { from: 1, to: 2 })).toEqual([]);
  });

  test("una sucesora que no existe devuelve lista vacía en vez de reventar", () => {
    expect(dependenciesAfterRemoval([task({ id: 1 })], { from: 1, to: 99 })).toEqual([]);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/gantt/networkDependencyEditing.test.ts`
Esperado: FALLA con `Cannot find module './networkDependencyEditing'`

- [ ] **Paso 3: Implementación mínima**

```ts
import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import { validateDependencies } from "@/lib/scheduling/scheduleEngine";
import { addPredecessor, removeDependency } from "@/lib/gantt/dependencyEditing";

/**
 * Resolución de una dependencia dibujada en el Diagrama de Red.
 *
 * No hay validación propia: el rechazo de ciclos sale de `validateDependencies`
 * (`src/lib/scheduling/scheduleEngine.ts`), la misma función que corre el
 * recálculo cuando la dependencia se crea desde la tabla. Si hubiera dos
 * fuentes de verdad, el diagrama y la tabla podrían discrepar.
 */

export type DependencyDraftRejection =
  | "mismaTarea"
  | "tareaInexistente"
  | "duplicada"
  | "ciclo";

export interface DependencyDraftAccepted {
  ok: true;
  dependency: GanttDependency;
}

export interface DependencyDraftRejected {
  ok: false;
  reason: DependencyDraftRejection;
  /** Motivo en lenguaje de obra, para mostrarlo donde el usuario está mirando. */
  message: string;
}

export type DependencyDraftResult =
  | DependencyDraftAccepted
  | DependencyDraftRejected;

export function resolveDependencyDraft(
  tasks: GanttTask[],
  fromId: string | number,
  toId: string | number,
  type: GanttDependency["type"] = "FS",
): DependencyDraftResult {
  if (fromId === toId) {
    return {
      ok: false,
      reason: "mismaTarea",
      message: "Una actividad no puede depender de sí misma.",
    };
  }

  const from = tasks.find((task) => task.id === fromId);
  const to = tasks.find((task) => task.id === toId);
  if (!from || !to) {
    return {
      ok: false,
      reason: "tareaInexistente",
      message: "Una de las dos actividades ya no está en el cronograma.",
    };
  }

  const alreadyDrawn = to.dependencies.some(
    (dep) => dep.from === fromId && dep.to === toId && dep.type === type,
  );
  if (alreadyDrawn) {
    return {
      ok: false,
      reason: "duplicada",
      message: "Esa dependencia ya está dibujada.",
    };
  }

  const dependency: GanttDependency = { from: fromId, to: toId, type };
  const issues = validateDependencies(addPredecessor(tasks, toId, dependency));
  if (issues.some((issue) => issue.kind === "cycle")) {
    return {
      ok: false,
      reason: "ciclo",
      message:
        "Esa flecha cerraría un ciclo: la actividad terminaría dependiendo de sí misma.",
    };
  }

  return { ok: true, dependency };
}

/** Predecesoras que le quedan a la sucesora tras borrar una flecha. */
export function dependenciesAfterRemoval(
  tasks: GanttTask[],
  dependency: Pick<GanttDependency, "from" | "to">,
): GanttDependency[] {
  const next = removeDependency(tasks, dependency);
  return next.find((task) => task.id === dependency.to)?.dependencies ?? [];
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/gantt/networkDependencyEditing.test.ts`
Esperado: PASA (9 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/gantt/networkDependencyEditing.ts v2/src/lib/gantt/networkDependencyEditing.test.ts && git commit -m "feat(red): resolver una dependencia dibujada con las validaciones que ya existen"
```

## Tarea 17: Dibujar una dependencia con dos clics

**Archivos:**
- Modificar: `src/components/network/NetworkNode.tsx:1-8` (props) y el cuerpo de los dos `<g>` (hito y tarea)
- Modificar: `src/components/views/NetworkDiagramView.tsx:9-12` (props), `:18-24` (estado), `:80-92` (clic de nodo), `:118-128` (render de nodos)
- Test: `src/components/views/NetworkDiagramView.connect.test.tsx`

**Interfaces:**
- Consume: `resolveDependencyDraft(tasks, fromId, toId, type?): DependencyDraftResult` de la Tarea 16; `computeNetworkLayout(tasks): NetworkLayoutResult` de `@/lib/layout/networkLayout`.
- Produce:
  - `NetworkNode` acepta además `onStartConnection?: (taskId: string | number) => void` e `isConnectSource?: boolean`, y dibuja un conector con `data-testid="network-connector"` y `data-task-id`.
  - `NetworkDiagramView` acepta además `onCreateDependency?: (fromId: string | number, toId: string | number, type: "FS" | "SS" | "FF" | "SF") => void` y `onRejectEdit?: (reason: string) => void`.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import NetworkDiagramView from "./NetworkDiagramView";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-05"),
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

function conector(taskId: string | number): HTMLElement {
  return screen
    .getAllByTestId("network-connector")
    .find((element) => element.getAttribute("data-task-id") === String(taskId))!;
}

function nodo(taskId: string | number): HTMLElement {
  return screen
    .getAllByTestId("network-node")
    .find((element) => element.getAttribute("data-task-id") === String(taskId))!;
}

describe("NetworkDiagramView · dibujar dependencias (A3)", () => {
  test("cada nodo ofrece un conector para empezar la flecha", () => {
    render(<NetworkDiagramView tasks={[task({ id: 1 }), task({ id: 2 })]} />);

    expect(screen.getAllByTestId("network-connector")).toHaveLength(2);
  });

  test("conector del origen y clic en el destino crean la dependencia", () => {
    const onCreateDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        onCreateDependency={onCreateDependency}
      />,
    );

    fireEvent.click(conector(1));
    fireEvent.click(nodo(2));

    expect(onCreateDependency).toHaveBeenCalledWith(1, 2, "FS");
  });

  test("mientras se dibuja, la vista dice qué falta hacer", () => {
    render(<NetworkDiagramView tasks={[task({ id: 1 }), task({ id: 2 })]} />);

    fireEvent.click(conector(1));

    expect(screen.getByTestId("network-connect-hint")).toHaveTextContent(
      /elige la actividad que va después/i,
    );
  });

  test("una flecha que cerraría un ciclo se rechaza con su motivo y no se crea", () => {
    const onCreateDependency = jest.fn();
    const onRejectEdit = jest.fn();

    render(
      <NetworkDiagramView
        tasks={[
          task({ id: 1 }),
          task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
        ]}
        onCreateDependency={onCreateDependency}
        onRejectEdit={onRejectEdit}
      />,
    );

    fireEvent.click(conector(2));
    fireEvent.click(nodo(1));

    expect(onCreateDependency).not.toHaveBeenCalled();
    expect(onRejectEdit).toHaveBeenCalledWith(expect.stringMatching(/ciclo/i));
  });

  test("Escape cancela el dibujo a medias", () => {
    const onCreateDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={[task({ id: 1 }), task({ id: 2 })]}
        onCreateDependency={onCreateDependency}
      />,
    );

    fireEvent.click(conector(1));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(nodo(2));

    expect(onCreateDependency).not.toHaveBeenCalled();
    expect(screen.queryByTestId("network-connect-hint")).not.toBeInTheDocument();
  });

  test("sin manejador de creación, seleccionar un nodo sigue funcionando como antes", () => {
    const onTaskClick = jest.fn();

    render(<NetworkDiagramView tasks={[task({ id: 1 })]} onTaskClick={onTaskClick} />);

    fireEvent.click(nodo(1));

    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/components/views/NetworkDiagramView.connect.test.tsx`
Esperado: FALLA con `Unable to find an element by: [data-testid="network-connector"]`

- [ ] **Paso 3: Implementación mínima**

En `src/components/network/NetworkNode.tsx`, ampliar las props y añadir el conector:

```tsx
interface NetworkNodeProps {
  node: NetworkNodeType;
  onClick?: (taskId: string | number) => void;
  onStartConnection?: (taskId: string | number) => void;
  isSelected?: boolean;
  isConnectSource?: boolean;
}
```

Desestructurar `onStartConnection` e `isConnectSource = false`, y añadir dentro de **cada** uno de los dos `<g>` devueltos (el del hito y el de la tarea), como último hijo:

```tsx
      {onStartConnection && (
        <circle
          data-testid="network-connector"
          data-task-id={node.taskId}
          cx={node.x + node.width}
          cy={node.y + node.height / 2}
          r={6}
          fill={isConnectSource ? "var(--aia-proj-main)" : "var(--aia-alabaster)"}
          stroke="var(--aia-corp-mid)"
          strokeWidth={1}
          style={{ cursor: "crosshair" }}
          onClick={(event) => {
            event.stopPropagation();
            onStartConnection(node.taskId);
          }}
        />
      )}
```

En el `<g>` del hito, `node.width`/`node.height` siguen siendo los del nodo aunque se dibuje un rombo: el conector queda a su derecha, que es donde nace la flecha.

En `src/components/views/NetworkDiagramView.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveDependencyDraft } from "@/lib/gantt/networkDependencyEditing";

interface NetworkDiagramViewProps {
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
  onCreateDependency?: (
    fromId: string | number,
    toId: string | number,
    type: "FS" | "SS" | "FF" | "SF",
  ) => void;
  onRejectEdit?: (reason: string) => void;
}
```

Estado y cancelación:

```tsx
  const [connectFromId, setConnectFromId] = useState<string | number | null>(null);

  useEffect(() => {
    if (connectFromId === null) return;
    const cancelar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConnectFromId(null);
    };
    window.addEventListener("keydown", cancelar);
    return () => window.removeEventListener("keydown", cancelar);
  }, [connectFromId]);

  const handleStartConnection = useCallback((taskId: string | number) => {
    setConnectFromId((current) => (current === taskId ? null : taskId));
  }, []);
```

El clic de nodo pasa a cerrar la conexión cuando hay una a medias:

```tsx
  const handleNodeClick = useCallback(
    (taskId: string | number) => {
      if (connectFromId !== null) {
        const draft = resolveDependencyDraft(tasks, connectFromId, taskId);
        setConnectFromId(null);
        if (!draft.ok) {
          onRejectEdit?.(draft.message);
          return;
        }
        onCreateDependency?.(draft.dependency.from, draft.dependency.to, draft.dependency.type);
        return;
      }

      setSelectedTaskId(taskId);
      if (onTaskClick) {
        const task = tasks.find((t) => t.id === taskId);
        if (task) onTaskClick(task);
      }
    },
    [connectFromId, tasks, onCreateDependency, onRejectEdit, onTaskClick],
  );
```

Todos los nodos reciben el conector, tenga o no la vista un manejador de creación: el conector es parte del nodo, y sin manejador el intento termina en un rechazo silencioso en vez de en una flecha. Así el diagrama se ve igual en cualquier contexto y no hay dos aspectos que mantener.

```tsx
          {layout.nodes.map((node) => (
            <NetworkNode
              key={node.taskId}
              node={node}
              onClick={handleNodeClick}
              onStartConnection={handleStartConnection}
              isSelected={selectedTaskId === node.taskId}
              isConnectSource={connectFromId === node.taskId}
            />
          ))}
```

Y el aviso de qué falta hacer, dentro del contenedor y antes de los controles de zoom:

```tsx
      {connectFromId !== null && (
        <div
          data-testid="network-connect-hint"
          className="absolute left-4 top-4 apple-section px-3 py-2 text-xs"
        >
          Elige la actividad que va después. Escape cancela.
        </div>
      )}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/components/views/NetworkDiagramView.connect.test.tsx`
Esperado: PASA (6 tests)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/components/network/NetworkNode.tsx v2/src/components/views/NetworkDiagramView.tsx v2/src/components/views/NetworkDiagramView.connect.test.tsx && git commit -m "feat(red): dibujar una dependencia con dos clics sobre el diagrama"
```

## Tarea 18: Seleccionar una flecha y borrarla

**Archivos:**
- Modificar: `src/components/network/NetworkArrow.tsx` (selección y zona de clic)
- Modificar: `src/components/views/NetworkDiagramView.tsx` (estado de flecha seleccionada, botón de borrado, tecla `Delete`)
- Modificar: `src/components/views/GanttView.tsx:2010-2012` (cableado)
- Test: `src/components/views/NetworkDiagramView.delete.test.tsx`

**Interfaces:**
- Consume: `dependenciesAfterRemoval(tasks, dependency): GanttDependency[]` de la Tarea 16; `updateTask(taskId, field, value)` y `reportInvalidEdit(reason: string)` del `ProjectContextValue`.
- Produce:
  - `NetworkArrow` acepta además `onSelect?: (edge: { fromTaskId: string | number; toTaskId: string | number }) => void` e `isSelected?: boolean`, y expone `data-from` / `data-to` en su `<g>`.
  - `NetworkDiagramView` acepta además `onDeleteDependency?: (dependency: { from: string | number; to: string | number }) => void`. Testid nuevo: `network-delete-dependency`.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import NetworkDiagramView from "./NetworkDiagramView";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-01"),
    finish: createProjectDate("2026-01-05"),
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

function conDependencia(): GanttTask[] {
  return [
    task({ id: 1 }),
    task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
  ];
}

describe("NetworkDiagramView · borrar dependencias (A3)", () => {
  test("sin flecha seleccionada no hay botón de borrar", () => {
    render(<NetworkDiagramView tasks={conDependencia()} onDeleteDependency={jest.fn()} />);

    expect(screen.queryByTestId("network-delete-dependency")).not.toBeInTheDocument();
  });

  test("al elegir una flecha aparece el botón de borrar", () => {
    render(<NetworkDiagramView tasks={conDependencia()} onDeleteDependency={jest.fn()} />);

    fireEvent.click(screen.getByTestId("network-arrow"));

    expect(screen.getByTestId("network-delete-dependency")).toBeInTheDocument();
  });

  test("el botón borra la dependencia elegida", () => {
    const onDeleteDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={conDependencia()}
        onDeleteDependency={onDeleteDependency}
      />,
    );

    fireEvent.click(screen.getByTestId("network-arrow"));
    fireEvent.click(screen.getByTestId("network-delete-dependency"));

    expect(onDeleteDependency).toHaveBeenCalledWith({ from: 1, to: 2 });
  });

  test("la tecla Suprimir borra la flecha elegida", () => {
    const onDeleteDependency = jest.fn();

    render(
      <NetworkDiagramView
        tasks={conDependencia()}
        onDeleteDependency={onDeleteDependency}
      />,
    );

    fireEvent.click(screen.getByTestId("network-arrow"));
    fireEvent.keyDown(window, { key: "Delete" });

    expect(onDeleteDependency).toHaveBeenCalledWith({ from: 1, to: 2 });
  });

  test("tras borrar, la selección se suelta", () => {
    render(
      <NetworkDiagramView tasks={conDependencia()} onDeleteDependency={jest.fn()} />,
    );

    fireEvent.click(screen.getByTestId("network-arrow"));
    fireEvent.click(screen.getByTestId("network-delete-dependency"));

    expect(screen.queryByTestId("network-delete-dependency")).not.toBeInTheDocument();
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/components/views/NetworkDiagramView.delete.test.tsx`
Esperado: FALLA con `Unable to find an element by: [data-testid="network-delete-dependency"]`

- [ ] **Paso 3: Implementación mínima**

`src/components/network/NetworkArrow.tsx`:

```tsx
interface NetworkArrowProps {
  edge: NetworkEdge;
  isSelected?: boolean;
  onSelect?: (edge: {
    fromTaskId: string | number;
    toTaskId: string | number;
  }) => void;
}
```

Desestructurar `isSelected = false` y `onSelect`; el color y el grosor pasan a considerar la selección, y se añade una zona de clic ancha e invisible:

```tsx
  const strokeColor = isSelected
    ? "var(--aia-proj-main)"
    : edge.isCritical
      ? "var(--aia-alert-main)"
      : "var(--aia-corp-mid)";
  const strokeWidth = isSelected ? 3 : edge.isCritical ? 2.5 : 1.5;
```

```tsx
    <g
      data-testid="network-arrow"
      data-from={String(edge.fromTaskId)}
      data-to={String(edge.toTaskId)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.({ fromTaskId: edge.fromTaskId, toTaskId: edge.toTaskId });
      }}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {/* Zona de clic: la línea es demasiado fina para acertarle */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={12} />
      …resto igual…
    </g>
```

En `src/components/views/NetworkDiagramView.tsx`:

```tsx
  onDeleteDependency?: (dependency: {
    from: string | number;
    to: string | number;
  }) => void;
```

```tsx
  const [selectedEdge, setSelectedEdge] = useState<{
    from: string | number;
    to: string | number;
  } | null>(null);

  const handleDeleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    onDeleteDependency?.(selectedEdge);
    setSelectedEdge(null);
  }, [selectedEdge, onDeleteDependency]);

  useEffect(() => {
    if (!selectedEdge) return;
    const borrar = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        handleDeleteSelectedEdge();
      }
      if (event.key === "Escape") setSelectedEdge(null);
    };
    window.addEventListener("keydown", borrar);
    return () => window.removeEventListener("keydown", borrar);
  }, [selectedEdge, handleDeleteSelectedEdge]);
```

El render de aristas:

```tsx
          {layout.edges.map((edge) => (
            <NetworkArrow
              key={`${edge.fromTaskId}-${edge.toTaskId}`}
              edge={edge}
              isSelected={
                selectedEdge?.from === edge.fromTaskId &&
                selectedEdge?.to === edge.toTaskId
              }
              onSelect={
                onDeleteDependency
                  ? ({ fromTaskId, toTaskId }) =>
                      setSelectedEdge({ from: fromTaskId, to: toTaskId })
                  : undefined
              }
            />
          ))}
```

Y el botón, junto a los controles de zoom:

```tsx
        {selectedEdge && (
          <button
            data-testid="network-delete-dependency"
            onClick={handleDeleteSelectedEdge}
            className="apple-icon-button"
            title="Borrar la dependencia elegida"
            type="button"
          >
            <Trash2 size={15} />
          </button>
        )}
```

(`Trash2` se añade al import de `lucide-react`.)

En `src/components/views/GanttView.tsx`, el bloque de la vista de red pasa a:

```tsx
          {activeView === "network" && (
            <NetworkDiagramView
              tasks={calculatedTasks}
              onTaskClick={onTaskClick}
              onCreateDependency={createDependency}
              onDeleteDependency={(dependency) =>
                updateTask(
                  dependency.to,
                  "dependencies",
                  dependenciesAfterRemoval(calculatedTasks, dependency),
                )
              }
              onRejectEdit={reportInvalidEdit}
            />
          )}
```

con los imports correspondientes (`dependenciesAfterRemoval` de `@/lib/gantt/networkDependencyEditing`) y `updateTask` / `reportInvalidEdit` sacados de `useProject()` junto a `createDependency`, que ya se desestructura en la línea 216.

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/components/views/NetworkDiagramView.delete.test.tsx src/components/views/NetworkDiagramView.connect.test.tsx src/lib/layout/networkLayout.test.ts`
Esperado: PASA (11 tests nuevos y la suite existente de `networkLayout`)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/components/network/NetworkArrow.tsx v2/src/components/views/NetworkDiagramView.tsx v2/src/components/views/NetworkDiagramView.delete.test.tsx v2/src/components/views/GanttView.tsx && git commit -m "feat(red): elegir una flecha y borrarla desde el diagrama"
```

## Tarea 19: La prueba de que el diagrama y la tabla no divergen

**Archivos:**
- Test: `src/lib/state/dependencyParity.test.tsx`

**Interfaces:**
- Consume: `ProjectProvider`, `useProject`, `ProjectContextValue` de `@/lib/state/ProjectContext`; `resolveDependencyDraft` y `dependenciesAfterRemoval` de la Tarea 16.
- Produce: ninguna interfaz nueva. Fija por escrito que las dos puertas producen el mismo cronograma.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { act, render } from "@testing-library/react";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";
import {
  ProjectProvider,
  useProject,
  type ProjectContextValue,
} from "./ProjectContext";
import {
  dependenciesAfterRemoval,
  resolveDependencyDraft,
} from "@/lib/gantt/networkDependencyEditing";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Actividad ${overrides.id}`,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate("2026-01-05"),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

function Harness({ onValue }: { onValue: (value: ProjectContextValue) => void }) {
  const value = useProject();
  onValue(value);
  return null;
}

function montar(tasks: GanttTask[]): () => ProjectContextValue {
  let ctx: ProjectContextValue | undefined;
  render(
    <ProjectProvider initialTasks={tasks}>
      <Harness onValue={(value) => (ctx = value)} />
    </ProjectProvider>,
  );
  return () => ctx!;
}

/** Compara solo lo que define el cronograma, sin marcas de edición. */
function esqueleto(tasks: GanttTask[]) {
  return tasks.map((t) => ({
    id: t.id,
    start: t.start.toISOString(),
    finish: t.finish.toISOString(),
    dependencies: t.dependencies.map((dep) => ({
      from: dep.from,
      to: dep.to,
      type: dep.type,
    })),
  }));
}

describe("paridad diagrama ↔ tabla (A3)", () => {
  test("crear la misma dependencia por las dos puertas deja el mismo cronograma", () => {
    const desdeTabla = montar([task({ id: 1 }), task({ id: 2 })]);
    act(() =>
      desdeTabla().updateTask(2, "dependencies", [{ from: 1, to: 2, type: "FS" }]),
    );
    const resultadoTabla = esqueleto(desdeTabla().tasks);

    const desdeDiagrama = montar([task({ id: 1 }), task({ id: 2 })]);
    const draft = resolveDependencyDraft(desdeDiagrama().tasks, 1, 2);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    act(() =>
      desdeDiagrama().createDependency(
        draft.dependency.from,
        draft.dependency.to,
        draft.dependency.type,
      ),
    );
    const resultadoDiagrama = esqueleto(desdeDiagrama().tasks);

    expect(resultadoDiagrama).toEqual(resultadoTabla);
  });

  test("borrar la misma dependencia por las dos puertas deja el mismo cronograma", () => {
    const conDependencia = () => [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
    ];

    const desdeTabla = montar(conDependencia());
    act(() => desdeTabla().updateTask(2, "dependencies", []));
    const resultadoTabla = esqueleto(desdeTabla().tasks);

    const desdeDiagrama = montar(conDependencia());
    act(() =>
      desdeDiagrama().updateTask(
        2,
        "dependencies",
        dependenciesAfterRemoval(desdeDiagrama().tasks, { from: 1, to: 2 }),
      ),
    );
    const resultadoDiagrama = esqueleto(desdeDiagrama().tasks);

    expect(resultadoDiagrama).toEqual(resultadoTabla);
  });

  test("un ciclo se rechaza igual por las dos puertas: el cronograma no se mueve", () => {
    const enCadena = () => [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
      task({ id: 3, dependencies: [{ from: 2, to: 3, type: "FS" }] }),
    ];

    const desdeTabla = montar(enCadena());
    const antesTabla = esqueleto(desdeTabla().tasks);
    act(() =>
      desdeTabla().updateTask(1, "dependencies", [{ from: 3, to: 1, type: "FS" }]),
    );

    expect(esqueleto(desdeTabla().tasks)).toEqual(antesTabla);
    expect(desdeTabla().lastRejection).not.toBeNull();

    const desdeDiagrama = montar(enCadena());
    const draft = resolveDependencyDraft(desdeDiagrama().tasks, 3, 1);

    expect(draft.ok).toBe(false);
    if (draft.ok) return;
    expect(draft.reason).toBe("ciclo");
    expect(esqueleto(desdeDiagrama().tasks)).toEqual(antesTabla);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/lib/state/dependencyParity.test.tsx`
Esperado: FALLA con `Cannot find module '@/lib/gantt/networkDependencyEditing'` si la Tarea 16 aún no se aplicó. Con la Tarea 16 ya en su sitio, para verlo fallar de verdad se cambia temporalmente el `resolveDependencyDraft` del primer test por una construcción a mano con tipo `"SS"`: el test FALLA con `Expected: "FS" … Received: "SS"`, lo que prueba que la comparación distingue de verdad los dos caminos. Después se restaura.

- [ ] **Paso 3: Implementación mínima**

Ninguna. Esta tarea no añade código de producción: comprueba que A3 no introdujo una segunda fuente de verdad. Si alguno de los tres casos falla, el arreglo es hacer que el diagrama pase por `createDependency` / `updateTask` en vez de tocar tareas por su cuenta.

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/lib/state/dependencyParity.test.tsx src/lib/state/ProjectContext.test.tsx`
Esperado: PASA — los 3 tests nuevos y toda la suite existente de `ProjectContext.test.tsx`

- [ ] **Paso 5: Commit**

```bash
git add v2/src/lib/state/dependencyParity.test.tsx && git commit -m "test(red): el diagrama y la tabla producen el mismo cronograma, o esto se pone rojo"
```

## Tarea 20: El Diagrama de Red gana su sitio y su estado vacío

**Archivos:**
- Modificar: `src/components/gantt/toolbar/ViewSidebar.tsx` (entrada `network`)
- Modificar: `src/lib/gantt/viewHelp.ts` (ayuda de `network`)
- Modificar: `src/components/views/NetworkDiagramView.tsx` (estado vacío que enseña)
- Test: `src/components/views/NetworkDiagramView.empty.test.tsx`

**Interfaces:**
- Consume: `VIEW_TABS_FOR_TEST` de `@/components/gantt/toolbar/ViewSidebar` (Tarea 14); `viewHelpFor(view: ViewType): ViewHelp | null` de `@/lib/gantt/viewHelp`.
- Produce: `VIEW_TABS` gana la entrada `network`; `VIEW_HELP` gana la entrada `network`. Testid nuevo: `network-empty-state`.

Con el editor, la vista deja de ser paridad decorativa: es donde se dibujan las dependencias. Por eso vuelve a la barra principal — la reversión de C3 que el spec declara en A3 y que R3 (plan de P6) deja escrita en `PRODUCT.md`.

- [ ] **Paso 1: Escribir el test que falla**

```tsx
/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { VIEW_TABS_FOR_TEST } from "@/components/gantt/toolbar/ViewSidebar";
import { viewHelpFor } from "@/lib/gantt/viewHelp";
import NetworkDiagramView from "./NetworkDiagramView";

describe("Diagrama de Red · sitio y estado vacío (A3)", () => {
  test("tiene su entrada en el menú lateral, dentro de Análisis", () => {
    const entrada = VIEW_TABS_FOR_TEST.find((tab) => tab.id === "network");

    expect(entrada).toBeDefined();
    expect(entrada!.labelEs).toBe("Diagrama de Red");
    expect(entrada!.group).toBe("analisis");
  });

  test("la ayuda dice que aquí se dibujan las dependencias", () => {
    const ayuda = viewHelpFor("network");

    expect(ayuda).not.toBeNull();
    expect(ayuda!.purpose).toMatch(/dependencias/i);
    expect(ayuda!.needs).toMatch(/actividades/i);
  });

  test("sin tareas, la vista enseña qué hacer en vez de quedarse muda", () => {
    render(<NetworkDiagramView tasks={[]} onCreateDependency={jest.fn()} />);

    expect(screen.getByTestId("network-empty-state")).toHaveTextContent(
      /importa un archivo/i,
    );
  });

  test("con tareas pero sin dependencias, explica cómo dibujar la primera", () => {
    render(
      <NetworkDiagramView
        tasks={[
          {
            id: 1,
            name: "Excavación",
            start: new Date(2026, 0, 1),
            finish: new Date(2026, 0, 5),
            duration: 5,
            progress: 0,
            isCritical: false,
            isMilestone: false,
            isSummary: false,
            outlineLevel: 1,
            dependencies: [],
          },
        ]}
        onCreateDependency={jest.fn()}
      />,
    );

    expect(screen.getByTestId("network-empty-state")).toHaveTextContent(
      /punto al costado/i,
    );
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

Comando: `cd v2 && npx jest src/components/views/NetworkDiagramView.empty.test.tsx`
Esperado: FALLA con `expect(received).toBeDefined()` — no hay entrada `network` en `VIEW_TABS_FOR_TEST`

- [ ] **Paso 3: Implementación mínima**

En `src/components/gantt/toolbar/ViewSidebar.tsx`, añadir `Share2` al import de `lucide-react` y la entrada tras la de `bottlenecks`:

```tsx
  // C3 revertido: con el editor de dependencias esta vista deja de ser paridad
  // decorativa y pasa a ser donde se dibujan las relaciones entre actividades.
  { id: "network", labelEs: "Diagrama de Red", labelEn: "Network Diagram", icon: Share2, group: "analisis" },
```

En `src/lib/gantt/viewHelp.ts`, añadir dentro de `VIEW_HELP`:

```ts
  network: {
    title: "Diagrama de Red",
    purpose:
      "El mapa de qué va antes y qué va después. Aquí se dibujan, se cambian y se borran las dependencias entre actividades.",
    needs:
      "Actividades en el cronograma. Las dependencias se dibujan aquí mismo, no hacen falta de antemano.",
  },
```

En `src/components/views/NetworkDiagramView.tsx`, el estado vacío del final pasa a distinguir los dos casos:

```tsx
      {layout.nodes.length === 0 ? (
        <div data-testid="network-empty-state" className="apple-empty-state absolute inset-0">
          <p>
            No hay actividades que dibujar todavía. Importa un archivo de
            Microsoft Project o crea las actividades en el Gantt, y aquí verás
            cómo se encadenan.
          </p>
        </div>
      ) : (
        layout.edges.length === 0 && (
          <div
            data-testid="network-empty-state"
            className="apple-section absolute bottom-4 left-4 max-w-sm px-3 py-2 text-xs"
          >
            Ninguna actividad depende de otra todavía. Haz clic en el punto al
            costado de una actividad y luego en la que va después para dibujar la
            primera dependencia.
          </div>
        )
      )}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

Comando: `cd v2 && npx jest src/components/views/NetworkDiagramView.empty.test.tsx src/components/gantt/toolbar/ViewSidebar.test.tsx`
Esperado: PASA (4 tests nuevos y la suite existente de `ViewSidebar.test.tsx`)

- [ ] **Paso 5: Commit**

```bash
git add v2/src/components/gantt/toolbar/ViewSidebar.tsx v2/src/lib/gantt/viewHelp.ts v2/src/components/views/NetworkDiagramView.tsx v2/src/components/views/NetworkDiagramView.empty.test.tsx && git commit -m "feat(red): el diagrama vuelve al menu y explica como dibujar la primera dependencia"
```

---

# Tarea 21: Verificación de cierre

**Archivos:**
- Ninguno nuevo. Se corren las comprobaciones sobre todo lo entregado.

**Interfaces:**
- Consume: todo lo producido por las Tareas 1 a 20.
- Produce: la evidencia con la que se puede decir «hecho».

- [ ] **Paso 1: La suite completa en verde**

Comando: `cd v2 && npx jest --runInBand`
Esperado: PASA — 143 suites previas más las nuevas, sin ninguna en rojo. Si alguna falla, se arregla antes de seguir; ninguna tarea de P5 puede dejar deuda aquí.

- [ ] **Paso 2: Tipos limpios**

Comando: `cd v2 && npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`
Esperado: salida **vacía**.

- [ ] **Paso 3: Lint de los archivos tocados**

Comando: `cd v2 && npx eslint src/lib/scheduling/projection.ts src/lib/scheduling/snapshots.ts src/lib/db src/app/actions/snapshots.ts src/lib/import/importSnapshot.ts src/lib/gantt/networkDependencyEditing.ts src/components/views/SCurveView.tsx src/components/views/SnapshotsBoardView.tsx src/components/views/NetworkDiagramView.tsx src/components/network src/components/gantt/toolbar/ViewSidebar.tsx src/lib/gantt/viewHelp.ts src/components/views/GanttView.tsx`
Esperado: sin errores.

- [ ] **Paso 4: Compilación de producción**

Comando: `cd v2 && npx next build --webpack`
Esperado: build correcto, sin errores de tipos ni de importación de acciones de servidor.

- [ ] **Paso 5: Revisión en el navegador**

Comando: desde la raíz, `docker compose up -d --build frontend`; luego abrir en el navegador integrado un proyecto real y recorrer las tres rutas afectadas:

1. **Curva S → pestaña «Proyección»**: con avance registrado se ven las tres fechas y las cuatro líneas; con un proyecto sin avance, el texto dice qué anotar.
2. **Menú → «Cortes»**: la lista carga al abrir la vista (y no antes); marcar un corte a mano lo añade arriba; elegir una foto muestra la tabla de movidas.
3. **Menú → «Diagrama de Red»**: dibujar una dependencia con dos clics, intentar una que cierre un ciclo y comprobar que el aviso lo explica, y borrar una flecha elegida.

Esperado: las tres rutas se comportan como describen los tests, y ningún estado vacío se queda en blanco.

---

# Notas de cierre del plan

## Cobertura contra el spec

| Promesa del spec | Tareas que la cubren |
|---|---|
| A1 · Proyección desde el ritmo real, tres líneas | 1, 2, 3, 4 |
| A1 · Sin palancas de configuración | 3 (el ritmo sale del avance; no hay ninguna entrada de usuario) |
| A1 · Estado vacío que dice qué falta | 3 (los tres mensajes), 4 (`s-curve-projection-empty`) |
| A1 · Tests con ritmo constante, acelerado, frenado y avance cero, más el umbral mínimo | 2, 3 |
| A2 · Tabla propia | 5, 6 |
| A2 · Migración reversible, probada en los dos sentidos | 5 (runner), 6 (001 up/down), 8 (002 up/down e ida y vuelta) |
| A2 · Se leen solo al abrir el tablero, nunca en el guardado | 9 (acciones aparte), 10 (valla de regresión), 14 (carga perezosa por vista activa) |
| A2 · Foto automática en cada importación | 15 |
| A2 · Fotos marcadas a mano con nombre | 13 (formulario), 14 (`handleMarkSnapshot`) |
| A2 · Las líneas base siguen valiendo, sin migrarse a la fuerza ni duplicarse | 7 (`baselineToSnapshot` conserva el id), 8 (blob intacto, `ON CONFLICT DO NOTHING`), 12 (fusión sin duplicados) |
| A2 · Comparación: atrasada, adelantada, nueva, eliminada | 11 |
| A2 · Estado vacío que enseña | 13 (`snapshots-board-empty`) |
| A3 · Crear, cambiar y borrar predecesoras sobre el diagrama | 17 (crear), 18 (borrar), 16 (cambiar = borrar y crear, ambos por el mismo camino) |
| A3 · Reutilizar las validaciones que rechazan ciclos | 16 (`validateDependencies` de `scheduleEngine.ts:103`) |
| A3 · Mismo resultado desde el diagrama y desde la tabla | 19 |
| A3 · Estado vacío que enseña | 20 |
| A3 · La vista gana su sitio (C3 revertido) | 20 |

## Lo que este plan **no** hace

- No toca P6 · Remates: R0 a R7 tienen plan propio, incluido el registro en `PRODUCT.md` de la reversión de C3 que A3 justifica.
- No añade palancas de escenario a la Curva S: el spec lo declara fuera de alcance.
- No parte `GanttView.tsx`: sigue siendo el límite estructural reconocido.
- No borra las líneas base del blob. Sacarlas sería una tercera migración, con su propio riesgo, y el spec no lo pide.
