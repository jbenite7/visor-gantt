/**
 * Network Diagram (PERT chart) layout algorithm.
 *
 * Produces non-overlapping node positions for a PERT/network diagram
 * using topological sort (Kahn's algorithm) to assign columns by early start date.
 *
 * Pure functions — no React, no DOM, no side effects.
 */
import type { GanttTask, GanttDependency } from "@/components/gantt/types";

// ── Layout Types ─────────────────────────────────────────────────────────────

export interface NetworkNode {
  taskId: string | number;
  taskName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isCritical: boolean;
  isMilestone: boolean;
  isSummary: boolean;
  earlyStart?: Date;
  earlyFinish?: Date;
  duration: number;
  /** Column index (0-based) — higher = later in project */
  column: number;
  /** Row index within the column (0-based) */
  row: number;
}

export interface NetworkEdge {
  fromTaskId: string | number;
  toTaskId: string | number;
  type: "FS" | "SS" | "FF" | "SF";
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isCritical: boolean;
}

export interface NetworkLayoutResult {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  totalWidth: number;
  totalHeight: number;
  columnCount: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;
const HORIZONTAL_SPACING = 80;
const VERTICAL_SPACING = 40;

// ── Empty Result ─────────────────────────────────────────────────────────────

const EMPTY_RESULT: NetworkLayoutResult = {
  nodes: [],
  edges: [],
  totalWidth: 0,
  totalHeight: 0,
  columnCount: 0,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the sortable date for a task — earlyStart preferred, fallback to start.
 */
function getSortDate(task: GanttTask): Date {
  return task.earlyStart ?? task.start;
}

// ── Graph Construction ───────────────────────────────────────────────────────

interface GraphData {
  /** id → task map for O(1) lookup */
  taskMap: Map<string | number, GanttTask>;
  /** id → set of successor task ids */
  successors: Map<string | number, Set<string | number>>;
  /** id → set of predecessor task ids */
  predecessors: Map<string | number, Set<string | number>>;
  /** All task ids in input order */
  taskIds: (string | number)[];
}

function buildGraph(tasks: GanttTask[]): GraphData {
  const taskMap = new Map<string | number, GanttTask>();
  const successors = new Map<string | number, Set<string | number>>();
  const predecessors = new Map<string | number, Set<string | number>>();
  const taskIds: (string | number)[] = [];

  for (const task of tasks) {
    taskMap.set(task.id, task);
    successors.set(task.id, new Set());
    predecessors.set(task.id, new Set());
    taskIds.push(task.id);
  }

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      // `dep.from` is the predecessor, `task.id` is the successor
      const predSet = successors.get(dep.from);
      if (predSet) {
        predSet.add(task.id);
      }
      const succSet = predecessors.get(task.id);
      if (succSet) {
        succSet.add(dep.from);
      }
    }
  }

  return { taskMap, successors, predecessors, taskIds };
}

// ── Topological Sort (Kahn's Algorithm) ──────────────────────────────────────

/**
 * Returns a topologically sorted array of task ids.
 * Circular dependencies are detected and broken gracefully —
 * tasks stuck in cycles are appended at the end with a console warning.
 */
function topologicalSort(graph: GraphData): (string | number)[] {
  const { taskMap, successors, taskIds } = graph;

  // Compute in-degree for each task
  const inDegree = new Map<string | number, number>();
  for (const id of taskIds) {
    inDegree.set(id, 0);
  }
  for (const [id] of taskMap) {
    const preds = graph.predecessors.get(id);
    if (preds) {
      inDegree.set(id, preds.size);
    }
  }

  // Queue: tasks with in-degree 0 (no predecessors)
  const queue: (string | number)[] = [];
  for (const id of taskIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      queue.push(id);
    }
  }

  const sorted: (string | number)[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const succs = successors.get(current);
    if (succs) {
      for (const succId of succs) {
        const deg = (inDegree.get(succId) ?? 1) - 1;
        inDegree.set(succId, deg);
        if (deg === 0) {
          queue.push(succId);
        }
      }
    }
  }

  // Circular dependency detection
  if (sorted.length < taskIds.length) {
    const cycleIds = taskIds.filter((id) => !sorted.includes(id));
    console.warn(
      `[networkLayout] Circular dependency detected among ${cycleIds.length} task(s). ` +
        `Breaking cycle by appending them at the end: [${cycleIds.join(", ")}]`
    );
    // Append cycle tasks in their original order (breaking the cycle)
    sorted.push(...cycleIds);
  }

  return sorted;
}

// ── Column Assignment ────────────────────────────────────────────────────────

/**
 * Assign column index to each task.
 * Column 0 = no predecessors. Column N = max(predecessor columns) + 1.
 * Uses BFS from root tasks to ensure correct layering.
 */
function assignColumns(
  graph: GraphData,
  sortedIds: (string | number)[]
): Map<string | number, number> {
  const { predecessors } = graph;
  const columns = new Map<string | number, number>();

  // Process in topological order so predecessors are always assigned first
  for (const id of sortedIds) {
    const preds = predecessors.get(id);
    if (!preds || preds.size === 0) {
      columns.set(id, 0);
      continue;
    }

    let maxPredCol = -1;
    for (const predId of preds) {
      const predCol = columns.get(predId);
      if (predCol !== undefined && predCol > maxPredCol) {
        maxPredCol = predCol;
      }
    }

    columns.set(id, maxPredCol + 1);
  }

  return columns;
}

// ── Row Assignment ───────────────────────────────────────────────────────────

/**
 * Within each column, sort tasks by earlyStart (or start fallback)
 * and assign row indices 0, 1, 2, ...
 */
