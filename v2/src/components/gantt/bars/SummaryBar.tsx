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
}: SummaryBarProps) {
  const midY = y + height * 0.5;
  const bracketTopY = y + height * 0.3;
  const bracketLen = 8;

  const strokeColor = isSelected ? "var(--aia-proj-main)" : color;
  const strokeW = isSelected ? 3 : 2;

  return (
    <g
      className="gantt-summary-bar cursor-pointer"
      onClick={onClick}
      data-testid="summary-bar"
      data-task-id={task.id}
    >
      {/* Thin horizontal line */}
      <line
        x1={x}
        y1={midY}
        x2={x + width}
        y2={midY}
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.7}
      />

      {/* Left bracket — downward */}
      <polyline
        points={`${x},${bracketTopY} ${x},${midY} ${x + bracketLen},${midY}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.7}
      />

      {/* Right bracket — upward */}
      <polyline
        points={`${x + width - bracketLen},${midY} ${x + width},${midY} ${x + width},${bracketTopY}`}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        opacity={0.7}
      />
    </g>
  );
}
