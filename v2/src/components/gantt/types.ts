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
