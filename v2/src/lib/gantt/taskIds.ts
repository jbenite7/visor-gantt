import type { GanttTask } from "@/components/gantt/types";
import { getMppRecordValue } from "@/lib/mpp/recordValues";

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
