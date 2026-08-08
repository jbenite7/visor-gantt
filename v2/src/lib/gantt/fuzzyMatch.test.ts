import { fuzzyMatches } from "./fuzzyMatch";

describe("la paleta perdona una errata (M36)", () => {
  test("encuentra lo exacto", () => {
    expect(fuzzyMatches("Guardar ahora", "guardar")).toBe(true);
  });

  test("perdona una letra cambiada", () => {
    expect(fuzzyMatches("Guardar ahora", "guardsr")).toBe(true);
  });

  test("perdona una letra que falta", () => {
    expect(fuzzyMatches("Diagrama de red", "diagrma")).toBe(true);
  });

  test("perdona el orden de dos letras", () => {
    expect(fuzzyMatches("Curva S", "cruva")).toBe(true);
  });

  test("no encuentra lo que no está: tolerar no es adivinar", () => {
    expect(fuzzyMatches("Guardar ahora", "presupuesto")).toBe(false);
  });

  test("una consulta vacía no filtra nada", () => {
    expect(fuzzyMatches("Guardar ahora", "")).toBe(true);
    expect(fuzzyMatches("Guardar ahora", "   ")).toBe(true);
  });

  test("ignora tildes y mayúsculas: nadie escribe «Típica» con tilde aquí", () => {
    expect(fuzzyMatches("Unidad Típica", "unidad tipica")).toBe(true);
    expect(fuzzyMatches("Línea Balance", "linea")).toBe(true);
  });

  test("una consulta de dos letras no abre la puerta a todo", () => {
    expect(fuzzyMatches("Guardar ahora", "zx")).toBe(false);
  });
});
