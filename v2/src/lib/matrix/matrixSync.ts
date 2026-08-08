import type { GanttTask } from "@/components/gantt/types";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";
import type {
  MatrixPlan,
  MatrixSyncConflict,
  MatrixCell,
  MatrixActivityOverride,
  ConflictResolution,
} from "@/types/matrix";

interface ApplyMatrixUpdateInput {
  tasks: GanttTask[];
  currentPlan: MatrixPlan;
  nextPlan: MatrixPlan;
  /**
   * Qué gana en cada conflicto, con la clave `${taskId}::${campo}`. Sin
   * elección gana la matriz, que es lo que hacía antes de que se pudiera
   * elegir.
   */
  resolutions?: Record<string, ConflictResolution>;
}

interface ApplyMatrixUpdateResult {
  tasks: GanttTask[];
  matrixPlan: MatrixPlan;
  conflicts: MatrixSyncConflict[];
}

function sourceKey(task: GanttTask): string | undefined {
  const source = task.matrixSource;
  if (!source) return undefined;
  return [
    source.matrixPlanId,
    source.scopeId,
    source.areaId,
    source.cellId,
    source.recipeId,
    source.activityId,
  ].join("::");
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isAfter(a?: string, b?: string): boolean {
  if (!a) return false;
  if (!b) return true;
  return new Date(a).getTime() > new Date(b).getTime();
}

function buildPreviousExpectedMap(plan: MatrixPlan): Map<string, GanttTask> {
  const expected = generateScheduleFromMatrix(plan);
  return new Map(
    expected.tasks
      .map((task) => [sourceKey(task), task] as const)
      .filter((entry): entry is [string, GanttTask] => entry[0] != null),
  );
}

function mergeGeneratedTask(
  generated: GanttTask,
  previousBySource: Map<string, GanttTask>,
): GanttTask {
  const key = sourceKey(generated);
  const previous = key ? previousBySource.get(key) : undefined;
  if (!previous) return generated;

  if (
    previous.matrixSync?.lastEditedFrom === "gantt" &&
    isAfter(previous.matrixSync.lastEditedAt, generated.matrixSync?.lastEditedAt)
  ) {
    return {
      ...generated,
      name: previous.name,
      start: previous.start,
      finish: previous.finish,
      duration: previous.duration,
      progress: previous.progress,
      percentComplete: previous.percentComplete,
      actualCost: previous.actualCost,
      cost: previous.cost,
      resourceNames: previous.resourceNames,
      baselineStart: previous.baselineStart,
      baselineFinish: previous.baselineFinish,
      baselineDuration: previous.baselineDuration,
      manualStart: previous.manualStart,
      constraintType: previous.constraintType,
      constraintDate: previous.constraintDate,
      deadline: previous.deadline,
      matrixSync: previous.matrixSync,
    };
  }

  return {
    ...generated,
    progress: previous.progress,
    percentComplete: previous.percentComplete,
    actualCost: previous.actualCost,
    cost: previous.cost,
    resourceNames: previous.resourceNames,
    baselineStart: previous.baselineStart,
    baselineFinish: previous.baselineFinish,
    baselineDuration: previous.baselineDuration,
    constraintType: previous.constraintType,
    constraintDate: previous.constraintDate,
    deadline: previous.deadline,
  };
}

function detectConflicts(
  currentTasks: GanttTask[],
  currentPlan: MatrixPlan,
): MatrixSyncConflict[] {
  const expectedBySource = buildPreviousExpectedMap(currentPlan);
  const conflicts: MatrixSyncConflict[] = [];

  for (const task of currentTasks) {
    const key = sourceKey(task);
    const source = task.matrixSource;
    if (!key || !source) continue;

    const expected = expectedBySource.get(key);
    if (!expected) continue;

    if (task.name !== expected.name) {
      conflicts.push({
        taskId: task.id,
        cellId: source.cellId,
        field: "name",
        matrixValue: expected.name,
        ganttValue: task.name,
        message: `«${expected.name}» se renombró a «${task.name}» desde el Gantt.`,
      });
    }

    if (task.duration !== expected.duration) {
      conflicts.push({
        taskId: task.id,
        cellId: source.cellId,
        field: "duration",
        matrixValue: String(expected.duration),
        ganttValue: String(task.duration),
        message: `La duración pasó de ${expected.duration} a ${task.duration} días desde el Gantt.`,
      });
    }

    if (dateKey(task.start) !== dateKey(expected.start)) {
      conflicts.push({
        taskId: task.id,
        cellId: source.cellId,
        field: "start",
        matrixValue: dateKey(expected.start),
        ganttValue: dateKey(task.start),
        message: `El inicio pasó del ${dateKey(expected.start)} al ${dateKey(task.start)} desde el Gantt.`,
      });
    }

    if (dateKey(task.finish) !== dateKey(expected.finish)) {
      conflicts.push({
        taskId: task.id,
        cellId: source.cellId,
        field: "finish",
        matrixValue: dateKey(expected.finish),
        ganttValue: dateKey(task.finish),
        message: `El fin pasó del ${dateKey(expected.finish)} al ${dateKey(task.finish)} desde el Gantt.`,
      });
    }
  }

  return conflicts;
}

function attachGeneratedTaskIds(
  plan: MatrixPlan,
  provenance: Record<string, (string | number)[]>,
): MatrixPlan {
  return {
    ...plan,
    cells: plan.cells.map((cell) => ({
      ...cell,
      generatedTaskIds: provenance[cell.id] ?? [],
      syncedTaskIds: provenance[cell.id] ?? [],
    })),
  };
}

export function applyMatrixUpdate({
  tasks,
  currentPlan,
  nextPlan,
  resolutions = {},
}: ApplyMatrixUpdateInput): ApplyMatrixUpdateResult {
  const previousBySource = new Map(
    tasks
      .map((task) => [sourceKey(task), task] as const)
      .filter((entry): entry is [string, GanttTask] => entry[0] != null),
  );
  const generated = generateScheduleFromMatrix(nextPlan);
  const conflicts = detectConflicts(tasks, currentPlan);
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const mergedGenerated = generated.tasks.map((task) => {
    const merged = mergeGeneratedTask(task, previousBySource);
    let result = merged;

    // El inicio, el fin y la duración de una tarea describen una sola cosa:
    // su horario. Si el usuario elige «gantt» para cualquiera de los tres,
    // se toman los tres del Gantt juntos; mezclarlos entre dos fuentes
    // produciría una tarea que dice dos cosas distintas sobre sí misma.
    const scheduleFromGantt = (["duration", "start", "finish"] as const).some(
      (field) => resolutions[`${merged.id}::${field}`] === "gantt",
    );
    if (scheduleFromGantt) {
      const fromGantt = taskById.get(merged.id);
      if (fromGantt) {
        result = {
          ...result,
          start: fromGantt.start,
          finish: fromGantt.finish,
          duration: fromGantt.duration,
        };
      }
    }

    // `name` es independiente del horario.
    if (resolutions[`${merged.id}::name`] === "gantt") {
      const fromGantt = taskById.get(merged.id);
      if (fromGantt) result = { ...result, name: fromGantt.name };
    }

    return result;
  });

  const generatedIds = new Set(mergedGenerated.map((task) => task.id));
  const nonMatrixTasks = tasks.filter(
    (task) => !task.matrixSource && !generatedIds.has(task.id),
  );

  return {
    tasks: [...mergedGenerated, ...nonMatrixTasks],
    matrixPlan: attachGeneratedTaskIds(nextPlan, generated.provenance),
    conflicts,
  };
}

function updateCellFeedback(
  cell: MatrixCell,
  observedDurationDays: number,
): MatrixCell {
  if (!cell.quantity || observedDurationDays <= 0) return cell;

  return {
    ...cell,
    feedback: {
      source: "gantt",
      observedDurationDays,
      suggestedProductivityPerDay: cell.quantity / observedDurationDays,
      status: "pendingApproval",
    },
  };
}

function findActivityOverride(
  cell: MatrixCell,
  activityId: string,
): MatrixActivityOverride | undefined {
  return cell.activityOverrides?.find(
    (override) => override.activityId === activityId,
  );
}

function upsertActivityOverride(
  cell: MatrixCell,
  task: GanttTask,
): MatrixCell {
  const source = task.matrixSource;
  const sync = task.matrixSync;
  if (!source || !sync || sync.lastEditedFrom !== "gantt") return cell;

  const existing = findActivityOverride(cell, source.activityId);
  const currentTimestamp = existing?.lastEditedAt ?? cell.lastEditedAt;
  if (!isAfter(sync.lastEditedAt, currentTimestamp)) return cell;

  const quantity = existing?.quantity ?? cell.quantity;
  if (!quantity || task.duration <= 0) return cell;

  const nextOverride: MatrixActivityOverride = {
    activityId: source.activityId,
    name: task.name,
    quantity,
    unit: existing?.unit ?? cell.unit,
    productivityPerDay: quantity / task.duration,
    sourceTaskId: task.id,
    start: task.start.toISOString(),
    finish: task.finish.toISOString(),
    duration: task.duration,
    progress: task.progress,
    percentComplete: task.percentComplete,
    resourceNames: task.resourceNames,
    cost: task.cost,
    actualCost: task.actualCost,
    lastEditedAt: sync.lastEditedAt,
    lastEditedFrom: "gantt",
  };

  const overrides = cell.activityOverrides ?? [];
  const nextOverrides = existing
    ? overrides.map((override) =>
        override.activityId === source.activityId ? nextOverride : override,
      )
    : [...overrides, nextOverride];

  return {
    ...cell,
    activityOverrides: nextOverrides,
    lastEditedAt: sync.lastEditedAt,
    lastEditedFrom: "gantt",
    feedback: undefined,
  };
}

export function syncMatrixPlanFromTasks(
  plan: MatrixPlan,
  tasks: GanttTask[],
): MatrixPlan {
  const durationsByCell = new Map<string, number[]>();
  const taskIdsByCell = new Map<string, (string | number)[]>();
  const ganttEditedTasksByCell = new Map<string, GanttTask[]>();

  for (const task of tasks) {
    const source = task.matrixSource;
    if (!source || source.matrixPlanId !== plan.id || task.isSummary) continue;

    const durations = durationsByCell.get(source.cellId) ?? [];
    durations.push(task.duration);
    durationsByCell.set(source.cellId, durations);

    const taskIds = taskIdsByCell.get(source.cellId) ?? [];
    taskIds.push(task.id);
    taskIdsByCell.set(source.cellId, taskIds);

    if (task.matrixSync?.lastEditedFrom === "gantt") {
      const edited = ganttEditedTasksByCell.get(source.cellId) ?? [];
      edited.push(task);
      ganttEditedTasksByCell.set(source.cellId, edited);
    }
  }

  return {
    ...plan,
    cells: plan.cells.map((cell) => {
      const durations = durationsByCell.get(cell.id) ?? [];
      const generatedTaskIds = taskIdsByCell.get(cell.id) ?? cell.generatedTaskIds;
      const editedTasks = ganttEditedTasksByCell.get(cell.id) ?? [];
      const initialSyncedCell: MatrixCell = {
        ...cell,
        generatedTaskIds,
        syncedTaskIds: generatedTaskIds,
      };
      const autoSyncedCell = editedTasks.reduce<MatrixCell>(
        (nextCell, task) => upsertActivityOverride(nextCell, task),
        initialSyncedCell,
      );

      if (editedTasks.length > 0) {
        return autoSyncedCell;
      }

      if (durations.length === 0) {
        return { ...cell, generatedTaskIds, syncedTaskIds: generatedTaskIds };
      }

      const observedDurationDays = Math.max(...durations);
      return updateCellFeedback(
        { ...cell, generatedTaskIds, syncedTaskIds: generatedTaskIds },
        observedDurationDays,
      );
    }),
  };
}
