import { saveStatusLabel } from "./saveStatusLabel";

describe("indicador de guardado", () => {
  test("el mensaje de error no incluye la acción: esa es del botón", () => {
    expect(saveStatusLabel("error", null)).toBe("No se pudo guardar");
    expect(saveStatusLabel("error", null)).not.toMatch(/reintentar/i);
  });

  test("sigue diciendo la hora del último guardado", () => {
    expect(saveStatusLabel("idle", new Date(2026, 7, 7, 9, 5))).toBe(
      "Guardado a las 09:05",
    );
  });

  test("mientras guarda lo dice", () => {
    expect(saveStatusLabel("saving", null)).toBe("Guardando…");
  });
});
