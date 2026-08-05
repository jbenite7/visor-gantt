import type { ObservationBadge as Badge } from "@/lib/observations/observations";

interface ObservationBadgeProps {
  badge: Badge;
  /** Extremo derecho de la barra: el distintivo se ancla ahí. */
  x: number;
  y: number;
  height: number;
}

const RADIUS = 7;

/**
 * Momento firma: el estado del trabajo de campo, visible sobre el plan.
 * Ámbar «!» mientras queda algo por atender, verde «✓» cuando todo está resuelto.
 */
export default function ObservationBadge({
  badge,
  x,
  y,
  height,
}: ObservationBadgeProps) {
  const pending = badge.kind === "pending";
  const cy = y + height / 2;
  const label = pending
    ? `${badge.count} observación(es) pendiente(s)`
    : `${badge.count} observación(es), todas atendidas`;

  return (
    <g pointerEvents="none" data-testid="observation-badge" data-kind={badge.kind}>
      <title>{label}</title>
      <circle
        cx={x}
        cy={cy}
        r={RADIUS}
        fill={pending ? "var(--aia-warn-main)" : "var(--aia-corp-main)"}
        stroke={pending ? "var(--aia-warn-dark)" : "var(--aia-corp-dark)"}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={pending ? 10 : 9}
        fontWeight={700}
        fill={pending ? "var(--aia-warn-dark)" : "white"}
      >
        {pending ? "!" : "✓"}
      </text>
    </g>
  );
}
