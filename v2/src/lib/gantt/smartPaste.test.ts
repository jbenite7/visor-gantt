import { insertTasksFromSmartPaste } from "./smartPaste";
import { tasksToExcelTsv } from "./scheduleExchange";
import type { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";

function task(id: number, name: string): GanttTask {
  return {
    id,
    name,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate("2026-01-05"),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
  };
}

describe("insertTasksFromSmartPaste", () => {
  test("imports tabular Excel rows with headers", () => {
    const result = insertTasksFromSmartPaste(
      [task(1, "Existente")],
      "Actividad\tInicio\tDuración\t% completado\tNivel\nCapitulo\t2026-02-01\t1\t0\t1\nFormaleta\t2026-02-02\t3\t25\t2",
      { afterTaskId: 1 },
    );

    expect(result.map((item) => item.name)).toEqual([
      "Existente",
      "Capitulo",
      "Formaleta",
    ]);
    expect(result[1]).toEqual(
      expect.objectContaining({
        id: 2,
        wbs: "2",
        isSummary: true,
      }),
    );
    expect(result[2]).toEqual(
      expect.objectContaining({
        id: 3,
        wbs: "2.1",
        duration: 3,
        progress: 25,
        percentComplete: 25,
      }),
    );
  });

  test("imports rows without headers using default column order", () => {
    const result = insertTasksFromSmartPaste(
      [],
      "Trazado\t01/03/2026\t2\t50\nHito entrega\t03/03/2026\t0\t100",
    );

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Trazado");
    expect(result[0].duration).toBe(2);
    expect(result[0].progress).toBe(50);
    expect(result[1].isMilestone).toBe(true);
  });
});

describe("tasksToExcelTsv", () => {
  test("exports an Excel-friendly TSV that smart paste can import back", () => {
    const result = tasksToExcelTsv([
      {
        ...task(1, "Capítulo"),
        isSummary: true,
        outlineLevel: 1,
        wbs: "1",
        resourceNames: ["Cuadrilla A"],
        progress: 33.3333,
      },
      {
        ...task(2, "Formaleta"),
        finish: createProjectDate("2026-01-07"),
        outlineLevel: 2,
        wbs: "1.1",
        dependencies: [{ from: 1, to: 2, type: "FS", lag: 2 }],
        duration: 3,
        progress: 25,
        cost: 1200000,
      },
    ]);

    expect(result.split("\n")[0]).toBe(
      "Actividad\tInicio\tFin\tDuración\t% completado\tNivel\tEDT\tPredecesoras\tRecursos\tCosto",
    );
    expect(result).toContain("Capítulo\t2026-01-05\t2026-01-05\t1\t33.33\t1\t1\t\tCuadrilla A\t");
    expect(result).toContain("Formaleta\t2026-01-05\t2026-01-07\t3\t25\t2\t1.1\t1FS+2d\t\t1200000");

    const imported = insertTasksFromSmartPaste([], result);
    expect(imported.map((item) => item.name)).toEqual(["Capítulo", "Formaleta"]);
    expect(result).toContain("\t33.33\t");
    expect(imported[1]).toEqual(expect.objectContaining({ duration: 3, outlineLevel: 2 }));
  });

  test("exports matrix dependencies with visible row IDs instead of internal IDs", () => {
    const predecessorId = "mx-task-cell-scope-1783549803757-estructura-area-formaleta";
    const successorId = "mx-task-cell-scope-1783549803757-estructura-area-acero";

    const result = tasksToExcelTsv([
      {
        ...task(predecessorId, "Formaleta"),
        wbs: "1.1.1",
      },
      {
        ...task(successorId, "Acero"),
        wbs: "1.1.2",
        dependencies: [{ from: predecessorId, to: successorId, type: "FS" }],
      },
    ]);

    expect(result).toContain("\t1FS\t");
    expect(result).not.toContain("mx-task-cell-scope");
  });
});
