import { CPMCalculatorService } from "./cpm";
import { CalendarService } from "./calendar";
import { Task, Dependency, DependencyType } from "./types";

describe("CPMCalculatorService", () => {
  let service: CPMCalculatorService;
  let calendar: CalendarService;

  beforeEach(() => {
    calendar = new CalendarService();
    calendar.setWorkDays({ 1: false }); // Sun off
    service = new CPMCalculatorService(calendar);
  });

  test("Simple FS Chain", () => {
    // T1 (2d) -> T2 (3d)
    // Start: Mon Jan 2 2023.
    const tasks: Task[] = [
      {
        id: 1,
        name: "T1",
        durationMinutes: 960,
        totalFloat: 0,
        isCritical: false,
        isMilestone: false,
        outlineLevel: 1,
        isSummary: false,
      }, // 2 days
      {
        id: 2,
        name: "T2",
        durationMinutes: 1440,
        totalFloat: 0,
        isCritical: false,
        isMilestone: false,
        outlineLevel: 1,
        isSummary: false,
      }, // 3 days
    ];

    const deps: Dependency[] = [
      {
        predecessorId: 1,
        successorId: 2,
        type: DependencyType.FinishToStart,
        lag: 0,
        isPercentage: false,
      },
    ];

    const start = new Date("2023-01-02T08:00:00"); // Mon
    const result = service.calculate(tasks, deps, start);

    const t1 = result.find((x) => x.id === 1)!;
    const t2 = result.find((x) => x.id === 2)!;

    // T1: Mon-Tue (2-3 Jan)
    expect(t1.earlyStart?.toISOString().split("T")[0]).toBe("2023-01-02");
    expect(t1.earlyFinish?.toISOString().split("T")[0]).toBe("2023-01-03");

    // T2: Wed-Fri (4-6 Jan)
    expect(t2.earlyStart?.toISOString().split("T")[0]).toBe("2023-01-04");
    expect(t2.earlyFinish?.toISOString().split("T")[0]).toBe("2023-01-06");

    expect(t1.isCritical).toBe(true);
    expect(t2.isCritical).toBe(true);
  });

  test("Summary Rollup", () => {
    // Summary
    //   -> Child 1 (Mon-Tue)
    //   -> Child 2 (Wed-Fri)
    // Summary should represent Mon-Fri.

    const tasks: Task[] = [
      {
        id: 10,
        name: "Summary",
        durationMinutes: 0,
        totalFloat: 0,
        isCritical: false,
        isMilestone: false,
        outlineLevel: 1,
        isSummary: true,
      },
      {
        id: 11,
        name: "C1",
        durationMinutes: 960,
        totalFloat: 0,
        isCritical: false,
        isMilestone: false,
        outlineLevel: 2,
        isSummary: false,
      },
      {
        id: 12,
        name: "C2",
        durationMinutes: 1440,
        totalFloat: 0,
        isCritical: false,
        isMilestone: false,
        outlineLevel: 2,
        isSummary: false,
      },
    ];

    // Link C1 -> C2
    const deps: Dependency[] = [
      {
        predecessorId: 11,
        successorId: 12,
        type: DependencyType.FinishToStart,
        lag: 0,
        isPercentage: false,
      },
    ];

    const start = new Date("2023-01-02T08:00:00");
    const result = service.calculate(tasks, deps, start);

    const sum = result.find((x) => x.id === 10)!;

    // Min Start C1 (Mon 2)
    expect(sum.earlyStart?.toISOString().split("T")[0]).toBe("2023-01-02");
    // Max Finish C2 (Fri 6)
    expect(sum.earlyFinish?.toISOString().split("T")[0]).toBe("2023-01-06");
  });
});
