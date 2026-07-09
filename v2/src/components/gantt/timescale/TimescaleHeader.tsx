import { GanttViewport, type GanttScale } from "../types";
import {
  generateMonthGroups,
  generateQuarterGroups,
  generateWeekGroups,
  isWeekend,
  isToday,
} from "../utils";

interface TimescaleHeaderProps {
  viewport: GanttViewport;
  columns: Date[];
  columnWidth: number;
  headerHeight: number;
}

const DAY_INITIALS = ["D", "L", "M", "X", "J", "V", "S"] as const;
const MONTH_LABEL_MIN_WIDTH = 86;
const WEEK_LABEL_MIN_WIDTH = 28;
const DAY_LABEL_MIN_WIDTH = 24;

function getDayLabel(date: Date): string {
  const dayIndex = date.getDay();
  return `${DAY_INITIALS[dayIndex]} ${date.getDate()}`;
}

function getTierHeights(
  scale: GanttScale,
  totalHeight: number,
): { top: number; mid: number; bottom: number } {
  if (scale === "day") {
    return {
      top: Math.round(totalHeight * 0.4),
      mid: Math.round(totalHeight * 0.3),
      bottom: totalHeight - Math.round(totalHeight * 0.4) - Math.round(totalHeight * 0.3),
    };
  }
  if (scale === "week" || scale === "quarter") {
    return {
      top: Math.round(totalHeight * 0.5),
      mid: totalHeight - Math.round(totalHeight * 0.5),
      bottom: 0,
    };
  }
  return { top: totalHeight, mid: 0, bottom: 0 };
}

