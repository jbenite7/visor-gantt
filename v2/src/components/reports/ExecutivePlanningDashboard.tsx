"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardCopy,
  Download,
  FileText,
  Gauge,
  TriangleAlert,
} from "lucide-react";
import type { ExecutivePlanningSummary, ExecutiveHealth } from "@/lib/gantt/executiveDashboard";
import {
  executiveReportFileName,
  executiveSummaryToCsv,
} from "@/lib/gantt/executiveReportExport";

interface ExecutivePlanningDashboardProps {
  summary: ExecutivePlanningSummary;
  /** Cada indicador lleva a su detalle: el tablero era un callejón sin salida (M1). */
  onNavigate?: (view: "bottlenecks" | "gantt" | "scurve" | "resources") => void;
}

function formatIsoDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function healthLabel(health: ExecutiveHealth): string {
  if (health === "critical") return "Crítico";
  if (health === "warning") return "Atención";
  if (health === "unknown") return "Aún no hay datos";
  return "Controlado";
}

function healthColor(health: ExecutiveHealth): string {
  if (health === "critical") return "var(--aia-alert-main)";
  if (health === "warning") return "var(--aia-warn-main)";
  if (health === "unknown") return "var(--color-text-muted)";
  return "var(--aia-proj-main)";
}

/**
 * Tarjeta que se vuelve botón solo si tiene a dónde llevar: un `<article>` que
 * reacciona al clic sin serlo no lo anuncia a quien navega con teclado.
 */
function Tarjeta({
  testId,
  onClick,
  children,
}: {
  testId: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (!onClick) {
    return (
      <article data-testid={testId} className="apple-section px-4 py-3">
        {children}
      </article>
    );
  }

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="apple-section px-4 py-3 text-left"
    >
      {children}
    </button>
  );
}

function HealthIcon({ health, size = 16 }: { health: ExecutiveHealth; size?: number }) {
  const color = healthColor(health);
  if (health === "critical") return <TriangleAlert size={size} color={color} />;
  if (health === "warning") return <AlertTriangle size={size} color={color} />;
  if (health === "unknown") return <CircleDashed size={size} color={color} />;
  return <CheckCircle2 size={size} color={color} />;
}

export default function ExecutivePlanningDashboard({
  summary,
  onNavigate,
}: ExecutivePlanningDashboardProps) {
  const [exportStatus, setExportStatus] =
    useState<"idle" | "copied" | "downloaded" | "print" | "error">("idle");
  const exportCsv = useMemo(() => executiveSummaryToCsv(summary), [summary]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportCsv);
      setExportStatus("copied");
    } catch {
      setExportStatus("error");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = executiveReportFileName();
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus("downloaded");
  };

  const handlePrint = () => {
    setExportStatus("print");
    window.print();
  };

  return (
    <div
      data-testid="executive-planning-dashboard"
      className="apple-module h-full overflow-auto"
    >
      <div className="apple-module-header px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--color-text-strong)]">
              Dashboard ejecutivo
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Triple restricción: cronograma, costo, alcance y avance.
            </p>
          </div>
          <div
            className="apple-section flex items-center gap-2 px-3 py-2"
            style={{ color: healthColor(summary.health) }}
          >
            <HealthIcon health={summary.health} size={18} />
            <strong className="text-sm">{healthLabel(summary.health)}</strong>
          </div>
        </div>

        <p
          data-testid="executive-status-date"
          className="mt-1 text-xs text-[var(--color-text-muted)]"
        >
          {summary.statusDate
            ? `Cifras al ${formatIsoDay(summary.statusDate)}`
            : "Sin fecha de corte: las cifras son de hoy"}
        </p>

        {summary.health === "unknown" && (
          <p
            data-testid="executive-no-data"
            className="mt-2 text-sm text-[var(--color-text-muted)]"
          >
            Aún no hay datos para juzgar la obra. Importa un cronograma o crea
            las primeras actividades y aquí verás avance, costo y alcance.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="executive-report-copy"
            className="apple-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            onClick={() => void handleCopy()}
            title="Copiar reporte ejecutivo para Excel"
          >
            <ClipboardCopy size={14} aria-hidden />
            Copiar para Excel
          </button>
          <button
            type="button"
            data-testid="executive-report-download"
            className="apple-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            onClick={handleDownload}
            title="Descargar reporte ejecutivo CSV"
          >
            <Download size={14} aria-hidden />
            Descargar CSV
          </button>
          <button
            type="button"
            data-testid="executive-report-print"
            className="apple-button-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            onClick={handlePrint}
            title="Abre el diálogo de impresión del navegador, desde donde puedes guardar en PDF"
          >
            <FileText size={14} aria-hidden />
            Imprimir o PDF
          </button>
          {exportStatus !== "idle" && (
            <span
              data-testid="executive-report-export-status"
              className="text-xs font-semibold"
              style={{
                color: exportStatus === "error"
                  ? "var(--aia-alert-main)"
                  : "var(--color-text-muted)",
              }}
            >
              {exportStatus === "copied" && "Copiado"}
              {exportStatus === "downloaded" && "Descargado"}
              {exportStatus === "print" && "Listo para PDF"}
              {exportStatus === "error" && "Portapapeles no disponible"}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <section className="grid gap-3 md:grid-cols-4">
          {summary.kpis.map((kpi) => {
            return (
              <article
                key={kpi.id}
                data-testid="executive-kpi"
                className="apple-section px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {kpi.label}
                  </span>
                  <HealthIcon health={kpi.health} size={15} />
                </div>
                <p className="mt-2 text-xl font-semibold text-[var(--color-text-strong)]">
                  {kpi.value}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{kpi.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          {summary.signals.map((signal) => {
            return (
              <Tarjeta
                key={signal.dimension}
                testId="executive-signal"
                onClick={
                  onNavigate && signal.linkTo
                    ? () => onNavigate(signal.linkTo!)
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <HealthIcon health={signal.health} size={16} />
                  <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
                    {signal.title}
                  </h3>
                  <span
                    className="ml-auto rounded-full border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase text-[var(--color-text-muted)]"
                    style={{ letterSpacing: 0 }}
                  >
                    {healthLabel(signal.health)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-strong)]">{signal.detail}</p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {signal.recommendation}
                </p>
              </Tarjeta>
            );
          })}
        </section>

        <section className="apple-section px-4 py-3">
          <div className="flex items-center gap-2">
            <Gauge size={16} color="var(--aia-corp-main)" />
            <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">
              Lectura gerencial
            </h3>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Usa este tablero como semaforo de decision: si cronograma, costo o alcance
            están en atención, valida la causa antes de aprobar recuperaciones o cambios de linea base.
          </p>
        </section>
      </div>
    </div>
  );
}
