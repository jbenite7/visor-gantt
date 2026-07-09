import type { GanttTask } from "@/components/gantt/types";
import { formatProjectDate, toDateInputValue } from "@/lib/date/projectDate";
import { dependencyTokenForTaskId } from "@/lib/gantt/taskIds";

function tsvCell(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function formatScheduleDate(value: Date): string {
  const isUtcDateOnly =
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0;

  if (isUtcDateOnly) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return toDateInputValue(value);
}

function formatDependencies(task: GanttTask, tasks: GanttTask[]): string {
  return task.dependencies
    .map((dependency) => {
      return dependencyTokenForTaskId(
        tasks,
        dependency.from,
        dependency.type,
        dependency.lag,
        dependency.lagUnit,
      );
    })
    .join(", ");
}

export function tasksToExcelTsv(tasks: GanttTask[]): string {
  const header = [
    "Actividad",
    "Inicio",
    "Fin",
    "Duración",
    "% completado",
    "Nivel",
    "EDT",
    "Predecesoras",
    "Recursos",
    "Costo",
  ];

  const rows = tasks.map((task) => [
    task.name,
    formatScheduleDate(task.start),
    formatScheduleDate(task.finish),
    task.duration,
    Number.isFinite(task.progress) ? Number(task.progress.toFixed(2)) : 0,
    task.outlineLevel,
    task.wbs ?? "",
    formatDependencies(task, tasks),
    task.resourceNames?.join(", ") ?? "",
    task.cost ?? "",
  ]);

  return [header, ...rows]
    .map((row) => row.map(tsvCell).join("\t"))
    .join("\n");
}

export function exportedScheduleFileName(baseName = "cronograma"): string {
  const today = formatProjectDate(new Date()).replace(/\//g, "-");
  return `${baseName}-${today}.tsv`;
}
