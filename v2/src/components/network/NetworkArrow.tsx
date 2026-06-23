import type { NetworkEdge } from "@/lib/layout/networkLayout";

interface NetworkArrowProps {
  edge: NetworkEdge;
}

export default function NetworkArrow({ edge }: NetworkArrowProps) {
  const midX = (edge.fromX + edge.toX) / 2;

  // L-shaped routing: right from source, then vertical, then left to target
  const pathD = `M ${edge.fromX},${edge.fromY} H ${midX} V ${edge.toY} H ${edge.toX}`;

  const strokeColor = edge.isCritical
    ? "var(--aia-alert-main)"
    : "var(--aia-corp-mid)";
  const strokeWidth = edge.isCritical ? 2.5 : 1.5;

  // Arrowhead polygon pointing left (toward target)
  const arrowSize = 8;
  const arrowPoints = [
    `${edge.toX},${edge.toY}`,
    `${edge.toX + arrowSize},${edge.toY - arrowSize / 2}`,
    `${edge.toX + arrowSize},${edge.toY + arrowSize / 2}`,
  ].join(" ");

  return (
    <g data-testid="network-arrow">
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