function assignRows(
  graph: GraphData,
  columns: Map<string | number, number>
): Map<string | number, number> {
  const { taskMap } = graph;

  // Group task ids by column
  const columnGroups = new Map<number, (string | number)[]>();
  for (const [id, col] of columns) {
    const group = columnGroups.get(col) ?? [];
    group.push(id);
    columnGroups.set(col, group);
  }

  const rows = new Map<string | number, number>();

  for (const [, ids] of columnGroups) {
    // Sort by earlyStart (or start) within column
    ids.sort((a, b) => {
      const taskA = taskMap.get(a);
      const taskB = taskMap.get(b);
      if (!taskA || !taskB) return 0;
      return getSortDate(taskA).getTime() - getSortDate(taskB).getTime();
    });

    for (let i = 0; i < ids.length; i++) {
      rows.set(ids[i], i);
    }
  }

  return rows;
}

// ── Build Nodes ──────────────────────────────────────────────────────────────

function buildNodes(
  graph: GraphData,
  columns: Map<string | number, number>,
  rows: Map<string | number, number>
): NetworkNode[] {
  const { taskMap } = graph;
  const nodes: NetworkNode[] = [];

  for (const [id, col] of columns) {
    const task = taskMap.get(id);
    if (!task) continue;

    const row = rows.get(id) ?? 0;
    const x = col * (NODE_WIDTH + HORIZONTAL_SPACING);
    const y = row * (NODE_HEIGHT + VERTICAL_SPACING);

    nodes.push({
      taskId: id,
      taskName: task.name,
      x,
      y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      isCritical: task.isCritical,
      isMilestone: task.isMilestone,
      isSummary: task.isSummary,
      earlyStart: task.earlyStart,
      earlyFinish: task.earlyFinish,
      duration: task.duration,
      column: col,
      row,
    });
  }

  return nodes;
}

// ── Build Edges ──────────────────────────────────────────────────────────────

function buildEdges(
  graph: GraphData,
  nodeMap: Map<string | number, NetworkNode>
): NetworkEdge[] {
  const { taskMap } = graph;
  const edges: NetworkEdge[] = [];

  for (const [id, task] of taskMap) {
    const toNode = nodeMap.get(id);
    if (!toNode) continue;

    for (const dep of task.dependencies) {
      const fromNode = nodeMap.get(dep.from);
      if (!fromNode) continue;

      // From: right center of predecessor
      const fromX = fromNode.x + fromNode.width;
      const fromY = fromNode.y + fromNode.height / 2;

      // To: left center of successor
      const toX = toNode.x;
      const toY = toNode.y + toNode.height / 2;

      edges.push({
        fromTaskId: dep.from,
        toTaskId: id,
        type: dep.type,
        fromX,
        fromY,
        toX,
        toY,
        isCritical: fromNode.isCritical && toNode.isCritical,
      });
    }
  }

  return edges;
}

// ── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Computes the network layout for a set of Gantt tasks.
 *
 * Algorithm:
 * 1. Build adjacency graph from task dependencies
 * 2. Topological sort (Kahn's) — breaks cycles gracefully
 * 3. Assign columns: col 0 = no predecessors, col N = max(pred cols) + 1
 * 4. Assign rows within each column (sorted by earlyStart)
 * 5. Calculate pixel positions (nodeWidth=180, nodeHeight=80, hSpacing=80, vSpacing=40)
 * 6. Build edges (right-center → left-center routing)
 * 7. Compute total dimensions
 *
 * @param tasks - Array of GanttTask with dependencies
 * @returns Non-overlapping node positions + edge data
 */
export function computeNetworkLayout(
  tasks: GanttTask[]
): NetworkLayoutResult {
  if (tasks.length === 0) {
    return EMPTY_RESULT;
  }

  // Step 1: Build dependency graph
  const graph = buildGraph(tasks);

  // Step 2: Topological sort (handles circular deps)
  const sortedIds = topologicalSort(graph);

  // Step 3: Assign columns by depth
  const columns = assignColumns(graph, sortedIds);

  // Step 4: Assign rows within columns
  const rows = assignRows(graph, columns);

  // Step 5: Calculate pixel positions
  const nodes = buildNodes(graph, columns, rows);

  // Build node map for edge construction
  const nodeMap = new Map<string | number, NetworkNode>();
  for (const node of nodes) {
    nodeMap.set(node.taskId, node);
  }

  // Step 6: Build edges
  const edges = buildEdges(graph, nodeMap);

  // Step 7: Calculate total dimensions
  let maxColumn = 0;
  let maxRow = 0;
  for (const [, col] of columns) {
    if (col > maxColumn) maxColumn = col;
  }

  // Find the maximum row across all columns
  const columnMaxRows = new Map<number, number>();
  for (const [, col] of columns) {
    const currentMax = columnMaxRows.get(col) ?? 0;
    // Count rows in this column
    let rowCount = 0;
    for (const [, c] of columns) {
      if (c === col) rowCount++;
    }
    if (rowCount > currentMax) {
      columnMaxRows.set(col, rowCount);
    }
  }
  for (const [, rowCount] of columnMaxRows) {
    if (rowCount > maxRow) maxRow = rowCount;
  }

  const columnCount = maxColumn + 1;
  const totalWidth =
    columnCount * (NODE_WIDTH + HORIZONTAL_SPACING) + NODE_WIDTH;
  const totalHeight =
    (maxRow > 0 ? maxRow : 1) * (NODE_HEIGHT + VERTICAL_SPACING) + NODE_HEIGHT;

  return {
    nodes,
    edges,
    totalWidth,
    totalHeight,
    columnCount,
  };
}
