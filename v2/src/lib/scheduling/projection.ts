import type { GanttTask } from "@/components/gantt/types";

/**
 * Proyección a fin de obra a partir del avance realmente registrado.
 *
 * No hay palancas: el ritmo sale de lo que la obra ya reportó. Una vista que
 * exige configuración para mostrar algo es el fallo que este goal vino a
 * corregir.
 */

export interface ProjectionPoint {
  date: Date;
  cumulativeValue: number;
}

/** Normaliza a medianoche local para comparar solo por día. */
function dateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** Días de calendario entre dos fechas, redondeado para absorber el horario de verano. */
function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function* eachDay(start: Date, finish: Date): Generator<Date> {
  const current = new Date(start);
  while (current <= finish) {
    yield new Date(current);
    current.setDate(current.getDate() + 1);
  }
}

function safeDuration(task: GanttTask): number {
  return Math.max(task.duration, 1);
}

/**
 * Fracción de una tarea acreditada a un día: se reparte linealmente sobre su
 * duración y se topa con el porcentaje reportado. Sin avance reportado, cero.
 */
function achievedFraction(task: GanttTask, day: Date): number {
  const start = dateOnly(task.start);
  if (day < start) return 0;
  const elapsed = dayDiff(start, day) + 1;
  return Math.min(elapsed / safeDuration(task), task.progress / 100);
}

function earliestStart(tasks: GanttTask[]): Date {
  let min = tasks[0].start;
  for (const task of tasks) {
    if (task.start < min) min = task.start;
  }
  return min;
}

/**
 * Serie diaria de avance logrado (0–100), ponderada por duración, desde el
 * inicio de obra hasta la fecha de corte inclusive.
 */
export function computeAchievedSCurve(
  tasks: GanttTask[],
  statusDate: Date,
): ProjectionPoint[] {
  if (tasks.length === 0) return [];

  let totalWork = 0;
  for (const task of tasks) totalWork += safeDuration(task);
  if (totalWork <= 0) return [];

  const start = dateOnly(earliestStart(tasks));
  const end = dateOnly(statusDate);
  if (end < start) return [];

  const points: ProjectionPoint[] = [];
  for (const day of eachDay(start, end)) {
    let done = 0;
    for (const task of tasks) {
      done += safeDuration(task) * achievedFraction(task, day);
    }
    points.push({ date: day, cumulativeValue: (done / totalWork) * 100 });
  }
  return points;
}
