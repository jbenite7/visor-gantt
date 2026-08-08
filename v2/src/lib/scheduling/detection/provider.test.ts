import {
  getDetectionProvider,
  localDetectionProvider,
  setDetectionProvider,
  type DetectionProvider,
} from "./provider";
import type { GanttTask } from "@/components/gantt/types";

const tarea: GanttTask = {
  id: 1,
  name: "COLUMNAS SÓTANO 2",
  start: new Date("2026-01-05T08:00:00"),
  finish: new Date("2026-01-09T17:00:00"),
  duration: 5,
  progress: 0,
  isCritical: false,
  isMilestone: false,
  isSummary: false,
  outlineLevel: 1,
  dependencies: [],
};

describe("DetectionProvider", () => {
  afterEach(() => setDetectionProvider(localDetectionProvider));

  test("por defecto el motor es el local", () => {
    expect(getDetectionProvider().id).toBe("local");
  });

  test("el proveedor local resuelve ubicación y sistema", () => {
    const provider = getDetectionProvider();

    expect(provider.locationOf(tarea, [tarea]).location?.value).toBe(-2);
    expect(
      provider.systemOf({ name: "Urbanismo", candidates: ["URBANISMO"] }).origin,
    ).toBe("exacta");
  });

  test("se puede sustituir por otro sin que el consumidor cambie", () => {
    const remoto: DetectionProvider = {
      id: "prueba",
      locationOf: () => ({
        location: { label: "Piso", raw: "99", value: 99 },
        scope: "propia",
        evidence: "Respuesta del servicio de prueba.",
      }),
      systemOf: () => ({
        system: "Estructura",
        origin: "automatica",
        evidence: "Respuesta del servicio de prueba.",
      }),
    };

    setDetectionProvider(remoto);

    expect(getDetectionProvider().id).toBe("prueba");
    expect(getDetectionProvider().locationOf(tarea, [tarea]).location?.value).toBe(99);
  });
});
