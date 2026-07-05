import type { GanttTask } from "@/components/gantt/types";
import { buildLastPlannerPreview } from "./lastPlanner";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00.000Z"),
    finish: new Date("2026-01-06T17:00:00.000Z"),
    duration: 2,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("Last Planner preview", () => {
  test("builds weekly commitments and actionable constraints from Gantt tasks", () => {
    const preview = buildLastPlannerPreview({
      windowStart: new Date("2026-01-07T00:00:00.000Z"),
      weeks: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
      statusDate: new Date("2026-01-01T00:00:00.000Z"),
      tasks: [
        task({
          id: 1,
          name: "Predecesora",
          progress: 50,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
        }),
        task({
          id: 2,
          name: "Actividad critica",
          isCritical: true,
          dependencies: [{ from: 1, to: 2, type: "FS" }],
          start: new Date("2026-01-08T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          wbs: "1.2",
        }),
        task({
          id: 3,
          name: "Semana siguiente",
          start: new Date("2026-01-13T08:00:00.000Z"),
          finish: new Date("2026-01-14T17:00:00.000Z"),
        }),
        task({
          id: "summary",
          name: "Resumen",
          isSummary: true,
        }),
      ],
    });

    expect(preview.windowStart).toBe("2026-01-05");
    expect(preview.windowEnd).toBe("2026-01-18");
    expect(preview.weeks).toHaveLength(2);
    expect(preview.weeks[0].commitments.map((item) => item.taskId)).toEqual([1, 2]);
    expect(preview.weeks[1].commitments.map((item) => item.taskId)).toEqual([3]);
    expect(preview.weeks[0].commitments[1]).toEqual(
      expect.objectContaining({
        taskId: 2,
        name: "Actividad critica",
        wbs: "1.2",
        isCritical: true,
        constraints: [
          expect.objectContaining({ type: "predecessorIncomplete", taskId: 1 }),
          expect.objectContaining({ type: "criticalPath" }),
        ],
      }),
    );
    expect(preview.summary).toEqual({
      totalCommitments: 3,
      constrainedCommitments: 1,
      criticalCommitments: 1,
    });
  });

  test("flags overdue incomplete commitments against an explicit status date", () => {
    const preview = buildLastPlannerPreview({
      windowStart: new Date("2026-01-05T00:00:00.000Z"),
      statusDate: new Date("2026-01-10T00:00:00.000Z"),
      tasks: [
        task({
          id: 1,
          progress: 75,
          finish: new Date("2026-01-06T17:00:00.000Z"),
        }),
      ],
    });

    expect(preview.weeks[0].commitments[0].constraints).toEqual([
      expect.objectContaining({ type: "lateProgress" }),
    ]);
  });
});
