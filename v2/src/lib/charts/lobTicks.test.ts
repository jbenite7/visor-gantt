import { inicioDeDiaUTC, inicioDeMesUTC, inicioDeSemanaUTC, inicioDeTrimestreUTC } from "./lobTicks";
import { formatLobTickLabel } from "./lobTickLabel";

/**
 * El eje de la Línea de Balance rotulaba las tareas **un día antes**, y esta vez
 * está medido sobre datos reales de la base, no deducido.
 *
 * En el `.mpp` de obra «20260312 DA PORTO TORRE 3» hay **1.185 fechas a
 * medianoche UTC exacta**. En Bogotá eso es el día anterior a las 19:00, así
 * que `setHours(0, 0, 0, 0)` —que era como se colocaba cada marca— las movía al
 * día de antes:
 *
 *     tarea del cronograma : 2026-01-05T00:00:00.000Z  (5 de enero)
 *     marca calculada      : 2026-01-04T05:00:00.000Z
 *     etiqueta             : 4 ene
 *
 * Las tres formas de fecha que hay de verdad en la base, medidas:
 *   - 05:00:00Z — medianoche de Bogotá, proyectos creados en la app
 *   - 14:00:00Z — 9 de la mañana, tareas del `.mpp` real
 *   - 00:00:00Z — medianoche UTC, 1.185 tareas del `.mpp` real
 *
 * Calcular en UTC acierta con las tres. Calcular en local falla con la tercera.
 */
describe("las marcas del eje se colocan sin correr el día", () => {
  const medianocheUTC = new Date("2026-01-05T00:00:00.000Z");
  const medianocheBogota = new Date("2026-08-05T05:00:00.000Z");
  const mañanaDelMpp = new Date("2026-01-05T14:00:00.000Z");

  test("una tarea a medianoche UTC se rotula en su día, no en el anterior", () => {
    expect(formatLobTickLabel(inicioDeDiaUTC(medianocheUTC), "day")).toBe("5 ene");
  });

  test("y las otras dos formas de fecha siguen bien", () => {
    expect(formatLobTickLabel(inicioDeDiaUTC(medianocheBogota), "day")).toBe("5 ago");
    expect(formatLobTickLabel(inicioDeDiaUTC(mañanaDelMpp), "day")).toBe("5 ene");
  });

  test("el mes no se va al anterior", () => {
    const primeroDeMes = new Date("2026-09-01T00:00:00.000Z");

    expect(formatLobTickLabel(inicioDeMesUTC(primeroDeMes), "month")).toBe("sep 2026");
  });

  test("el trimestre tampoco", () => {
    const primeroDeOctubre = new Date("2026-10-01T00:00:00.000Z");

    expect(formatLobTickLabel(inicioDeTrimestreUTC(primeroDeOctubre), "quarter")).toBe("T4 2026");
  });

  test("la semana empieza en lunes, contado en UTC", () => {
    // 2026-01-07 es miércoles; su lunes es el 5.
    const miercoles = new Date("2026-01-07T00:00:00.000Z");

    expect(inicioDeSemanaUTC(miercoles).getUTCDate()).toBe(5);
  });
});
