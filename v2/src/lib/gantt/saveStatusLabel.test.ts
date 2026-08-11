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

/**
 * En modo mirador el indicador decía «Guardado automático activo».
 *
 * Lo vi en el navegador al recorrer `/ver/<token>`, con toda la suite en verde:
 * un cartel que promete que se está guardando, en la única pantalla donde no se
 * guarda nada. Es el mismo patrón —un control que promete y no cumple— que este
 * trabajo lleva semanas eliminando.
 */
describe("saveStatusLabel en solo lectura (E51)", () => {
  test("no promete un guardado que no ocurre", () => {
    const texto = saveStatusLabel("idle", null, { readOnly: true });

    expect(texto).not.toMatch(/guardado autom/i);
  });

  test("dice lo que sí es cierto: que se está mirando", () => {
    expect(saveStatusLabel("idle", null, { readOnly: true })).toMatch(
      /solo lectura|mirando|no se guarda/i,
    );
  });

  test("con una hora de guardado antigua tampoco la enseña: confundiría", () => {
    const texto = saveStatusLabel("idle", new Date("2026-08-11T10:30:00"), {
      readOnly: true,
    });

    expect(texto).not.toMatch(/10:30/);
  });

  test("sin readOnly, todo sigue igual que antes", () => {
    expect(saveStatusLabel("idle", null)).toBe("Guardado automático activo");
    expect(saveStatusLabel("saving", null)).toBe("Guardando…");
  });
});
