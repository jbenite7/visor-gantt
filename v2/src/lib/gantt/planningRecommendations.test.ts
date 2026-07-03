import type { GanttTask } from "@/components/gantt/types";
import { buildPlanningRecommendations } from "./planningRecommendations";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-05T08:00:00"),
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

describe("planning recommendations", () => {
  test("prioritizes validation issues and disconnected operational tasks", () => {
    const recommendations = buildPlanningRecommendations([
      task({ id: 1, dependencies: [{ from: 1, to: 1, type: "FS" }] }),
      task({ id: 2, name: "Excavacion" }),
    ]);

    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "selfDependency",
          severity: "high",
          action: expect.stringContaining("tarea diferente"),
        }),
        expect.objectContaining({
          kind: "missingPredecessor",
          severity: "medium",
          taskIds: [2],
        }),
      ]),
    );
    expect(recommendations[0].severity).toBe("high");
  });

  test("detects critical dependency convergence and open critical chains", () => {
    const recommendations = buildPlanningRecommendations([
      task({ id: 1, isCritical: true }),
      task({ id: 2, isCritical: true }),
      task({ id: 3, isCritical: true }),
      task({ id: 4, isCritical: true }),
      task({
        id: 5,
        name: "Liberacion",
        isCritical: true,
        totalFloat: 0,
        dependencies: [
          { from: 1, to: 5, type: "FS" },
          { from: 2, to: 5, type: "FS" },
          { from: 3, to: 5, type: "FS" },
        ],
      }),
    ]);

    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "dependencyConvergence",
          severity: "high",
          taskIds: [5, 1, 2, 3],
        }),
        expect.objectContaining({
          kind: "criticalOpenEnd",
          severity: "medium",
          taskIds: [4],
        }),
      ]),
    );
  });

  test("detects overlapping operational tasks sharing the same resource", () => {
    const recommendations = buildPlanningRecommendations([
      task({
        id: 1,
        name: "Formaleta torre 1",
        start: new Date("2026-01-05T08:00:00"),
        finish: new Date("2026-01-07T17:00:00"),
        resourceNames: ["Cuadrilla A"],
      }),
      task({
        id: 2,
        name: "Formaleta torre 2",
        start: new Date("2026-01-06T08:00:00"),
        finish: new Date("2026-01-08T17:00:00"),
        isCritical: true,
        resourceNames: ["Cuadrilla A"],
      }),
      task({
        id: 3,
        name: "Hito no operativo",
        isMilestone: true,
        resourceNames: ["Cuadrilla A"],
      }),
    ]);

    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "resourceOverlap",
          severity: "high",
          taskIds: [1, 2],
          title: "Cuadrilla A esta asignado en tareas solapadas.",
          action: expect.stringContaining("capacidad"),
        }),
      ]),
    );
    expect(
      recommendations.some(
        (item) => item.kind === "resourceOverlap" && item.taskIds.includes(3),
      ),
    ).toBe(false);
  });

  test("detects tasks finishing after imported MS Project deadlines", () => {
    const recommendations = buildPlanningRecommendations([
      task({
        id: 1,
        name: "Entrega estructura",
        start: new Date("2026-01-05T08:00:00"),
        finish: new Date("2026-01-12T17:00:00"),
        deadline: new Date("2026-01-10T17:00:00"),
        isCritical: true,
      }),
    ]);

    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "deadlineMissed",
          severity: "high",
          taskIds: [1],
          title: "Entrega estructura supera su fecha limite por 2d.",
          detail: expect.stringContaining("MS Project"),
        }),
      ]),
    );
  });

  test("detects violated imported MS Project no-later-than constraints", () => {
    const recommendations = buildPlanningRecommendations([
      task({
        id: 1,
        name: "Liberar frente",
        start: new Date("2026-01-09T08:00:00"),
        finish: new Date("2026-01-09T17:00:00"),
        constraintType: "startNoLaterThan",
        constraintDate: new Date("2026-01-06T08:00:00"),
        isCritical: true,
      }),
      task({
        id: 2,
        name: "Cerrar vaciado",
        start: new Date("2026-01-07T08:00:00"),
        finish: new Date("2026-01-12T17:00:00"),
        constraintType: "finishNoLaterThan",
        constraintDate: new Date("2026-01-10T17:00:00"),
      }),
    ]);

    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "constraintViolated",
          severity: "high",
          taskIds: [1],
          title: "Liberar frente viola restriccion MPP por 3d.",
          detail: expect.stringContaining("Comenzar no mas tarde de"),
        }),
        expect.objectContaining({
          kind: "constraintViolated",
          severity: "medium",
          taskIds: [2],
          title: "Cerrar vaciado viola restriccion MPP por 2d.",
          detail: expect.stringContaining("Finalizar no mas tarde de"),
        }),
      ]),
    );
  });

  test("detects tasks slipping against the active baseline", () => {
    const recommendations = buildPlanningRecommendations([
      task({
        id: 1,
        name: "Instalar fachada",
        start: new Date("2026-01-05T08:00:00"),
        finish: new Date("2026-01-15T17:00:00"),
        baselineStart: new Date("2026-01-05T08:00:00"),
        baselineFinish: new Date("2026-01-12T17:00:00"),
        baselineDuration: 6,
        isCritical: true,
      }),
    ]);

    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "baselineSlip",
          severity: "high",
          taskIds: [1],
          title: "Instalar fachada se desvía 3d frente a la línea base.",
          action: expect.stringContaining("re-baseline"),
        }),
      ]),
    );
  });
});
