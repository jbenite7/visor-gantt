import { GanttTask, GanttViewport } from "./types";
import type { DependencyType } from "./arrows/ArrowPath";
import { formatProjectDate } from "@/lib/date/projectDate";
import { GANTT_MILESTONE_SIZE } from "./layout";

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
  const startDay = new Date(start);
  const finishDay = new Date(finish);
  startDay.setHours(0, 0, 0, 0);
  finishDay.setHours(0, 0, 0, 0);
  const durationMs = finishDay.getTime() - startDay.getTime();
  const durationDays = Math.floor(durationMs / msPerDay) + 1;

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
    return formatProjectDate(date, { day: "2-digit", month: "short" });
  } else if (scale === "week") {
    return `S${getWeekNumber(date)}`;
  } else {
    return formatProjectDate(date, {
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
 * Group consecutive columns by month.
 * Returns labels like "ene 2026", "feb 2026" with column span info.
 */
export function generateMonthGroups(
  columns: Date[],
): { label: string; startCol: number; colCount: number }[] {
  const groups: { label: string; startCol: number; colCount: number }[] = [];
  if (columns.length === 0) return groups;

  let currentLabel = formatMonthLabel(columns[0]);
  let startCol = 0;

  for (let i = 1; i < columns.length; i++) {
    const label = formatMonthLabel(columns[i]);
    if (label !== currentLabel) {
      groups.push({
        label: currentLabel,
        startCol,
        colCount: i - startCol,
      });
      currentLabel = label;
      startCol = i;
    }
  }

  groups.push({
    label: currentLabel,
    startCol,
    colCount: columns.length - startCol,
  });

  return groups;
}

/**
 * Group consecutive columns by ISO week number.
 * Returns labels like "S1", "S2" with column span info.
 * Handles week transitions when the week number wraps (e.g. 52 → 1).
 */
export function generateWeekGroups(
  columns: Date[],
): { label: string; startCol: number; colCount: number }[] {
  const groups: { label: string; startCol: number; colCount: number }[] = [];
  if (columns.length === 0) return groups;

  let currentWeek = getWeekNumber(columns[0]);
  let currentYear = columns[0].getFullYear();
  let startCol = 0;

  for (let i = 1; i < columns.length; i++) {
    const week = getWeekNumber(columns[i]);
    const year = columns[i].getFullYear();
    if (week !== currentWeek || year !== currentYear) {
      groups.push({
        label: `S${currentWeek}`,
        startCol,
        colCount: i - startCol,
      });
      currentWeek = week;
      currentYear = year;
      startCol = i;
    }
  }

  groups.push({
    label: `S${currentWeek}`,
    startCol,
    colCount: columns.length - startCol,
  });

  return groups;
}

/**
 * Check if a date is a weekend (Sunday).
 * Project week = Mon–Sat; only Sunday is non-working.
 */
export function isWeekend(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Check if a date is today (year/month/day comparison only).
 */
export function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/**
 * Format month label: "ene 2026", "feb 2026" (Spanish, short month + year)
 */
function formatMonthLabel(date: Date): string {
  return formatProjectDate(date, {
    month: "short",
    year: "numeric",
  });
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

/**
 * Calculate the pixel position and dimensions of a task bar within the chart.
 *
 * @param task      The Gantt task
 * @param viewport  Current viewport (dates + scale + columnWidth)
 * @param rowIndex  Zero-based row index of this task in the chart
 * @param rowHeight Row height in pixels (default 40)
 */
export function getTaskBarPosition(
  task: GanttTask,
  viewport: GanttViewport,
  rowIndex: number,
  rowHeight: number,
): { x: number; y: number; width: number } {
  const x = getDatePosition(task.start, viewport);
  const y = rowIndex * rowHeight;
  const width = task.isMilestone
    ? GANTT_MILESTONE_SIZE * 2
    : getTaskWidth(task.start, task.finish, viewport);
  return { x, y, width };
}

/**
 * Calculate the start/end pixel coordinates for a dependency arrow.
 *
 * The y coordinate is always the vertical center of the row.
 * The x coordinate depends on dependency type:
 *   FS → from = predecessor finish, to = successor start
 *   SS → from = predecessor start,  to = successor start
 *   FF → from = predecessor finish, to = successor finish
 *   SF → from = predecessor start,  to = successor finish
 *
 * @param pred         Predecessor task
 * @param succ         Successor task
 * @param viewport     Current viewport
 * @param predRowIndex Row index of the predecessor in the chart
 * @param succRowIndex Row index of the successor in the chart
 * @param rowHeight    Row height in pixels
 * @param type         Dependency type
 */
export function getDependencyEndpoints(
  pred: GanttTask,
  succ: GanttTask,
  viewport: GanttViewport,
  predRowIndex: number,
  succRowIndex: number,
  rowHeight: number,
  type: DependencyType,
): { fromX: number; fromY: number; toX: number; toY: number } {
  const predBar = getTaskBarPosition(pred, viewport, predRowIndex, rowHeight);
  const succBar = getTaskBarPosition(succ, viewport, succRowIndex, rowHeight);

  const fromY = predRowIndex * rowHeight + rowHeight / 2;
  const toY = succRowIndex * rowHeight + rowHeight / 2;

  let fromX: number;
  let toX: number;

  switch (type) {
    case "FS":
      // Finish → Start
      fromX = predBar.x + predBar.width;
      toX = succBar.x;
      break;
    case "SS":
      // Start → Start
      fromX = predBar.x;
      toX = succBar.x;
      break;
    case "FF":
      // Finish → Finish
      fromX = predBar.x + predBar.width;
      toX = succBar.x + succBar.width;
      break;
    case "SF":
      // Start → Finish
      fromX = predBar.x;
      toX = succBar.x + succBar.width;
      break;
  }

  return { fromX, fromY, toX, toY };
}
