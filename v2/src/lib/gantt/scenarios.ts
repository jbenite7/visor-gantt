import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";
import { replacePredecessors, replaceSuccessors } from "./dependencyEditing";
import { normalizeTaskStructure } from "./taskStructure";
import {
  recalculateSchedule,
  type RecalculateScheduleOptions,
} from "@/lib/scheduling/scheduleEngine";
import type { ScheduleIssue } from "@/lib/scheduling/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ScenarioChange =
  | {
      type: "updateTask";
      taskId: string | number;
      patch: Partial<
        Pick<
          GanttTask,
          | "name"
          | "duration"
          | "progress"
          | "percentComplete"
          | "start"
          | "finish"
          | "manualStart"
          | "constraintType"
          | "constraintDate"
          | "deadline"
        >
      >;
    }
  | {
      type: "replacePredecessors";
      taskId: string | number;
      dependencies: Array<Omit<GanttDependency, "to"> & { to?: string | number }>;
    }
  | {
      type: "replaceSuccessors";
      taskId: string | number;
      dependencies: GanttDependency[];
    }
  | {
      type: "normalizeStructure";
    };

export interface WhatIfScenario {
  id: string;
  name: string;
  description?: string;
  changes: ScenarioChange[];
}

export interface ScenarioTaskImpact {
  taskId: string | number;
  name: string;
  startDeltaDays: number;
  finishDeltaDays: number;
  durationDeltaDays: number;
  criticalChanged: boolean;
}

export interface ScenarioComparisonSummary {
  changedTaskCount: number;
  projectFinishDeltaDays: number;
  criticalTaskDelta: number;
  durationDeltaDays: number;
}

export interface ScenarioComparison {
  scenario: WhatIfScenario;
  baseTasks: GanttTask[];
  scenarioTasks: GanttTask[];
  issues: ScheduleIssue[];
  summary: ScenarioComparisonSummary;
  taskImpacts: ScenarioTaskImpact[];
}

function dateDeltaDays(before?: Date, after?: Date): number {
  if (!before || !after) return 0;
  return Math.round((after.getTime() - before.getTime()) / MS_PER_DAY);
}

function maxFinish(tasks: GanttTask[]): Date | undefined {
  return tasks.reduce<Date | undefined>((latest, task) => {
    if (!latest || task.finish.getTime() > latest.getTime()) return task.finish;
    return latest;
  }, undefined);
}

function cloneTask(task: GanttTask): GanttTask {
  return {
    ...task,
    start: new Date(task.start),
    finish: new Date(task.finish),
    baselineStart: task.baselineStart ? new Date(task.baselineStart) : undefined,
    baselineFinish: task.baselineFinish ? new Date(task.baselineFinish) : undefined,
    earlyStart: task.earlyStart ? new Date(task.earlyStart) : undefined,
    earlyFinish: task.earlyFinish ? new Date(task.earlyFinish) : undefined,
    lateStart: task.lateStart ? new Date(task.lateStart) : undefined,
    lateFinish: task.lateFinish ? new Date(task.lateFinish) : undefined,
    manualStart: task.manualStart ? new Date(task.manualStart) : undefined,
    constraintDate: task.constraintDate ? new Date(task.constraintDate) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : undefined,
    dependencies: task.dependencies.map((dep) => ({ ...dep })),
    resourceNames: task.resourceNames ? [...task.resourceNames] : undefined,
    mppFields: task.mppFields ? { ...task.mppFields } : undefined,
    matrixSource: task.matrixSource ? { ...task.matrixSource } : undefined,
    matrixSync: task.matrixSync ? { ...task.matrixSync } : undefined,
  };
}

function applyTaskPatch(task: GanttTask, patch: ScenarioChange & { type: "updateTask" }): GanttTask {
  return {
    ...task,
    ...patch.patch,
    start: patch.patch.start ? new Date(patch.patch.start) : task.start,
    finish: patch.patch.finish ? new Date(patch.patch.finish) : task.finish,
    manualStart: patch.patch.manualStart ? new Date(patch.patch.manualStart) : task.manualStart,
    constraintDate: patch.patch.constraintDate ? new Date(patch.patch.constraintDate) : task.constraintDate,
    deadline: patch.patch.deadline ? new Date(patch.patch.deadline) : task.deadline,
  };
}

