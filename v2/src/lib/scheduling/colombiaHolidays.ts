import type { CalendarException, ProjectCalendar } from "@/types/calendar";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function nextMonday(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDay();
  if (day !== 1) {
    next.setUTCDate(next.getUTCDate() + ((8 - day) % 7));
  }
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return dateUtc(year, month, day);
}

export function colombiaHolidaysForYear(year: number): CalendarException[] {
  const easter = easterSunday(year);
  const holidays: Array<{ date: Date; name: string }> = [
    { date: dateUtc(year, 0, 1), name: "Año Nuevo" },
    { date: nextMonday(dateUtc(year, 0, 6)), name: "Día de los Reyes Magos" },
    { date: nextMonday(dateUtc(year, 2, 19)), name: "Día de San José" },
    { date: addDays(easter, -3), name: "Jueves Santo" },
    { date: addDays(easter, -2), name: "Viernes Santo" },
    { date: dateUtc(year, 4, 1), name: "Día del Trabajo" },
    { date: nextMonday(addDays(easter, 43)), name: "Ascensión del Señor" },
    { date: nextMonday(addDays(easter, 64)), name: "Corpus Christi" },
    { date: nextMonday(addDays(easter, 71)), name: "Sagrado Corazón de Jesús" },
    { date: nextMonday(dateUtc(year, 5, 29)), name: "San Pedro y San Pablo" },
    { date: dateUtc(year, 6, 20), name: "Día de la Independencia" },
    { date: dateUtc(year, 7, 7), name: "Batalla de Boyacá" },
    { date: nextMonday(dateUtc(year, 7, 15)), name: "Asunción de la Virgen" },
    { date: nextMonday(dateUtc(year, 9, 12)), name: "Día de la Raza" },
    { date: nextMonday(dateUtc(year, 10, 1)), name: "Todos los Santos" },
    { date: nextMonday(dateUtc(year, 10, 11)), name: "Independencia de Cartagena" },
    { date: dateUtc(year, 11, 8), name: "Inmaculada Concepción" },
    { date: dateUtc(year, 11, 25), name: "Navidad" },
  ];

  const byDate = new Map<string, CalendarException>();
  for (const holiday of holidays) {
    const date = isoDate(holiday.date);
    const existing = byDate.get(date);
    byDate.set(date, {
      id: `co-${date}`,
      date,
      name: existing ? `${existing.name} / ${holiday.name}` : holiday.name,
    });
  }

  return [...byDate.values()];
}

export function withColombiaHolidays(
  calendar: ProjectCalendar,
  years: number[],
): ProjectCalendar {
  const existingDates = new Set(calendar.nonWorkingDays.map((day) => day.date));
  const generated = [...new Set(years)]
    .sort((a, b) => a - b)
    .flatMap((year) => colombiaHolidaysForYear(year))
    .filter((holiday) => !existingDates.has(holiday.date));

  return {
    ...calendar,
    nonWorkingDays: [...calendar.nonWorkingDays, ...generated].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  };
}
