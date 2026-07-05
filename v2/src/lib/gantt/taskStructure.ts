import type { GanttTask } from "@/components/gantt/types";

export type InsertTaskKind = "summary" | "task" | "milestone";
export type ReorderTaskPosition = "before" | "after" | "child";

export interface InsertTaskOptions {
  afterTaskId?: string | number;
  parentTaskId?: string | number;
  kind?: InsertTaskKind;
  name?: string;
  start?: Date;
  duration?: number;
}

function clampLevel(level: number): number {
  return Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
}

function sameId(a: string | number, b: string | number): boolean {
  return a === b;
}

function getSubtreeEndIndex(tasks: GanttTask[], startIndex: number): number {
  const rootLevel = tasks[startIndex]?.outlineLevel ?? 1;
  let end = startIndex + 1;
  while (end < tasks.length && tasks[end].outlineLevel > rootLevel) {
    end += 1;
  }
  return end;
}

function findTaskIndex(tasks: GanttTask[], taskId: string | number): number {
  return tasks.findIndex((task) => sameId(task.id, taskId));
}

function previousSiblingIndex(tasks: GanttTask[], index: number): number {
  const level = tasks[index]?.outlineLevel ?? 1;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (tasks[i].outlineLevel < level) return -1;
    if (tasks[i].outlineLevel === level) return i;
  }
  return -1;
}

function nextSiblingIndex(tasks: GanttTask[], index: number): number {
  const level = tasks[index]?.outlineLevel ?? 1;
  const subtreeEnd = getSubtreeEndIndex(tasks, index);
  for (let i = subtreeEnd; i < tasks.length; i += 1) {
    if (tasks[i].outlineLevel < level) return -1;
    if (tasks[i].outlineLevel === level) return i;
  }
  return -1;
}

function dateOnlyDurationDays(start: Date, finish: Date): number {
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const finishTime = new Date(finish).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((finishTime - startTime) / 86400000) + 1);
}

function progressValue(task: GanttTask): number {
  return task.percentComplete ?? task.progress ?? 0;
}

