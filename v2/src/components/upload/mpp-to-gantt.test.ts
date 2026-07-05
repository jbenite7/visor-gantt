import type { MSPResource, MSPTask } from "@/lib/parser/mpp-parser";
import { mppResourcesToResources, mppTasksToGanttTasks } from "./mpp-to-gantt";

function mspTask(overrides: Partial<MSPTask> = {}): MSPTask {
  return {
    UID: 1,
    ID: 1,
    Name: "Actividad",
    Start: "2026-01-05T08:00:00",
    Finish: "2026-01-06T17:00:00",
    Duration: "PT16H0M0S",
    DurationFormat: 7,
    PercentComplete: 0,
    Summary: false,
    Milestone: false,
    OutlineLevel: 1,
    WBS: "1",
    ...overrides,
  };
}

describe("mppTasksToGanttTasks", () => {
  test("preserves row ID and resolves imported predecessor links by UID", () => {
    const tasks = mppTasksToGanttTasks([
      mspTask({
        UID: 101,
        ID: 7,
        Name: "Predecesora",
      }),
      mspTask({
        UID: 205,
        ID: 8,
        Name: "Sucesora",
        PredecessorLink: [
          {
            PredecessorUID: 101,
            Type: 1,
            LinkLag: 0,
            LagFormat: 7,
          },
        ],
      }),
    ]);

    expect(tasks[0]).toEqual(
      expect.objectContaining({
        id: 101,
        mppFields: expect.objectContaining({ ID: 7, UID: 101 }),
      }),
    );
    expect(tasks[1]).toEqual(
      expect.objectContaining({
        id: 205,
        dependencies: [{ from: 101, to: 205, type: "FS", lag: 0 }],
        mppFields: expect.objectContaining({ ID: 8, UID: 205 }),
      }),
    );
  });

  test("maps MS Project constraint and deadline fields into live task properties", () => {
    const [task] = mppTasksToGanttTasks([
      mspTask({
        ConstraintType: 4,
        ConstraintDate: "2026-01-08T08:00:00",
        Deadline: "2026-01-10T17:00:00",
      }),
    ]);

    expect(task.constraintType).toBe("startNoEarlierThan");
    expect(task.constraintDate?.toISOString().slice(0, 10)).toBe("2026-01-08");
    expect(task.deadline?.toISOString().slice(0, 10)).toBe("2026-01-10");
  });

  test("maps textual constraint aliases from parser metadata", () => {
    const [task] = mppTasksToGanttTasks([
      mspTask({
        mppFields: {
          CONSTRAINT_TYPE: "Finish No Later Than",
          CONSTRAINT_DATE: "2026-01-15T08:00:00",
        },
      } as Partial<MSPTask>),
    ]);

    expect(task.constraintType).toBe("finishNoLaterThan");
    expect(task.constraintDate?.toISOString().slice(0, 10)).toBe("2026-01-15");
  });
});

describe("mppResourcesToResources", () => {
  test("preserves parser-provided resource calendars", () => {
    const calendar = {
      timeZone: "America/Bogota",
      workDays: [1, 2, 3, 4, 5],
      startHour: "08:00",
      endHour: "12:00",
      hoursPerDay: 4,
      nonWorkingDays: [],
      dateOverrides: [],
    };

    const [resource] = mppResourcesToResources([
      {
        UID: 10,
        Name: "Medio tiempo",
        Type: 1,
        calendar,
        mppFields: {
          STANDARD_RATE: 100,
        },
      } as unknown as MSPResource,
    ]);

    expect(resource.calendar).toEqual(calendar);
  });
});
