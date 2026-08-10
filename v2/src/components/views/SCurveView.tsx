"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { Baseline } from "@/types/baseline";
import type { ProjectSnapshotSummary } from "@/types/snapshot";
import SCurveChart from "@/components/charts/SCurve";
import type { SCurveLineData } from "@/components/charts/SCurve";
import SnapshotsBoardView from "@/components/views/SnapshotsBoardView";
import {
  computeScheduleSCurve,
  computeBudgetSCurve,
  computeEarnedValueSCurve,
  diagnoseSCurve,
} from "@/lib/scheduling/scurve";
import { projectCompletion } from "@/lib/scheduling/projection";
import { createSnapshotFromTasks, mergeSnapshotSources } from "@/lib/scheduling/snapshots";
import { createProjectDate, formatProjectDate } from "@/lib/date/projectDate";
import {
  listProjectSnapshots,
  loadProjectSnapshot,
  saveProjectSnapshot,
} from "@/app/actions/snapshots";

// ── Types ──

// «Proyección» mira hacia adelante y «Cortes» mira hacia atrás: las dos
// responden a cómo se mueve el cronograma en el tiempo, que es de lo que
// va esta vista.
type SubView = "schedule" | "budget" | "earnedValue" | "projection" | "cortes";

interface SCurveViewProps {
  tasks: GanttTask[];
  budgetMappings: BudgetMapping[];
  budgetItems: BudgetItem[];
  /** Fecha de corte del proyecto, en formato `YYYY-MM-DD`. */
  statusDate?: string;
  /** Para marcar y comparar cortes en la sub-vista Cortes. */
  projectId?: string;
  baselines?: Baseline[];
}

/**
 * Por encima de este horizonte, una fecha de fin de obra deja de ser una
 * fecha y pasa a ser un chiste: nadie planifica a un siglo. Es una decisión
 * de presentación, no de la lógica de proyección (que a propósito no capa
 * nada): la vista es la que decide cómo mostrarlo.
 */
const PROJECTION_HORIZON_YEARS = 50;

function isProjectionAbsurdlyFar(finishDate: Date, from: Date): boolean {
  return finishDate.getFullYear() - from.getFullYear() > PROJECTION_HORIZON_YEARS;
}

// ── Tab style helpers ──

const TAB_BASE: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "var(--radius-lg)",
  fontSize: "0.7rem",
  fontFamily: "var(--font-montserrat)",
  fontWeight: 600,
  border: "1px solid var(--color-hairline)",
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    ...TAB_BASE,
    background: active ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
    color: active ? "#ffffff" : "var(--color-text-muted)",
    boxShadow: active ? "0 8px 18px rgb(39 118 89 / 0.16)" : "var(--shadow-sm)",
  };
}

// ── COP formatter ──

