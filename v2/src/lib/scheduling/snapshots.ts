import type { GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import type {
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SnapshotOrigin,
} from "@/types/snapshot";

export function createSnapshotFromTasks(
  tasks: GanttTask[],
  options: {
    projectId: string;
    name: string;
    origin: SnapshotOrigin;
    capturedAt: Date;
    id?: string;
  },
): ProjectSnapshot {
  return {
    id: options.id ?? crypto.randomUUID(),
    projectId: options.projectId,
    name: options.name,
    origin: options.origin,
    capturedAt: options.capturedAt,
    tasks: tasks.map((task) => ({
      taskId: task.id,
      name: task.name,
      start: task.start,
      finish: task.finish,
      duration: task.duration,
      progress: task.progress,
    })),
  };
}

/**
 * Cada línea base guardada ya es una foto del plan en una fecha. Se conserva
 * su `id` para que la misma foto no aparezca dos veces al fusionar fuentes.
 */
export function baselineToSnapshot(
  baseline: Baseline,
  projectId: string,
): ProjectSnapshot {
  return {
    id: baseline.id,
    projectId,
    name: baseline.name,
    origin: "baseline",
    capturedAt: baseline.createdAt,
    tasks: baseline.tasks.map((task) => ({
      taskId: task.taskId,
      start: task.baselineStart,
      finish: task.baselineFinish,
      duration: task.baselineDuration,
    })),
  };
}

export function summarizeSnapshot(
  snapshot: ProjectSnapshot,
): ProjectSnapshotSummary {
  return {
    id: snapshot.id,
    name: snapshot.name,
    origin: snapshot.origin,
    capturedAt: snapshot.capturedAt,
    taskCount: snapshot.tasks.length,
  };
}
