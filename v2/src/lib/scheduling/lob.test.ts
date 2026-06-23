import {
  computeLOBLayout,
  generateAutomaticLOBFromTasks,
  generateLOBFromTasks,
} from "./lob";
import type { LOBActivity, LOBUnit } from "@/types/lob";
import type { GanttTask } from "@/components/gantt/types";
import type { ActivityMapping } from "./lob";

// ---------------------------------------------------------------------------
// computeLOBLayout
// ---------------------------------------------------------------------------

describe("computeLOBLayout", () => {
  // ---------------------------------------------------------------------------
  // 1. Empty input
  // ---------------------------------------------------------------------------
  it("returns empty lines and zero scales when no activities are given", () => {
    const result = computeLOBLayout([], []);

    expect(result.lines).toEqual([]);
    expect(result.totalUnits).toBe(0);
    expect(result.yScale.min).toBe(0);
    expect(result.yScale.max).toBe(0);
    // xScale should contain valid Dates
    expect(result.xScale.min).toBeInstanceOf(Date);
    expect(result.xScale.max).toBeInstanceOf(Date);
  });

  // ---------------------------------------------------------------------------
  // 2. Single activity with 3 units
  // ---------------------------------------------------------------------------
  it("produces one planned line with three points for three units", () => {
    const activity: LOBActivity = {
      id: "act-exc",
      name: "Excavation",
      taskIds: ["1"],
      plannedRate: 1,
      unitLabel: "Floor",
      plannedStart: new Date("2026-01-01"),
      plannedFinish: new Date("2026-01-15"),
    };

    const units: LOBUnit[] = [
      { activityId: "act-exc", unitIndex: 0, plannedDate: new Date("2026-01-01") },
      { activityId: "act-exc", unitIndex: 1, plannedDate: new Date("2026-01-05") },
      { activityId: "act-exc", unitIndex: 2, plannedDate: new Date("2026-01-10") },
    ];

    const result = computeLOBLayout([activity], units);

    // One planned line (no actual data)
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].activityId).toBe("act-exc");
    expect(result.lines[0].points).toHaveLength(3);
    expect(result.lines[0].isCritical).toBe(false);

    // Points sorted by unitIndex
    expect(result.lines[0].points[0].unitIndex).toBe(0);
    expect(result.lines[0].points[1].unitIndex).toBe(1);
    expect(result.lines[0].points[2].unitIndex).toBe(2);

    // yScale covers 0..2 (max unit index)
    expect(result.yScale.min).toBe(0);
    expect(result.yScale.max).toBe(2);
    expect(result.totalUnits).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 3. Multiple activities
  // ---------------------------------------------------------------------------
  it("assigns different colors to different activities", () => {
    const actA: LOBActivity = {
      id: "act-a",
      name: "Structure",
      taskIds: ["1"],
      plannedRate: 1,
      unitLabel: "Piso",
      plannedStart: new Date("2026-01-01"),
      plannedFinish: new Date("2026-01-10"),
    };

    const actB: LOBActivity = {
      id: "act-b",
      name: "Finishing",
      taskIds: ["2"],
      plannedRate: 0.5,
      unitLabel: "Piso",
      plannedStart: new Date("2026-01-05"),
      plannedFinish: new Date("2026-01-15"),
    };

    const units: LOBUnit[] = [
      { activityId: "act-a", unitIndex: 0, plannedDate: new Date("2026-01-01") },
      { activityId: "act-a", unitIndex: 1, plannedDate: new Date("2026-01-05") },
      { activityId: "act-b", unitIndex: 0, plannedDate: new Date("2026-01-05") },
      { activityId: "act-b", unitIndex: 1, plannedDate: new Date("2026-01-10") },
    ];

    const result = computeLOBLayout([actA, actB], units);

    expect(result.lines).toHaveLength(2);

    // Verify lines are in activity order
    expect(result.lines[0].activityId).toBe("act-a");
    expect(result.lines[1].activityId).toBe("act-b");

    // Colors should differ (different indices in AIA palette)
    expect(result.lines[0].color).not.toBe(result.lines[1].color);

    // Each line should have 2 points (one per unit)
    expect(result.lines[0].points).toHaveLength(2);
    expect(result.lines[1].points).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // 4. Activity without unit data (synthetic points from activity dates)
  // ---------------------------------------------------------------------------
  it("creates synthetic planned points when no unit data exists", () => {
    const activity: LOBActivity = {
      id: "act-no-units",
      name: "Planning",
      taskIds: ["99"],
      plannedRate: 1,
      unitLabel: "Phase",
      plannedStart: new Date("2026-02-01"),
      plannedFinish: new Date("2026-02-10"),
    };

    const result = computeLOBLayout([activity], []);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].activityId).toBe("act-no-units");
    // Synthetic line uses 2 points (start at unit 0, finish at unit 1)
    expect(result.lines[0].points).toHaveLength(2);
    expect(result.lines[0].points[0].unitIndex).toBe(0);
    expect(result.lines[0].points[0].date).toEqual(new Date("2026-02-01"));
    expect(result.lines[0].points[1].unitIndex).toBe(1);
    expect(result.lines[0].points[1].date).toEqual(new Date("2026-02-10"));
  });

  // ---------------------------------------------------------------------------
  // 5. Actual dates produce actual line
  // ---------------------------------------------------------------------------
  it("adds an actual line when units have actualDate", () => {
    const activity: LOBActivity = {
      id: "act-actual",
      name: "Finishing",
      taskIds: ["1"],
      plannedRate: 1,
      unitLabel: "Floor",
      plannedStart: new Date("2026-01-01"),
      plannedFinish: new Date("2026-01-10"),
    };

    const units: LOBUnit[] = [
      { activityId: "act-actual", unitIndex: 0, plannedDate: new Date("2026-01-01"), actualDate: new Date("2026-01-02") },
      { activityId: "act-actual", unitIndex: 1, plannedDate: new Date("2026-01-05"), actualDate: new Date("2026-01-06") },
      { activityId: "act-actual", unitIndex: 2, plannedDate: new Date("2026-01-10") },
    ];

    const result = computeLOBLayout([activity], units);

    // 1 planned line + 1 actual line
    expect(result.lines).toHaveLength(2);

    const plannedLine = result.lines.find((l) => l.activityId === "act-actual")!;
    const actualLine = result.lines.find((l) => l.activityId === "act-actual-actual")!;

    expect(plannedLine).toBeDefined();
    expect(actualLine).toBeDefined();

    // Actual line has 2 points (only units 0 and 1 have actualDate)
    expect(actualLine.points).toHaveLength(2);
    expect(actualLine.points[0].unitIndex).toBe(0);
    expect(actualLine.points[0].date).toEqual(new Date("2026-01-02"));
    expect(actualLine.points[1].unitIndex).toBe(1);
    expect(actualLine.points[1].date).toEqual(new Date("2026-01-06"));

    // Actual > planned → deviation → isCritical
    expect(actualLine.isCritical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateLOBFromTasks
// ---------------------------------------------------------------------------

describe("generateLOBFromTasks", () => {
  // ---------------------------------------------------------------------------
  // 6. Generate LOBActivity from tasks
  // ---------------------------------------------------------------------------
  it("creates LOBActivity with correct plannedStart/Finish from task dates", () => {
    const tasks: GanttTask[] = [
      {
        id: "T1",
        name: "Floor 1",
        start: new Date("2026-01-01"),
        finish: new Date("2026-01-05"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
      {
        id: "T2",
        name: "Floor 2",
        start: new Date("2026-01-06"),
        finish: new Date("2026-01-10"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
      {
        id: "T3",
        name: "Floor 3",
        start: new Date("2026-01-11"),
        finish: new Date("2026-01-15"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];

    const activityMapping: ActivityMapping[] = [
      { activityName: "Finishing", taskIds: ["T1", "T2", "T3"], unitLabel: "Floor" },
    ];

    const result = generateLOBFromTasks(tasks, activityMapping);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("lob-activity-0");
    expect(result[0].name).toBe("Finishing");
    expect(result[0].taskIds).toEqual(["T1", "T2", "T3"]);
    expect(result[0].unitLabel).toBe("Floor");
    // Earliest start across all tasks
    expect(result[0].plannedStart).toEqual(new Date("2026-01-01"));
    // Latest finish across all tasks
    expect(result[0].plannedFinish).toEqual(new Date("2026-01-15"));
    // Rate: 3 tasks / (14 days) = ~0.214
    expect(result[0].plannedRate).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 7. Empty mapping yields empty result
  // ---------------------------------------------------------------------------
  it("returns empty array when activity mapping is empty", () => {
    const tasks: GanttTask[] = [];
    const result = generateLOBFromTasks(tasks, []);
    expect(result).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // 8. Unknown task IDs produce stub activity
  // ---------------------------------------------------------------------------
  it("creates a stub activity when no tasks match the mapping", () => {
    const tasks: GanttTask[] = [
      {
        id: "T1",
        name: "Real Task",
        start: new Date("2026-01-01"),
        finish: new Date("2026-01-05"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];

    const activityMapping: ActivityMapping[] = [
      { activityName: "Ghost", taskIds: ["UNKNOWN"], unitLabel: "Floor" },
    ];

    const result = generateLOBFromTasks(tasks, activityMapping);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Ghost");
    expect(result[0].plannedRate).toBe(1);
    // Stub: plannedStart and plannedFinish should be the same (today)
    expect(result[0].plannedStart).toEqual(result[0].plannedFinish);
  });
});

describe("generateAutomaticLOBFromTasks", () => {
  it("detects repetitive floor activities from task names", () => {
    const baseTask = {
      duration: 3,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    const result = generateAutomaticLOBFromTasks([
      {
        ...baseTask,
        id: 1,
        name: "Acero columnas N1",
        start: new Date("2026-08-01"),
        finish: new Date("2026-08-03"),
      },
      {
        ...baseTask,
        id: 2,
        name: "Acero columnas N2",
        start: new Date("2026-08-04"),
        finish: new Date("2026-08-06"),
      },
      {
        ...baseTask,
        id: 3,
        name: "Cimbra columnas N1",
        start: new Date("2026-08-02"),
        finish: new Date("2026-08-04"),
      },
      {
        ...baseTask,
        id: 4,
        name: "Cimbra columnas N2",
        start: new Date("2026-08-05"),
        finish: new Date("2026-08-07"),
      },
    ]);

    expect(result.detectedUnitLabel).toBe("Piso");
    expect(result.activities).toHaveLength(2);
    expect(result.activities.map((activity) => activity.name)).toEqual([
      "Acero Columnas",
      "Cimbra Columnas",
    ]);
    expect(result.units).toHaveLength(4);
  });
});
