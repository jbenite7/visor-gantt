import type { SchedulingCalendar } from "./cpm";
import {
  DEFAULT_PROJECT_CALENDAR,
  type CalendarException,
  type ProjectCalendar,
} from "@/types/calendar";

export type CalendarIssueKind =
  | "emptyWorkWeek"
  | "duplicateException"
  | "invalidExceptionDate"
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

  return {
    timeZone: raw?.timeZone?.trim() || DEFAULT_PROJECT_CALENDAR.timeZone,
    workDays:
      workDays.length > 0 ? workDays : DEFAULT_PROJECT_CALENDAR.workDays,
    startHour: raw?.startHour || DEFAULT_PROJECT_CALENDAR.startHour,
    endHour: raw?.endHour || DEFAULT_PROJECT_CALENDAR.endHour,
    hoursPerDay: raw?.hoursPerDay ?? DEFAULT_PROJECT_CALENDAR.hoursPerDay,
    nonWorkingDays,
  };
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

  return issues;
}

export function isProjectWorkingDay(
  date: Date,
  calendar: ProjectCalendar,
): boolean {
  const normalized = normalizeProjectCalendar(calendar);
  const projectDay = projectDayFromDate(date);
  if (!normalized.workDays.includes(projectDay)) return false;
  return !normalized.nonWorkingDays.some((day) => day.date === dateKey(date));
}

export function createSchedulingCalendar(
  calendar?: ProjectCalendar,
): SchedulingCalendar {
  return new ProjectSchedulingCalendar(normalizeProjectCalendar(calendar));
}

export function getCalendarMinutesPerDay(calendar?: ProjectCalendar): number {
  return Math.max(1, normalizeProjectCalendar(calendar).hoursPerDay) * 60;
}

class ProjectSchedulingCalendar implements SchedulingCalendar {
  constructor(private calendar: ProjectCalendar) {}

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
    const days = Math.ceil(minutesLag / getCalendarMinutesPerDay(this.calendar));
    for (let i = 0; i < days; i++) {
      current.setDate(current.getDate() + 1);
      this.skipNonWorkingDays(current);
    }
    return current;
  }

  subtractLag(end: Date, minutesLag: number): Date {
    const current = new Date(end);
    const days = Math.ceil(minutesLag / getCalendarMinutesPerDay(this.calendar));
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
    const daysNeeded = Math.ceil(minutes / getCalendarMinutesPerDay(this.calendar));
    if (daysNeeded <= 0) return current;
    for (let i = 0; i < daysNeeded - 1; i++) {
      current.setDate(current.getDate() + 1);
      this.skipNonWorkingDays(current);
    }
    return current;
  }

  subtractDuration(end: Date, minutes: number): Date {
    const current = new Date(end);
    const daysNeeded = Math.ceil(minutes / getCalendarMinutesPerDay(this.calendar));
    if (daysNeeded <= 0) return current;
    for (let i = 0; i < daysNeeded - 1; i++) {
      current.setDate(current.getDate() - 1);
      while (!this.isWorkingDay(current)) {
        current.setDate(current.getDate() - 1);
      }
    }
    return current;
  }

  private isWorkingDay(date: Date): boolean {
    return isProjectWorkingDay(date, this.calendar);
  }

  private skipNonWorkingDays(date: Date): Date {
    while (!this.isWorkingDay(date)) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }
}
