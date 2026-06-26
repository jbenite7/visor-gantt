import type { GanttTask } from "@/components/gantt/types";
import type { Assignment, Resource } from "@/types/resource";
import { detectBottlenecks } from "./bottlenecks";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-05T08:00:00"),
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

describe("detectBottlenecks", () => {
  test("detects CPM bottlenecks for critical, near-critical and convergence tasks", () => {
    const bottlenecks = detectBottlenecks({
      tasks: [
        task({ id: 1, isCritical: true, totalFloat: 0 }),
        task({ id: 2, totalFloat: 480 }),
        task({
          id: 3,
          totalFloat: 480,
          dependencies: [
            { from: 1, to: 3, type: "FS" },
            { from: 2, to: 3, type: "FS" },
          ],
        }),
      ],
      resources: [],
      assignments: [],
    });

    expect(bottlenecks.some((b) => b.kind === "critical" && b.taskIds.includes(1))).toBe(true);
    expect(bottlenecks.some((b) => b.kind === "nearCritical" && b.taskIds.includes(2))).toBe(true);
    expect(bottlenecks.some((b) => b.kind === "dependencyConvergence" && b.taskIds.includes(3))).toBe(true);
  });

  test("detects resource overallocation when assignments exceed availability", () => {
    const resources: Resource[] = [
      { uid: 7, name: "Equipo A", type: "work", availability: 100 },
    ];
    const assignments: Assignment[] = [
      { taskId: 1, resourceId: 7, units: 75, cost: 0 },
      { taskId: 2, resourceId: 7, units: 50, cost: 0 },
    ];

    const bottlenecks = detectBottlenecks({
      tasks: [
        task({ id: 1, start: new Date("2026-01-05"), finish: new Date("2026-01-06") }),
        task({ id: 2, start: new Date("2026-01-05"), finish: new Date("2026-01-05") }),
      ],
      resources,
      assignments,
    });

    expect(
      bottlenecks.some(
        (b) => b.kind === "resourceOverallocation" && b.resourceId === 7,
      ),
    ).toBe(true);
  });
});
