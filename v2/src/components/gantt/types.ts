export interface GanttTask {
  id: string | number;
  name: string;
  start: Date;
  finish: Date;
  duration: number; // days
  progress: number; // 0-100
  isCritical: boolean;
  isMilestone: boolean;
  isSummary: boolean;
  outlineLevel: number;
  dependencies: GanttDependency[];

  // ── Baseline / Schedule Variance ──
  /** Planned start from the approved baseline. */
  baselineStart?: Date;
  /** Planned finish from the approved baseline. */
  baselineFinish?: Date;
  /** Planned duration from the approved baseline (days). */
  baselineDuration?: number;

  // ── CPM Scheduling (forward/backward pass) ──
  /** Earliest possible start date. */
  earlyStart?: Date;
  /** Latest possible start date without delaying the project. */
  lateStart?: Date;
  /** Earliest possible finish date. */
  earlyFinish?: Date;
  /** Latest possible finish date without delaying the project. */
  lateFinish?: Date;
  /** Total float / slack (days). Zero for critical tasks. */
  totalFloat?: number;

  // ── Progress (MS Project naming alias) ──
  /** Percentage complete, 0–100. Alias for progress. */
  percentComplete?: number;

  // ── WBS / Outline ──
  /** Work Breakdown Structure code (e.g. "1.2.3"). */
  wbs?: string;

  // ── Resources ──
  /** Display names of assigned resources. */
  resourceNames?: string[];

  // ── Cost ──
  /** Total planned cost for the task. */
  cost?: number;
  /** Actual cost incurred so far. */
  actualCost?: number;
}

export interface GanttDependency {
  from: string | number;
  to: string | number;
  type: "FS" | "SS" | "FF" | "SF";
  lag?: number;
}

export interface GanttViewport {
  startDate: Date;
  endDate: Date;
  scale: "day" | "week" | "month";
  columnWidth: number; // pixels per day/week/month
}

export interface GanttConfig {
  rowHeight: number;
  headerHeight: number;
  todayLineColor: string;
  criticalColor: string;
  normalColor: string;
  summaryColor: string;
  milestoneColor: string;
}
