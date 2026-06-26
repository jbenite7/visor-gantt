import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type {
  ActivityRecipe,
  AreaNode,
  MatrixActivityOverride,
  MatrixCell,
  MatrixGenerationResult,
  MatrixIssue,
  MatrixPlan,
  ScopeNode,
} from "@/types/matrix";

interface FlatScope {
  node: ScopeNode;
  path: ScopeNode[];
  leafIndex: number;
}

interface SummaryDraft {
  task: GanttTask;
  childIds: Set<string | number>;
}

const MS_PER_DAY = 86_400_000;

function createDate(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  return date;
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addWorkDays(start: Date, days: number): Date {
  const result = new Date(start);
  result.setHours(0, 0, 0, 0);

  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0) {
      added += 1;
    }
  }

  return result;
}

function finishFromDuration(start: Date, durationDays: number): Date {
  return addWorkDays(start, Math.max(1, durationDays) - 1);
}

function nextWorkDay(date: Date, lagDays = 0): Date {
  return addWorkDays(date, 1 + Math.max(0, lagDays));
}

function flattenScopes(nodes: ScopeNode[]): FlatScope[] {
  const result: FlatScope[] = [];

  function visit(node: ScopeNode, path: ScopeNode[]) {
    const nextPath = [...path, node];
    if (!node.children || node.children.length === 0) {
      result.push({ node, path: nextPath, leafIndex: result.length });
      return;
    }

    node.children.forEach((child) => visit(child, nextPath));
  }

  nodes.forEach((node) => visit(node, []));
  return result;
}

function indexScopes(nodes: ScopeNode[]): Map<string, ScopeNode> {
  const result = new Map<string, ScopeNode>();

  function visit(node: ScopeNode) {
    result.set(node.id, node);
    node.children?.forEach(visit);
  }

  nodes.forEach(visit);
  return result;
}

