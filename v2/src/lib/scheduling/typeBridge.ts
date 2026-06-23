import { Task, Dependency, DependencyType } from "./types";
import { GanttTask, GanttDependency } from "@/components/gantt/types";

/** Minutes in a standard work day (8 hours × 60 minutes). */
const MINUTES_PER_DAY = 8 * 60;

/**
 * Converts a scheduling {@link Task} to a rendering {@link GanttTask}.
 *
 * - Duration is converted from minutes to days.
 * - CPM scheduling fields (early/late start/finish, totalFloat) are preserved.
 * - Progress defaults to 0 (set from PercentComplete elsewhere).
 * - Dependencies are filtered to only those involving this task (as predecessor
 *   or successor).
 *
 * @param task - The scheduling Task to convert.
 * @param deps - All scheduling Dependencies in the project.
 * @returns A rendering GanttTask.
 */
export function taskToGanttTask(task: Task, deps: Dependency[]): GanttTask {
  const durationDays = task.durationMinutes / MINUTES_PER_DAY;
  const start = task.earlyStart ?? task.manualStart ?? new Date();
  const finish =
    task.earlyFinish ??
    new Date(start.getTime() + durationDays * MINUTES_PER_DAY * 60 * 1000);

  const taskDeps = deps.filter(
    (d) => d.predecessorId === task.id || d.successorId === task.id,
  );

  return {
    id: task.id,
    name: task.name,
    start,
    finish,
    duration: durationDays,
    progress: 0,
    isCritical: task.isCritical,
    isMilestone: task.isMilestone,
    isSummary: task.isSummary,
    outlineLevel: task.outlineLevel,
    dependencies: taskDeps.map(depToGanttDep),
    earlyStart: task.earlyStart,
    lateStart: task.lateStart,
    earlyFinish: task.earlyFinish,
    lateFinish: task.lateFinish,
    totalFloat: task.totalFloat,
  };
}

/**
 * Converts a rendering {@link GanttTask} to a scheduling {@link Task}.
 *
 * - Duration is converted from days to minutes.
 * - Optional CPM fields on GanttTask override the basic start/finish when present.
 * - `manualStart` is not set (not representable in GanttTask).
 *
 * @param gantt - The rendering GanttTask to convert.
 * @returns A scheduling Task.
 */
export function ganttTaskToTask(gantt: GanttTask): Task {
  return {
    id: gantt.id,
    name: gantt.name,
    durationMinutes: gantt.duration * MINUTES_PER_DAY,
    earlyStart: gantt.earlyStart ?? gantt.start,
    earlyFinish: gantt.earlyFinish ?? gantt.finish,
    lateStart: gantt.lateStart,
    lateFinish: gantt.lateFinish,
    totalFloat: gantt.totalFloat ?? 0,
    isCritical: gantt.isCritical,
    isMilestone: gantt.isMilestone,
    isSummary: gantt.isSummary,
    outlineLevel: gantt.outlineLevel,
  };
}

/**
 * Converts a scheduling {@link Dependency} to a rendering {@link GanttDependency}.
 *
 * - Lag is converted from minutes to days.
 * - `isPercentage` is not representable in GanttDependency and is discarded.
 *
 * @param dep - The scheduling Dependency to convert.
 * @returns A rendering GanttDependency.
 */
export function depToGanttDep(dep: Dependency): GanttDependency {
  return {
    from: dep.predecessorId,
    to: dep.successorId,
    type: dep.type as GanttDependency["type"],
    lag: dep.lag / MINUTES_PER_DAY,
  };
}

/**
 * Converts a rendering {@link GanttDependency} to a scheduling {@link Dependency}.
 *
 * - Lag is converted from days to minutes.
 * - `isPercentage` defaults to false (not representable in GanttDependency).
 *
 * @param gantt - The rendering GanttDependency to convert.
 * @returns A scheduling Dependency.
 */
export function ganttDepToDep(gantt: GanttDependency): Dependency {
  return {
    predecessorId: gantt.from,
    successorId: gantt.to,
    type: gantt.type as DependencyType,
    lag: (gantt.lag ?? 0) * MINUTES_PER_DAY,
    isPercentage: false,
  };
}
