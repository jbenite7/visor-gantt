/**
 * DependencyArrow — SVG dependency arrow between two Gantt tasks.
 *
 * Renders:
 *   1. A path for the arrow body (L-shaped routing)
 *   2. An arrowhead polygon at the target end
 *   3. Optional lag label near the path midpoint
 *
 * Critical dependencies are red, normal are gray.
 */

import { calculateArrowPath, getArrowDirection } from "./ArrowPath";
import type { DependencyType } from "./ArrowPath";

interface DependencyArrowProps {
  /** Predecessor endpoint coordinates and criticality. */
  from: { x: number; y: number; isCritical: boolean };
  /** Successor endpoint coordinates. */
  to: { x: number; y: number };
  /** Dependency type. */
  type: DependencyType;
  /** Optional lag in days. */
  lag?: number;
  /** Row height in pixels (default 40). */
  rowHeight: number;
}

/** Arrowhead triangle size (px). */
const ARROW_SIZE = 8;
const LAG_BADGE_HEIGHT = 16;
const LAG_BADGE_PADDING_X = 6;

/**
 * Build an SVG polygon points string for a triangle arrowhead.
 * Direction determines which way the triangle points.
 */
function arrowHeadPoints(
  tipX: number,
  tipY: number,
  direction: "left" | "right",
): string {
  if (direction === "right") {
    // ▶ pointing right
    return [
      `${tipX},${tipY}`,
      `${tipX - ARROW_SIZE},${tipY - ARROW_SIZE / 2}`,
      `${tipX - ARROW_SIZE},${tipY + ARROW_SIZE / 2}`,
    ].join(" ");
  }
  // ◀ pointing left
  return [
    `${tipX},${tipY}`,
    `${tipX + ARROW_SIZE},${tipY - ARROW_SIZE / 2}`,
    `${tipX + ARROW_SIZE},${tipY + ARROW_SIZE / 2}`,
  ].join(" ");
}

/**
 * Calculate the midpoint of the L-shaped path for lag label placement.
 * Approximate: midpoint of the vertical segment.
 */
function midPoint(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  type: DependencyType,
): { x: number; y: number } {
  const leadRight = type === "FS" || type === "FF";
  const leadX = leadRight ? fromX + 10 : fromX - 10;
  // Midpoint of the vertical segment (between leadX/fromY and leadX/toY)
  return {
    x: leadX + 4,
    y: (fromY + toY) / 2,
  };
}

export default function DependencyArrow({
  from,
  to,
  type,
  lag,
}: DependencyArrowProps) {
  const d = calculateArrowPath(from.x, from.y, to.x, to.y, type);
  const direction = getArrowDirection(from.x, from.y, to.x, to.y, type);

  const color = from.isCritical
    ? "var(--aia-alert-main)"
    : "var(--aia-corp-mid)";
  const strokeWidth = from.isCritical ? 2 : 1;
  const arrowOpacity = from.isCritical ? 0.78 : 0.62;

  // Lag label
  const showLag = lag !== undefined && lag !== 0;
  const lagText = lag !== undefined ? (lag > 0 ? `+${lag}d` : `${lag}d`) : "";
  const mid = showLag ? midPoint(from.x, from.y, to.x, to.y, type) : null;
  const lagBadgeWidth = lagText.length * 6 + LAG_BADGE_PADDING_X * 2;

  return (
    <g data-testid="dependency-arrow">
      {/* Arrow path */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={arrowOpacity}
      />

      {/* Arrowhead */}
      <polygon
        points={arrowHeadPoints(to.x, to.y, direction)}
        fill={color}
        opacity={arrowOpacity}
      />

      {/* Lag label */}
      {showLag && mid !== null && (
        <g
          data-testid="dependency-lag-badge"
          className="pointer-events-none select-none"
        >
          <rect
            x={mid.x - lagBadgeWidth / 2}
            y={mid.y - LAG_BADGE_HEIGHT / 2}
            width={lagBadgeWidth}
            height={LAG_BADGE_HEIGHT}
            fill="var(--aia-alabaster)"
            stroke="var(--aia-corp-mid)"
            strokeWidth={0.75}
            rx={3}
            opacity={0.96}
          />
          <text
            x={mid.x}
            y={mid.y}
            fill="var(--aia-corp-dark)"
            fontSize={10}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {lagText}
          </text>
        </g>
      )}
    </g>
  );
}
