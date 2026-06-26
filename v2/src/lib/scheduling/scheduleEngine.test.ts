import type { GanttTask, GanttDependency } from "@/components/gantt/types";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import {
  recalculateSchedule,
  rewriteSuccessors,
  validateDependencies,
} from "./scheduleEngine";

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

function isoDate(date?: Date): string {
  return date?.toISOString().split("T")[0] ?? "";
}

describe("recalculateSchedule", () => {
  test("changing predecessor duration moves successor dates", () => {
    const tasks = [
      task({ id: 1, duration: 3 }),
      task({
        id: 2,
        duration: 2,
        dependencies: [{ from: 1, to: 2, type: "FS" }],
      }),
    ];

    const result = recalculateSchedule(tasks, {
      projectStart: new Date("2026-01-05T08:00:00"),
    });

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[0].start)).toBe("2026-01-05");
    expect(isoDate(result.tasks[0].finish)).toBe("2026-01-07");
    expect(isoDate(result.tasks[1].start)).toBe("2026-01-08");
    expect(isoDate(result.tasks[1].finish)).toBe("2026-01-09");
  });

  test("manualStart from direct date edit is respected as start-no-earlier-than", () => {
    const tasks = [
      task({
        id: 1,
        duration: 1,
        manualStart: new Date("2026-01-12T08:00:00"),
      }),
      task({
        id: 2,
        duration: 1,
        dependencies: [{ from: 1, to: 2, type: "FS" }],
      }),
    ];

    const result = recalculateSchedule(tasks, {
      projectStart: new Date("2026-01-05T08:00:00"),
    });

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[0].start)).toBe("2026-01-12");
    expect(isoDate(result.tasks[1].start)).toBe("2026-01-13");
  });

  test("uses project work days when calculating durations", () => {
    const result = recalculateSchedule([task({ id: 1, duration: 2 })], {
      projectStart: new Date("2026-01-09T08:00:00"),
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        workDays: [1, 2, 3, 4, 5],
      },
    });

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[0].start)).toBe("2026-01-09");
    expect(isoDate(result.tasks[0].finish)).toBe("2026-01-12");
  });

  test("uses project non-working days when placing successors", () => {
    const result = recalculateSchedule(
      [
        task({ id: 1, duration: 1 }),
        task({
          id: 2,
          duration: 1,
          dependencies: [{ from: 1, to: 2, type: "FS" }],
        }),
      ],
      {
        projectStart: new Date("2026-01-05T08:00:00"),
        calendar: {
          ...DEFAULT_PROJECT_CALENDAR,
          nonWorkingDays: [
            { id: "holiday", date: "2026-01-06", name: "Día no laboral" },
          ],
        },
      },
    );

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[0].finish)).toBe("2026-01-05");
    expect(isoDate(result.tasks[1].start)).toBe("2026-01-07");
  });
});

describe("validateDependencies", () => {
  test("rejects self dependencies and cycles", () => {
    const deps: GanttDependency[] = [
      { from: 1, to: 1, type: "FS" },
      { from: 1, to: 2, type: "FS" },
      { from: 2, to: 1, type: "FS" },
    ];

    const issues = validateDependencies([task({ id: 1 }), task({ id: 2 })], deps);

    expect(issues.some((issue) => issue.kind === "selfDependency")).toBe(true);
    expect(issues.some((issue) => issue.kind === "cycle")).toBe(true);
  });
});

describe("rewriteSuccessors", () => {
  test("rewrites successor edits into canonical predecessor dependencies", () => {
    const tasks = [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 9, to: 2, type: "FS" }] }),
      task({ id: 3, dependencies: [{ from: 1, to: 3, type: "SS" }] }),
    ];

    const result = rewriteSuccessors(tasks, 1, [
      { from: 1, to: 2, type: "FS", lag: 1 },
    ]);

    expect(result.find((t) => t.id === 2)?.dependencies).toEqual([
      { from: 9, to: 2, type: "FS" },
      { from: 1, to: 2, type: "FS", lag: 1 },
    ]);
    expect(result.find((t) => t.id === 3)?.dependencies).toEqual([]);
  });
});
