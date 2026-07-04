import {
  computeScheduleSCurve,
  computeBudgetSCurve,
  computeEarnedValueSCurve,
  diagnoseSCurve,
  getTaskBudgetedCost,
  getTaskActualCost,
} from "./scurve";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetMapping, BudgetItem } from "@/types/budget";

// ---------------------------------------------------------------------------
// NOTE on date constructors
//
// scurve.ts internally uses dateOnly() → new Date(year, month, day) which
// creates dates in LOCAL time.  To match this behaviour, all test dates must
// also be created with the local constructor new Date(YYYY, MM-1, DD).
//
// Using new Date("YYYY-MM-DD") (UTC) would cause timezone-dependent failures
// when local timezone is ahead of UTC.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(
  overrides: Partial<GanttTask> & { id: string | number; name: string },
): GanttTask {
  return {
    start: new Date(2026, 0, 1),
    finish: new Date(2026, 0, 1),
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

// ---------------------------------------------------------------------------
// computeScheduleSCurve
// ---------------------------------------------------------------------------

describe("computeScheduleSCurve", () => {
  // -------------------------------------------------------------------------
  // 1. Empty input
  // -------------------------------------------------------------------------
  it("returns empty points and maxValue=0 for empty task list", () => {
    const result = computeScheduleSCurve([]);

    expect(result.points).toEqual([]);
    expect(result.maxValue).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 2. Tasks with sequential dates
  // -------------------------------------------------------------------------
  it("produces an S-curve that starts near 0 and ends at 100", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: "T1",
        name: "Task 1",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 2),
        duration: 2,
      }),
      makeTask({
        id: "T2",
        name: "Task 2",
        start: new Date(2026, 0, 3),
        finish: new Date(2026, 0, 5),
        duration: 3,
      }),
      makeTask({
        id: "T3",
        name: "Task 3",
        start: new Date(2026, 0, 6),
        finish: new Date(2026, 0, 7),
        duration: 2,
      }),
    ];

    const result = computeScheduleSCurve(tasks);

    // Project range: Jan 1 → Jan 7 inclusive = 7 points
    expect(result.points).toHaveLength(7);

    // First point: only T1 started, 1 work-day out of 7 total
    expect(result.points[0].cumulativeValue).toBeCloseTo(14.29, 1);

    // Last point: all work complete
    const last = result.points[result.points.length - 1];
    expect(last.cumulativeValue).toBe(100);
    expect(result.maxValue).toBe(100);
  });

  // -------------------------------------------------------------------------
  // 3. Single task
  // -------------------------------------------------------------------------
  it("handles a single task of 1 day", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: "T1",
        name: "Quick",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 1),
        duration: 1,
      }),
    ];

    const result = computeScheduleSCurve(tasks);

    // Single day → 1 point
    expect(result.points).toHaveLength(1);
    expect(result.points[0].cumulativeValue).toBe(100);
    expect(result.maxValue).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeBudgetSCurve
// ---------------------------------------------------------------------------

describe("computeBudgetSCurve", () => {
  // -------------------------------------------------------------------------
  // 4. Empty input
  // -------------------------------------------------------------------------
  it("returns empty points when no tasks or mappings exist", () => {
    const result = computeBudgetSCurve([], [], []);
    expect(result.points).toEqual([]);
    expect(result.maxValue).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 5. Two tasks with budget mappings
  // -------------------------------------------------------------------------
  it("accumulates budgeted cost across tasks over time", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: "T1",
        name: "Foundation",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 2),
        duration: 2,
      }),
      makeTask({
        id: "T2",
        name: "Framing",
        start: new Date(2026, 0, 3),
        finish: new Date(2026, 0, 4),
        duration: 2,
      }),
    ];

    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 1000 },
      { budgetItemId: "item-2", taskId: "T2", amount: 2000 },
    ];

    const items: BudgetItem[] = [
      {
        id: "item-1",
        category: "labor",
        budgetedAmount: 1000,
        spentAmount: 0,
        mappedTaskIds: ["T1"],
      },
      {
        id: "item-2",
        category: "materials",
        budgetedAmount: 2000,
        spentAmount: 0,
        mappedTaskIds: ["T2"],
      },
    ];

    const result = computeBudgetSCurve(tasks, mappings, items);

    // Project range: Jan 1 → Jan 4 inclusive = 4 points
    expect(result.points).toHaveLength(4);

    // Day 1 (Jan 1): T1 at 50% = 500
    expect(result.points[0].cumulativeValue).toBe(500);

    // Day 2 (Jan 2): T1 at 100% = 1000
    expect(result.points[1].cumulativeValue).toBe(1000);

    // Day 3 (Jan 3): T1 done (1000) + T2 at 50% (1000) = 2000
    expect(result.points[2].cumulativeValue).toBe(2000);

    // Day 4 (Jan 4): all done = 1000 + 2000 = 3000
    expect(result.points[3].cumulativeValue).toBe(3000);
    expect(result.maxValue).toBe(3000);
  });

  // -------------------------------------------------------------------------
  // 6. Tasks without budget mappings contribute nothing
  // -------------------------------------------------------------------------
  it("ignores tasks that have no budget mapping", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: "T1",
        name: "No Budget",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 3),
        duration: 3,
      }),
    ];

    const result = computeBudgetSCurve(tasks, [], []);
    expect(result.points).toEqual([]);
    expect(result.maxValue).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeEarnedValueSCurve
