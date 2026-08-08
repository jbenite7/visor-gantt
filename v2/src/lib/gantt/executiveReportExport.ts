import type { ExecutivePlanningSummary } from "@/lib/gantt/executiveDashboard";

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function csvRow(values: string[]): string {
  return values.map(csvCell).join(",");
}

export function executiveSummaryToCsv(summary: ExecutivePlanningSummary): string {
  const rows: string[][] = [
    ["Seccion", "Indicador", "Valor", "Detalle", "Estado", "Recomendacion"],
    ...summary.kpis.map((kpi) => [
      "KPI",
      kpi.label,
      kpi.value,
      kpi.detail,
      kpi.health,
      "",
    ]),
    ...summary.signals.map((signal) => [
      "Triple restricción",
      signal.title,
      signal.dimension,
      signal.detail,
      signal.health,
      signal.recommendation,
    ]),
  ];

  return rows.map(csvRow).join("\n");
}

export function executiveReportFileName(baseName = "reporte-ejecutivo"): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${baseName}-${year}-${month}-${day}.csv`;
}
