import type { GanttTask } from "@/components/gantt/types";
import type { MatrixPlan } from "@/types/matrix";
import { getAreaLeaves, removeAreaNode } from "./tree";

/**
 * Qué hacer con las tareas que una ubicación ya había generado cuando se
 * borra esa ubicación.
 *
 * `removeAreaNode` quitaba el nodo y sus celdas y dejaba las tareas
 * huérfanas hasta la siguiente aplicación. En un producto donde la línea
 * constante es que nada se pierde en silencio, eso es un borrado a ciegas:
 * aquí se cuenta lo que hay y se ofrecen las dos salidas honestas.
 */
export type OrphanTaskPolicy = "borrar" | "conservar";

export interface AreaRemovalPreview {
  areaName: string;
  cellCount: number;
  taskIds: (string | number)[];
  message: string;
}

function areaTaskIds(tasks: GanttTask[], areaId: string): (string | number)[] {
  return tasks
    .filter((task) => task.matrixSource?.areaId === areaId)
    .map((task) => task.id);
}

export function describeAreaRemoval(
  plan: MatrixPlan,
  tasks: GanttTask[],
  areaId: string,
): AreaRemovalPreview {
  const area = getAreaLeaves(plan.areas).find((leaf) => leaf.node.id === areaId)?.node;
  const taskIds = area ? areaTaskIds(tasks, areaId) : [];
  const cellCount = plan.cells.filter((cell) => cell.areaId === areaId).length;
  const areaName = area?.name ?? areaId;

  return {
    areaName,
    cellCount,
    taskIds,
    message:
      taskIds.length === 0
        ? `«${areaName}» no tiene tareas en el cronograma. Se puede borrar sin más.`
        : `«${areaName}» tiene ${taskIds.length} tareas ya generadas en el cronograma. Elige qué hacer con ellas antes de borrarla.`,
  };
}

export function removeAreaWithTasks(
  plan: MatrixPlan,
  tasks: GanttTask[],
  areaId: string,
  policy: OrphanTaskPolicy,
): { matrixPlan: MatrixPlan; tasks: GanttTask[] } {
  const exists = getAreaLeaves(plan.areas).some((leaf) => leaf.node.id === areaId);
  if (!exists) return { matrixPlan: plan, tasks };

  const affected = new Set(areaTaskIds(tasks, areaId));

  const nextTasks =
    policy === "borrar"
      ? tasks.filter((task) => !affected.has(task.id))
      : tasks.map((task) =>
          affected.has(task.id)
            ? { ...task, matrixSource: undefined, matrixSync: undefined }
            : task,
        );

  return { matrixPlan: removeAreaNode(plan, areaId), tasks: nextTasks };
}
