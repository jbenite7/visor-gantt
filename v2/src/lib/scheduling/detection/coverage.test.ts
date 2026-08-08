import { describeCoverage, summarizeDetection } from "./coverage";
import type { GanttTask } from "@/components/gantt/types";

function task(id: number, name: string, wbs?: string, isSummary = false): GanttTask {
  return {
    id,
    name,
    wbs,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-09T17:00:00"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary,
    outlineLevel: 1,
    dependencies: [],
  };
}

describe("summarizeDetection", () => {
  const tareas = [
    task(1, "LOSA AÉREA PISO 1", "1.1"),
    task(2, "COLUMNAS SÓTANO 2", "1.2"),
    task(3, "SOTANO 1", "2.1", true),
    task(4, "MURO EN LADRILLO", "2.1.1"),
    task(5, "VÍAS INTERNAS", "3.1"),
    task(6, "SKATE PARK", "3.2"),
  ];

  test("cuenta cuántas tareas tienen ubicación y cuántas son obra general", () => {
    const coverage = summarizeDetection(tareas);

    expect(coverage.total).toBe(6);
    expect(coverage.withLocation).toBe(4);
    expect(coverage.generalWork).toBe(2);
  });

  test("desglosa de dónde salió cada ubicación", () => {
    const coverage = summarizeDetection(tareas);

    expect(coverage.byScope.propia).toBe(3);
    expect(coverage.byScope.heredada).toBe(1);
    expect(coverage.byScope.obraGeneral).toBe(2);
    expect(coverage.byScope.diccionario).toBe(0);
  });

  test("lo describe en lenguaje de obra", () => {
    expect(describeCoverage(summarizeDetection(tareas))).toBe(
      "4 de 6 tareas tienen ubicación detectada. 2 son obra general, sin piso asignado.",
    );
  });

  test("sin tareas no inventa una cobertura del 100 %", () => {
    const coverage = summarizeDetection([]);

    expect(coverage.total).toBe(0);
    expect(coverage.withLocation).toBe(0);
    expect(describeCoverage(coverage)).toBe("Aún no hay tareas que analizar.");
  });
});
