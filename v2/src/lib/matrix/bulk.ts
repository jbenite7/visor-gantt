import type { AreaNode, MatrixCell, MatrixPlan, ScopeNode } from "@/types/matrix";
import { getAreaLeaves, getScopeLeaves } from "./tree";

export interface CellPatch {
  recipeId?: string;
  quantity?: number;
  unit?: string;
  active?: boolean;
  productivityOverridePerDay?: number;
}

export interface CellTarget {
  scopeId: string;
  areaId: string;
}

const keyOf = (scopeId: string, areaId: string) => `${scopeId}::${areaId}`;

function patched(cell: MatrixCell, patch: CellPatch, editedAt: string): MatrixCell {
  const next: MatrixCell = { ...cell, lastEditedAt: editedAt, lastEditedFrom: "matrix" };
  if (patch.recipeId !== undefined) next.recipeId = patch.recipeId;
  if (patch.quantity !== undefined) next.quantity = patch.quantity;
  if (patch.unit !== undefined) next.unit = patch.unit;
  if (patch.active !== undefined) next.active = patch.active;
  if (patch.productivityOverridePerDay !== undefined) {
    next.productivityOverridePerDay = patch.productivityOverridePerDay;
  }
  return next;
}

/**
 * Aplica un cambio a varias celdas de una vez.
 *
 * Las celdas que aún no existen se crean con el cambio aplicado: si no,
 * seleccionar una fila entera y activarla dejaría la mitad sin efecto y el
 * usuario no tendría forma de saber por qué.
 */
export function applyBulkCellEdit(
  plan: MatrixPlan,
  targets: CellTarget[],
  patch: CellPatch,
  editedAt: string,
): MatrixPlan {
  if (targets.length === 0) return plan;

  const selected = new Set(targets.map((target) => keyOf(target.scopeId, target.areaId)));
  const existing = new Set(plan.cells.map((cell) => keyOf(cell.scopeId, cell.areaId)));

  const updated = plan.cells.map((cell) =>
    selected.has(keyOf(cell.scopeId, cell.areaId))
      ? patched(cell, patch, editedAt)
      : cell,
  );

  const created = targets
    .filter((target) => !existing.has(keyOf(target.scopeId, target.areaId)))
    .map((target) =>
      patched(
        {
          id: `cell-${target.scopeId}-${target.areaId}`,
          scopeId: target.scopeId,
          areaId: target.areaId,
          // Nace inactiva: la celda se crea solo porque cayó dentro de la
          // selección, y el parche puede no decir nada sobre activarla. No
          // hay que activar algo que el usuario no pidió explícitamente.
          active: false,
        },
        patch,
        editedAt,
      ),
    );

  return { ...plan, cells: [...updated, ...created] };
}

function sanitizeId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Todos los identificadores del árbol, incluidos los nodos intermedios. */
function collectAllIds<T extends { id: string; children?: T[] }>(nodes: T[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: T[]) => {
    for (const node of list) {
      ids.add(node.id);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

function uniqueId(base: string, taken: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return candidate;
}

/** Una celda copiada arranca sin tareas: las de la original son suyas, no de la copia. */
function copyCell(
  cell: MatrixCell,
  scopeId: string,
  areaId: string,
  editedAt: string,
): MatrixCell {
  return {
    ...cell,
    id: `cell-${scopeId}-${areaId}`,
    scopeId,
    areaId,
    generatedTaskIds: [],
    syncedTaskIds: [],
    feedback: undefined,
    lastEditedAt: editedAt,
    lastEditedFrom: "matrix",
  };
}

export function duplicateAreaNode(
  plan: MatrixPlan,
  areaId: string,
  editedAt: string,
): MatrixPlan {
  const source = getAreaLeaves(plan.areas).find((leaf) => leaf.node.id === areaId)?.node;
  if (!source) return plan;

  const taken = collectAllIds(plan.areas);
  const copy: AreaNode = {
    ...source,
    id: uniqueId(`${source.id}-copia`, taken),
    name: `${source.name} (copia)`,
    children: undefined,
  };

  const copiedCells = plan.cells
    .filter((cell) => cell.areaId === areaId)
    .map((cell) => copyCell(cell, cell.scopeId, copy.id, editedAt));

  return {
    ...plan,
    areas: [...plan.areas, copy],
    cells: [...plan.cells, ...copiedCells],
  };
}

export function duplicateScopeNode(
  plan: MatrixPlan,
  scopeId: string,
  editedAt: string,
): MatrixPlan {
  const source = getScopeLeaves(plan.scopeTree).find(
    (leaf) => leaf.node.id === scopeId,
  )?.node;
  if (!source) return plan;

  const taken = collectAllIds(plan.scopeTree);
  const copy: ScopeNode = {
    ...source,
    id: uniqueId(`${source.id}-copia`, taken),
    name: `${source.name} (copia)`,
    children: undefined,
  };

  const copiedCells = plan.cells
    .filter((cell) => cell.scopeId === scopeId)
    .map((cell) => copyCell(cell, copy.id, cell.areaId, editedAt));

  return {
    ...plan,
    scopeTree: [...plan.scopeTree, copy],
    cells: [...plan.cells, ...copiedCells],
  };
}

/**
 * Crea varias ubicaciones de una vez: «Piso {n}», de 1 a 20.
 *
 * `from` puede ser mayor que `to` para crear sótanos en el orden en que se
 * construyen. Sin `{n}` en el patrón se crea una sola: repetir veinte veces
 * el mismo nombre no es lo que nadie quiere.
 */
export function createAreaRange(
  plan: MatrixPlan,
  input: { pattern: string; from: number; to: number; type?: string },
  editedAt: string,
): MatrixPlan {
  const step = input.from <= input.to ? 1 : -1;
  const numbers: number[] = [];
  for (let n = input.from; step > 0 ? n <= input.to : n >= input.to; n += step) {
    numbers.push(n);
  }

  const names = input.pattern.includes("{n}")
    ? numbers.map((n) => input.pattern.replace("{n}", String(n)))
    : [input.pattern];

  const existingNames = new Set(plan.areas.map((area) => area.name));
  const taken = collectAllIds(plan.areas);

  const created: AreaNode[] = names
    .filter((name) => !existingNames.has(name))
    .map((name) => ({
      id: uniqueId(sanitizeId(name), taken),
      name,
      type: input.type,
    }));

  const scopes = getScopeLeaves(plan.scopeTree).map((leaf) => leaf.node);
  const newCells: MatrixCell[] = created.flatMap((area) =>
    scopes.map((scope) => ({
      id: `cell-${scope.id}-${area.id}`,
      scopeId: scope.id,
      areaId: area.id,
      recipeId: scope.defaultRecipeId,
      // Nace activa: crear ubicaciones es un acto deliberado del usuario
      // («quiero los pisos 1 a 20»), así que sus celdas arrancan con lo que
      // pidió, sin un paso extra para activarlas.
      active: true,
      lastEditedAt: editedAt,
      lastEditedFrom: "matrix" as const,
    })),
  );

  return {
    ...plan,
    areas: [...plan.areas, ...created],
    cells: [...plan.cells, ...newCells],
  };
}
