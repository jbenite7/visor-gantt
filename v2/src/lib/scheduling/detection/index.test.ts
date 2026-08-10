import * as detection from "./index";

describe("superficie pública del motor de detección", () => {
  test("expone las piezas que los consumidores necesitan", () => {
    expect(typeof detection.extractLocation).toBe("function");
    expect(typeof detection.formatLocationLabel).toBe("function");
    expect(typeof detection.resolveTaskLocation).toBe("function");
    expect(typeof detection.resolveSystem).toBe("function");
    expect(typeof detection.summarizeDetection).toBe("function");
    expect(typeof detection.rememberCorrection).toBe("function");
    expect(detection.getDetectionProvider().id).toBe("local");
  });

  test("no expone el fixture de pruebas al producto", () => {
    expect("DA_PORTO_NAMES" in detection).toBe(false);
  });

  test("expone también el vocabulario de obra lineal", () => {
    expect(typeof detection.parseAxisLabel).toBe("function");
    expect(typeof detection.compareAxisLabels).toBe("function");
  });

  test("tampoco expone el fixture de la Estación 16", () => {
    expect("ESTACION_16_NAMES" in detection).toBe(false);
  });
});
