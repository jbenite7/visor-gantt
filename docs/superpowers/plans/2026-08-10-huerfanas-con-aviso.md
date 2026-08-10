# Dependencias huérfanas con aviso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una dependencia que apunta a una actividad inexistente deje de descartarse en silencio: la carga lo cuenta, la edición lo rechaza y explica, y el borrado dice cuántas dependencias retira.

**Architecture:** El motor (`recalculateSchedule`) deja de cegarse: sigue limpiando exactamente igual, pero además devuelve **qué** limpió. Quien llama decide qué hacer con ese dato — al cargar se informa, al editar se rechaza. Ninguna de las cuatro tareas cambia el filtrado de `normalizeDependencies`.

**Tech Stack:** Next.js 16 (App Router) · TypeScript · React · Jest + Testing Library.

Spec: [2026-08-10-huerfanas-con-aviso-design.md](../specs/2026-08-10-huerfanas-con-aviso-design.md)

## Global Constraints

- **TDD estricto**: test primero, verlo fallar por el motivo esperado, luego el código mínimo.
- **Cada test se rompe a propósito y se comprueba en rojo** antes de darlo por bueno. En P5 aparecieron dos tests incapaces de fallar, ambos aprobados en su primera revisión y ambos cazados mutando el código, no leyéndolo.
- Directorio de trabajo: `v2/`. Todos los comandos se ejecutan desde ahí.
- Suite completa: `npx jest --runInBand` (en paralelo hay flaky conocidos). **Se parte de 1661 tests, 1659 en verde y 2 saltados a propósito** (las abscisas de obra lineal, que esperan un `.mpp` de túnel). Ninguno puede ponerse en rojo y **el conteo no puede bajar**.
- Verificación por tarea: `npx eslint <archivos>` y `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"`, que debe salir **vacío**.
- **`normalizeDependencies` no se toca.** Sigue filtrando igual; lo único que cambia es que se sabe qué quitó.
- **Fechas**: nunca `new Date("2026-03-10")` —se interpreta como UTC y en GMT-5 cae el día anterior—. Usar `createProjectDate` de `@/lib/date/projectDate`.
- Tests de componente llevan `/** @jest-environment jsdom */` en la **primera línea**; el preset global es `node`.
- Código e identificadores en inglés; textos de interfaz y comentarios en **español con tildes**, en lenguaje de obra. `src/__tests__/limpieza.test.ts` caza copy sin tildes, también dentro de plantillas con backticks.
- Rama: `fix/huerfanas-con-aviso`, ya creada desde `main`.

---

## File Structure

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `src/lib/scheduling/scheduleEngine.ts` | `recalculateSchedule` devuelve además las huérfanas retiradas | 1 |
| `src/lib/state/ProjectContext.tsx` | La carga informa; la edición rechaza; el borrado cuenta | 2, 3, 4 |
| `src/lib/state/dependencyParity.test.tsx` | Se actualiza al comportamiento nuevo | 3 |

---

## Task 1: El motor dice qué limpió

**Files:**
- Modify: `src/lib/scheduling/scheduleEngine.ts:22-25` (el tipo) y `:183-188` (el cálculo)
- Test: `src/lib/scheduling/scheduleEngine.test.ts` (se añade un `describe` nuevo)

**Interfaces:**
- Consumes: `GanttDependency` de `@/components/gantt/types` (`{ from: string | number; to: string | number; type: "FS" | "SS" | "FF" | "SF"; lag?: number }`), `normalizeDependencies` y `collectDependencies` del mismo archivo.
- Produces: `RecalculateScheduleResult` gana `orphanedDependencies: GanttDependency[]`.

- [ ] **Step 1: Write the failing test**

