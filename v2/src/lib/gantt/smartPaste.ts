import type { GanttTask } from "@/components/gantt/types";
import { normalizeTaskStructure } from "@/lib/gantt/taskStructure";

interface SmartPasteColumnMap {
  name?: number;
  start?: number;
  finish?: number;
  duration?: number;
  progress?: number;
  outlineLevel?: number;
}

interface SmartPasteOptions {
  afterTaskId?: string | number;
}

const HEADER_ALIASES: Record<keyof SmartPasteColumnMap, string[]> = {
  name: ["actividad", "activity", "task", "tarea", "nombre", "name"],
  start: ["inicio", "comienzo", "start", "fecha inicio"],
  finish: ["fin", "finish", "fecha fin"],
  duration: ["duracion", "duración", "duration", "dias", "días"],
  progress: ["% completado", "porcentaje", "progress", "avance", "percent complete"],
  outlineLevel: ["nivel", "level", "outline", "outlinelevel", "outline level"],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.replace("%", "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const iso = new Date(trimmed);
  if (!Number.isNaN(iso.getTime())) {
    iso.setHours(0, 0, 0, 0);
    return iso;
  }

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return undefined;

  const [, day, month, year] = match;
  const fullYear = Number(year.length === 2 ? `20${year}` : year);
  const parsed = new Date(fullYear, Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return undefined;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function nextTaskId(tasks: GanttTask[]): number {
  return tasks.reduce((max, task) => {
    const numeric = typeof task.id === "number" ? task.id : Number(task.id);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0) + 1;
}

function subtreeEndIndex(tasks: GanttTask[], startIndex: number): number {
  const rootLevel = tasks[startIndex]?.outlineLevel ?? 1;
  let index = startIndex + 1;
  while (index < tasks.length && tasks[index].outlineLevel > rootLevel) {
    index += 1;
  }
  return index;
}

function buildColumnMap(firstRow: string[]): { map: SmartPasteColumnMap; hasHeader: boolean } {
  const map: SmartPasteColumnMap = {};

  firstRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized)) {
        map[field as keyof SmartPasteColumnMap] = index;
      }
    }
  });

  const hasHeader = map.name !== undefined || map.start !== undefined || map.duration !== undefined;
  if (hasHeader) return { map, hasHeader };

  return {
    hasHeader: false,
    map: {
      name: 0,
      start: 1,
      duration: 2,
      progress: 3,
      outlineLevel: 4,
    },
  };
}

function cell(row: string[], index: number | undefined): string | undefined {
  return index === undefined ? undefined : row[index];
}

export function insertTasksFromSmartPaste(
  tasks: GanttTask[],
  rawText: string,
  options: SmartPasteOptions = {},
): GanttTask[] {
  const rows = rawText
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((value) => value.trim()))
    .filter((row) => row.some((value) => value.length > 0));

  if (rows.length === 0) return tasks;

  const { map, hasHeader } = buildColumnMap(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (dataRows.length === 0) return tasks;

  const afterIndex = options.afterTaskId === undefined
    ? -1
    : tasks.findIndex((task) => task.id === options.afterTaskId);
  const insertIndex = afterIndex >= 0 ? subtreeEndIndex(tasks, afterIndex) : tasks.length;
  const baseLevel = afterIndex >= 0 ? tasks[afterIndex].outlineLevel : 1;
  let nextId = nextTaskId(tasks);

  const pastedTasks = dataRows
    .map((row) => {
      const name = cell(row, map.name)?.trim();
      if (!name) return undefined;

      const start = parseDate(cell(row, map.start)) ?? new Date();
      start.setHours(0, 0, 0, 0);
      const parsedFinish = parseDate(cell(row, map.finish));
      const parsedDuration = parseNumber(cell(row, map.duration));
      const duration = parsedFinish
        ? Math.max(0, Math.round((parsedFinish.getTime() - start.getTime()) / 86400000) + 1)
        : Math.max(0, Math.round(parsedDuration ?? 1));
      const finish = parsedFinish ?? new Date(start);
      if (!parsedFinish) {
        finish.setDate(finish.getDate() + Math.max(0, duration - 1));
      }
      const progress = Math.min(100, Math.max(0, parseNumber(cell(row, map.progress)) ?? 0));
      const outlineLevel = Math.max(1, Math.round(parseNumber(cell(row, map.outlineLevel)) ?? baseLevel));

      const task: GanttTask = {
        id: nextId,
        name,
        start,
        finish,
        duration,
        progress,
        percentComplete: progress,
        isCritical: false,
        isMilestone: duration === 0,
        isSummary: false,
        outlineLevel,
        dependencies: [],
      };
      nextId += 1;
      return task;
    })
    .filter((task): task is GanttTask => Boolean(task));

  if (pastedTasks.length === 0) return tasks;

  return normalizeTaskStructure([
    ...tasks.slice(0, insertIndex),
    ...pastedTasks,
    ...tasks.slice(insertIndex),
  ]);
}
