import { normalizeName, significantTokens } from "./normalize";

describe("normalizeName", () => {
  test("quita tildes, sube a mayúsculas y colapsa espacios", () => {
    expect(normalizeName("  Mampostería   Sótano 3 ")).toBe("MAMPOSTERIA SOTANO 3");
  });

  test("la eñe se convierte en ene, como en el motor de PDC", () => {
    expect(normalizeName("Ventanería")).toBe("VENTANERIA");
  });

  test("el mismo nombre escrito con y sin tilde normaliza igual", () => {
    expect(normalizeName("SÓTANO 2")).toBe(normalizeName("SOTANO 2"));
  });
});

describe("significantTokens", () => {
  test("descarta las palabras de dos letras o menos", () => {
    expect(significantTokens("URBANISMO Y OBRAS EXTERIORES")).toEqual([
      "URBANISMO",
      "OBRAS",
      "EXTERIORES",
    ]);
  });

  test("descarta las palabras vacías de la lista", () => {
    expect(significantTokens("PISOS Y ENCHAPES DE LAS ZONAS")).toEqual([
      "PISOS",
      "ENCHAPES",
      "ZONAS",
    ]);
  });

  test("quita la puntuación y no repite palabras", () => {
    expect(significantTokens("REVOQUES, ESTUCO Y PINTURA. PINTURA")).toEqual([
      "REVOQUES",
      "ESTUCO",
      "PINTURA",
    ]);
  });
});