```ts
describe("recalculateSchedule · las huérfanas dejan de perderse en silencio", () => {
  function tarea(id: string | number, dependencies: GanttDependency[] = []): GanttTask {
    return {
      id,
      name: `Actividad ${id}`,
      start: createProjectDate("2026-01-05"),
      finish: createProjectDate("2026-01-05"),
      duration: 1,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies,
    };
  }

  test("una dependencia hacia una actividad que no existe se retira y se reporta", () => {
    const resultado = recalculateSchedule([
      tarea(1),
      tarea(2, [{ from: 99, to: 2, type: "FS" }]),
    ]);

    // Se sigue limpiando igual que antes: el cronograma queda sin el enlace roto.
    expect(resultado.tasks.find((t) => t.id === 2)!.dependencies).toEqual([]);
    // Pero ahora se sabe cuál era.
    expect(resultado.orphanedDependencies).toEqual([{ from: 99, to: 2, type: "FS" }]);
  });

  test("un cronograma sano no reporta ninguna huérfana", () => {
    const resultado = recalculateSchedule([
      tarea(1),
      tarea(2, [{ from: 1, to: 2, type: "FS" }]),
    ]);

    expect(resultado.orphanedDependencies).toEqual([]);
    expect(resultado.issues).toEqual([]);
  });

  test("las huérfanas se reportan sin bloquear: no entran en issues", () => {
    // `issues` bloquea la edición. Una huérfana preexistente no puede impedir
    // que se siga trabajando, así que viaja aparte.
    const resultado = recalculateSchedule([
      tarea(1),
      tarea(2, [{ from: 99, to: 2, type: "FS" }]),
    ]);

    expect(resultado.orphanedDependencies).toHaveLength(1);
    expect(resultado.issues).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/scheduling/scheduleEngine.test.ts -t "huérfanas dejan de perderse" --runInBand`
Expected: FAIL — `orphanedDependencies` es `undefined`, así que `toEqual([...])` no casa.

- [ ] **Step 3: Write minimal implementation**

En `scheduleEngine.ts`, el tipo:

```ts
export interface RecalculateScheduleResult {
  tasks: GanttTask[];
  issues: ScheduleIssue[];
  /**
   * Dependencias que apuntaban a una actividad inexistente y se retiraron.
   *
   * Va aparte de `issues` a propósito: `issues` bloquea la edición y esto no
   * siempre debe bloquear. Al cargar un proyecto se informa; al editar, quien
   * llama lo convierte en rechazo.
   */
  orphanedDependencies: GanttDependency[];
}
```

Y el cálculo, justo antes de normalizar:

```ts
  // Se mira qué va a quitar `normalizeDependencies` ANTES de que lo quite.
  // El filtrado no cambia: lo único que cambia es que deja de perderse el dato.
  const activeTaskIds = new Set(tasks.filter(isActiveTask).map((task) => task.id));
  const orphanedDependencies = collectDependencies(tasks).filter(
    (dep) => !activeTaskIds.has(dep.from) || !activeTaskIds.has(dep.to),
  );

  const canonicalTasks = normalizeDependencies(tasks);
```

Añadir `orphanedDependencies` a los **tres** `return` de `recalculateSchedule` —líneas 172, 187 y 201—. Cuidado al contarlos con un `grep`: hay más `return {` dentro de la función, pero están en el callback del `.map()` final y no son retornos de la función. El compilador te señalará los tres de verdad.

El del error de calendario (172) ocurre **antes** de calcular nada, así que devuelve `[]` con su motivo escrito; los otros dos devuelven el array calculado:

```ts
    // Sin calendario válido no se llega a tocar ninguna dependencia.
    orphanedDependencies: [],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/scheduling/scheduleEngine.test.ts --runInBand`
Expected: PASS

- [ ] **Step 5: Romper a propósito y comprobar en rojo**

Cambiar el filtro a `.filter(() => false)` y correr los tres tests: **deben ponerse en rojo dos de ellos**. Revertir. Si no se ponen rojos, el test no vale y hay que rehacerlo.

- [ ] **Step 6: Verificar y commitear**

```bash
npx jest --runInBand
npx eslint src/lib/scheduling/scheduleEngine.ts src/lib/scheduling/scheduleEngine.test.ts
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
git add src/lib/scheduling/scheduleEngine.ts src/lib/scheduling/scheduleEngine.test.ts
git commit -m "feat(motor): recalculateSchedule dice que huerfanas retiro"
```

---

## Task 2: La carga informa, y nunca bloquea

