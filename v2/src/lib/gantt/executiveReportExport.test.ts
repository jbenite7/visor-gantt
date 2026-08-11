import {
  executiveSummaryToCsv,
  executiveSummaryToTsv,
} from "./executiveReportExport";
import type { ExecutivePlanningSummary } from "@/lib/gantt/executiveDashboard";

describe("executive report export", () => {
  test("exports KPIs and triple constraint signals as Excel-friendly CSV", () => {
    const summary: ExecutivePlanningSummary = {
      health: "warning",
      kpis: [
        {
          id: "progress",
          label: "Avance",
          value: "45.0%",
          detail: "SPI 0.82",
          health: "warning",
        },
      ],
      signals: [
        {
          dimension: "schedule",
          health: "warning",
          title: "Cronograma",
          detail: "2 tareas criticas, SPI 0.82",
          recommendation: "Priorizar restricciones.",
        },
      ],
    };

    expect(executiveSummaryToCsv(summary)).toBe(
      [
        "Seccion,Indicador,Valor,Detalle,Estado,Recomendacion",
        "KPI,Avance,45.0%,SPI 0.82,warning,",
        'Triple restricción,Cronograma,schedule,"2 tareas criticas, SPI 0.82",warning,Priorizar restricciones.',
      ].join("\n"),
    );
  });
});

/**
 * «Copiar para Excel» pegaba **una sola columna**: mandaba al portapapeles el
 * CSV separado por comas, y Excel al pegar no lo reparte. La app ya lo había
 * resuelto en `scheduleExchange.tasksToExcelTsv` — pegar con tabuladores sí cae
 * en columnas—, pero el tablero ejecutivo no lo usaba.
 */
describe("executiveSummaryToTsv (lo que Excel sí sabe pegar)", () => {
  const resumen = {
    kpis: [
      { label: "Avance", value: "40%", detail: "2 de 5", health: "ok" },
    ],
    signals: [
      {
        title: "Plazo en riesgo",
        dimension: "Tiempo",
        detail: "3 días de atraso",
        health: "warn",
        recommendation: "Revisar la ruta crítica",
      },
    ],
  } as unknown as Parameters<typeof executiveSummaryToTsv>[0];

  test("separa con tabuladores, no con comas", () => {
    const tsv = executiveSummaryToTsv(resumen);

    expect(tsv.split("\n")[0]).toContain("\t");
    expect(tsv.split("\n")[0]).not.toContain(",");
  });

  test("una celda con coma ya no parte la fila", () => {
    const tsv = executiveSummaryToTsv({
      kpis: [
        { label: "Costo", value: "1,250", detail: "sobre lo previsto", health: "warn" },
      ],
      signals: [],
    } as unknown as Parameters<typeof executiveSummaryToTsv>[0]);

    // Cabecera + una fila. Si la coma partiera algo, habría más.
    expect(tsv.split("\n")).toHaveLength(2);
    expect(tsv).toContain("1,250");
  });

  test("un tabulador dentro de una celda no descoloca las columnas", () => {
    const tsv = executiveSummaryToTsv({
      ...resumen,
      kpis: [
        { label: "Con\ttab", value: "1", detail: "", health: "ok" },
      ],
    } as unknown as Parameters<typeof executiveSummaryToTsv>[0]);

    const columnas = tsv.split("\n")[1].split("\t");
    expect(columnas).toHaveLength(6);
  });

  test("lleva las mismas columnas que el CSV: no son dos informes distintos", () => {
    const csv = executiveSummaryToCsv(resumen).split("\n")[0].split(",");
    const tsv = executiveSummaryToTsv(resumen).split("\n")[0].split("\t");

    expect(tsv).toEqual(csv);
  });
});