export default function TimescaleHeader({
  viewport,
  columns,
  columnWidth,
  headerHeight,
}: TimescaleHeaderProps) {
  const { scale } = viewport;
  const tiers = getTierHeights(scale, headerHeight);
  const totalWidth = columns.length * columnWidth;

  const monthGroups = generateMonthGroups(columns);
  const quarterGroups = generateQuarterGroups(columns);
  const weekGroups = scale !== "month" && scale !== "quarter" ? generateWeekGroups(columns) : [];

  return (
    <g className="timescale-header">
      {/* Full header background */}
      <rect
        x={0}
        y={0}
        width={totalWidth}
        height={headerHeight}
        fill="var(--aia-corp-dark)"
      />

      {/* Weekend column shading (Sunday = day 0) */}
      {columns.map((date, i) => {
        if (!isWeekend(date)) return null;
        return (
          <rect
            key={`wknd-${i}`}
            x={i * columnWidth}
            y={0}
            width={columnWidth}
            height={headerHeight}
            fill="var(--gantt-timescale-nonworking-fill)"
          />
        );
      })}

      {/* Today column highlight */}
      {columns.map((date, i) => {
        if (!isToday(date)) return null;
        return (
          <rect
            key={`today-${i}`}
            x={i * columnWidth}
            y={0}
            width={columnWidth}
            height={headerHeight}
            fill="var(--aia-proj-xlight)"
            opacity={0.25}
          />
        );
      })}

      {/* ── Month/quarter tier (always present) ── */}
      <g className="tier-month">
        {(scale === "quarter" ? quarterGroups : monthGroups).map((group, i) => {
          const x = group.startCol * columnWidth;
          const w = group.colCount * columnWidth;
          return (
            <g key={`month-${i}`}>
              <rect
                x={x}
                y={0}
                width={w}
                height={tiers.top}
                fill="transparent"
              />
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={tiers.top}
                stroke="var(--aia-corp-mid)"
                strokeWidth={1}
              />
              {w >= MONTH_LABEL_MIN_WIDTH && (
                <text
                  x={x + w / 2}
                  y={tiers.top / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--color-text-on-primary)"
                  fontSize={13}
                  fontWeight={600}
                >
                  {group.label}
                </text>
              )}
            </g>
          );
        })}
        {/* Right edge of last month group */}
        <line
          x1={totalWidth}
          y1={0}
          x2={totalWidth}
          y2={tiers.top}
          stroke="var(--aia-corp-mid)"
          strokeWidth={1}
        />
      </g>

      {/* ── Week tier (day + week views) ── */}
      {scale !== "month" && scale !== "quarter" && (
        <g className="tier-week">
          {weekGroups.map((group, i) => {
            const x = group.startCol * columnWidth;
            const w = group.colCount * columnWidth;
            const y = tiers.top;
            return (
              <g key={`week-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={tiers.mid}
                  fill="transparent"
                />
                <line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y + tiers.mid}
                  stroke="var(--aia-corp-mid)"
                  strokeWidth={1}
                />
                {w >= WEEK_LABEL_MIN_WIDTH && (
                  <text
                    x={x + w / 2}
                    y={y + tiers.mid / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--color-text-on-primary)"
                    fontSize={12}
                    fontWeight={500}
                  >
                    {group.label}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={totalWidth}
            y1={tiers.top}
            x2={totalWidth}
            y2={tiers.top + tiers.mid}
            stroke="var(--aia-corp-mid)"
            strokeWidth={1}
          />
        </g>
      )}

      {scale === "quarter" && (
        <g className="tier-quarter-months">
          {monthGroups.map((group, i) => {
            const x = group.startCol * columnWidth;
            const w = group.colCount * columnWidth;
            const y = tiers.top;
            return (
              <g key={`quarter-month-${i}`}>
                <line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y + tiers.mid}
                  stroke="var(--aia-corp-mid)"
                  strokeWidth={1}
                />
                {w >= MONTH_LABEL_MIN_WIDTH && (
                  <text
                    x={x + w / 2}
                    y={y + tiers.mid / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--color-text-on-primary)"
                    fontSize={12}
                    fontWeight={500}
                  >
                    {group.label}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={totalWidth}
            y1={tiers.top}
            x2={totalWidth}
            y2={tiers.top + tiers.mid}
            stroke="var(--aia-corp-mid)"
            strokeWidth={1}
          />
        </g>
      )}

      {/* ── Day tier (day view only) ── */}
      {scale === "day" && (
        <g className="tier-day">
          {columns.map((date, i) => {
            const x = i * columnWidth;
            const y = tiers.top + tiers.mid;
            return (
              <g key={`day-${i}`}>
                <line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y + tiers.bottom}
                  stroke="var(--aia-corp-mid)"
                  strokeWidth={1}
                />
                {columnWidth >= DAY_LABEL_MIN_WIDTH && (
                  <text
                    x={x + columnWidth / 2}
                    y={y + tiers.bottom / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--color-text-on-primary)"
                    fontSize={11}
                  >
                    {getDayLabel(date)}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={totalWidth}
            y1={tiers.top + tiers.mid}
            x2={totalWidth}
            y2={headerHeight}
            stroke="var(--aia-corp-mid)"
            strokeWidth={1}
          />
        </g>
      )}

      {/* ── Tier separator lines (horizontal) ── */}
      {scale === "day" && tiers.mid > 0 && (
        <line
          x1={0}
          y1={tiers.top}
          x2={totalWidth}
          y2={tiers.top}
          stroke="var(--aia-corp-mid)"
          strokeWidth={1}
        />
      )}
      {scale === "day" && tiers.bottom > 0 && (
        <line
          x1={0}
          y1={tiers.top + tiers.mid}
          x2={totalWidth}
          y2={tiers.top + tiers.mid}
          stroke="var(--aia-corp-mid)"
          strokeWidth={1}
        />
      )}
      {(scale === "week" || scale === "quarter") && tiers.mid > 0 && (
        <line
          x1={0}
          y1={tiers.top}
          x2={totalWidth}
          y2={tiers.top}
          stroke="var(--aia-corp-mid)"
          strokeWidth={1}
        />
      )}

      {/* Bottom border */}
      <line
        x1={0}
        y1={headerHeight}
        x2={totalWidth}
        y2={headerHeight}
        stroke="var(--aia-corp-mid)"
        strokeWidth={1}
      />
    </g>
  );
}
