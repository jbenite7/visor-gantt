import { MSPTask, MSPPredecessorLink } from "@/lib/parser/mpp-parser";
import { GanttTask, GanttDependency } from "@/components/gantt/types";

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
 */
function parseLagToDays(linkLag: number, lagFormat: number): number {
  switch (lagFormat) {
    case 7: // days
      return linkLag / 1000; // MPP stores as 10ths of minutes? Actually format varies
    case 8: // hours
      return linkLag / (8 * 100);
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
 */
export function mppTasksToGanttTasks(tasks: MSPTask[]): GanttTask[] {
  return tasks
    .filter((t) => t.UID !== 0 || t.Name) // Skip root empty task
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
        isCritical: false, // Will be calculated by CPM if needed
        isMilestone: task.Milestone,
        isSummary: task.Summary,
        outlineLevel: task.OutlineLevel || 1,
        dependencies,
      };
    });
}
