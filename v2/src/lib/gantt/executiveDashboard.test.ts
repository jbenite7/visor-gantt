import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import { buildExecutivePlanningSummary } from "./executiveDashboard";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-05T08:00:00"),
    duration: 1,
    progress: 100,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("executive planning dashboard", () => {
  test("summarizes a healthy plan across schedule, cost, scope and progress", () => {
    const tasks = [task({ id: 1, isCritical: true })];
    const budgetMappings: BudgetMapping[] = [
      { budgetItemId: "b1", taskId: 1, amount: 1000 },
    ];
    const budgetItems: BudgetItem[] = [
      {
        id: "b1",
        category: "labor",
        budgetedAmount: 1000,
        spentAmount: 900,
        mappedTaskIds: [1],
      },
    ];

    const summary = buildExecutivePlanningSummary({
      tasks,
      budgetItems,
      budgetMappings,
      scheduleIssues: [],
      bottlenecks: [],
    });

    expect(summary.health).toBe("good");
    expect(summary.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "progress", value: "100.0%" }),
        expect.objectContaining({ id: "scope", value: "100.0%" }),
      ]),
    );
  });

  test("flags critical executive health when schedule, cost and scope are weak", () => {
    const tasks = [
      task({ id: 1, progress: 10, isCritical: true }),
      task({ id: 2, progress: 0 }),
    ];
    const budgetMappings: BudgetMapping[] = [
      { budgetItemId: "b1", taskId: 1, amount: 1000 },
    ];
    const budgetItems: BudgetItem[] = [
      {
        id: "b1",
        category: "labor",
        budgetedAmount: 1000,
        spentAmount: 1500,
        mappedTaskIds: [1],
      },
    ];

    const summary = buildExecutivePlanningSummary({
      tasks,
      budgetItems,
      budgetMappings,
      scheduleIssues: [
        {
          kind: "cycle",
          severity: "high",
          taskIds: [1, 2],
          message: "Ciclo",
        },
      ],
      bottlenecks: [],
    });

    expect(summary.health).toBe("critical");
    expect(summary.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: "schedule", health: "critical" }),
        expect.objectContaining({ dimension: "cost", health: "critical" }),
        expect.objectContaining({ dimension: "scope", health: "critical" }),
      ]),
    );
  });
});
