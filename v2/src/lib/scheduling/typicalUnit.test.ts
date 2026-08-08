import { analyzeTypicalUnits } from "./typicalUnit";
import type { GanttTask } from "@/components/gantt/types";

function task(overrides: Partial<GanttTask>): GanttTask {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? "Task",
    start: overrides.start ?? new Date("2026-01-01T08:00:00"),
    finish: overrides.finish ?? new Date("2026-01-02T17:00:00"),
    duration: overrides.duration ?? 2,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: overrides.outlineLevel ?? 1,
    dependencies: [],
    wbs: overrides.wbs,
  };
}

describe("analyzeTypicalUnits", () => {
  test("groups repeated systems across three or more levels", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Mampostería Piso 1", wbs: "1.1.1" }),
      task({ id: 2, name: "Mampostería Piso 2", wbs: "1.1.2" }),
      task({ id: 3, name: "Mampostería Piso 3", wbs: "1.1.3" }),
      task({ id: 4, name: "Pintura Piso 1", wbs: "1.2.1" }),
    ]);

    expect(analysis.groups).toEqual([
      expect.objectContaining({
        system: "mampostería",
        levelCount: 3,
        taskCount: 3,
      }),
    ]);
  });

  test("cada grupo de unidad tipica expone la familia de sus actividades", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Instalacion hidraulica piso 1", wbs: "1.1" }),
      task({ id: 2, name: "Instalacion hidraulica piso 2", wbs: "1.2" }),
      task({ id: 3, name: "Instalacion hidraulica piso 3", wbs: "1.3" }),
    ]);

    expect(analysis.groups[0].family.family).toBe("Redes MEP");
  });

  test("detecta niveles con la etiqueta Torre (ganada al unificar UNIT_PATTERNS)", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Instalacion hidraulica torre 1" }),
      task({ id: 2, name: "Instalacion hidraulica torre 2" }),
      task({ id: 3, name: "Instalacion hidraulica torre 3" }),
    ]);

    expect(analysis.groups).toEqual([
      expect.objectContaining({
        system: "instalacion hidraulica",
        levelCount: 3,
        taskCount: 3,
      }),
    ]);
    expect(analysis.groups[0].activities.map((a) => a.level)).toEqual([
      "Torre 1",
      "Torre 2",
      "Torre 3",
    ]);
  });

  test("detecta niveles con la etiqueta Apartamento (ganada al unificar UNIT_PATTERNS)", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Enchape apto 1" }),
      task({ id: 2, name: "Enchape apto 2" }),
      task({ id: 3, name: "Enchape apto 3" }),
    ]);

    expect(analysis.groups).toEqual([
      expect.objectContaining({
        system: "enchape",
        levelCount: 3,
        taskCount: 3,
      }),
    ]);
  });

  test("detecta niveles con la etiqueta Zona (ganada al unificar UNIT_PATTERNS)", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Cerramiento zona 1" }),
      task({ id: 2, name: "Cerramiento zona 2" }),
      task({ id: 3, name: "Cerramiento zona 3" }),
    ]);

    expect(analysis.groups).toEqual([
      expect.objectContaining({
        system: "cerramiento",
        levelCount: 3,
        taskCount: 3,
      }),
    ]);
  });

  test('"N3 Estructura" sigue detectando nivel: la n sobrevive dentro de la alternancia de Piso', () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "N1 Estructura" }),
      task({ id: 2, name: "N2 Estructura" }),
      task({ id: 3, name: "N3 Estructura" }),
    ]);

    expect(analysis.groups).toEqual([
      expect.objectContaining({ system: "estructura", levelCount: 3, taskCount: 3 }),
    ]);
    expect(analysis.groups[0].activities.map((a) => a.level)).toEqual([
      "Piso 1",
      "Piso 2",
      "Piso 3",
    ]);
  });

  // Decision: dropping the lone "p" pattern was intentional to avoid false
  // positives (a single letter matches too easily inside unrelated words).
  // This test documents that "P2 Acabados" must NOT resolve to a level; if
  // the lone pattern is ever reintroduced, this test will fail.
  test('"P2 Acabados" ya no detecta nivel (patron suelto "p" descartado a proposito)', () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "P1 Acabados" }),
      task({ id: 2, name: "P2 Acabados" }),
      task({ id: 3, name: "P3 Acabados" }),
    ]);

    expect(analysis.groups).toEqual([]);
    expect(analysis.insufficientReason).toContain("No se detectaron sistemas repetidos");
  });

  test("degrades with an informative reason when data is insufficient", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Actividad sin unidad", wbs: "1" }),
    ]);

    expect(analysis.groups).toEqual([]);
    expect(analysis.insufficientReason).toContain("No se detectaron sistemas repetidos");
  });
});