function indexAreas(nodes: AreaNode[]): Map<string, AreaNode> {
  const result = new Map<string, AreaNode>();

  function visit(node: AreaNode) {
    result.set(node.id, node);
    node.children?.forEach(visit);
  }

  nodes.forEach(visit);
  return result;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildTaskName(area: AreaNode, activityName: string, scope: ScopeNode) {
  return `${area.name} - ${activityName} - ${scope.name}`;
}

function addSummary(
  summaries: Map<string, SummaryDraft>,
  tasks: GanttTask[],
  id: string,
  name: string,
  outlineLevel: number,
  wbs: string,
  start: Date,
) {
  if (summaries.has(id)) return summaries.get(id)!.task;

  const task: GanttTask = {
    id,
    name,
    start,
    finish: start,
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: true,
    outlineLevel,
    dependencies: [],
    wbs,
  };

  summaries.set(id, { task, childIds: new Set() });
  tasks.push(task);
  return task;
}

function addSummaryChild(
  summaries: Map<string, SummaryDraft>,
  parentId: string,
  childId: string | number,
) {
  summaries.get(parentId)?.childIds.add(childId);
}

function durationFrom(quantity: number, productivityPerDay: number): number {
  if (productivityPerDay <= 0) return 1;
  return Math.max(1, Math.ceil(quantity / productivityPerDay));
}

function getActivityOverride(
  cell: MatrixCell,
  activityId: string,
): MatrixActivityOverride | undefined {
  return cell.activityOverrides?.find(
    (override) => override.activityId === activityId,
  );
}

function getMatrixSync(
  cell: MatrixCell,
  override: MatrixActivityOverride | undefined,
): GanttTask["matrixSync"] {
  if (override) {
    return {
      lastEditedAt: override.lastEditedAt,
      lastEditedFrom: override.lastEditedFrom,
    };
  }

  if (cell.lastEditedAt && cell.lastEditedFrom) {
    return {
      lastEditedAt: cell.lastEditedAt,
      lastEditedFrom: cell.lastEditedFrom,
    };
  }

  return undefined;
}

function buildIssue(
  kind: MatrixIssue["kind"],
  severity: MatrixIssue["severity"],
  cell: MatrixCell,
  message: string,
): MatrixIssue {
  return { kind, severity, cellId: cell.id, message };
}

function getCellStart(
  baseStart: Date,
  recipe: ActivityRecipe,
  flatScope: FlatScope,
): Date {
  if (!recipe.lineOfBalance) return baseStart;
  const matchingScope = flatScope.path.find(
    (scope) => scope.type === recipe.lineOfBalance?.scopeType,
  );
  if (!matchingScope) return baseStart;

  return addCalendarDays(
    baseStart,
    flatScope.leafIndex * recipe.lineOfBalance.offsetDays,
  );
}

function recalculateSummaries(
  tasks: GanttTask[],
  summaries: Map<string, SummaryDraft>,
) {
  const taskById = new Map<string | number, GanttTask>();
  tasks.forEach((task) => taskById.set(task.id, task));

  Array.from(summaries.values())
    .reverse()
    .forEach((summary) => {
      const children = Array.from(summary.childIds)
        .map((id) => taskById.get(id))
        .filter((task): task is GanttTask => task != null);

      if (children.length === 0) return;

      const start = new Date(
        Math.min(...children.map((child) => child.start.getTime())),
      );
      const finish = new Date(
        Math.max(...children.map((child) => child.finish.getTime())),
      );

      summary.task.start = start;
      summary.task.finish = finish;
      summary.task.duration =
        Math.round((finish.getTime() - start.getTime()) / MS_PER_DAY) + 1;
    });
}

export function generateScheduleFromMatrix(
  plan: MatrixPlan,
): MatrixGenerationResult {
  const baseStart = createDate(plan.startDate);
  const scopeById = indexScopes(plan.scopeTree);
  const areaById = indexAreas(plan.areas);
  const recipeById = new Map(plan.recipes.map((recipe) => [recipe.id, recipe]));
  const flatScopeById = new Map(
    flattenScopes(plan.scopeTree).map((scope) => [scope.node.id, scope]),
  );

  const tasks: GanttTask[] = [];
  const dependencies: GanttDependency[] = [];
  const issues: MatrixIssue[] = [];
  const provenance: Record<string, (string | number)[]> = {};
  const summaries = new Map<string, SummaryDraft>();

  const rootOrder = new Map(plan.scopeTree.map((scope, index) => [scope.id, index]));
  const cells = [...plan.cells].sort((a, b) => {
    const scopeA = flatScopeById.get(a.scopeId);
    const scopeB = flatScopeById.get(b.scopeId);
    const rootA = scopeA ? rootOrder.get(scopeA.path[0].id) ?? 0 : 0;
    const rootB = scopeB ? rootOrder.get(scopeB.path[0].id) ?? 0 : 0;
    return rootA - rootB || (scopeA?.leafIndex ?? 0) - (scopeB?.leafIndex ?? 0);
  });

  for (const cell of cells) {
    const flatScope = flatScopeById.get(cell.scopeId);
    const scope = scopeById.get(cell.scopeId);
    const area = areaById.get(cell.areaId);
    const recipe = cell.recipeId ? recipeById.get(cell.recipeId) : undefined;

    if (!scope || !flatScope) {
      issues.push(
        buildIssue(
          "missingScope",
          "high",
          cell,
          `La celda ${cell.id} no tiene un alcance valido.`,
        ),
      );
      continue;
    }

    if (!area) {
      issues.push(
        buildIssue(
          "missingArea",
          "high",
          cell,
          `La celda ${scope.name} no tiene un area valida.`,
        ),
      );
      continue;
    }

    if (!cell.active) {
      issues.push(
        buildIssue(
          "inactiveCell",
          "medium",
          cell,
          `La celda ${scope.name} x ${area.name} esta inactiva.`,
        ),
      );
      continue;
    }

    if (!recipe) {
      issues.push(
        buildIssue(
          "missingRecipe",
          "high",
          cell,
          `La celda ${scope.name} x ${area.name} no tiene una receta valida.`,
        ),
      );
      continue;
    }

    let parentSummaryId: string | undefined;
    const scopeWbsParts: number[] = [];
    flatScope.path.forEach((scopeNode, depth) => {
      const siblingList =
        depth === 0
          ? plan.scopeTree
          : flatScope.path[depth - 1].children ?? [];
      const siblingIndex = siblingList.findIndex((item) => item.id === scopeNode.id);
      scopeWbsParts.push(siblingIndex + 1);

      const summaryId = `mx-scope-${sanitizeId(scopeNode.id)}`;
      addSummary(
        summaries,
        tasks,
        summaryId,
        scopeNode.name,
        depth + 1,
        scopeWbsParts.join("."),
        baseStart,
      );

      if (parentSummaryId) {
        addSummaryChild(summaries, parentSummaryId, summaryId);
      }
      parentSummaryId = summaryId;
    });

    const areaWbs = [...scopeWbsParts, 1].join(".");
    const areaSummaryId = `mx-area-${sanitizeId(cell.scopeId)}-${sanitizeId(area.id)}`;
    addSummary(
      summaries,
      tasks,
      areaSummaryId,
      area.name,
      flatScope.path.length + 1,
      areaWbs,
      baseStart,
    );
    if (parentSummaryId) {
      addSummaryChild(summaries, parentSummaryId, areaSummaryId);
    }

    const cellTaskIds: (string | number)[] = [];
    const activityTaskIds = new Map<string, string | number>();
    let cursor = getCellStart(baseStart, recipe, flatScope);

    recipe.activities.forEach((activity, index) => {
      const activityOverride = getActivityOverride(cell, activity.id);
      const quantity =
        activityOverride?.quantity ?? cell.quantity ?? activity.defaultQuantity;
      const productivity =
        activityOverride?.productivityPerDay ??
        cell.productivityOverridePerDay ??
        activity.productivityPerDay;

      if (quantity == null || quantity <= 0) {
        issues.push(
          buildIssue(
            "missingQuantity",
            "high",
            cell,
            `La actividad ${activity.name} no tiene cantidad para ${scope.name} x ${area.name}.`,
          ),
        );
        return;
      }

      if (productivity <= 0) {
        issues.push(
          buildIssue(
            "invalidProductivity",
            "high",
            cell,
            `La actividad ${activity.name} no tiene rendimiento valido.`,
          ),
        );
        return;
      }

      const duration = durationFrom(quantity, productivity);
      const finish = finishFromDuration(cursor, duration);
      const taskId = `mx-task-${sanitizeId(cell.id)}-${sanitizeId(activity.id)}`;
      const task: GanttTask = {
        id: taskId,
        name: buildTaskName(area, activity.name, scope),
        start: cursor,
        finish,
        duration,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: flatScope.path.length + 2,
        dependencies: [],
        wbs: [...scopeWbsParts, 1, index + 1].join("."),
        matrixSource: {
          matrixPlanId: plan.id,
          scopeId: scope.id,
          areaId: area.id,
          cellId: cell.id,
          recipeId: recipe.id,
          activityId: activity.id,
        },
        matrixSync: getMatrixSync(cell, activityOverride),
      };

      tasks.push(task);
      cellTaskIds.push(task.id);
      activityTaskIds.set(activity.id, task.id);
      addSummaryChild(summaries, areaSummaryId, task.id);
      cursor = nextWorkDay(finish);
    });

    for (const rule of recipe.dependencies) {
      const from = activityTaskIds.get(rule.predecessorActivityId);
      const to = activityTaskIds.get(rule.successorActivityId);
      if (!from || !to) continue;

      const dependency: GanttDependency = {
        from,
        to,
        type: rule.type,
        lag: rule.lagDays ?? 0,
      };
      dependencies.push(dependency);
      const successor = tasks.find((task) => task.id === to);
      if (successor) {
        successor.dependencies = [...successor.dependencies, dependency];
      }
    }

    if (cellTaskIds.length > 0) {
      provenance[cell.id] = cellTaskIds;
    }
  }

  recalculateSummaries(tasks, summaries);

  return {
    tasks: tasks.filter((task) => {
      if (!task.isSummary) return true;
      return (summaries.get(String(task.id))?.childIds.size ?? 0) > 0;
    }),
    dependencies,
    issues,
    provenance,
  };
}
