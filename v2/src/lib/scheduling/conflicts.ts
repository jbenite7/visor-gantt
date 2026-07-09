import type { GanttDependency, GanttTask } from "@/components/gantt/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ConstraintViolation {
  level: string;
  predecessor: string;
  successor: string;
  relation: GanttDependency["type"];
  lag: number;
  expectedDate: Date;
  actualDate: Date;
  delayDays: number;
}

export interface AtypicalDeviation {
  level: string;
  predecessor: string;
  successor: string;
  relation: "WBS";
  lag: 0;
  expectedDate: Date;
  actualDate: Date;
  delayDays: number;
}

export interface ConflictAnalysis {
  violations: ConstraintViolation[];
  deviations: AtypicalDeviation[];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function expectedForDependency(
  predecessor: GanttTask,
  dependency: GanttDependency,
): Date {
  const lag = dependency.lag ?? 0;
  switch (dependency.type) {
    case "SS":
    case "SF":
      return addDays(predecessor.start, lag);
    case "FS":
    case "FF":
      return addDays(predecessor.finish, lag);
  }
}

function actualForDependency(successor: GanttTask, type: GanttDependency["type"]): Date {
  return type === "FF" || type === "SF" ? successor.finish : successor.start;
}

function levelLabel(task: GanttTask): string {
  return task.wbs || `L${task.outlineLevel}`;
}

function sameParentWbs(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const aParts = a.split(".");
  const bParts = b.split(".");
  if (aParts.length !== bParts.length || aParts.length < 2) return false;
  return aParts.slice(0, -1).join(".") === bParts.slice(0, -1).join(".");
}

export function analyzeScheduleConflicts(tasks: GanttTask[]): ConflictAnalysis {
  const byId = new Map<string | number, GanttTask>();
  const dependencyPairs = new Set<string>();
  tasks.forEach((task) => byId.set(task.id, task));

  const violations: ConstraintViolation[] = [];
  for (const successor of tasks) {
    for (const dependency of successor.dependencies) {
      const predecessor = byId.get(dependency.from);
      if (!predecessor) continue;
      dependencyPairs.add(`${dependency.from}->${dependency.to}`);

      const expectedDate = expectedForDependency(predecessor, dependency);
      const actualDate = actualForDependency(successor, dependency.type);
      const delayDays = daysBetween(expectedDate, actualDate);
      if (delayDays < 0) {
        violations.push({
          level: levelLabel(successor),
          predecessor: predecessor.name,
          successor: successor.name,
          relation: dependency.type,
          lag: dependency.lag ?? 0,
          expectedDate,
          actualDate,
          delayDays: Math.abs(delayDays),
        });
      }
    }
  }

  const deviations: AtypicalDeviation[] = [];
  for (let index = 1; index < tasks.length; index += 1) {
    const previous = tasks[index - 1];
    const current = tasks[index];
    if (!previous || !current || previous.isSummary || current.isSummary) continue;
    if (!sameParentWbs(previous.wbs, current.wbs)) continue;
    if (dependencyPairs.has(`${previous.id}->${current.id}`)) continue;

    const gapDays = daysBetween(previous.finish, current.start);
    if (gapDays < -1 || gapDays > 14) {
      deviations.push({
        level: levelLabel(current),
        predecessor: previous.name,
        successor: current.name,
        relation: "WBS",
        lag: 0,
        expectedDate: addDays(previous.finish, 1),
        actualDate: current.start,
        delayDays: Math.abs(gapDays),
      });
    }
  }

  return { violations, deviations };
}
