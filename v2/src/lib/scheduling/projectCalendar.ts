import type { SchedulingCalendar } from "./cpm";
import {
  DEFAULT_PROJECT_CALENDAR,
  type CalendarDateOverride,
  type CalendarException,
  type ProjectCalendar,
} from "@/types/calendar";

export type CalendarIssueKind =
  | "emptyWorkWeek"
  | "duplicateException"
  | "duplicateDateOverride"
  | "invalidExceptionDate"
  | "invalidDateOverride"
  | "invalidWorkHours"
  | "invalidHoursPerDay";

export interface CalendarIssue {
  kind: CalendarIssueKind;
  severity: "high" | "medium";
  message: string;
  field?: keyof ProjectCalendar | "nonWorkingDays.date";
}

const VALID_WORK_DAYS = new Set([1, 2, 3, 4, 5, 6, 7]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface CalendarLookup {
  calendar: ProjectCalendar;
  workDays: Set<number>;
  nonWorkingDateKeys: Set<string>;
  overridesByDate: Map<string, CalendarDateOverride>;
  minutesPerDay: number;
}

interface CachedCalendarLookup {
  signature: string;
  lookup: CalendarLookup;
}

const calendarLookupCache = new WeakMap<object, CachedCalendarLookup>();
let defaultCalendarLookup: CalendarLookup | undefined;

function dateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function projectDayFromDate(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function minutesFromTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizeException(
  item: Partial<CalendarException>,
  index: number,
): CalendarException | null {
  if (!item.date || !DATE_RE.test(item.date)) return null;
  return {
    id: item.id || `${item.date}-${index}`,
    date: item.date,
    name: item.name?.trim() || "Día no laboral",
  };
}

function normalizeDateOverride(
  item: Partial<CalendarDateOverride>,
  index: number,
): CalendarDateOverride | null {
  if (!item.date || !DATE_RE.test(item.date)) return null;
  const normalized: CalendarDateOverride = {
    id: item.id || `${item.date}-${index}`,
    date: item.date,
    name: item.name?.trim() || (item.isWorking ? "Jornada especial" : "Día no laboral"),
    isWorking: item.isWorking === true,
  };
  if (item.startHour) normalized.startHour = item.startHour;
  if (item.endHour) normalized.endHour = item.endHour;
  if (typeof item.hoursPerDay === "number" && Number.isFinite(item.hoursPerDay)) {
    normalized.hoursPerDay = item.hoursPerDay;
  }
  return normalized;
}

export function normalizeProjectCalendar(
  raw?: Partial<ProjectCalendar> | null,
): ProjectCalendar {
  const workDays = (raw?.workDays ?? DEFAULT_PROJECT_CALENDAR.workDays)
    .filter((day, index, list) => VALID_WORK_DAYS.has(day) && list.indexOf(day) === index)
    .sort((a, b) => a - b);

  const nonWorkingDays = (raw?.nonWorkingDays ?? [])
    .map(normalizeException)
    .filter((item): item is CalendarException => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  const dateOverrides = (raw?.dateOverrides ?? [])
    .map(normalizeDateOverride)
    .filter((item): item is CalendarDateOverride => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    timeZone: raw?.timeZone?.trim() || DEFAULT_PROJECT_CALENDAR.timeZone,
    workDays:
      workDays.length > 0 ? workDays : DEFAULT_PROJECT_CALENDAR.workDays,
    startHour: raw?.startHour || DEFAULT_PROJECT_CALENDAR.startHour,
    endHour: raw?.endHour || DEFAULT_PROJECT_CALENDAR.endHour,
    hoursPerDay: raw?.hoursPerDay ?? DEFAULT_PROJECT_CALENDAR.hoursPerDay,
    nonWorkingDays,
    dateOverrides,
  };
}

function calendarSignature(raw: Partial<ProjectCalendar>): string {
  const workDays = raw.workDays?.join(",") ?? "";
  const nonWorkingDays = raw.nonWorkingDays
    ?.map((day) => `${day.id ?? ""}:${day.date ?? ""}:${day.name ?? ""}`)
    .join("|") ?? "";
  const dateOverrides = raw.dateOverrides
    ?.map((override) => [
      override.id ?? "",
      override.date ?? "",
      override.name ?? "",
      override.isWorking === true ? "1" : "0",
      override.startHour ?? "",
      override.endHour ?? "",
      override.hoursPerDay ?? "",
    ].join(":"))
    .join("|") ?? "";

  return [
    raw.timeZone ?? "",
    raw.startHour ?? "",
    raw.endHour ?? "",
    raw.hoursPerDay ?? "",
    workDays,
    nonWorkingDays,
    dateOverrides,
  ].join("||");
}

function buildCalendarLookup(raw?: Partial<ProjectCalendar> | null): CalendarLookup {
  const calendar = normalizeProjectCalendar(raw);
  return {
    calendar,
    workDays: new Set(calendar.workDays),
    nonWorkingDateKeys: new Set(calendar.nonWorkingDays.map((day) => day.date)),
    overridesByDate: new Map(
      calendar.dateOverrides.map((override) => [override.date, override]),
    ),
    minutesPerDay: Math.max(1, calendar.hoursPerDay) * 60,
  };
}

function getCalendarLookup(raw?: Partial<ProjectCalendar> | null): CalendarLookup {
  if (!raw) {
    defaultCalendarLookup ??= buildCalendarLookup(DEFAULT_PROJECT_CALENDAR);
    return defaultCalendarLookup;
  }

  const signature = calendarSignature(raw);
  const cached = calendarLookupCache.get(raw);
  if (cached?.signature === signature) return cached.lookup;
  const lookup = buildCalendarLookup(raw);
  calendarLookupCache.set(raw, { signature, lookup });
  return lookup;
}

export function validateProjectCalendar(
  calendar: ProjectCalendar,
): CalendarIssue[] {
  const issues: CalendarIssue[] = [];
  const uniqueWorkDays = new Set(calendar.workDays);

  if (
    calendar.workDays.length === 0 ||
    calendar.workDays.some((day) => !VALID_WORK_DAYS.has(day)) ||
    uniqueWorkDays.size !== calendar.workDays.length
  ) {
    issues.push({
      kind: "emptyWorkWeek",
      severity: "high",
      field: "workDays",
      message: "Selecciona al menos un día laboral válido.",
    });
  }

  const startMinutes = minutesFromTime(calendar.startHour);
  const endMinutes = minutesFromTime(calendar.endHour);
  if (
    startMinutes === null ||
    endMinutes === null ||
    startMinutes >= endMinutes
  ) {
    issues.push({
      kind: "invalidWorkHours",
      severity: "high",
      field: "startHour",
      message: "La jornada debe tener una hora de inicio anterior a la hora fin.",
    });
  }

  const calendarRangeHours =
    startMinutes !== null && endMinutes !== null
      ? (endMinutes - startMinutes) / 60
      : 24;
  if (
    !Number.isFinite(calendar.hoursPerDay) ||
    calendar.hoursPerDay < 1 ||
    calendar.hoursPerDay > 24 ||
    calendar.hoursPerDay > calendarRangeHours
  ) {
    issues.push({
      kind: "invalidHoursPerDay",
      severity: "high",
      field: "hoursPerDay",
      message: "Las horas por día deben caber dentro de la jornada configurada.",
    });
  }

  const seenDates = new Set<string>();
  for (const exception of calendar.nonWorkingDays) {
    if (!DATE_RE.test(exception.date)) {
      issues.push({
        kind: "invalidExceptionDate",
        severity: "high",
        field: "nonWorkingDays.date",
        message: "Cada día no laboral debe tener una fecha válida.",
      });
      continue;
    }
    if (seenDates.has(exception.date)) {
      issues.push({
        kind: "duplicateException",
        severity: "high",
        field: "nonWorkingDays.date",
        message: "La fecha ya está configurada.",
      });
    }
    seenDates.add(exception.date);
  }

  const seenOverrideDates = new Set<string>();
  for (const override of calendar.dateOverrides) {
    if (!DATE_RE.test(override.date)) {
      issues.push({
        kind: "invalidDateOverride",
        severity: "high",
        field: "nonWorkingDays.date",
        message: "Cada excepción de calendario debe tener una fecha válida.",
      });
      continue;
    }
    if (seenOverrideDates.has(override.date)) {
      issues.push({
        kind: "duplicateDateOverride",
        severity: "high",
        field: "nonWorkingDays.date",
        message: "La fecha ya tiene una excepción de calendario.",
      });
    }
    seenOverrideDates.add(override.date);
    if (
      override.hoursPerDay !== undefined &&
      (!Number.isFinite(override.hoursPerDay) ||
        override.hoursPerDay < 0 ||
        override.hoursPerDay > 24)
    ) {
      issues.push({
        kind: "invalidHoursPerDay",
        severity: "high",
        field: "hoursPerDay",
        message: "Las horas de una excepción laboral deben estar entre 0 y 24.",
      });
    }
  }

  return issues;
}

export function isProjectWorkingDay(
  date: Date,
  calendar: ProjectCalendar,
): boolean {
  const lookup = getCalendarLookup(calendar);
  const key = dateKey(date);
  const override = lookup.overridesByDate.get(key);
  if (override) return override.isWorking;
  if (!lookup.workDays.has(projectDayFromDate(date))) return false;
  return !lookup.nonWorkingDateKeys.has(key);
}

export function getCalendarMinutesForDate(
  date: Date,
  calendar?: ProjectCalendar,
): number {
  const lookup = getCalendarLookup(calendar);
  const override = lookup.overridesByDate.get(dateKey(date));
  if (override) {
    if (!override.isWorking) return 0;
    if (
      override.hoursPerDay !== undefined &&
      Number.isFinite(override.hoursPerDay)
    ) {
      return Math.max(0, override.hoursPerDay) * 60;
    }
  }
  return lookup.minutesPerDay;
}

export function createSchedulingCalendar(
  calendar?: ProjectCalendar,
): SchedulingCalendar {
  return new ProjectSchedulingCalendar(normalizeProjectCalendar(calendar));
}

export function getCalendarMinutesPerDay(calendar?: ProjectCalendar): number {
  return getCalendarLookup(calendar).minutesPerDay;
}

class ProjectSchedulingCalendar implements SchedulingCalendar {
  private lookup: CalendarLookup;

  constructor(calendar: ProjectCalendar) {
    this.lookup = getCalendarLookup(calendar);
  }

  getNextWorkingDay(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return this.skipNonWorkingDays(d);
  }

  getPreviousWorkingDay(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    while (!this.isWorkingDay(d)) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  }

  addLag(start: Date, minutesLag: number): Date {
    const current = new Date(start);
    const days = Math.ceil(minutesLag / this.lookup.minutesPerDay);
    for (let i = 0; i < days; i++) {
      current.setDate(current.getDate() + 1);
      this.skipNonWorkingDays(current);
    }
    return current;
  }

  subtractLag(end: Date, minutesLag: number): Date {
    const current = new Date(end);
    const days = Math.ceil(minutesLag / this.lookup.minutesPerDay);
    for (let i = 0; i < days; i++) {
      current.setDate(current.getDate() - 1);
      while (!this.isWorkingDay(current)) {
        current.setDate(current.getDate() - 1);
      }
    }
    return current;
  }

  addDuration(start: Date, minutes: number): Date {
    const current = new Date(start);
    let remaining = Math.max(0, minutes);
    if (remaining <= 0) return current;
    if (!this.isWorkingDay(current)) this.skipNonWorkingDays(current);

    while (remaining > this.minutesForDate(current)) {
      remaining -= this.minutesForDate(current);
      current.setDate(current.getDate() + 1);
      this.skipNonWorkingDays(current);
    }
    return current;
  }

  subtractDuration(end: Date, minutes: number): Date {
    const current = new Date(end);
    let remaining = Math.max(0, minutes);
    if (remaining <= 0) return current;
    while (!this.isWorkingDay(current)) {
      current.setDate(current.getDate() - 1);
    }

    while (remaining > this.minutesForDate(current)) {
      remaining -= this.minutesForDate(current);
      current.setDate(current.getDate() - 1);
      while (!this.isWorkingDay(current)) {
        current.setDate(current.getDate() - 1);
      }
    }
    return current;
  }

  private isWorkingDay(date: Date): boolean {
    const key = dateKey(date);
    const override = this.lookup.overridesByDate.get(key);
    if (override) return override.isWorking;
    if (!this.lookup.workDays.has(projectDayFromDate(date))) return false;
    return !this.lookup.nonWorkingDateKeys.has(key);
  }

  private minutesForDate(date: Date): number {
    const override = this.lookup.overridesByDate.get(dateKey(date));
    if (override) {
      if (!override.isWorking) return 0;
      if (
        override.hoursPerDay !== undefined &&
        Number.isFinite(override.hoursPerDay)
      ) {
        return Math.max(0, override.hoursPerDay) * 60;
      }
    }
    return this.lookup.minutesPerDay;
  }

  private skipNonWorkingDays(date: Date): Date {
    while (!this.isWorkingDay(date)) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }
}
