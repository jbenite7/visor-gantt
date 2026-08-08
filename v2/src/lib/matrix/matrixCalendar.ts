import type { ProjectCalendar } from "@/types/calendar";
import {
  isProjectWorkingDay,
  normalizeProjectCalendar,
} from "@/lib/scheduling/projectCalendar";

/**
 * Aritmética de días laborables para la matriz.
 *
 * Sin calendario se conserva el comportamiento histórico del generador
 * —trabajar todos los días menos el domingo—, para que un plan guardado antes
 * de este proyecto genere exactamente las mismas fechas.
 *
 * Con calendario se usa el del proyecto, que ya resuelve jornada, días
 * laborables y festivos. Aquí no se escribe lógica de calendario nueva: se
 * enchufa la que existe en `projectCalendar.ts`.
 */
function isWorkingDay(date: Date, calendar?: ProjectCalendar): boolean {
  if (!calendar) return date.getDay() !== 0;
  return isProjectWorkingDay(date, calendar);
}

export function matrixAddWorkDays(
  start: Date,
  days: number,
  calendar?: ProjectCalendar,
): Date {
  const result = new Date(start);
  result.setHours(0, 0, 0, 0);

  const normalizedCalendar = calendar ? normalizeProjectCalendar(calendar) : undefined;

  let added = 0;
  let guard = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    // Una obra sin ningún día laborable colgaría el bucle: 3.650 días es
    // una década, muy por encima de cualquier cronograma real.
    guard += 1;
    if (guard > 3650) break;
    if (isWorkingDay(result, normalizedCalendar)) added += 1;
  }

  return result;
}

export function matrixFinishFromDuration(
  start: Date,
  durationDays: number,
  calendar?: ProjectCalendar,
): Date {
  return matrixAddWorkDays(start, Math.max(1, durationDays) - 1, calendar);
}

export function matrixNextWorkDay(
  date: Date,
  lagDays = 0,
  calendar?: ProjectCalendar,
): Date {
  return matrixAddWorkDays(date, 1 + Math.max(0, lagDays), calendar);
}
