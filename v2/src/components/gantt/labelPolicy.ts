import type { GanttTask, GanttViewport } from "./types";

export type TaskLabelPlacement =
  | "inside"
  | "outside-right"
  | "hidden-with-tooltip"
  | "summary-chip"
  | "milestone-outside";

export interface TaskLabelResolution {
  placement: TaskLabelPlacement;
  estimatedWidth: number;
  fontSize: number;
}

const DEFAULT_FONT_SIZE = 12;
const OUTSIDE_LABEL_MIN_BAR_WIDTH = 16;
const CHARACTER_WIDTH_RATIO = 0.62;
const LABEL_HORIZONTAL_PADDING = 16;

export function estimateLabelWidth(
  label: string,
  fontSize = DEFAULT_FONT_SIZE,
): number {
  return (
    Math.ceil(label.length * fontSize * CHARACTER_WIDTH_RATIO) +
    LABEL_HORIZONTAL_PADDING
  );
}

export function resolveTaskLabelPlacement(
  task: GanttTask,
  barWidth: number,
  scale: GanttViewport["scale"],
): TaskLabelResolution {
  const fontSize = DEFAULT_FONT_SIZE;
  const estimatedWidth = estimateLabelWidth(task.name, fontSize);

  if (task.isSummary) {
    return { placement: "summary-chip", estimatedWidth, fontSize };
  }

  if (task.isMilestone) {
    return { placement: "milestone-outside", estimatedWidth, fontSize };
  }

  if (barWidth >= estimatedWidth + LABEL_HORIZONTAL_PADDING) {
    return { placement: "inside", estimatedWidth, fontSize };
  }

  if (barWidth >= OUTSIDE_LABEL_MIN_BAR_WIDTH || scale === "day") {
    return { placement: "outside-right", estimatedWidth, fontSize };
  }

  return { placement: "hidden-with-tooltip", estimatedWidth, fontSize };
}
