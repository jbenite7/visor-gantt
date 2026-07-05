import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import { normalizeTaskStructure } from "./taskStructure";

export type StructureTemplateId = "obra-gris-basica";

interface TemplateTaskDefinition {
  key: string;
  name: string;
  duration: number;
  outlineLevel: number;
  dependsOn?: string;
}

export interface ApplyStructureTemplateOptions {
  afterTaskId?: string | number;
  start?: Date;
}

const OBRA_GRIS_BASICA: TemplateTaskDefinition[] = [
  { key: "root", name: "Obra gris", duration: 1, outlineLevel: 1 },
  { key: "preliminares", name: "Preliminares", duration: 1, outlineLevel: 2 },
  { key: "replanteo", name: "Replanteo y localizacion", duration: 1, outlineLevel: 3 },
  { key: "excavacion", name: "Excavacion", duration: 2, outlineLevel: 3, dependsOn: "replanteo" },
  { key: "cimentacion", name: "Cimentacion", duration: 3, outlineLevel: 2 },
  { key: "acero-cimentacion", name: "Acero de cimentacion", duration: 2, outlineLevel: 3, dependsOn: "excavacion" },
  { key: "concreto-cimentacion", name: "Concreto de cimentacion", duration: 1, outlineLevel: 3, dependsOn: "acero-cimentacion" },
  { key: "estructura", name: "Estructura", duration: 4, outlineLevel: 2 },
  { key: "formaleta", name: "Formaleta", duration: 2, outlineLevel: 3, dependsOn: "concreto-cimentacion" },
  { key: "acero-estructura", name: "Acero de estructura", duration: 2, outlineLevel: 3, dependsOn: "formaleta" },
  { key: "vaciado", name: "Vaciado de concreto", duration: 1, outlineLevel: 3, dependsOn: "acero-estructura" },
];

function nextNumericId(tasks: GanttTask[]): number {
  return tasks.reduce((max, task) => {
    const value = typeof task.id === "number" ? task.id : Number(task.id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

function dayStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = dayStart(date);
  result.setDate(result.getDate() + days);
  return result;
}

function nextTemplateStart(tasks: GanttTask[], fallback?: Date): Date {
  if (fallback) return dayStart(fallback);
  const finishTimes = tasks
    .map((task) => task.finish.getTime())
    .filter((value) => Number.isFinite(value));
  if (finishTimes.length === 0) return dayStart(new Date());
  return addDays(new Date(Math.max(...finishTimes)), 1);
}

function subtreeEndIndex(tasks: GanttTask[], startIndex: number): number {
  const rootLevel = tasks[startIndex]?.outlineLevel ?? 1;
  let end = startIndex + 1;
  while (end < tasks.length && tasks[end].outlineLevel > rootLevel) {
    end += 1;
  }
  return end;
}

function insertIndexFor(tasks: GanttTask[], afterTaskId: string | number | undefined): number {
  if (afterTaskId === undefined) return tasks.length;
  const index = tasks.findIndex((task) => task.id === afterTaskId);
  return index < 0 ? tasks.length : subtreeEndIndex(tasks, index);
}

export function applyStructureTemplate(
  tasks: GanttTask[],
  templateId: StructureTemplateId,
  options: ApplyStructureTemplateOptions = {},
): GanttTask[] {
  if (templateId !== "obra-gris-basica") return tasks;

  const firstId = nextNumericId(tasks);
  const idByKey = new Map<string, number>();
  OBRA_GRIS_BASICA.forEach((definition, index) => {
    idByKey.set(definition.key, firstId + index);
  });

  let cursor = nextTemplateStart(tasks, options.start);
  const templateTasks = OBRA_GRIS_BASICA.map((definition) => {
    const id = idByKey.get(definition.key)!;
    const duration = Math.max(0, definition.duration);
    const start = cursor;
    const finish = addDays(start, Math.max(0, duration - 1));
    if (definition.outlineLevel === 3) {
      cursor = addDays(finish, 1);
    }

    const dependencies: GanttDependency[] = definition.dependsOn
      ? [{
          from: idByKey.get(definition.dependsOn)!,
          to: id,
          type: "FS",
          lag: 0,
        }]
      : [];

    return {
      id,
      name: definition.name,
      start,
      finish,
      duration,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: definition.outlineLevel < 3,
      outlineLevel: definition.outlineLevel,
      dependencies,
    } satisfies GanttTask;
  });

  const insertIndex = insertIndexFor(tasks, options.afterTaskId);
  return normalizeTaskStructure([
    ...tasks.slice(0, insertIndex),
    ...templateTasks,
    ...tasks.slice(insertIndex),
  ]);
}
