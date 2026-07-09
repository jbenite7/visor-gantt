import type { GanttTask } from "@/components/gantt/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNIT_PATTERNS = [
  /(?:nivel|piso|planta|torre|apartamento|apto|unidad)\s*[-#:]?\s*([a-z0-9]+)/i,
  /(?:n|p)\s*[-#:]?\s*(\d+)/i,
];

export interface TypicalUnitActivity {
  taskId: string | number;
  name: string;
  level: string;
  system: string;
  durationDays: number;
  productivity: number;
  start: Date;
  finish: Date;
}

export interface TypicalUnitGroup {
  system: string;
  levelCount: number;
  taskCount: number;
  averageDurationDays: number;
  averageProductivity: number;
  activities: TypicalUnitActivity[];
}

export interface TypicalUnitAnalysis {
  groups: TypicalUnitGroup[];
  insufficientReason?: string;
}

function durationDays(task: GanttTask): number {
  const start = new Date(task.start);
  const finish = new Date(task.finish);
  start.setHours(0, 0, 0, 0);
  finish.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((finish.getTime() - start.getTime()) / MS_PER_DAY) + 1);
}

function extractLevel(task: GanttTask): string | null {
  const source = `${task.wbs ?? ""} ${task.name}`;
  for (const pattern of UNIT_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  const parts = task.wbs?.split(".");
  if (parts && parts.length >= 3) return parts[parts.length - 2];
  return null;
}

function systemName(task: GanttTask): string {
  return task.name
    .replace(/\b(?:nivel|piso|planta|torre|apartamento|apto|unidad)\s*[-#:]?\s*[a-z0-9]+\b/gi, "")
    .replace(/\b(?:n|p)\s*[-#:]?\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toLowerCase() || "actividad";
}

export function analyzeTypicalUnits(tasks: GanttTask[]): TypicalUnitAnalysis {
  const activities = tasks
    .filter((task) => !task.isSummary && !task.isMilestone)
    .map((task): TypicalUnitActivity | null => {
      const level = extractLevel(task);
      if (!level) return null;
      const days = durationDays(task);
      return {
        taskId: task.id,
        name: task.name,
        level,
        system: systemName(task),
        durationDays: days,
        productivity: 1 / days,
        start: task.start,
        finish: task.finish,
      };
    })
    .filter((activity): activity is TypicalUnitActivity => activity !== null);

  const bySystem = new Map<string, TypicalUnitActivity[]>();
  for (const activity of activities) {
    const list = bySystem.get(activity.system) ?? [];
    list.push(activity);
    bySystem.set(activity.system, list);
  }

  const groups = [...bySystem.entries()]
    .map(([system, items]) => {
      const levels = new Set(items.map((item) => item.level));
      const totalDuration = items.reduce((sum, item) => sum + item.durationDays, 0);
      const totalProductivity = items.reduce((sum, item) => sum + item.productivity, 0);
      return {
        system,
        levelCount: levels.size,
        taskCount: items.length,
        averageDurationDays: totalDuration / items.length,
        averageProductivity: totalProductivity / items.length,
        activities: items.sort((a, b) => a.level.localeCompare(b.level, "es", { numeric: true })),
      };
    })
    .filter((group) => group.levelCount >= 3)
    .sort((a, b) => b.levelCount - a.levelCount || b.taskCount - a.taskCount);

  return {
    groups,
    insufficientReason:
      groups.length === 0
        ? "No se detectaron sistemas repetidos en tres o mas niveles con WBS o nombres reconocibles."
        : undefined,
  };
}
