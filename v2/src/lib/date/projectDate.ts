const DEFAULT_TIME_ZONE = "America/Bogota";

export function getConfiguredTimeZone(): string {
  return process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;
}

export function createProjectDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds(),
    );
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(.*))?$/);
  if (!match) return new Date(value);

  const [, year, month, day, time] = match;
  if (!time) {
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatProjectDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  },
): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: getConfiguredTimeZone(),
    ...options,
  }).format(date);
}

/**
 * Una fecha ISO de solo día, escrita como la lee un jefe de obra.
 *
 * Estaba duplicada palabra por palabra en `LastPlannerView` y en el tablero
 * ejecutivo, y una tercera pantalla la escribía distinto —`11/8/2026` en vez de
 * `11/08/2026`—, así que la misma app enseñaba la misma fecha de dos formas.
 *
 * **No pasa por `Date` a propósito.** Un ISO de solo día convertido a `Date` y
 * formateado con zona horaria puede caer en el día anterior: `2026-08-05` se
 * lee como medianoche UTC, y en Bogotá eso es el 4 por la tarde. Aquí se leen
 * los trozos del texto y ya.
 */
export function formatIsoDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

/**
 * Un `Date` de proyecto escrito como `dd/mm/aaaa`, **leyendo UTC**.
 *
 * Estaba duplicada palabra por palabra en `ProjectToolbar` (como
 * `formatDateShort`) y en `GanttView` (como `formatStableDate`): mismo código,
 * dos nombres.
 *
 * Lee UTC y no la zona configurada a propósito, y por eso no puede sustituirse
 * por `formatProjectDate`: las fechas del cronograma se construyen a medianoche
 * UTC, así que formatearlas en Bogotá las correría al día anterior.
 */
export function formatProjectDayUTC(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}
