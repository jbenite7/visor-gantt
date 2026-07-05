import type { GanttTask } from "@/components/gantt/types";
import {
  addPredecessor,
  normalizeDependencyList,
  removeDependency,
  replacePredecessors,
  replaceSuccessors,
} from "./dependencyEditing";

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

describe("dependency editing", () => {
  test("normalizes and deduplicates dependencies while preserving type and lag", () => {
    expect(
      normalizeDependencyList([
        { from: 1, to: 2, type: "FS", lag: 2 },
        { from: 1, to: 2, type: "FS", lag: 2 },
        { from: 1, to: 2, type: "SS", lag: -1 },
      ]),
    ).toEqual([
      { from: 1, to: 2, type: "FS", lag: 2 },
      { from: 1, to: 2, type: "SS", lag: -1 },
    ]);
  });

  test("adds and replaces multiple predecessors on the successor task", () => {
    const tasks = [task({ id: 1 }), task({ id: 2 }), task({ id: 3 })];

    const withPredecessor = addPredecessor(tasks, 3, {
      from: 1,
      type: "FS",
      lag: 1,
    });
    expect(withPredecessor.find((item) => item.id === 3)?.dependencies).toEqual([
      { from: 1, to: 3, type: "FS", lag: 1 },
    ]);

    const replaced = replacePredecessors(withPredecessor, 3, [
      { from: 1, type: "SS", lag: -2 },
      { from: 2, type: "FF", lag: 0 },
    ]);
    expect(replaced.find((item) => item.id === 3)?.dependencies).toEqual([
      { from: 1, to: 3, type: "SS", lag: -2 },
      { from: 2, to: 3, type: "FF", lag: 0 },
    ]);
  });

  test("rewrites successors through canonical dependencies stored on successors", () => {
    const tasks = [
      task({ id: 1 }),
      task({ id: 2, dependencies: [{ from: 9, to: 2, type: "FS" }] }),
      task({ id: 3, dependencies: [{ from: 1, to: 3, type: "SS" }] }),
    ];

    const result = replaceSuccessors(tasks, 1, [
      { from: 1, to: 2, type: "FS", lag: 3 },
    ]);

    expect(result.find((item) => item.id === 2)?.dependencies).toEqual([
      { from: 9, to: 2, type: "FS" },
      { from: 1, to: 2, type: "FS", lag: 3 },
    ]);
    expect(result.find((item) => item.id === 3)?.dependencies).toEqual([]);
  });

  test("removes the selected dependency without deleting sibling links", () => {
    const tasks = [
      task({ id: 1 }),
      task({
        id: 2,
        dependencies: [
          { from: 1, to: 2, type: "FS", lag: 1 },
          { from: 1, to: 2, type: "SS", lag: 1 },
        ],
      }),
    ];

    const result = removeDependency(tasks, { from: 1, to: 2, type: "FS", lag: 1 });
    expect(result.find((item) => item.id === 2)?.dependencies).toEqual([
      { from: 1, to: 2, type: "SS", lag: 1 },
    ]);
  });
});

