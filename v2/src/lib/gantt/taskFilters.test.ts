import type { GanttTask } from "@/components/gantt/types";
import { filterTasks, normalizeTaskFilter } from "./taskFilters";

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

describe("task filters", () => {
  test("normalizes missing and invalid filter settings", () => {
    expect(normalizeTaskFilter(undefined)).toEqual({ text: "", type: "all" });
    expect(normalizeTaskFilter({ text: "obra", type: "invalid" as never })).toEqual({
      text: "obra",
      type: "all",
    });
  });

  test("filters by text, WBS and task type", () => {
    const tasks = [
      task({ id: 1, name: "Capítulo", isSummary: true, wbs: "1" }),
      task({ id: 2, name: "Cimentacion", isCritical: true, wbs: "1.1" }),
      task({ id: 3, name: "Hito contractual", isMilestone: true, wbs: "1.2" }),
      task({ id: 4, name: "Pintura", wbs: "2.1" }),
    ];

    expect(filterTasks(tasks, { text: "ciment", type: "all" }).map((item) => item.id)).toEqual([2]);
    expect(filterTasks(tasks, { text: "1.2", type: "all" }).map((item) => item.id)).toEqual([3]);
    expect(filterTasks(tasks, { text: "", type: "critical" }).map((item) => item.id)).toEqual([2]);
    expect(filterTasks(tasks, { text: "", type: "non-critical" }).map((item) => item.id)).toEqual([4]);
    expect(filterTasks(tasks, { text: "", type: "summaries" }).map((item) => item.id)).toEqual([1]);
  });
});
