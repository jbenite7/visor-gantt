/**
 * Baseline types for MS Project schedule comparison.
 *
 * A baseline captures a snapshot of task dates and costs at a point in time,
 * used to track schedule and budget variance during execution.
 */

export interface BaselineTask {
  /** Reference to the task (UID or string key). */
  taskId: string | number;
  /** Original planned start date. */
  baselineStart: Date;
  /** Original planned finish date. */
  baselineFinish: Date;
  /** Original planned duration (in days). */
  baselineDuration: number;
  /** Original planned cost. */
  baselineCost?: number;
}

export interface Baseline {
  /** Unique identifier for this baseline. */
  id: string;
  /** Human-readable name (e.g. "Baseline 1", "Approved Budget"). */
  name: string;
  /** When this baseline was captured. */
  createdAt: Date;
  /** Tasks included in this baseline snapshot. */
  tasks: BaselineTask[];
}
