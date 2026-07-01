export interface CalendarException {
  id: string;
  date: string;
  name: string;
}

export interface CalendarDateOverride extends CalendarException {
  isWorking: boolean;
  startHour?: string;
  endHour?: string;
  hoursPerDay?: number;
}

export interface ProjectCalendar {
  timeZone: string;
  workDays: number[];
  startHour: string;
  endHour: string;
  hoursPerDay: number;
  nonWorkingDays: CalendarException[];
  dateOverrides: CalendarDateOverride[];
}

export const DEFAULT_PROJECT_CALENDAR: ProjectCalendar = {
  timeZone: "America/Bogota",
  workDays: [1, 2, 3, 4, 5, 6],
  startHour: "08:00",
  endHour: "17:00",
  hoursPerDay: 8,
  nonWorkingDays: [],
  dateOverrides: [],
};
