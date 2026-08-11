import { formatLobTickLabel } from "./lobTickLabel";

/**
 * **Estos tests no demuestran un bug arreglado.** Se escribieron creyendo que
 * el eje se corría un día, y al medirlo resultó que no: las marcas se
 * construyen a medianoche local, y sobre esas leer local o UTC da lo mismo.
 *
 * Se quedan porque fijan el comportamiento correcto para el caso que sí puede
 * llegar aquí —una fecha a medianoche UTC, como la que produce
 * `new Date("2026-08-05")`— y porque la función estaba encerrada en el
 * componente y no se podía probar en absoluto.
 */
describe("formatLobTickLabel", () => {
  // 5 de agosto de 2026 a medianoche UTC: en Bogotá, el 4 por la tarde.
  const cincoDeAgosto = new Date("2026-08-05T00:00:00.000Z");

  test("en escala de día enseña el día que es, no el anterior", () => {
    expect(formatLobTickLabel(cincoDeAgosto, "day")).toMatch(/^5 /);
  });

  test("el mes también sale del día correcto", () => {
    // 1 de septiembre UTC: en Bogotá sería el 31 de agosto.
    const uno = new Date("2026-09-01T00:00:00.000Z");

    expect(formatLobTickLabel(uno, "day")).toMatch(/sep/i);
  });

  test("en escala de mes, el mes es el de la fecha", () => {
    expect(formatLobTickLabel(cincoDeAgosto, "month")).toMatch(/ago/i);
    expect(formatLobTickLabel(cincoDeAgosto, "month")).toContain("2026");
  });

  test("el trimestre se calcula sobre el mes correcto", () => {
    // 1 de octubre UTC es T4; leído en Bogotá seria 30 de septiembre, T3.
    const uno = new Date("2026-10-01T00:00:00.000Z");

    expect(formatLobTickLabel(uno, "quarter")).toBe("T4 2026");
  });

  test("la semana enseña su día sin correrse", () => {
    expect(formatLobTickLabel(cincoDeAgosto, "week")).toContain("5 ");
  });
});
