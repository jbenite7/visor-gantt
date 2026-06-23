/**
 * Line of Balance (LOB) computation logic.
 *
 * LOB visualizes repetitive construction workflows (floors, lots, zones)
 * where each activity is tracked across production units over time.
 */

import type { LOBActivity, LOBUnit } from "@/types/lob";
import type { GanttTask } from "@/components/gantt/types";

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

// ── Helper: generate LOB data from GanttTasks ─────────────────────

export interface ActivityMapping {
  /** Display name for the LOB activity. */
  activityName: string;
  /** Task IDs that belong to this activity across units. */
  taskIds: (string | number)[];
  /** Label for the unit of work (e.g. "Piso", "Lote"). */
  unitLabel: string;
}

export interface AutomaticLOBResult {
  activities: LOBActivity[];
  units: LOBUnit[];
  detectedUnitLabel: string;
}

/**
 * Generate LOBActivity objects from GanttTasks using an activity mapping.
 *
 * For each mapping entry, finds the matching tasks and derives the
 * activity's planned start/finish from the earliest start and latest finish.
 */
export function generateLOBFromTasks(
  tasks: GanttTask[],
  activityMapping: ActivityMapping[],
): LOBActivity[] {
  const taskMap = new Map<string | number, GanttTask>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  return activityMapping.map((mapping, index) => {
    const matchedTasks = mapping.taskIds
      .map((id) => taskMap.get(id))
      .filter((t): t is GanttTask => t != null);

    if (matchedTasks.length === 0) {
      // Return a stub activity with today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return {
        id: `lob-activity-${index}`,
        name: mapping.activityName,
        taskIds: mapping.taskIds,
        plannedRate: 1,
        unitLabel: mapping.unitLabel,
        plannedStart: today,
        plannedFinish: today,
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

    return {
      id: `lob-activity-${index}`,
      name: mapping.activityName,
      taskIds: mapping.taskIds,
      plannedRate,
      unitLabel: mapping.unitLabel,
      plannedStart,
      plannedFinish,
    };
  });
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

export function generateAutomaticLOBFromTasks(tasks: GanttTask[]): AutomaticLOBResult {
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

    detectedUnitLabel = sorted[0].unit.label;
    const starts = sorted.map((item) => item.task.start.getTime());
    const finishes = sorted.map((item) => item.task.finish.getTime());
    const plannedStart = new Date(Math.min(...starts));
    const plannedFinish = new Date(Math.max(...finishes));
    const durationDays = Math.max(
      1,
      (plannedFinish.getTime() - plannedStart.getTime()) / 86400000,
    );
    const activityId = `auto-lob-${activities.length}`;

    activities.push({
      id: activityId,
      name: displayActivityName(activityKey),
      taskIds: sorted.map((item) => item.task.id),
      plannedRate: sorted.length / durationDays,
      unitLabel: detectedUnitLabel,
      plannedStart,
      plannedFinish,
    });

    sorted.forEach((item, unitIndex) => {
      units.push({
        activityId,
        unitIndex,
        plannedDate: item.task.start,
      });
    });
  }

  return { activities, units, detectedUnitLabel };
}
