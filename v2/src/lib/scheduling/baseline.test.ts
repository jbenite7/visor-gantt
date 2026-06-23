import {
  saveBaseline,
  applyBaselineToTasks,
  compareWithBaseline,
  getBaselineSummary,
} from "./baseline";
import { GanttTask } from "@/components/gantt/types";
import { Baseline } from "@/types/baseline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<GanttTask> & { id: number | string; name: string }): GanttTask {
  return {
    start: new Date("2024-01-01"),
    finish: new Date("2024-01-05"),
    duration: 4,
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
// saveBaseline
// ---------------------------------------------------------------------------

describe("saveBaseline", () => {
  const mockTasks: GanttTask[] = [
    makeTask({
      id: 1,
      name: "Foundation",
      start: new Date("2024-01-01"),
      finish: new Date("2024-01-10"),
      duration: 7,
    }),
    makeTask({
      id: 2,
      name: "Framing",
      start: new Date("2024-01-11"),
      finish: new Date("2024-01-20"),
      duration: 7,
      isCritical: true,
      dependencies: [{ from: 1, to: 2, type: "FS" }],
    }),
    makeTask({
      id: 3,
      name: "Roofing",
      start: new Date("2024-01-21"),
      finish: new Date("2024-01-25"),
      duration: 4,
    }),
  ];

  // -----------------------------------------------------------------------
  // 1. Happy path
  // -----------------------------------------------------------------------
  it("creates a baseline snapshot with correct structure and data", () => {
    const baseline = saveBaseline(mockTasks, "Baseline 1");

    expect(baseline).toBeDefined();
    expect(typeof baseline.id).toBe("string");
    expect(baseline.id.length).toBeGreaterThan(0);
    expect(baseline.name).toBe("Baseline 1");
    expect(baseline.createdAt).toBeInstanceOf(Date);
    expect(baseline.tasks).toHaveLength(3);

    // Verify each BaselineTask maps the correct fields
    expect(baseline.tasks[0]).toEqual({
      taskId: 1,
      baselineStart: new Date("2024-01-01"),
      baselineFinish: new Date("2024-01-10"),
      baselineDuration: 7,
    });
    expect(baseline.tasks[1]).toEqual({
      taskId: 2,
      baselineStart: new Date("2024-01-11"),
      baselineFinish: new Date("2024-01-20"),
      baselineDuration: 7,
    });
    expect(baseline.tasks[2]).toEqual({
      taskId: 3,
      baselineStart: new Date("2024-01-21"),
      baselineFinish: new Date("2024-01-25"),
      baselineDuration: 4,
    });
  });

  // -----------------------------------------------------------------------
  // 2. Does not modify input
  // -----------------------------------------------------------------------
  it("does not mutate the input tasks array", () => {
    const snapshot = [...mockTasks.map((t) => ({ ...t }))];
    saveBaseline(mockTasks, "Test");

    expect(mockTasks).toHaveLength(snapshot.length);
    expect(mockTasks[0].id).toBe(snapshot[0].id);
    expect(mockTasks[0].start).toEqual(snapshot[0].start);
    // No extra properties injected
    expect((mockTasks[0] as unknown as Record<string, unknown>).baselineStart).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 2b. Cost passthrough
  // -----------------------------------------------------------------------
  it("includes baselineCost when the source task has cost", () => {
    const tasksWithCost = [makeTask({ id: 99, name: "Expensive", cost: 15000 })];
    const baseline = saveBaseline(tasksWithCost, "Cost BL");

    expect(baseline.tasks[0].baselineCost).toBe(15000);
  });
});

// ---------------------------------------------------------------------------
// applyBaselineToTasks
// ---------------------------------------------------------------------------

describe("applyBaselineToTasks", () => {
  const mockTasks: GanttTask[] = [
    makeTask({
      id: 1,
      name: "Task A",
      start: new Date("2024-02-01"),
      finish: new Date("2024-02-10"),
      duration: 7,
    }),
    makeTask({
      id: 2,
      name: "Task B",
      start: new Date("2024-02-11"),
      finish: new Date("2024-02-15"),
      duration: 4,
    }),
  ];

  const baseline: Baseline = {
    id: "bl-1",
    name: "Approved Plan",
    createdAt: new Date("2024-01-15"),
    tasks: [
      {
        taskId: 1,
        baselineStart: new Date("2024-02-01"),
        baselineFinish: new Date("2024-02-10"),
        baselineDuration: 7,
      },
    ],
  };

  // -----------------------------------------------------------------------
  // 3. Applies baseline fields
  // -----------------------------------------------------------------------
  it("populates baseline fields on matching tasks", () => {
    const result = applyBaselineToTasks(mockTasks, baseline);

    expect(result).toHaveLength(2);

    // Task 1 matches baseline entry
    expect(result[0].baselineStart).toEqual(new Date("2024-02-01"));
    expect(result[0].baselineFinish).toEqual(new Date("2024-02-10"));
    expect(result[0].baselineDuration).toBe(7);
  });

  // -----------------------------------------------------------------------
  // 4. Tasks without baseline match are unchanged
  // -----------------------------------------------------------------------
  it("leaves tasks without a baseline entry unchanged", () => {
    const result = applyBaselineToTasks(mockTasks, baseline);

    // Task 2 has no baseline entry → no baseline fields
    expect(result[1].baselineStart).toBeUndefined();
    expect(result[1].baselineFinish).toBeUndefined();
    expect(result[1].baselineDuration).toBeUndefined();
    expect(result[1].id).toBe(2);
    expect(result[1].name).toBe("Task B");
  });

  it("does not mutate the original tasks array", () => {
    const result = applyBaselineToTasks(mockTasks, baseline);

    // Original tasks must remain pristine
    expect(mockTasks[0].baselineStart).toBeUndefined();
    expect(mockTasks[1].baselineStart).toBeUndefined();
    // Returns a new array
    expect(result).not.toBe(mockTasks);
  });
});

// ---------------------------------------------------------------------------
// compareWithBaseline
// ---------------------------------------------------------------------------

describe("compareWithBaseline", () => {
  // -----------------------------------------------------------------------
  // 5. Behind schedule
  // -----------------------------------------------------------------------
  it("detects tasks behind schedule (positive finish variance)", () => {
    const task = makeTask({
      id: 1,
      name: "Late Task",
      start: new Date("2024-01-01"),
      finish: new Date("2024-01-08"), // 3 days later than baseline
      duration: 7,
    });

    const baseline: Baseline = {
      id: "bl-test",
      name: "BL",
      createdAt: new Date(),
      tasks: [
        {
          taskId: 1,
          baselineStart: new Date("2024-01-01"),
          baselineFinish: new Date("2024-01-05"),
          baselineDuration: 4,
        },
      ],
    };

    const variances = compareWithBaseline([task], baseline);

    expect(variances).toHaveLength(1);
    expect(variances[0].taskId).toBe(1);
    expect(variances[0].taskName).toBe("Late Task");
    expect(variances[0].startVariance).toBe(0);
    expect(variances[0].finishVariance).toBe(3);
    expect(variances[0].durationVariance).toBe(3);
    expect(variances[0].isBehind).toBe(true);
    expect(variances[0].isAhead).toBe(false);
    expect(variances[0].isOnSchedule).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 6. Ahead of schedule
  // -----------------------------------------------------------------------
  it("detects tasks ahead of schedule (negative finish variance)", () => {
    const task = makeTask({
      id: 2,
      name: "Early Task",
      start: new Date("2024-01-06"),
      finish: new Date("2024-01-08"), // 2 days earlier than baseline
      duration: 2,
    });

    const baseline: Baseline = {
      id: "bl-test",
      name: "BL",
      createdAt: new Date(),
      tasks: [
        {
          taskId: 2,
          baselineStart: new Date("2024-01-06"),
          baselineFinish: new Date("2024-01-10"),
          baselineDuration: 4,
        },
      ],
    };

    const variances = compareWithBaseline([task], baseline);

    expect(variances).toHaveLength(1);
    expect(variances[0].finishVariance).toBe(-2);
    expect(variances[0].durationVariance).toBe(-2);
    expect(variances[0].isAhead).toBe(true);
    expect(variances[0].isBehind).toBe(false);
    expect(variances[0].isOnSchedule).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 7. On schedule
  // -----------------------------------------------------------------------
  it("reports on-schedule when dates and duration match baseline", () => {
    const task = makeTask({
      id: 3,
      name: "On Time",
      start: new Date("2024-02-01"),
      finish: new Date("2024-02-05"),
      duration: 4,
    });

    const baseline: Baseline = {
      id: "bl-test",
      name: "BL",
      createdAt: new Date(),
      tasks: [
        {
          taskId: 3,
          baselineStart: new Date("2024-02-01"),
          baselineFinish: new Date("2024-02-05"),
          baselineDuration: 4,
        },
      ],
    };

    const variances = compareWithBaseline([task], baseline);

    expect(variances).toHaveLength(1);
    expect(variances[0].finishVariance).toBe(0);
    expect(variances[0].startVariance).toBe(0);
    expect(variances[0].durationVariance).toBe(0);
    expect(variances[0].isOnSchedule).toBe(true);
    expect(variances[0].isAhead).toBe(false);
    expect(variances[0].isBehind).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 7b. Edge: tasks without matching baseline are skipped
  // -----------------------------------------------------------------------
  it("skips tasks that have no matching baseline entry", () => {
    const tasks = [
      makeTask({ id: 10, name: "Orphan Task" }),
    ];
    const emptyBaseline: Baseline = {
      id: "empty",
      name: "Empty",
      createdAt: new Date(),
      tasks: [],
    };

    const variances = compareWithBaseline(tasks, emptyBaseline);
    expect(variances).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // 7c. Start variance
  // -----------------------------------------------------------------------
  it("calculates start variance alongside finish variance", () => {
    const task = makeTask({
      id: 4,
      name: "Shifted",
      start: new Date("2024-03-03"), // +2 days
      finish: new Date("2024-03-07"), // +2 days
      duration: 4,
    });

    const baseline: Baseline = {
      id: "bl-test",
      name: "BL",
      createdAt: new Date(),
      tasks: [
        {
          taskId: 4,
          baselineStart: new Date("2024-03-01"),
          baselineFinish: new Date("2024-03-05"),
          baselineDuration: 4,
        },
      ],
    };

    const variances = compareWithBaseline([task], baseline);

    expect(variances).toHaveLength(1);
    expect(variances[0].startVariance).toBe(2);
    expect(variances[0].finishVariance).toBe(2);
    // Same duration → no variance
    expect(variances[0].durationVariance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getBaselineSummary
// ---------------------------------------------------------------------------

describe("getBaselineSummary", () => {
  // -----------------------------------------------------------------------
  // 8. Summary stats
  // -----------------------------------------------------------------------
  it("returns correct summary for a baseline with multiple tasks", () => {
    const baseline: Baseline = {
      id: "bl-summary",
      name: "Summary",
      createdAt: new Date(),
      tasks: [
        {
          taskId: 1,
          baselineStart: new Date("2024-01-01"),
          baselineFinish: new Date("2024-01-10"),
          baselineDuration: 7,
        },
        {
          taskId: 2,
          baselineStart: new Date("2024-01-11"),
          baselineFinish: new Date("2024-01-20"),
          baselineDuration: 7,
        },
        {
          taskId: 3,
          baselineStart: new Date("2024-01-21"),
          baselineFinish: new Date("2024-01-25"),
          baselineDuration: 4,
        },
      ],
    };

    const summary = getBaselineSummary(baseline);

    expect(summary.taskCount).toBe(3);
    expect(summary.totalDuration).toBe(18); // 7 + 7 + 4
    expect(summary.startDate).toEqual(new Date("2024-01-01"));
    expect(summary.finishDate).toEqual(new Date("2024-01-25"));
  });

  // -----------------------------------------------------------------------
  // 9. Empty baseline
  // -----------------------------------------------------------------------
  it("returns zero counts for an empty baseline", () => {
    const empty: Baseline = {
      id: "empty",
      name: "Empty",
      createdAt: new Date(),
      tasks: [],
    };

    const summary = getBaselineSummary(empty);

    expect(summary.taskCount).toBe(0);
    expect(summary.totalDuration).toBe(0);
    // startDate / finishDate fall back to new Date() — only verify type
    expect(summary.startDate).toBeInstanceOf(Date);
    expect(summary.finishDate).toBeInstanceOf(Date);
  });

  // -----------------------------------------------------------------------
  // 9b. Single task baseline
  // -----------------------------------------------------------------------
  it("handles a baseline with a single task", () => {
    const baseline: Baseline = {
      id: "single",
      name: "Single",
      createdAt: new Date(),
      tasks: [
        {
          taskId: 42,
          baselineStart: new Date("2024-06-01"),
          baselineFinish: new Date("2024-06-15"),
          baselineDuration: 10,
        },
      ],
    };

    const summary = getBaselineSummary(baseline);

    expect(summary.taskCount).toBe(1);
    expect(summary.totalDuration).toBe(10);
    expect(summary.startDate).toEqual(new Date("2024-06-01"));
    expect(summary.finishDate).toEqual(new Date("2024-06-15"));
  });
});
