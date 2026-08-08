import type { MatrixPlan } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";
import { generateScheduleFromMatrix } from "./matrixGenerator";

/**
 * A partir de aquí un desplazamiento deja de ser el ruido normal de un
 * festivo suelto y significa que el calendario cambia el plan de verdad.
 *
 * **Es un criterio elegido, no medido.** Nadie ha contado cuántos días de
 * desplazamiento le importan a un residente de obra; tres es el punto donde
 * deja de explicarse por un festivo. Cambiarlo es cambiar este número: no
 * hay nada más que dependa de él.
 */
export const CALENDAR_SHIFT_THRESHOLD_DAYS = 3;

export interface CalendarShift {
  maxShiftDays: number;
  taskName: string | null;
  exceedsThreshold: boolean;
  message: string;
}

const MS_PER_DAY = 86_400_000;

/**
 * Cuánto se moverían las fechas de la matriz al aplicarle el calendario del
 * proyecto. Genera dos veces y compara: es caro, así que se llama al pulsar,
 * no en cada tecla.
 */
export function describeCalendarShift(
  plan: MatrixPlan,
  calendar: ProjectCalendar,
): CalendarShift {
  const sinCalendario = generateScheduleFromMatrix(plan);
  const conCalendario = generateScheduleFromMatrix(plan, { calendar });

  const finishById = new Map(
    sinCalendario.tasks.map((task) => [task.id, task.finish.getTime()]),
  );

  let maxShiftDays = 0;
  let taskName: string | null = null;

  for (const task of conCalendario.tasks) {
    // Solo comparar tareas reales, no resúmenes
    if (task.isSummary) continue;

    const before = finishById.get(task.id);
    if (before === undefined) continue;
    const shift = Math.round((task.finish.getTime() - before) / MS_PER_DAY);
    if (shift > maxShiftDays) {
      maxShiftDays = shift;
      taskName = task.name;
    }
  }

  const exceedsThreshold = maxShiftDays > CALENDAR_SHIFT_THRESHOLD_DAYS;

  return {
    maxShiftDays,
    taskName,
    exceedsThreshold,
    message:
      maxShiftDays === 0
        ? "Aplicar el calendario del proyecto no cambia las fechas de la matriz."
        : `Con el calendario del proyecto, «${taskName}» termina ${maxShiftDays} días más tarde. Revisa las fechas antes de aplicar.`,
  };
}
