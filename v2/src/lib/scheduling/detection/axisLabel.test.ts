import { compareAxisLabels, parseAxisLabel } from "./axisLabel";

describe("parseAxisLabel", () => {
  test("una letra suelta es la familia sin nombre, con A=1", () => {
    expect(parseAxisLabel("A")).toEqual({ family: "", index: 1, raw: "A" });
    expect(parseAxisLabel("D")?.index).toBe(4);
    expect(parseAxisLabel("K")?.index).toBe(11);
  });

  test("acepta minúsculas, porque los nombres de obra las mezclan", () => {
    expect(parseAxisLabel("b")?.index).toBe(2);
  });

  test("un número es la familia de los números", () => {
    expect(parseAxisLabel("03")).toEqual({ family: "#", index: 3, raw: "03" });
    expect(parseAxisLabel("7")?.index).toBe(7);
  });

  test("una serie con prefijo conserva el prefijo como familia", () => {
    expect(parseAxisLabel("DB4")).toEqual({ family: "DB", index: 4, raw: "DB4" });
    expect(parseAxisLabel("DB08")).toEqual({ family: "DB", index: 8, raw: "DB08" });
  });

  test("lo que no es una etiqueta de eje devuelve null", () => {
    expect(parseAxisLabel("")).toBeNull();
    expect(parseAxisLabel("SUPERIOR")).toBeNull();
    expect(parseAxisLabel("-")).toBeNull();
  });
});

describe("compareAxisLabels", () => {
  test("dentro de una familia, ordena por índice", () => {
    const a = parseAxisLabel("A")!;
    const d = parseAxisLabel("D")!;
    expect(compareAxisLabels(a, d)).toBeLessThan(0);
    expect(compareAxisLabels(d, a)).toBeGreaterThan(0);
    expect(compareAxisLabels(a, a)).toBe(0);
  });

  test("entre familias distintas, ordena por familia", () => {
    // Comparar «A» con «03» no significa nada en la obra: se agrupan por
    // familia y se ordena dentro de cada una.
    const letra = parseAxisLabel("A")!;
    const numero = parseAxisLabel("03")!;
    const serie = parseAxisLabel("DB4")!;

    expect(compareAxisLabels(letra, serie)).toBeLessThan(0);
    expect(compareAxisLabels(serie, numero)).toBeLessThan(0);
  });

  test("el orden es estable: ordenar una lista da siempre lo mismo", () => {
    const etiquetas = ["DB4", "A", "03", "D", "DB08"].map((raw) => parseAxisLabel(raw)!);
    const ordenada = [...etiquetas].sort(compareAxisLabels).map((item) => item.raw);

    expect(ordenada).toEqual(["A", "D", "DB4", "DB08", "03"]);
  });
});
