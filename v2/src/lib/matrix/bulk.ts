import type { MatrixCell, MatrixPlan } from "@/types/matrix";

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
          active: false,
        },
        patch,
        editedAt,
      ),
    );

  return { ...plan, cells: [...updated, ...created] };
}
