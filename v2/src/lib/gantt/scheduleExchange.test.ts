import {
  exportedScheduleFileName,
  tasksToCsv,
  tasksToExcelTsv,
} from "./scheduleExchange";
import { createProjectDate } from "@/lib/date/projectDate";
import type { GanttTask } from "@/components/gantt/types";
import type { Observation } from "@/lib/observations/observations";

function tarea(overrides: Partial<GanttTask> & { id: string | number }): GanttTask {
  return {
    name: `Tarea ${overrides.id}`,
    start: createProjectDate("2026-01-05"),
    finish: createProjectDate("2026-01-09"),
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

function observacion(taskId: string | number, text: string): Observation {
  return {
    id: `obs-${taskId}`,
    taskId,
    taskName: "Excavación",
    text,
    status: "pending",
    createdAt: "2026-08-07T08:00:00.000Z",
  };
}

describe("el export del cronograma es un CSV que Excel abre bien (M25)", () => {
  test("separa con punto y coma, que es lo que espera Excel en español", () => {
    const csv = tasksToCsv([tarea({ id: 1, name: "Excavación" })], []);

    expect(csv.split("\n")[0]).toContain("Actividad;Inicio;Fin");
  });

  test("una coma dentro del nombre no parte la columna", () => {
    const csv = tasksToCsv([tarea({ id: 1, name: "Muros, ejes 1 a 4" })], []);

    expect(csv).toContain("Muros, ejes 1 a 4");
    expect(csv.split("\n")[1].split(";")[0]).toBe("Muros, ejes 1 a 4");
  });

  test("un punto y coma dentro del nombre sí se entrecomilla", () => {
    const csv = tasksToCsv([tarea({ id: 1, name: "Muros; ejes 1 a 4" })], []);

    expect(csv).toContain('"Muros; ejes 1 a 4"');
  });

  test("incluye las observaciones de cada actividad (M31)", () => {
    const csv = tasksToCsv(
      [tarea({ id: 1, name: "Excavación" })],
      [observacion(1, "Falta acero")],
    );

    expect(csv.split("\n")[0]).toContain("Observaciones");
    expect(csv).toContain("Falta acero");
  });

  test("varias observaciones de la misma actividad van juntas", () => {
    const csv = tasksToCsv(
      [tarea({ id: 1 })],
      [observacion(1, "Falta acero"), { ...observacion(1, "Falta andamio"), id: "obs-2" }],
    );

    expect(csv).toContain("Falta acero · Falta andamio");
  });

  test("una actividad sin observaciones deja la columna vacía, no la omite", () => {
    const csv = tasksToCsv([tarea({ id: 1 })], []);
    const columnasCabecera = csv.split("\n")[0].split(";").length;
    const columnasFila = csv.split("\n")[1].split(";").length;

    expect(columnasFila).toBe(columnasCabecera);
  });

  test("el archivo se llama .csv, no .tsv", () => {
    expect(exportedScheduleFileName()).toMatch(/\.csv$/);
  });

  test("el TSV sigue existiendo para pegar directo en Excel", () => {
    const tsv = tasksToExcelTsv([tarea({ id: 1, name: "Excavación" })]);

    expect(tsv.split("\n")[0]).toContain("Actividad\tInicio");
  });
});
