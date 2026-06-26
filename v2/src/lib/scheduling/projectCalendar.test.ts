import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import {
  isProjectWorkingDay,
  normalizeProjectCalendar,
  validateProjectCalendar,
} from "./projectCalendar";

describe("project calendar helpers", () => {
  test("uses project work days and non-working date exceptions", () => {
    const calendar = {
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5],
      nonWorkingDays: [
        { id: "holiday", date: "2026-01-06", name: "Día no laboral" },
      ],
    };

    expect(isProjectWorkingDay(new Date("2026-01-05T08:00:00"), calendar)).toBe(
      true,
    );
    expect(isProjectWorkingDay(new Date("2026-01-10T08:00:00"), calendar)).toBe(
      false,
    );
    expect(isProjectWorkingDay(new Date("2026-01-06T08:00:00"), calendar)).toBe(
      false,
    );
  });

  test("normalizes partial calendars with defaults", () => {
    const calendar = normalizeProjectCalendar({
      workDays: [1, 2, 3, 4, 5],
      nonWorkingDays: [{ id: "x", date: "2026-01-06", name: "" }],
    });

    expect(calendar.timeZone).toBe(DEFAULT_PROJECT_CALENDAR.timeZone);
    expect(calendar.workDays).toEqual([1, 2, 3, 4, 5]);
    expect(calendar.nonWorkingDays).toEqual([
      { id: "x", date: "2026-01-06", name: "Día no laboral" },
    ]);
  });

  test("validates duplicate exceptions and empty work weeks", () => {
    const issues = validateProjectCalendar({
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [],
      nonWorkingDays: [
        { id: "a", date: "2026-01-06", name: "A" },
        { id: "b", date: "2026-01-06", name: "B" },
      ],
    });

    expect(issues.some((issue) => issue.kind === "emptyWorkWeek")).toBe(true);
    expect(issues.some((issue) => issue.kind === "duplicateException")).toBe(
      true,
    );
  });
});
