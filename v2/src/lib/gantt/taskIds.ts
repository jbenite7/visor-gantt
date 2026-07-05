import type { GanttTask } from "@/components/gantt/types";
import { getMppRecordValue } from "@/lib/mpp/recordValues";

export function taskRowId(task: GanttTask | undefined, fallback?: string | number): string | number {
  if (!task) return fallback ?? "";
  const value = getMppRecordValue(task, "ID");
  return typeof value === "string" || typeof value === "number" ? value : fallback ?? task.id;
}

export function taskUniqueId(task: GanttTask | undefined, fallback?: string | number): string | number {
  if (!task) return fallback ?? "";
  const value = getMppRecordValue(task, "UNIQUE_ID");
  return typeof value === "string" || typeof value === "number" ? value : task?.id ?? "";
}

export function findTaskByRowId(tasks: GanttTask[], rowId: string | number): GanttTask | undefined {
  return tasks.find((task) => String(taskRowId(task)) === String(rowId));
}

export function dependencyToken(
  task: GanttTask | undefined,
  fallback: string | number,
  type: string,
  lag?: number,
): string {
  const lagText = lag ? `${lag > 0 ? "+" : ""}${lag}d` : "";
  return `${taskRowId(task, fallback)}${type}${lagText}`;
}
