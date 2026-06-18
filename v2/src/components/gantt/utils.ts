import { GanttTask, GanttViewport } from "./types";

/**
 * Calculate X position for a date within the viewport
 */
export function getDatePosition(date: Date, viewport: GanttViewport): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceStart = Math.floor(
    (date.getTime() - viewport.startDate.getTime()) / msPerDay,
  );

  // Calculate position based on scale
  if (viewport.scale === "day") {
    return daysSinceStart * viewport.columnWidth;
  } else if (viewport.scale === "week") {
    return (daysSinceStart / 7) * viewport.columnWidth;
  } else {
    // month
    return (daysSinceStart / 30) * viewport.columnWidth;
  }
}

/**
 * Calculate width of a task bar based on duration
 */
export function getTaskWidth(
  start: Date,
  finish: Date,
  viewport: GanttViewport,
): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const durationMs = finish.getTime() - start.getTime();
  const durationDays = Math.ceil(durationMs / msPerDay);

  // Calculate pixel width based on scale
  let pixelWidth: number;

  if (viewport.scale === "day") {
    pixelWidth = durationDays * viewport.columnWidth;
  } else if (viewport.scale === "week") {
    pixelWidth = (durationDays / 7) * viewport.columnWidth;
  } else {
    // month
    pixelWidth = (durationDays / 30) * viewport.columnWidth;
  }

  return Math.max(pixelWidth, 4); // Minimum 4px visible
}

/**
 * Generate timeline columns (dates) for the viewport
 */
export function generateTimelineColumns(viewport: GanttViewport): Date[] {
  const columns: Date[] = [];
  const current = new Date(viewport.startDate);

  while (current <= viewport.endDate) {
    columns.push(new Date(current));

    if (viewport.scale === "day") {
      current.setDate(current.getDate() + 1);
    } else if (viewport.scale === "week") {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return columns;
}

/**
 * Format date for timeline header
 */
export function formatTimelineDate(
  date: Date,
  scale: "day" | "week" | "month",
): string {
  if (scale === "day") {
    return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  } else if (scale === "week") {
    return `S${getWeekNumber(date)}`;
  } else {
    return date.toLocaleDateString("es-CO", {
      month: "short",
      year: "2-digit",
    });
  }
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Auto-calculate viewport dates from tasks
 */
export function calculateViewport(
  tasks: GanttTask[],
  scale: "day" | "week" | "month" = "day",
): GanttViewport {
  if (tasks.length === 0) {
    const today = new Date();
    return {
      startDate: today,
      endDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
      scale,
      columnWidth: 40,
    };
  }

  let minDate = new Date(tasks[0].start);
  let maxDate = new Date(tasks[0].finish);

  tasks.forEach((task) => {
    if (task.start < minDate) minDate = new Date(task.start);
    if (task.finish > maxDate) maxDate = new Date(task.finish);
  });

  // Add padding
  const padding = 7; // days
  minDate.setDate(minDate.getDate() - padding);
  maxDate.setDate(maxDate.getDate() + padding);

  return {
    startDate: minDate,
    endDate: maxDate,
    scale,
    columnWidth: scale === "day" ? 40 : scale === "week" ? 60 : 80,
  };
}
