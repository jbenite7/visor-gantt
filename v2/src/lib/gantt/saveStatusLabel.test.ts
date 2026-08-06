import { saveStatusLabel } from "./saveStatusLabel";

describe("saveStatusLabel", () => {
  test("en reposo, sin haber guardado aún, dice que el guardado está activo", () => {
    expect(saveStatusLabel("idle", null)).toBe("Guardado automático activo");
  });

  test("en reposo, tras guardar, dice a qué hora fue", () => {
    const at = new Date("2026-08-06T14:35:00");
    expect(saveStatusLabel("idle", at)).toBe("Guardado a las 14:35");
  });

  test("mientras guarda no muestra la hora vieja: informa que está guardando", () => {
    expect(saveStatusLabel("saving", new Date("2026-08-06T14:35:00"))).toBe(
      "Guardando…",
    );
  });

  test("recién guardado lo confirma con su hora", () => {
    expect(saveStatusLabel("saved", new Date("2026-08-06T09:05:00"))).toBe(
      "Guardado a las 09:05",
    );
  });

  test("el error dice qué hacer, no solo que falló", () => {
    expect(saveStatusLabel("error", null)).toBe("No se pudo guardar. Reintentar");
  });
});
