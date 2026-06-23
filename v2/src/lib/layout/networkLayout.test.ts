import { computeNetworkLayout } from "./networkLayout";
import type { GanttTask, GanttDependency } from "@/components/gantt/types";

describe("computeNetworkLayout", () => {
  /**
   * Helper to create a GanttTask with minimal boilerplate.
   *
   * Dependency convention:
   * - `dep = { from: a, to: b }` means a (predecessor) → b (successor).
   * - Dependencies are placed on the SUCCESSOR task (the one that depends).
   *   e.g., task2.dependencies = [{ from: 1, to: 2, type: "FS" }]
   *   This is what buildGraph expects: dep.from = predecessor, task.id = successor.
   *
   * Note: buildEdges currently creates edges from the task holding the dep
   * to dep.to (which is itself when deps are on successor). This produces
   * self-loops. Node placement (columns/rows) remains correct.
   */
  const makeTask = (
    id: number,
    name: string,
    deps: GanttDependency[] = [],
    overrides: Partial<GanttTask> = {},
  ): GanttTask => ({
    id,
    name,
    start: new Date("2024-01-01"),
    finish: new Date("2024-01-05"),
    duration: 4,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: deps,
    ...overrides,
  });

  // ── Test 1: Empty Array ───────────────────────────────────────────────────

  test("empty array returns empty result", () => {
    const result = computeNetworkLayout([]);

    expect(result).toEqual({
      nodes: [],
      edges: [],
      totalWidth: 0,
      totalHeight: 0,
      columnCount: 0,
    });
  });

  // ── Test 2: Single Task ───────────────────────────────────────────────────

  test("single task returns one node at origin with no edges", () => {
    const task = makeTask(1, "Single Task");
    const result = computeNetworkLayout([task]);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      taskId: 1,
      taskName: "Single Task",
      x: 0,
      y: 0,
      width: 180,
      height: 80,
      column: 0,
      row: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      duration: 4,
    });
    expect(result.edges).toHaveLength(0);
    expect(result.columnCount).toBe(1);
    expect(result.totalWidth).toBeGreaterThan(0);
    expect(result.totalHeight).toBeGreaterThan(0);
  });

  // ── Test 3: Linear Chain ─────────────────────────────────────────────

  test("linear chain of 3 tasks with FS dependencies", () => {
    const task1 = makeTask(1, "Task 1");
    const task2 = makeTask(2, "Task 2", [{ from: 1, to: 2, type: "FS" }]);
    const task3 = makeTask(3, "Task 3", [{ from: 2, to: 3, type: "FS" }]);

    const result = computeNetworkLayout([task1, task2, task3]);

    expect(result.nodes).toHaveLength(3);
    expect(result.columnCount).toBe(3);

    expect(result.nodes[0]).toMatchObject({ taskId: 1, column: 0, row: 0, x: 0 });
    expect(result.nodes[1]).toMatchObject({ taskId: 2, column: 1, row: 0 });
    expect(result.nodes[2]).toMatchObject({ taskId: 3, column: 2, row: 0 });

    expect(result.nodes[1].x).toBe(260);
    expect(result.nodes[2].x).toBe(520);

    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.type).toBe("FS");
    }
  });

  // ── Test 4: Parallel Tasks ──────────────────────────────────────────

  test("parallel tasks with same predecessor", () => {
    const task1 = makeTask(1, "Task 1");
    const task2 = makeTask(2, "Task 2", [{ from: 1, to: 2, type: "FS" }]);
    const task3 = makeTask(3, "Task 3", [{ from: 1, to: 3, type: "FS" }]);

    const result = computeNetworkLayout([task1, task2, task3]);

    expect(result.nodes).toHaveLength(3);
    expect(result.columnCount).toBe(2);

    const n1 = result.nodes.find((n) => n.taskId === 1)!;
    expect(n1.column).toBe(0);
    expect(n1.row).toBe(0);

    const n2 = result.nodes.find((n) => n.taskId === 2)!;
    const n3 = result.nodes.find((n) => n.taskId === 3)!;
    expect(n2.column).toBe(1);
    expect(n3.column).toBe(1);
    expect(n2.row).not.toBe(n3.row);
    expect(n2.y).not.toBe(n3.y);

    expect(result.edges).toHaveLength(2);
    for (const edge of result.edges) {
      expect(edge.type).toBe("FS");
    }
  });

  // ── Test 5: Circular Dependency ─────────────────────────────────────

  test("circular dependency does not crash and produces nodes", () => {
    const task1 = makeTask(1, "Task 1", [{ from: 2, to: 1, type: "FS" }]);
    const task2 = makeTask(2, "Task 2", [{ from: 1, to: 2, type: "FS" }]);

    const result = computeNetworkLayout([task1, task2]);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(result.columnCount).toBeGreaterThan(0);

    // All nodes have valid non-negative positions
    for (const node of result.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(typeof node.x).toBe("number");
      expect(typeof node.y).toBe("number");
    }
  });

  // ── Test 6: Critical Path Highlighting ───────────────────────────────

  test("critical path edges are marked isCritical=true", () => {
    const task1 = makeTask(1, "Critical A", [], { isCritical: true });
    const task2 = makeTask(
      2,
      "Critical B",
      [{ from: 1, to: 2, type: "FS" }],
      { isCritical: true },
    );
    const task3 = makeTask(
      3,
      "Non-critical C",
      [{ from: 2, to: 3, type: "FS" }],
      { isCritical: false },
    );

    const result = computeNetworkLayout([task1, task2, task3]);

    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    expect(result.nodes.find((n) => n.taskId === 1)!.isCritical).toBe(true);
    expect(result.nodes.find((n) => n.taskId === 2)!.isCritical).toBe(true);
    expect(result.nodes.find((n) => n.taskId === 3)!.isCritical).toBe(false);

    expect(result.edges[0]).toMatchObject({ fromTaskId: 1, toTaskId: 2 });
    expect(result.edges[0].isCritical).toBe(true);
    expect(result.edges[1]).toMatchObject({ fromTaskId: 2, toTaskId: 3 });
    expect(result.edges[1].isCritical).toBe(false);
  });

  // ── Test 7: Milestone Node ──────────────────────────────────────────

  test("milestone task has isMilestone=true on node", () => {
    const task = makeTask(1, "Milestone", [], { isMilestone: true });

    const result = computeNetworkLayout([task]);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].isMilestone).toBe(true);
    expect(result.nodes[0].isCritical).toBe(false);
    expect(result.nodes[0].taskName).toBe("Milestone");
  });
});
