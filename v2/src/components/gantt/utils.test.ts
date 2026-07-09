import {
  getDatePosition,
  getTaskWidth,
  generateTimelineColumns,
  calculateViewport,
  getDependencyEndpoints,
} from "./utils";
import { GanttTask, GanttViewport } from "./types";

// ---------------------------------------------------------------------------
// getDatePosition
// ---------------------------------------------------------------------------
describe("getDatePosition", () => {
  function makeViewport(
    overrides?: Partial<GanttViewport>,
  ): GanttViewport {
    return {
      startDate: new Date("2023-01-02T00:00:00"),
      endDate: new Date("2023-01-31T00:00:00"),
      scale: "day",
      columnWidth: 40,
      ...overrides,
    };
  }

  test("happy path: date at viewport start → position 0", () => {
    const viewport = makeViewport();
    expect(getDatePosition(new Date("2023-01-02T00:00:00"), viewport)).toBe(0);
  });

  test("edge case: date before viewport start → negative position", () => {
    const viewport = makeViewport();
    const before = new Date("2022-12-30T00:00:00"); // 3 days before
    const expected = -3 * 40; // -120
    expect(getDatePosition(before, viewport)).toBe(expected);
  });

  test("different scales produce correct relative positions", () => {
    const date = new Date("2023-01-09T00:00:00"); // 7 days after start

    const dayPos = getDatePosition(date, makeViewport({ scale: "day", columnWidth: 40 }));
    expect(dayPos).toBe(7 * 40); // 280

    const weekPos = getDatePosition(date, makeViewport({ scale: "week", columnWidth: 60 }));
    expect(weekPos).toBe((7 / 7) * 60); // 60

    const monthPos = getDatePosition(date, makeViewport({ scale: "month", columnWidth: 80 }));
    expect(monthPos).toBeCloseTo((7 / 30) * 80, 1);

    const quarterPos = getDatePosition(date, makeViewport({ scale: "quarter", columnWidth: 120 }));
    expect(quarterPos).toBeCloseTo((7 / 91) * 120, 1);
  });
});

// ---------------------------------------------------------------------------
// getTaskWidth
// ---------------------------------------------------------------------------
describe("getTaskWidth", () => {
  function makeViewport(
    overrides?: Partial<GanttViewport>,
  ): GanttViewport {
    return {
      startDate: new Date("2023-01-02T00:00:00"),
      endDate: new Date("2023-01-31T00:00:00"),
      scale: "day",
      columnWidth: 40,
      ...overrides,
    };
  }

  test("happy path: inclusive 5-day task in day scale → width = 5 * columnWidth", () => {
    const start = new Date("2023-01-02T00:00:00");
    const finish = new Date("2023-01-06T00:00:00");
    expect(getTaskWidth(start, finish, makeViewport())).toBe(5 * 40); // 200
  });

  test("same-day non-milestone task paints one full day", () => {
    const start = new Date("2023-01-02T12:00:00");
    const finish = new Date("2023-01-02T12:00:00");
    expect(getTaskWidth(start, finish, makeViewport())).toBe(40);
  });

  test("edge case: week scale → width = (days/7) * columnWidth", () => {
    const start = new Date("2023-01-02T00:00:00");
    const finish = new Date("2023-01-08T00:00:00"); // 7 inclusive days
    const viewport = makeViewport({ scale: "week", columnWidth: 60 });
    expect(getTaskWidth(start, finish, viewport)).toBe((7 / 7) * 60); // 60
  });

  test("month scale → width = (days/30) * columnWidth", () => {
    const start = new Date("2023-01-02T00:00:00");
    const finish = new Date("2023-01-31T00:00:00"); // 30 inclusive days
    const viewport = makeViewport({ scale: "month", columnWidth: 80 });
    expect(getTaskWidth(start, finish, viewport)).toBe((30 / 30) * 80); // 80
  });

  test("quarter scale → width = (days/91) * columnWidth", () => {
    const start = new Date("2023-01-01T00:00:00");
    const finish = new Date("2023-04-01T00:00:00"); // 91 inclusive days
    const viewport = makeViewport({ scale: "quarter", columnWidth: 120 });
    expect(getTaskWidth(start, finish, viewport)).toBe((91 / 91) * 120);
  });
});

