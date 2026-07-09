"use client";

import { useMemo, useState } from "react";
import type { LOBActivity, LOBUnit } from "@/types/lob";
import { computeLOBLayout, diagnoseLOB } from "@/lib/scheduling/lob";

// ── Layout constants ──────────────────────────────────────────────

const MARGIN = { top: 40, right: 140, bottom: 60, left: 180 };

// ── Helper functions ──────────────────────────────────────────────

function dateToX(date: Date, min: Date, max: Date, width: number): number {
  const range = max.getTime() - min.getTime();
  if (range === 0) return width / 2;
  return MARGIN.left + ((date.getTime() - min.getTime()) / range) * width;
}

function unitToY(unitIndex: number, maxUnit: number, height: number): number {
  if (maxUnit === 0) return height - MARGIN.bottom;
  // Invert: unit 0 at bottom, maxUnit at top
  return (
    height -
    MARGIN.bottom -
    (unitIndex / maxUnit) * (height - MARGIN.top - MARGIN.bottom)
  );
}

function formatDate(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString("es-ES", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function generateDateTicks(min: Date, max: Date, scale: "week" | "month"): Date[] {
  const ticks: Date[] = [];
  const current = new Date(min);
  if (scale === "month") {
    current.setDate(1);
    if (current < min) {
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    const day = current.getDay() || 7;
    current.setDate(current.getDate() - day + 1);
  }
  while (current <= max) {
    ticks.push(new Date(current));
    if (scale === "month") {
      current.setMonth(current.getMonth() + 1);
    } else {
      current.setDate(current.getDate() + 7);
    }
  }
  return ticks;
}

// ── Component ─────────────────────────────────────────────────────

interface LineOfBalanceProps {
  activities: LOBActivity[];
  units: LOBUnit[];
}

export default function LineOfBalance({ activities, units }: LineOfBalanceProps) {
  const [scale, setScale] = useState<"week" | "month">("month");
  const layout = useMemo(
    () => computeLOBLayout(activities, units),
    [activities, units],
  );
  const diagnostics = useMemo(
    () => diagnoseLOB(activities, units),
    [activities, units],
  );

  // Responsive dimensions
  const width = 980;
  const height = Math.max(400, 200 + layout.totalUnits * 50);

  const chartWidth = width - MARGIN.left - MARGIN.right;
  const chartHeight = height - MARGIN.top - MARGIN.bottom;

  const dateTicks = useMemo(
    () => generateDateTicks(layout.xScale.min, layout.xScale.max, scale),
    [layout.xScale.min, layout.xScale.max, scale],
  );

  const unitLabels = useMemo(() => {
    const labels: { index: number; label: string }[] = [];
    const unitNamesByIndex = new Map<number, string>();
    for (const unit of units) {
      if (unit.unitName && !unitNamesByIndex.has(unit.unitIndex)) {
        unitNamesByIndex.set(unit.unitIndex, unit.unitName);
      }
    }

    const unitLabel = activities.length > 0 ? activities[0].unitLabel : "Unidad";
    for (let i = 0; i <= layout.totalUnits; i++) {
      labels.push({ index: i, label: unitNamesByIndex.get(i) ?? `${unitLabel} ${i + 1}` });
    }
    return labels;
  }, [layout.totalUnits, activities, units]);

  // ── Tolerance bands (±10% of chart height) ────────────────────
  const toleranceBandHeight = chartHeight * 0.1;

  // ── Group lines by activityId (planned + actual share color) ───
  const plannedLines = layout.lines.filter((l) => !l.activityName.includes("(Real)"));
  const actualLines = layout.lines.filter((l) => l.activityName.includes("(Real)"));

  // ── Unique activity names for legend (without plan/real suffix) ──
  const legendItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { name: string; color: string }[] = [];
    for (const line of layout.lines) {
      const baseName = line.activityName
        .replace(" (Planificado)", "")
        .replace(" (Real)", "");
      if (!seen.has(baseName)) {
        seen.add(baseName);
        items.push({ name: baseName, color: line.color });
      }
    }
    return items;
  }, [layout.lines]);

  const hasLines = layout.lines.length > 0;

  return (
    <div
      data-testid="line-of-balance"
      className="apple-module flex h-full min-w-0 flex-col overflow-hidden"
    >
      <div className="apple-module-header flex flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <h2 className="lob-header__title">
            Línea de Balance — Producción por Unidad
          </h2>
          <p className="lob-header__description">
            Eje X: Tiempo &middot; Eje Y: Ubicación/nivel &middot; Líneas sólidas: Planificado &middot; Líneas punteadas: Real
          </p>
        </div>
        <div className="lob-scale-toggle">
          {(["week", "month"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="lob-scale-toggle__button"
              data-active={scale === option}
              aria-pressed={scale === option}
              onClick={() => setScale(option)}
            >
              {option === "week" ? "Semanas" : "Meses"}
            </button>
          ))}
        </div>
      </div>

      {!hasLines ? (
        <div className="apple-empty-state lob-empty-state flex-1">
          <p>
            No se detectaron actividades repetitivas suficientes para generar Línea de Balance.
            <br />
            <span className="lob-empty-state__hint">
              Usa tareas con WBS/nombres por nivel, piso o unidad para construir flujo de producción.
            </span>
          </p>
        </div>
      ) : null}

      {hasLines && diagnostics.length > 0 && (
        <section
          data-testid="lob-feedback"
          className="apple-module-header grid gap-2 px-4 py-3 md:grid-cols-3"
        >
          {diagnostics.slice(0, 3).map((diagnostic, index) => (
            <article
              key={`${diagnostic.kind}-${diagnostic.activityIds.join("-")}-${index}`}
              data-testid="lob-feedback-card"
              className="apple-section px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="lob-feedback-card__severity text-[0.6875rem] font-semibold uppercase text-[var(--color-text-muted)]"
                >
                  {diagnostic.severity === "high"
                    ? "Alta"
                    : diagnostic.severity === "medium"
                      ? "Media"
                      : "Baja"}
                </span>
                <span className="text-[0.6875rem] text-[var(--color-text-muted)]">
                  {diagnostic.unitIndices.length > 0
                    ? `Unid. ${diagnostic.unitIndices.map((unitIndex) => unitIndex + 1).join(", ")}`
                    : "General"}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-strong)]">
                {diagnostic.message}
              </p>
              <p
                className="lob-feedback-card__recommendation mt-1 overflow-hidden text-xs text-[var(--color-text-muted)]"
              >
                {diagnostic.recommendation}
              </p>
            </article>
          ))}
        </section>
      )}

      {hasLines ? (
        <div className="flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-x-hidden overflow-y-auto p-4">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMinYMin meet"
            className="lob-chart"
          >
          {/* Background */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={chartWidth}
            height={chartHeight}
            fill="var(--color-bg-elevated)"
            stroke="var(--color-hairline)"
            strokeWidth={1}
            className="lob-chart__frame"
          />

          {/* Horizontal grid lines (units) */}
          {unitLabels.map((ul) => {
            const y = unitToY(ul.index, layout.totalUnits, height);
            return (
              <line
                key={`hgrid-${ul.index}`}
                x1={MARGIN.left}
                y1={y}
                x2={width - MARGIN.right}
                y2={y}
                stroke="var(--aia-corp-mid)"
                strokeOpacity={0.15}
                strokeWidth={1}
              />
            );
          })}

          {/* Vertical grid lines (dates) */}
          {dateTicks.map((tick) => {
            const x = dateToX(tick, layout.xScale.min, layout.xScale.max, chartWidth);
            return (
              <line
                key={`vgrid-${tick.getTime()}`}
                x1={x}
                y1={MARGIN.top}
                x2={x}
                y2={height - MARGIN.bottom}
                stroke="var(--aia-corp-mid)"
                strokeOpacity={0.15}
                strokeWidth={1}
              />
            );
          })}

          {/* Tolerance bands — ±10% around each planned line */}
          {plannedLines.map((line) => {
            if (line.points.length < 2) return null;
            const maxUnit = layout.totalUnits || 1;
            const bandPoints = line.points.map((p) => {
              const x = dateToX(p.date, layout.xScale.min, layout.xScale.max, chartWidth);
              const yCenter = unitToY(p.unitIndex, maxUnit, height);
              return { x, yCenter };
            });

            // Build a polygon: top edge → bottom edge (reversed)
            const topEdge = bandPoints.map(
              (bp) => `${bp.x},${bp.yCenter - toleranceBandHeight}`,
            );
            const bottomEdge = bandPoints
              .map((bp) => `${bp.x},${bp.yCenter + toleranceBandHeight}`)
              .reverse();
            const polygonPoints = [...topEdge, ...bottomEdge].join(" ");

            return (
              <polygon
                key={`band-${line.activityId}`}
                points={polygonPoints}
                fill={line.color}
                fillOpacity={0.08}
                stroke="none"
              />
            );
          })}

          {/* Planned lines (solid) */}
          {plannedLines.map((line) => {
            const maxUnit = layout.totalUnits || 1;
            const polyline = line.points
              .map((p) => {
                const x = dateToX(p.date, layout.xScale.min, layout.xScale.max, chartWidth);
                const y = unitToY(p.unitIndex, maxUnit, height);
                return `${x},${y}`;
              })
              .join(" ");

            return (
              <g key={`planned-${line.activityId}`}>
                <polyline
                  points={polyline}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Data points */}
                {line.points.map((p) => {
                  const x = dateToX(p.date, layout.xScale.min, layout.xScale.max, chartWidth);
                  const y = unitToY(p.unitIndex, maxUnit, height);
                  return (
                    <circle
                      key={`point-${line.activityId}-${p.unitIndex}`}
                      cx={x}
                      cy={y}
                      r={4}
                      fill={line.color}
                      stroke="white"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Actual lines (dashed) */}
          {actualLines.map((line) => {
            const maxUnit = layout.totalUnits || 1;
            const polyline = line.points
              .map((p) => {
                const x = dateToX(p.date, layout.xScale.min, layout.xScale.max, chartWidth);
                const y = unitToY(p.unitIndex, maxUnit, height);
                return `${x},${y}`;
              })
              .join(" ");

            return (
              <g key={`actual-${line.activityId}`}>
                <polyline
                  points={polyline}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeOpacity={0.85}
                />
                {line.points.map((p) => {
                  const x = dateToX(p.date, layout.xScale.min, layout.xScale.max, chartWidth);
                  const y = unitToY(p.unitIndex, maxUnit, height);
                  return (
                    <circle
                      key={`actual-point-${line.activityId}-${p.unitIndex}`}
                      cx={x}
                      cy={y}
                      r={3.5}
                      fill="none"
                      stroke={line.color}
                      strokeWidth={1.5}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Critical deviation highlights — red segments where actual > planned by >20% */}
          {(() => {
            const highlights: React.ReactElement[] = [];
            for (const actualLine of actualLines) {
              const plannedLine = plannedLines.find(
                (pl) => pl.activityId === actualLine.activityId.replace("-actual", ""),
              );
              if (!plannedLine) continue;

              const maxUnit = layout.totalUnits || 1;
              for (const aPoint of actualLine.points) {
                const matchingPlanned = plannedLine.points.find(
                  (pp) => pp.unitIndex === aPoint.unitIndex,
                );
                if (!matchingPlanned) continue;

                const deviationMs = aPoint.date.getTime() - matchingPlanned.date.getTime();
                const plannedDurationMs = Math.abs(
                  plannedLine.points.length > 1
                    ? plannedLine.points[plannedLine.points.length - 1].date.getTime() -
                      plannedLine.points[0].date.getTime()
                    : 86400000,
                );

                if (plannedDurationMs > 0 && deviationMs > plannedDurationMs * 0.2) {
                  const x1 = dateToX(matchingPlanned.date, layout.xScale.min, layout.xScale.max, chartWidth);
                  const y1 = unitToY(matchingPlanned.unitIndex, maxUnit, height);
                  const x2 = dateToX(aPoint.date, layout.xScale.min, layout.xScale.max, chartWidth);
                  const y2 = unitToY(aPoint.unitIndex, maxUnit, height);

                  highlights.push(
                    <line
                      key={`critical-${actualLine.activityId}-${aPoint.unitIndex}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="var(--aia-alert-main)"
                      strokeWidth={3}
                      strokeOpacity={0.6}
                      strokeDasharray="4,3"
                    />,
                  );
                }
              }
            }
            return highlights;
          })()}

          {/* X-axis labels (dates) */}
          {dateTicks.map((tick) => {
            const x = dateToX(tick, layout.xScale.min, layout.xScale.max, chartWidth);
            return (
              <text
                key={`xlabel-${tick.getTime()}`}
                x={x}
                y={height - MARGIN.bottom + 18}
                textAnchor="middle"
                className="lob-chart__tick-label"
              >
                {formatDate(tick)}
              </text>
            );
          })}

          {/* Y-axis labels (units) */}
          {unitLabels.map((ul) => {
            const y = unitToY(ul.index, layout.totalUnits, height);
            return (
              <text
                key={`ylabel-${ul.index}`}
                x={MARGIN.left - 10}
                y={y + 4}
                textAnchor="end"
                className="lob-chart__tick-label"
              >
                {ul.label}
              </text>
            );
          })}

          {/* Axis labels */}
          <text
            x={MARGIN.left + chartWidth / 2}
            y={height - 8}
            textAnchor="middle"
            className="lob-chart__axis-label"
          >
            Tiempo
          </text>
          <text
            x={12}
            y={MARGIN.top + chartHeight / 2}
            textAnchor="middle"
            className="lob-chart__axis-label"
            transform={`rotate(-90, 12, ${MARGIN.top + chartHeight / 2})`}
          >
            Unidades de Producción
          </text>

          {/* Axes border */}
          <line
            x1={MARGIN.left}
            y1={MARGIN.top}
            x2={MARGIN.left}
            y2={height - MARGIN.bottom}
            stroke="var(--gray-400)"
            strokeWidth={1}
          />
          <line
            x1={MARGIN.left}
            y1={height - MARGIN.bottom}
            x2={width - MARGIN.right}
            y2={height - MARGIN.bottom}
            stroke="var(--gray-400)"
            strokeWidth={1}
          />

          {/* Legend — bottom right */}
          <g
            transform={`translate(${width - MARGIN.right + 12}, ${MARGIN.top})`}
          >
            <text
              x={0}
              y={0}
              className="lob-chart__legend-title"
            >
              Leyenda
            </text>
            {legendItems.map((item, i) => (
              <g
                key={item.name}
                transform={`translate(0, ${20 + i * 22})`}
              >
                <line
                  x1={0}
                  y1={0}
                  x2={18}
                  y2={0}
                  stroke={item.color}
                  strokeWidth={2.5}
                />
                <circle cx={9} cy={0} r={3} fill={item.color} stroke="white" strokeWidth={1} />
                <text
                  x={24}
                  y={4}
                  className="lob-chart__legend-label"
                >
                  {item.name}
                </text>
              </g>
            ))}
            {/* Legend for line styles */}
            <g transform={`translate(0, ${20 + legendItems.length * 22 + 10})`}>
              <text
                x={0}
                y={0}
                className="lob-chart__legend-style"
              >
                ─── Planificado
              </text>
              <text
                x={0}
                y={14}
                className="lob-chart__legend-style"
              >
                - - - Real
              </text>
            </g>
          </g>
        </svg>
      </div>
      ) : null}
    </div>
  );
}
