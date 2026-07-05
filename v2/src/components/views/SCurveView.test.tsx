/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SCurveView from "./SCurveView";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";

function task(overrides: Partial<GanttTask> & { id: string | number; name: string }): GanttTask {
  return {
    start: new Date(2026, 0, 1),
    finish: new Date(2026, 0, 4),
    duration: 4,
    progress: 25,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("SCurveView", () => {
  test("renders automatic feedback from earned value diagnostics", () => {
    const tasks: GanttTask[] = [
      task({ id: "T1", name: "Estructura" }),
    ];
    const budgetMappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 1000 },
    ];
    const budgetItems: BudgetItem[] = [
      {
        id: "item-1",
        category: "labor",
        budgetedAmount: 1000,
        spentAmount: 1500,
        mappedTaskIds: ["T1"],
      },
    ];

    render(
      <SCurveView
        tasks={tasks}
        budgetMappings={budgetMappings}
        budgetItems={budgetItems}
      />,
    );

    expect(screen.getByTestId("s-curve-feedback")).toHaveTextContent("SPI");
    expect(screen.getAllByTestId("s-curve-feedback-card").length).toBeGreaterThan(0);
  });
});
