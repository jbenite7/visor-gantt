"use client";

import { useCallback, useMemo, useState } from "react";

// ── Public Types ──

export interface SCurveLinePoint {
  date: Date;
  value: number;
}

export interface SCurveLineData {
  label: string;
  points: SCurveLinePoint[];
  color: string;
}

export interface SCurveChartProps {
  lines: SCurveLineData[];
  xLabel?: string;
  yLabel?: string;
  yFormat?: (value: number) => string;
  showLegend?: boolean;
  indices?: { label: string; value: number }[];
}

// ── Layout Constants ──

const MARGIN = { top: 32, right: 24, bottom: 60, left: 80 };

// ── Helper Functions ──

function dateToX(
  date: Date,
  min: Date,
  max: Date,
  chartWidth: number,
): number {
  const range = max.getTime() - min.getTime();
  if (range === 0) return chartWidth / 2;
  return MARGIN.left + ((date.getTime() - min.getTime()) / range) * chartWidth;
}

function valueToY(
  value: number,
  maxValue: number,
  height: number,
): number {
  if (maxValue === 0) return height - MARGIN.bottom;
  return (
    height -
    MARGIN.bottom -
    (value / maxValue) * (height - MARGIN.top - MARGIN.bottom)
  );
}

function formatDateShort(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function generateDateTicks(min: Date, max: Date): Date[] {
  const ticks: Date[] = [];
  const current = new Date(min);
  // Step by ~1/8 of range for reasonable tick count
  const rangeMs = max.getTime() - min.getTime();
  const stepMs = Math.max(rangeMs / 8, 86400000); // At least 1 day apart
  const stepDays = Math.max(Math.round(stepMs / 86400000), 1);

  // Align first tick to a clean interval
  current.setDate(current.getDate() + stepDays);
  while (current <= max) {
    ticks.push(new Date(current));
    current.setDate(current.getDate() + stepDays);
  }
  return ticks;
}

function generateValueTicks(maxValue: number): number[] {
  if (maxValue <= 0) return [0];
  const step = maxValue / 5;
  const ticks: number[] = [];
  for (let i = 0; i <= 5; i++) {
    ticks.push(Math.round(step * i * 100) / 100);
  }
  return ticks;
}

function pointsToPolyline(
  points: SCurveLinePoint[],
  min: Date,
  max: Date,
  maxValue: number,
  chartWidth: number,
  height: number,
): string {
  return points
    .map((p) => {
      const x = dateToX(p.date, min, max, chartWidth);
      const y = valueToY(p.value, maxValue, height);
      return `${x},${y}`;
    })
    .join(" ");
}

function pointsToAreaPolygon(
  points: SCurveLinePoint[],
  min: Date,
  max: Date,
  maxValue: number,
  chartWidth: number,
  height: number,
): string {
  if (points.length === 0) return "";
  const bottom = height - MARGIN.bottom;
  const topEdge = points
    .map((p) => {
      const x = dateToX(p.date, min, max, chartWidth);
      const y = valueToY(p.value, maxValue, height);
      return `${x},${y}`;
    })
    .join(" ");
  const rightX = dateToX(points[points.length - 1].date, min, max, chartWidth);
  const leftX = dateToX(points[0].date, min, max, chartWidth);
  return `${topEdge} ${rightX},${bottom} ${leftX},${bottom}`;
}

// ── Component ──

export default function SCurveChart({
  lines,
  yFormat,
  showLegend = true,
  indices,
}: SCurveChartProps) {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const [tooltipData, setTooltipData] = useState<{
    x: number;
    y: number;
    date: Date;
    value: number;
    label: string;
    color: string;
  } | null>(null);

  // Compute bounds from all visible lines
  const { minDate, maxDate, maxValue } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let maxVal = 0;

    for (const line of lines) {
      if (hiddenLines.has(line.label)) continue;
      for (const p of line.points) {
        const t = p.date.getTime();
        if (t < min) min = t;
        if (t > max) max = t;
        if (p.value > maxVal) maxVal = p.value;
      }
    }

    if (min === Infinity) {
      const today = new Date();
      return { minDate: today, maxDate: today, maxValue: 100 };
    }

    return {
      minDate: new Date(min),
      maxDate: new Date(max),
      maxValue: maxVal > 0 ? maxVal * 1.05 : 100, // 5% headroom
    };
  }, [lines, hiddenLines]);

  const width = 800;
  const height = 400;
  const chartWidth = width - MARGIN.left - MARGIN.right;
  const chartHeight = height - MARGIN.top - MARGIN.bottom;

  const dateTicks = useMemo(
    () => generateDateTicks(minDate, maxDate),
    [minDate, maxDate],
  );

  const valueTicks = useMemo(
    () => generateValueTicks(maxValue),
    [maxValue],
  );

  const formatValue = useCallback(
    (v: number) => (yFormat ? yFormat(v) : v.toLocaleString("es-CO")),
    [yFormat],
  );

  const handlePointHover = useCallback(
    (
      e: React.MouseEvent<SVGCircleElement>,
      point: SCurveLinePoint,
      label: string,
      color: string,
    ) => {
      const svgRect = e.currentTarget.closest("svg")?.getBoundingClientRect();
      if (!svgRect) return;
      setTooltipData({
        x: e.clientX - svgRect.left,
        y: e.clientY - svgRect.top,
        date: point.date,
        value: point.value,
        label,
        color,
      });
    },
    [],
  );

  const handlePointLeave = useCallback(() => {
    setTooltipData(null);
  }, []);

  const toggleLine = useCallback((label: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  return (
    <div
      data-testid="s-curve-chart"
      style={{
        background: "var(--aia-alabaster)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        position: "relative",
      }}
    >
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          fontFamily: "var(--font-inter)",
          fontSize: "11px",
        }}
      >
        {/* Background */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={chartWidth}
          height={chartHeight}
          fill="white"
          rx="2"
        />

        {/* Horizontal grid lines (value) */}
        {valueTicks.map((tick) => {
          const y = valueToY(tick, maxValue, height);
          return (
            <line
              key={`hgrid-${tick}`}
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
          const x = dateToX(tick, minDate, maxDate, chartWidth);
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

        {/* Area fills under each line */}
        {lines.map((line) => {
          if (hiddenLines.has(line.label)) return null;
          const polygon = pointsToAreaPolygon(
            line.points,
            minDate,
            maxDate,
            maxValue,
            chartWidth,
            height,
          );
          if (!polygon) return null;
          return (
            <polygon
              key={`area-${line.label}`}
              points={polygon}
              fill={line.color}
              fillOpacity={0.1}
              stroke="none"
            />
          );
        })}

        {/* Lines (polylines) */}
        {lines.map((line) => {
          if (hiddenLines.has(line.label)) return null;
          const polyline = pointsToPolyline(
            line.points,
            minDate,
            maxDate,
            maxValue,
            chartWidth,
            height,
          );
          if (!polyline) return null;
          return (
            <polyline
              key={`line-${line.label}`}
              points={polyline}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* Data points with hover */}
        {lines.map((line) => {
          if (hiddenLines.has(line.label)) return null;
          return line.points.map((p, i) => {
            const x = dateToX(p.date, minDate, maxDate, chartWidth);
            const y = valueToY(p.value, maxValue, height);
            return (
              <circle
                key={`point-${line.label}-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill={line.color}
                stroke="white"
                strokeWidth={1.5}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => handlePointHover(e, p, line.label, line.color)}
                onMouseLeave={handlePointLeave}
              />
            );
          });
        })}

        {/* X-axis labels (dates) */}
        {dateTicks.map((tick) => {
          const x = dateToX(tick, minDate, maxDate, chartWidth);
          return (
            <text
              key={`xlabel-${tick.getTime()}`}
              x={x}
              y={height - MARGIN.bottom + 16}
              textAnchor="middle"
              fill="var(--gray-600)"
              fontSize={10}
            >
              {formatDateShort(tick)}
            </text>
          );
        })}

        {/* Y-axis labels */}
        {valueTicks.map((tick) => {
          const y = valueToY(tick, maxValue, height);
          return (
            <text
              key={`ylabel-${tick}`}
              x={MARGIN.left - 10}
              y={y + 4}
              textAnchor="end"
              fill="var(--gray-600)"
              fontSize={10}
            >
              {formatValue(tick)}
            </text>
          );
        })}

        {/* Axes */}
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
      </svg>

      {/* Tooltip */}
      {tooltipData && (
        <div
          style={{
            position: "absolute",
            left: tooltipData.x + 12,
            top: tooltipData.y - 40,
            background: "var(--color-bg-surface)",
            border: "1px solid var(--gray-200)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 10px",
            fontSize: "0.7rem",
            fontFamily: "var(--font-inter)",
            color: "var(--gray-800)",
            boxShadow: "var(--shadow-md)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600, color: tooltipData.color, marginBottom: 2 }}>
            {tooltipData.label}
          </div>
          <div>{formatDateShort(tooltipData.date)} — {formatValue(tooltipData.value)}</div>
        </div>
      )}

      {/* Legend (outside SVG) */}
      {showLegend && lines.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "8px",
            justifyContent: "center",
          }}
        >
          {lines.map((line) => {
            const isHidden = hiddenLines.has(line.label);
            return (
              <button
                key={line.label}
                onClick={() => toggleLine(line.label)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${isHidden ? "var(--gray-300)" : line.color}`,
                  background: isHidden ? "transparent" : `${line.color}10`,
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-inter)",
                  color: isHidden ? "var(--gray-400)" : "var(--gray-700)",
                  opacity: isHidden ? 0.5 : 1,
                  transition: "opacity 0.15s, border-color 0.15s",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 3,
                    borderRadius: 2,
                    background: isHidden ? "var(--gray-300)" : line.color,
                    display: "inline-block",
                  }}
                />
                {line.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Performance indices (CPI, SPI) */}
      {indices && indices.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "12px",
            justifyContent: "center",
          }}
        >
          {indices.map((idx) => {
            const isGood = idx.value > 1;
            const isBad = idx.value < 1;
            const color = isGood
              ? "var(--aia-corp-main)"
              : isBad
                ? "var(--aia-alert-main)"
                : "var(--gray-600)";
            return (
              <div
                key={idx.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: isGood
                    ? "var(--aia-corp-xlight)"
                    : isBad
                      ? "var(--aia-alert-xlight)"
                      : "var(--gray-100)",
                  border: `1px solid ${color}`,
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-montserrat)",
                    color,
                  }}
                >
                  {idx.label}:
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-montserrat)",
                    color,
                  }}
                >
                  {idx.value.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
