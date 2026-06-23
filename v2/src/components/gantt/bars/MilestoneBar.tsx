import { GanttTask } from "../types";
import { GANTT_MILESTONE_SIZE } from "../layout";

interface MilestoneBarProps {
  task: GanttTask;
  x: number;
  y: number;
  height: number;
  color: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export default function MilestoneBar({
  task,
  x,
  y,
  height,
  color,
  onClick,
  isSelected,
}: MilestoneBarProps) {
  const cx = x + GANTT_MILESTONE_SIZE;
  const cy = y + height / 2;
  const points = [
    `${cx},${cy - GANTT_MILESTONE_SIZE}`,
    `${cx + GANTT_MILESTONE_SIZE},${cy}`,
    `${cx},${cy + GANTT_MILESTONE_SIZE}`,
    `${cx - GANTT_MILESTONE_SIZE},${cy}`,
  ].join(" ");

  return (
    <polygon
      className="gantt-milestone-bar cursor-pointer"
      points={points}
      fill={color}
      stroke={isSelected ? "var(--aia-proj-main)" : "white"}
      strokeWidth={isSelected ? 2 : 1}
      onClick={onClick}
      data-testid="milestone-bar"
      data-task-id={task.id}
    />
  );
}
