import type { GanttTask } from "@/components/gantt/types";
import {
  applyScenarioChanges,
  compareScenario,
  type WhatIfScenario,
} from "./scenarios";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  const start = overrides.start ?? new Date("2026-01-05T08:00:00");
  const finish = overrides.finish ?? new Date("2026-01-05T08:00:00");

  return {
    name: `Task ${overrides.id}`,
    start,
    finish,
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

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

describe("what-if scenarios", () => {
  test("applies scenario changes without mutating the base plan", () => {
    const base = [
      task({ id: 1, duration: 1 }),
      task({ id: 2, dependencies: [{ from: 1, to: 2, type: "FS" }] }),
    ];

    const changed = applyScenarioChanges(base, [
      { type: "updateTask", taskId: 1, patch: { duration: 3 } },
      {
        type: "replacePredecessors",
        taskId: 2,
        dependencies: [{ from: 1, type: "SS", lag: 2 }],
      },
    ]);

    expect(base[0].duration).toBe(1);
    expect(base[1].dependencies).toEqual([{ from: 1, to: 2, type: "FS" }]);
    expect(changed[0].duration).toBe(3);
    expect(changed[1].dependencies).toEqual([
      { from: 1, to: 2, type: "SS", lag: 2 },
    ]);
  });

  test("compares schedule impact before applying a scenario", () => {
    const base = [
      task({ id: 1, duration: 1 }),
      task({ id: 2, duration: 1 }),
    ];
    const scenario: WhatIfScenario = {
      id: "dep-fs",
      name: "Conectar secuencia",
      changes: [
        {
          type: "replacePredecessors",
          taskId: 2,
          dependencies: [{ from: 1, type: "FS" }],
        },
      ],
    };

    const comparison = compareScenario(base, scenario, {
      projectStart: new Date("2026-01-05T08:00:00"),
    });

    expect(comparison.issues).toHaveLength(0);
    expect(comparison.summary.changedTaskCount).toBe(1);
    expect(comparison.summary.projectFinishDeltaDays).toBe(1);
    expect(comparison.taskImpacts).toEqual([
      expect.objectContaining({
        taskId: 2,
        startDeltaDays: 1,
        finishDeltaDays: 1,
      }),
    ]);
    expect(isoDate(comparison.baseTasks[1].start)).toBe("2026-01-05");
    expect(isoDate(comparison.scenarioTasks[1].start)).toBe("2026-01-06");
  });

  test("returns issues instead of applying invalid cyclic scenarios", () => {
    const base = [
      task({ id: 1, dependencies: [{ from: 2, to: 1, type: "FS" }] }),
      task({ id: 2 }),
    ];
    const scenario: WhatIfScenario = {
      id: "cycle",
      name: "Ciclo accidental",
      changes: [
        {
          type: "replaceSuccessors",
          taskId: 1,
          dependencies: [{ from: 1, to: 2, type: "FS" }],
        },
      ],
    };

    const comparison = compareScenario(base, scenario);

    expect(comparison.issues.map((issue) => issue.kind)).toContain("cycle");
    expect(comparison.summary.changedTaskCount).toBe(0);
    expect(comparison.taskImpacts).toEqual([]);
  });
});
