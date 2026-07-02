import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";
import { CPMCalculatorService } from "./cpm";
import {
  createSchedulingCalendar,
  getCalendarMinutesPerDay,
  normalizeProjectCalendar,
  validateProjectCalendar,
} from "./projectCalendar";
import {
  DependencyType,
  type Dependency,
  type ScheduleIssue,
  type Task,
} from "./types";

export interface RecalculateScheduleOptions {
  projectStart?: Date;
  calendar?: ProjectCalendar;
}

export interface RecalculateScheduleResult {
  tasks: GanttTask[];
  issues: ScheduleIssue[];
}

function dependencyKey(dep: GanttDependency): string {
  return `${dep.from}->${dep.to}:${dep.type}:${dep.lag ?? 0}`;
}

function fieldValue(record: Record<string, unknown> | undefined, fieldId: string): unknown {
  if (!record) return undefined;
  const normalized = fieldId.replace(/[^a-z0-9]/gi, "").toLowerCase();
  for (const [key, value] of Object.entries(record)) {
    if (key.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalized) return value;
  }
  return undefined;
}

function booleanField(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1", "si", "sí"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function isActiveTask(task: GanttTask): boolean {
  const inactive = fieldValue(task.mppFields, "INACTIVE");
  if (inactive !== undefined && booleanField(inactive, false)) return false;
  const active = fieldValue(task.mppFields, "ACTIVE");
  return active === undefined ? true : booleanField(active, true);
}

function collectDependencies(tasks: GanttTask[]): GanttDependency[] {
  const seen = new Set<string>();
  const result: GanttDependency[] = [];

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      const normalized: GanttDependency = {
        ...dep,
        to: dep.to ?? task.id,
      };
      const key = dependencyKey(normalized);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(normalized);
    }
  }

  return result;
}

function dependenciesBySuccessor(
  dependencies: GanttDependency[],
): Map<string | number, GanttDependency[]> {
  const grouped = new Map<string | number, GanttDependency[]>();
  for (const dep of dependencies) {
    const existing = grouped.get(dep.to) ?? [];
    existing.push(dep);
    grouped.set(dep.to, existing);
  }
  return grouped;
}

export function normalizeDependencies(tasks: GanttTask[]): GanttTask[] {
  const activeTaskIds = new Set(tasks.filter(isActiveTask).map((task) => task.id));
  const deps = collectDependencies(tasks).filter(
    (dep) => activeTaskIds.has(dep.from) && activeTaskIds.has(dep.to),
  );
  const depsBySuccessor = dependenciesBySuccessor(deps);

  return tasks.map((task) => ({
    ...task,
    dependencies: isActiveTask(task) ? depsBySuccessor.get(task.id) ?? [] : [],
  }));
}

export function validateDependencies(
  tasks: GanttTask[],
  dependencies: GanttDependency[] = collectDependencies(tasks),
): ScheduleIssue[] {
  const activeTaskIds = new Set(tasks.filter(isActiveTask).map((task) => task.id));
  const issues: ScheduleIssue[] = [];

  for (const dep of dependencies) {
    if (!activeTaskIds.has(dep.from) || !activeTaskIds.has(dep.to)) {
      issues.push({
        kind: "missingTask",
        severity: "high",
        taskIds: [dep.from, dep.to],
        message: `La dependencia ${dep.from} -> ${dep.to} referencia una tarea inexistente.`,
      });
    }

    if (dep.from === dep.to) {
      issues.push({
        kind: "selfDependency",
        severity: "high",
        taskIds: [dep.from],
        message: `La tarea ${dep.from} no puede depender de si misma.`,
      });
    }
  }

  const validDeps = dependencies.filter(
    (dep) => activeTaskIds.has(dep.from) && activeTaskIds.has(dep.to) && dep.from !== dep.to,
  );
  if (hasCycle(tasks, validDeps)) {
    issues.push({
      kind: "cycle",
      severity: "high",
      taskIds: [],
      message: "Las dependencias contienen un ciclo y no se pueden recalcular.",
    });
  }

  return issues;
}

export function rewriteSuccessors(
  tasks: GanttTask[],
  taskId: string | number,
  successors: GanttDependency[],
): GanttTask[] {
  const successorIds = new Set(successors.map((dep) => dep.to));

  return tasks.map((task) => {
    const withoutOldSuccessors = task.dependencies.filter(
      (dep) => dep.from !== taskId || successorIds.has(dep.to),
    );
    const additions = successors.filter((dep) => dep.to === task.id);

    return {
      ...task,
      dependencies: [...withoutOldSuccessors, ...additions],
    };
  });
}

