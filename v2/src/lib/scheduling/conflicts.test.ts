import { analyzeScheduleConflicts } from "./conflicts";
import type { GanttTask } from "@/components/gantt/types";

function task(overrides: Partial<GanttTask>): GanttTask {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? "Task",
    start: overrides.start ?? new Date("2026-01-01T08:00:00"),
    finish: overrides.finish ?? new Date("2026-01-02T17:00:00"),
    duration: overrides.duration ?? 2,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: overrides.outlineLevel ?? 1,
    dependencies: overrides.dependencies ?? [],
    wbs: overrides.wbs,
  };
}

describe("analyzeScheduleConflicts", () => {
  test("detects formal dependency violations", () => {
    const predecessor = task({
      id: "A",
      name: "Predecesora",
      start: new Date("2026-01-01T08:00:00"),
      finish: new Date("2026-01-10T17:00:00"),
    });
    const successor = task({
      id: "B",
      name: "Sucesora",
      start: new Date("2026-01-05T08:00:00"),
      finish: new Date("2026-01-12T17:00:00"),
      dependencies: [{ from: "A", to: "B", type: "FS", lag: 0 }],
      wbs: "1.1",
    });

    const analysis = analyzeScheduleConflicts([predecessor, successor]);

    expect(analysis.violations).toEqual([
      expect.objectContaining({
        predecessor: "Predecesora",
        successor: "Sucesora",
        relation: "FS",
        delayDays: 5,
      }),
    ]);
  });

  test("detects atypical sibling gaps without formal dependency", () => {
    const analysis = analyzeScheduleConflicts([
      task({
        id: "A",
        name: "Actividad 1",
        start: new Date("2026-01-01T08:00:00"),
        finish: new Date("2026-01-02T17:00:00"),
        wbs: "1.1.1",
      }),
      task({
        id: "B",
        name: "Actividad 2",
        start: new Date("2026-02-01T08:00:00"),
        finish: new Date("2026-02-02T17:00:00"),
        wbs: "1.1.2",
      }),
    ]);

    expect(analysis.deviations).toEqual([
      expect.objectContaining({
        predecessor: "Actividad 1",
        successor: "Actividad 2",
        relation: "WBS",
      }),
    ]);
  });
});
