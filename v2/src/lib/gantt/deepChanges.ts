import type { GanttTask } from "@/components/gantt/types";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function finDeObra(tasks: GanttTask[]): number | null {
  if (tasks.length === 0) return null;
  return Math.max(...tasks.map((t) => t.finish.getTime()));
}

function rutaCritica(tasks: GanttTask[]): string {
  return tasks
    .filter((t) => t.isCritical)
    .map((t) => String(t.id))
    .sort()
    .join("|");
}

export interface DeepChange {
  /** Días que se corrió el fin de obra; negativo si se adelantó; null si no cambió. */
  projectFinishMoved: number | null;
  criticalPathChanged: boolean;
}

/**
 * Dos cambios merecen que la app hable aunque el usuario no los haya pedido:
 * que se mueva la fecha de entrega y que cambie por dónde pasa la ruta
 * crítica. El resto de recálculos son ruido.
 */
export function detectDeepChanges(
  before: GanttTask[],
  after: GanttTask[],
): DeepChange {
  const antes = finDeObra(before);
  const despues = finDeObra(after);
  const movido =
    antes === null || despues === null || antes === despues
      ? null
      : Math.round((despues - antes) / MS_POR_DIA);

  return {
    projectFinishMoved: movido,
    criticalPathChanged: rutaCritica(before) !== rutaCritica(after),
  };
}
