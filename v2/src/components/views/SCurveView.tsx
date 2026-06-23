"use client";

import { useMemo, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import SCurveChart from "@/components/charts/SCurve";
import type { SCurveLineData } from "@/components/charts/SCurve";
import {
  computeScheduleSCurve,
  computeBudgetSCurve,
  computeEarnedValueSCurve,
} from "@/lib/scheduling/scurve";

// ── Types ──

type SubView = "schedule" | "budget" | "earnedValue";

interface SCurveViewProps {
  tasks: GanttTask[];
  budgetMappings: BudgetMapping[];
  budgetItems: BudgetItem[];
}

// ── Tab style helpers ──

const TAB_BASE: React.CSSProperties = {
  padding: "5px 14px",
  borderRadius: "var(--radius-sm)",
  fontSize: "0.7rem",
  fontFamily: "var(--font-montserrat)",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    ...TAB_BASE,
    background: active ? "var(--aia-corp-main)" : "transparent",
    color: active ? "#ffffff" : "var(--aia-corp-light)",
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
}: SCurveViewProps) {
  const [activeSubView, setActiveSubView] = useState<SubView>("schedule");

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
      evData.points.length > 0
        ? [
            { label: "CPI", value: evData.cpi },
            { label: "SPI", value: evData.spi },
          ]
        : [],
    [evData],
  );

  // ── Empty state checks ──
  const hasTasks = tasks.length > 0;
  const hasBudgetData = budgetMappings.length > 0 && budgetItems.length > 0;
  const hasEVData = hasTasks && hasBudgetData;

  return (
    <div
      data-testid="s-curve-view"
      className="flex flex-col h-full"
      style={{ background: "var(--aia-alabaster)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-2"
        style={{
          borderBottom: "1px solid var(--gray-200)",
          background: "var(--color-bg-surface)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--aia-corp-dark)",
            margin: 0,
          }}
        >
          Curvas S
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.7rem",
            color: "var(--gray-500)",
            margin: "2px 0 0",
          }}
        >
          Análisis de cronograma, presupuesto y valor ganado
        </p>
      </div>

      {/* Sub-view tabs */}
      <div
        className="flex gap-2 px-4 py-2"
        style={{
          borderBottom: "1px solid var(--gray-200)",
          background: "var(--color-bg-surface)",
        }}
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
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4 overflow-auto">
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
          color: "var(--gray-500)",
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