// ---------------------------------------------------------------------------
// generateTimelineColumns
// ---------------------------------------------------------------------------
describe("generateTimelineColumns", () => {
  test("happy path: 30-day viewport in day scale → 31 columns (inclusive)", () => {
    const viewport: GanttViewport = {
      startDate: new Date("2023-01-02T00:00:00"),
      endDate: new Date("2023-02-01T00:00:00"),
      scale: "day",
      columnWidth: 40,
    };

    const columns = generateTimelineColumns(viewport);

    expect(columns).toHaveLength(31);
    expect(columns[0].toISOString().split("T")[0]).toBe("2023-01-02");
    expect(columns[30].toISOString().split("T")[0]).toBe("2023-02-01");
  });

  test("edge case: same start and end date → single column", () => {
    const date = new Date("2023-01-02T00:00:00");
    const viewport: GanttViewport = {
      startDate: date,
      endDate: date,
      scale: "day",
      columnWidth: 40,
    };

    const columns = generateTimelineColumns(viewport);

    expect(columns).toHaveLength(1);
    expect(columns[0].toISOString().split("T")[0]).toBe("2023-01-02");
  });

  test("week scale generates weekly columns", () => {
    const viewport: GanttViewport = {
      startDate: new Date("2023-01-02T00:00:00"),
      endDate: new Date("2023-01-30T00:00:00"), // ~4 weeks
      scale: "week",
      columnWidth: 60,
    };

    const columns = generateTimelineColumns(viewport);

    // Jan 2, Jan 9, Jan 16, Jan 23, Jan 30 = 5 columns
    expect(columns).toHaveLength(5);
    expect(columns[0].toISOString().split("T")[0]).toBe("2023-01-02");
    expect(columns[1].toISOString().split("T")[0]).toBe("2023-01-09");
    expect(columns[4].toISOString().split("T")[0]).toBe("2023-01-30");
  });

  test("month scale generates monthly columns", () => {
    const viewport: GanttViewport = {
      startDate: new Date("2023-01-02T00:00:00"),
      endDate: new Date("2023-04-02T00:00:00"), // 3 months
      scale: "month",
      columnWidth: 80,
    };

    const columns = generateTimelineColumns(viewport);

    // Jan 2, Feb 2, Mar 2, Apr 2 = 4 columns
    expect(columns).toHaveLength(4);
  });

  test("quarter scale generates quarterly columns", () => {
    const viewport: GanttViewport = {
      startDate: new Date("2023-01-02T00:00:00"),
      endDate: new Date("2023-10-02T00:00:00"),
      scale: "quarter",
      columnWidth: 120,
    };

    const columns = generateTimelineColumns(viewport);

    expect(columns.map((column) => column.toISOString().split("T")[0])).toEqual([
      "2023-01-02",
      "2023-04-02",
      "2023-07-02",
      "2023-10-02",
    ]);
  });
});

