/**
 * Baseline save/restore/compare logic.
 *
 * A baseline captures a snapshot of task dates and costs at a point in time,
 * used to track schedule and budget variance during execution.
 * MS Project allows up to 11 baselines — this module does not enforce a limit.
 */

import { Baseline, BaselineTask } from "@/types/baseline";
import { GanttTask } from "@/components/gantt/types";

export interface BaselineVariance {
  taskId: string | number;
  taskName: string;
  /** Days: positive = delayed, negative = ahead. */
  startVariance: number;
  /** Days: positive = delayed, negative = ahead. */
  finishVariance: number;
  /** Days: positive = longer, negative = shorter. */
  durationVariance: number;
  /** true when finishVariance < 0. */
  isAhead: boolean;
  /** true when finishVariance > 0. */
  isBehind: boolean;
  /** true when finishVariance === 0. */
  isOnSchedule: boolean;
}

/**
 * Creates a Baseline snapshot from current task state.
 * Does NOT modify the input tasks array.
 */
export function saveBaseline(tasks: GanttTask[], name: string): Baseline {
  const baselineTasks: BaselineTask[] = tasks.map((task) => ({
    taskId: task.id,
    baselineStart: task.start,
    baselineFinish: task.finish,
    baselineDuration: task.duration,
    ...(task.cost !== undefined ? { baselineCost: task.cost } : {}),
  }));

  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date(),
    tasks: baselineTasks,
  };
}

/**
 * Returns a NEW array of GanttTask with baseline fields populated
 * from the baseline snapshot. Tasks without a matching baseline entry
 * are returned unchanged.
 * Does NOT modify the input array.
 */
export function applyBaselineToTasks(
  tasks: GanttTask[],
  baseline: Baseline,
): GanttTask[] {
  const baselineMap = new Map<string | number, BaselineTask>();
  for (const bt of baseline.tasks) {
    baselineMap.set(bt.taskId, bt);
  }

  return tasks.map((task) => {
    const bt = baselineMap.get(task.id);
    if (!bt) {
      return { ...task };
    }
    return {
      ...task,
      baselineStart: bt.baselineStart,
      baselineFinish: bt.baselineFinish,
      baselineDuration: bt.baselineDuration,
    };
  });
}

/**
 * Returns variance data for each task that has a matching baseline entry.
 * Variance is calculated in calendar days.
 */
export function compareWithBaseline(
  tasks: GanttTask[],
  baseline: Baseline,
): BaselineVariance[] {
  const baselineMap = new Map<string | number, BaselineTask>();
  for (const bt of baseline.tasks) {
    baselineMap.set(bt.taskId, bt);
  }

  const variances: BaselineVariance[] = [];

  for (const task of tasks) {
    const bt = baselineMap.get(task.id);
    if (!bt) {
      continue;
    }

    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const startVariance = Math.round(
      (task.start.getTime() - bt.baselineStart.getTime()) / MS_PER_DAY,
    );
    const finishVariance = Math.round(
      (task.finish.getTime() - bt.baselineFinish.getTime()) / MS_PER_DAY,
    );
    const durationVariance = Math.round(task.duration - bt.baselineDuration);

    variances.push({
      taskId: task.id,
      taskName: task.name,
      startVariance,
      finishVariance,
      durationVariance,
      isAhead: finishVariance < 0,
      isBehind: finishVariance > 0,
      isOnSchedule: finishVariance === 0,
    });
  }

  return variances;
}

/**
 * Returns summary statistics for a baseline.
 */
export function getBaselineSummary(baseline: Baseline): {
  taskCount: number;
  totalDuration: number;
  startDate: Date;
  finishDate: Date;
} {
  const taskCount = baseline.tasks.length;
  const totalDuration = baseline.tasks.reduce(
    (sum, t) => sum + t.baselineDuration,
    0,
  );

  let startDate: Date;
  let finishDate: Date;

  if (taskCount === 0) {
    startDate = new Date();
    finishDate = new Date();
  } else {
    startDate = baseline.tasks[0].baselineStart;
    finishDate = baseline.tasks[0].baselineFinish;

    for (let i = 1; i < baseline.tasks.length; i++) {
      const t = baseline.tasks[i];
      if (t.baselineStart < startDate) {
        startDate = t.baselineStart;
      }
      if (t.baselineFinish > finishDate) {
        finishDate = t.baselineFinish;
      }
    }
  }

  return {
    taskCount,
    totalDuration,
    startDate,
    finishDate,
  };
}
