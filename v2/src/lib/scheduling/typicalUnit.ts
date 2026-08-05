import type { GanttTask } from "@/components/gantt/types";
import { classifyActivityFamily, type ActivityFamilyResult } from "./activityFamily";
import { extractUnitLabel, buildWbsBreadcrumb, UNIT_PATTERNS } from "./unitPatterns";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  family: ActivityFamilyResult;
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
  const match = extractUnitLabel(source);
  if (match) return match.value;
  const parts = task.wbs?.split(".");
  if (parts && parts.length >= 3) return parts[parts.length - 2];
  return null;
}

function systemName(task: GanttTask): string {
  let stripped = task.name;
  for (const pattern of UNIT_PATTERNS) {
    stripped = stripped.replace(new RegExp(pattern.regex.source, "gi"), "");
  }
  return (
    stripped
      .replace(/\s{2,}/g, " ")
      .trim()
      .toLowerCase() || "actividad"
  );
}

export function analyzeTypicalUnits(tasks: GanttTask[]): TypicalUnitAnalysis {
  const taskById = new Map<string | number, GanttTask>();
  for (const task of tasks) {
    taskById.set(task.id, task);
  }

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
      const representativeTask = taskById.get(items[0].taskId);
      const family = classifyActivityFamily(
        representativeTask ?? {
          id: items[0].taskId,
          name: items[0].name,
          start: items[0].start,
          finish: items[0].finish,
          duration: items[0].durationDays,
          progress: 0,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
        },
        representativeTask
          ? { breadcrumb: buildWbsBreadcrumb(representativeTask.wbs, tasks) }
          : undefined,
      );
      return {
        system,
        levelCount: levels.size,
        taskCount: items.length,
        averageDurationDays: totalDuration / items.length,
        averageProductivity: totalProductivity / items.length,
        activities: items.sort((a, b) => a.level.localeCompare(b.level, "es", { numeric: true })),
        family,
      };
    })
    .filter((group) => group.levelCount >= 3)
    .sort((a, b) => b.levelCount - a.levelCount || b.taskCount - a.taskCount);

  return {
    groups,
    insufficientReason:
      groups.length === 0
        ? "No se detectaron sistemas repetidos. Esta vista compara la misma " +
          "actividad cuando se repite en tres o más pisos o niveles — por " +
          "ejemplo «Mampostería piso 1», «Mampostería piso 2», «Mampostería " +
          "piso 3» — para ver si el ritmo se mantiene. Nombra las tareas " +
          "incluyendo su piso o nivel y aparecerán aquí."
        : undefined,
  };
}
