import {
  createProjectDate,
  formatProjectDate,
  getConfiguredTimeZone,
  toDateInputValue,
} from "./projectDate";

describe("projectDate", () => {
  test("creates date-only project dates at local midnight", () => {
    const date = createProjectDate("2024-01-01");

    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(0);
  });

  test("formats date-only project dates without shifting to the previous day", () => {
    const date = createProjectDate("2024-01-01");

    expect(toDateInputValue(date)).toBe("2024-01-01");
    expect(formatProjectDate(date)).toContain("2024");
  });

  test("falls back to Colombia when the runtime does not expose a time zone", () => {
    expect(getConfiguredTimeZone(() => undefined)).toBe("America/Bogota");
  });
});
