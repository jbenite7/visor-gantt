import { formatLobTickLabel } from "./lobTickLabel";

/**
 * Las etiquetas del eje de la Línea de Balance salían **un día antes**.
 *
 * Las fechas del cronograma se construyen a medianoche UTC. El eje las leía con
 * `date.getDate()` y `toLocaleString("es-ES")`, que usan la zona de la máquina:
 * en Bogotá (UTC-5), la medianoche UTC del día 5 es el día 4 por la tarde, así
 * que **cada marca del eje iba corrida un día**.
 *
 * Pasa en la pantalla que sirve para ver a qué ritmo avanza cada piso, donde el
 * día importa.
 *
 * Además formateaba en `es-ES` mientras el resto de la app usa `es-CO`.
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
