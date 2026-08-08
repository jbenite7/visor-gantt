import type { MatrixCell, MatrixPlan } from "@/types/matrix";

/**
 * Qué se perdería al salir de la matriz sin aplicar.
 *
 * M28: hoy el borrador se pierde sin aviso al cambiar de pestaña o recargar.
 * Saber *si* hay cambios es del dato y vive aquí; interceptar la salida es de
 * la vista y vive en el carril A.
 */
export interface DraftChanges {
  hasChanges: boolean;
  changedCellCount: number;
  message: string;
}

/** Todo lo de una celda que el usuario puede editar. */
function cellFingerprint(cell: MatrixCell): string {
  return JSON.stringify([
    cell.recipeId,
    cell.active,
    cell.quantity,
    cell.unit,
    cell.productivityOverridePerDay,
    cell.notes,
    cell.activityOverrides ?? null,
  ]);
}

function structureFingerprint(plan: MatrixPlan): string {
  return JSON.stringify([plan.scopeTree, plan.areas, plan.recipes, plan.startDate]);
}

export function describeDraftChanges(
  draft: MatrixPlan | undefined,
  applied: MatrixPlan | undefined,
): DraftChanges {
  if (!draft) {
    return { hasChanges: false, changedCellCount: 0, message: "No hay cambios sin aplicar." };
  }

  if (!applied) {
    return {
      hasChanges: true,
      changedCellCount: draft.cells.length,
      message: "Hay una matriz sin aplicar.",
    };
  }

  if (structureFingerprint(draft) !== structureFingerprint(applied)) {
    return {
      hasChanges: true,
      changedCellCount: 0,
      message: "Hay cambios en la estructura de la matriz sin aplicar.",
    };
  }

  const appliedByCellId = new Map(
    applied.cells.map((cell) => [cell.id, cellFingerprint(cell)]),
  );
  const draftIds = new Set(draft.cells.map((cell) => cell.id));

  const changed = draft.cells.filter(
    (cell) => appliedByCellId.get(cell.id) !== cellFingerprint(cell),
  ).length;
  // Una celda borrada no tiene representante en el borrador: si solo
  // miráramos hacia un lado, borrar pasaría por «no hay cambios» y el
  // usuario perdería el borrado sin aviso.
  const removed = applied.cells.filter((cell) => !draftIds.has(cell.id)).length;

  const changedCellCount = changed + removed;

  if (changedCellCount === 0) {
    return { hasChanges: false, changedCellCount: 0, message: "No hay cambios sin aplicar." };
  }

  return {
    hasChanges: true,
    changedCellCount,
    message:
      changedCellCount === 1
        ? "Hay 1 celda con cambios sin aplicar."
        : `Hay ${changedCellCount} celdas con cambios sin aplicar.`,
  };
}