// ---------------------------------------------------------------------------

describe("computeEarnedValueSCurve", () => {
  // -------------------------------------------------------------------------
  // 7. Empty input
  // -------------------------------------------------------------------------
  it("returns empty points with CPI/SPI=1 when no tasks are given", () => {
    const result = computeEarnedValueSCurve([], [], []);
    expect(result.points).toEqual([]);
    expect(result.cpi).toBe(1);
    expect(result.spi).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 8. Tasks with progress at 50 %
  // -------------------------------------------------------------------------
  it("computes PV, EV, AC and final CPI/SPI correctly", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: "T1",
        name: "Design",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 2),
        duration: 2,
        progress: 100,
      }),
      makeTask({
        id: "T2",
        name: "Development",
        start: new Date(2026, 0, 3),
        finish: new Date(2026, 0, 4),
        duration: 2,
        progress: 50,
      }),
    ];

    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 1000 },
      { budgetItemId: "item-2", taskId: "T2", amount: 500 },
    ];

    const items: BudgetItem[] = [
      {
        id: "item-1",
        category: "labor",
        budgetedAmount: 1000,
        spentAmount: 800,
        mappedTaskIds: ["T1"],
      },
      {
        id: "item-2",
        category: "labor",
        budgetedAmount: 500,
        spentAmount: 0,
        mappedTaskIds: ["T2"],
      },
    ];

    const result = computeEarnedValueSCurve(tasks, mappings, items);

    // Project range: Jan 1 → Jan 4 inclusive = 4 points
    expect(result.points).toHaveLength(4);

    const last = result.points[result.points.length - 1];

    // ── PV at last day ──
    // T1: 1000 * min(4/2,1) = 1000
    // T2:  500 * min(2/2,1) =  500
    // Total PV = 1500
    expect(last.pv).toBe(1500);

    // ── EV at last day ──
    // T1: progress=100%, eFrac = min(4/2, 1.0) = 1.0, EV = 1000 * 1.0 = 1000
    // T2: progress= 50%, eFrac = min(2/2, 0.5) = 0.5, EV =  500 * 0.5 =  250
    // Total EV = 1250
    expect(last.ev).toBe(1250);

    // ── AC at last day ──
    // T1: actual=800 (>0), AC = 800 * 1.0 = 800
    // T2: actual=0, fallback: AC = 500 * 0.5 = 250
    // Total AC = 1050
    expect(last.ac).toBe(1050);

    // CPI = 1250 / 1050 ≈ 1.190
    expect(result.cpi).toBeCloseTo(1.19, 2);

    // SPI = 1250 / 1500 ≈ 0.833
    expect(result.spi).toBeCloseTo(0.833, 2);
  });
});