describe("el estado vacío enseña, no solo informa (F3)", () => {
  test("explica con un ejemplo de obra qué es un sistema repetido", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Actividad única", wbs: "1" }),
    ]);

    // Un ejemplo concreto vale más que la condición técnica: el usuario debe
    // entender qué tendría que traer su cronograma para que esta vista sirva.
    expect(analysis.insufficientReason).toMatch(/piso|nivel/i);
    expect(analysis.insufficientReason).toMatch(/ejemplo|por ejemplo/i);
  });
});

describe("analyzeTypicalUnits · sótanos y orden físico", () => {
  test("los sótanos ya no se pierden: son niveles como cualquier otro", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Mampostería Sótano 3", wbs: "1.1.1" }),
      task({ id: 2, name: "Mampostería Sótano 2", wbs: "1.1.2" }),
      task({ id: 3, name: "Mampostería Sótano 1", wbs: "1.1.3" }),
    ]);

    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].levelCount).toBe(3);
  });

  test("el orden es el físico: sótano 3 primero, cubierta al final", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Pintura Piso 12", wbs: "1.1" }),
      task({ id: 2, name: "Pintura Sótano 1", wbs: "1.2" }),
      task({ id: 3, name: "Pintura Piso 1", wbs: "1.3" }),
      task({ id: 4, name: "Pintura Cubierta", wbs: "1.4" }),
    ]);

    expect(analysis.groups[0].activities.map((item) => item.levelValue)).toEqual([
      -1, 1, 12, 900,
    ]);
  });

  test("un sótano y un piso con el mismo número son dos niveles, no uno", () => {
    // Los dos dan `raw` = «3». Si la etiqueta fuera solo el número, el Set
    // que cuenta niveles los fundiría y la vista perdería un piso sin avisar.
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Pintura Sótano 3", wbs: "1.1" }),
      task({ id: 2, name: "Pintura Piso 3", wbs: "1.2" }),
      task({ id: 3, name: "Pintura Piso 4", wbs: "1.3" }),
    ]);

    expect(analysis.groups[0].levelCount).toBe(3);
    expect(analysis.groups[0].activities.map((item) => item.level)).toEqual([
      "Sótano 3",
      "Piso 3",
      "Piso 4",
    ]);
  });

  test("la cubierta se nombra, no se numera", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "Pintura Piso 1", wbs: "1.1" }),
      task({ id: 2, name: "Pintura Piso 2", wbs: "1.2" }),
      task({ id: 3, name: "Pintura Cubierta", wbs: "1.3" }),
    ]);

    expect(analysis.groups[0].activities.at(-1)?.level).toBe("Cubierta");
  });

  test("la ubicación heredada de la tarea padre también cuenta", () => {
    const analysis = analyzeTypicalUnits([
      task({ id: 1, name: "SOTANO 1", wbs: "1.1", outlineLevel: 1 }),
      task({ id: 2, name: "SOTANO 2", wbs: "1.2", outlineLevel: 1 }),
      task({ id: 3, name: "SOTANO 3", wbs: "1.3", outlineLevel: 1 }),
      task({ id: 4, name: "Muro en ladrillo", wbs: "1.1.1", outlineLevel: 2 }),
      task({ id: 5, name: "Muro en ladrillo", wbs: "1.2.1", outlineLevel: 2 }),
      task({ id: 6, name: "Muro en ladrillo", wbs: "1.3.1", outlineLevel: 2 }),
    ]);

    const grupo = analysis.groups.find((item) => item.system === "muro en ladrillo");
    expect(grupo?.levelCount).toBe(3);
  });
});
