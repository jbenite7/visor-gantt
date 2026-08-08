import type { GanttTask } from "@/components/gantt/types";
import type { AreaNode, MatrixPlan } from "@/types/matrix";
import { getAreaNodeIds, removeAreaNode } from "./tree";

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

/** Las tareas de una ubicación y de todas las que agrupa. */
function areaTaskIds(
  plan: MatrixPlan,
  tasks: GanttTask[],
  areaId: string,
): (string | number)[] {
  const ids = new Set(getAreaNodeIds(plan.areas, areaId));
  return tasks
    .filter((task) => task.matrixSource && ids.has(task.matrixSource.areaId))
    .map((task) => task.id);
}

/** Busca el nodo en cualquier profundidad del árbol, no solo entre las hojas. */
function findAreaNode(nodes: AreaNode[], areaId: string): AreaNode | undefined {
  for (const node of nodes) {
    if (node.id === areaId) return node;
    const found = node.children ? findAreaNode(node.children, areaId) : undefined;
    if (found) return found;
  }
  return undefined;
}

export function describeAreaRemoval(
  plan: MatrixPlan,
  tasks: GanttTask[],
  areaId: string,
): AreaRemovalPreview {
  const subtreeIds = new Set(getAreaNodeIds(plan.areas, areaId));
  const area = subtreeIds.size > 0 ? findAreaNode(plan.areas, areaId) : undefined;
  const taskIds = area ? areaTaskIds(plan, tasks, areaId) : [];
  const cellCount = plan.cells.filter((cell) => subtreeIds.has(cell.areaId)).length;
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
  const exists = getAreaNodeIds(plan.areas, areaId).length > 0;
  if (!exists) return { matrixPlan: plan, tasks };

  const affected = new Set(areaTaskIds(plan, tasks, areaId));

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