**Files:**
- Modify: `src/lib/state/ProjectContext.tsx:292-298` (el montaje inicial)
- Test: `src/lib/state/ProjectContext.test.tsx` (se añade un `describe` nuevo)

**Interfaces:**
- Consumes: `RecalculateScheduleResult.orphanedDependencies` de la Tarea 1.
- Produces: `ProjectContextValue` gana `loadedOrphanCount: number` — cuántas dependencias rotas traía el proyecto al abrirse. `0` cuando no traía ninguna.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment jsdom
 */
describe("ProjectProvider · un proyecto que llega con enlaces rotos", () => {
  test("se abre igual, y cuenta cuántos venían rotos", () => {
    const ctx = montar([
      tarea(1),
      tarea(2, [{ from: 99, to: 2, type: "FS" }]),
    ]);

    // El proyecto se abre: no se bloquea nada.
    expect(ctx().tasks).toHaveLength(2);
    expect(ctx().lastRejection).toBeNull();
    // Y se sabe qué se limpió al abrirlo.
    expect(ctx().loadedOrphanCount).toBe(1);
  });

  test("un proyecto sano abre con el contador a cero", () => {
    const ctx = montar([tarea(1), tarea(2, [{ from: 1, to: 2, type: "FS" }])]);

    expect(ctx().loadedOrphanCount).toBe(0);
  });
});
```

Usar el mismo `montar` y `tarea` que ya existen en `src/lib/state/dependencyParity.test.tsx`; si el fichero de test de `ProjectContext` no los tiene, copiarlos tal cual desde ahí.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/state/ProjectContext.test.tsx -t "enlaces rotos" --runInBand`
Expected: FAIL — `loadedOrphanCount` es `undefined`.

- [ ] **Step 3: Write minimal implementation**

En `ProjectContext.tsx`, junto al resto del estado inicial:

```ts
  /**
   * Cuántas dependencias rotas traía el proyecto al abrirse.
   *
   * Se informa, no se bloquea. Si una huérfana preexistente impidiera editar,
   * un proyecto viejo con un enlace roto quedaría inservible para siempre: el
   * usuario no la causó y no puede arreglarla desde ahí.
   */
  const loadedOrphanCount = initialSchedule.orphanedDependencies.length;
```

