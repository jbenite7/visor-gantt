import type { GanttTask } from "@/components/gantt/types";
import { validatePlanningState } from "./planningValidation";

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

describe("planning validation", () => {
  test("adds actionable recommendations to invalid dependencies", () => {
    const issues = validatePlanningState([
      task({ id: 1, dependencies: [{ from: 1, to: 1, type: "FS" }] }),
    ]);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "selfDependency",
          recommendation: expect.stringContaining("tarea diferente"),
        }),
      ]),
    );
  });

  test("detects hierarchy and WBS inconsistencies before save", () => {
    const issues = validatePlanningState([
      task({ id: 1, wbs: "9" }),
      task({ id: 2, outlineLevel: 3 }),
      task({ id: 3, isSummary: true }),
    ]);

    expect(issues.map((issue) => issue.kind)).toEqual(
      expect.arrayContaining(["wbsMismatch", "outlineJump", "summaryWithoutChildren"]),
    );
  });

  test("detects progress and duration values outside allowed ranges", () => {
    const issues = validatePlanningState([
      task({ id: 1, progress: 120 }),
      task({ id: 2, duration: -1 }),
    ]);

    expect(issues.map((issue) => issue.kind)).toEqual(
      expect.arrayContaining(["invalidProgress", "invalidDuration"]),
    );
  });
});
