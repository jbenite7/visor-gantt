import {
  createProjectDate,
  formatProjectDate,
  getConfiguredTimeZone,
  toDateInputValue,
} from "./projectDate";

function restoreProjectTimeZone(previousTimeZone: string | undefined) {
  if (previousTimeZone === undefined) {
    delete process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE;
    return;
  }

  process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE = previousTimeZone;
}

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

  test("uses Colombia as stable default project time zone", () => {
    const previousTimeZone = process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE;
    delete process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE;

    expect(getConfiguredTimeZone()).toBe("America/Bogota");

    restoreProjectTimeZone(previousTimeZone);
  });

  test("uses the configured project time zone when provided", () => {
    const previousTimeZone = process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE;
    process.env.NEXT_PUBLIC_PROJECT_TIME_ZONE = "UTC";

    expect(getConfiguredTimeZone()).toBe("UTC");

    restoreProjectTimeZone(previousTimeZone);
  });
});
