import { executiveSummaryToCsv } from "./executiveReportExport";
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
