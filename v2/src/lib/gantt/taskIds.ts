import type { GanttTask } from "@/components/gantt/types";
import { getMppRecordValue } from "@/lib/mpp/recordValues";
import { formatDependencyLag } from "@/lib/gantt/dependencyLag";

function numericRecordValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return undefined;
}

export function taskRowId(task: GanttTask | undefined, fallback?: string | number): string | number {
  if (!task) return fallback ?? "";
  const value = getMppRecordValue({ mppFields: task.mppFields }, "ID");
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof task.id === "number") return task.id;
  return fallback ?? "";
}

export function taskUniqueId(task: GanttTask | undefined, fallback?: string | number): string | number {
  if (!task) return fallback ?? "";
  const value = getMppRecordValue({ mppFields: task.mppFields }, "UNIQUE_ID");
  return numericRecordValue(value) ?? numericRecordValue(fallback) ?? "";
}

export function findTaskByRowId(tasks: GanttTask[], rowId: string | number): GanttTask | undefined {
  return tasks.find((task, index) => String(taskRowId(task, index + 1)) === String(rowId));
}

export function taskVisibleRowId(tasks: GanttTask[], task: GanttTask): string | number {
  const rowIndex = tasks.findIndex((candidate) => candidate.id === task.id);
  return taskRowId(task, rowIndex >= 0 ? rowIndex + 1 : undefined);
}

export function dependencyRowId(
  tasks: GanttTask[],
  taskId: string | number,
): string | number {
  const rowIndex = tasks.findIndex((candidate) => candidate.id === taskId);
  if (rowIndex < 0) return typeof taskId === "number" ? taskId : "?";
  return taskRowId(tasks[rowIndex], rowIndex + 1);
}

export function dependencyToken(
  task: GanttTask | undefined,
  fallback: string | number,
  type: string,
  lag?: number,
  lagUnit?: "days" | "percent",
): string {
  const lagText = formatDependencyLag(lag, lagUnit);
  return `${taskRowId(task, fallback)}${type}${lagText}`;
}

export function dependencyTokenForTaskId(
  tasks: GanttTask[],
  taskId: string | number,
  type: string,
  lag?: number,
  lagUnit?: "days" | "percent",
): string {
  const lagText = formatDependencyLag(lag, lagUnit);
  return `${dependencyRowId(tasks, taskId)}${type}${lagText}`;
}
