import type { ExecutivePlanningSummary } from "@/lib/gantt/executiveDashboard";

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function csvRow(values: string[]): string {
  return values.map(csvCell).join(",");
}

/** Las filas del informe, una sola vez: el CSV y el TSV son el mismo informe. */
function filasDelInforme(summary: ExecutivePlanningSummary): string[][] {
  return [
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
}

export function executiveSummaryToCsv(summary: ExecutivePlanningSummary): string {
  return filasDelInforme(summary).map(csvRow).join("\n");
}

/**
 * El mismo informe, separado por tabuladores.
 *
 * «Copiar para Excel» mandaba el CSV con comas, y Excel al pegar no lo reparte:
 * salía **todo en una columna**. Con tabuladores sí cae en columnas. Es lo que
 * ya hacía `scheduleExchange.tasksToExcelTsv` para la tabla del cronograma; el
 * tablero ejecutivo no lo estaba usando.
 *
 * Los tabuladores y saltos dentro de una celda se sustituyen por espacios: al
 * pegar no hay comillas que valgan, así que un tabulador suelto correría las
 * columnas de esa fila.
 */
export function executiveSummaryToTsv(summary: ExecutivePlanningSummary): string {
  return filasDelInforme(summary)
    .map((fila) =>
      fila.map((celda) => celda.replace(/[\t\r\n]+/g, " ")).join("\t"),
    )
    .join("\n");
}

export function executiveReportFileName(baseName = "reporte-ejecutivo"): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${baseName}-${year}-${month}-${day}.csv`;
}
