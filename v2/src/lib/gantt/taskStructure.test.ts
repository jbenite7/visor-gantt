import type { GanttTask } from "@/components/gantt/types";
import {
  indentTask,
  insertTask,
  moveTaskDown,
  moveTaskUp,
  normalizeTaskStructure,
  outdentTask,
  reorderTask,
} from "./taskStructure";

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

describe("task structure editing", () => {
  test("normalizes WBS, summary flags and summary rollups", () => {
    const result = normalizeTaskStructure([
      task({ id: 1, name: "Capítulo" }),
      task({
        id: 2,
        name: "A",
        outlineLevel: 2,
        start: new Date("2026-01-05T08:00:00"),
        finish: new Date("2026-01-05T08:00:00"),
        duration: 1,
        progress: 25,
      }),
      task({
        id: 3,
        name: "B",
        outlineLevel: 2,
        start: new Date("2026-01-06T08:00:00"),
        finish: new Date("2026-01-08T08:00:00"),
        duration: 3,
        progress: 75,
      }),
    ]);

    expect(result.map((item) => item.wbs)).toEqual(["1", "1.1", "1.2"]);
    expect(result[0].isSummary).toBe(true);
    expect(result[0].duration).toBe(4);
    expect(result[0].progress).toBe(62.5);
  });

  test("indents and outdents a task subtree", () => {
    const tasks = normalizeTaskStructure([
      task({ id: 1 }),
      task({ id: 2 }),
      task({ id: 3, outlineLevel: 2 }),
    ]);

    const indented = indentTask(tasks, 2);
    expect(indented.map((item) => item.outlineLevel)).toEqual([1, 2, 3]);
    expect(indented.map((item) => item.wbs)).toEqual(["1", "1.1", "1.1.1"]);

    const outdented = outdentTask(indented, 2);
    expect(outdented.map((item) => item.outlineLevel)).toEqual([1, 1, 2]);
    expect(outdented.map((item) => item.wbs)).toEqual(["1", "2", "2.1"]);
  });

  test("moves full subtrees up and down without splitting children", () => {
    const tasks = normalizeTaskStructure([
      task({ id: 1, name: "A" }),
      task({ id: 2, name: "A.1", outlineLevel: 2 }),
      task({ id: 3, name: "B" }),
      task({ id: 4, name: "B.1", outlineLevel: 2 }),
    ]);

    const movedDown = moveTaskDown(tasks, 1);
    expect(movedDown.map((item) => item.id)).toEqual([3, 4, 1, 2]);
    expect(movedDown.map((item) => item.wbs)).toEqual(["1", "1.1", "2", "2.1"]);

    const movedUp = moveTaskUp(movedDown, 1);
    expect(movedUp.map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(movedUp.map((item) => item.wbs)).toEqual(["1", "1.1", "2", "2.1"]);
  });

  test("reorders a task subtree before or after another row and preserves descendants", () => {
    const tasks = normalizeTaskStructure([
      task({ id: 1, name: "Capitulo A" }),
      task({ id: 2, name: "A.1", outlineLevel: 2 }),
      task({ id: 3, name: "A.2", outlineLevel: 2 }),
      task({ id: 4, name: "Capitulo B" }),
      task({ id: 5, name: "B.1", outlineLevel: 2 }),
    ]);

    const movedAfter = reorderTask(tasks, 1, 5, "after");
    expect(movedAfter.map((item) => item.id)).toEqual([4, 5, 1, 2, 3]);
    expect(movedAfter.map((item) => item.outlineLevel)).toEqual([1, 2, 2, 3, 3]);
    expect(movedAfter.map((item) => item.wbs)).toEqual(["1", "1.1", "1.2", "1.2.1", "1.2.2"]);

    const movedBefore = reorderTask(movedAfter, 1, 4, "before");
    expect(movedBefore.map((item) => item.id)).toEqual([1, 2, 3, 4, 5]);
    expect(movedBefore.map((item) => item.outlineLevel)).toEqual([1, 2, 2, 1, 2]);
    expect(movedBefore.map((item) => item.wbs)).toEqual(["1", "1.1", "1.2", "2", "2.1"]);

    const movedAsChild = reorderTask(movedBefore, 4, 2, "child");
    expect(movedAsChild.map((item) => item.id)).toEqual([1, 2, 4, 5, 3]);
    expect(movedAsChild.map((item) => item.outlineLevel)).toEqual([1, 2, 3, 4, 2]);
    expect(movedAsChild.map((item) => item.wbs)).toEqual(["1", "1.1", "1.1.1", "1.1.1.1", "1.2"]);
  });

  test("inserts summary and child tasks at the requested structural location", () => {
    const base = normalizeTaskStructure([task({ id: 1 }), task({ id: 2 })]);
    const withSummary = insertTask(base, {
      afterTaskId: 1,
      kind: "summary",
      name: "Nuevo capítulo",
    });
    const withChild = insertTask(withSummary, {
      parentTaskId: 3,
      kind: "task",
      name: "Nueva actividad",
    });

    expect(withChild.map((item) => item.name)).toEqual([
      "Task 1",
      "Nuevo capítulo",
      "Nueva actividad",
      "Task 2",
    ]);
    expect(withChild.map((item) => item.outlineLevel)).toEqual([1, 1, 2, 1]);
    expect(withChild.map((item) => item.wbs)).toEqual(["1", "2", "2.1", "3"]);
  });
});
