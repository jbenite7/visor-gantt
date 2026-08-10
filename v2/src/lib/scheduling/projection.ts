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

/** Días de obra medidos por debajo de los cuales el ritmo no es un ritmo. */
export const MIN_ELAPSED_DAYS = 7;

export type ProjectionUnavailableReason = "sinTareas" | "sinAvance" | "pocosDias";

export interface ProjectionLine {
  label: string;
  finishDate: Date;
  points: ProjectionPoint[];
}

export interface ProjectionUnavailable {
  available: false;
  reason: ProjectionUnavailableReason;
  /** Qué falta para poder proyectar, en lenguaje de obra. */
  message: string;
}

export interface ProjectionAvailable {
  available: true;
  statusDate: Date;
  achieved: ProjectionPoint[];
  pace: PaceMeasurement;
  optimistic: ProjectionLine;
  probable: ProjectionLine;
  pessimistic: ProjectionLine;
}

export type Projection = ProjectionAvailable | ProjectionUnavailable;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildLine(
  label: string,
  from: Date,
  achievedPercent: number,
  pace: number,
): ProjectionLine {
  const remaining = Math.max(100 - achievedPercent, 0);
  const days = pace > 0 ? Math.ceil(remaining / pace) : 0;
  const finishDate = addDays(from, days);
  return {
    label,
    finishDate,
    points: [
      { date: from, cumulativeValue: achievedPercent },
      { date: finishDate, cumulativeValue: 100 },
    ],
  };
}

/**
 * Proyecta el fin de obra desde el ritmo real logrado. Tres líneas: la
 * probable sigue el ritmo reciente, la optimista el más rápido de los dos
 * ritmos medidos y la pesimista el más lento.
 */
export function projectCompletion(
  tasks: GanttTask[],
  statusDate: Date,
): Projection {
  if (tasks.length === 0) {
    return {
      available: false,
      reason: "sinTareas",
      message:
        "No hay cronograma que proyectar. Importa un archivo de Microsoft Project o crea las actividades de la obra.",
    };
  }

  const achieved = computeAchievedSCurve(tasks, statusDate);
  const pace = measurePace(achieved);

  if (!pace) {
    return {
      available: false,
      reason: "sinAvance",
      message:
        "Ninguna actividad tiene avance registrado, así que no hay ritmo que medir. Anota el porcentaje ejecutado de las actividades que ya arrancaron y la proyección aparece sola.",
    };
  }

  if (pace.elapsedDays < MIN_ELAPSED_DAYS) {
    return {
      available: false,
      reason: "pocosDias",
      message: `Solo hay ${pace.elapsedDays} día(s) de obra medidos hasta la fecha de corte. Se necesitan al menos ${MIN_ELAPSED_DAYS} para que el ritmo signifique algo.`,
    };
  }

  const from = achieved[achieved.length - 1].date;
  const fastest = Math.max(pace.overallPace, pace.recentPace);
  const slowest = Math.min(pace.overallPace, pace.recentPace);

  return {
    available: true,
    statusDate: from,
    achieved,
    pace,
    optimistic: buildLine("Optimista", from, pace.achievedPercent, fastest),
    probable: buildLine("Probable", from, pace.achievedPercent, pace.recentPace),
    pessimistic: buildLine("Pesimista", from, pace.achievedPercent, slowest),
  };
}
