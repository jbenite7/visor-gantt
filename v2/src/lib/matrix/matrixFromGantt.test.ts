import type { GanttTask } from "@/components/gantt/types";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import { buildMatrixPlanFromGantt } from "@/lib/matrix/matrixFromGantt";

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const importedTasks: GanttTask[] = [
  {
    id: 10,
    name: "Estructura",
    start: date("2026-01-01"),
    finish: date("2026-01-10"),
    duration: 10,
    progress: 50,
    percentComplete: 50,
    isCritical: true,
    isMilestone: false,
    isSummary: true,
    outlineLevel: 1,
    dependencies: [],
    wbs: "1",
  },
  {
    id: 11,
    name: "Cimentacion",
    start: date("2026-01-01"),
    finish: date("2026-01-03"),
    duration: 3,
    progress: 100,
    percentComplete: 100,
    isCritical: true,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [],
    wbs: "1.1",
    resourceNames: ["Cuadrilla A", "Concreto"],
    cost: 1200,
    actualCost: 900,
  },
  {
    id: 12,
    name: "Columnas",
    start: date("2026-01-04"),
    finish: date("2026-01-08"),
    duration: 5,
    progress: 20,
    percentComplete: 20,
    isCritical: true,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [{ from: 11, to: 12, type: "FS", lag: 0 }],
    wbs: "1.2",
  },
  {
    id: 13,
    name: "Hito entrega estructura",
    start: date("2026-01-08"),
    finish: date("2026-01-08"),
    duration: 0,
    progress: 100,
    percentComplete: 100,
    isCritical: true,
    isMilestone: true,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [{ from: 12, to: 13, type: "FS", lag: 0 }],
    wbs: "1.3",
  },
];

describe("buildMatrixPlanFromGantt", () => {
  test("creates a traceable matrix plan with symmetric Gantt parity", () => {
    const result = buildMatrixPlanFromGantt({
      id: "matrix-mpp",
      name: "Cronograma importado - Matrix",
      startDate: "2026-01-01",
      tasks: importedTasks,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.matrixPlan.cells).toHaveLength(3);
    expect(result.matrixPlan.cells[0].activityOverrides?.[0]).toEqual(
      expect.objectContaining({
        sourceTaskId: 11,
        resourceNames: ["Cuadrilla A", "Concreto"],
        cost: 1200,
        actualCost: 900,
      }),
    );
    expect(result.matrixPlan.ganttDependencies).toEqual([
      { from: 11, to: 12, type: "FS", lag: 0 },
      { from: 12, to: 13, type: "FS", lag: 0 },
    ]);
    expect(result.tasks.find((task) => task.id === 11)?.matrixSource).toEqual(
      expect.objectContaining({
        matrixPlanId: "matrix-mpp",
        cellId: "cell-11",
        recipeId: "recipe-11",
        activityId: "activity-11",
      }),
    );
    expect(result.tasks.find((task) => task.id === 10)?.matrixSource).toBeUndefined();

    const generated = generateScheduleFromMatrix(result.matrixPlan);
    const generatedOperational = generated.tasks.filter((task) => !task.isSummary);

    expect(generatedOperational).toEqual([
      expect.objectContaining({
        id: 11,
        name: "Cimentacion",
        duration: 3,
        progress: 100,
        percentComplete: 100,
        resourceNames: ["Cuadrilla A", "Concreto"],
        cost: 1200,
        actualCost: 900,
      }),
      expect.objectContaining({
        id: 12,
        name: "Columnas",
        duration: 5,
        progress: 20,
        percentComplete: 20,
        dependencies: [{ from: 11, to: 12, type: "FS", lag: 0 }],
      }),
      expect.objectContaining({
        id: 13,
        name: "Hito entrega estructura",
        duration: 0,
        progress: 100,
        percentComplete: 100,
        isCritical: true,
        isMilestone: true,
        dependencies: [{ from: 12, to: 13, type: "FS", lag: 0 }],
      }),
    ]);
    expect(generatedOperational.map((task) => task.start.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-04T00:00:00.000Z",
      "2026-01-08T00:00:00.000Z",
    ]);
    expect(generatedOperational.map((task) => task.finish.toISOString())).toEqual([
      "2026-01-03T00:00:00.000Z",
      "2026-01-08T00:00:00.000Z",
      "2026-01-08T00:00:00.000Z",
    ]);
  });
});
