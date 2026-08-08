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

/**
 * Deja en la celda el rendimiento que salió de obra, a la espera de visto bueno.
 *
 * La cantidad puede estar en la celda o en el override de la actividad: si
 * solo se mirara `cell.quantity`, una celda con cantidades por actividad
 * —que es lo normal— nunca produciría rendimiento observado.
 *
 * Lo que el usuario ya descartó no se reabre. «Mantener lo planificado» tiene
 * que aguantar: la tarea sigue editada en el Gantt y su duración sigue
 * difiriendo de la calculada, así que sin esta guarda el mismo rendimiento
 * reaparecía como pendiente en la siguiente sincronización y el botón no
 * cumplía lo que promete. Si la obra vuelve a editar la tarea con **otra**
 * duración, eso sí es una observación nueva y vuelve a preguntarse.
 */
function updateCellFeedback(
  cell: MatrixCell,
  observedDurationDays: number,
): MatrixCell {
  if (
    cell.feedback?.status === "dismissed" &&
    cell.feedback.observedDurationDays === observedDurationDays
  ) {
    return cell;
  }

  const quantity =
    cell.quantity ??
    cell.activityOverrides?.find((override) => override.quantity > 0)?.quantity;
  if (!quantity || observedDurationDays <= 0) return cell;

  return {
    ...cell,
    feedback: {
      source: "gantt",
      observedDurationDays,
      suggestedProductivityPerDay: quantity / observedDurationDays,
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
  };
}

/**
 * Recoge el rendimiento que salió de obra y sincroniza las celdas.
 *
 * El rendimiento observado **nace de la edición manual en el Gantt**: si el
 * jefe de obra alarga «Mampostería Piso 1» de 4 a 6 días, esos 6 días son el
 * dato real y hay que proponerlos. Antes se hacía al revés —la edición del
 * Gantt cancelaba el feedback y las celdas intactas lo generaban con la
 * duración que la propia matriz había calculado—, así que el panel ofrecía
 * aprobar como real un dato planificado.
 */
export function syncMatrixPlanFromTasks(
  plan: MatrixPlan,
  tasks: GanttTask[],
): MatrixPlan {
  const taskIdsByCell = new Map<string, (string | number)[]>();
  const ganttEditedTasksByCell = new Map<string, GanttTask[]>();
  /** Lo que la matriz había calculado, para saber si la obra se desvió. */
  const expectedBySource = buildPreviousExpectedMap(plan);
  const observedDurationByCell = new Map<string, number>();

  for (const task of tasks) {
    const source = task.matrixSource;
    if (!source || source.matrixPlanId !== plan.id || task.isSummary) continue;

    const taskIds = taskIdsByCell.get(source.cellId) ?? [];
    taskIds.push(task.id);
    taskIdsByCell.set(source.cellId, taskIds);

    if (task.matrixSync?.lastEditedFrom !== "gantt") continue;

    const edited = ganttEditedTasksByCell.get(source.cellId) ?? [];
    edited.push(task);
    ganttEditedTasksByCell.set(source.cellId, edited);

    const key = sourceKey(task);
    const expected = key ? expectedBySource.get(key) : undefined;
    if (expected && expected.duration === task.duration) continue;

    observedDurationByCell.set(
      source.cellId,
      Math.max(observedDurationByCell.get(source.cellId) ?? 0, task.duration),
    );
  }

  return {
    ...plan,
    cells: plan.cells.map((cell) => {
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

      const observedDurationDays = observedDurationByCell.get(cell.id);
      if (observedDurationDays === undefined) return autoSyncedCell;

      return updateCellFeedback(autoSyncedCell, observedDurationDays);
    }),
  };
}
