import { classifyActivityFamily } from "./activityFamily";
import type { GanttTask } from "@/components/gantt/types";

function task(partial: Partial<GanttTask>): GanttTask {
  return {
    id: 1,
    name: "Actividad",
    start: new Date("2026-01-01"),
    finish: new Date("2026-01-02"),
    progress: 0,
    dependencies: [],
    ...partial,
  } as GanttTask;
}

describe("classifyActivityFamily", () => {
  test("el WBS gana sobre el nombre de la tarea", () => {
    const result = classifyActivityFamily(
      task({ name: "Piso 3", wbs: "1.2.4" }),
      { breadcrumb: ["Torre 1", "Redes MEP", "Piso 3"] },
    );
    expect(result.family).toBe("Redes MEP");
    expect(result.matchedBy).toBe("breadcrumb");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test("una palabra ambigua sin respaldo de WBS no decide familia", () => {
    const result = classifyActivityFamily(task({ name: "Piso 3" }));
    expect(result.family).toBeNull();
    expect(result.matchedBy).toBe("none");
    expect(result.reviewReason).toMatch(/clasificaci/i);
  });

  test("el nombre decide cuando no hay senal de WBS", () => {
    const result = classifyActivityFamily(
      task({ name: "Mamposteria de fachada" }),
    );
    expect(result.family).toBe("Arquitectura");
    expect(result.matchedBy).toBe("name");
  });

  test("un empate entre familias marca revision", () => {
    const result = classifyActivityFamily(
      task({ name: "Instalacion electrica y acabado de muros" }),
    );
    expect(result.reviewReason).toBeTruthy();
    expect(result.confidence).toBeLessThan(0.8);
  });

  test.each(["Piso", "Torre", "Staff", "Retiro", "Ejes", "Zona"])(
    "la palabra ambigua %s nunca decide familia por si sola",
    (word) => {
      const result = classifyActivityFamily(task({ name: `${word} 2` }));
      expect(result.family).toBeNull();
    },
  );

  test("normaliza tildes correctamente", () => {
    const result = classifyActivityFamily(
      task({ name: "instalación eléctrica" }),
    );
    expect(result.family).toBe("Redes MEP");
  });
});
