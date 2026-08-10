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

  // Este test nació afirmando lo contrario, y era un fallo del diseño: se
  // descontaban las huérfanas que traía el proyecto, así que uno abierto con
  // una rota aceptaba en silencio una rota nueva — justo lo que este cambio
  // viene a impedir. Se corrigió el 2026-08-10 tras comprobar que la
  // precargada no sobrevive al montaje, así que no hay nada que descontar.
  test("un proyecto que ya traía una huérfana rechaza igual una huérfana nueva", () => {
    const ctx = montar([
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 99, to: 2, type: "FS" }] }),
      task({ id: 3 }),
    ]);

    act(() =>
      ctx().updateTask(3, "dependencies", [{ from: 77, to: 3, type: "FS" }]),
    );

    expect(ctx().lastRejection).not.toBeNull();
    expect(ctx().tasks.find((t) => t.id === 3)!.dependencies).toEqual([]);
  });
});
