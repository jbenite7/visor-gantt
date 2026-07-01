import type { AreaNode, MatrixCell, MatrixPlan, ScopeNode } from "@/types/matrix";

export const MAX_MATRIX_TREE_DEPTH = 10;

export interface MatrixTreeLeaf<T> {
  node: T;
  path: T[];
  depth: number;
  leafIndex: number;
}

interface BaseTreeNode {
  id: string;
  name: string;
  type?: string;
  children?: BaseTreeNode[];
}

function getLeaves<T extends BaseTreeNode>(nodes: T[]): MatrixTreeLeaf<T>[] {
  const leaves: MatrixTreeLeaf<T>[] = [];

  function visit(node: T, path: T[]) {
    const nextPath = [...path, node];
    if (!node.children || node.children.length === 0) {
      leaves.push({
        node,
        path: nextPath,
        depth: nextPath.length,
        leafIndex: leaves.length,
      });
      return;
    }
    (node.children as T[]).forEach((child) => visit(child, nextPath));
  }

  nodes.forEach((node) => visit(node, []));
  return leaves;
}

export function getScopeLeaves(nodes: ScopeNode[]): MatrixTreeLeaf<ScopeNode>[] {
  return getLeaves(nodes);
}

export function getAreaLeaves(nodes: AreaNode[]): MatrixTreeLeaf<AreaNode>[] {
  return getLeaves(nodes);
}

function findPath<T extends BaseTreeNode>(nodes: T[], id: string): T[] | undefined {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = node.children
      ? findPath(node.children as T[], id)
      : undefined;
    if (childPath) return [node, ...childPath];
  }
  return undefined;
}

export function getNodeDepth<T extends BaseTreeNode>(
  nodes: T[],
  id: string,
): number | undefined {
  return findPath(nodes, id)?.length;
}

export function canAddChild<T extends BaseTreeNode>(nodes: T[], id: string): boolean {
  const depth = getNodeDepth(nodes, id);
  return depth != null && depth < MAX_MATRIX_TREE_DEPTH;
}

function collectNodeIds<T extends BaseTreeNode>(node: T): string[] {
  return [node.id, ...((node.children ?? []) as T[]).flatMap(collectNodeIds)];
}

function collectIdsByRoot<T extends BaseTreeNode>(nodes: T[], id: string): string[] {
  for (const node of nodes) {
    if (node.id === id) return collectNodeIds(node);
    const childIds = node.children
      ? collectIdsByRoot(node.children as T[], id)
      : [];
    if (childIds.length > 0) return childIds;
  }
  return [];
}

export function getScopeNodeIds(nodes: ScopeNode[], id: string): string[] {
  return collectIdsByRoot(nodes, id);
}

export function getAreaNodeIds(nodes: AreaNode[], id: string): string[] {
  return collectIdsByRoot(nodes, id);
}

function removeNode<T extends BaseTreeNode>(
  nodes: T[],
  id: string,
): { nodes: T[]; removedIds: string[] } {
  const nextNodes: T[] = [];
  let removedIds: string[] = [];

  nodes.forEach((node) => {
    if (node.id === id) {
      removedIds = collectNodeIds(node);
      return;
    }
    if (!node.children) {
      nextNodes.push(node);
      return;
    }
    const childResult = removeNode(node.children as T[], id);
    if (childResult.removedIds.length > 0) {
      removedIds = childResult.removedIds;
      nextNodes.push({ ...node, children: childResult.nodes } as T);
      return;
    }
    nextNodes.push(node);
  });

  return { nodes: nextNodes, removedIds };
}

export function removeScopeNode(plan: MatrixPlan, id: string): MatrixPlan {
  const result = removeNode(plan.scopeTree, id);
  const removed = new Set(result.removedIds);
  return {
    ...plan,
    scopeTree: result.nodes,
    cells: plan.cells.filter((cell) => !removed.has(cell.scopeId)),
  };
}

export function removeAreaNode(plan: MatrixPlan, id: string): MatrixPlan {
  const result = removeNode(plan.areas, id);
  const removed = new Set(result.removedIds);
  return {
    ...plan,
    areas: result.nodes,
    cells: plan.cells.filter((cell) => !removed.has(cell.areaId)),
  };
}

function updateNode<T extends BaseTreeNode>(
  nodes: T[],
  id: string,
  updater: (node: T) => T,
): T[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (!node.children) return node;
    return {
      ...node,
      children: updateNode(node.children as T[], id, updater),
    } as T;
  });
}

export function updateScopeNode(
  nodes: ScopeNode[],
  id: string,
  updates: Partial<ScopeNode>,
): ScopeNode[] {
  return updateNode(nodes, id, (node) => ({ ...node, ...updates }));
}

export function updateAreaNode(
  nodes: AreaNode[],
  id: string,
  updates: Partial<AreaNode>,
): AreaNode[] {
  return updateNode(nodes, id, (node) => ({ ...node, ...updates }));
}

