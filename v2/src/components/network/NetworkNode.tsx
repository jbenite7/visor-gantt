import type { NetworkNode as NetworkNodeType } from "@/lib/layout/networkLayout";

interface NetworkNodeProps {
  node: NetworkNodeType;
  onClick?: (taskId: string | number) => void;
  onStartConnection?: (taskId: string | number) => void;
  isSelected?: boolean;
  isConnectSource?: boolean;
}

function formatDate(date: Date | undefined): string {
  if (!date) return "";
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
}

function truncateName(name: string, maxLen = 25): string {
  return name.length > maxLen ? `${name.slice(0, maxLen - 1)}\u2026` : name;
}

export default function NetworkNode({
  node,
  onClick,
  onStartConnection,
  isSelected = false,
  isConnectSource = false,
}: NetworkNodeProps) {
  const handleClick = () => {
    onClick?.(node.taskId);
  };

  const connector = onStartConnection && (
    <circle
      data-testid="network-connector"
      data-task-id={node.taskId}
      cx={node.x + node.width}
      cy={node.y + node.height / 2}
      r={6}
      fill={isConnectSource ? "var(--aia-proj-main)" : "var(--aia-alabaster)"}
      stroke="var(--aia-corp-mid)"
      strokeWidth={1}
      style={{ cursor: "crosshair" }}
      onClick={(event) => {
        event.stopPropagation();
        onStartConnection(node.taskId);
      }}
    />
  );

  // ── Milestone diamond ──
  if (node.isMilestone) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const size = 24;
    const points = [
      `${cx},${cy - size}`,
      `${cx + size},${cy}`,
      `${cx},${cy + size}`,
      `${cx - size},${cy}`,
    ].join(" ");

    return (
      <g
        data-testid="network-node"
        data-task-id={node.taskId}
        onClick={handleClick}
        style={{ cursor: "pointer" }}
      >
        <polygon
          points={points}
          fill={
            node.isCritical ? "var(--aia-alert-xlight)" : "var(--aia-alabaster)"
          }
          stroke={
            isSelected
              ? "var(--aia-proj-main)"
              : node.isCritical
                ? "var(--aia-alert-main)"
                : "var(--aia-corp-mid)"
          }
          strokeWidth={isSelected ? 3 : node.isCritical ? 2 : 1}
        />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill="var(--aia-corp-dark)"
        >
          {truncateName(node.taskName, 20)}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fontSize={10}
          fill="var(--aia-corp-mid)"
        >
          {node.duration}d
        </text>
        {connector}
      </g>
    );
  }

  // ── Summary thick left border ──
  const fill =
    node.isCritical ? "var(--aia-alert-xlight)" : "var(--aia-alabaster)";
  const stroke = isSelected
    ? "var(--aia-proj-main)"
    : node.isCritical
      ? "var(--aia-alert-main)"
      : "var(--aia-corp-mid)";
  const strokeWidth = isSelected ? 3 : node.isCritical ? 2 : 1;

  return (
    <g
      data-testid="network-node"
      data-task-id={node.taskId}
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      {/* Background rect */}
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={8}
        ry={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      {/* Summary left border */}
      {node.isSummary && (
        <rect
          x={node.x}
          y={node.y}
          width={4}
          height={node.height}
          rx={2}
          fill="var(--aia-arch-main)"
        />
      )}

      {/* Task name */}
      <text
        x={node.x + 10}
        y={node.y + 20}
        fontSize={12}
        fontWeight={600}
        fill="var(--aia-corp-dark)"
      >
        {truncateName(node.taskName)}
      </text>

      {/* Duration */}
      <text
        x={node.x + 10}
        y={node.y + 38}
        fontSize={11}
        fill="var(--aia-corp-mid)"
      >
        {node.duration}d
      </text>

      {/* Dates */}
      <text
        x={node.x + 10}
        y={node.y + 55}
        fontSize={10}
        fill="var(--aia-corp-mid)"
      >
        {formatDate(node.earlyStart)}
      </text>
      {connector}
    </g>
  );
}