Añadir `loadedOrphanCount: number;` a la interfaz `ProjectContextValue` y exponerlo en el objeto del `value`, junto a los demás.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/state/ProjectContext.test.tsx --runInBand`
Expected: PASS

- [ ] **Step 5: Romper a propósito y comprobar en rojo**

Cambiar a `const loadedOrphanCount = 0;` y comprobar que el primer test se pone rojo. Revertir.

- [ ] **Step 6: Verificar y commitear**

```bash
npx jest --runInBand
npx eslint src/lib/state/ProjectContext.tsx src/lib/state/ProjectContext.test.tsx
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
git add src/lib/state/ProjectContext.tsx src/lib/state/ProjectContext.test.tsx
git commit -m "feat(estado): al abrir un proyecto se cuentan los enlaces rotos que traia"
```

---

## Task 3: La edición rechaza y explica

**Files:**
- Modify: `src/lib/state/ProjectContext.tsx:349-360` (`setTasks`) y `:374-386` (`commitTaskChange`)
- Test: `src/lib/state/dependencyParity.test.tsx` (se **actualiza** el test de la divergencia)

**Interfaces:**
- Consumes: `RecalculateScheduleResult.orphanedDependencies` de la Tarea 1; `rejectWith(issues, fallback)`, que ya existe en el archivo.
- Produces: ninguna interfaz nueva.

**Lo que decide esta tarea:** solo se rechaza la huérfana **que introduce la edición**. Las que ya venían de la carga no cuentan — si contaran, un proyecto viejo quedaría bloqueado, que es el riesgo que ordena todo este diseño.

- [ ] **Step 1: Write the failing test**

Sustituir en `dependencyParity.test.tsx` el test llamado `"hoy la tabla descarta en silencio una dependencia hacia una actividad inexistente, y el diagrama sí la explica"` por estos dos, y **borrar el bloque de comentario que describía la divergencia** (ya no existe), dejando en su lugar:

```tsx
  // Las dos puertas coinciden desde el 2026-08-10. Antes no: la tabla descartaba
  // la huérfana en silencio y el diagrama la explicaba. Se unificó hacia el
  // diagrama, y este test es lo que impide que vuelvan a separarse.
  test("una dependencia hacia una actividad que no existe se rechaza igual por las dos puertas", () => {
    const desdeTabla = montar([task({ id: 1 }), task({ id: 2 })]);
    const antesTabla = esqueleto(desdeTabla().tasks);
    act(() =>
      desdeTabla().updateTask(2, "dependencies", [{ from: 99, to: 2, type: "FS" }]),
    );

    expect(esqueleto(desdeTabla().tasks)).toEqual(antesTabla);
    expect(desdeTabla().lastRejection).not.toBeNull();

    const desdeDiagrama = montar([task({ id: 1 }), task({ id: 2 })]);
    const draft = resolveDependencyDraft(desdeDiagrama().tasks, 99, 2);

    expect(draft.ok).toBe(false);
    if (draft.ok) return;
    expect(draft.reason).toBe("tareaInexistente");
    expect(esqueleto(desdeDiagrama().tasks)).toEqual(antesTabla);
  });

  test("una huérfana que ya venía en el proyecto no impide seguir editando", () => {
    // El riesgo que ordena este diseño: si una huérfana preexistente bloqueara,
    // un proyecto viejo con un enlace roto quedaría inservible para siempre.
    const ctx = montar([
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 99, to: 2, type: "FS" }] }),
      task({ id: 3 }),
    ]);

    act(() => ctx().updateTask(3, "name", "Renombrada en obra"));

    expect(ctx().tasks.find((t) => t.id === 3)!.name).toBe("Renombrada en obra");
    expect(ctx().lastRejection).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/state/dependencyParity.test.tsx --runInBand`
Expected: FAIL en el primero — `lastRejection` es `null`, porque hoy la tabla descarta en silencio. El segundo ya debería pasar.

- [ ] **Step 3: Write minimal implementation**

En `setTasks`, después de recalcular:

```ts
      const result = recalculateSchedule(updater(tasks), { calendar });
      setScheduleIssues(result.issues);

      // Solo se rechaza la huérfana que introduce ESTA edición. Las que ya
      // venían de la carga no cuentan: bloquear por ellas dejaría inservible
      // cualquier proyecto viejo con un enlace roto.
      const huerfanasNuevas = result.orphanedDependencies.length - loadedOrphanCount;
      if (huerfanasNuevas > 0) {
        rejectWith(
          [{ message: "Esa actividad no existe en el cronograma." }],
          "Esa actividad no existe en el cronograma.",
        );
        return;
      }

      if (result.issues.length > 0) {
```

El mismo bloque, con el mismo comentario, en `commitTaskChange` justo antes de su comprobación de `result.issues.length > 0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/state/dependencyParity.test.tsx --runInBand`
Expected: PASS, los dos.

- [ ] **Step 5: Romper a propósito y comprobar en rojo**

Cambiar la condición a `if (huerfanasNuevas > 99)` y comprobar que el primer test se pone rojo. Después cambiarla a `if (result.orphanedDependencies.length > 0)` —ignorando las preexistentes— y comprobar que **el segundo** se pone rojo. Revertir. Los dos experimentos importan: uno prueba que se rechaza, el otro que no se bloquea de más.

- [ ] **Step 6: Verificar y commitear**

```bash
npx jest --runInBand
npx eslint src/lib/state/ProjectContext.tsx src/lib/state/dependencyParity.test.tsx
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
git add src/lib/state/ProjectContext.tsx src/lib/state/dependencyParity.test.tsx
git commit -m "fix(estado): la tabla rechaza y explica la dependencia hacia una actividad inexistente"
```

---

## Task 4: El borrado dice cuántas dependencias retira

**Files:**
- Modify: `src/lib/state/ProjectContext.tsx:772-808` (`deleteTasks`)
- Test: `src/lib/state/ProjectContext.test.tsx` (se añade un `describe` nuevo)

**Interfaces:**
- Consumes: `LastAction` (`{ kind: "add" | "delete" | "other" | "undone"; count: number; description: string; token: number }`), que ya existe.
- Produces: ninguna interfaz nueva. Cambia el texto de `description` cuando el borrado retira dependencias.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */
describe("deleteTasks · el aviso dice el impacto en dependencias", () => {
  test("cuando el borrado retira dependencias, las cuenta", () => {
    const ctx = montar([
      tarea(1),
      tarea(2, [{ from: 1, to: 2, type: "FS" }]),
      tarea(3, [{ from: 1, to: 3, type: "FS" }]),
    ]);

    act(() => ctx().deleteTasks([1]));

    expect(ctx().lastAction?.description).toBe(
      "1 tarea eliminada · 2 dependencias retiradas",
    );
  });

  test("una sola dependencia se dice en singular", () => {
    const ctx = montar([tarea(1), tarea(2, [{ from: 1, to: 2, type: "FS" }])]);

    act(() => ctx().deleteTasks([1]));

    expect(ctx().lastAction?.description).toBe(
      "1 tarea eliminada · 1 dependencia retirada",
    );
  });

  test("si no retira ninguna, el aviso no cambia respecto a hoy", () => {
    const ctx = montar([tarea(1), tarea(2)]);

    act(() => ctx().deleteTasks([1]));

    expect(ctx().lastAction?.description).toBe("1 tarea eliminada");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/state/ProjectContext.test.tsx -t "impacto en dependencias" --runInBand`
Expected: FAIL en los dos primeros — hoy la descripción es siempre `"1 tarea eliminada"`.

- [ ] **Step 3: Write minimal implementation**

En `deleteTasks`, antes del `commitTaskChange`, contar lo que se va a retirar:

```ts
      // Se cuentan antes de retirarlas, porque después ya no están. El borrado
      // ya las quitaba a propósito; lo que faltaba era decirlo.
      const dependenciasRetiradas = tasks.reduce(
        (total, t) =>
          total +
          (t.dependencies?.filter((d) => doomed.has(d.from) || doomed.has(d.to))
            .length ?? 0),
        0,
      );
```

Y al construir el aviso:

```ts
      const tareasTexto =
        removed === 1 ? "1 tarea eliminada" : `${removed} tareas eliminadas`;
      const dependenciasTexto =
        dependenciasRetiradas === 1
          ? "1 dependencia retirada"
          : `${dependenciasRetiradas} dependencias retiradas`;

      setLastAction({
        kind: "delete",
        count: removed,
        description:
          dependenciasRetiradas > 0
            ? `${tareasTexto} · ${dependenciasTexto}`
            : tareasTexto,
        token: nextActionToken(),
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/state/ProjectContext.test.tsx --runInBand`
Expected: PASS, los tres.

- [ ] **Step 5: Romper a propósito y comprobar en rojo**

Forzar `const dependenciasRetiradas = 0;` y comprobar que los dos primeros tests se ponen rojos y el tercero sigue verde. Revertir.

- [ ] **Step 6: Verificar y commitear**

```bash
npx jest --runInBand
npx eslint src/lib/state/ProjectContext.tsx src/lib/state/ProjectContext.test.tsx
npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"
npx next build
git add src/lib/state/ProjectContext.tsx src/lib/state/ProjectContext.test.tsx
git commit -m "feat(estado): el aviso de borrado dice cuantas dependencias retira"
```

---

## Cierre del proyecto

- [ ] Suite completa en verde: `npx jest --runInBand`. **El conteo debe subir respecto a 1661, nunca bajar**, y los saltados deben seguir siendo exactamente 2.
- [ ] `npx eslint src/` sin errores.
- [ ] `npx tsc --noEmit 2>&1 | grep -vE "\.test\.|e2e/"` vacío.
- [ ] `npx next build` correcto.
- [ ] Comprobación en navegador sobre `/gantt-demo`: borrar una tarea que tenga dependencias y **leer el aviso**, que debe decir el impacto y ofrecer deshacer.
- [ ] Actualizar la spec con lo que se haya aprendido, si algo no encajó con el código real.
