import { GanttTask } from "@/components/gantt/types";
import { BudgetItem, BudgetMapping } from "@/types/budget";

// ── Public Types ──

export interface SCurvePoint {
  date: Date;
  cumulativeValue: number;
}

export interface SCurveData {
  points: SCurvePoint[];
  maxValue: number;
}

export interface EarnedValuePoint {
  date: Date;
  pv: number;
  ev: number;
  ac: number;
}

export interface EarnedValueData {
  points: EarnedValuePoint[];
  cpi: number;
  spi: number;
}

// ── Internal Helpers ──

/** Return the effective start date, using earlyStart when available. */
function taskStart(task: GanttTask): Date {
  return task.earlyStart ?? task.start;
}

/** Return the effective finish date, using earlyFinish when available. */
function taskFinish(task: GanttTask): Date {
  return task.earlyFinish ?? task.finish;
}

/** Return a safe duration (minimum 1 to avoid division by zero). */
function safeDuration(task: GanttTask): number {
  return Math.max(task.duration, 1);
}

/** Build a Map<taskId, totalBudgetedAmount> from budget mappings. */
function buildBudgetMap(
  mappings: BudgetMapping[]
): Map<string | number, number> {
  const map = new Map<string | number, number>();
  for (const m of mappings) {
    map.set(m.taskId, (map.get(m.taskId) ?? 0) + m.amount);
  }
  return map;
}

/** Normalise a Date to midnight (local tz) so comparisons are date-only. */
function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Earliest start date across all tasks (date-only). */
function projectStart(tasks: GanttTask[]): Date {
  let min = taskStart(tasks[0]);
  for (let i = 1; i < tasks.length; i++) {
    const d = taskStart(tasks[i]);
    if (d < min) min = d;
  }
  return dateOnly(min);
}

/** Latest finish date across all tasks (date-only). */
function projectFinish(tasks: GanttTask[]): Date {
  let max = taskFinish(tasks[0]);
  for (let i = 1; i < tasks.length; i++) {
    const d = taskFinish(tasks[i]);
    if (d > max) max = d;
  }
  return dateOnly(max);
}

/** Generator yielding each calendar day from `start` to `finish` inclusive. */
function* eachDay(start: Date, finish: Date): Generator<Date> {
  const current = new Date(start);
  while (current <= finish) {
    yield new Date(current);
    current.setDate(current.getDate() + 1);
  }
}

/** Number of calendar days between two dates (rounded to handle DST shifts). */
function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Fraction of a task's earned value or actual cost achieved by a given day,
 * capped by the task's reported progress.
 *
 * Progress is assumed to be earned linearly over the task's duration.
 */
function earnedFraction(task: GanttTask, day: Date): number {
  const start = taskStart(task);
  if (day < start) return 0;

  const dur = safeDuration(task);
  const elapsed = dayDiff(start, day) + 1; // inclusive of start day
  return Math.min(elapsed / dur, task.progress / 100);
}

// ── Exported Helpers ──

/**
 * Return the total budgeted cost assigned to a task via budget mappings.
 *
 * @param taskId  – The task identifier.
 * @param mappings – Budget mappings.
 * @param _items   – Budget items (unused, accepted for API consistency).
 */
export function getTaskBudgetedCost(
  taskId: string | number,
  mappings: BudgetMapping[],
  _items: BudgetItem[]
): number {
  return mappings
    .filter((m) => m.taskId === taskId)
    .reduce((sum, m) => sum + m.amount, 0);
}

/**
 * Return the total actual cost incurred for a task.
 *
 * Distributes each budget item's spentAmount across the tasks it is mapped to
 * in proportion to the mapped amounts (mapping.amount / item.budgetedAmount).
 */
export function getTaskActualCost(
  taskId: string | number,
  mappings: BudgetMapping[],
  items: BudgetItem[]
): number {
  const itemMap = new Map<string, BudgetItem>();
  for (const item of items) itemMap.set(item.id, item);

  let total = 0;
  for (const m of mappings) {
    if (m.taskId !== taskId) continue;
    const item = itemMap.get(m.budgetItemId);
    if (item && item.budgetedAmount > 0) {
      total += item.spentAmount * (m.amount / item.budgetedAmount);
    }
  }
  return total;
}

// ── Public API ──

/**
 * Compute the **Schedule S-Curve** — cumulative planned progress over time.
 *
 * Each task's contribution is spread evenly across its duration. The final
 * cumulative value is always 100 % when all tasks have completed.
 *
 * @param tasks – Array of Gantt tasks.
 * @returns SCurveData with percentage values (0–100).
 */
