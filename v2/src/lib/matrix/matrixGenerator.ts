import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";
import {
  matrixFinishFromDuration,
  matrixNextWorkDay,
} from "./matrixCalendar";
import { resolveChaining } from "./matrixChaining";
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

export interface MatrixGenerationOptions {
  /**
   * Calendario del proyecto. Sin él, la matriz trabaja todos los días menos
   * el domingo, que es lo que hacía antes de que existiera esta opción.
   */
  calendar?: ProjectCalendar;
}

interface FlatScope {
  node: ScopeNode;
  path: ScopeNode[];
  leafIndex: number;
}

interface FlatArea {
  node: AreaNode;
  path: AreaNode[];
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

function createDateFromUnknown(value: string | undefined, fallback: Date): Date {
  if (!value) return new Date(fallback);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(fallback);
  return date;
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
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

function flattenAreas(nodes: AreaNode[]): FlatArea[] {
  const result: FlatArea[] = [];

  function visit(node: AreaNode, path: AreaNode[]) {
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

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildTaskName(scope: ScopeNode, activityName: string, area: AreaNode) {
  return `${scope.name} - ${activityName} - ${area.name}`;
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

function withMppRowIds(tasks: GanttTask[]): GanttTask[] {
  return tasks.map((task, index) => {
    const rowId = index + 1;
    return {
      ...task,
      mppFields: {
        ...(task.mppFields ?? {}),
        ID: rowId,
        UNIQUE_ID: rowId,
        UID: rowId,
      },
    };
  });
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
  flatArea: FlatArea,
): Date {
  if (!recipe.lineOfBalance) return baseStart;
  const matchingScope = flatScope.path.find(
    (scope) => scope.type === recipe.lineOfBalance?.scopeType,
  );
  const matchingArea = flatArea.path.find(
    (area) => area.type === recipe.lineOfBalance?.scopeType,
  );
  if (!matchingScope && !matchingArea) return baseStart;

  return addCalendarDays(
    baseStart,
    (matchingArea ? flatArea.leafIndex : flatScope.leafIndex) *
      recipe.lineOfBalance.offsetDays,
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
  options: MatrixGenerationOptions = {},
): MatrixGenerationResult {
  const { calendar } = options;
  const baseStart = createDate(plan.startDate);
  const scopeById = indexScopes(plan.scopeTree);
  const areaById = indexAreas(plan.areas);
  const recipeById = new Map(plan.recipes.map((recipe) => [recipe.id, recipe]));
  const flatScopeById = new Map(
    flattenScopes(plan.scopeTree).map((scope) => [scope.node.id, scope]),
  );
  const flatAreaById = new Map(
    flattenAreas(plan.areas).map((area) => [area.node.id, area]),
  );

  const tasks: GanttTask[] = [];
  const dependencies: GanttDependency[] = [];
  const issues: MatrixIssue[] = [];
  const provenance: Record<string, (string | number)[]> = {};
  const summaries = new Map<string, SummaryDraft>();
  /** Por alcance: qué tarea materializa cada actividad en cada ubicación. */
  const chainRegistry = new Map<
    string,
    Array<{
      areaIndex: number;
      recipe: ActivityRecipe;
      activityTaskIds: Map<string, string | number>;
    }>
  >();

  const rootOrder = new Map(plan.scopeTree.map((scope, index) => [scope.id, index]));
  const areaRootOrder = new Map(plan.areas.map((area, index) => [area.id, index]));
  const cells = [...plan.cells].sort((a, b) => {
    const scopeA = flatScopeById.get(a.scopeId);
    const scopeB = flatScopeById.get(b.scopeId);
    const areaA = flatAreaById.get(a.areaId);
    const areaB = flatAreaById.get(b.areaId);
    const rootA = scopeA ? rootOrder.get(scopeA.path[0].id) ?? 0 : 0;
    const rootB = scopeB ? rootOrder.get(scopeB.path[0].id) ?? 0 : 0;
    const areaRootA = areaA ? areaRootOrder.get(areaA.path[0].id) ?? 0 : 0;
    const areaRootB = areaB ? areaRootOrder.get(areaB.path[0].id) ?? 0 : 0;
    return (
      rootA - rootB ||
      (scopeA?.leafIndex ?? 0) - (scopeB?.leafIndex ?? 0) ||
      areaRootA - areaRootB ||
      (areaA?.leafIndex ?? 0) - (areaB?.leafIndex ?? 0)
    );
  });

  for (const cell of cells) {
    const flatScope = flatScopeById.get(cell.scopeId);
    const flatArea = flatAreaById.get(cell.areaId);
    const scope = scopeById.get(cell.scopeId);
    const area = areaById.get(cell.areaId);
    const recipeId = cell.recipeId ?? scope?.defaultRecipeId;
    const recipe = recipeId ? recipeById.get(recipeId) : undefined;

    if (!scope) {
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

    if (!flatScope) {
      continue;
    }

    if (!area) {
      issues.push(
        buildIssue(
          "missingArea",
          "high",
          cell,
          `La celda ${scope.name} no tiene una ubicación válida.`,
        ),
      );
      continue;
    }

    if (!flatArea) {
      continue;
    }

    if (!cell.active) {
      issues.push(
        buildIssue(
          "inactiveCell",
          "medium",
          cell,
          `La celda ${scope.name} × ${area.name} esta inactiva.`,
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
          `La celda ${scope.name} × ${area.name} no tiene una receta valida.`,
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

    const areaWbsParts: number[] = [];
    let areaSummaryId = parentSummaryId;
    flatArea.path.forEach((areaNode, depth) => {
      const siblingList =
        depth === 0
          ? plan.areas
          : flatArea.path[depth - 1].children ?? [];
      const siblingIndex = siblingList.findIndex((item) => item.id === areaNode.id);
      areaWbsParts.push(siblingIndex + 1);

      const summaryId = `mx-area-${sanitizeId(cell.scopeId)}-${sanitizeId(areaNode.id)}`;
      addSummary(
        summaries,
        tasks,
        summaryId,
        areaNode.name,
        flatScope.path.length + depth + 1,
        [...scopeWbsParts, ...areaWbsParts].join("."),
        baseStart,
      );

      if (areaSummaryId) {
        addSummaryChild(summaries, areaSummaryId, summaryId);
      }
      areaSummaryId = summaryId;
    });

    const cellTaskIds: (string | number)[] = [];
    const activityTaskIds = new Map<string, string | number>();
    let cursor = getCellStart(baseStart, recipe, flatScope, flatArea);

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
            `La actividad ${activity.name} no tiene cantidad para ${scope.name} × ${area.name}.`,
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

      const duration =
        activityOverride?.duration ?? durationFrom(quantity, productivity);
      const start = createDateFromUnknown(activityOverride?.start, cursor);
      const finish = createDateFromUnknown(
        activityOverride?.finish,
        matrixFinishFromDuration(start, duration, calendar),
      );
      const taskId =
        activityOverride?.sourceTaskId ??
        `mx-task-${sanitizeId(cell.id)}-${sanitizeId(activity.id)}`;
      const task: GanttTask = {
        id: taskId,
        name: activityOverride?.name ?? buildTaskName(scope, activity.name, area),
        start,
        finish,
        duration,
        progress: activityOverride?.progress ?? 0,
        percentComplete: activityOverride?.percentComplete,
        resourceNames: activityOverride?.resourceNames,
        cost: activityOverride?.cost,
        actualCost: activityOverride?.actualCost,
        isCritical: activityOverride?.isCritical ?? false,
        isMilestone: activityOverride?.isMilestone ?? false,
        isSummary: false,
        outlineLevel: flatScope.path.length + flatArea.path.length + 1,
        dependencies: [],
        wbs: [...scopeWbsParts, ...areaWbsParts, index + 1].join("."),
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
      if (areaSummaryId) {
        addSummaryChild(summaries, areaSummaryId, task.id);
      }
      cursor = matrixNextWorkDay(finish, 0, calendar);
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

    const chainKey = cell.scopeId;
    const chainEntries = chainRegistry.get(chainKey) ?? [];
    chainEntries.push({ areaIndex: flatArea.leafIndex, recipe, activityTaskIds });
    chainRegistry.set(chainKey, chainEntries);

    if (cellTaskIds.length > 0) {
      provenance[cell.id] = cellTaskIds;
    }
  }

  // Ritmo piso a piso: la cuadrilla que termina una actividad en una
  // ubicación empieza la misma en la siguiente. Es una dependencia de verdad,
  // así que un atraso en el piso 1 mueve el piso 2.
  for (const [scopeId, entries] of chainRegistry) {
    const scope = scopeById.get(scopeId);
    const chaining = resolveChaining(scope, entries[0]?.recipe);
    if (chaining.mode !== "encadenado" || entries.length < 2) continue;

    const ordered = [...entries].sort((a, b) =>
      chaining.reverse ? b.areaIndex - a.areaIndex : a.areaIndex - b.areaIndex,
    );

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];

      for (const [activityId, toId] of current.activityTaskIds) {
        if (chaining.activityId && chaining.activityId !== activityId) continue;
        const fromId = previous.activityTaskIds.get(activityId);
        if (!fromId) continue;

        const dependency: GanttDependency = {
          from: fromId,
          to: toId,
          type: "FS",
          lag: chaining.lagDays ?? 0,
        };
        dependencies.push(dependency);

        const successor = tasks.find((task) => task.id === toId);
        if (successor) {
          successor.dependencies = [...successor.dependencies, dependency];
        }
      }
    }
  }

  recalculateSummaries(tasks, summaries);

  const knownTaskIds = new Set(tasks.map((task) => task.id));
  for (const dependency of plan.ganttDependencies ?? []) {
    if (!knownTaskIds.has(dependency.from) || !knownTaskIds.has(dependency.to)) {
      continue;
    }

    dependencies.push(dependency);
    const successor = tasks.find((task) => task.id === dependency.to);
    if (successor) {
      const alreadyLinked = successor.dependencies.some(
        (item) =>
          item.from === dependency.from &&
          item.to === dependency.to &&
          item.type === dependency.type &&
          (item.lag ?? 0) === (dependency.lag ?? 0) &&
          (item.lagUnit ?? "days") === (dependency.lagUnit ?? "days"),
      );
      if (!alreadyLinked) {
        successor.dependencies = [...successor.dependencies, dependency];
      }
    }
  }

  const visibleTasks = tasks.filter((task) => {
    if (!task.isSummary) return true;
    return (summaries.get(String(task.id))?.childIds.size ?? 0) > 0;
  });

  return {
    tasks: withMppRowIds(visibleTasks),
    dependencies,
    issues,
    provenance,
  };
}
