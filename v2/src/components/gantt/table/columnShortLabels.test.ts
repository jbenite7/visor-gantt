import { DEFAULT_COLUMNS } from "./GanttTable";

describe("Abreviaturas de columna (R2)", () => {
  test("ninguna abreviatura es más larga que su título: sería un error de datos", () => {
    const invertidas = DEFAULT_COLUMNS.filter((column) => {
      const es = column.shortLabelEs;
      const en = column.shortLabelEn;
      return (
        (es != null && es.length > (column.labelEs ?? column.label).length) ||
        (en != null && en.length > (column.labelEn ?? column.label).length)
      );
    }).map((column) => column.key);

    expect(invertidas).toEqual([]);
  });

  test("toda columna cuyo título pase de 8 caracteres declara abreviatura", () => {
    const sinAbreviar = DEFAULT_COLUMNS.filter(
      (column) =>
        (column.labelEs ?? column.label).length > 8 &&
        column.shortLabelEs == null,
    ).map((column) => column.key);

    expect(sinAbreviar).toEqual([]);
  });

  test("las columnas cortas no declaran abreviatura: no la necesitan", () => {
    expect(
      DEFAULT_COLUMNS.find((column) => column.key === "id")?.shortLabelEs,
    ).toBeUndefined();
    expect(
      DEFAULT_COLUMNS.find((column) => column.key === "wbs")?.shortLabelEs,
    ).toBeUndefined();
  });

  test("las abreviaturas históricas se conservan tal cual", () => {
    const porClave = new Map(DEFAULT_COLUMNS.map((c) => [c.key, c]));
    expect(porClave.get("duration")?.shortLabelEs).toBe("Dur.");
    expect(porClave.get("predecessors")?.shortLabelEs).toBe("Pred.");
    expect(porClave.get("critical")?.shortLabelEs).toBe("Crít.");
  });
});