export function computeScheduleSCurve(tasks: GanttTask[]): SCurveData {
  if (tasks.length === 0) return { points: [], maxValue: 0 };

  const start = projectStart(tasks);
  const finish = projectFinish(tasks);

  // Total planned work in days
  let totalWork = 0;
  for (const t of tasks) totalWork += t.duration;
  if (totalWork <= 0) return { points: [], maxValue: 0 };

  const points: SCurvePoint[] = [];

  for (const day of eachDay(start, finish)) {
    let done = 0;
    for (const t of tasks) {
      if (day < taskStart(t)) continue;
      const dur = safeDuration(t);
      const elapsed = dayDiff(taskStart(t), day) + 1;
      done += Math.min(elapsed, dur);
    }
    points.push({
      date: day,
      cumulativeValue: totalWork > 0 ? (done / totalWork) * 100 : 0,
    });
  }

  return { points, maxValue: 100 };
}

/**
 * Compute the **Budget S-Curve** — cumulative planned cost over time.
 *
 * Each task's budgeted amount (from BudgetMapping) is distributed evenly
 * across its duration. Returns the cumulative cost at each date.
 *
 * @param tasks          – Array of Gantt tasks.
 * @param budgetMappings – Array of budget-to-task mappings.
 * @param budgetItems    – Array of budget items (used for pre-computation).
 * @returns SCurveData with monetary cumulative values.
 */
export function computeBudgetSCurve(
  tasks: GanttTask[],
  budgetMappings: BudgetMapping[],
  budgetItems: BudgetItem[]
): SCurveData {
  if (tasks.length === 0 || budgetMappings.length === 0) {
    return { points: [], maxValue: 0 };
  }

  const start = projectStart(tasks);
  const finish = projectFinish(tasks);
  const budgetMap = buildBudgetMap(budgetMappings);

  const points: SCurvePoint[] = [];
  let maxValue = 0;

  for (const day of eachDay(start, finish)) {
    let cumulative = 0;
    for (const t of tasks) {
      const b = budgetMap.get(t.id);
      if (!b || b === 0) continue;
      if (day < taskStart(t)) continue;
      const dur = safeDuration(t);
      const elapsed = dayDiff(taskStart(t), day) + 1;
      cumulative += b * Math.min(elapsed / dur, 1);
    }
    if (cumulative > maxValue) maxValue = cumulative;
    points.push({ date: day, cumulativeValue: cumulative });
  }

  return { points, maxValue };
}

/**
 * Compute the **Earned Value S-Curve** — PV, EV and AC over time, plus
 * final CPI and SPI values.
 *
 * | Metric | Meaning                        | Formula                        |
 * |--------|--------------------------------|--------------------------------|
 * | PV     | Planned Value                  | Budgeted cost of work scheduled |
 * | EV     | Earned Value                   | Budgeted cost of work performed |
 * | AC     | Actual Cost                    | Actual cost of work performed   |
 * | CPI    | Cost Performance Index         | EV / AC (>1 = under budget)    |
 * | SPI    | Schedule Performance Index     | EV / PV (>1 = ahead)           |
 *
 * @param tasks          – Array of Gantt tasks.
 * @param budgetMappings – Array of budget-to-task mappings.
 * @param budgetItems    – Array of budget items.
 * @returns EarnedValueData with per-date points and final CPI/SPI.
 */
export function computeEarnedValueSCurve(
  tasks: GanttTask[],
  budgetMappings: BudgetMapping[],
  budgetItems: BudgetItem[]
): EarnedValueData {
  if (tasks.length === 0 || budgetMappings.length === 0) {
    return { points: [], cpi: 1, spi: 1 };
  }

  const start = projectStart(tasks);
  const finish = projectFinish(tasks);
  const budgetMap = buildBudgetMap(budgetMappings);

  // Pre-compute per-task actual cost for O(1) lookup
  const actualMap = new Map<string | number, number>();
  for (const t of tasks) {
    actualMap.set(t.id, getTaskActualCost(t.id, budgetMappings, budgetItems));
  }

  const points: EarnedValuePoint[] = [];

  for (const day of eachDay(start, finish)) {
    let pv = 0;
    let ev = 0;
    let ac = 0;

    for (const t of tasks) {
      if (day < taskStart(t)) continue;

      const dur = safeDuration(t);
      const elapsed = dayDiff(taskStart(t), day) + 1;
      const progressCap = Math.min(elapsed / dur, 1);
      const budgeted = budgetMap.get(t.id) ?? 0;

      // ── Planned Value ──
      pv += budgeted * progressCap;

      // ── Earned Value ──
      const eFrac = earnedFraction(t, day);
      ev += budgeted * eFrac;

      // ── Actual Cost ──
      const actual = actualMap.get(t.id) ?? 0;
      if (actual > 0) {
        ac += actual * eFrac;
      } else {
        // Fallback: approximate AC with EV when no spent-amount data exists
        ac += budgeted * eFrac;
      }
    }

    points.push({ date: day, pv, ev, ac });
  }

  // CPI and SPI at the latest (final) data point
  const last = points[points.length - 1];
  const cpi = last.ac > 0 ? last.ev / last.ac : 1;
  const spi = last.pv > 0 ? last.ev / last.pv : 1;

  return { points, cpi, spi };
}
