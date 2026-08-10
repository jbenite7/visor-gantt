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