function insertChild<T extends BaseTreeNode>(nodes: T[], parentId: string, child: T): T[] {
  return updateNode(nodes, parentId, (node) => ({
    ...node,
    children: [...(node.children ?? []), child],
  }));
}

export function insertScopeChild(
  nodes: ScopeNode[],
  parentId: string,
  child: ScopeNode,
): ScopeNode[] {
  return insertChild(nodes, parentId, child);
}

export function insertAreaChild(
  nodes: AreaNode[],
  parentId: string,
  child: AreaNode,
): AreaNode[] {
  return insertChild(nodes, parentId, child);
}

function insertSibling<T extends BaseTreeNode>(
  nodes: T[],
  targetId: string,
  sibling: T,
): T[] {
  const result: T[] = [];
  let inserted = false;

  nodes.forEach((node) => {
    result.push(node);
    if (node.id === targetId) {
      result.push(sibling);
      inserted = true;
      return;
    }
    if (!inserted && node.children) {
      const nextChildren = insertSibling(node.children as T[], targetId, sibling);
      if (nextChildren !== node.children) {
        result[result.length - 1] = { ...node, children: nextChildren } as T;
        inserted = true;
      }
    }
  });

  return inserted ? result : nodes;
}

export function insertScopeSibling(
  nodes: ScopeNode[],
  targetId: string,
  sibling: ScopeNode,
): ScopeNode[] {
  return insertSibling(nodes, targetId, sibling);
}

export function insertAreaSibling(
  nodes: AreaNode[],
  targetId: string,
  sibling: AreaNode,
): AreaNode[] {
  return insertSibling(nodes, targetId, sibling);
}

function cellKey(scopeId: string, areaId: string): string {
  return `${scopeId}::${areaId}`;
}

function nextCell(
  existing: MatrixCell | undefined,
  scope: ScopeNode,
  area: AreaNode,
  timestamp: string,
  firstRecipeId: string | undefined,
): MatrixCell {
  return {
    id: existing?.id ?? `cell-${scope.id}-${area.id}`,
    scopeId: scope.id,
    areaId: area.id,
    recipeId: existing?.recipeId ?? scope.defaultRecipeId ?? firstRecipeId,
    active: existing?.active ?? false,
    activityOverrides: existing?.activityOverrides ?? [],
    quantity: existing?.quantity,
    unit: existing?.unit,
    productivityOverridePerDay: existing?.productivityOverridePerDay,
    notes: existing?.notes,
    generatedTaskIds: existing?.generatedTaskIds,
    syncedTaskIds: existing?.syncedTaskIds,
    lastEditedAt: existing?.lastEditedAt ?? timestamp,
    lastEditedFrom: existing?.lastEditedFrom ?? "matrix",
    feedback: existing?.feedback,
  };
}

export function reconcileMatrixCells(
  plan: MatrixPlan,
  timestamp = new Date().toISOString(),
): MatrixPlan {
  const scopeLeaves = getScopeLeaves(plan.scopeTree);
  const areaLeaves = getAreaLeaves(plan.areas);
  const leafScopeIds = new Set(scopeLeaves.map((leaf) => leaf.node.id));
  const leafAreaIds = new Set(areaLeaves.map((leaf) => leaf.node.id));
  const existingByPair = new Map(
    plan.cells
      .filter((cell) => leafScopeIds.has(cell.scopeId) && leafAreaIds.has(cell.areaId))
      .map((cell) => [cellKey(cell.scopeId, cell.areaId), cell]),
  );
  const firstRecipeId = plan.recipes[0]?.id;

  return {
    ...plan,
    cells: scopeLeaves.flatMap((scope) =>
      areaLeaves.map((area) =>
        nextCell(
          existingByPair.get(cellKey(scope.node.id, area.node.id)),
          scope.node,
          area.node,
          timestamp,
          firstRecipeId,
        ),
      ),
    ),
  };
}

export function migrateScopeCellsToChild(
  plan: MatrixPlan,
  parentScopeId: string,
  childScope: ScopeNode,
): MatrixPlan {
  const migrated = plan.cells.map((cell) =>
    cell.scopeId === parentScopeId
      ? {
          ...cell,
          id: `cell-${childScope.id}-${cell.areaId}`,
          scopeId: childScope.id,
          recipeId: cell.recipeId ?? childScope.defaultRecipeId,
        }
      : cell,
  );
  return { ...plan, cells: migrated };
}

export function migrateAreaCellsToChild(
  plan: MatrixPlan,
  parentAreaId: string,
  childArea: AreaNode,
): MatrixPlan {
  const migrated = plan.cells.map((cell) =>
    cell.areaId === parentAreaId
      ? {
          ...cell,
          id: `cell-${cell.scopeId}-${childArea.id}`,
          areaId: childArea.id,
        }
      : cell,
  );
  return { ...plan, cells: migrated };
}
