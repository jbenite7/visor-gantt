import {
  createProjectDate,
  formatProjectDate,
  getConfiguredTimeZone,
  toDateInputValue,
  formatIsoDay,
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

/**
 * Una fecha ISO de solo día, escrita como la lee un jefe de obra.
 *
 * Estaba duplicada palabra por palabra en `LastPlannerView` y en el tablero
 * ejecutivo, y una tercera pantalla —la del enlace compartido— la escribía
 * distinto: `11/8/2026` en vez de `11/08/2026`. La misma app enseñando la misma
 * fecha de dos formas.
 *
 * No se pasa por `Date` a propósito: un ISO de solo día convertido a `Date` y
 * formateado con zona horaria puede caer en el día anterior. Aquí se leen los
 * trozos y ya.
 */
describe("formatIsoDay", () => {
  test("escribe día, mes y año con dos cifras", () => {
    expect(formatIsoDay("2026-08-05")).toBe("05/08/2026");
  });

  test("acepta una fecha con hora, que es como llega de la base", () => {
    expect(formatIsoDay("2026-08-05T14:30:00.000Z")).toBe("05/08/2026");
  });

  test("no cruza de día por la zona horaria", () => {
    // Convertir esto a `Date` y formatearlo en Bogotá daría el día 4.
    expect(formatIsoDay("2026-08-05T02:00:00.000Z")).toBe("05/08/2026");
  });

  test("una entrada que no es fecha no revienta la pantalla", () => {
    expect(formatIsoDay("")).toBe("");
  });
});
