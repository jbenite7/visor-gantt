import {
  applyMatrixUpdate,
  syncMatrixPlanFromTasks,
} from "@/lib/matrix/matrixSync";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import type { GanttTask } from "@/components/gantt/types";
import type { MatrixPlan } from "@/types/matrix";

function planWithQuantity(quantity: number): MatrixPlan {
  return {
    id: "matrix-sync",
    name: "Sincronizacion",
    startDate: "2026-01-05",
    scopeTree: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    areas: [{ id: "arquitectura", name: "Arquitectura" }],
    recipes: [
      {
        id: "muros",
        name: "Muros",
        activities: [
          {
            id: "mamposteria",
            name: "Mamposteria",
            productivityPerDay: 25,
          },
        ],
        dependencies: [],
      },
    ],
    cells: [
      {
        id: "cell-muros",
        scopeId: "piso-1",
        areaId: "arquitectura",
        recipeId: "muros",
        active: true,
        quantity,
        unit: "m2",
      },
    ],
  };
}

describe("matrixSync", () => {
  test("regenerates linked matrix tasks while preserving non-matrix tasks and progress", () => {
    const previousPlan = planWithQuantity(50);
    const current = generateScheduleFromMatrix(previousPlan);
    const generatedTask = current.tasks.find((task) => !task.isSummary)!;
    const manualTask: GanttTask = {
      id: "manual-1",
      name: "Revision manual",
      start: new Date("2026-01-10T00:00:00"),
      finish: new Date("2026-01-10T00:00:00"),
      duration: 1,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    const result = applyMatrixUpdate({
      tasks: [{ ...generatedTask, progress: 35 }, manualTask],
      currentPlan: previousPlan,
      nextPlan: planWithQuantity(100),
    });

    const regenerated = result.tasks.find(
      (task) => task.matrixSource?.cellId === "cell-muros",
    );

    expect(result.conflicts).toEqual([]);
    expect(result.tasks).toContainEqual(manualTask);
    expect(regenerated).toMatchObject({
      duration: 4,
      progress: 35,
    });
    expect(result.matrixPlan.cells[0].generatedTaskIds).toEqual([
      regenerated?.id,
    ]);
  });

  test("captures Gantt duration edits as approved-feedback candidates on matrix cells", () => {
    const plan = planWithQuantity(50);
    const generated = generateScheduleFromMatrix(plan);
    const editedTasks = generated.tasks.map((task) =>
      task.matrixSource?.activityId === "mamposteria"
        ? { ...task, duration: 5 }
        : task,
    );

    const synced = syncMatrixPlanFromTasks(plan, editedTasks);

    expect(synced.cells[0].feedback).toEqual({
      source: "gantt",
      observedDurationDays: 5,
      suggestedProductivityPerDay: 10,
      status: "pendingApproval",
    });
  });

  test("syncs newer Gantt edits back to activity-level matrix quantities automatically", () => {
    const plan: MatrixPlan = {
      ...planWithQuantity(50),
      cells: [
        {
          ...planWithQuantity(50).cells[0],
          activityOverrides: [
            {
              activityId: "mamposteria",
              quantity: 50,
              unit: "m2",
              productivityPerDay: 25,
              lastEditedAt: "2026-01-01T00:00:00.000Z",
              lastEditedFrom: "matrix",
            },
          ],
        },
      ],
    };
    const generated = generateScheduleFromMatrix(plan);
    const editedTasks = generated.tasks.map((task) =>
      task.matrixSource?.activityId === "mamposteria"
        ? {
            ...task,
            duration: 5,
            matrixSync: {
              lastEditedAt: "2026-01-02T00:00:00.000Z",
              lastEditedFrom: "gantt" as const,
            },
          }
        : task,
    );

    const synced = syncMatrixPlanFromTasks(plan, editedTasks);

    expect(synced.cells[0].activityOverrides).toEqual([
      expect.objectContaining({
        activityId: "mamposteria",
        name: "Piso 1 - Mamposteria - Arquitectura",
        quantity: 50,
        unit: "m2",
        productivityPerDay: 10,
        sourceTaskId: "mx-task-cell-muros-mamposteria",
        duration: 5,
        progress: 0,
        lastEditedAt: "2026-01-02T00:00:00.000Z",
        lastEditedFrom: "gantt",
      }),
    ]);
    expect(synced.cells[0].feedback).toBeUndefined();
  });

  test("keeps newer Gantt task edits when applying an older matrix update", () => {
    const currentPlan: MatrixPlan = {
      ...planWithQuantity(50),
      cells: [
        {
          ...planWithQuantity(50).cells[0],
          activityOverrides: [
            {
              activityId: "mamposteria",
              quantity: 50,
              unit: "m2",
              productivityPerDay: 25,
              lastEditedAt: "2026-01-01T00:00:00.000Z",
              lastEditedFrom: "matrix",
            },
          ],
        },
      ],
    };
    const generated = generateScheduleFromMatrix(currentPlan);
    const generatedTask = generated.tasks.find((task) => !task.isSummary)!;

    const result = applyMatrixUpdate({
      tasks: [
        {
          ...generatedTask,
          duration: 5,
          matrixSync: {
            lastEditedAt: "2026-01-03T00:00:00.000Z",
            lastEditedFrom: "gantt",
          },
        },
      ],
      currentPlan,
      nextPlan: {
        ...currentPlan,
        cells: [
          {
            ...currentPlan.cells[0],
            activityOverrides: [
              {
                activityId: "mamposteria",
                quantity: 100,
                unit: "m2",
                productivityPerDay: 25,
                lastEditedAt: "2026-01-02T00:00:00.000Z",
                lastEditedFrom: "matrix",
              },
            ],
          },
        ],
      },
    });

    expect(result.tasks.find((task) => !task.isSummary)).toMatchObject({
      duration: 5,
      matrixSync: {
        lastEditedAt: "2026-01-03T00:00:00.000Z",
        lastEditedFrom: "gantt",
      },
    });
  });
});
