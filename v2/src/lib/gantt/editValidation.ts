/**
 * Validación de las ediciones de la tabla del Gantt.
 *
 * Existe para que un valor inválido no se descarte en silencio: cada rechazo
 * lleva un motivo en lenguaje de usuario que la UI puede mostrar.
 */

import { createProjectDate } from "@/lib/date/projectDate";

/** El resize de barras nunca deja bajar de un día; la tabla usa la misma regla. */
export const MIN_TASK_DURATION = 1;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function invalid(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

export function parseDurationInput(
  raw: string,
  options: { allowZero?: boolean } = {},
): ParseResult<number> {
  const trimmed = raw.trim();
  if (trimmed === "") return invalid("Escribe una duración en días.");

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return invalid(`«${trimmed}» no es un número de días.`);
  }

  const min = options.allowZero ? 0 : MIN_TASK_DURATION;
  // Se redondea en vez de rechazar: media jornada es un error de tecleo habitual
  // y el motor de cálculo trabaja en días enteros.
  const days = Math.round(parsed);

  if (days < min) {
    return invalid(
      options.allowZero
        ? "La duración no puede ser negativa."
        : `La duración mínima es ${MIN_TASK_DURATION} día. Marca la tarea como hito si dura cero.`,
    );
  }

  return { ok: true, value: days };
}

export function parseDateInput(
  raw: string,
  options: { notBefore?: Date; notBeforeLabel?: string } = {},
): ParseResult<Date> {
  const trimmed = raw.trim();
  if (trimmed === "") return invalid("Escribe una fecha.");

  // `createProjectDate` interpreta yyyy-mm-dd en hora local: con `new Date(iso)`
  // el string se leería como UTC y en Colombia (GMT-5) caería en el día anterior.
  const parsed = createProjectDate(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return invalid(`«${trimmed}» no es una fecha válida.`);
  }

  if (options.notBefore) {
    const limit = options.notBefore;
    const sameDay =
      parsed.getFullYear() === limit.getFullYear() &&
      parsed.getMonth() === limit.getMonth() &&
      parsed.getDate() === limit.getDate();

    if (!sameDay && parsed.getTime() < limit.getTime()) {
      const label = options.notBeforeLabel ?? "la fecha mínima";
      return invalid(`La fecha no puede ser anterior a ${label}.`);
    }
  }

  return { ok: true, value: parsed };
}

export function parseProgressInput(raw: string): ParseResult<number> {
  const trimmed = raw.trim();
  if (trimmed === "") return invalid("Escribe un porcentaje.");

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return invalid(`«${trimmed}» no es un porcentaje.`);
  }
  if (parsed < 0 || parsed > 100) {
    return invalid("El avance va de 0 a 100.");
  }

  return { ok: true, value: parsed };
}

/**
 * Campos numéricos de MS Project (coste, trabajo, etc.). El vacío borra el
 * valor; el texto se rechaza en lugar de convertirse en 0, que era la causa de
 * que un error de tecleo pusiera un coste a cero sin avisar.
 */
export function parseNumericFieldInput(raw: string): ParseResult<number | null> {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return invalid(`«${trimmed}» no es un número.`);
  }

  return { ok: true, value: parsed };
}
