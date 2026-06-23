import { GanttViewport } from "../types";
import {
  generateMonthGroups,
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

function getDayLabel(date: Date): string {
  const dayIndex = date.getDay();
  return `${DAY_INITIALS[dayIndex]} ${date.getDate()}`;
}

function getTierHeights(
  scale: "day" | "week" | "month",
  totalHeight: number,
): { top: number; mid: number; bottom: number } {
  if (scale === "day") {
    return {
      top: Math.round(totalHeight * 0.4),
      mid: Math.round(totalHeight * 0.3),
      bottom: totalHeight - Math.round(totalHeight * 0.4) - Math.round(totalHeight * 0.3),
    };
  }
  if (scale === "week") {
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
  const weekGroups = scale !== "month" ? generateWeekGroups(columns) : [];

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
            fill="rgba(0,0,0,0.15)"
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

      {/* ── Month tier (always present) ── */}
      <g className="tier-month">
        {monthGroups.map((group, i) => {
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
              <text
                x={x + w / 2}
                y={tiers.top / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={13}
                fontWeight={600}
              >
                {group.label}
              </text>
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
      {scale !== "month" && (
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
                <text
                  x={x + w / 2}
                  y={y + tiers.mid / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={12}
                  fontWeight={500}
                >
                  {group.label}
                </text>
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
                <text
                  x={x + columnWidth / 2}
                  y={y + tiers.bottom / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={11}
                >
                  {getDayLabel(date)}
                </text>
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
      {scale === "week" && tiers.mid > 0 && (
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
