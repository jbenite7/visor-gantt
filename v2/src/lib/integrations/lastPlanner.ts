import type { GanttTask } from "@/components/gantt/types";

export interface LastPlannerConstraint {
  type: "predecessorIncomplete" | "criticalPath" | "lateProgress";
  taskId?: string | number;
  message: string;
}

export interface LastPlannerCommitment {
  taskId: string | number;
  name: string;
  wbs?: string;
  start: string;
  finish: string;
  duration: number;
  percentComplete: number;
  isCritical: boolean;
  weekStart: string;
  weekEnd: string;
  constraints: LastPlannerConstraint[];
}

export interface LastPlannerWeek {
  weekStart: string;
  weekEnd: string;
  commitments: LastPlannerCommitment[];
}

export interface LastPlannerPreview {
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  weeks: LastPlannerWeek[];
  summary: {
    totalCommitments: number;
    constrainedCommitments: number;
    criticalCommitments: number;
  };
}

export interface LastPlannerPreviewInput {
  tasks: GanttTask[];
  windowStart?: Date;
  weeks?: number;
  generatedAt?: string;
  statusDate?: Date;
}

const MS_PER_DAY = 86_400_000;

function dayStart(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = dayStart(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date: Date): string {
  return dayStart(date).toISOString().slice(0, 10);
}

function mondayOf(date: Date): Date {
  const result = dayStart(date);
  const day = result.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(result, delta);
}

function overlaps(task: GanttTask, windowStart: Date, windowEnd: Date): boolean {
  return task.start <= windowEnd && task.finish >= windowStart;
}

function progressValue(task: GanttTask): number {
  return task.percentComplete ?? task.progress ?? 0;
}

function constraintsForTask(
  task: GanttTask,
  taskById: Map<string | number, GanttTask>,
  statusDate: Date,
): LastPlannerConstraint[] {
  const constraints: LastPlannerConstraint[] = [];

  task.dependencies.forEach((dependency) => {
    const predecessor = taskById.get(dependency.from);
    if (!predecessor) return;
    if (progressValue(predecessor) >= 100) return;
    constraints.push({
      type: "predecessorIncomplete",
      taskId: predecessor.id,
      message: `Predecesora ${predecessor.name} incompleta (${progressValue(predecessor).toFixed(2)}%).`,
    });
  });

  if (task.isCritical) {
    constraints.push({
      type: "criticalPath",
      message: "Actividad en ruta critica; requiere control semanal.",
    });
  }

  if (progressValue(task) < 100 && task.finish < dayStart(statusDate)) {
    constraints.push({
      type: "lateProgress",
      message: "Actividad vencida con avance pendiente.",
    });
  }

  return constraints;
}

export function buildLastPlannerPreview({
  tasks,
  windowStart = new Date(),
  weeks = 6,
  generatedAt = new Date().toISOString(),
  statusDate = new Date(),
}: LastPlannerPreviewInput): LastPlannerPreview {
  const safeWeeks = Math.max(1, Math.min(12, Math.floor(weeks)));
  const start = mondayOf(windowStart);
  const end = addDays(start, safeWeeks * 7 - 1);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const weekBuckets = Array.from({ length: safeWeeks }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    return {
      weekStart,
      weekEnd: addDays(weekStart, 6),
      commitments: [] as LastPlannerCommitment[],
    };
  });

  tasks
    .filter((task) => !task.isSummary && overlaps(task, start, end))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || String(a.id).localeCompare(String(b.id)))
    .forEach((task) => {
      const bucketIndex = Math.min(
        safeWeeks - 1,
        Math.max(0, Math.floor((dayStart(task.start).getTime() - start.getTime()) / (MS_PER_DAY * 7))),
      );
      const bucket = weekBuckets[bucketIndex];
      bucket.commitments.push({
        taskId: task.id,
        name: task.name,
        wbs: task.wbs,
        start: task.start.toISOString(),
        finish: task.finish.toISOString(),
        duration: task.duration,
        percentComplete: progressValue(task),
        isCritical: task.isCritical,
        weekStart: isoDate(bucket.weekStart),
        weekEnd: isoDate(bucket.weekEnd),
        constraints: constraintsForTask(task, taskById, statusDate),
      });
    });

  const weeksOutput = weekBuckets.map((bucket) => ({
    weekStart: isoDate(bucket.weekStart),
    weekEnd: isoDate(bucket.weekEnd),
    commitments: bucket.commitments,
  }));
  const commitments = weeksOutput.flatMap((week) => week.commitments);

  return {
    generatedAt,
    windowStart: isoDate(start),
    windowEnd: isoDate(end),
    weeks: weeksOutput,
    summary: {
      totalCommitments: commitments.length,
      constrainedCommitments: commitments.filter((commitment) => commitment.constraints.length > 0).length,
      criticalCommitments: commitments.filter((commitment) => commitment.isCritical).length,
    },
  };
}
