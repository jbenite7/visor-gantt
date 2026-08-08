import type { MatrixCell, MatrixPlan } from "@/types/matrix";

/**
 * El rendimiento que la obra sacó de verdad, esperando visto bueno.
 *
 * `syncMatrixPlanFromTasks` ya lo calcula y lo deja en `cell.feedback` con
 * estado «pendingApproval»; hasta ahora nadie lo leía. Aprobarlo cierra el
 * ciclo: la próxima torre se programa con los datos de la anterior.
 */
export interface PendingFeedback {
  cellId: string;
  scopeId: string;
  areaId: string;
  observedDurationDays: number;
  suggestedProductivityPerDay: number;
  currentProductivityPerDay?: number;
  message: string;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

export function listPendingFeedback(plan: MatrixPlan): PendingFeedback[] {
  return plan.cells
    .filter((cell) => cell.feedback?.status === "pendingApproval")
    .map((cell) => {
      const feedback = cell.feedback!;
      const planificado = cell.productivityOverridePerDay;
      return {
        cellId: cell.id,
        scopeId: cell.scopeId,
        areaId: cell.areaId,
        observedDurationDays: feedback.observedDurationDays,
        suggestedProductivityPerDay: feedback.suggestedProductivityPerDay,
        currentProductivityPerDay: planificado,
        message:
          `En obra tardó ${formatNumber(feedback.observedDurationDays)} días. ` +
          `El rendimiento real es ${formatNumber(feedback.suggestedProductivityPerDay)} por día` +
          (planificado === undefined
            ? "."
            : `, frente a ${formatNumber(planificado)} planificado.`),
      };
    });
}

function updateFeedback(
  plan: MatrixPlan,
  cellId: string,
  editedAt: string,
  update: (cell: MatrixCell) => MatrixCell,
): MatrixPlan {
  return {
    ...plan,
    cells: plan.cells.map((cell) => {
      if (cell.id !== cellId || !cell.feedback) return cell;
      return { ...update(cell), lastEditedAt: editedAt, lastEditedFrom: "matrix" };
    }),
  };
}

export function approveCellFeedback(
  plan: MatrixPlan,
  cellId: string,
  editedAt: string,
): MatrixPlan {
  return updateFeedback(plan, cellId, editedAt, (cell) => ({
    ...cell,
    productivityOverridePerDay: cell.feedback!.suggestedProductivityPerDay,
    feedback: { ...cell.feedback!, status: "approved" },
  }));
}

export function dismissCellFeedback(
  plan: MatrixPlan,
  cellId: string,
  editedAt: string,
): MatrixPlan {
  return updateFeedback(plan, cellId, editedAt, (cell) => ({
    ...cell,
    feedback: { ...cell.feedback!, status: "dismissed" },
  }));
}
