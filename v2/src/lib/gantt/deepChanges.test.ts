import { detectDeepChanges } from "./deepChanges";
import { createProjectDate } from "@/lib/date/projectDate";
import type { GanttTask } from "@/components/gantt/types";

function t(id: number, finish: string, isCritical = false): GanttTask {
  return {
    id,
    name: `T${id}`,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate(finish),
    duration: 1,
    progress: 0,
    isCritical,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
  };
}

describe("cambios de calado (Bloque B)", () => {
  test("detecta que el fin de obra se corrió, y cuántos días", () => {
    const r = detectDeepChanges([t(1, "2026-03-01")], [t(1, "2026-03-06")]);
    expect(r.projectFinishMoved).toBe(5);
  });

  test("un adelanto se informa en negativo, no se ignora", () => {
    const r = detectDeepChanges([t(1, "2026-03-06")], [t(1, "2026-03-01")]);
    expect(r.projectFinishMoved).toBe(-5);
  });

  test("si el fin no se mueve, no hay nada que avisar", () => {
    const r = detectDeepChanges([t(1, "2026-03-01")], [t(1, "2026-03-01")]);
    expect(r.projectFinishMoved).toBeNull();
  });

  test("el fin de obra es la última tarea, no la primera", () => {
    const r = detectDeepChanges(
      [t(1, "2026-03-01"), t(2, "2026-05-20")],
      [t(1, "2026-03-01"), t(2, "2026-05-25")],
    );
    expect(r.projectFinishMoved).toBe(5);
  });

  test("detecta que la ruta crítica cambió de actividades", () => {
    const r = detectDeepChanges(
      [t(1, "2026-03-01", true), t(2, "2026-03-01", false)],
      [t(1, "2026-03-01", false), t(2, "2026-03-01", true)],
    );
    expect(r.criticalPathChanged).toBe(true);
  });

  test("misma ruta crítica, aunque cambie el orden del array", () => {
    const r = detectDeepChanges(
      [t(1, "2026-03-01", true), t(2, "2026-03-01", false)],
      [t(2, "2026-03-01", false), t(1, "2026-03-01", true)],
    );
    expect(r.criticalPathChanged).toBe(false);
  });

  test("una ruta crítica que se alarga también cuenta como cambio", () => {
    const r = detectDeepChanges(
      [t(1, "2026-03-01", true), t(2, "2026-03-01", false)],
      [t(1, "2026-03-01", true), t(2, "2026-03-01", true)],
    );
    expect(r.criticalPathChanged).toBe(true);
  });

  test("un cronograma vacío no inventa cambios", () => {
    const r = detectDeepChanges([], []);
    expect(r.projectFinishMoved).toBeNull();
    expect(r.criticalPathChanged).toBe(false);
  });
});