// ---------------------------------------------------------------------------
// calculateViewport
// ---------------------------------------------------------------------------
describe("calculateViewport", () => {
  const makeTask = (overrides: Partial<GanttTask>): GanttTask => ({
    id: 1,
    name: "T",
    start: new Date("2023-01-02T08:00:00"),
    finish: new Date("2023-01-04T17:00:00"),
    duration: 3,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  });

  test("happy path: tasks with min/max dates → viewport with padding", () => {
    const tasks: GanttTask[] = [
      makeTask({
        id: 1,
        start: new Date("2023-01-02T08:00:00"),
        finish: new Date("2023-01-04T17:00:00"),
      }),
      makeTask({
        id: 2,
        start: new Date("2023-01-08T08:00:00"),
        finish: new Date("2023-01-10T17:00:00"),
      }),
    ];

    const viewport = calculateViewport(tasks, "day");

    // Min = Jan 2 - 7 days = Dec 26
    expect(viewport.startDate.toISOString().split("T")[0]).toBe("2022-12-26");
    // Max = Jan 10 + 7 days = Jan 17
    expect(viewport.endDate.toISOString().split("T")[0]).toBe("2023-01-17");
    expect(viewport.scale).toBe("day");
    expect(viewport.columnWidth).toBe(40);
  });

  test("edge case: empty tasks array → viewport defaults to today + 30 days", () => {
    const viewport = calculateViewport([], "week");

    const today = new Date();
    expect(viewport.startDate.toISOString().split("T")[0]).toBe(
      today.toISOString().split("T")[0],
    );
    const expectedEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(viewport.endDate.toISOString().split("T")[0]).toBe(
      expectedEnd.toISOString().split("T")[0],
    );
    expect(viewport.scale).toBe("week");
    // Empty-array branch hardcodes columnWidth to 40 regardless of scale
    expect(viewport.columnWidth).toBe(40);
  });

  test("edge case: single task → viewport wraps that task with padding", () => {
    const tasks: GanttTask[] = [
      makeTask({
        start: new Date("2023-06-15T08:00:00"),
        finish: new Date("2023-06-15T17:00:00"),
      }),
    ];

    const viewport = calculateViewport(tasks, "month");

    // Min = Jun 15 - 7 = Jun 8
    expect(viewport.startDate.toISOString().split("T")[0]).toBe("2023-06-08");
    // Max = Jun 15 + 7 = Jun 22
    expect(viewport.endDate.toISOString().split("T")[0]).toBe("2023-06-22");
    expect(viewport.scale).toBe("month");
    expect(viewport.columnWidth).toBe(80);
  });

  test("columnWidth varies by scale", () => {
    const tasks: GanttTask[] = [makeTask({})];

    expect(calculateViewport(tasks, "day").columnWidth).toBe(40);
    expect(calculateViewport(tasks, "week").columnWidth).toBe(60);
    expect(calculateViewport(tasks, "month").columnWidth).toBe(80);
    expect(calculateViewport(tasks, "quarter").columnWidth).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// getDependencyEndpoints
// ---------------------------------------------------------------------------
describe("getDependencyEndpoints", () => {
  const viewport: GanttViewport = {
    startDate: new Date("2024-01-01T00:00:00"),
    endDate: new Date("2024-01-31T00:00:00"),
    scale: "day",
    columnWidth: 40,
  };

  const makeTask = (overrides: Partial<GanttTask>): GanttTask => ({
    id: 1,
    name: "T",
    start: new Date("2024-01-01T00:00:00"),
    finish: new Date("2024-01-02T00:00:00"),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  });

  test("uses predecessor and successor row indexes for FS arrows", () => {
    const pred = makeTask({
      id: 2,
      start: new Date("2024-01-01T00:00:00"),
      finish: new Date("2024-01-01T00:00:00"),
      isMilestone: true,
      duration: 0,
    });
    const succ = makeTask({
      id: 3,
      start: new Date("2024-01-02T00:00:00"),
      finish: new Date("2024-01-05T00:00:00"),
      duration: 3,
    });

    const endpoints = getDependencyEndpoints(
      pred,
      succ,
      viewport,
      1,
      2,
      40,
      "FS",
    );

    expect(endpoints.fromY).toBe(60);
    expect(endpoints.toY).toBe(100);
  });

  test("connects milestones from the visible diamond edge", () => {
    const milestone = makeTask({
      start: new Date("2024-01-01T00:00:00"),
      finish: new Date("2024-01-01T00:00:00"),
      isMilestone: true,
    });
    const succ = makeTask({
      start: new Date("2024-01-02T00:00:00"),
      finish: new Date("2024-01-03T00:00:00"),
    });

    const endpoints = getDependencyEndpoints(
      milestone,
      succ,
      viewport,
      0,
      1,
      40,
      "FS",
    );

    expect(endpoints.fromX).toBe(20);
    expect(endpoints.toX).toBe(40);
  });
});