export function recalculateSchedule(
  tasks: GanttTask[],
  options: RecalculateScheduleOptions = {},
): RecalculateScheduleResult {
  const calendar = normalizeProjectCalendar(options.calendar);
  const calendarIssues = validateProjectCalendar(calendar);
  if (calendarIssues.length > 0) {
    return {
      tasks,
      issues: calendarIssues.map((issue) => ({
        kind: issue.kind,
        severity: issue.severity,
        taskIds: [],
        message: issue.message,
      })),
    };
  }

  const canonicalTasks = normalizeDependencies(tasks);
  const dependencies = collectDependencies(canonicalTasks);
  const issues = validateDependencies(canonicalTasks, dependencies);
  if (issues.length > 0) {
    return { tasks: canonicalTasks, issues };
  }

  const projectStart =
    options.projectStart ?? getProjectStart(canonicalTasks) ?? new Date();
  const minutesPerDay = getCalendarMinutesPerDay(calendar);
  const calculator = new CPMCalculatorService(createSchedulingCalendar(calendar));
  const cpmTasks = calculator.calculate(
    canonicalTasks.map((task) => toSchedulingTask(task, minutesPerDay)),
    dependencies.map((dep) => toSchedulingDependency(dep, minutesPerDay)),
    projectStart,
  );
  const cpmById = new Map(cpmTasks.map((task) => [task.id, task]));

  return {
    issues: [],
    tasks: canonicalTasks.map((task) => {
      const cpm = cpmById.get(task.id);
      if (!cpm) return task;
      const scheduledStart =
        task.constraintType === "asLateAsPossible"
          ? cpm.lateStart ?? cpm.earlyStart
          : cpm.earlyStart;
      const scheduledFinish =
        task.constraintType === "asLateAsPossible"
          ? cpm.lateFinish ?? cpm.earlyFinish
          : cpm.earlyFinish;

      return {
        ...task,
        start: scheduledStart ?? task.start,
        finish: scheduledFinish ?? task.finish,
        earlyStart: cpm.earlyStart,
        earlyFinish: cpm.earlyFinish,
        lateStart: cpm.lateStart,
        lateFinish: cpm.lateFinish,
        totalFloat: cpm.totalFloat,
        isCritical: cpm.isCritical,
      };
    }),
  };
}

function toSchedulingTask(task: GanttTask, minutesPerDay: number): Task {
  return {
    id: task.id,
    name: task.name,
    durationMinutes: Math.max(0, Math.round(task.duration * minutesPerDay)),
    earlyStart: task.earlyStart ?? task.start,
    earlyFinish: task.earlyFinish ?? task.finish,
    lateStart: task.lateStart,
    lateFinish: task.lateFinish,
    totalFloat: task.totalFloat ?? 0,
    isCritical: task.isCritical,
    isMilestone: task.isMilestone,
    isSummary: task.isSummary,
    outlineLevel: task.outlineLevel,
    manualStart: task.manualStart,
    constraintType: task.constraintType,
    constraintDate: task.constraintDate,
    deadline: task.deadline,
  };
}

function toSchedulingDependency(
  dep: GanttDependency,
  minutesPerDay: number,
): Dependency {
  return {
    predecessorId: dep.from,
    successorId: dep.to,
    type: dep.type as DependencyType,
    lag: Math.round((dep.lag ?? 0) * minutesPerDay),
    isPercentage: false,
  };
}

function getProjectStart(tasks: GanttTask[]): Date | undefined {
  if (tasks.length === 0) return undefined;
  const start = Math.min(
    ...tasks.map((task) => (task.manualStart ?? task.start).getTime()),
  );
  return new Date(start);
}

function hasCycle(tasks: GanttTask[], dependencies: GanttDependency[]): boolean {
  const inDegree = new Map<string | number, number>();
  const successors = new Map<string | number, (string | number)[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    successors.set(task.id, []);
  }

  for (const dep of dependencies) {
    successors.get(dep.from)?.push(dep.to);
    inDegree.set(dep.to, (inDegree.get(dep.to) ?? 0) + 1);
  }

  const queue: (string | number)[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  let visited = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    visited += 1;
    for (const next of successors.get(current) ?? []) {
      const degree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  return visited < tasks.length;
}
