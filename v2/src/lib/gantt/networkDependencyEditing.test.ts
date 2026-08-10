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

  test("si varios motivos aplican a la vez, gana el más específico: misma tarea antes que ciclo", () => {
    const tareas = [
      task({ id: 1, dependencies: [{ from: 3, to: 1, type: "FS" }] }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
      task({ id: 3, dependencies: [{ from: 2, to: 3, type: "FS" }] }),
    ];

    const resultado = resolveDependencyDraft(tareas, 1, 1);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.reason).toBe("mismaTarea");
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
