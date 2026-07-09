import {
  taskToGanttTask,
  ganttTaskToTask,
  depToGanttDep,
  ganttDepToDep,
} from "./typeBridge";
import { Task, Dependency, DependencyType } from "./types";
import { GanttTask, GanttDependency } from "@/components/gantt/types";

const MINUTES_PER_DAY = 480;

// ---------------------------------------------------------------------------
// taskToGanttTask
// ---------------------------------------------------------------------------
describe("taskToGanttTask", () => {
  test("happy path: Task with all fields → GanttTask with correct conversions", () => {
    const task: Task = {
      id: 1,
      name: "T1",
      durationMinutes: 960, // 2 days
      earlyStart: new Date("2023-01-02T08:00:00"),
      earlyFinish: new Date("2023-01-03T17:00:00"),
      lateStart: new Date("2023-01-02T08:00:00"),
      lateFinish: new Date("2023-01-03T17:00:00"),
      totalFloat: 0,
      isCritical: true,
      isMilestone: false,
      outlineLevel: 1,
      isSummary: false,
    };

    const result = taskToGanttTask(task, []);

    expect(result.id).toBe(1);
    expect(result.name).toBe("T1");
    expect(result.duration).toBe(2); // 960 / 480
    expect(result.start).toEqual(new Date("2023-01-02T08:00:00"));
    expect(result.finish).toEqual(new Date("2023-01-03T17:00:00"));
    expect(result.progress).toBe(0);
    expect(result.isCritical).toBe(true);
    expect(result.isMilestone).toBe(false);
    expect(result.isSummary).toBe(false);
    expect(result.outlineLevel).toBe(1);
    expect(result.earlyStart).toEqual(new Date("2023-01-02T08:00:00"));
    expect(result.earlyFinish).toEqual(new Date("2023-01-03T17:00:00"));
    expect(result.lateStart).toEqual(new Date("2023-01-02T08:00:00"));
    expect(result.lateFinish).toEqual(new Date("2023-01-03T17:00:00"));
    expect(result.totalFloat).toBe(0);
    expect(result.dependencies).toEqual([]);
  });

  test("edge case: no earlyStart → uses manualStart fallback", () => {
    const manualStart = new Date("2023-06-01T10:00:00");
    const task: Task = {
      id: 2,
      name: "T2",
      durationMinutes: 480, // 1 day
      manualStart,
      totalFloat: 5,
      isCritical: false,
      isMilestone: false,
      outlineLevel: 1,
      isSummary: false,
    };

    const result = taskToGanttTask(task, []);

    expect(result.start).toEqual(manualStart);
    expect(result.duration).toBe(1);
    // finish = start + 1 day worth of work minutes
    expect(result.finish.getTime()).toBe(
      manualStart.getTime() + 1 * MINUTES_PER_DAY * 60 * 1000,
    );
  });

  test("edge case: Task with dependencies → GanttDependencies filtered correctly", () => {
    const task: Task = {
      id: 2,
      name: "T2",
      durationMinutes: 480,
      earlyStart: new Date("2023-01-04T08:00:00"),
      earlyFinish: new Date("2023-01-04T17:00:00"),
      totalFloat: 0,
      isCritical: true,
      isMilestone: false,
      outlineLevel: 1,
      isSummary: false,
    };

    const deps: Dependency[] = [
      // task is successor
      {
        predecessorId: 1,
        successorId: 2,
        type: DependencyType.FinishToStart,
        lag: 0,
        isPercentage: false,
      },
      // task is predecessor
      {
        predecessorId: 2,
        successorId: 3,
        type: DependencyType.FinishToStart,
        lag: 480,
        isPercentage: false,
      },
      // unrelated — should be filtered out
      {
        predecessorId: 4,
        successorId: 5,
        type: DependencyType.StartToStart,
        lag: 0,
        isPercentage: false,
      },
    ];

    const result = taskToGanttTask(task, deps);

    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].from).toBe(1);
    expect(result.dependencies[0].to).toBe(2);
    expect(result.dependencies[1].from).toBe(2);
    expect(result.dependencies[1].to).toBe(3);
    expect(result.dependencies[1].lag).toBe(1); // 480 / 480
  });
});

