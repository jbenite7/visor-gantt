import { UNIT_PATTERNS, extractUnitLabel } from "./unitPatterns";

describe("extractUnitLabel (ahora sobre el motor de detección)", () => {
  test("sigue devolviendo etiqueta y valor como antes", () => {
    expect(extractUnitLabel("Mampostería Piso 3")).toEqual({
      label: "Piso",
      value: "3",
      numericValue: 3,
    });
  });

  test("ahora reconoce los sótanos, que es lo que fallaba", () => {
    expect(extractUnitLabel("COLUMNAS SÓTANO 2")).toEqual({
      label: "Sótano",
      value: "2",
      numericValue: -2,
    });
  });

  test("la torre sigue reconociéndose", () => {
    expect(extractUnitLabel("Estructura Torre B")?.label).toBe("Torre");
  });

  test("lo que no tiene ubicación sigue devolviendo null", () => {
    expect(extractUnitLabel("Descabece de pilotes")).toBeNull();
  });

  test("UNIT_PATTERNS sigue existiendo como lista única para quien la recorra", () => {
    expect(UNIT_PATTERNS.length).toBeGreaterThan(0);
    expect(UNIT_PATTERNS.every((pattern) => pattern.regex instanceof RegExp)).toBe(true);
  });

  test("los patrones sirven sobre texto en minúsculas, que es como los usa lob.ts", () => {
    // `lob.ts` limpia el nombre de la actividad sobre texto ya normalizado a
    // minúsculas y sin tildes. Si los patrones no aceptaran minúsculas, la
    // Línea de Balance dejaría de agrupar actividades.
    const limpio = UNIT_PATTERNS.reduce(
      (text, pattern) => text.replace(pattern.regex, " "),
      "mamposteria piso 3",
    );
    expect(limpio.trim()).toBe("mamposteria");
  });
});
