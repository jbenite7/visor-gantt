/**
 * Line of Balance (LOB) computation logic.
 *
 * LOB visualizes repetitive construction workflows (floors, lots, zones)
 * where each activity is tracked across production units over time.
 */

import type { LOBActivity, LOBUnit } from "@/types/lob";
import type { GanttTask } from "@/components/gantt/types";
import type { MatrixPlan } from "@/types/matrix";
import { classifyActivityFamily, type ActivityFamilyResult } from "./activityFamily";

// ── Layout types ──────────────────────────────────────────────────

export interface LOBPoint {
  x: number;
  y: number;
  date: Date;
  unitIndex: number;
}

export interface LOBLine {
  activityId: string;
  activityName: string;
  points: LOBPoint[];
  color: string;
  isCritical: boolean;
}

export interface LOBLayoutResult {
  lines: LOBLine[];
  xScale: { min: Date; max: Date };
  yScale: { min: number; max: number };
  totalUnits: number;
}

export type LOBDiagnosticKind =
  | "insufficientUnits"
  | "delayedActual"
  | "unevenRhythm"
  | "lineInterference";

export interface LOBDiagnostic {
  kind: LOBDiagnosticKind;
  severity: "low" | "medium" | "high";
  activityIds: string[];
  unitIndices: number[];
  message: string;
  recommendation: string;
}

// ── AIA palette for activity line colors ──────────────────────────

