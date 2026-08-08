import type { GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";
import { isProjectWorkingDay } from "@/lib/scheduling/projectCalendar";
import { MIN_TASK_DURATION } from "./editValidation";

/**
 * En MS Project, escribir el fin no mueve la tarea: cambia su duración. Es lo
 * que espera quien viene de ahí, y hasta ahora la celda no hacía ni una cosa
 * ni la otra.
 *
 * La duración se cuenta en días laborables del calendario del proyecto, que es
 * la misma unidad que usa el motor de cálculo.
 */
/** Las tareas llevan hora (08:00, 17:00): comparar por día evita descuadres. */
function inicioDelDia(fecha: Date): Date {
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  return dia;
}

export function durationFromFinish(
  task: GanttTask,
  nuevoFinBruto: Date,
  calendar: ProjectCalendar,
): { ok: true; duration: number } | { ok: false; reason: string } {
  const nuevoFin = inicioDelDia(nuevoFinBruto);
  const inicio = inicioDelDia(task.start);

  if (nuevoFin < inicio) {
    return {
      ok: false,
      reason: "El fin no puede quedar antes del inicio de la actividad.",
    };
  }
  if (!isProjectWorkingDay(nuevoFin, calendar)) {
    return {
      ok: false,
      reason: "Ese día no se trabaja en el calendario del proyecto.",
    };
  }

  let dias = 0;
  const cursor = new Date(inicio);
  while (cursor <= nuevoFin) {
    if (isProjectWorkingDay(cursor, calendar)) dias += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { ok: true, duration: Math.max(dias, MIN_TASK_DURATION) };
}
