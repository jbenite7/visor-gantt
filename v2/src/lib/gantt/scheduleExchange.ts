import type { GanttTask } from "@/components/gantt/types";
import { formatProjectDate, toDateInputValue } from "@/lib/date/projectDate";
import { dependencyTokenForTaskId } from "@/lib/gantt/taskIds";
import type { Observation } from "@/lib/observations/observations";

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

/** Excel en configuración regional española espera `;`, no `,`. */
const CSV_SEPARADOR = ";";

function csvCell(value: unknown): string {
  if (value == null) return "";
  const texto = String(value).replace(/\r?\n/g, " ");
  return /[;"]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * «Copiar Excel» copiaba un TSV y el archivo se llamaba `.tsv`: quien esperaba
 * abrirlo con doble clic se encontraba con una columna única. Este es el CSV
 * de verdad, y de paso lleva las observaciones de cada actividad, que antes
 * solo salían desde el panel de una tarea (M25, M31).
 */
export function tasksToCsv(
  tasks: GanttTask[],
  observations: Observation[],
): string {
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
    "Observaciones",
  ];

  const porTarea = new Map<string | number, string[]>();
  for (const observacion of observations) {
    const previas = porTarea.get(observacion.taskId) ?? [];
    previas.push(observacion.text);
    porTarea.set(observacion.taskId, previas);
  }

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
    (porTarea.get(task.id) ?? []).join(" · "),
  ]);

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(CSV_SEPARADOR))
    .join("\n");
}

export function exportedScheduleFileName(baseName = "cronograma"): string {
  const today = formatProjectDate(new Date()).replace(/\//g, "-");
  return `${baseName}-${today}.csv`;
}
