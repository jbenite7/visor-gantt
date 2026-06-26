import type { GanttTask } from "@/components/gantt/types";
import type { Assignment, Resource } from "@/types/resource";
import { detectOverallocation } from "./assignments";
import type { Bottleneck } from "./types";

const MINUTES_PER_DAY = 8 * 60;
const NEAR_CRITICAL_FLOAT_MINUTES = MINUTES_PER_DAY;

export interface DetectBottlenecksInput {
  tasks: GanttTask[];
  resources: Resource[];
  assignments: Assignment[];
}

export function detectBottlenecks({
  tasks,
  resources,
  assignments,
}: DetectBottlenecksInput): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];

  for (const task of tasks) {
    if (task.isSummary) continue;

    const floatMinutes = task.totalFloat ?? Number.POSITIVE_INFINITY;
    if (task.isCritical) {
      bottlenecks.push({
        kind: "critical",
        severity: "high",
        taskIds: [task.id],
        metric: "Holgura: 0d",
        message: `${task.name} esta en la ruta critica.`,
      });
      continue;
    }

    if (floatMinutes <= NEAR_CRITICAL_FLOAT_MINUTES) {
      bottlenecks.push({
        kind: "nearCritical",
        severity: "medium",
        taskIds: [task.id],
        metric: `Holgura: ${formatFloat(floatMinutes)}`,
        message: `${task.name} tiene holgura baja.`,
      });
    }

    if (floatMinutes <= NEAR_CRITICAL_FLOAT_MINUTES && task.dependencies.length >= 2) {
      bottlenecks.push({
        kind: "dependencyConvergence",
        severity: "high",
        taskIds: [task.id, ...task.dependencies.map((dep) => dep.from)],
        metric: `${task.dependencies.length} predecesoras`,
        message: `${task.name} concentra multiples predecesoras con poca holgura.`,
      });
    }
  }

  for (const overallocation of detectOverallocation(assignments, resources, tasks)) {
    bottlenecks.push({
      kind: "resourceOverallocation",
      severity: "high",
      taskIds: overallocation.assignedTasks.map((task) => task.taskId),
      resourceId: overallocation.resourceId,
      date: overallocation.date,
      metric: `${overallocation.totalUnits}% / ${overallocation.maxAvailability}%`,
      message: `${overallocation.resourceName} esta sobreasignado.`,
    });
  }

  return bottlenecks;
}

function formatFloat(minutes: number): string {
  const days = minutes / MINUTES_PER_DAY;
  return `${Number.isInteger(days) ? days : days.toFixed(1)}d`;
}
