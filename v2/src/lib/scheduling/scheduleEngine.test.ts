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

  test("uses percentage lag as a share of predecessor duration", () => {
    const tasks = [
      task({ id: 1, duration: 4 }),
      task({
        id: 2,
        duration: 1,
        dependencies: [{ from: 1, to: 2, type: "SS", lag: 50, lagUnit: "percent" }],
      }),
    ];

    const result = recalculateSchedule(tasks, {
      projectStart: new Date("2026-01-05T08:00:00"),
    });

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[1].start)).toBe("2026-01-07");
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

  test("inactive imported tasks do not drive successor scheduling", () => {
    const tasks = [
      task({
        id: 1,
        duration: 3,
        mppFields: { ACTIVE: false },
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
    expect(isoDate(result.tasks[1].start)).toBe("2026-01-05");
    expect(result.tasks[1].dependencies).toEqual([]);
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

  test("uses project working date overrides when placing durations", () => {
    const result = recalculateSchedule([task({ id: 1, duration: 2 })], {
      projectStart: new Date("2026-01-09T08:00:00"),
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        workDays: [1, 2, 3, 4, 5],
        dateOverrides: [
          {
            id: "sunday-work",
            date: "2026-01-11",
            name: "Jornada especial",
            isWorking: true,
          },
        ],
      },
    });

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[0].start)).toBe("2026-01-09");
    expect(isoDate(result.tasks[0].finish)).toBe("2026-01-11");
  });

  test("uses working date override hours when placing durations", () => {
    const result = recalculateSchedule([task({ id: 1, duration: 2 })], {
      projectStart: new Date("2026-01-09T08:00:00"),
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        workDays: [1, 2, 3, 4, 5],
        dateOverrides: [
          {
            id: "sunday-work",
            date: "2026-01-11",
            name: "Media jornada especial",
            isWorking: true,
            hoursPerDay: 4,
          },
        ],
      },
    });

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[0].start)).toBe("2026-01-09");
    expect(isoDate(result.tasks[0].finish)).toBe("2026-01-12");
  });

  test("applies MS Project start-no-earlier-than and finish-no-earlier-than constraints", () => {
    const result = recalculateSchedule(
      [
        task({
          id: 1,
          duration: 2,
          constraintType: "startNoEarlierThan",
          constraintDate: new Date("2026-01-08T08:00:00"),
        }),
        task({
          id: 2,
          duration: 2,
          constraintType: "finishNoEarlierThan",
          constraintDate: new Date("2026-01-14T08:00:00"),
          dependencies: [{ from: 1, to: 2, type: "FS" }],
        }),
      ],
      { projectStart: new Date("2026-01-05T08:00:00") },
    );

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[0].start)).toBe("2026-01-08");
    expect(isoDate(result.tasks[0].finish)).toBe("2026-01-09");
    expect(isoDate(result.tasks[1].start)).toBe("2026-01-13");
    expect(isoDate(result.tasks[1].finish)).toBe("2026-01-14");
  });

  test("start-no-later-than can create negative slack when dependencies violate the constraint", () => {
    const result = recalculateSchedule(
      [
        task({ id: 1, duration: 5 }),
        task({
          id: 2,
          duration: 1,
          constraintType: "startNoLaterThan",
          constraintDate: new Date("2026-01-06T08:00:00"),
          dependencies: [{ from: 1, to: 2, type: "FS" }],
        }),
      ],
      { projectStart: new Date("2026-01-05T08:00:00") },
    );

    expect(result.issues).toHaveLength(0);
    expect(isoDate(result.tasks[1].start)).toBe("2026-01-10");
    expect(result.tasks[1].totalFloat).toBeLessThan(0);
  });

  test("as-late-as-possible uses late dates for scheduled start and finish", () => {
    const result = recalculateSchedule(
      [
        task({
          id: 1,
          duration: 1,
          constraintType: "asLateAsPossible",
        }),
        task({ id: 2, duration: 5 }),
      ],
      { projectStart: new Date("2026-01-05T08:00:00") },
    );

    const alap = result.tasks.find((item) => item.id === 1)!;
    expect(result.issues).toHaveLength(0);
    expect(isoDate(alap.earlyStart)).toBe("2026-01-05");
    expect(isoDate(alap.lateStart)).toBe("2026-01-09");
    expect(isoDate(alap.start)).toBe("2026-01-09");
    expect(isoDate(alap.finish)).toBe("2026-01-09");
    expect(alap.totalFloat).toBeGreaterThan(0);
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
