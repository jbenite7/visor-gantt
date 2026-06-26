import { GanttTask } from "../types";

interface SummaryBarProps {
  task: GanttTask;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  onClick?: () => void;
  isSelected?: boolean;
  /** Horizontal room reserved for the external summary label chip. */
  labelReserveWidth?: number;
}

export default function SummaryBar({
  task,
  x,
  y,
  width,
  height,
  color,
  onClick,
  isSelected,
  labelReserveWidth = 0,
}: SummaryBarProps) {
  const midY = y + height * 0.5;
  const bracketTopY = y + height * 0.3;
  const bracketLen = 8;
  const maxReserve = Math.max(0, width - bracketLen * 3);
  const lineStartX = x + Math.min(labelReserveWidth, maxReserve);
  const lineEndX = x + width;
  const rightBracketStartX = Math.max(lineStartX, lineEndX - bracketLen);

  const strokeColor = isSelected ? "var(--aia-proj-main)" : color;
  const strokeW = isSelected ? 3 : 2;

  return (
    <g
      className="gantt-summary-bar cursor-pointer"
      onClick={onClick}
      data-testid="summary-bar"
      data-task-id={task.id}
    >
      <title>{task.name}</title>

      {/* Thin horizontal line */}
      <line
        data-testid="summary-line"
        x1={lineStartX}
        y1={midY}
        x2={lineEndX}
        y2={midY}
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.7}
      />

      {/* Left bracket — downward */}
      <polyline
        points={`${lineStartX},${bracketTopY} ${lineStartX},${midY} ${lineStartX + bracketLen},${midY}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.7}
      />

      {/* Right bracket — upward */}
      <polyline
        points={`${rightBracketStartX},${midY} ${lineEndX},${midY} ${lineEndX},${bracketTopY}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.7}
      />
    </g>
  );
}