export function applyScenarioChanges(
  baseTasks: GanttTask[],
  changes: ScenarioChange[],
): GanttTask[] {
  return changes.reduce<GanttTask[]>((current, change) => {
    if (change.type === "updateTask") {
      return current.map((task) =>
        task.id === change.taskId ? applyTaskPatch(task, change) : task,
      );
    }

    if (change.type === "replacePredecessors") {
      return replacePredecessors(current, change.taskId, change.dependencies);
    }

    if (change.type === "replaceSuccessors") {
      return replaceSuccessors(current, change.taskId, change.dependencies);
    }

    return normalizeTaskStructure(current);
  }, baseTasks.map(cloneTask));
}

function buildTaskImpacts(baseTasks: GanttTask[], scenarioTasks: GanttTask[]): ScenarioTaskImpact[] {
  const scenarioById = new Map(scenarioTasks.map((task) => [task.id, task]));
  const impacts: ScenarioTaskImpact[] = [];

  for (const base of baseTasks) {
    const proposed = scenarioById.get(base.id);
    if (!proposed) continue;

    const startDeltaDays = dateDeltaDays(base.start, proposed.start);
    const finishDeltaDays = dateDeltaDays(base.finish, proposed.finish);
    const durationDeltaDays = proposed.duration - base.duration;
    const criticalChanged = base.isCritical !== proposed.isCritical;

    if (
      startDeltaDays !== 0 ||
      finishDeltaDays !== 0 ||
      durationDeltaDays !== 0 ||
      criticalChanged
    ) {
      impacts.push({
        taskId: base.id,
        name: proposed.name,
        startDeltaDays,
        finishDeltaDays,
        durationDeltaDays,
        criticalChanged,
      });
    }
  }

  return impacts;
}

function compareSummary(baseTasks: GanttTask[], scenarioTasks: GanttTask[]): ScenarioComparisonSummary {
  const baseCritical = baseTasks.filter((task) => task.isCritical).length;
  const scenarioCritical = scenarioTasks.filter((task) => task.isCritical).length;
  const baseDuration = baseTasks.reduce((sum, task) => sum + task.duration, 0);
  const scenarioDuration = scenarioTasks.reduce((sum, task) => sum + task.duration, 0);

  return {
    changedTaskCount: buildTaskImpacts(baseTasks, scenarioTasks).length,
    projectFinishDeltaDays: dateDeltaDays(maxFinish(baseTasks), maxFinish(scenarioTasks)),
    criticalTaskDelta: scenarioCritical - baseCritical,
    durationDeltaDays: scenarioDuration - baseDuration,
  };
}

export function compareScenario(
  baseTasks: GanttTask[],
  scenario: WhatIfScenario,
  options: RecalculateScheduleOptions & { calendar?: ProjectCalendar } = {},
): ScenarioComparison {
  const baseResult = recalculateSchedule(baseTasks.map(cloneTask), options);
  const proposedTasks = applyScenarioChanges(baseTasks, scenario.changes);
  const scenarioResult = recalculateSchedule(proposedTasks, options);
  const taskImpacts =
    scenarioResult.issues.length === 0
      ? buildTaskImpacts(baseResult.tasks, scenarioResult.tasks)
      : [];

  return {
    scenario,
    baseTasks: baseResult.tasks,
    scenarioTasks: scenarioResult.tasks,
    issues: [...baseResult.issues, ...scenarioResult.issues],
    summary:
      scenarioResult.issues.length === 0
        ? compareSummary(baseResult.tasks, scenarioResult.tasks)
        : {
            changedTaskCount: 0,
            projectFinishDeltaDays: 0,
            criticalTaskDelta: 0,
            durationDeltaDays: 0,
          },
    taskImpacts,
  };
}
