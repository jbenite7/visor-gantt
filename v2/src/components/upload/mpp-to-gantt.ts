import { MSPTask, MSPPredecessorLink } from "@/lib/parser/mpp-parser";
import { GanttTask, GanttDependency } from "@/components/gantt/types";
import { Task } from "@/lib/scheduling/types";

/**
 * Converts an ISO 8601 duration string (e.g. "PT8H0M0S", "P5D") to days.
 */
function parseDurationToDays(duration: string): number {
  if (!duration) return 0;

  // PT8H0M0S format
  if (duration.startsWith("PT")) {
    const hours = duration.match(/(\d+)H/);
    const minutes = duration.match(/(\d+)M/);
    const h = hours ? parseInt(hours[1]) : 0;
    const m = minutes ? parseInt(minutes[1]) : 0;
    return (h * 60 + m) / (8 * 60); // 8-hour workday
  }

  // P5D or P10H30M format
  const days = duration.match(/(\d+)D/);
  if (days) return parseInt(days[1]);

  const hours = duration.match(/(\d+)H/);
  if (hours) return parseInt(hours[1]) / 8;

  // Fallback: try parsing as number
  const num = parseFloat(duration);
  return isNaN(num) ? 0 : num;
}

/**
 * Converts MPP dependency type integer to Gantt dependency type string.
 * MPP: 0=FF, 1=FS, 2=SF, 3=SS
 * Gantt: "FS" | "SS" | "FF" | "SF"
 */
function mapDependencyType(type: number): GanttDependency["type"] {
  switch (type) {
    case 0:
      return "FF";
    case 1:
      return "FS";
    case 2:
      return "SF";
    case 3:
      return "SS";
    default:
      return "FS";
  }
}

/**
 * Converts MPP predecessor link lag to days.
 * LagFormat: 7=days, 8=hours, etc.
 *
 * # Lag Conversion Note (MPP LinkLag)
 *
 * MS Project stores `LinkLag` in units dictated by `LagFormat`:
 * - 7 = days   → LinkLag is in 10-thousandths of a day (÷ 10000 = days)
 * - 8 = hours  → LinkLag is in thousandths of an hour  (÷ 1000 / 8 = days)
 * - 9 = minutes → LinkLag is in tenths of a minute     (÷ 10 / 60 / 8 = days)
 *
 * However, some MPP versions encode LinkLag differently (e.g. 10ths of minutes
 * regardless of LagFormat, or the value is already in the target unit × 10).
 * The current implementation uses a simplified ÷ 1000 factor, which is an
 * approximation. This needs verification against real .mpp files.
 *
 * @todo Verify LinkLag conversion with real .mpp data. Collect sample files
 *       with known lag values in each LagFormat to determine the correct divisor.
 *
 * @param linkLag - Raw lag value from the MPP PredecessorLink element.
 * @param lagFormat - LagFormat integer (7=days, 8=hours, 9=minutes).
 * @returns Lag in days.
 */
function parseLagToDays(linkLag: number, lagFormat: number): number {
  switch (lagFormat) {
    case 7: // days
      return linkLag / 1000; // Approximate — see lag conversion note
    case 8: // hours
      return linkLag / (8 * 100);
    case 9: // minutes
      return linkLag / (60 * 8 * 10);
    default:
      return linkLag / 1000;
  }
}

/**
 * Converts MSPTask array from MPP parser to GanttTask array for GanttChart.
 *
 * Handles:
 * - Date string → Date object conversion
 * - Duration parsing (ISO 8601 → days)
 * - Dependency type mapping
 * - Milestone/summary detection
 * - WBS code extraction
 * - Progress mapping (both `progress` and `percentComplete`)
 *
 * CPM fields are left with defaults (`isCritical: false`). Run
 * {@link mergeCPMResults} after CPM calculation to enrich these tasks.
 */
export function mppTasksToGanttTasks(tasks: MSPTask[]): GanttTask[] {
  return tasks
    .filter((t) => String(t.Name ?? "").trim().length > 0)
    .map((task) => {
      const start = new Date(task.Start || Date.now());
      const finish = new Date(task.Finish || Date.now());
      const duration = parseDurationToDays(task.Duration);

      // Map dependencies
      const dependencies: GanttDependency[] = (task.PredecessorLink || []).map(
        (pred: MSPPredecessorLink) => ({
          from: pred.PredecessorUID,
          to: task.UID,
          type: mapDependencyType(pred.Type),
          lag: parseLagToDays(pred.LinkLag, pred.LagFormat),
        }),
      );

      return {
        id: task.UID,
        name: task.Name,
        start,
        finish,
        duration,
        progress: task.PercentComplete || 0,
        percentComplete: task.PercentComplete || 0,
        isCritical: false, // Will be calculated by CPM if needed
        isMilestone: task.Milestone,
        isSummary: task.Summary,
        outlineLevel: task.OutlineLevel || 1,
        wbs: task.WBS || undefined,
        dependencies,
      };
    });
}

/**
 * Merges CPM calculation results (Task[]) into GanttTask[] by matching on `id`.
 *
 * For each GanttTask that has a corresponding CPM Task, the following CPM fields
 * are copied over: `isCritical`, `earlyStart`, `lateStart`, `earlyFinish`,
 * `lateFinish`, `totalFloat`.
 *
 * GanttTasks without a CPM match are returned unchanged (non-destructive).
 *
 * Usage (typical upload flow):
 * ```
 * const ganttTasks = mppTasksToGanttTasks(parsedTasks);
 * // ... run CPM calculator ...
 * const ganttTasksWithCPM = mergeCPMResults(ganttTasks, cpmResults);
 * ```
 *
 * @param ganttTasks - Initial GanttTask[] from `mppTasksToGanttTasks` or elsewhere.
 * @param cpmTasks   - CPM-calculated Task[] (from `CPMCalculatorService.calculate`).
 * @returns A new GanttTask[] with CPM fields merged (input arrays are NOT mutated).
 */
export function mergeCPMResults(
  ganttTasks: GanttTask[],
  cpmTasks: Task[],
): GanttTask[] {
  // Build a lookup map for O(1) access by task id
  const cpmMap = new Map<string | number, Task>();
  for (const cpmTask of cpmTasks) {
    cpmMap.set(cpmTask.id, cpmTask);
  }

  return ganttTasks.map((gantt) => {
    const cpm = cpmMap.get(gantt.id);
    if (!cpm) return gantt; // No CPM data for this task — return unchanged

    return {
      ...gantt,
      isCritical: cpm.isCritical,
      earlyStart: cpm.earlyStart,
      lateStart: cpm.lateStart,
      earlyFinish: cpm.earlyFinish,
      lateFinish: cpm.lateFinish,
      totalFloat: cpm.totalFloat,
    };
  });
}