const AIA_ACTIVITY_COLORS = [
  "var(--aia-corp-main)",   // Green — Corporativo
  "var(--aia-const-main)",  // Orange — Construcción
  "var(--aia-arch-main)",   // Blue — Arquitectura
  "var(--aia-proj-main)",   // Teal — Proyectos
  "var(--aia-warn-main)",   // Yellow — Warning
  "var(--aia-corp-mid)",    // Green mid
  "var(--aia-const-mid)",   // Orange mid
  "var(--aia-arch-mid)",    // Blue mid
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(left: Date, right: Date): number {
  return Math.round((right.getTime() - left.getTime()) / MS_PER_DAY);
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ── Core computation ──────────────────────────────────────────────

/**
 * Compute the full LOB layout from activities and their unit data.
 *
 * Each activity produces:
 * - A "planned" line connecting the planned dates across units.
 * - An "actual" line (if actual data exists) connecting actual dates.
 */
export function computeLOBLayout(
  activities: LOBActivity[],
  units: LOBUnit[],
): LOBLayoutResult {
  if (activities.length === 0) {
    const now = new Date();
    return {
      lines: [],
      xScale: { min: now, max: now },
      yScale: { min: 0, max: 0 },
      totalUnits: 0,
    };
  }

  // Index units by activityId for O(1) lookup
  const unitsByActivity = new Map<string, LOBUnit[]>();
  for (const unit of units) {
    const list = unitsByActivity.get(unit.activityId) ?? [];
    list.push(unit);
    unitsByActivity.set(unit.activityId, list);
  }

  const lines: LOBLine[] = [];
  const allDates: Date[] = [];
  let maxUnitIndex = 0;

  activities.forEach((activity, colorIndex) => {
    const activityUnits = (unitsByActivity.get(activity.id) ?? [])
      .slice()
      .sort((a, b) => a.unitIndex - b.unitIndex);

    const color = AIA_ACTIVITY_COLORS[colorIndex % AIA_ACTIVITY_COLORS.length];

    // Determine if this activity is critical (actual lags behind planned)
    const hasDeviation = activityUnits.some((u) => {
      if (!u.actualDate) return false;
      return u.actualDate > u.plannedDate;
    });

    // Planned line — always present (use activity dates if no unit data)
    if (activityUnits.length > 0) {
      const plannedPoints: LOBPoint[] = activityUnits.map((u) => ({
        x: u.plannedDate.getTime(),
        y: u.unitIndex,
        date: u.plannedDate,
        unitIndex: u.unitIndex,
      }));

      lines.push({
        activityId: activity.id,
        activityName: `${activity.name} (Planificado)`,
        points: plannedPoints,
        color,
        isCritical: false,
      });

      allDates.push(...plannedPoints.map((p) => p.date));
      maxUnitIndex = Math.max(
        maxUnitIndex,
        ...plannedPoints.map((p) => p.unitIndex),
      );

      // Actual line — only if at least one unit has actualDate
      const actualPoints: LOBPoint[] = activityUnits
        .filter((u): u is LOBUnit & { actualDate: Date } => u.actualDate != null)
        .map((u) => ({
          x: u.actualDate!.getTime(),
          y: u.unitIndex,
          date: u.actualDate!,
          unitIndex: u.unitIndex,
        }));

      if (actualPoints.length > 0) {
        lines.push({
          activityId: `${activity.id}-actual`,
          activityName: `${activity.name} (Real)`,
          points: actualPoints,
          color,
          isCritical: hasDeviation,
        });

        allDates.push(...actualPoints.map((p) => p.date));
      }
    } else {
      // No unit data — create synthetic points from activity bounds
      const plannedPoints: LOBPoint[] = [
        { x: activity.plannedStart.getTime(), y: 0, date: activity.plannedStart, unitIndex: 0 },
        { x: activity.plannedFinish.getTime(), y: 1, date: activity.plannedFinish, unitIndex: 1 },
      ];

      lines.push({
        activityId: activity.id,
        activityName: activity.name,
        points: plannedPoints,
        color,
        isCritical: false,
      });

      allDates.push(activity.plannedStart, activity.plannedFinish);
    }
  });

  // Compute scales
  const xMin = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const xMax = new Date(Math.max(...allDates.map((d) => d.getTime())));

  // Add padding: 5% of range on each side
  const xRange = xMax.getTime() - xMin.getTime();
  const xPadding = xRange * 0.05 || 86400000; // fallback 1 day if range is zero
  xMin.setTime(xMin.getTime() - xPadding);
  xMax.setTime(xMax.getTime() + xPadding);

  return {
    lines,
    xScale: { min: xMin, max: xMax },
    yScale: { min: 0, max: maxUnitIndex },
    totalUnits: maxUnitIndex,
  };
}

export function diagnoseLOB(
  activities: LOBActivity[],
  units: LOBUnit[],
): LOBDiagnostic[] {
  const diagnostics: LOBDiagnostic[] = [];
  const unitsByActivity = new Map<string, LOBUnit[]>();

  for (const unit of units) {
    const list = unitsByActivity.get(unit.activityId) ?? [];
    list.push(unit);
    unitsByActivity.set(unit.activityId, list);
  }

  for (const activity of activities) {
    const activityUnits = (unitsByActivity.get(activity.id) ?? [])
      .slice()
      .sort((a, b) => a.unitIndex - b.unitIndex);

    if (activityUnits.length < 2) {
      diagnostics.push({
        kind: "insufficientUnits",
        severity: "low",
        activityIds: [activity.id],
        unitIndices: activityUnits.map((unit) => unit.unitIndex),
        message: `${activity.name} no tiene suficientes unidades para evaluar ritmo.`,
        recommendation: "Agrega al menos dos unidades repetitivas o revisa la deteccion automatica de actividades.",
      });
      continue;
    }

    const delayedUnits = activityUnits.filter(
      (unit) => unit.actualDate && daysBetween(unit.plannedDate, unit.actualDate) > 0,
    );
    if (delayedUnits.length > 0) {
      const maxDelay = Math.max(
        ...delayedUnits.map((unit) => daysBetween(unit.plannedDate, unit.actualDate!)),
      );
      diagnostics.push({
        kind: "delayedActual",
        severity: maxDelay >= 3 ? "high" : "medium",
        activityIds: [activity.id],
        unitIndices: delayedUnits.map((unit) => unit.unitIndex),
        message: `${activity.name} tiene ${delayedUnits.length} unidades con atraso real de hasta ${maxDelay}d.`,
        recommendation: "Revisa cuadrillas, restricciones de frente y compromisos de recuperacion por unidad.",
      });
    }

    const intervals = activityUnits
      .slice(1)
      .map((unit, index) => Math.abs(daysBetween(activityUnits[index].plannedDate, unit.plannedDate)));
    if (intervals.length > 1) {
      const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
      const max = Math.max(...intervals);
      const min = Math.min(...intervals);
      if (average > 0 && max - min >= 2 && max > average * 1.5) {
        diagnostics.push({
          kind: "unevenRhythm",
          severity: "medium",
          activityIds: [activity.id],
          unitIndices: activityUnits.map((unit) => unit.unitIndex),
          message: `${activity.name} tiene ritmo irregular entre unidades (${min}d a ${max}d).`,
          recommendation: "Balancea cuadrillas o ajusta buffers para mantener una pendiente mas estable.",
        });
      }
    }
  }

  const activityUnitMaps = activities.map((activity) => ({
    activity,
    byUnit: new Map(
      (unitsByActivity.get(activity.id) ?? []).map((unit) => [unit.unitIndex, unit.plannedDate]),
    ),
  }));

  for (let leftIndex = 0; leftIndex < activityUnitMaps.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < activityUnitMaps.length; rightIndex += 1) {
      const left = activityUnitMaps[leftIndex];
      const right = activityUnitMaps[rightIndex];
      const commonUnits = [...left.byUnit.keys()]
        .filter((unitIndex) => right.byUnit.has(unitIndex))
        .sort((a, b) => a - b);
      if (commonUnits.length < 2) continue;

      const first = commonUnits[0];
      const last = commonUnits[commonUnits.length - 1];
      const firstDelta = daysBetween(left.byUnit.get(first)!, right.byUnit.get(first)!);
      const lastDelta = daysBetween(left.byUnit.get(last)!, right.byUnit.get(last)!);

      if (firstDelta === 0 || lastDelta === 0 || firstDelta * lastDelta < 0) {
        diagnostics.push({
          kind: "lineInterference",
          severity: "high",
          activityIds: [left.activity.id, right.activity.id],
          unitIndices: [first, last],
          message: `${left.activity.name} y ${right.activity.name} se cruzan o quedan sin separacion en la linea de balance.`,
          recommendation: "Revisa la secuencia por unidad para evitar interferencias de frentes o esperas entre cuadrillas.",
        });
      }
    }
  }

  return diagnostics.sort((a, b) => {
    const weight = { high: 3, medium: 2, low: 1 };
    return weight[b.severity] - weight[a.severity];
  });
}

// ── Helper: generate LOB data from GanttTasks ─────────────────────

export interface ActivityMapping {
  /** Display name for the LOB activity. */
  activityName: string;
  /** Task IDs that belong to this activity across units. */
  taskIds: (string | number)[];
  /** Label for the unit of work (e.g. "Piso", "Lote"). */
  unitLabel: string;
}

export interface GenerateLOBFromTasksResult {
  mappings: Array<LOBActivity & { family: ActivityFamilyResult }>;
}

export interface AutomaticLOBResult {
  activities: LOBActivity[];
  units: LOBUnit[];
  detectedUnitLabel: string;
}

/**
 * Build the breadcrumb of ancestor summary task names for a given wbs,
 * derived from prefixes of its dotted wbs path (root → leaf).
 */
function buildWbsBreadcrumb(wbs: string | undefined, tasks: GanttTask[]): string[] {
  const parts = wbs?.split(".").map((part) => part.trim()).filter(Boolean) ?? [];
  if (parts.length <= 1) return [];

  const nameByWbs = new Map<string, string>();
  for (const task of tasks) {
    if (task.wbs) nameByWbs.set(task.wbs, task.name);
  }

  const breadcrumb: string[] = [];
  for (let depth = 1; depth < parts.length; depth += 1) {
    const ancestorWbs = parts.slice(0, depth).join(".");
    const name = nameByWbs.get(ancestorWbs);
    if (name) breadcrumb.push(name);
  }
  return breadcrumb;
}

/**
 * Generate LOBActivity objects from GanttTasks using an activity mapping.
 *
 * For each mapping entry, finds the matching tasks and derives the
 * activity's planned start/finish from the earliest start and latest finish.
 * Each generated activity is also classified into a family, using the
 * breadcrumb of ancestor summary tasks (derived from wbs) as context.
 */
export function generateLOBFromTasks(
  tasks: GanttTask[],
  activityMapping: ActivityMapping[],
): GenerateLOBFromTasksResult {
  const taskMap = new Map<string | number, GanttTask>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const mappings = activityMapping.map((mapping, index) => {
    const matchedTasks = mapping.taskIds
      .map((id) => taskMap.get(id))
      .filter((t): t is GanttTask => t != null);

    if (matchedTasks.length === 0) {
      // Return a stub activity with today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const stubTask: GanttTask = {
        id: `lob-activity-${index}`,
        name: mapping.activityName,
        start: today,
        finish: today,
        duration: 0,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      };
      return {
        id: `lob-activity-${index}`,
        name: mapping.activityName,
        taskIds: mapping.taskIds,
        plannedRate: 1,
        unitLabel: mapping.unitLabel,
        plannedStart: today,
        plannedFinish: today,
        family: classifyActivityFamily(stubTask),
      };
    }

    const starts = matchedTasks.map((t) => t.start.getTime());
    const finishes = matchedTasks.map((t) => t.finish.getTime());

    const plannedStart = new Date(Math.min(...starts));
    const plannedFinish = new Date(Math.max(...finishes));

    // Compute average rate: tasks per day
    const durationDays =
      (plannedFinish.getTime() - plannedStart.getTime()) / 86400000;
    const plannedRate =
      durationDays > 0 ? matchedTasks.length / durationDays : 1;

    const representativeTask = matchedTasks[0];
    const breadcrumb = buildWbsBreadcrumb(representativeTask.wbs, tasks);
    const family = classifyActivityFamily(
      { ...representativeTask, name: mapping.activityName },
      { breadcrumb },
    );

    return {
      id: `lob-activity-${index}`,
      name: mapping.activityName,
      taskIds: mapping.taskIds,
      plannedRate,
      unitLabel: mapping.unitLabel,
      plannedStart,
      plannedFinish,
      family,
    };
  });

  return { mappings };
}

