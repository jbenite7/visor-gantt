import { analyzeTypicalUnits } from "./typicalUnit";
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
    dependencies: [],
    wbs: overrides.wbs,
  };
}

describe("analyzeTypicalUnits", () => {
  test("groups repeated systems across three or more levels", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Mampostería Piso 1", wbs: "1.1.1" }),
      task({ id: 2, name: "Mampostería Piso 2", wbs: "1.1.2" }),
      task({ id: 3, name: "Mampostería Piso 3", wbs: "1.1.3" }),
      task({ id: 4, name: "Pintura Piso 1", wbs: "1.2.1" }),
    ]);

    expect(analysis.groups).toEqual([
      expect.objectContaining({
        system: "mampostería",
        levelCount: 3,
        taskCount: 3,
      }),
    ]);
  });

  test("degrades with an informative reason when data is insufficient", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Actividad sin unidad", wbs: "1" }),
    ]);

    expect(analysis.groups).toEqual([]);
    expect(analysis.insufficientReason).toContain("No se detectaron sistemas repetidos");
  });
});
