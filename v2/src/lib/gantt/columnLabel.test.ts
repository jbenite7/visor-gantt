import { pickColumnLabel } from "./columnLabel";

describe("pickColumnLabel (R2: abreviar en vez de cortar)", () => {
  test("con ancho de sobra usa el título completo", () => {
    expect(
      pickColumnLabel({ label: "Predecesoras", shortLabel: "Pred.", width: 180 }),
    ).toBe("Predecesoras");
  });

  test("cuando el título no cabe usa la abreviatura declarada", () => {
    expect(
      pickColumnLabel({ label: "Predecesoras", shortLabel: "Pred.", width: 60 }),
    ).toBe("Pred.");
  });

  test("sin abreviatura declarada se queda con el título: nunca inventa una", () => {
    expect(pickColumnLabel({ label: "Varianza", width: 40 })).toBe("Varianza");
  });

  test("si la abreviatura tampoco cabe, se usa igual: es lo mejor disponible", () => {
    expect(
      pickColumnLabel({
        label: "Costo presupuestado",
        shortLabel: "Costo pres.",
        width: 30,
      }),
    ).toBe("Costo pres.");
  });

  test("el ancho justo de la última letra todavía cuenta como que cabe", () => {
    // 5 caracteres × 7,2 px = 36 px, más 16 px de padding = 52 px exactos.
    expect(
      pickColumnLabel({ label: "Fecha", shortLabel: "Fec.", width: 52 }),
    ).toBe("Fecha");
    expect(
      pickColumnLabel({ label: "Fecha", shortLabel: "Fec.", width: 51 }),
    ).toBe("Fec.");
  });

  test("un ancho desconocido no obliga a abreviar", () => {
    expect(
      pickColumnLabel({ label: "Predecesoras", shortLabel: "Pred.", width: 0 }),
    ).toBe("Predecesoras");
  });
});