const UNIT_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "Piso", regex: /\b(?:piso|nivel|n)\s*([a-z]?\d+)\b/i },
  { label: "Zona", regex: /\b(?:zona|sector|area|área)\s*([a-z0-9]+)\b/i },
  { label: "Lote", regex: /\b(?:lote|manzana)\s*([a-z0-9]+)\b/i },
  { label: "Tramo", regex: /\b(?:tramo|frente)\s*([a-z0-9]+)\b/i },
  { label: "Etapa", regex: /\b(?:etapa|fase)\s*([a-z0-9]+)\b/i },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectUnit(name: string): { label: string; key: string; index: number } | null {
  const normalized = normalizeText(name);
  for (const pattern of UNIT_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const raw = match[1].toUpperCase();
    const numeric = Number(raw.replace(/^[A-Z]/, ""));
    return {
      label: pattern.label,
      key: raw,
      index: Number.isFinite(numeric) ? numeric : raw.charCodeAt(0),
    };
  }
  return null;
}

function normalizeActivityName(name: string): string {
  let normalized = normalizeText(name);
  for (const pattern of UNIT_PATTERNS) {
    normalized = normalized.replace(pattern.regex, " ");
  }
  normalized = normalized
    .replace(/\b(capitulo|chapter)\s+\d+\b/g, " ")
    .replace(/\b(hito|milestone)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || "Actividad";
}

function displayActivityName(normalized: string): string {
  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseWbsParts(wbs: string | undefined): number[] {
  if (!wbs) return [];
  const parts = wbs
    .split(".")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
  return parts.length === wbs.split(".").length ? parts : [];
}

function compareWbs(a: string | undefined, b: string | undefined): number {
  const left = parseWbsParts(a);
  const right = parseWbsParts(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }
  return 0;
}

function getWbsKey(wbs: string | undefined, depth: number): string | null {
  const parts = parseWbsParts(wbs);
  if (parts.length < depth) return null;
  return parts.slice(0, depth).join(".");
}

function matrixRhythmDays(
  group: Array<{ task: GanttTask }>,
  matrixPlan: MatrixPlan | undefined,
): number | undefined {
  if (!matrixPlan) return undefined;
  const recipeById = new Map(matrixPlan.recipes.map((recipe) => [recipe.id, recipe]));
  for (const item of group) {
    const recipeId = item.task.matrixSource?.recipeId;
    if (!recipeId) continue;
    const offsetDays = recipeById.get(recipeId)?.lineOfBalance?.offsetDays;
    if (offsetDays != null && offsetDays > 0) return offsetDays;
  }
  return undefined;
}

function plannedDatesForTextGroup(
  sorted: Array<{ task: GanttTask }>,
  matrixPlan: MatrixPlan | undefined,
): Date[] {
  const taskStarts = sorted.map((item) => item.task.start);
  if (taskStarts.length < 2) return taskStarts;

  const minTime = Math.min(...taskStarts.map((date) => date.getTime()));
  const maxTime = Math.max(...taskStarts.map((date) => date.getTime()));
  if (minTime !== maxTime) return taskStarts;

  const rhythmDays = matrixRhythmDays(sorted, matrixPlan);
  if (!rhythmDays) return taskStarts;

  const baseDate = new Date(minTime);
  return sorted.map((_, index) => addCalendarDays(baseDate, index * rhythmDays));
}

function taskDurationDays(task: GanttTask): number {
  if (typeof task.duration === "number" && Number.isFinite(task.duration)) {
    return Math.max(1, task.duration);
  }
  return Math.max(1, daysBetween(task.start, task.finish) + 1);
}

function generateTextLOBFromTasks(
  tasks: GanttTask[],
  matrixPlan?: MatrixPlan,
): AutomaticLOBResult {
  const candidates = tasks
    .filter((task) => !task.isSummary && !task.isMilestone)
    .map((task) => ({ task, unit: detectUnit(`${task.wbs ?? ""} ${task.name}`) }))
    .filter((entry): entry is { task: GanttTask; unit: { label: string; key: string; index: number } } => entry.unit !== null);

  const activityGroups = new Map<string, Array<typeof candidates[number]>>();
  for (const candidate of candidates) {
    const activityKey = normalizeActivityName(candidate.task.name);
    const group = activityGroups.get(activityKey) ?? [];
    group.push(candidate);
    activityGroups.set(activityKey, group);
  }

  const activities: LOBActivity[] = [];
  const units: LOBUnit[] = [];
  let detectedUnitLabel = "Unidad";

  for (const [activityKey, group] of activityGroups) {
    const uniqueUnits = new Map<string, typeof group[number]>();
    for (const item of group) {
      uniqueUnits.set(item.unit.key, item);
    }
    if (uniqueUnits.size < 2) continue;

    const sorted = [...uniqueUnits.values()].sort((a, b) => {
      if (a.unit.index !== b.unit.index) return a.unit.index - b.unit.index;
      return a.task.start.getTime() - b.task.start.getTime();
    });
    const plannedDates = plannedDatesForTextGroup(sorted, matrixPlan);

    detectedUnitLabel = sorted[0].unit.label;
    const starts = plannedDates.map((date) => date.getTime());
    const finishes = sorted.map((item, index) =>
      addCalendarDays(plannedDates[index], taskDurationDays(item.task) - 1).getTime(),
    );
    const plannedStart = new Date(Math.min(...starts));
    const plannedFinish = new Date(Math.max(...finishes));
    const durationDays = Math.max(
      1,
      (plannedFinish.getTime() - plannedStart.getTime()) / 86400000,
    );
    const activityId = `auto-lob-${activities.length}`;
    const displayName = displayActivityName(activityKey);
    const representativeTask = sorted[0].task;
    const breadcrumb = buildWbsBreadcrumb(representativeTask.wbs, tasks);
    const family = classifyActivityFamily(
      { ...representativeTask, name: displayName },
      { breadcrumb },
    );

    activities.push({
      id: activityId,
      name: displayName,
      taskIds: sorted.map((item) => item.task.id),
      plannedRate: sorted.length / durationDays,
      unitLabel: detectedUnitLabel,
      plannedStart,
      plannedFinish,
      family,
    });

    sorted.forEach((item, unitIndex) => {
      units.push({
        activityId,
        unitIndex,
        plannedDate: plannedDates[unitIndex],
      });
    });
  }

  return { activities, units, detectedUnitLabel };
}

function generateWBSLOBFromTasks(tasks: GanttTask[]): AutomaticLOBResult {
  const levelTwoSummaries = tasks
    .filter((task) => task.isSummary && parseWbsParts(task.wbs).length === 2)
    .slice()
    .sort((a, b) => compareWbs(a.wbs, b.wbs));

  if (levelTwoSummaries.length < 2) {
    return { activities: [], units: [], detectedUnitLabel: "Unidad" };
  }

  const unitByWbs = new Map<string, GanttTask>();
  levelTwoSummaries.forEach((task) => {
    const key = getWbsKey(task.wbs, 2);
    if (!key) return;
    unitByWbs.set(key, task);
  });

  const levelThreeSummaries = tasks
    .filter((task) => task.isSummary && parseWbsParts(task.wbs).length === 3)
    .map((task) => {
      const unitKey = getWbsKey(task.wbs, 2);
      return unitKey && unitByWbs.has(unitKey) ? { task, unitKey } : null;
    })
    .filter((entry): entry is { task: GanttTask; unitKey: string } => entry !== null);

  const activityGroups = new Map<
    string,
    { displayName: string; entries: Array<{ task: GanttTask; unitKey: string }> }
  >();

  for (const entry of levelThreeSummaries) {
    const activityKey = normalizeActivityName(entry.task.name);
    const group = activityGroups.get(activityKey) ?? {
      displayName: entry.task.name,
      entries: [],
    };
    group.entries.push(entry);
    activityGroups.set(activityKey, group);
  }

  const activities: LOBActivity[] = [];
  const units: LOBUnit[] = [];
  const detectedUnitLabel = "Capítulo WBS";
  const eligibleGroups: Array<{
    displayName: string;
    uniqueUnits: Map<string, { task: GanttTask; unitKey: string }>;
  }> = [];
  const includedUnitKeys = new Set<string>();

  for (const [, group] of activityGroups) {
    const uniqueUnits = new Map<string, { task: GanttTask; unitKey: string }>();
    for (const entry of group.entries) {
      const current = uniqueUnits.get(entry.unitKey);
      if (!current || entry.task.start < current.task.start) {
        uniqueUnits.set(entry.unitKey, entry);
      }
    }
    if (uniqueUnits.size < 2) continue;

    eligibleGroups.push({ displayName: group.displayName, uniqueUnits });
    for (const unitKey of uniqueUnits.keys()) {
      includedUnitKeys.add(unitKey);
    }
  }

  const unitIndexByWbs = new Map<string, number>();
  levelTwoSummaries
    .map((task) => getWbsKey(task.wbs, 2))
    .filter((key): key is string => key !== null && includedUnitKeys.has(key))
    .forEach((key, index) => {
      unitIndexByWbs.set(key, index);
  });

  for (const group of eligibleGroups) {
    const sorted = [...group.uniqueUnits.values()].sort((a, b) => {
      const leftIndex = unitIndexByWbs.get(a.unitKey) ?? 0;
      const rightIndex = unitIndexByWbs.get(b.unitKey) ?? 0;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return a.task.start.getTime() - b.task.start.getTime();
    });

    const starts = sorted.map((item) => item.task.start.getTime());
    const finishes = sorted.map((item) => item.task.finish.getTime());
    const plannedStart = new Date(Math.min(...starts));
    const plannedFinish = new Date(Math.max(...finishes));
    const durationDays = Math.max(
      1,
      (plannedFinish.getTime() - plannedStart.getTime()) / 86400000,
    );
    const activityId = `wbs-lob-${activities.length}`;
    const representativeTask = sorted[0].task;
    const breadcrumb = buildWbsBreadcrumb(representativeTask.wbs, tasks);
    const family = classifyActivityFamily(
      { ...representativeTask, name: group.displayName },
      { breadcrumb },
    );

    activities.push({
      id: activityId,
      name: group.displayName,
      taskIds: sorted.map((item) => item.task.id),
      plannedRate: sorted.length / durationDays,
      unitLabel: detectedUnitLabel,
      plannedStart,
      plannedFinish,
      family,
    });

    sorted.forEach((item) => {
      const unitTask = unitByWbs.get(item.unitKey);
      units.push({
        activityId,
        unitIndex: unitIndexByWbs.get(item.unitKey) ?? 0,
        unitName: unitTask?.name,
        plannedDate: item.task.start,
      });
    });
  }

  return { activities, units, detectedUnitLabel };
}

export function generateAutomaticLOBFromTasks(
  tasks: GanttTask[],
  matrixPlan?: MatrixPlan,
): AutomaticLOBResult {
  const textResult = generateTextLOBFromTasks(tasks, matrixPlan);
  if (textResult.activities.length > 0) return textResult;
  return generateWBSLOBFromTasks(tasks);
}