function formatCOP(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

// ── Component ──

export default function SCurveView({
  tasks,
  budgetMappings,
  budgetItems,
  statusDate,
  projectId,
  baselines,
}: SCurveViewProps) {
  const [activeSubView, setActiveSubView] = useState<SubView>("schedule");

  // ── Cortes (se leen solo al abrir esta sub-vista) ──
  const [snapshotSummaries, setSnapshotSummaries] = useState<ProjectSnapshotSummary[]>([]);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(false);
  // Cargando mientras la sub-vista está abierta y la carga no terminó: no es
  // un estado propio, se deriva para no disparar un setState síncrono en el
  // efecto de abajo.
  const snapshotsLoading = activeSubView === "cortes" && Boolean(projectId) && !snapshotsLoaded;

  useEffect(() => {
    if (activeSubView !== "cortes" || snapshotsLoaded || !projectId) return;
    let cancelado = false;
    void listProjectSnapshots(projectId).then((stored) => {
      if (cancelado) return;
      setSnapshotSummaries(mergeSnapshotSources(stored, baselines ?? [], projectId));
      setSnapshotsLoaded(true);
    });
    return () => {
      cancelado = true;
    };
  }, [activeSubView, snapshotsLoaded, projectId, baselines]);

  const handleMarkSnapshot = useCallback(
    (name: string) => {
      if (!projectId) return;
      const snapshot = createSnapshotFromTasks(tasks, {
        projectId,
        name,
        origin: "manual",
        capturedAt: new Date(),
      });
      void saveProjectSnapshot(snapshot).then((result) => {
        if (!result.success) return;
        setSnapshotSummaries((prev) =>
          mergeSnapshotSources(
            [
              {
                id: snapshot.id,
                name: snapshot.name,
                origin: snapshot.origin,
                capturedAt: snapshot.capturedAt,
                taskCount: snapshot.tasks.length,
              },
              ...prev,
            ],
            baselines ?? [],
            projectId,
          ),
        );
      });
    },
    [projectId, tasks, baselines],
  );

  // ── Schedule S-Curve ──
  const scheduleData = useMemo(
    () => computeScheduleSCurve(tasks),
    [tasks],
  );

  const scheduleLines: SCurveLineData[] = useMemo(
    () =>
      scheduleData.points.length > 0
        ? [
            {
              label: "Progreso Planificado",
              points: scheduleData.points.map((p) => ({
                date: p.date,
                value: p.cumulativeValue,
              })),
              color: "var(--aia-proj-main)",
            },
          ]
        : [],
    [scheduleData],
  );

  // ── Budget S-Curve ──
  const budgetData = useMemo(
    () => computeBudgetSCurve(tasks, budgetMappings, budgetItems),
    [tasks, budgetMappings, budgetItems],
  );

  const budgetLines: SCurveLineData[] = useMemo(
    () =>
      budgetData.points.length > 0
        ? [
            {
              label: "Costo Presupuestado",
              points: budgetData.points.map((p) => ({
                date: p.date,
                value: p.cumulativeValue,
              })),
              color: "var(--aia-arch-main)",
            },
          ]
        : [],
    [budgetData],
  );

  // ── Earned Value S-Curve ──
  const evData = useMemo(
    () => computeEarnedValueSCurve(tasks, budgetMappings, budgetItems),
    [tasks, budgetMappings, budgetItems],
  );

  const evLines: SCurveLineData[] = useMemo(
    () =>
      evData.points.length > 0
        ? [
            {
              label: "Valor Planificado (PV)",
              points: evData.points.map((p) => ({
                date: p.date,
                value: p.pv,
              })),
              color: "var(--aia-proj-main)",
            },
            {
              label: "Valor Ganado (EV)",
              points: evData.points.map((p) => ({
                date: p.date,
                value: p.ev,
              })),
              color: "var(--aia-arch-main)",
            },
            {
              label: "Costo Real (AC)",
              points: evData.points.map((p) => ({
                date: p.date,
                value: p.ac,
              })),
              color: "var(--aia-alert-main)",
            },
          ]
        : [],
    [evData],
  );

  const evIndices = useMemo(
    () =>
      // Sin puntos no hay índices; y si los hubiera sin poder calcularlos,
      // tampoco se inventan (M1).
      evData.points.length > 0 && evData.cpi !== null && evData.spi !== null
        ? [
            { label: "CPI", value: evData.cpi },
            { label: "SPI", value: evData.spi },
          ]
        : [],
    [evData],
  );
  const diagnostics = useMemo(
    () => diagnoseSCurve(tasks, budgetMappings, budgetItems),
    [tasks, budgetMappings, budgetItems],
  );

  // ── Projection ──
  const projection = useMemo(
    () =>
      projectCompletion(
        tasks,
        statusDate ? createProjectDate(statusDate) : new Date(),
      ),
    [tasks, statusDate],
  );

  // Ritmo minúsculo, fecha absurda: aquí se decide cómo mostrarlo (M... ver
  // comentario junto a `PROJECTION_HORIZON_YEARS`).
  const projectionTooFar =
    projection.available &&
    isProjectionAbsurdlyFar(projection.pessimistic.finishDate, projection.statusDate);

  const projectionEmptyMessage = !projection.available
    ? projection.message
    : "Al ritmo actual la obra no tiene fin previsible: la proyección más pesimista cae a más de 50 años del corte. Registra más avance o revisa si el cronograma refleja el ritmo real.";

  const projectionLines: SCurveLineData[] = useMemo(() => {
    if (!projection.available) return [];
    return [
      {
        label: "Avance real",
        points: projection.achieved.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-arch-main)",
      },
      {
        label: "Optimista",
        points: projection.optimistic.points.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-proj-main)",
      },
      {
        label: "Probable",
        points: projection.probable.points.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-corp-main)",
      },
      {
        label: "Pesimista",
        points: projection.pessimistic.points.map((p) => ({
          date: p.date,
          value: p.cumulativeValue,
        })),
        color: "var(--aia-alert-main)",
      },
    ];
  }, [projection]);

  return (
    <div
      data-testid="s-curve-view"
      className="apple-module flex flex-col h-full"
    >
      {/* Header */}
      <div
        className="apple-module-header px-5 py-4"
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Curvas S
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8rem",
            color: "var(--color-text-muted)",
            margin: "2px 0 0",
          }}
        >
          Análisis de cronograma, presupuesto y valor ganado
        </p>
      </div>

      {/* Sub-view tabs */}
      <div
        className="apple-subtoolbar flex-wrap"
      >
        <button
          onClick={() => setActiveSubView("schedule")}
          style={tabStyle(activeSubView === "schedule")}
        >
          Curva de Cronograma
        </button>
        <button
          onClick={() => setActiveSubView("budget")}
          style={tabStyle(activeSubView === "budget")}
        >
          Curva de Presupuesto
        </button>
        <button
          onClick={() => setActiveSubView("earnedValue")}
          style={tabStyle(activeSubView === "earnedValue")}
        >
          Valor Ganado
        </button>
        <button
          onClick={() => setActiveSubView("projection")}
          style={tabStyle(activeSubView === "projection")}
        >
          Proyección
        </button>
        <button
          onClick={() => setActiveSubView("cortes")}
          style={tabStyle(activeSubView === "cortes")}
        >
          Cortes
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4 overflow-auto">
        {diagnostics.length > 0 && (
          <section
            data-testid="s-curve-feedback"
            className="mb-4 grid gap-2 md:grid-cols-3"
          >
            {diagnostics.slice(0, 3).map((diagnostic) => (
              <article
                key={`${diagnostic.kind}-${diagnostic.taskIds.join("-")}`}
                data-testid="s-curve-feedback-card"
                className="apple-section px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[0.6875rem] font-semibold uppercase text-[var(--color-text-muted)]"
                    style={{ letterSpacing: 0 }}
                  >
                    {diagnostic.severity === "high"
                      ? "Alta"
                      : diagnostic.severity === "medium"
                        ? "Media"
                        : "Baja"}
                  </span>
                  <span className="text-[0.6875rem] text-[var(--color-text-muted)]">
                    {diagnostic.metric}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[var(--color-text-strong)]">
                  {diagnostic.message}
                </p>
                <p
                  className="mt-1 overflow-hidden text-xs text-[var(--color-text-muted)]"
                  style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
                >
                  {diagnostic.recommendation}
                </p>
              </article>
            ))}
          </section>
        )}

        {activeSubView === "schedule" && (
          <>
            {scheduleLines.length > 0 ? (
              <SCurveChart
                lines={scheduleLines}
                yFormat={(v) => `${Math.round(v)}%`}
                showLegend={false}
              />
            ) : (
              <EmptyState message="Sin datos suficientes para generar la curva de cronograma." />
            )}
          </>
        )}

        {activeSubView === "budget" && (
          <>
            {budgetLines.length > 0 ? (
              <SCurveChart
                lines={budgetLines}
                yFormat={formatCOP}
                showLegend={false}
              />
            ) : (
              <EmptyState message="Sin datos suficientes para generar la curva de presupuesto. Agrega partidas presupuestales y mapeos." />
            )}
          </>
        )}

        {activeSubView === "earnedValue" && (
          <>
            {evLines.length > 0 ? (
              <SCurveChart
                lines={evLines}
                yFormat={formatCOP}
                showLegend={true}
                indices={evIndices}
              />
            ) : (
              <EmptyState message="Sin datos suficientes para generar la curva de valor ganado. Agrega tareas con presupuesto y avance." />
            )}
          </>
        )}

        {activeSubView === "projection" && (
          <div data-testid="s-curve-projection">
            {projection.available && !projectionTooFar ? (
              <>
                <section
                  data-testid="s-curve-projection-dates"
                  className="mb-4 grid gap-2 md:grid-cols-3"
                >
                  {[projection.optimistic, projection.probable, projection.pessimistic].map(
                    (line) => (
                      <article key={line.label} className="apple-section px-3 py-2">
                        <p className="text-[0.6875rem] font-semibold uppercase text-[var(--color-text-muted)]">
                          {line.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">
                          {formatProjectDate(line.finishDate)}
                        </p>
                      </article>
                    ),
                  )}
                </section>
                <SCurveChart
                  lines={projectionLines}
                  yFormat={(v) => `${Math.round(v)}%`}
                  showLegend={true}
                />
              </>
            ) : (
              <div data-testid="s-curve-projection-empty">
                <EmptyState message={projectionEmptyMessage} />
              </div>
            )}
          </div>
        )}

        {activeSubView === "cortes" && (
          <SnapshotsBoardView
            tasks={tasks}
            summaries={snapshotSummaries}
            isLoading={snapshotsLoading}
            loadSnapshot={(snapshotId) =>
              projectId ? loadProjectSnapshot(projectId, snapshotId) : Promise.resolve(null)
            }
            onMarkSnapshot={handleMarkSnapshot}
          />
        )}
      </div>
    </div>
  );
}

// ── Empty State ──

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ minHeight: 200 }}
    >
      <p
        style={{
          color: "var(--color-text-muted)",
          fontSize: "0.85rem",
          textAlign: "center",
          maxWidth: 400,
          lineHeight: 1.6,
        }}
      >
        {message}
      </p>
    </div>
  );
}
