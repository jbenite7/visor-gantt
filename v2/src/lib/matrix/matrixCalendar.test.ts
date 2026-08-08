import {
  matrixAddWorkDays,
  matrixFinishFromDuration,
  matrixNextWorkDay,
} from "./matrixCalendar";
import type { ProjectCalendar } from "@/types/calendar";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";

/** Lunes a viernes, con el 20 de julio (festivo colombiano) fuera. */
const calendarioObra: ProjectCalendar = {
  ...DEFAULT_PROJECT_CALENDAR,
  workDays: [1, 2, 3, 4, 5],
  nonWorkingDays: [{ id: "f1", date: "2026-07-20", name: "Día de la Independencia" }],
};

describe("matrixAddWorkDays", () => {
  test("sin calendario mantiene el comportamiento de siempre: solo salta el domingo", () => {
    // Viernes 2026-07-17 + 2 días laborables = lunes 20: trabaja el sábado 18
    // y salta el domingo 19. Es la regla histórica del generador, y este test
    // es lo único que impide que alguien la cambie sin darse cuenta.
    const result = matrixAddWorkDays(new Date("2026-07-17T00:00:00"), 2);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  test("con calendario de lunes a viernes salta también el sábado", () => {
    // Viernes 17 + 2 laborables = martes 21 (salta sábado 18 y domingo 19; el lunes 20 es festivo)
    const result = matrixAddWorkDays(
      new Date("2026-07-17T00:00:00"),
      2,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-22");
  });

  test("respeta los festivos del proyecto", () => {
    // Viernes 17 + 1 laborable: el lunes 20 es festivo, así que cae en martes 21
    const result = matrixAddWorkDays(
      new Date("2026-07-17T00:00:00"),
      1,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-21");
  });

  test("cero días devuelve el mismo día", () => {
    const result = matrixAddWorkDays(new Date("2026-07-17T00:00:00"), 0, calendarioObra);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-17");
  });
});

describe("matrixFinishFromDuration", () => {
  test("una tarea de un día empieza y termina el mismo día", () => {
    const result = matrixFinishFromDuration(
      new Date("2026-07-15T00:00:00"),
      1,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  test("una tarea de cinco días cruzando festivo termina un día después", () => {
    // Miércoles 15 + 5 días = 15, 16, 17, 21, 22 (salta finde y el festivo del 20)
    const result = matrixFinishFromDuration(
      new Date("2026-07-15T00:00:00"),
      5,
      calendarioObra,
    );
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
});

describe("matrixNextWorkDay", () => {
  test("el siguiente día laborable salta el fin de semana y el festivo", () => {
    const result = matrixNextWorkDay(new Date("2026-07-17T00:00:00"), 0, calendarioObra);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-21");
  });

  test("con desfase suma días laborables adicionales", () => {
    const result = matrixNextWorkDay(new Date("2026-07-17T00:00:00"), 1, calendarioObra);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-22");
  });
});
