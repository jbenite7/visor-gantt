import { colombiaHolidaysForYear, withColombiaHolidays } from "./colombiaHolidays";
import type { ProjectCalendar } from "@/types/calendar";

describe("colombiaHolidaysForYear", () => {
  test("generates fixed, Emiliani, and Easter-based holidays", () => {
    const holidays = colombiaHolidaysForYear(2026);

    expect(holidays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-01-01", name: "Año Nuevo" }),
        expect.objectContaining({ date: "2026-01-12", name: "Día de los Reyes Magos" }),
        expect.objectContaining({ date: "2026-04-02", name: "Jueves Santo" }),
        expect.objectContaining({ date: "2026-04-03", name: "Viernes Santo" }),
        expect.objectContaining({ date: "2026-07-20", name: "Día de la Independencia" }),
      ]),
    );
  });
});

describe("withColombiaHolidays", () => {
  const calendar: ProjectCalendar = {
    timeZone: "America/Bogota",
    workDays: [1, 2, 3, 4, 5],
    startHour: "08:00",
    endHour: "17:00",
    hoursPerDay: 8,
    nonWorkingDays: [{ id: "existing", date: "2026-01-01", name: "Cierre propio" }],
    dateOverrides: [],
  };

  test("adds holidays for imported years without duplicating existing exceptions", () => {
    const enriched = withColombiaHolidays(calendar, [2026, 2026]);

    expect(enriched.nonWorkingDays.filter((day) => day.date === "2026-01-01")).toEqual([
      { id: "existing", date: "2026-01-01", name: "Cierre propio" },
    ]);
    expect(enriched.nonWorkingDays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-05-18", name: "Ascensión del Señor" }),
      ]),
    );
  });
});
