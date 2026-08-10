import type { NetworkEdge } from "@/lib/layout/networkLayout";

interface NetworkArrowProps {
  edge: NetworkEdge;
  isSelected?: boolean;
  onSelect?: (edge: {
    fromTaskId: string | number;
    toTaskId: string | number;
  }) => void;
}

export default function NetworkArrow({
  edge,
  isSelected = false,
  onSelect,
}: NetworkArrowProps) {
  const midX = (edge.fromX + edge.toX) / 2;

  // L-shaped routing: right from source, then vertical, then left to target
  const pathD = `M ${edge.fromX},${edge.fromY} H ${midX} V ${edge.toY} H ${edge.toX}`;

  const strokeColor = isSelected
    ? "var(--aia-proj-main)"
    : edge.isCritical
      ? "var(--aia-alert-main)"
      : "var(--aia-corp-mid)";
  const strokeWidth = isSelected ? 3 : edge.isCritical ? 2.5 : 1.5;

  // Arrowhead polygon pointing left (toward target)
  const arrowSize = 8;
  const arrowPoints = [
    `${edge.toX},${edge.toY}`,
    `${edge.toX + arrowSize},${edge.toY - arrowSize / 2}`,
    `${edge.toX + arrowSize},${edge.toY + arrowSize / 2}`,
  ].join(" ");

  return (
    <g
      data-testid="network-arrow"
      data-from={String(edge.fromTaskId)}
      data-to={String(edge.toTaskId)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.({ fromTaskId: edge.fromTaskId, toTaskId: edge.toTaskId });
      }}
      style={{ cursor: onSelect ? "pointer" : "default" }}
    >
      {/* Zona de clic: la línea es demasiado fina para acertarle */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={12} />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <polygon points={arrowPoints} fill={strokeColor} />
    </g>
  );
}
