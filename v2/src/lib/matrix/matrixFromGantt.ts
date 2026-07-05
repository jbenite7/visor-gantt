import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type {
  ActivityRecipe,
  AreaNode,
  MatrixCell,
  MatrixPlan,
  ScopeNode,
} from "@/types/matrix";

interface BuildMatrixPlanFromGanttInput {
  id: string;
  name: string;
  startDate: string;
  tasks: GanttTask[];
  generatedAt?: string;
}

interface BuildMatrixPlanFromGanttResult {
  matrixPlan: MatrixPlan;
  tasks: GanttTask[];
}

interface ScopeStackItem {
  level: number;
  node: ScopeNode;
}

const IMPORTED_AREA_ID = "mpp-cronograma-importado";

function sanitizeId(value: string | number): string {
  const sanitized = String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "item";
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minStart(tasks: GanttTask[], fallback: string): string {
  const starts = tasks
    .map((task) => task.start.getTime())
    .filter((value) => Number.isFinite(value));
  if (starts.length === 0) return fallback;
  return dateOnly(new Date(Math.min(...starts)));
}

function taskOrder(task: GanttTask, index: number): string {
  return task.wbs ?? String(task.id ?? index + 1);
}

function sortTasks(tasks: GanttTask[]): GanttTask[] {
  return [...tasks].sort((a, b) =>
    String(taskOrder(a, 0)).localeCompare(String(taskOrder(b, 0)), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function addChild(parent: ScopeNode | undefined, roots: ScopeNode[], node: ScopeNode) {
  if (!parent) {
    roots.push(node);
    return;
  }
  parent.children = [...(parent.children ?? []), node];
}

function buildScopeTree(tasks: GanttTask[]): { roots: ScopeNode[]; leafByTaskId: Map<string | number, ScopeNode> } {
  const roots: ScopeNode[] = [];
  const stack: ScopeStackItem[] = [];
  const leafByTaskId = new Map<string | number, ScopeNode>();

  sortTasks(tasks).forEach((task) => {
    const level = Math.max(1, task.outlineLevel || 1);
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const node: ScopeNode = {
      id: `mpp-scope-${sanitizeId(task.id)}`,
      name: task.name,
      type: task.isSummary ? "Resumen MPP" : "Tarea MPP",
    };
    const parent = stack[stack.length - 1]?.node;
    addChild(parent, roots, node);

    if (task.isSummary) {
      stack.push({ level, node });
      return;
    }

    leafByTaskId.set(task.id, node);
  });

  if (roots.length > 0) return { roots, leafByTaskId };

  const root: ScopeNode = {
    id: "mpp-scope-proyecto-importado",
    name: "Proyecto importado",
    type: "Resumen MPP",
  };
  return { roots: [root], leafByTaskId };
}

function collectImportedDependencies(tasks: GanttTask[]): GanttDependency[] {
  const knownTaskIds = new Set(tasks.map((task) => task.id));
  const seen = new Set<string>();
  const result: GanttDependency[] = [];

  tasks.forEach((task) => {
    (task.dependencies ?? []).forEach((dependency) => {
      if (!knownTaskIds.has(dependency.from) || !knownTaskIds.has(dependency.to)) {
        return;
      }
      const key = [
        dependency.from,
        dependency.to,
        dependency.type,
        dependency.lag ?? 0,
      ].join("::");
      if (seen.has(key)) return;
      seen.add(key);
      result.push(dependency);
    });
  });

  return result;
}

function recipeForTask(task: GanttTask): ActivityRecipe {
  const activityId = `activity-${sanitizeId(task.id)}`;
  return {
    id: `recipe-${sanitizeId(task.id)}`,
    name: task.name,
    activities: [
      {
        id: activityId,
        name: task.name,
        productivityPerDay: 1,
        defaultQuantity: Math.max(1, task.duration || 1),
        unit: "d",
      },
    ],
    dependencies: [],
  };
}

function cellForTask({
  task,
  scopeId,
  generatedAt,
}: {
  task: GanttTask;
  scopeId: string;
  generatedAt: string;
}): MatrixCell {
  const activityId = `activity-${sanitizeId(task.id)}`;
  const recipeId = `recipe-${sanitizeId(task.id)}`;
  const cellId = `cell-${sanitizeId(task.id)}`;

  return {
    id: cellId,
    scopeId,
    areaId: IMPORTED_AREA_ID,
    recipeId,
    active: true,
    quantity: Math.max(1, task.duration || 1),
    unit: "d",
    productivityOverridePerDay: 1,
    generatedTaskIds: [task.id],
    syncedTaskIds: [task.id],
    lastEditedAt: generatedAt,
    lastEditedFrom: "gantt",
    activityOverrides: [
      {
        activityId,
        name: task.name,
        quantity: Math.max(1, task.duration || 1),
        unit: "d",
        productivityPerDay: 1,
        sourceTaskId: task.id,
        start: task.start.toISOString(),
        finish: task.finish.toISOString(),
        duration: task.duration,
        progress: task.progress,
        percentComplete: task.percentComplete,
        isCritical: task.isCritical,
        isMilestone: task.isMilestone,
        resourceNames: task.resourceNames,
        cost: task.cost,
        actualCost: task.actualCost,
        lastEditedAt: generatedAt,
        lastEditedFrom: "gantt",
      },
    ],
    notes: `Importado desde Gantt/MPP con paridad hacia la tarea ${task.id}.`,
  };
}

export function buildMatrixPlanFromGantt({
  id,
  name,
  startDate,
  tasks,
  generatedAt = new Date().toISOString(),
}: BuildMatrixPlanFromGanttInput): BuildMatrixPlanFromGanttResult {
  const operationalTasks = sortTasks(tasks).filter((task) => !task.isSummary);
  const { roots, leafByTaskId } = buildScopeTree(tasks);
  const area: AreaNode = {
    id: IMPORTED_AREA_ID,
    name: "Cronograma importado",
    type: "MPP",
  };
  const effectiveStartDate = minStart(operationalTasks, startDate);

  const recipes = operationalTasks.map(recipeForTask);
  const cells = operationalTasks.flatMap((task) => {
    const scope = leafByTaskId.get(task.id);
    if (!scope) return [];
    return [
      cellForTask({
        task,
        scopeId: scope.id,
        generatedAt,
      }),
    ];
  });

  const matrixPlan: MatrixPlan = {
    id,
    name,
    templateId: "mpp-import",
    startDate: effectiveStartDate,
    scopeTree: roots,
    areas: [area],
    recipes,
    cells,
    ganttDependencies: collectImportedDependencies(operationalTasks),
  };

  const tasksWithMatrixSource = tasks.map((task) => {
    if (task.isSummary) return task;
    const scope = leafByTaskId.get(task.id);
    if (!scope) return task;
    const activityId = `activity-${sanitizeId(task.id)}`;
    const cellId = `cell-${sanitizeId(task.id)}`;
    const recipeId = `recipe-${sanitizeId(task.id)}`;
    return {
      ...task,
      matrixSource: {
        matrixPlanId: id,
        scopeId: scope.id,
        areaId: IMPORTED_AREA_ID,
        cellId,
        recipeId,
        activityId,
      },
      matrixSync: {
        lastEditedAt: generatedAt,
        lastEditedFrom: "gantt" as const,
      },
    };
  });

  return { matrixPlan, tasks: tasksWithMatrixSource };
}