function nextTaskId(tasks: GanttTask[]): number {
  const numericMax = tasks.reduce((max, task) => {
    const value = typeof task.id === "number" ? task.id : Number(task.id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return numericMax + 1;
}

function createTask(tasks: GanttTask[], level: number, options: InsertTaskOptions): GanttTask {
  const start = options.start ? new Date(options.start) : new Date();
  start.setHours(0, 0, 0, 0);
  const duration = options.kind === "milestone" ? 0 : Math.max(1, options.duration ?? 1);
  const finish = new Date(start);
  finish.setDate(finish.getDate() + Math.max(0, duration - 1));

  return {
    id: nextTaskId(tasks),
    name:
      options.name ??
      (options.kind === "summary"
        ? "Nuevo capitulo"
        : options.kind === "milestone"
          ? "Nuevo hito"
          : "Nueva tarea"),
    start,
    finish,
    duration,
    progress: 0,
    isCritical: false,
    isMilestone: options.kind === "milestone",
    isSummary: options.kind === "summary",
    outlineLevel: level,
    dependencies: [],
  };
}

export function normalizeTaskStructure(tasks: GanttTask[]): GanttTask[] {
  const leveled = tasks.map((task, index) => {
    const previousLevel = index === 0 ? 1 : tasks[index - 1].outlineLevel;
    const maxLevel = index === 0 ? 1 : clampLevel(previousLevel) + 1;
    return {
      ...task,
      outlineLevel: Math.min(clampLevel(task.outlineLevel), maxLevel),
    };
  });

  const counters: number[] = [];
  const normalized = leveled.map((task, index) => {
    const level = task.outlineLevel;
    counters.length = level;
    counters[level - 1] = (counters[level - 1] ?? 0) + 1;
    for (let i = 0; i < level - 1; i += 1) {
      counters[i] = counters[i] ?? 1;
    }

    const next = leveled[index + 1];
    return {
      ...task,
      wbs: counters.slice(0, level).join("."),
      isSummary: Boolean(next && next.outlineLevel > level),
    };
  });

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const task = normalized[index];
    if (!task.isSummary) continue;

    const end = getSubtreeEndIndex(normalized, index);
    const descendants = normalized.slice(index + 1, end);
    if (descendants.length === 0) continue;

    const start = new Date(Math.min(...descendants.map((item) => item.start.getTime())));
    const finish = new Date(Math.max(...descendants.map((item) => item.finish.getTime())));
    const duration = dateOnlyDurationDays(start, finish);
    const totalWeight = descendants.reduce((sum, item) => sum + Math.max(1, item.duration), 0);
    const progress = totalWeight === 0
      ? 0
      : descendants.reduce(
          (sum, item) => sum + progressValue(item) * Math.max(1, item.duration),
          0,
        ) / totalWeight;

    normalized[index] = {
      ...task,
      start,
      finish,
      duration,
      progress,
      percentComplete: task.percentComplete === undefined ? undefined : progress,
    };
  }

  return normalized;
}

export function indentTask(tasks: GanttTask[], taskId: string | number): GanttTask[] {
  const index = findTaskIndex(tasks, taskId);
  if (index <= 0) return tasks;

  const prevSibling = previousSiblingIndex(tasks, index);
  if (prevSibling < 0) return tasks;

  const end = getSubtreeEndIndex(tasks, index);
  const next = tasks.map((task, taskIndex) =>
    taskIndex >= index && taskIndex < end
      ? { ...task, outlineLevel: task.outlineLevel + 1 }
      : task,
  );
  return normalizeTaskStructure(next);
}

export function outdentTask(tasks: GanttTask[], taskId: string | number): GanttTask[] {
  const index = findTaskIndex(tasks, taskId);
  if (index < 0 || tasks[index].outlineLevel <= 1) return tasks;

  const end = getSubtreeEndIndex(tasks, index);
  const next = tasks.map((task, taskIndex) =>
    taskIndex >= index && taskIndex < end
      ? { ...task, outlineLevel: Math.max(1, task.outlineLevel - 1) }
      : task,
  );
  return normalizeTaskStructure(next);
}

export function moveTaskUp(tasks: GanttTask[], taskId: string | number): GanttTask[] {
  const index = findTaskIndex(tasks, taskId);
  if (index <= 0) return tasks;

  const siblingIndex = previousSiblingIndex(tasks, index);
  if (siblingIndex < 0) return tasks;

  const moving = tasks.slice(index, getSubtreeEndIndex(tasks, index));
  const before = tasks.slice(0, siblingIndex);
  const sibling = tasks.slice(siblingIndex, index);
  const after = tasks.slice(index + moving.length);
  return normalizeTaskStructure([...before, ...moving, ...sibling, ...after]);
}

export function moveTaskDown(tasks: GanttTask[], taskId: string | number): GanttTask[] {
  const index = findTaskIndex(tasks, taskId);
  if (index < 0) return tasks;

  const siblingIndex = nextSiblingIndex(tasks, index);
  if (siblingIndex < 0) return tasks;

  const moving = tasks.slice(index, getSubtreeEndIndex(tasks, index));
  const sibling = tasks.slice(siblingIndex, getSubtreeEndIndex(tasks, siblingIndex));
  const before = tasks.slice(0, index);
  const between = tasks.slice(index + moving.length, siblingIndex);
  const after = tasks.slice(siblingIndex + sibling.length);
  return normalizeTaskStructure([...before, ...between, ...sibling, ...moving, ...after]);
}

export function reorderTask(
  tasks: GanttTask[],
  taskId: string | number,
  targetTaskId: string | number,
  position: ReorderTaskPosition,
): GanttTask[] {
  const movingIndex = findTaskIndex(tasks, taskId);
  const targetIndex = findTaskIndex(tasks, targetTaskId);
  if (movingIndex < 0 || targetIndex < 0 || sameId(taskId, targetTaskId)) return tasks;

  const movingEnd = getSubtreeEndIndex(tasks, movingIndex);
  if (targetIndex >= movingIndex && targetIndex < movingEnd) return tasks;

  const moving = tasks.slice(movingIndex, movingEnd);
  const remaining = [
    ...tasks.slice(0, movingIndex),
    ...tasks.slice(movingEnd),
  ];
  const targetIndexInRemaining = targetIndex > movingIndex
    ? targetIndex - moving.length
    : targetIndex;
  const target = remaining[targetIndexInRemaining];
  if (!target) return tasks;

  const destinationLevel = position === "child"
    ? target.outlineLevel + 1
    : target.outlineLevel;
  const levelDelta = destinationLevel - moving[0].outlineLevel;
  const adjustedMoving = moving.map((task) => ({
    ...task,
    outlineLevel: Math.max(1, task.outlineLevel + levelDelta),
  }));
  const insertIndex = position === "before"
    ? targetIndexInRemaining
    : getSubtreeEndIndex(remaining, targetIndexInRemaining);

  return normalizeTaskStructure([
    ...remaining.slice(0, insertIndex),
    ...adjustedMoving,
    ...remaining.slice(insertIndex),
  ]);
}

export function insertTask(tasks: GanttTask[], options: InsertTaskOptions = {}): GanttTask[] {
  let insertIndex = tasks.length;
  let level = 1;

  if (options.parentTaskId !== undefined) {
    const parentIndex = findTaskIndex(tasks, options.parentTaskId);
    if (parentIndex >= 0) {
      insertIndex = getSubtreeEndIndex(tasks, parentIndex);
      level = tasks[parentIndex].outlineLevel + 1;
    }
  } else if (options.afterTaskId !== undefined) {
    const afterIndex = findTaskIndex(tasks, options.afterTaskId);
    if (afterIndex >= 0) {
      insertIndex = getSubtreeEndIndex(tasks, afterIndex);
      level = tasks[afterIndex].outlineLevel;
    }
  }

  const task = createTask(tasks, level, options);
  return normalizeTaskStructure([
    ...tasks.slice(0, insertIndex),
    task,
    ...tasks.slice(insertIndex),
  ]);
}
