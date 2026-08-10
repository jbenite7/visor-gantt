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

  // Las tareas resumen agregan a sus hijas: contarlas junto a ellas duplica
  // el trabajo. El avance logrado solo se mide sobre tareas operativas.
  const operationalTasks = tasks.filter((task) => !task.isSummary);

  let totalWork = 0;
  for (const task of operationalTasks) totalWork += safeDuration(task);

  const start = dateOnly(earliestStart(tasks));
  const end = dateOnly(statusDate);
  if (end < start) return [];

  const points: ProjectionPoint[] = [];
  for (const day of eachDay(start, end)) {
    let done = 0;
    for (const task of operationalTasks) {
      done += safeDuration(task) * achievedFraction(task, day);
    }
    points.push({ date: day, cumulativeValue: totalWork > 0 ? (done / totalWork) * 100 : 0 });
  }
  return points;
}

/** Ventana de días con la que se mide el ritmo reciente. */
export const RECENT_WINDOW_DAYS = 14;

export interface PaceMeasurement {
  /** Días de obra medidos hasta la fecha de corte, inclusive. */
  elapsedDays: number;
  /** Avance logrado al corte, 0–100. */
  achievedPercent: number;
  /** Puntos porcentuales por día desde el inicio de obra. */
  overallPace: number;
  /** Puntos porcentuales por día en los últimos `RECENT_WINDOW_DAYS`. */
  recentPace: number;
}

/**
 * Mide el ritmo logrado. Devuelve `null` cuando no hay nada que medir: sin
 * serie o sin un solo punto de avance registrado.
 *
 * Si la obra se detuvo justo en la ventana reciente, el ritmo reciente sería
 * cero y la proyección se iría al infinito. En ese caso se cae al ritmo medio,
 * que es el dato que sí existe.
 */
export function measurePace(points: ProjectionPoint[]): PaceMeasurement | null {
  if (points.length === 0) return null;

  const elapsedDays = points.length;
  const achievedPercent = points[points.length - 1].cumulativeValue;
  if (achievedPercent <= 0) return null;

  const overallPace = achievedPercent / elapsedDays;

  const windowSize = Math.min(RECENT_WINDOW_DAYS, points.length - 1);
  const rawRecentPace =
    windowSize > 0
      ? (achievedPercent - points[points.length - 1 - windowSize].cumulativeValue) /
        windowSize
      : overallPace;

  return {
    elapsedDays,
    achievedPercent,
    overallPace,
    recentPace: rawRecentPace > 0 ? rawRecentPace : overallPace,
  };
}