describe("diagnoseSCurve", () => {
  it("detects schedule delay and cost overrun from earned value indices", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: "T1",
        name: "Estructura",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 4),
        duration: 4,
        progress: 25,
      }),
    ];
    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 1000 },
    ];
    const items: BudgetItem[] = [
      {
        id: "item-1",
        category: "labor",
        budgetedAmount: 1000,
        spentAmount: 1500,
        mappedTaskIds: ["T1"],
      },
    ];

    const diagnostics = diagnoseSCurve(tasks, mappings, items);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "scheduleBehind", severity: "high" }),
        expect.objectContaining({ kind: "costOverrun", severity: "high" }),
      ]),
    );
  });

  it("detects missing budget mapping and missing reported progress", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: "T1",
        name: "Sin presupuesto",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 2),
        duration: 2,
        progress: 0,
      }),
      makeTask({
        id: "T2",
        name: "Tambien sin presupuesto",
        start: new Date(2026, 0, 1),
        finish: new Date(2026, 0, 2),
        duration: 2,
        progress: 0,
      }),
    ];

    const diagnostics = diagnoseSCurve(tasks, [], []);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "missingBudget", severity: "high" }),
        expect.objectContaining({ kind: "missingProgress", severity: "medium" }),
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// getTaskBudgetedCost
// ---------------------------------------------------------------------------

describe("getTaskBudgetedCost", () => {
  // -------------------------------------------------------------------------
  // 9. Single mapping
  // -------------------------------------------------------------------------
  it("returns the mapped amount for a task", () => {
    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 500 },
    ];
    const result = getTaskBudgetedCost("T1", mappings, []);
    expect(result).toBe(500);
  });

  // -------------------------------------------------------------------------
  // 10. Multiple mappings sum
  // -------------------------------------------------------------------------
  it("sums multiple budget mappings for the same task", () => {
    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 300 },
      { budgetItemId: "item-2", taskId: "T1", amount: 700 },
    ];
    const result = getTaskBudgetedCost("T1", mappings, []);
    expect(result).toBe(1000);
  });

  // -------------------------------------------------------------------------
  // 11. Unknown task
  // -------------------------------------------------------------------------
  it("returns 0 for a task with no budget mapping", () => {
    const result = getTaskBudgetedCost("UNKNOWN", [], []);
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTaskActualCost
// ---------------------------------------------------------------------------

describe("getTaskActualCost", () => {
  // -------------------------------------------------------------------------
  // 12. Proportional actual cost
  // -------------------------------------------------------------------------
  it("distributes spentAmount proportionally by mapped share", () => {
    const item: BudgetItem = {
      id: "item-1",
      category: "labor",
      budgetedAmount: 1000,
      spentAmount: 300,
      mappedTaskIds: ["T1"],
    };
    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 500 },
    ];
    const result = getTaskActualCost("T1", mappings, [item]);
    // 300 × (500 / 1000) = 150
    expect(result).toBe(150);
  });

  // -------------------------------------------------------------------------
  // 13. No matching item
  // -------------------------------------------------------------------------
  it("returns 0 when the budget item is not in the items array", () => {
    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-ghost", taskId: "T1", amount: 500 },
    ];
    const result = getTaskActualCost("T1", mappings, []);
    expect(result).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 14. Zero budgetedAmount guards
  // -------------------------------------------------------------------------
  it("returns 0 when budgetedAmount is 0 to avoid division by zero", () => {
    const item: BudgetItem = {
      id: "item-1",
      category: "labor",
      budgetedAmount: 0,
      spentAmount: 300,
      mappedTaskIds: ["T1"],
    };
    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 500 },
    ];
    const result = getTaskActualCost("T1", mappings, [item]);
    expect(result).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 15. Mappings for other tasks are ignored
  // -------------------------------------------------------------------------
  it("only includes mappings matching the requested taskId", () => {
    const item: BudgetItem = {
      id: "item-1",
      category: "materials",
      budgetedAmount: 2000,
      spentAmount: 500,
      mappedTaskIds: ["T1", "T2"],
    };
    const mappings: BudgetMapping[] = [
      { budgetItemId: "item-1", taskId: "T1", amount: 800 },
      { budgetItemId: "item-1", taskId: "T2", amount: 1200 },
    ];
    const resultForT1 = getTaskActualCost("T1", mappings, [item]);
    const resultForT2 = getTaskActualCost("T2", mappings, [item]);
    // T1: 500 × (800 / 2000) = 200
    expect(resultForT1).toBe(200);
    // T2: 500 × (1200 / 2000) = 300
    expect(resultForT2).toBe(300);
  });
});
