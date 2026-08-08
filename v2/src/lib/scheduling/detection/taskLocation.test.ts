import { resolveTaskLocation } from "./taskLocation";
import { EMPTY_DETECTION_DICTIONARY, rememberCorrection } from "./dictionary";
import type { GanttTask } from "@/components/gantt/types";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: "Actividad",
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-09T17:00:00"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("resolveTaskLocation", () => {
  test("el nombre propio manda", () => {
    const hoja = task({ id: 1, name: "COLUMNAS SÓTANO 3", wbs: "2.1" });
    const result = resolveTaskLocation(hoja, [hoja]);

    expect(result.location?.value).toBe(-3);
    expect(result.scope).toBe("propia");
  });

  test("si la tarea no lo dice, lo hereda de la tarea padre", () => {
    // Estructura real de DA PORTO: ACABADOS › MAMPOSTERÍA › SÓTANO 2 › la hoja
    const acabados = task({ id: 1, name: "ACABADOS", wbs: "3", isSummary: true });
    const mamposteria = task({ id: 2, name: "MAMPOSTERÍA", wbs: "3.1", isSummary: true });
    const sotano = task({ id: 3, name: "SOTANO 2", wbs: "3.1.3", isSummary: true });
    const hoja = task({ id: 4, name: "MURO EN LADRILLO", wbs: "3.1.3.1" });

    const result = resolveTaskLocation(hoja, [acabados, mamposteria, sotano, hoja]);

    expect(result.location?.value).toBe(-2);
    expect(result.location?.label).toBe("Sótano");
    expect(result.scope).toBe("heredada");
    expect(result.evidence).toContain("SOTANO 2");
  });

  test("hereda del padre más cercano, no del abuelo", () => {
    const torre = task({ id: 1, name: "TORRE 3", wbs: "1", isSummary: true });
    const piso = task({ id: 2, name: "PISO 7", wbs: "1.2", isSummary: true });
    const hoja = task({ id: 3, name: "REVOQUE TRADICIONAL", wbs: "1.2.1" });

    const result = resolveTaskLocation(hoja, [torre, piso, hoja]);

    expect(result.location).toEqual({ label: "Piso", raw: "7", value: 7 });
  });

  test("lo que no tiene ubicación por piso se marca como obra general, no se descarta", () => {
    const hoja = task({ id: 1, name: "VÍAS INTERNAS", wbs: "5.1" });
    const result = resolveTaskLocation(hoja, [hoja]);

    expect(result.location).toBeNull();
    expect(result.scope).toBe("obraGeneral");
    expect(result.evidence).toContain("obra general");
  });

  test("una corrección guardada gana a todo lo demás", () => {
    const dictionary = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "ubicacion",
      name: "CUARTO DE MÁQUINAS",
      value: "-1",
      note: "El cuarto de máquinas está en el sótano 1.",
      recordedAt: "2026-08-07T10:00:00.000Z",
    });
    const hoja = task({ id: 1, name: "CUARTO DE MÁQUINAS", wbs: "2.9" });

    const result = resolveTaskLocation(hoja, [hoja], dictionary);

    expect(result.location?.value).toBe(-1);
    expect(result.scope).toBe("diccionario");
    expect(result.evidence).toContain("sótano 1");
  });
});
