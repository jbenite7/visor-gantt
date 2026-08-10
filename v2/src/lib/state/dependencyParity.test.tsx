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

  // Los dos casos de abajo son los que ESTUVIERON duplicados: «misma tarea» y
  // «tarea inexistente» se comprobaban a mano en el diagrama y también en
  // `validateDependencies`, y ya habían empezado a divergir —un mensaje decía
  // «sí misma» y el otro «si misma»—. Se unificaron, y estos tests son lo que
  // impide que vuelvan a separarse sin que nadie se entere.

  test("una actividad que depende de sí misma se rechaza igual por las dos puertas", () => {
    const desdeTabla = montar([task({ id: 1 }), task({ id: 2 })]);
    const antesTabla = esqueleto(desdeTabla().tasks);
    act(() =>
      desdeTabla().updateTask(1, "dependencies", [{ from: 1, to: 1, type: "FS" }]),
    );

    expect(esqueleto(desdeTabla().tasks)).toEqual(antesTabla);
    expect(desdeTabla().lastRejection).not.toBeNull();

    const desdeDiagrama = montar([task({ id: 1 }), task({ id: 2 })]);
    const draft = resolveDependencyDraft(desdeDiagrama().tasks, 1, 1);

    expect(draft.ok).toBe(false);
    if (draft.ok) return;
    expect(draft.reason).toBe("mismaTarea");
    expect(esqueleto(desdeDiagrama().tasks)).toEqual(antesTabla);
  });

  // ── DIVERGENCIA CONOCIDA, encontrada por esta misma prueba ──────────────
  //
  // Este test NO afirma paridad: la fija tal como es hoy, porque hoy NO la hay.
  //
  // Por el diagrama, una dependencia hacia una actividad inexistente se rechaza
  // con su motivo. Por la tabla se descarta **en silencio**: el usuario teclea
  // un predecesor equivocado y no pasa nada ni se le dice por qué.
  //
  // La causa está en `normalizeDependencies` (`scheduleEngine.ts:92`), que filtra
  // las dependencias huérfanas **antes** de que `validateDependencies` pueda
  // verlas, así que `missingTask` nunca llega a dispararse por ese camino.
  //
  // No se arregla aquí a propósito. Ese filtrado es correcto para su otro caso
  // —al borrar una actividad, las referencias que quedan colgando deben
  // desaparecer sin molestar a nadie— y distinguir «referencia huérfana por un
  // borrado» de «el usuario escribió mal un id» es una decisión de producto que
  // toca el motor compartido, no un remate de esta tarea.
  //
  // Cuando se arregle, este test se pondrá rojo. Es lo que se busca: obliga a
  // actualizarlo a mano y a leer este comentario antes de darlo por bueno.
  test("hoy la tabla descarta en silencio una dependencia hacia una actividad inexistente, y el diagrama sí la explica", () => {
    const desdeTabla = montar([task({ id: 1 }), task({ id: 2 })]);
    const antesTabla = esqueleto(desdeTabla().tasks);
    act(() =>
      desdeTabla().updateTask(2, "dependencies", [{ from: 99, to: 2, type: "FS" }]),
    );

    // El cronograma no se mueve, pero tampoco hay explicación: ese es el fallo.
    expect(esqueleto(desdeTabla().tasks)).toEqual(antesTabla);
    expect(desdeTabla().lastRejection).toBeNull();

    // El diagrama, en cambio, sí dice por qué.
    const desdeDiagrama = montar([task({ id: 1 }), task({ id: 2 })]);
    const draft = resolveDependencyDraft(desdeDiagrama().tasks, 99, 2);

    expect(draft.ok).toBe(false);
    if (draft.ok) return;
    expect(draft.reason).toBe("tareaInexistente");
    expect(esqueleto(desdeDiagrama().tasks)).toEqual(antesTabla);
  });
});
