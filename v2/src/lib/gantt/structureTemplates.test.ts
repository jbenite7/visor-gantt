import type { GanttTask } from "@/components/gantt/types";
import { applyStructureTemplate } from "./structureTemplates";

function task(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Task ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-05T08:00:00"),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("structure templates", () => {
  test("applies a construction chapter template with hierarchy and repetitive dependencies", () => {
    const result = applyStructureTemplate(
      [task({ id: 1, name: "Existente", wbs: "1" })],
      "obra-gris-basica",
      { afterTaskId: 1, start: new Date("2026-02-01T00:00:00.000Z") },
    );

    expect(result.map((item) => item.name)).toEqual([
      "Existente",
      "Obra gris",
      "Preliminares",
      "Replanteo y localizacion",
      "Excavacion",
      "Cimentacion",
      "Acero de cimentacion",
      "Concreto de cimentacion",
      "Estructura",
      "Formaleta",
      "Acero de estructura",
      "Vaciado de concreto",
    ]);
    expect(result.map((item) => item.outlineLevel)).toEqual([1, 1, 2, 3, 3, 2, 3, 3, 2, 3, 3, 3]);
    expect(result.map((item) => item.wbs)).toEqual([
      "1",
      "2",
      "2.1",
      "2.1.1",
      "2.1.2",
      "2.2",
      "2.2.1",
      "2.2.2",
      "2.3",
      "2.3.1",
      "2.3.2",
      "2.3.3",
    ]);
    expect(result.find((item) => item.name === "Excavacion")?.dependencies).toEqual([
      { from: 4, to: 5, type: "FS", lag: 0 },
    ]);
    expect(result.find((item) => item.name === "Vaciado de concreto")?.dependencies).toEqual([
      { from: 11, to: 12, type: "FS", lag: 0 },
    ]);
  });
});
