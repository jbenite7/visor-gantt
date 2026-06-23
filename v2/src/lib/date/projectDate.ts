const DEFAULT_TIME_ZONE = "America/Bogota";

type TimeZoneResolver = () => string | undefined;

function runtimeTimeZone(): string | undefined {
  if (typeof Intl === "undefined") return undefined;
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getConfiguredTimeZone(
  resolveTimeZone: TimeZoneResolver = runtimeTimeZone,
): string {
  return (
    process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE ||
    resolveTimeZone() ||
    DEFAULT_TIME_ZONE
  );
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