// ---------------------------------------------------------------------------
// ganttTaskToTask
// ---------------------------------------------------------------------------
describe("ganttTaskToTask", () => {
  test("happy path: GanttTask with all fields → Task with correct conversions", () => {
    const gantt: GanttTask = {
      id: 1,
      name: "T1",
      start: new Date("2023-01-02T08:00:00"),
      finish: new Date("2023-01-03T17:00:00"),
      duration: 2,
      progress: 50,
      isCritical: true,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
      earlyStart: new Date("2023-01-02T08:00:00"),
      lateStart: new Date("2023-01-02T08:00:00"),
      earlyFinish: new Date("2023-01-03T17:00:00"),
      lateFinish: new Date("2023-01-03T17:00:00"),
      totalFloat: 0,
    };

    const result = ganttTaskToTask(gantt);

    expect(result.id).toBe(1);
    expect(result.name).toBe("T1");
    expect(result.durationMinutes).toBe(960); // 2 * 480
    expect(result.earlyStart).toEqual(new Date("2023-01-02T08:00:00"));
    expect(result.earlyFinish).toEqual(new Date("2023-01-03T17:00:00"));
    expect(result.lateStart).toEqual(new Date("2023-01-02T08:00:00"));
    expect(result.lateFinish).toEqual(new Date("2023-01-03T17:00:00"));
    expect(result.totalFloat).toBe(0);
    expect(result.isCritical).toBe(true);
    expect(result.isMilestone).toBe(false);
    expect(result.isSummary).toBe(false);
    expect(result.outlineLevel).toBe(1);
  });

  test("edge case: GanttTask without CPM fields → falls back to start/finish, totalFloat defaults to 0", () => {
    const gantt: GanttTask = {
      id: 2,
      name: "T2",
      start: new Date("2023-06-01T08:00:00"),
      finish: new Date("2023-06-01T17:00:00"),
      duration: 1,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    const result = ganttTaskToTask(gantt);

    expect(result.earlyStart).toEqual(new Date("2023-06-01T08:00:00"));
    expect(result.earlyFinish).toEqual(new Date("2023-06-01T17:00:00"));
    expect(result.lateStart).toBeUndefined();
    expect(result.lateFinish).toBeUndefined();
    expect(result.totalFloat).toBe(0);
  });

  test("roundtrip: ganttTaskToTask(taskToGanttTask(task, [])) preserves key fields", () => {
    const task: Task = {
      id: 42,
      name: "Roundtrip",
      durationMinutes: 1440, // 3 days
      earlyStart: new Date("2023-03-01T08:00:00"),
      earlyFinish: new Date("2023-03-03T17:00:00"),
      totalFloat: 2,
      isCritical: false,
      isMilestone: true,
      outlineLevel: 1,
      isSummary: false,
    };

    const gantt = taskToGanttTask(task, []);
    const result = ganttTaskToTask(gantt);

    expect(result.id).toBe(42);
    expect(result.name).toBe("Roundtrip");
    expect(result.durationMinutes).toBe(1440);
    expect(result.isCritical).toBe(false);
    expect(result.isMilestone).toBe(true);
    expect(result.isSummary).toBe(false);
    expect(result.outlineLevel).toBe(1);
    expect(result.earlyStart).toEqual(new Date("2023-03-01T08:00:00"));
    expect(result.earlyFinish).toEqual(new Date("2023-03-03T17:00:00"));
    expect(result.totalFloat).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// depToGanttDep
// ---------------------------------------------------------------------------
describe("depToGanttDep", () => {
  test("happy path: Dependency with lag in minutes → GanttDependency with lag in days", () => {
    const dep: Dependency = {
      predecessorId: 1,
      successorId: 2,
      type: DependencyType.FinishToStart,
      lag: 960, // 2 days
      isPercentage: false,
    };

    const result = depToGanttDep(dep);

    expect(result.from).toBe(1);
    expect(result.to).toBe(2);
    expect(result.type).toBe("FS");
    expect(result.lag).toBe(2); // 960 / 480
  });

  test("edge case: Dependency with lag=0 → GanttDependency with lag=0", () => {
    const dep: Dependency = {
      predecessorId: "A",
      successorId: "B",
      type: DependencyType.StartToStart,
      lag: 0,
      isPercentage: false,
    };

    const result = depToGanttDep(dep);

    expect(result.from).toBe("A");
    expect(result.to).toBe("B");
    expect(result.type).toBe("SS");
    expect(result.lag).toBe(0);
  });

  test("all dependency types are cast correctly (FS, SS, FF, SF)", () => {
    const deps: Dependency[] = [
      { predecessorId: 1, successorId: 2, type: DependencyType.FinishToStart, lag: 0, isPercentage: false },
      { predecessorId: 1, successorId: 2, type: DependencyType.StartToStart, lag: 0, isPercentage: false },
      { predecessorId: 1, successorId: 2, type: DependencyType.FinishToFinish, lag: 0, isPercentage: false },
      { predecessorId: 1, successorId: 2, type: DependencyType.StartToFinish, lag: 0, isPercentage: false },
    ];

    const results = deps.map(depToGanttDep);

    expect(results[0].type).toBe("FS");
    expect(results[1].type).toBe("SS");
    expect(results[2].type).toBe("FF");
    expect(results[3].type).toBe("SF");
  });

  test("preserves percentage lag from scheduling dependencies", () => {
    const dep: Dependency = {
      predecessorId: 1,
      successorId: 2,
      type: DependencyType.FinishToStart,
      lag: 50,
      isPercentage: true,
    };

    const result = depToGanttDep(dep);

    expect(result.lag).toBe(50);
    expect(result.lagUnit).toBe("percent");
  });
});

// ---------------------------------------------------------------------------
// ganttDepToDep
// ---------------------------------------------------------------------------
describe("ganttDepToDep", () => {
  test("happy path: GanttDependency with lag in days → Dependency with lag in minutes", () => {
    const gantt: GanttDependency = {
      from: 1,
      to: 2,
      type: "FF",
      lag: 3,
    };

    const result = ganttDepToDep(gantt);

    expect(result.predecessorId).toBe(1);
    expect(result.successorId).toBe(2);
    expect(result.type).toBe(DependencyType.FinishToFinish);
    expect(result.lag).toBe(1440); // 3 * 480
    expect(result.isPercentage).toBe(false);
  });

  test("edge case: GanttDependency without lag → Dependency with lag=0", () => {
    const gantt: GanttDependency = {
      from: 1,
      to: 2,
      type: "SF",
    };

    const result = ganttDepToDep(gantt);

    expect(result.predecessorId).toBe(1);
    expect(result.successorId).toBe(2);
    expect(result.type).toBe(DependencyType.StartToFinish);
    expect(result.lag).toBe(0);
    expect(result.isPercentage).toBe(false);
  });

  test("preserves percentage lag when converting to scheduling dependency", () => {
    const gantt: GanttDependency = {
      from: 1,
      to: 2,
      type: "FS",
      lag: 50,
      lagUnit: "percent",
    };

    const result = ganttDepToDep(gantt);

    expect(result.lag).toBe(50);
    expect(result.isPercentage).toBe(true);
  });

  test("roundtrip: ganttDepToDep(depToGanttDep(dep)) preserves from/to/type", () => {
    const dep: Dependency = {
      predecessorId: 99,
      successorId: 100,
      type: DependencyType.FinishToStart,
      lag: 480, // 1 day
      isPercentage: false,
    };

    const gantt = depToGanttDep(dep);
    const result = ganttDepToDep(gantt);

    expect(result.predecessorId).toBe(99);
    expect(result.successorId).toBe(100);
    expect(result.type).toBe(DependencyType.FinishToStart);
    expect(result.lag).toBe(480);
    expect(result.isPercentage).toBe(false);
  });
});
