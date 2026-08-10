import type { GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import { createProjectDate } from "@/lib/date/projectDate";
import type { ProjectSnapshot } from "@/types/snapshot";
import {
  baselineToSnapshot,
  compareSnapshotToTasks,
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
