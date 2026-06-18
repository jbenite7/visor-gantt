import { CalendarService } from "./calendar";

// Mock DB because real DB connection in unit test is overkill usually,
// but for Hybrid system integration test, we might mock the pool.
// Here we test logic mainly.

describe("CalendarService Logic", () => {
  let service: CalendarService;

  beforeEach(() => {
    service = new CalendarService();
    // Setup manual weekdays for testing (Default: Mon-Sat work, Sun off)
    // XML: 1=Sun (Off), 2-7 (Work)
    service.setWorkDays({
      1: false, // Sun
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
      7: true, // Sat
    });
  });

  test("isWorkingDay should respect Sundays", () => {
    const sunday = new Date("2023-01-01T00:00:00"); // Known Sunday
    expect(service.isWorkingDay(sunday)).toBe(false);

    const monday = new Date("2023-01-02T00:00:00");
    expect(service.isWorkingDay(monday)).toBe(true);
  });

  test("addDuration should skip Sundays", () => {
    // Fri Jan 6 2023. Duration 2 days.
    // Day 1: Fri 6
    // Day 2: Sat 7 (Working)
    // Result: Sat 7? No, End Date.
    // Wait, logic says: loops = days - 1. 2 days -> 1 loop.
    // Fri + 1 = Sat.

    const start = new Date("2023-01-06T08:00:00"); // Friday
    const end = service.addDuration(start, 960); // 16 hours = 2 days

    // Expected: Sat Jan 7
    expect(end.toISOString().split("T")[0]).toBe("2023-01-07");
  });

  test("addDuration cross Sunday", () => {
    // Sat Jan 7 2023. Duration 2 days.
    // Day 1: Sat 7.
    // Day 2: Next Working. Sun 8 (Skip). Mon 9.
    // Result: Mon 9.

    const start = new Date("2023-01-07T08:00:00"); // Sat
    const end = service.addDuration(start, 960); // 2 days

    expect(end.toISOString().split("T")[0]).toBe("2023-01-09");
  });
});
