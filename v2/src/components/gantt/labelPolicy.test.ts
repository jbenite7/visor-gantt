import type { GanttTask } from "./types";
import {
  estimateLabelWidth,
  resolveTaskLabelPlacement,
} from "./labelPolicy";

function task(overrides: Partial<GanttTask>): GanttTask {
  return {
    id: 1,
    name: "Actividad larga",
    start: new Date("2026-01-01"),
    finish: new Date("2026-01-05"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("labelPolicy", () => {
  test("summary tasks use an external summary chip", () => {
    expect(
      resolveTaskLabelPlacement(task({ isSummary: true }), 240, "day").placement,
    ).toBe("summary-chip");
  });

  test("milestones always use an outside label", () => {
    expect(
      resolveTaskLabelPlacement(task({ isMilestone: true }), 20, "day").placement,
    ).toBe("milestone-outside");
  });

  test("long bars keep labels inside when text fits", () => {
    expect(
      resolveTaskLabelPlacement(task({ name: "Excavación" }), 220, "day").placement,
    ).toBe("inside");
  });

  test("short bars move labels outside instead of hiding them", () => {
    expect(
      resolveTaskLabelPlacement(task({ name: "Trazo y nivelación" }), 48, "day")
        .placement,
    ).toBe("outside-right");
  });

  test("estimated label width includes padding", () => {
    expect(estimateLabelWidth("ABC", 12)).toBeGreaterThan(30);
  });
});
