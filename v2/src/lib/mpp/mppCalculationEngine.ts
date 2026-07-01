import type { GanttDependency, GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import { DEFAULT_PROJECT_CALENDAR, type ProjectCalendar } from "@/types/calendar";
import type { Assignment, Resource } from "@/types/resource";
import type {
  MppAssignmentColumn,
  MppCustomFieldDefinition,
  MppRecordColumn,
  MppRecordType,
  MppResourceColumn,
  MppTaskColumn,
} from "@/types/mppColumns";
import {
  createSchedulingCalendar,
  getCalendarMinutesForDate,
  getCalendarMinutesPerDay,
  isProjectWorkingDay,
  normalizeProjectCalendar,
} from "@/lib/scheduling/projectCalendar";
import { normalizeMppFieldId } from "./fieldLabels";
import { evaluateCustomFormula, extractFormulaDependencies } from "./customFormula";
import { getMppCalculatedFieldSpec } from "./calculatedFields";

export const MPP_CALCULATION_ENGINE_VERSION = "mpp-calc-v1";

interface MppCalculationInput {
  tasks: GanttTask[];
  resources?: Resource[];
  assignments?: Assignment[];
  baselines?: Baseline[];
  calendar?: ProjectCalendar;
  statusDate?: Date | string;
  timephasedScale?: TimephasedScale;
  mppTaskColumns?: MppTaskColumn[];
  mppResourceColumns?: MppResourceColumn[];
  mppAssignmentColumns?: MppAssignmentColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
}

type TimephasedScale = "day" | "week" | "month";

export interface MppCalculationResult {
  tasks: GanttTask[];
  resources: Resource[];
  assignments: Assignment[];
  mppTaskColumns: MppTaskColumn[];
  mppResourceColumns: MppResourceColumn[];
  mppAssignmentColumns: MppAssignmentColumn[];
  customFieldDefinitions: MppCustomFieldDefinition[];
  calculatedAt: string;
  engineVersion: string;
}

interface TaskMetrics {
  work: number;
  actualWork: number;
  remainingWork: number;
  cost: number;
  actualCost: number;
  remainingCost: number;
  fixedCost: number;
  fixedCostAccrual: "Start" | "End" | "Prorated";
  actualFixedCost: number;
  overtimeWork: number;
  actualOvertimeWork: number;
  remainingOvertimeWork: number;
  resourceNames: string[];
  resourceInitials: string[];
  resourceGroups: string[];
  resourceTypes: string[];
  assignmentUnits: number[];
  peak: number;
  overallocated: boolean;
}

interface AssignmentFinancials {
  start?: Date;
  finish?: Date;
  assignmentDelay: number;
  duration: number;
  units: number;
  costRateTable: string;
  standardRate: number;
  costPerUse: number;
  work: number;
  actualWork: number;
  remainingWork: number;
  cost: number;
  actualCost: number;
  remainingCost: number;
  overtimeWork: number;
  actualOvertimeWork: number;
  remainingOvertimeWork: number;
  overtimeRate: number;
  overtimeCost: number;
  actualOvertimeCost: number;
  remainingOvertimeCost: number;
}

interface ResourceLoadIndex {
  peakByResourceId: Map<number, number>;
  loadByResourceDate: Map<number, Map<string, number>>;
  availabilityByResourceDate: Map<number, Map<string, number>>;
  overallocatedResourceIds: Set<number>;
  overallocatedTaskIds: Set<string>;
  overallocatedAssignmentKeys: Set<string>;
  overallocatedDatesByResourceId: Map<number, Set<string>>;
  overallocatedDatesByTaskId: Map<string, Set<string>>;
  overallocatedDatesByAssignmentKey: Map<string, Set<string>>;
}

interface ResolvedCostRateTable {
  name: string;
  standardRate: number;
  overtimeRate: number;
  costPerUse: number;
  entries: ResolvedCostRateTableEntry[];
}

interface ResolvedCostRateTableEntry {
  startTime?: number;
  endTime?: number;
  standardRate: number;
  overtimeRate: number;
  costPerUse: number;
}

interface ResourceAssignmentFinancials {
  assignment: Assignment;
  financials: AssignmentFinancials;
}

interface AssignmentSchedule {
  start?: Date;
  finish?: Date;
  assignmentDelay: number;
  duration: number;
}

interface EarnedValueTotals {
  baselineCost: number;
  cost: number;
  bcws: number;
  bcwp: number;
  acwp: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateIso(date: Date | undefined): string | undefined {
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
}

function dateOnly(date: Date | undefined): string | undefined {
  return dateIso(date)?.slice(0, 10);
}

function parseDate(value: Date | string | undefined): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function compareDateOnly(left: Date | undefined, right: Date | undefined): number {
  const leftKey = dateOnly(left);
  const rightKey = dateOnly(right);
  if (!leftKey || !rightKey) return 0;
  return leftKey.localeCompare(rightKey);
}

function durationDays(start: Date | undefined, finish: Date | undefined): number {
  if (!start || !finish) return 0;
  return Math.max(0, Math.round((finish.getTime() - start.getTime()) / MS_PER_DAY) + 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function workingMinutesBetweenDates(
  start: Date | undefined,
  finish: Date | undefined,
  calendar?: ProjectCalendar,
): number {
  if (!start || !finish || compareDateOnly(start, finish) > 0) return 0;
  let minutes = 0;
  for (let cursor = new Date(start); compareDateOnly(cursor, finish) <= 0; cursor = addDays(cursor, 1)) {
    if (isProjectWorkingDay(cursor, normalizeProjectCalendar(calendar))) {
      minutes += getCalendarMinutesForDate(cursor, calendar);
    }
  }
  return minutes;
}

function workingDayVariance(
  baselineDate: Date | undefined,
  currentDate: Date | undefined,
  calendar?: ProjectCalendar,
): number {
  const direction = compareDateOnly(currentDate, baselineDate);
  if (!baselineDate || !currentDate || direction === 0) return 0;

  const start = direction > 0 ? addDays(baselineDate, 1) : addDays(currentDate, 1);
  const finish = direction > 0 ? currentDate : baselineDate;
  const workingMinutes = workingMinutesBetweenDates(start, finish, calendar);
  const days = workingMinutes / getCalendarMinutesPerDay(calendar);
  return direction > 0 ? days : -days;
}

function parseDurationDays(value: unknown, minutesPerDay: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const iso = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(raw);
  if (iso) {
    const days = Number(iso[1] ?? 0);
    const hours = Number(iso[2] ?? 0);
    const minutes = Number(iso[3] ?? 0);
    const seconds = Number(iso[4] ?? 0);
    const totalMinutes = days * minutesPerDay + hours * 60 + minutes + seconds / 60;
    return Math.max(0, totalMinutes / minutesPerDay);
  }

  const unit = /^(-?\d+(?:\.\d+)?)\s*(d|day|days|h|hr|hour|hours|m|min|minute|minutes)$/i.exec(raw);
  if (unit) {
    const amount = Number(unit[1]);
    if (!Number.isFinite(amount)) return undefined;
    const normalizedUnit = unit[2].toLowerCase();
    if (normalizedUnit.startsWith("d")) return Math.max(0, amount);
    if (normalizedUnit.startsWith("h")) return Math.max(0, (amount * 60) / minutesPerDay);
    return Math.max(0, amount / minutesPerDay);
  }

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : undefined;
}

function parseWorkHours(value: unknown, minutesPerDay: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const iso = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(raw);
  if (iso) {
    const days = Number(iso[1] ?? 0);
    const hours = Number(iso[2] ?? 0);
    const minutes = Number(iso[3] ?? 0);
    const seconds = Number(iso[4] ?? 0);
    const totalMinutes = days * minutesPerDay + hours * 60 + minutes + seconds / 60;
    return Math.max(0, totalMinutes / 60);
  }

  const unit = /^(-?\d+(?:\.\d+)?)\s*(d|day|days|h|hr|hour|hours|m|min|minute|minutes)$/i.exec(raw);
  if (unit) {
    const amount = Number(unit[1]);
    if (!Number.isFinite(amount)) return undefined;
    const normalizedUnit = unit[2].toLowerCase();
    if (normalizedUnit.startsWith("d")) return Math.max(0, (amount * minutesPerDay) / 60);
    if (normalizedUnit.startsWith("h")) return Math.max(0, amount);
    return Math.max(0, amount / 60);
  }

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : undefined;
}

function completeThroughDate(
  task: GanttTask,
  actualDuration: number,
  minutesPerDay: number,
  calendar?: ProjectCalendar,
): string | undefined {
  if (actualDuration <= 0) return undefined;
  if (actualDuration >= task.duration) return dateOnly(task.finish);
  const actualDurationMinutes = actualDuration * minutesPerDay;
  if (actualDurationMinutes <= 0) return undefined;
  const schedulingCalendar = createSchedulingCalendar(calendar);
  return dateOnly(schedulingCalendar.addDuration(task.start, actualDurationMinutes));
}

function resumeDateAfterStop(
  stopDate: string | undefined,
  calendar?: ProjectCalendar,
): string | undefined {
  if (!stopDate) return undefined;
  const parsedStop = parseDate(stopDate);
  if (!parsedStop) return undefined;
  return dateOnly(createSchedulingCalendar(calendar).getNextWorkingDay(parsedStop));
}

function resumeDateForTask(
  fields: Record<string, unknown>,
  stopDate: string | undefined,
  calendar?: ProjectCalendar,
): string | undefined {
  const calculatedResume = resumeDateAfterStop(stopDate, calendar);
  const importedResume = parseDate(String(readCalculatedField(fields, "RESUME") ?? ""));
  if (importedResume && calculatedResume) {
    return compareDateOnly(importedResume, parseDate(calculatedResume)) > 0
      ? dateOnly(importedResume)
      : calculatedResume;
  }
  return dateOnly(importedResume) ?? calculatedResume;
}

type MppTaskStatus = "Complete" | "Future Task" | "On Schedule" | "Late";

function calculateStatusFromStatusDate(
  task: GanttTask,
  progress: number,
  actualDuration: number,
  minutesPerDay: number,
  statusDate: Date | undefined,
  calendar?: ProjectCalendar,
): MppTaskStatus | undefined {
  if (!statusDate) return undefined;
  if (progress >= 100) return "Complete";
  if (compareDateOnly(task.start, statusDate) > 0) return "Future Task";

  const schedulingCalendar = createSchedulingCalendar(calendar);
  const requiredThrough = schedulingCalendar.getPreviousWorkingDay(statusDate);
  if (compareDateOnly(requiredThrough, task.start) < 0) return "On Schedule";

  const completeThrough = parseDate(completeThroughDate(task, actualDuration, minutesPerDay, calendar));
  if (completeThrough && compareDateOnly(completeThrough, requiredThrough) >= 0) {
    return "On Schedule";
  }
  return "Late";
}

function baselineCostThroughStatusDate(
  baseline: ReturnType<typeof baselineTaskFor> | undefined,
  baselineCost: number,
  statusDate: Date | undefined,
  calendar?: ProjectCalendar,
): number {
  if (!statusDate || !baseline?.baselineStart || !baseline.baselineFinish) return baselineCost;
  if (compareDateOnly(statusDate, baseline.baselineStart) < 0) return 0;
  if (compareDateOnly(statusDate, baseline.baselineFinish) >= 0) return baselineCost;

  const totalMinutes = workingMinutesBetweenDates(
    baseline.baselineStart,
    baseline.baselineFinish,
    calendar,
  );
  if (totalMinutes <= 0) return baselineCost;

  const elapsedMinutes = workingMinutesBetweenDates(
    baseline.baselineStart,
    statusDate,
    calendar,
  );
  return baselineCost * Math.min(1, Math.max(0, elapsedMinutes / totalMinutes));
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "1", "si", "sí"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function roundCalculation(value: number, precision = 6): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function resourceCostPerUse(resource: Resource | undefined): number {
  if (!resource) return 0;
  return toNumber(
    readField(resource as Resource & Record<string, unknown>, "COST_PER_USE"),
    0,
  );
}

function resourceOvertimeRate(resource: Resource | undefined): number {
  if (!resource) return 0;
  return toNumber(
    readField(resource as Resource & Record<string, unknown>, "OVERTIME_RATE"),
    resource.rate ?? 0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCostRateTableName(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const tableIndex = Math.max(0, Math.trunc(value));
    return String.fromCharCode("A".charCodeAt(0) + tableIndex);
  }
  const raw = String(value ?? "A").trim();
  if (!raw) return "A";
  const singleLetter = raw.match(/^[A-E]$/i);
  if (singleLetter) return singleLetter[0].toUpperCase();
  const namedTable = raw.match(/\b([A-E])\b$/i);
  if (namedTable) return namedTable[1].toUpperCase();
  return raw.toUpperCase();
}

function normalizeRateTableKey(key: string): string {
  return normalizeMppFieldId(key).replace(/_/g, "").toUpperCase();
}

function readRateTableValue(
  entry: Record<string, unknown>,
  keys: string[],
): unknown {
  const normalizedKeys = new Set(keys.map(normalizeRateTableKey));
  for (const [key, value] of Object.entries(entry)) {
    if (normalizedKeys.has(normalizeRateTableKey(key))) {
      return value;
    }
  }
  return undefined;
}

function readRateTableNumber(
  entry: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  return toNumber(readRateTableValue(entry, keys), fallback);
}

function readRateTableDate(entry: Record<string, unknown>, keys: string[]): number | undefined {
  const value = readRateTableValue(entry, keys);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return undefined;
}

function resolveCostRateTableEntries(
  tableEntry: Record<string, unknown>,
  fallbackStandardRate: number,
  fallbackOvertimeRate: number,
  fallbackCostPerUse: number,
): ResolvedCostRateTableEntry[] {
  const entriesValue = readRateTableValue(tableEntry, ["entries", "rateEntries", "costRateEntries"]);
  const rawEntries = Array.isArray(entriesValue)
    ? entriesValue.filter(isRecord)
    : [tableEntry];

  return rawEntries
    .map((entry) => ({
      startTime: readRateTableDate(entry, ["effectiveDate", "startDate", "START_DATE"]),
      endTime: readRateTableDate(entry, ["endDate", "END_DATE"]),
      standardRate: readRateTableNumber(entry, ["standardRate", "STANDARD_RATE", "rate"], fallbackStandardRate),
      overtimeRate: readRateTableNumber(entry, ["overtimeRate", "OVERTIME_RATE"], fallbackOvertimeRate),
      costPerUse: readRateTableNumber(entry, ["costPerUse", "COST_PER_USE"], fallbackCostPerUse),
    }))
    .sort((a, b) => (a.startTime ?? Number.NEGATIVE_INFINITY) - (b.startTime ?? Number.NEGATIVE_INFINITY));
}

function selectEffectiveCostRateEntry(
  entries: ResolvedCostRateTableEntry[],
  taskStart: Date | undefined,
): ResolvedCostRateTableEntry {
  if (entries.length === 0) {
    return {
      standardRate: 0,
      overtimeRate: 0,
      costPerUse: 0,
    };
  }
  if (!taskStart || Number.isNaN(taskStart.getTime())) return entries[0];

  const taskTime = taskStart.getTime();
  const eligibleEntries = entries
    .map((entry, index) => ({
      entry,
      index,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }))
    .filter(({ startTime, endTime }) => (
      (startTime === undefined || startTime <= taskTime)
      && (endTime === undefined || taskTime <= endTime)
    ))
    .sort((a, b) => {
      const aStart = a.startTime ?? Number.NEGATIVE_INFINITY;
      const bStart = b.startTime ?? Number.NEGATIVE_INFINITY;
      return bStart - aStart || b.index - a.index;
    });

  return eligibleEntries[0]?.entry ?? entries[0];
}

function readCostRateTableEntry(
  resource: Resource | undefined,
  tableName: string,
): Record<string, unknown> | undefined {
  if (!resource) return undefined;
  const tables = readField(resource as Resource & Record<string, unknown>, "COST_RATE_TABLES")
    ?? readField(resource as Resource & Record<string, unknown>, "RATE_TABLES");
  if (Array.isArray(tables)) {
    return tables.find((entry): entry is Record<string, unknown> => (
      isRecord(entry)
      && normalizeCostRateTableName(
        entry.name
        ?? entry.table
        ?? entry.tableName
        ?? entry.id
        ?? entry.costRateTable
        ?? entry.costRateTableName,
      ) === tableName
    ));
  }
  if (!isRecord(tables)) return undefined;
  for (const [key, value] of Object.entries(tables)) {
    if (normalizeCostRateTableName(key) === tableName) {
      return isRecord(value) ? value : { STANDARD_RATE: value };
    }
  }
  return undefined;
}

function resolveCostRateTable(
  resource: Resource | undefined,
  assignment: Assignment,
  task: GanttTask | undefined,
): ResolvedCostRateTable {
  const selectedTable = normalizeCostRateTableName(
    readField(assignment as Assignment & Record<string, unknown>, "COST_RATE_TABLE")
      ?? readField(assignment as Assignment & Record<string, unknown>, "COST_RATE_TABLE_NAME")
      ?? readField(assignment as Assignment & Record<string, unknown>, "RATE_TABLE")
      ?? "A",
  );
  const baseStandardRate = resource?.rate ?? 0;
  const baseOvertimeRate = resourceOvertimeRate(resource);
  const baseCostPerUse = resourceCostPerUse(resource);
  const rawTableEntry = readCostRateTableEntry(resource, selectedTable);
  if (!rawTableEntry) {
    return {
      name: selectedTable,
      standardRate: baseStandardRate,
      overtimeRate: baseOvertimeRate,
      costPerUse: baseCostPerUse,
      entries: [{
        standardRate: baseStandardRate,
        overtimeRate: baseOvertimeRate,
        costPerUse: baseCostPerUse,
      }],
    };
  }
  const entries = resolveCostRateTableEntries(
    rawTableEntry,
    baseStandardRate,
    baseOvertimeRate,
    baseCostPerUse,
  );
  const tableEntry = selectEffectiveCostRateEntry(entries, task?.start);

  return {
    name: selectedTable,
    standardRate: tableEntry.standardRate,
    overtimeRate: tableEntry.overtimeRate,
    costPerUse: tableEntry.costPerUse,
    entries,
  };
}

function calculateRateBasedWorkCost(
  rateTable: ResolvedCostRateTable,
  task: GanttTask | undefined,
  duration: number,
  effectiveHoursPerDay: number,
  units: number,
  work: number,
  overtimeWork: number,
): { regularCost: number; overtimeCost: number } {
  if (!task?.start || Number.isNaN(task.start.getTime()) || duration <= 0 || work <= 0) {
    return {
      regularCost: Math.max(0, work - overtimeWork) * rateTable.standardRate,
      overtimeCost: overtimeWork * rateTable.overtimeRate,
    };
  }

  const overtimeRatio = Math.max(0, Math.min(1, safeDivide(overtimeWork, work)));
  let regularCost = 0;
  let overtimeCost = 0;
  let remainingDuration = duration;
  for (let dayIndex = 0; remainingDuration > 0; dayIndex += 1) {
    const dayFraction = Math.min(1, remainingDuration);
    const sliceDate = new Date(task.start.getTime() + dayIndex * MS_PER_DAY);
    const entry = selectEffectiveCostRateEntry(rateTable.entries, sliceDate);
    const sliceWork = dayFraction * effectiveHoursPerDay * (units / 100);
    const sliceOvertimeWork = sliceWork * overtimeRatio;
    const sliceRegularWork = Math.max(0, sliceWork - sliceOvertimeWork);
    regularCost += sliceRegularWork * entry.standardRate;
    overtimeCost += sliceOvertimeWork * entry.overtimeRate;
    remainingDuration -= dayFraction;
  }

  return { regularCost, overtimeCost };
}

function taskIgnoresResourceCalendar(task: GanttTask | undefined): boolean {
  if (!task) return false;
  return toBoolean(
    readField(task as GanttTask & Record<string, unknown>, "IGNORE_RESOURCE_CALENDAR"),
    false,
  );
}

function normalizeFixedCostAccrual(value: unknown): "Start" | "End" | "Prorated" {
  const normalized = String(value ?? "Prorated").replace(/[\s_-]+/g, "").toLowerCase();
  if (["start", "beginning", "begin"].includes(normalized)) return "Start";
  if (["end", "finish"].includes(normalized)) return "End";
  return "Prorated";
}

function actualFixedCost(
  fixedCost: number,
  progress: number,
  accrual: "Start" | "End" | "Prorated",
): number {
  if (fixedCost <= 0) return 0;
  if (accrual === "Start") return progress > 0 ? fixedCost : 0;
  if (accrual === "End") return progress >= 100 ? fixedCost : 0;
  return fixedCost * (progress / 100);
}

function assignmentHoursPerDay(
  task: GanttTask | undefined,
  resource: Resource | undefined,
  projectHoursPerDay: number,
): number {
  if (!resource?.calendar || taskIgnoresResourceCalendar(task)) {
    return projectHoursPerDay;
  }
  return getCalendarMinutesPerDay(resource.calendar) / 60;
}

function readAssignmentDate(assignment: Assignment, fieldId: string): Date | undefined {
  return parseDate(
    readField(assignment as Assignment & Record<string, unknown>, fieldId) as Date | string | undefined,
  );
}

function resolveAssignmentSchedule(
  task: GanttTask | undefined,
  assignment: Assignment,
  minutesPerDay: number,
  calendar?: ProjectCalendar,
): AssignmentSchedule {
  const importedStart = readAssignmentDate(assignment, "START")
    ?? readAssignmentDate(assignment, "ASSIGNMENT_START");
  const importedFinish = readAssignmentDate(assignment, "FINISH")
    ?? readAssignmentDate(assignment, "ASSIGNMENT_FINISH");
  const importedDelay = parseDurationDays(
    readField(assignment as Assignment & Record<string, unknown>, "ASSIGNMENT_DELAY"),
    minutesPerDay,
  ) ?? toNumber(
    readField(assignment as Assignment & Record<string, unknown>, "ASSIGNMENT_DELAY"),
    0,
  );
  const start = importedStart ?? task?.start;
  const finish = importedFinish ?? task?.finish;
  const assignmentDelay = importedStart && task?.start
    ? Math.max(0, workingDayVariance(task.start, importedStart, calendar))
    : Math.max(0, importedDelay);
  const workingDuration = start && finish
    ? workingMinutesBetweenDates(start, finish, calendar) / minutesPerDay
    : 0;
  const fallbackDuration = task?.duration ?? 0;
  return {
    start,
    finish,
    assignmentDelay,
    duration: workingDuration > 0 ? workingDuration : fallbackDuration,
  };
}

function calculateAssignmentFinancials(
  task: GanttTask | undefined,
  assignment: Assignment,
  resource: Resource | undefined,
  hoursPerDay: number,
  calendar?: ProjectCalendar,
): AssignmentFinancials {
  const progress = Math.max(0, Math.min(100, task?.percentComplete ?? task?.progress ?? 0));
  const importedUnits = toNumber(assignment.units, 100);
  const effectiveHoursPerDay = assignmentHoursPerDay(task, resource, hoursPerDay);
  const minutesPerDay = effectiveHoursPerDay * 60;
  const schedule = resolveAssignmentSchedule(task, assignment, getCalendarMinutesPerDay(calendar), calendar);
  const duration = schedule.duration;
  const importedWork = parseWorkHours(
    readField(assignment as Assignment & Record<string, unknown>, "WORK"),
    minutesPerDay,
  );
  const calculatedWork = duration * effectiveHoursPerDay * (importedUnits / 100);
  const work = importedWork ?? calculatedWork;
  const units = importedWork !== undefined && duration > 0 && effectiveHoursPerDay > 0
    ? safeDivide(importedWork, duration * effectiveHoursPerDay) * 100
    : importedUnits;
  const importedCost = toNumber(assignment.cost, 0);
  const rateTable = resolveCostRateTable(resource, assignment, task);
  const rate = rateTable.standardRate;
  const costPerUse = rateTable.costPerUse;
  const overtimeRate = rateTable.overtimeRate;
  const importedOvertimeWork = toNumber(
    readField(assignment as Assignment & Record<string, unknown>, "OVERTIME_WORK"),
    0,
  );
  const overtimeWork = Math.max(0, Math.min(work, importedOvertimeWork));
  const actualOvertimeWork = Math.max(0, Math.min(
    overtimeWork,
    toNumber(
      readField(assignment as Assignment & Record<string, unknown>, "ACTUAL_OVERTIME_WORK"),
      overtimeWork * (progress / 100),
    ),
  ));
  const remainingOvertimeWork = Math.max(0, overtimeWork - actualOvertimeWork);
  const { regularCost, overtimeCost } = calculateRateBasedWorkCost(
    rateTable,
    task,
    duration,
    effectiveHoursPerDay,
    units,
    work,
    overtimeWork,
  );
  const calculatedCost = resource?.type === "cost"
    ? rate + costPerUse
    : resource?.type === "material"
      ? rate * units + costPerUse
      : regularCost + overtimeCost + costPerUse;
  const cost = importedCost > 0 ? importedCost : calculatedCost;
  const importedActualWork = parseWorkHours(
    readField(assignment as Assignment & Record<string, unknown>, "ACTUAL_WORK"),
    minutesPerDay,
  );
  const importedRemainingWork = parseWorkHours(
    readField(assignment as Assignment & Record<string, unknown>, "REMAINING_WORK"),
    minutesPerDay,
  );
  const remainingWorkFromImport = importedRemainingWork === undefined
    ? undefined
    : Math.min(work, importedRemainingWork);
  const actualWork = Math.min(
    work,
    importedActualWork
      ?? (remainingWorkFromImport === undefined
        ? work * (progress / 100)
        : Math.max(0, work - remainingWorkFromImport)),
  );
  const remainingWork = remainingWorkFromImport ?? Math.max(0, work - actualWork);
  const actualRatio = work > 0 ? actualWork / work : progress / 100;
  const actualCost = toNumber(
    readField(assignment as Assignment & Record<string, unknown>, "ACTUAL_COST"),
    cost * actualRatio,
  );
  const actualOvertimeCost = actualOvertimeWork * overtimeRate;

  return {
    start: schedule.start,
    finish: schedule.finish,
    assignmentDelay: schedule.assignmentDelay,
    duration,
    units,
    costRateTable: rateTable.name,
    standardRate: rate,
    costPerUse,
    work,
    actualWork,
    remainingWork: Math.max(0, remainingWork),
    cost,
    actualCost,
    remainingCost: Math.max(0, cost - actualCost),
    overtimeWork,
    actualOvertimeWork,
    remainingOvertimeWork,
    overtimeRate,
    overtimeCost,
    actualOvertimeCost,
    remainingOvertimeCost: Math.max(0, overtimeCost - actualOvertimeCost),
  };
}

function dependencyLabel(dep: GanttDependency): string {
  const lag = dep.lag ? `${dep.lag > 0 ? "+" : ""}${dep.lag}d` : "";
  return `${dep.from}${dep.type}${lag}`;
}

function taskUniqueId(task: GanttTask | undefined, fallback: string | number): string | number {
  if (!task) return fallback;
  const uniqueId = readCalculatedField(task.mppFields ?? {}, "UNIQUE_ID");
  return typeof uniqueId === "string" || typeof uniqueId === "number" ? uniqueId : fallback;
}

function write(fields: Record<string, unknown>, fieldId: string, value: unknown): void {
  if (value !== undefined && value !== null && value !== "") {
    fields[fieldId] = value;
  }
}

function writeIfMissing(fields: Record<string, unknown>, fieldId: string, value: unknown): void {
  if (readCalculatedField(fields, fieldId) === undefined) {
    write(fields, fieldId, value);
  }
}

function constraintLabel(type: GanttTask["constraintType"] | undefined): string | undefined {
  switch (type) {
    case "asSoonAsPossible":
      return "As Soon As Possible";
    case "asLateAsPossible":
      return "As Late As Possible";
    case "mustStartOn":
      return "Must Start On";
    case "mustFinishOn":
      return "Must Finish On";
    case "startNoEarlierThan":
      return "Start No Earlier Than";
    case "startNoLaterThan":
      return "Start No Later Than";
    case "finishNoEarlierThan":
      return "Finish No Earlier Than";
    case "finishNoLaterThan":
      return "Finish No Later Than";
    default:
      return undefined;
  }
}

function readField(record: { mppFields?: Record<string, unknown> } & Record<string, unknown>, fieldId: string): unknown {
  const normalized = normalizeMppFieldId(fieldId);
  const direct = record.mppFields?.[fieldId] ?? record[fieldId];
  if (direct !== undefined) return direct;
  for (const [key, value] of Object.entries(record.mppFields ?? {})) {
    if (normalizeMppFieldId(key) === normalized) return value;
  }
  for (const [key, value] of Object.entries(record)) {
    if (normalizeMppFieldId(key) === normalized) return value;
  }
  return undefined;
}

function readCalculatedField(fields: Record<string, unknown>, fieldId: string): unknown {
  const normalized = normalizeMppFieldId(fieldId);
  if (fields[fieldId] !== undefined) return fields[fieldId];
  if (fields[normalized] !== undefined) return fields[normalized];
  const matched = Object.entries(fields).find(([key]) => normalizeMppFieldId(key) === normalized);
  return matched?.[1];
}

function isMppTaskActive(task: GanttTask, calculatedFields?: Record<string, unknown>): boolean {
  const inactive = calculatedFields
    ? readCalculatedField(calculatedFields, "INACTIVE")
    : readField(task as GanttTask & Record<string, unknown>, "INACTIVE");
  if (inactive !== undefined && toBoolean(inactive, false)) return false;
  const active = calculatedFields
    ? readCalculatedField(calculatedFields, "ACTIVE")
    : readField(task as GanttTask & Record<string, unknown>, "ACTIVE");
  return active === undefined ? true : toBoolean(active, true);
}

function buildChildren(tasks: GanttTask[]): Map<string | number, GanttTask[]> {
  const children = new Map<string | number, GanttTask[]>();
  const stack = new Map<number, GanttTask>();
  for (const task of tasks) {
    const parent = stack.get(task.outlineLevel - 1);
    if (parent) {
      const list = children.get(parent.id) ?? [];
      list.push(task);
      children.set(parent.id, list);
    }
    stack.set(task.outlineLevel, task);
    for (const level of [...stack.keys()]) {
      if (level > task.outlineLevel) stack.delete(level);
    }
  }
  return children;
}

function taskSummaryName(task: GanttTask | undefined, tasks: GanttTask[]): string | undefined {
  if (!task) return undefined;
  const stack = new Map<number, GanttTask>();
  for (const candidate of tasks) {
    const parent = stack.get(candidate.outlineLevel - 1);
    if (String(candidate.id) === String(task.id)) {
      return parent?.name;
    }
    stack.set(candidate.outlineLevel, candidate);
    for (const level of [...stack.keys()]) {
      if (level > candidate.outlineLevel) stack.delete(level);
    }
  }
  return undefined;
}

function deriveInitials(name: string | undefined): string | undefined {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return undefined;
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.map((word) => word[0]).join("").toUpperCase();
}

function resourceInitials(resource: Resource | undefined): string | undefined {
  if (!resource) return undefined;
  return String(
    readField(resource as Resource & Record<string, unknown>, "INITIALS")
      ?? deriveInitials(resource.name)
      ?? "",
  ) || undefined;
}

function taskAssignments(task: GanttTask, assignments: Assignment[]): Assignment[] {
  return assignments.filter((assignment) => String(assignment.taskId) === String(task.id));
}

function assignmentLoadKey(assignment: Assignment): string {
  return `${assignment.resourceId}:${String(assignment.taskId)}`;
}

function addDateKey<K>(map: Map<K, Set<string>>, key: K, dateKey: string): void {
  const dates = map.get(key) ?? new Set<string>();
  dates.add(dateKey);
  map.set(key, dates);
}

function parseDateTime(value: unknown): number | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return undefined;
}

function readAvailabilityPeriods(resource: Resource | undefined): Array<Record<string, unknown>> {
  if (!resource) return [];
  const raw = readField(resource as Resource & Record<string, unknown>, "AVAILABILITY_PERIODS")
    ?? readField(resource as Resource & Record<string, unknown>, "RESOURCE_AVAILABILITY")
    ?? readField(resource as Resource & Record<string, unknown>, "AVAILABILITY_TABLE")
    ?? readField(resource as Resource & Record<string, unknown>, "AVAILABILITY");
  if (Array.isArray(raw)) return raw.filter(isRecord);
  return isRecord(raw) ? Object.values(raw).filter(isRecord) : [];
}

function readAvailabilityUnits(period: Record<string, unknown>, fallback: number): number {
  return toNumber(
    readRateTableValue(period, [
      "units",
      "unit",
      "maxUnits",
      "MAX_UNITS",
      "availability",
      "availableUnits",
      "percentage",
      "percent",
    ]),
    fallback,
  );
}

function availabilityForDate(resource: Resource | undefined, day: Date): number {
  const fallback = resource?.availability ?? 100;
  const periods = readAvailabilityPeriods(resource);
  if (periods.length === 0) return fallback;
  const dayStart = startOfUtcDay(day).getTime();
  const matching = periods.find((period) => {
    const start = parseDateTime(
      readRateTableValue(period, ["start", "startDate", "availableFrom", "from", "AVAILABLE_FROM"]),
    );
    const finish = parseDateTime(
      readRateTableValue(period, ["finish", "end", "endDate", "availableTo", "to", "AVAILABLE_TO"]),
    );
    return (start === undefined || startOfUtcDay(new Date(start)).getTime() <= dayStart)
      && (finish === undefined || dayStart <= startOfUtcDay(new Date(finish)).getTime());
  });
  return matching ? readAvailabilityUnits(matching, fallback) : fallback;
}

function availabilityWindow(resource: Resource | undefined): { from?: Date; to?: Date } {
  const starts: Date[] = [];
  const finishes: Date[] = [];
  for (const period of readAvailabilityPeriods(resource)) {
    const start = parseDate(
      readRateTableValue(period, ["start", "startDate", "availableFrom", "from", "AVAILABLE_FROM"]) as Date | string | undefined,
    );
    const finish = parseDate(
      readRateTableValue(period, ["finish", "end", "endDate", "availableTo", "to", "AVAILABLE_TO"]) as Date | string | undefined,
    );
    if (start) starts.push(start);
    if (finish) finishes.push(finish);
  }
  return {
    from: starts.length ? new Date(Math.min(...starts.map((date) => date.getTime()))) : undefined,
    to: finishes.length ? new Date(Math.max(...finishes.map((date) => date.getTime()))) : undefined,
  };
}

function buildResourceLoadIndex(
  tasks: GanttTask[],
  resources: Resource[],
  assignments: Assignment[],
  calendar?: ProjectCalendar,
): ResourceLoadIndex {
  const taskById = new Map(tasks.map((task) => [String(task.id), task]));
  const resourceById = new Map(resources.map((resource) => [resource.uid, resource]));
  const minutesPerDay = getCalendarMinutesPerDay(calendar);
  const buckets = new Map<
    string,
    {
      resourceId: number;
      date: Date;
      totalUnits: number;
      taskIds: Set<string>;
      assignmentKeys: Set<string>;
    }
  >();

  for (const assignment of assignments) {
    const resource = resourceById.get(assignment.resourceId);
    if (!resource || resource.type !== "work") continue;
    const task = taskById.get(String(assignment.taskId));
    if (!task) continue;
    const schedule = resolveAssignmentSchedule(task, assignment, minutesPerDay, calendar);
    if (!schedule.start || !schedule.finish) continue;
    const financials = calculateAssignmentFinancials(
      task,
      assignment,
      resource,
      minutesPerDay / 60,
      calendar,
    );
    const units = financials.units;
    const loadKey = assignmentLoadKey(assignment);
    for (const day of eachDay(schedule.start, schedule.finish)) {
      const bucketKey = `${resource.uid}:${day.toISOString().slice(0, 10)}`;
      const bucket = buckets.get(bucketKey) ?? {
        resourceId: resource.uid,
        date: day,
        totalUnits: 0,
        taskIds: new Set<string>(),
        assignmentKeys: new Set<string>(),
      };
      bucket.totalUnits += units;
      bucket.taskIds.add(String(task.id));
      bucket.assignmentKeys.add(loadKey);
      buckets.set(bucketKey, bucket);
    }
  }

  const index: ResourceLoadIndex = {
    peakByResourceId: new Map<number, number>(),
    loadByResourceDate: new Map<number, Map<string, number>>(),
    availabilityByResourceDate: new Map<number, Map<string, number>>(),
    overallocatedResourceIds: new Set<number>(),
    overallocatedTaskIds: new Set<string>(),
    overallocatedAssignmentKeys: new Set<string>(),
    overallocatedDatesByResourceId: new Map<number, Set<string>>(),
    overallocatedDatesByTaskId: new Map<string, Set<string>>(),
    overallocatedDatesByAssignmentKey: new Map<string, Set<string>>(),
  };

  for (const bucket of buckets.values()) {
    const currentPeak = index.peakByResourceId.get(bucket.resourceId) ?? 0;
    index.peakByResourceId.set(bucket.resourceId, Math.max(currentPeak, bucket.totalUnits));
    const resource = resourceById.get(bucket.resourceId);
    const availability = availabilityForDate(resource, bucket.date);
    const dateKey = bucket.date.toISOString().slice(0, 10);
    const resourceLoad = index.loadByResourceDate.get(bucket.resourceId) ?? new Map<string, number>();
    resourceLoad.set(dateKey, bucket.totalUnits);
    index.loadByResourceDate.set(bucket.resourceId, resourceLoad);
    const resourceAvailability = index.availabilityByResourceDate.get(bucket.resourceId) ?? new Map<string, number>();
    resourceAvailability.set(dateKey, availability);
    index.availabilityByResourceDate.set(bucket.resourceId, resourceAvailability);
    if (bucket.totalUnits <= availability) continue;
    index.overallocatedResourceIds.add(bucket.resourceId);
    addDateKey(index.overallocatedDatesByResourceId, bucket.resourceId, dateKey);
    for (const taskId of bucket.taskIds) {
      index.overallocatedTaskIds.add(taskId);
      addDateKey(index.overallocatedDatesByTaskId, taskId, dateKey);
    }
    for (const key of bucket.assignmentKeys) {
      index.overallocatedAssignmentKeys.add(key);
      addDateKey(index.overallocatedDatesByAssignmentKey, key, dateKey);
    }
  }

  return index;
}

function calculateTaskMetrics(
  task: GanttTask,
  resources: Resource[],
  assignments: Assignment[],
  minutesPerDay: number,
  resourceLoadIndex?: ResourceLoadIndex,
  calendar?: ProjectCalendar,
): TaskMetrics {
  const assigned = taskAssignments(task, assignments);
  const resourceByUid = new Map(resources.map((resource) => [resource.uid, resource]));
  const progress = Math.max(0, Math.min(100, task.percentComplete ?? task.progress ?? 0));
  let work = 0;
  let cost = 0;
  let assignmentActualCost = 0;
  let assignmentActualWork = 0;
  let assignmentRemainingWork = 0;
  let overtimeWork = 0;
  let actualOvertimeWork = 0;
  let remainingOvertimeWork = 0;
  let peak = 0;
  const names: string[] = [];
  const initials: string[] = [];
  const groups: string[] = [];
  const types: string[] = [];
  const assignmentUnits: number[] = [];

  for (const assignment of assigned) {
    const resource = resourceByUid.get(assignment.resourceId);
    const financials = calculateAssignmentFinancials(task, assignment, resource, minutesPerDay / 60, calendar);
    work += financials.work;
    cost += financials.cost;
    assignmentActualCost += financials.actualCost;
    assignmentActualWork += financials.actualWork;
    assignmentRemainingWork += financials.remainingWork;
    overtimeWork += financials.overtimeWork;
    actualOvertimeWork += financials.actualOvertimeWork;
    remainingOvertimeWork += financials.remainingOvertimeWork;
    assignmentUnits.push(financials.units);
    peak = Math.max(peak, financials.units);
    if (resource?.name) {
      names.push(resource.name);
      initials.push(String(resourceInitials(resource)));
    }
    if (resource?.group) groups.push(resource.group);
    if (resource?.type) types.push(resource.type);
  }

  const fixedCost = toNumber(readField(task as GanttTask & Record<string, unknown>, "FIXED_COST"), 0);
  const fixedCostAccrual = normalizeFixedCostAccrual(
    readField(task as GanttTask & Record<string, unknown>, "FIXED_COST_ACCRUAL"),
  );
  cost += fixedCost;
  if (assigned.length === 0) {
    work = parseWorkHours(readField(task as GanttTask & Record<string, unknown>, "WORK"), minutesPerDay)
      ?? toNumber(readField(task as GanttTask & Record<string, unknown>, "WORK"), 0);
    cost = task.cost ?? toNumber(readField(task as GanttTask & Record<string, unknown>, "COST"), fixedCost);
    assignmentActualCost = Math.max(0, cost - fixedCost) * (progress / 100);
  }

  const importedActualWork = parseWorkHours(
    readField(task as GanttTask & Record<string, unknown>, "ACTUAL_WORK"),
    minutesPerDay,
  );
  const calculatedActualWork = assigned.length > 0 ? assignmentActualWork : work * (progress / 100);
  const actualWork = Math.min(work, importedActualWork ?? calculatedActualWork);
  const importedRemainingWork = parseWorkHours(
    readField(task as GanttTask & Record<string, unknown>, "REMAINING_WORK"),
    minutesPerDay,
  );
  const calculatedRemainingWork = assigned.length > 0 ? assignmentRemainingWork : Math.max(0, work - actualWork);
  const remainingWork = importedRemainingWork ?? calculatedRemainingWork;
  if (importedActualWork === undefined && importedRemainingWork !== undefined) {
    work = actualWork + remainingWork;
  }
  const fixedActualCost = actualFixedCost(fixedCost, progress, fixedCostAccrual);
  const actualCost = task.actualCost ?? assignmentActualCost + fixedActualCost;
  return {
    work,
    actualWork,
    remainingWork,
    cost,
    actualCost,
    remainingCost: Math.max(0, cost - actualCost),
    fixedCost,
    fixedCostAccrual,
    actualFixedCost: fixedActualCost,
    overtimeWork,
    actualOvertimeWork,
    remainingOvertimeWork,
    resourceNames: [...new Set(names.length ? names : task.resourceNames ?? [])],
    resourceInitials: [...new Set(initials)],
    resourceGroups: [...new Set(groups)],
    resourceTypes: [...new Set(types)],
    assignmentUnits,
    peak,
    overallocated: resourceLoadIndex?.overallocatedTaskIds.has(String(task.id)) ?? peak > 100,
  };
}

function baselineTaskFor(task: GanttTask, baselines: Baseline[], index = 0) {
  return baselines[index]?.tasks.find((baselineTask) => String(baselineTask.taskId) === String(task.id));
}

function writeBaselineFields(
  fields: Record<string, unknown>,
  prefix: string,
  baseline: ReturnType<typeof baselineTaskFor> | undefined,
  fallback: {
    start?: Date;
    finish?: Date;
    duration?: number;
    work?: number;
    cost?: number;
    budgetWork?: number;
    budgetCost?: number;
  } = {},
): void {
  const fieldPrefix = prefix ? `${prefix}_` : "BASELINE_";
  write(fields, `${fieldPrefix}START`, dateIso(baseline?.baselineStart ?? fallback.start));
  write(fields, `${fieldPrefix}FINISH`, dateIso(baseline?.baselineFinish ?? fallback.finish));
  write(fields, `${fieldPrefix}DURATION`, baseline?.baselineDuration ?? fallback.duration);
  write(fields, `${fieldPrefix}WORK`, baseline?.baselineWork ?? fallback.work);
  write(fields, `${fieldPrefix}COST`, baseline?.baselineCost ?? fallback.cost);
  write(fields, `${fieldPrefix}BUDGET_WORK`, baseline?.baselineBudgetWork ?? fallback.budgetWork);
  write(fields, `${fieldPrefix}BUDGET_COST`, baseline?.baselineBudgetCost ?? fallback.budgetCost);
}

function writeBaselineEstimatedFields(
  fields: Record<string, unknown>,
  index: number,
  baseline: ReturnType<typeof baselineTaskFor> | undefined,
  fallback: {
    start?: Date;
    finish?: Date;
    duration?: number;
  } = {},
): void {
  const fieldPrefix = `BASELINE_${index}_ESTIMATED_`;
  write(fields, `${fieldPrefix}START`, dateIso(baseline?.baselineStart ?? fallback.start));
  write(fields, `${fieldPrefix}FINISH`, dateIso(baseline?.baselineFinish ?? fallback.finish));
  write(fields, `${fieldPrefix}DURATION`, baseline?.baselineDuration ?? fallback.duration);
}

function readCalculatedDate(fields: Record<string, unknown>, fieldId: string): Date | undefined {
  const value = readCalculatedField(fields, fieldId);
  return value instanceof Date || typeof value === "string" ? parseDate(value) : undefined;
}

function applyImportedBaselineVariances(
  fields: Record<string, unknown>,
  calendar?: ProjectCalendar,
): void {
  const start = readCalculatedDate(fields, "START");
  const finish = readCalculatedDate(fields, "FINISH");
  const baselineStart = readCalculatedDate(fields, "BASELINE_START");
  const baselineFinish = readCalculatedDate(fields, "BASELINE_FINISH");
  if (baselineStart && start) {
    write(fields, "START_VARIANCE", workingDayVariance(baselineStart, start, calendar));
  }
  if (baselineFinish && finish) {
    write(fields, "FINISH_VARIANCE", workingDayVariance(baselineFinish, finish, calendar));
  }

  const baselineWork = readCalculatedField(fields, "BASELINE_WORK");
  if (baselineWork !== undefined) {
    write(fields, "WORK_VARIANCE", toNumber(readCalculatedField(fields, "WORK"), 0) - toNumber(baselineWork, 0));
  }
  const baselineCost = readCalculatedField(fields, "BASELINE_COST");
  if (baselineCost !== undefined) {
    write(fields, "COST_VARIANCE", toNumber(readCalculatedField(fields, "COST"), 0) - toNumber(baselineCost, 0));
  }
  const baselineDuration = readCalculatedField(fields, "BASELINE_DURATION");
  if (baselineDuration !== undefined && readCalculatedField(fields, "DURATION") !== undefined) {
    write(fields, "DURATION_VARIANCE", toNumber(readCalculatedField(fields, "DURATION"), 0) - toNumber(baselineDuration, 0));
  }
}

function budgetValueFromFields(
  fields: Record<string, unknown>,
  budgetFieldId: "BUDGET_WORK" | "BUDGET_COST",
): number | undefined {
  const baselineFieldId = budgetFieldId === "BUDGET_WORK" ? "BASELINE_BUDGET_WORK" : "BASELINE_BUDGET_COST";
  const baselineValue = readCalculatedField(fields, baselineFieldId);
  if (baselineValue !== undefined) return toNumber(baselineValue, 0);
  const budgetValue = readCalculatedField(fields, budgetFieldId);
  return budgetValue !== undefined ? toNumber(budgetValue, 0) : undefined;
}

function sumAssignmentBudgetValues(
  assignments: Assignment[],
  budgetFieldId: "BUDGET_WORK" | "BUDGET_COST",
): number | undefined {
  let hasBudgetValue = false;
  const total = assignments.reduce((sum, assignment) => {
    const value = budgetValueFromFields(assignment.mppFields ?? {}, budgetFieldId);
    if (value === undefined) return sum;
    hasBudgetValue = true;
    return sum + value;
  }, 0);
  return hasBudgetValue ? total : undefined;
}

function baselineFieldId(index: number | undefined, suffix: string): string {
  return index === undefined ? `BASELINE_${suffix}` : `BASELINE_${index}_${suffix}`;
}

function assignmentBaselineValue(
  assignment: Assignment,
  fieldId: string,
  fallbackFieldId?: string,
): unknown {
  const fields = assignment.mppFields ?? {};
  return readCalculatedField(fields, fieldId)
    ?? (fallbackFieldId ? readCalculatedField(fields, fallbackFieldId) : undefined);
}

function sumAssignmentBaselineNumber(
  assignments: Assignment[],
  fieldId: string,
  fallbackFieldId?: string,
): number | undefined {
  let hasValue = false;
  const total = assignments.reduce((sum, assignment) => {
    const value = assignmentBaselineValue(assignment, fieldId, fallbackFieldId);
    if (value === undefined) return sum;
    hasValue = true;
    return sum + toNumber(value, 0);
  }, 0);
  return hasValue ? total : undefined;
}

function aggregateAssignmentBaselineDate(
  assignments: Assignment[],
  fieldId: string,
  pick: "min" | "max",
  fallbackFieldId?: string,
): Date | undefined {
  const dates = assignments
    .map((assignment) => {
      const value = assignmentBaselineValue(assignment, fieldId, fallbackFieldId);
      return value instanceof Date || typeof value === "string" ? parseDate(value) : undefined;
    })
    .filter((date): date is Date => Boolean(date));
  if (dates.length === 0) return undefined;
  const time = pick === "min"
    ? Math.min(...dates.map((date) => date.getTime()))
    : Math.max(...dates.map((date) => date.getTime()));
  return new Date(time);
}

function materializeResourceBaselineFields(
  fields: Record<string, unknown>,
  assignments: Assignment[],
): void {
  const indexes: Array<number | undefined> = [undefined, ...Array.from({ length: 11 }, (_, index) => index)];
  for (const index of indexes) {
    const startField = baselineFieldId(index, "START");
    const finishField = baselineFieldId(index, "FINISH");
    const workField = baselineFieldId(index, "WORK");
    const costField = baselineFieldId(index, "COST");
    const budgetWorkField = baselineFieldId(index, "BUDGET_WORK");
    const budgetCostField = baselineFieldId(index, "BUDGET_COST");
    const fallback = index === 0 ? {
      start: baselineFieldId(undefined, "START"),
      finish: baselineFieldId(undefined, "FINISH"),
      work: baselineFieldId(undefined, "WORK"),
      cost: baselineFieldId(undefined, "COST"),
      budgetWork: baselineFieldId(undefined, "BUDGET_WORK"),
      budgetCost: baselineFieldId(undefined, "BUDGET_COST"),
    } : undefined;

    writeIfMissing(fields, startField, dateIso(aggregateAssignmentBaselineDate(assignments, startField, "min", fallback?.start)));
    writeIfMissing(fields, finishField, dateIso(aggregateAssignmentBaselineDate(assignments, finishField, "max", fallback?.finish)));
    writeIfMissing(fields, workField, sumAssignmentBaselineNumber(assignments, workField, fallback?.work));
    writeIfMissing(fields, costField, sumAssignmentBaselineNumber(assignments, costField, fallback?.cost));
    writeIfMissing(fields, budgetWorkField, sumAssignmentBaselineNumber(assignments, budgetWorkField, fallback?.budgetWork));
    writeIfMissing(fields, budgetCostField, sumAssignmentBaselineNumber(assignments, budgetCostField, fallback?.budgetCost));

    if (index !== undefined) {
      const estimatedStartField = baselineFieldId(index, "ESTIMATED_START");
      const estimatedFinishField = baselineFieldId(index, "ESTIMATED_FINISH");
      const estimatedDurationField = baselineFieldId(index, "ESTIMATED_DURATION");
      const estimatedStart = aggregateAssignmentBaselineDate(assignments, estimatedStartField, "min");
      const estimatedFinish = aggregateAssignmentBaselineDate(assignments, estimatedFinishField, "max");
      writeIfMissing(fields, estimatedStartField, dateIso(estimatedStart));
      writeIfMissing(fields, estimatedFinishField, dateIso(estimatedFinish));
      writeIfMissing(
        fields,
        estimatedDurationField,
        estimatedStart && estimatedFinish
          ? durationDays(estimatedStart, estimatedFinish)
          : sumAssignmentBaselineNumber(assignments, estimatedDurationField),
      );
    }
  }
}

function materializeBudgetFields(
  fields: Record<string, unknown>,
  fallbackBudgetWork?: number,
  fallbackBudgetCost?: number,
): void {
  write(fields, "BUDGET_WORK", budgetValueFromFields(fields, "BUDGET_WORK") ?? fallbackBudgetWork);
  write(fields, "BUDGET_COST", budgetValueFromFields(fields, "BUDGET_COST") ?? fallbackBudgetCost);
}

function copyAssignmentBaselineFromTask(
  fields: Record<string, unknown>,
  taskFields: Record<string, unknown> | undefined,
  financials: AssignmentFinancials,
): void {
  if (!taskFields) return;
  const taskWork = toNumber(readCalculatedField(taskFields, "WORK"), financials.work);
  const share = taskWork > 0 ? safeDivide(financials.work, taskWork) : 1;
  const indexes: Array<number | undefined> = [undefined, ...Array.from({ length: 11 }, (_, index) => index)];

  for (const index of indexes) {
    const startField = baselineFieldId(index, "START");
    const finishField = baselineFieldId(index, "FINISH");
    const durationField = baselineFieldId(index, "DURATION");
    const workField = baselineFieldId(index, "WORK");
    const costField = baselineFieldId(index, "COST");
    const budgetWorkField = baselineFieldId(index, "BUDGET_WORK");
    const budgetCostField = baselineFieldId(index, "BUDGET_COST");
    const fallback = index === 0 ? {
      start: baselineFieldId(undefined, "START"),
      finish: baselineFieldId(undefined, "FINISH"),
      duration: baselineFieldId(undefined, "DURATION"),
      work: baselineFieldId(undefined, "WORK"),
      cost: baselineFieldId(undefined, "COST"),
      budgetWork: baselineFieldId(undefined, "BUDGET_WORK"),
      budgetCost: baselineFieldId(undefined, "BUDGET_COST"),
    } : undefined;

    writeIfMissing(fields, startField, readCalculatedField(taskFields, startField) ?? (fallback?.start ? readCalculatedField(taskFields, fallback.start) : undefined));
    writeIfMissing(fields, finishField, readCalculatedField(taskFields, finishField) ?? (fallback?.finish ? readCalculatedField(taskFields, fallback.finish) : undefined));
    writeIfMissing(fields, durationField, readCalculatedField(taskFields, durationField) ?? (fallback?.duration ? readCalculatedField(taskFields, fallback.duration) : undefined));

    const work = readCalculatedField(taskFields, workField) ?? (fallback?.work ? readCalculatedField(taskFields, fallback.work) : undefined);
    const cost = readCalculatedField(taskFields, costField) ?? (fallback?.cost ? readCalculatedField(taskFields, fallback.cost) : undefined);
    const budgetWork = readCalculatedField(taskFields, budgetWorkField) ?? (fallback?.budgetWork ? readCalculatedField(taskFields, fallback.budgetWork) : undefined);
    const budgetCost = readCalculatedField(taskFields, budgetCostField) ?? (fallback?.budgetCost ? readCalculatedField(taskFields, fallback.budgetCost) : undefined);
    writeIfMissing(fields, workField, work === undefined ? undefined : toNumber(work, 0) * share);
    writeIfMissing(fields, costField, cost === undefined ? undefined : toNumber(cost, 0) * share);
    writeIfMissing(fields, budgetWorkField, budgetWork === undefined ? undefined : toNumber(budgetWork, 0) * share);
    writeIfMissing(fields, budgetCostField, budgetCost === undefined ? undefined : toNumber(budgetCost, 0) * share);

    const estimatedPrefix = index === undefined ? "BASELINE_0_ESTIMATED" : `BASELINE_${index}_ESTIMATED`;
    writeIfMissing(fields, `${estimatedPrefix}_START`, readCalculatedField(taskFields, `${estimatedPrefix}_START`));
    writeIfMissing(fields, `${estimatedPrefix}_FINISH`, readCalculatedField(taskFields, `${estimatedPrefix}_FINISH`));
    writeIfMissing(fields, `${estimatedPrefix}_DURATION`, readCalculatedField(taskFields, `${estimatedPrefix}_DURATION`));
  }
}

function actualStartForWork(
  fields: Record<string, unknown>,
  actualWork: number,
  start: Date | undefined,
): Date | undefined {
  return readCalculatedDate(fields, "ACTUAL_START") ?? (actualWork > 0 ? start : undefined);
}

function actualFinishForWork(
  fields: Record<string, unknown>,
  work: number,
  remainingWork: number,
  finish: Date | undefined,
): Date | undefined {
  return readCalculatedDate(fields, "ACTUAL_FINISH") ?? (work > 0 && remainingWork <= 0 ? finish : undefined);
}

function earnedValueProgressForTask(task: GanttTask | undefined): number {
  if (!task) return 0;
  const fields = task.mppFields ?? {};
  const method = String(readCalculatedField(fields, "EARNED_VALUE_METHOD") ?? "Percent Complete").toLowerCase();
  const progress = method.includes("physical")
    ? toNumber(readCalculatedField(fields, "PHYSICAL_PERCENT_COMPLETE"), task.percentComplete ?? task.progress ?? 0)
    : toNumber(readCalculatedField(fields, "PERCENT_COMPLETE"), task.percentComplete ?? task.progress ?? 0);
  return Math.max(0, Math.min(100, progress));
}

function earnedValueTotalsFromFields(
  fields: Record<string, unknown>,
  cost: number,
  actualCost: number,
  progress: number,
): EarnedValueTotals | undefined {
  const baselineCostValue = readCalculatedField(fields, "BASELINE_COST");
  if (baselineCostValue === undefined) return undefined;

  const baselineCost = toNumber(baselineCostValue, cost);
  return {
    baselineCost,
    cost,
    bcws: baselineCost,
    bcwp: baselineCost * (progress / 100),
    acwp: actualCost,
  };
}

function mergeEarnedValueTotals(
  left: EarnedValueTotals | undefined,
  right: EarnedValueTotals | undefined,
): EarnedValueTotals | undefined {
  if (!right) return left;
  if (!left) return { ...right };
  return {
    baselineCost: left.baselineCost + right.baselineCost,
    cost: left.cost + right.cost,
    bcws: left.bcws + right.bcws,
    bcwp: left.bcwp + right.bcwp,
    acwp: left.acwp + right.acwp,
  };
}

function writeEarnedValueTotals(
  fields: Record<string, unknown>,
  totals: EarnedValueTotals | undefined,
): void {
  if (!totals) return;
  const sv = totals.bcwp - totals.bcws;
  const cv = totals.bcwp - totals.acwp;
  const spi = safeDivide(totals.bcwp, totals.bcws);
  const cpi = safeDivide(totals.bcwp, totals.acwp);
  const eac = cpi > 0 ? totals.cost / cpi : totals.cost;
  const vac = totals.baselineCost - eac;
  const tcpi = safeDivide(totals.baselineCost - totals.bcwp, totals.baselineCost - totals.acwp);
  write(fields, "BCWS", totals.bcws);
  write(fields, "BCWP", totals.bcwp);
  write(fields, "ACWP", totals.acwp);
  write(fields, "SV", sv);
  write(fields, "SV_PERCENT", safeDivide(sv, totals.bcws) * 100);
  write(fields, "CV", cv);
  write(fields, "CV_PERCENT", safeDivide(cv, totals.bcwp) * 100);
  write(fields, "SPI", spi);
  write(fields, "CPI", cpi);
  write(fields, "EAC", eac);
  write(fields, "VAC", vac);
  write(fields, "TCPI", tcpi);
}

function customFieldReferenceMap(
  customDefinitions: MppCustomFieldDefinition[],
  recordType: MppRecordType,
): Map<string, string> {
  const references = new Map<string, string>();
  for (const definition of customDefinitions) {
    if (definition.recordType !== recordType) continue;
    const fieldId = normalizeMppFieldId(definition.fieldId);
    references.set(fieldId, fieldId);
    if (definition.alias) {
      references.set(normalizeMppFieldId(definition.alias), fieldId);
    }
  }
  return references;
}

function resolveCustomFieldReference(reference: string, referenceMap: Map<string, string>): string {
  const normalized = normalizeMppFieldId(reference);
  return referenceMap.get(normalized) ?? normalized;
}

function extractResolvedFormulaDependencies(
  formula: string | undefined,
  referenceMap: Map<string, string>,
): string[] | undefined {
  if (!formula) return undefined;
  return extractFormulaDependencies(formula).map((dependency) => resolveCustomFieldReference(dependency, referenceMap));
}

function enrichColumns<T extends MppRecordColumn>(
  columns: T[],
  customDefinitions: MppCustomFieldDefinition[],
  calculatedAt: string,
): T[] {
  const customByField = new Map(
    customDefinitions.map((definition) => [
      `${definition.recordType}:${normalizeMppFieldId(definition.fieldId)}`,
      definition,
    ]),
  );
  return columns.map((column) => {
    const normalizedFieldId = normalizeMppFieldId(column.fieldId);
    const recordType = column.recordType ?? "task";
    const referenceMap = customFieldReferenceMap(customDefinitions, recordType);
    const custom = customByField.get(`${recordType}:${normalizedFieldId}`);
    const catalogSpec = getMppCalculatedFieldSpec(normalizedFieldId, recordType);
    const formula = custom?.formula ?? column.calculationSpec?.formula;
    const isFormula = Boolean(formula);
    const isCalculated = isFormula || (catalogSpec?.isCalculated ?? column.calculationSpec?.isCalculated ?? false);
    const isEditableWhenCalculated = isFormula
      ? false
      : catalogSpec?.isEditableWhenCalculated
        ?? column.calculationSpec?.isEditableWhenCalculated
        ?? column.isEditable;
    const sourceOfTruth = isFormula
      ? "customFormula"
      : catalogSpec?.sourceOfTruth ?? column.calculationSpec?.sourceOfTruth ?? (column.isEditable ? "user" : "mppImport");
    const isEditableInput = !isCalculated && catalogSpec?.sourceOfTruth === "user";
    const next: T = {
      ...column,
      alias: column.alias ?? custom?.alias,
      isEditable: !isFormula && (isCalculated ? isEditableWhenCalculated : isEditableInput || column.isEditable),
      calculationSpec: {
        calculationKind: isFormula
          ? custom?.unsupportedFormula
            ? "unsupportedFormula"
            : "customFormula"
          : catalogSpec?.calculationKind ?? column.calculationSpec?.calculationKind ?? "input",
        formula,
        dependencies: formula
          ? extractResolvedFormulaDependencies(formula, referenceMap)
          : catalogSpec?.dependencies ?? column.calculationSpec?.dependencies,
        rollupType: column.calculationSpec?.rollupType,
        isCalculated,
        isEditableWhenCalculated,
        lastCalculatedAt: calculatedAt,
        sourceOfTruth,
        unsupportedReason: custom?.unsupportedFormula
          ? custom.unsupportedReason ?? "Fórmula importada no soportada por el motor actual."
          : undefined,
      },
    };
    return next;
  });
}

function applyCustomFormulas(
  fields: Record<string, unknown>,
  definitions: MppCustomFieldDefinition[],
  calendar?: ProjectCalendar,
): Record<string, unknown> {
  const next = { ...fields };
  const referenceMap = customFieldReferenceMap(definitions, definitions[0]?.recordType ?? "task");
  const formulaDefinitions = new Map(
    definitions
      .filter((definition) => definition.formula)
      .map((definition) => [normalizeMppFieldId(definition.fieldId), definition]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const evaluateDefinition = (definition: MppCustomFieldDefinition): boolean => {
    const fieldId = normalizeMppFieldId(definition.fieldId);
    if (visited.has(fieldId)) return !next[`${fieldId}_FORMULA_ERROR`];
    if (definition.unsupportedFormula) {
      next[`${fieldId}_FORMULA_ERROR`] = definition.unsupportedReason ?? "Fórmula importada no soportada por el motor actual.";
      visited.add(fieldId);
      return false;
    }
    if (!definition.formula) return true;
    if (visiting.has(fieldId)) {
      next[`${fieldId}_FORMULA_ERROR`] = `Ciclo de fórmula detectado en ${fieldId}.`;
      visited.add(fieldId);
      return false;
    }
    visiting.add(fieldId);
    for (const dependency of extractFormulaDependencies(definition.formula)) {
      const dependencyId = resolveCustomFieldReference(dependency, referenceMap);
      const dependencyDefinition = formulaDefinitions.get(dependencyId);
      if (dependencyDefinition && !evaluateDefinition(dependencyDefinition)) {
        next[`${fieldId}_FORMULA_ERROR`] = `No se pudo calcular ${fieldId} porque depende de ${dependencyId}.`;
        visiting.delete(fieldId);
        visited.add(fieldId);
        return false;
      }
    }
    const result = evaluateCustomFormula(definition.formula, {
      getFieldValue: (fieldId) => readCalculatedField(next, resolveCustomFieldReference(fieldId, referenceMap)),
      calendar,
    });
    if (result.error) {
      next[`${fieldId}_FORMULA_ERROR`] = result.error;
    } else {
      next[fieldId] = result.value instanceof Date ? result.value.toISOString() : result.value;
    }
    visiting.delete(fieldId);
    visited.add(fieldId);
    return !result.error;
  };

  for (const definition of definitions) {
    if (definition.formula) evaluateDefinition(definition);
  }
  return next;
}

function isBlankLookupValue(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === "";
}

function customLookupMatches(value: unknown, lookupValues: Array<string | number | boolean>): boolean {
  const valueAsNumber = toNumber(value, Number.NaN);
  const valueAsString = String(value).trim().toLowerCase();
  return lookupValues.some((lookupValue) => {
    if (lookupValue === value) return true;
    if (typeof lookupValue === "number" && Number.isFinite(valueAsNumber)) {
      return lookupValue === valueAsNumber;
    }
    if (typeof lookupValue === "boolean") {
      return lookupValue === toBoolean(value, !lookupValue);
    }
    return String(lookupValue).trim().toLowerCase() === valueAsString;
  });
}

function applyCustomLookupValidation(
  fields: Record<string, unknown>,
  definitions: MppCustomFieldDefinition[],
): Record<string, unknown> {
  const next = { ...fields };
  for (const definition of definitions) {
    if (!definition.lookupValues?.length) continue;
    const fieldId = normalizeMppFieldId(definition.fieldId);
    const errorField = `${fieldId}_LOOKUP_ERROR`;
    const value = readCalculatedField(next, fieldId);
    if (isBlankLookupValue(value) || customLookupMatches(value, definition.lookupValues)) {
      delete next[errorField];
      continue;
    }
    next[errorField] = `Valor "${String(value)}" no existe en la lista de valores permitidos para ${fieldId}.`;
  }
  return next;
}

function effectiveFinishForDuration(
  task: GanttTask,
  effectiveDuration: number,
  minutesPerDay: number,
  calendar?: ProjectCalendar,
): Date {
  const finish = createSchedulingCalendar(calendar).addDuration(task.start, effectiveDuration * minutesPerDay);
  if (effectiveDuration > 0 && Number.isInteger(effectiveDuration)) {
    finish.setUTCHours(
      task.finish.getUTCHours(),
      task.finish.getUTCMinutes(),
      task.finish.getUTCSeconds(),
      task.finish.getUTCMilliseconds(),
    );
  }
  return finish;
}

function subtractLevelingDelay(
  date: Date,
  delayDays: number,
  minutesPerDay: number,
  calendar?: ProjectCalendar,
): Date {
  if (delayDays <= 0) return date;
  return createSchedulingCalendar(calendar).subtractLag(date, delayDays * minutesPerDay);
}

function calculateTaskFields(
  task: GanttTask,
  tasks: GanttTask[],
  resources: Resource[],
  assignments: Assignment[],
  baselines: Baseline[],
  children: Map<string | number, GanttTask[]>,
  minutesPerDay: number,
  customDefinitions: MppCustomFieldDefinition[],
  calendar?: ProjectCalendar,
  resourceLoadIndex?: ResourceLoadIndex,
  statusDate?: Date,
): GanttTask {
  const fields: Record<string, unknown> = { ...(task.mppFields ?? {}) };
  const importedActualDuration = parseDurationDays(readCalculatedField(fields, "ACTUAL_DURATION"), minutesPerDay);
  const importedRemainingDuration = parseDurationDays(readCalculatedField(fields, "REMAINING_DURATION"), minutesPerDay);
  const reportedProgress = Math.max(0, Math.min(100, task.percentComplete ?? task.progress ?? 0));
  const reportedActualDuration = task.duration * (reportedProgress / 100);
  const actualDuration = importedActualDuration ?? reportedActualDuration;
  const remainingDurationInput = importedRemainingDuration === undefined
    ? undefined
    : Math.max(0, importedRemainingDuration);
  const effectiveDuration = remainingDurationInput !== undefined
    ? actualDuration + remainingDurationInput
    : importedActualDuration === undefined
      ? task.duration
      : Math.max(task.duration, actualDuration);
  const progress = effectiveDuration > 0
    ? Math.max(0, Math.min(100, safeDivide(actualDuration, effectiveDuration) * 100))
    : reportedProgress;
  const effectiveFinish = effectiveDuration !== task.duration
    ? effectiveFinishForDuration(task, effectiveDuration, minutesPerDay, calendar)
    : task.finish;
  const taskForCalculations = {
    ...task,
    finish: effectiveFinish,
    duration: effectiveDuration,
    progress,
    percentComplete: progress,
  };
  const tasksForCalculations = tasks.map((candidate) => (
    String(candidate.id) === String(task.id) ? taskForCalculations : candidate
  ));
  const physicalProgress = Math.max(0, Math.min(100, toNumber(fields.PHYSICAL_PERCENT_COMPLETE, progress)));
  const earnedValueMethod = String(fields.EARNED_VALUE_METHOD ?? "Percent Complete");
  const earnedValueProgress = earnedValueMethod.toLowerCase().includes("physical")
    ? physicalProgress
    : progress;
  const metrics = calculateTaskMetrics(taskForCalculations, resources, assignments, minutesPerDay, resourceLoadIndex, calendar);
  const taskIsActive = isMppTaskActive(taskForCalculations, fields);
  const activeTaskIds = new Set(
    tasksForCalculations
      .filter((candidate) => String(candidate.id) === String(taskForCalculations.id) ? taskIsActive : isMppTaskActive(candidate))
      .map((candidate) => candidate.id),
  );
  const successors = taskIsActive
    ? tasksForCalculations.flatMap((candidate) => candidate.dependencies.filter((dep) => (
        String(dep.from) === String(task.id) && activeTaskIds.has(dep.from) && activeTaskIds.has(dep.to)
      )))
    : [];
  const predecessors = taskIsActive
    ? taskForCalculations.dependencies.filter((dep) => activeTaskIds.has(dep.from) && activeTaskIds.has(dep.to))
    : [];
  const baseline = baselineTaskFor(taskForCalculations, baselines, 0);
  const baselineCost = baseline?.baselineCost ?? toNumber(fields.BASELINE_COST, metrics.cost);
  const baselineDuration = baseline?.baselineDuration ?? toNumber(fields.BASELINE_DURATION, taskForCalculations.baselineDuration ?? taskForCalculations.duration);
  const baselineWork = baseline?.baselineWork ?? toNumber(fields.BASELINE_WORK, metrics.work);
  const baselineBudgetWork = baseline?.baselineBudgetWork ?? toNumber(fields.BASELINE_BUDGET_WORK, baselineWork);
  const baselineBudgetCost = baseline?.baselineBudgetCost ?? toNumber(fields.BASELINE_BUDGET_COST, baselineCost);
  const startVariance = workingDayVariance(baseline?.baselineStart, taskForCalculations.start, calendar);
  const finishVariance = workingDayVariance(baseline?.baselineFinish, taskForCalculations.finish, calendar);
  const deadlineVariance = taskForCalculations.deadline ? durationDays(taskForCalculations.deadline, taskForCalculations.finish) - 1 : 0;
  const importedActualStart = parseDate(String(readCalculatedField(fields, "ACTUAL_START") ?? ""));
  const importedActualFinish = parseDate(String(readCalculatedField(fields, "ACTUAL_FINISH") ?? ""));
  const remainingDuration = remainingDurationInput ?? Math.max(0, taskForCalculations.duration - actualDuration);
  const status = calculateStatusFromStatusDate(taskForCalculations, progress, actualDuration, minutesPerDay, statusDate, calendar);
  const completeThrough = completeThroughDate(taskForCalculations, actualDuration, minutesPerDay, calendar);
  const stop = progress > 0 && progress < 100 ? completeThrough : progress >= 100 ? dateOnly(taskForCalculations.finish) : undefined;
  const durationVariance = taskForCalculations.duration - baselineDuration;
  const totalSlackDays = Math.round(toNumber(taskForCalculations.totalFloat, 0) / minutesPerDay);
  const deadlineSlackDays = deadlineVariance > 0 ? -deadlineVariance : totalSlackDays;
  const effectiveTotalSlackDays = Math.min(totalSlackDays, deadlineSlackDays);
  const hasExplicitTotalSlack = taskForCalculations.totalFloat !== undefined && taskForCalculations.totalFloat !== null;
  const calculatedCritical = Boolean(
    taskForCalculations.isCritical
    || deadlineVariance > 0
    || (hasExplicitTotalSlack && effectiveTotalSlackDays <= 0),
  );
  const freeSlackDays = successors.length === 0
    ? effectiveTotalSlackDays
    : Math.min(...successors.map((dep) => {
        const successor = tasksForCalculations.find((candidate) => String(candidate.id) === String(dep.to));
        return successor ? durationDays(taskForCalculations.finish, successor.start) - 1 - (dep.lag ?? 0) : effectiveTotalSlackDays;
      }));
  const bcws = baselineCostThroughStatusDate(baseline, baselineCost, statusDate, calendar);
  const bcwp = baselineCost * (earnedValueProgress / 100);
  const acwp = metrics.actualCost;
  const sv = bcwp - bcws;
  const cv = bcwp - acwp;
  const spi = safeDivide(bcwp, bcws);
  const cpi = safeDivide(bcwp, acwp);
  const eac = cpi > 0 ? metrics.cost / cpi : metrics.cost;
  const vac = baselineCost - eac;
  const tcpi = safeDivide(baselineCost - bcwp, baselineCost - acwp);
  const levelingDelay = parseDurationDays(readCalculatedField(fields, "LEVELING_DELAY"), minutesPerDay)
    ?? toNumber(readCalculatedField(fields, "LEVELING_DELAY"), 0);
  const preleveledStart = parseDate(readCalculatedField(fields, "PRELEVELED_START") as Date | string | undefined)
    ?? subtractLevelingDelay(taskForCalculations.start, levelingDelay, minutesPerDay, calendar);
  const preleveledFinish = parseDate(readCalculatedField(fields, "PRELEVELED_FINISH") as Date | string | undefined)
    ?? subtractLevelingDelay(taskForCalculations.finish, levelingDelay, minutesPerDay, calendar);

  write(fields, "ID", taskForCalculations.id);
  writeIfMissing(fields, "UNIQUE_ID", taskForCalculations.id);
  write(fields, "START", dateIso(taskForCalculations.start));
  write(fields, "FINISH", dateIso(taskForCalculations.finish));
  write(fields, "DURATION", taskForCalculations.duration);
  write(fields, "SCHEDULED_START", dateIso(taskForCalculations.start));
  write(fields, "SCHEDULED_FINISH", dateIso(taskForCalculations.finish));
  write(fields, "SCHEDULED_DURATION", taskForCalculations.duration);
  write(fields, "CONSTRAINT_TYPE", constraintLabel(taskForCalculations.constraintType) ?? fields.CONSTRAINT_TYPE ?? readField(taskForCalculations as GanttTask & Record<string, unknown>, "ConstraintType") ?? "As Soon As Possible");
  write(fields, "CONSTRAINT_DATE", dateIso(taskForCalculations.constraintDate) ?? fields.CONSTRAINT_DATE ?? readField(taskForCalculations as GanttTask & Record<string, unknown>, "ConstraintDate"));
  write(fields, "DEADLINE", dateIso(taskForCalculations.deadline) ?? fields.DEADLINE);
  write(fields, "TASK_CALENDAR", fields.TASK_CALENDAR ?? "Project Calendar");
  write(fields, "IGNORE_RESOURCE_CALENDAR", taskIgnoresResourceCalendar(taskForCalculations));
  write(fields, "LEVELING_DELAY", levelingDelay);
  write(fields, "PRELEVELED_START", dateIso(preleveledStart));
  write(fields, "PRELEVELED_FINISH", dateIso(preleveledFinish));
  write(fields, "EARLY_START", dateIso(taskForCalculations.earlyStart ?? taskForCalculations.start));
  write(fields, "EARLY_FINISH", dateIso(taskForCalculations.earlyFinish ?? taskForCalculations.finish));
  write(fields, "LATE_START", dateIso(taskForCalculations.lateStart));
  write(fields, "LATE_FINISH", dateIso(taskForCalculations.lateFinish));
  write(fields, "TOTAL_SLACK", effectiveTotalSlackDays);
  write(fields, "FREE_SLACK", freeSlackDays);
  write(fields, "START_SLACK", effectiveTotalSlackDays);
  write(fields, "FINISH_SLACK", effectiveTotalSlackDays);
  write(fields, "NEGATIVE_SLACK", Math.min(0, effectiveTotalSlackDays));
  write(fields, "CRITICAL", calculatedCritical);
  write(fields, "ACTIVE", taskIsActive);
  fields.PREDECESSORS = predecessors.map(dependencyLabel).join(", ");
  fields.SUCCESSORS = successors.map((dep) => `${dep.to}${dep.type}${dep.lag ? `${dep.lag > 0 ? "+" : ""}${dep.lag}d` : ""}`).join(", ");
  fields.WBS_PREDECESSORS = predecessors.map((dep) => tasksForCalculations.find((candidate) => String(candidate.id) === String(dep.from))?.wbs ?? dep.from).join(", ");
  fields.WBS_SUCCESSORS = successors.map((dep) => tasksForCalculations.find((candidate) => String(candidate.id) === String(dep.to))?.wbs ?? dep.to).join(", ");
  fields.UNIQUE_ID_PREDECESSORS = predecessors.map((dep) => {
    const predecessor = tasksForCalculations.find((candidate) => String(candidate.id) === String(dep.from));
    return taskUniqueId(predecessor, dep.from);
  }).join(", ");
  fields.UNIQUE_ID_SUCCESSORS = successors.map((dep) => {
    const successor = tasksForCalculations.find((candidate) => String(candidate.id) === String(dep.to));
    return taskUniqueId(successor, dep.to);
  }).join(", ");
  write(fields, "SUMMARY", taskForCalculations.isSummary);
  write(fields, "MILESTONE", taskForCalculations.isMilestone);
  write(fields, "OUTLINE_LEVEL", taskForCalculations.outlineLevel);
  write(fields, "OUTLINE_NUMBER", taskForCalculations.wbs ?? String(taskForCalculations.id));
  write(fields, "WBS", taskForCalculations.wbs);
  write(fields, "TASK_SUMMARY_NAME", taskSummaryName(taskForCalculations, tasksForCalculations));
  write(fields, "ROLLUP", fields.ROLLUP ?? taskForCalculations.isSummary);
  write(fields, "GROUP_BY_SUMMARY", fields.GROUP_BY_SUMMARY ?? false);
  write(fields, "TASK_MODE", fields.TASK_MODE ?? "Auto Scheduled");
  write(fields, "TYPE", fields.TYPE ?? "Fixed Units");
  write(fields, "EFFORT_DRIVEN", fields.EFFORT_DRIVEN ?? false);
  write(fields, "PERCENT_COMPLETE", progress);
  write(fields, "PERCENT_WORK_COMPLETE", metrics.work > 0 ? safeDivide(metrics.actualWork, metrics.work) * 100 : progress);
  write(fields, "PHYSICAL_PERCENT_COMPLETE", physicalProgress);
  write(fields, "ACTUAL_START", dateIso(importedActualStart ?? (progress > 0 ? taskForCalculations.start : undefined)));
  write(fields, "ACTUAL_FINISH", dateIso(importedActualFinish ?? (progress >= 100 ? taskForCalculations.finish : undefined)));
  write(fields, "ACTUAL_DURATION", actualDuration);
  write(fields, "REMAINING_DURATION", remainingDuration);
  write(fields, "COMPLETE_THROUGH", completeThrough);
  write(fields, "STOP", stop);
  write(fields, "RESUME", progress > 0 && progress < 100 ? resumeDateForTask(fields, stop, calendar) : undefined);
  write(fields, "STATUS", status ?? (finishVariance > 0 || deadlineVariance > 0 ? "Late" : finishVariance < 0 ? "Ahead" : "On Schedule"));
  write(fields, "STATUS_INDICATOR", status ?? (finishVariance > 0 || deadlineVariance > 0 ? "Behind" : "On Schedule"));
  write(fields, "HEALTH", status === "Late" || finishVariance > 0 || deadlineVariance > 0 || calculatedCritical ? "At Risk" : "On Track");
  write(fields, "WORK", metrics.work);
  write(fields, "ACTUAL_WORK", metrics.actualWork);
  write(fields, "REMAINING_WORK", metrics.remainingWork);
  write(fields, "REGULAR_WORK", metrics.work - metrics.overtimeWork);
  write(fields, "OVERTIME_WORK", metrics.overtimeWork);
  write(fields, "ACTUAL_OVERTIME_WORK", metrics.actualOvertimeWork);
  write(fields, "REMAINING_OVERTIME_WORK", metrics.remainingOvertimeWork);
  write(fields, "PEAK", metrics.peak);
  write(fields, "OVERALLOCATED", metrics.overallocated);
  write(fields, "ASSIGNMENT_UNITS", metrics.assignmentUnits.join(", "));
  write(fields, "RESOURCE_NAMES", metrics.resourceNames.join(", "));
  write(fields, "RESOURCE_INITIALS", metrics.resourceInitials.join(", "));
  write(fields, "RESOURCE_GROUP", metrics.resourceGroups.join(", "));
  write(fields, "RESOURCE_TYPE", metrics.resourceTypes.join(", "));
  write(fields, "COST", metrics.cost);
  write(fields, "FIXED_COST", metrics.fixedCost);
  write(fields, "FIXED_COST_ACCRUAL", metrics.fixedCostAccrual);
  write(fields, "ACTUAL_FIXED_COST", metrics.actualFixedCost);
  write(fields, "ACTUAL_COST", metrics.actualCost);
  write(fields, "REMAINING_COST", metrics.remainingCost);
  write(fields, "OVERTIME_COST", taskAssignments(taskForCalculations, assignments).reduce((sum, assignment) => {
    const resource = resources.find((candidate) => candidate.uid === assignment.resourceId);
    return sum + calculateAssignmentFinancials(taskForCalculations, assignment, resource, minutesPerDay / 60, calendar).overtimeCost;
  }, 0));
  write(fields, "ACTUAL_OVERTIME_COST", taskAssignments(taskForCalculations, assignments).reduce((sum, assignment) => {
    const resource = resources.find((candidate) => candidate.uid === assignment.resourceId);
    return sum + calculateAssignmentFinancials(taskForCalculations, assignment, resource, minutesPerDay / 60, calendar).actualOvertimeCost;
  }, 0));
  write(fields, "REMAINING_OVERTIME_COST", taskAssignments(taskForCalculations, assignments).reduce((sum, assignment) => {
    const resource = resources.find((candidate) => candidate.uid === assignment.resourceId);
    return sum + calculateAssignmentFinancials(taskForCalculations, assignment, resource, minutesPerDay / 60, calendar).remainingOvertimeCost;
  }, 0));
  writeBaselineFields(fields, "", baseline, {
    start: taskForCalculations.baselineStart,
    finish: taskForCalculations.baselineFinish,
    duration: baselineDuration,
    work: baselineWork,
    cost: baselineCost,
    budgetWork: baselineBudgetWork,
    budgetCost: baselineBudgetCost,
  });
  writeBaselineFields(fields, "BASELINE_0", baseline, {
    start: taskForCalculations.baselineStart,
    finish: taskForCalculations.baselineFinish,
    duration: baselineDuration,
    work: baselineWork,
    cost: baselineCost,
    budgetWork: baselineBudgetWork,
    budgetCost: baselineBudgetCost,
  });
  writeBaselineEstimatedFields(fields, 0, baseline, {
    start: taskForCalculations.baselineStart,
    finish: taskForCalculations.baselineFinish,
    duration: baselineDuration,
  });
  write(fields, "BUDGET_WORK", baselineBudgetWork);
  write(fields, "BUDGET_COST", baselineBudgetCost);
  write(fields, "START_VARIANCE", startVariance);
  write(fields, "FINISH_VARIANCE", finishVariance);
  write(fields, "DURATION_VARIANCE", durationVariance);
  write(fields, "WORK_VARIANCE", metrics.work - baselineWork);
  write(fields, "COST_VARIANCE", metrics.cost - baselineCost);
  write(fields, "BCWS", bcws);
  write(fields, "BCWP", bcwp);
  write(fields, "ACWP", acwp);
  write(fields, "SV", sv);
  write(fields, "SV_PERCENT", safeDivide(sv, bcws) * 100);
  write(fields, "CV", cv);
  write(fields, "CV_PERCENT", safeDivide(cv, bcwp) * 100);
  write(fields, "SPI", spi);
  write(fields, "CPI", cpi);
  write(fields, "EAC", eac);
  write(fields, "VAC", vac);
  write(fields, "TCPI", tcpi);
  write(fields, "EARNED_VALUE_METHOD", earnedValueMethod);

  for (let index = 1; index <= 10; index += 1) {
    const numbered = baselineTaskFor(taskForCalculations, baselines, index);
    writeBaselineFields(fields, `BASELINE_${index}`, numbered);
    writeBaselineEstimatedFields(fields, index, numbered);
  }

  if (children.has(task.id)) {
    const childTasks = children.get(task.id)!;
    const childCosts = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.COST, child.cost ?? 0), 0);
    const childWork = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.WORK, 0), 0);
    fields.COST = childCosts;
    fields.WORK = childWork;
    fields.PERCENT_COMPLETE = safeDivide(
      childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.PERCENT_COMPLETE, child.progress) * Math.max(1, child.duration), 0),
      childTasks.reduce((sum, child) => sum + Math.max(1, child.duration), 0),
    );
    fields.SUMMARY_PROGRESS = fields.PERCENT_COMPLETE;
  }

  const customFields = customDefinitions.filter((definition) => definition.recordType === "task");
  const nextFields = applyCustomLookupValidation(
    applyCustomFormulas(fields, customFields, calendar),
    customFields,
  );

  return {
    ...taskForCalculations,
    isCritical: calculatedCritical,
    resourceNames: metrics.resourceNames,
    cost: metrics.cost,
    actualCost: metrics.actualCost,
    mppFields: {
      ...nextFields,
      __calculationEngineVersion: MPP_CALCULATION_ENGINE_VERSION,
    },
  };
}

function calculateResourceFields(
  resource: Resource,
  assignments: Assignment[],
  tasks: GanttTask[],
  columns: MppResourceColumn[],
  customDefinitions: MppCustomFieldDefinition[],
  hoursPerDay: number,
  timephasedScale: TimephasedScale,
  calendar?: ProjectCalendar,
  resourceLoadIndex?: ResourceLoadIndex,
): Resource {
  const assigned = assignments.filter((assignment) => assignment.resourceId === resource.uid);
  const fields = { ...(resource.mppFields ?? {}) };
  const assignmentFinancials = assigned.map((assignment): ResourceAssignmentFinancials => {
    const task = tasks.find((candidate) => String(candidate.id) === String(assignment.taskId));
    return {
      assignment,
      financials: calculateAssignmentFinancials(task, assignment, resource, hoursPerDay, calendar),
    };
  });
  const work = assignmentFinancials.reduce((sum, item) => sum + item.financials.work, 0);
  const cost = assignmentFinancials.reduce((sum, item) => sum + item.financials.cost, 0);
  const overtimeWork = assignmentFinancials.reduce((sum, item) => sum + item.financials.overtimeWork, 0);
  const actualOvertimeWork = assignmentFinancials.reduce((sum, item) => sum + item.financials.actualOvertimeWork, 0);
  const remainingOvertimeWork = assignmentFinancials.reduce((sum, item) => sum + item.financials.remainingOvertimeWork, 0);
  const overtimeCost = assignmentFinancials.reduce((sum, item) => sum + item.financials.overtimeCost, 0);
  const actualOvertimeCost = assignmentFinancials.reduce((sum, item) => sum + item.financials.actualOvertimeCost, 0);
  const remainingOvertimeCost = assignmentFinancials.reduce((sum, item) => sum + item.financials.remainingOvertimeCost, 0);
  const actualCost = assignmentFinancials.reduce((sum, item) => sum + item.financials.actualCost, 0);
  const actualWork = assignmentFinancials.reduce((sum, item) => sum + item.financials.actualWork, 0);
  const remainingWork = Math.max(0, work - actualWork);
  const peak = resourceLoadIndex?.peakByResourceId.get(resource.uid)
    ?? assigned.reduce((max, assignment) => Math.max(max, assignment.units), 0);
  const assignmentStarts = assignmentFinancials
    .map((item) => item.financials.start)
    .filter((date): date is Date => Boolean(date));
  const assignmentFinishes = assignmentFinancials
    .map((item) => item.financials.finish)
    .filter((date): date is Date => Boolean(date));
  const start = assignmentStarts.length
    ? new Date(Math.min(...assignmentStarts.map((date) => date.getTime())))
    : undefined;
  const finish = assignmentFinishes.length
    ? new Date(Math.max(...assignmentFinishes.map((date) => date.getTime())))
    : undefined;
  const assignmentActualStarts = assignmentFinancials
    .map((item) => actualStartForWork(item.assignment.mppFields ?? {}, item.financials.actualWork, item.financials.start))
    .filter((date): date is Date => Boolean(date));
  const assignmentActualFinishes = assignmentFinancials
    .map((item) => actualFinishForWork(item.assignment.mppFields ?? {}, item.financials.work, item.financials.remainingWork, item.financials.finish))
    .filter((date): date is Date => Boolean(date));
  const actualStart = readCalculatedDate(fields, "ACTUAL_START")
    ?? (assignmentActualStarts.length ? new Date(Math.min(...assignmentActualStarts.map((date) => date.getTime()))) : undefined);
  const actualFinish = readCalculatedDate(fields, "ACTUAL_FINISH")
    ?? (remainingWork <= 0 && assignmentActualFinishes.length
      ? new Date(Math.max(...assignmentActualFinishes.map((date) => date.getTime())))
      : undefined);
  const available = availabilityWindow(resource);
  write(fields, "ID", resource.uid);
  writeIfMissing(fields, "UNIQUE_ID", resource.uid);
  write(fields, "NAME", resource.name);
  write(fields, "TYPE", resource.type);
  write(fields, "INITIALS", resourceInitials(resource));
  write(fields, "START", dateIso(start));
  write(fields, "FINISH", dateIso(finish));
  write(fields, "AVAILABLE_FROM", dateIso(available.from));
  write(fields, "AVAILABLE_TO", dateIso(available.to));
  write(fields, "ACTUAL_START", dateIso(actualStart));
  write(fields, "ACTUAL_FINISH", dateIso(actualFinish));
  write(fields, "STANDARD_RATE", resource.rate);
  write(fields, "OVERTIME_RATE", resourceOvertimeRate(resource));
  write(fields, "MAX_UNITS", resource.availability);
  write(fields, "GROUP", resource.group);
  write(fields, "COST_PER_USE", resourceCostPerUse(resource));
  write(fields, "WORK", work);
  write(fields, "ACTUAL_WORK", actualWork);
  write(fields, "REMAINING_WORK", remainingWork);
  write(fields, "PERCENT_WORK_COMPLETE", work > 0 ? safeDivide(actualWork, work) * 100 : 0);
  write(fields, "REGULAR_WORK", Math.max(0, work - overtimeWork));
  write(fields, "OVERTIME_WORK", overtimeWork);
  write(fields, "ACTUAL_OVERTIME_WORK", actualOvertimeWork);
  write(fields, "REMAINING_OVERTIME_WORK", remainingOvertimeWork);
  write(fields, "COST", cost);
  write(fields, "ACTUAL_COST", actualCost);
  write(fields, "REMAINING_COST", Math.max(0, cost - actualCost));
  write(fields, "OVERTIME_COST", overtimeCost);
  write(fields, "ACTUAL_OVERTIME_COST", actualOvertimeCost);
  write(fields, "REMAINING_OVERTIME_COST", remainingOvertimeCost);
  write(fields, "PEAK", peak);
  write(fields, "OVERALLOCATED", resourceLoadIndex?.overallocatedResourceIds.has(resource.uid) ?? peak > (resource.availability ?? 100));
  materializeResourceBaselineFields(fields, assigned);
  materializeBudgetFields(
    fields,
    sumAssignmentBudgetValues(assigned, "BUDGET_WORK"),
    sumAssignmentBudgetValues(assigned, "BUDGET_COST"),
  );
  applyImportedBaselineVariances(fields, calendar);
  const resourceEarnedValue = assignmentFinancials.reduce<EarnedValueTotals | undefined>((totals, item) => {
    const task = tasks.find((candidate) => String(candidate.id) === String(item.assignment.taskId));
    const assignmentFields = item.assignment.mppFields ?? {};
    const assignmentEarnedValue = earnedValueTotalsFromFields(
      assignmentFields,
      item.financials.cost,
      item.financials.actualCost,
      earnedValueProgressForTask(task),
    );
    return mergeEarnedValueTotals(totals, assignmentEarnedValue);
  }, undefined);
  writeEarnedValueTotals(
    fields,
    resourceEarnedValue ?? earnedValueTotalsFromFields(fields, cost, actualCost, safeDivide(actualWork, work) * 100),
  );
  for (const column of columns) {
    if (
      column.fieldId.startsWith("TIMEPHASED_")
      && normalizeMppFieldId(column.fieldId) !== "TIMEPHASED_OVERALLOCATION"
      && fields[column.fieldId] === undefined
    ) {
      const resourceSeries = buildResourceAssignmentTimephasedSeries(
        resource,
        fields,
        assignmentFinancials,
        column.fieldId,
        timephasedScale,
        calendar,
      );
      if (resourceSeries) fields[column.fieldId] = resourceSeries;
    }
  }
  return {
    ...resource,
    mppFields: {
      ...applyCustomLookupValidation(
        applyCustomFormulas(fields, customDefinitions.filter((definition) => definition.recordType === "resource"), calendar),
        customDefinitions.filter((definition) => definition.recordType === "resource"),
      ),
      __calculationEngineVersion: MPP_CALCULATION_ENGINE_VERSION,
    },
  };
}

type CustomRollupType = "sum" | "average" | "min" | "max" | "any" | "all" | "count";

function normalizeCustomRollupType(value: string | undefined): CustomRollupType | undefined {
  const normalized = String(value ?? "").replace(/[\s_-]+/g, "").toLowerCase();
  if (!normalized) return undefined;
  if (["sum", "total"].includes(normalized)) return "sum";
  if (["average", "avg", "weightedaverage"].includes(normalized)) return "average";
  if (["min", "minimum"].includes(normalized)) return "min";
  if (["max", "maximum"].includes(normalized)) return "max";
  if (["any", "or"].includes(normalized)) return "any";
  if (["all", "and"].includes(normalized)) return "all";
  if (["count", "countall"].includes(normalized)) return "count";
  return undefined;
}

function comparableValue(value: unknown): number | string {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return toNumber(value, 0);
}

function rollupCustomFieldValue(
  childTasks: GanttTask[],
  fieldId: string,
  rollupType: CustomRollupType,
): unknown {
  const values = childTasks
    .map((child) => readCalculatedField(child.mppFields ?? {}, fieldId))
    .filter((value) => value !== undefined && value !== null && value !== "");
  if (values.length === 0) return undefined;

  switch (rollupType) {
    case "sum":
      return values.reduce<number>((sum, value) => sum + toNumber(value, 0), 0);
    case "average":
      return values.reduce<number>((sum, value) => sum + toNumber(value, 0), 0) / values.length;
    case "min":
      return values.reduce((best, value) => comparableValue(value) < comparableValue(best) ? value : best);
    case "max":
      return values.reduce((best, value) => comparableValue(value) > comparableValue(best) ? value : best);
    case "any":
      return values.some((value) => toBoolean(value));
    case "all":
      return values.every((value) => toBoolean(value));
    case "count":
      return values.length;
  }
}

function applyCustomRollups(
  fields: Record<string, unknown>,
  childTasks: GanttTask[],
  customDefinitions: MppCustomFieldDefinition[],
): void {
  for (const definition of customDefinitions) {
    if (definition.recordType !== "task") continue;
    const rollupType = normalizeCustomRollupType(definition.rollupType);
    if (!rollupType) continue;
    const fieldId = normalizeMppFieldId(definition.fieldId);
    const value = rollupCustomFieldValue(childTasks, fieldId, rollupType);
    write(fields, fieldId, value);
  }
}

function sumChildCalculatedField(childTasks: GanttTask[], fieldId: string): number | undefined {
  let hasValue = false;
  const total = childTasks.reduce((sum, child) => {
    const value = readCalculatedField(child.mppFields ?? {}, fieldId);
    if (value === undefined) return sum;
    hasValue = true;
    return sum + toNumber(value, 0);
  }, 0);
  return hasValue ? total : undefined;
}

function rollupChildDateRange(
  fields: Record<string, unknown>,
  childTasks: GanttTask[],
  startFieldId: string,
  finishFieldId: string,
  durationFieldId: string,
): void {
  const starts = childTasks
    .map((child) => readCalculatedDate(child.mppFields ?? {}, startFieldId))
    .filter((date): date is Date => Boolean(date));
  const finishes = childTasks
    .map((child) => readCalculatedDate(child.mppFields ?? {}, finishFieldId))
    .filter((date): date is Date => Boolean(date));
  const start = starts.length
    ? new Date(Math.min(...starts.map((date) => date.getTime())))
    : undefined;
  const finish = finishes.length
    ? new Date(Math.max(...finishes.map((date) => date.getTime())))
    : undefined;

  write(fields, startFieldId, dateIso(start));
  write(fields, finishFieldId, dateIso(finish));
  if (start && finish) {
    write(fields, durationFieldId, durationDays(start, finish));
  } else {
    write(fields, durationFieldId, sumChildCalculatedField(childTasks, durationFieldId));
  }
}

function applySummaryBaselineAndEarnedValueRollups(
  fields: Record<string, unknown>,
  childTasks: GanttTask[],
  calendar?: ProjectCalendar,
): void {
  const baselineWork = sumChildCalculatedField(childTasks, "BASELINE_WORK");
  const baselineCost = sumChildCalculatedField(childTasks, "BASELINE_COST");
  const baselineBudgetWork = sumChildCalculatedField(childTasks, "BASELINE_BUDGET_WORK");
  const baselineBudgetCost = sumChildCalculatedField(childTasks, "BASELINE_BUDGET_COST");

  write(fields, "BASELINE_WORK", baselineWork);
  write(fields, "BASELINE_COST", baselineCost);
  write(fields, "BASELINE_BUDGET_WORK", baselineBudgetWork);
  write(fields, "BASELINE_BUDGET_COST", baselineBudgetCost);
  write(fields, "BUDGET_WORK", baselineBudgetWork);
  write(fields, "BUDGET_COST", baselineBudgetCost);

  const baselineStarts = childTasks
    .map((child) => readCalculatedDate(child.mppFields ?? {}, "BASELINE_START"))
    .filter((date): date is Date => Boolean(date));
  const baselineFinishes = childTasks
    .map((child) => readCalculatedDate(child.mppFields ?? {}, "BASELINE_FINISH"))
    .filter((date): date is Date => Boolean(date));
  const baselineStart = baselineStarts.length
    ? new Date(Math.min(...baselineStarts.map((date) => date.getTime())))
    : undefined;
  const baselineFinish = baselineFinishes.length
    ? new Date(Math.max(...baselineFinishes.map((date) => date.getTime())))
    : undefined;
  write(fields, "BASELINE_START", dateIso(baselineStart));
  write(fields, "BASELINE_FINISH", dateIso(baselineFinish));
  if (baselineStart && baselineFinish) {
    write(fields, "BASELINE_DURATION", durationDays(baselineStart, baselineFinish));
  }

  if (baselineWork !== undefined) {
    write(fields, "WORK_VARIANCE", toNumber(fields.WORK, 0) - baselineWork);
  }
  if (baselineCost !== undefined) {
    write(fields, "COST_VARIANCE", toNumber(fields.COST, 0) - baselineCost);
  }
  if (fields.BASELINE_DURATION !== undefined) {
    write(fields, "DURATION_VARIANCE", toNumber(fields.DURATION, 0) - toNumber(fields.BASELINE_DURATION, 0));
  }
  if (baselineStart) {
    write(fields, "START_VARIANCE", workingDayVariance(baselineStart, parseDate(String(fields.START)), calendar));
  }
  if (baselineFinish) {
    write(fields, "FINISH_VARIANCE", workingDayVariance(baselineFinish, parseDate(String(fields.FINISH)), calendar));
  }

  const bcws = sumChildCalculatedField(childTasks, "BCWS");
  const bcwp = sumChildCalculatedField(childTasks, "BCWP");
  const acwp = sumChildCalculatedField(childTasks, "ACWP");
  if (baselineCost !== undefined && bcws !== undefined && bcwp !== undefined && acwp !== undefined) {
    writeEarnedValueTotals(fields, {
      baselineCost,
      cost: toNumber(fields.COST, 0),
      bcws,
      bcwp,
      acwp,
    });
  }

  for (let index = 0; index <= 10; index += 1) {
    const prefix = `BASELINE_${index}`;
    const numberedWork = sumChildCalculatedField(childTasks, `${prefix}_WORK`);
    const numberedCost = sumChildCalculatedField(childTasks, `${prefix}_COST`);
    const numberedBudgetWork = sumChildCalculatedField(childTasks, `${prefix}_BUDGET_WORK`);
    const numberedBudgetCost = sumChildCalculatedField(childTasks, `${prefix}_BUDGET_COST`);
    write(fields, `${prefix}_WORK`, numberedWork);
    write(fields, `${prefix}_COST`, numberedCost);
    write(fields, `${prefix}_BUDGET_WORK`, numberedBudgetWork);
    write(fields, `${prefix}_BUDGET_COST`, numberedBudgetCost);

    rollupChildDateRange(fields, childTasks, `${prefix}_START`, `${prefix}_FINISH`, `${prefix}_DURATION`);
    rollupChildDateRange(
      fields,
      childTasks,
      `${prefix}_ESTIMATED_START`,
      `${prefix}_ESTIMATED_FINISH`,
      `${prefix}_ESTIMATED_DURATION`,
    );
  }
}

function rollupSummaryTasks(
  tasks: GanttTask[],
  children: Map<string | number, GanttTask[]>,
  customDefinitions: MppCustomFieldDefinition[],
  calendar?: ProjectCalendar,
): GanttTask[] {
  const byId = new Map<string | number, GanttTask>(tasks.map((task) => [task.id, task]));
  for (const task of [...tasks].reverse()) {
    const childRefs = children.get(task.id);
    if (!childRefs?.length) continue;
    const childTasks = childRefs
      .map((child) => byId.get(child.id))
      .filter((child): child is GanttTask => Boolean(child));
    if (childTasks.length === 0) continue;

    const fields = { ...(task.mppFields ?? {}) };
    const childStarts = childTasks.map((child) => child.start.getTime());
    const childFinishes = childTasks.map((child) => child.finish.getTime());
    const durationWeight = childTasks.reduce((sum, child) => sum + Math.max(1, child.duration), 0);
    fields.START = new Date(Math.min(...childStarts)).toISOString();
    fields.FINISH = new Date(Math.max(...childFinishes)).toISOString();
    fields.DURATION = durationDays(new Date(String(fields.START)), new Date(String(fields.FINISH)));
    fields.COST = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.COST, child.cost ?? 0), 0);
    fields.ACTUAL_COST = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.ACTUAL_COST, child.actualCost ?? 0), 0);
    fields.REMAINING_COST = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.REMAINING_COST, 0), 0);
    fields.WORK = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.WORK, 0), 0);
    fields.ACTUAL_WORK = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.ACTUAL_WORK, 0), 0);
    fields.REMAINING_WORK = childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.REMAINING_WORK, 0), 0);
    fields.PERCENT_WORK_COMPLETE = safeDivide(toNumber(fields.ACTUAL_WORK, 0), toNumber(fields.WORK, 0)) * 100;
    fields.PERCENT_COMPLETE = safeDivide(
      childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.PERCENT_COMPLETE, child.progress) * Math.max(1, child.duration), 0),
      durationWeight,
    );
    fields.SUMMARY_PROGRESS = fields.PERCENT_COMPLETE;
    fields.PHYSICAL_PERCENT_COMPLETE = safeDivide(
      childTasks.reduce((sum, child) => sum + toNumber(child.mppFields?.PHYSICAL_PERCENT_COMPLETE, child.progress) * Math.max(1, child.duration), 0),
      durationWeight,
    );
    fields.CRITICAL = childTasks.some((child) => child.isCritical);
    fields.SUMMARY = true;
    applySummaryBaselineAndEarnedValueRollups(fields, childTasks, calendar);
    applyCustomRollups(fields, childTasks, customDefinitions);

    const customFields = customDefinitions.filter((definition) => definition.recordType === "task");
    const nextFields = applyCustomLookupValidation(
      applyCustomFormulas(
        fields,
        customFields,
        calendar,
      ),
      customFields,
    );
    byId.set(task.id, {
      ...task,
      start: new Date(String(fields.START)),
      finish: new Date(String(fields.FINISH)),
      duration: toNumber(fields.DURATION, task.duration),
      progress: toNumber(fields.PERCENT_COMPLETE, task.progress),
      percentComplete: toNumber(fields.PERCENT_COMPLETE, task.percentComplete ?? task.progress),
      cost: toNumber(fields.COST, task.cost ?? 0),
      actualCost: toNumber(fields.ACTUAL_COST, task.actualCost ?? 0),
      isCritical: Boolean(fields.CRITICAL),
      mppFields: {
        ...nextFields,
        __calculationEngineVersion: MPP_CALCULATION_ENGINE_VERSION,
      },
    });
  }
  return tasks.map((task) => byId.get(task.id) ?? task);
}

function calculateAssignmentFields(
  assignment: Assignment,
  tasks: GanttTask[],
  resources: Resource[],
  columns: MppAssignmentColumn[],
  customDefinitions: MppCustomFieldDefinition[],
  hoursPerDay: number,
  calendar?: ProjectCalendar,
  resourceLoadIndex?: ResourceLoadIndex,
): Assignment {
  const task = tasks.find((candidate) => String(candidate.id) === String(assignment.taskId));
  const resource = resources.find((candidate) => candidate.uid === assignment.resourceId);
  const fields = { ...(assignment.mppFields ?? {}) };
  const financials = calculateAssignmentFinancials(task, assignment, resource, hoursPerDay, calendar);
  const percentComplete = toNumber(readCalculatedField(fields, "PERCENT_COMPLETE"), task?.percentComplete ?? task?.progress ?? 0);
  const physicalPercentComplete = toNumber(
    readCalculatedField(fields, "PHYSICAL_PERCENT_COMPLETE"),
    toNumber(task?.mppFields?.PHYSICAL_PERCENT_COMPLETE, percentComplete),
  );
  const percentWorkComplete = financials.work > 0
    ? safeDivide(financials.actualWork, financials.work) * 100
    : earnedValueProgressForTask(task);
  const actualDuration = financials.duration * (percentWorkComplete / 100);
  const remainingDuration = Math.max(0, financials.duration - actualDuration);
  const actualStart = actualStartForWork(fields, financials.actualWork, financials.start);
  const actualFinish = actualFinishForWork(fields, financials.work, financials.remainingWork, financials.finish);
  const assignmentId = readCalculatedField(fields, "ID") ?? readCalculatedField(fields, "UNIQUE_ID") ?? fields.__rowId;
  write(fields, "ID", assignmentId);
  writeIfMissing(fields, "UNIQUE_ID", assignmentId);
  write(fields, "TASK_ID", task?.id);
  write(fields, "TASK_NAME", task?.name);
  write(fields, "TASK_OUTLINE_NUMBER", task?.wbs ?? (task?.id !== undefined ? String(task.id) : undefined));
  write(fields, "TASK_SUMMARY_NAME", task?.mppFields ? readCalculatedField(task.mppFields, "TASK_SUMMARY_NAME") : taskSummaryName(task, tasks));
  write(fields, "WBS", task?.wbs);
  write(fields, "OUTLINE_LEVEL", task?.outlineLevel);
  write(fields, "CRITICAL", task?.isCritical);
  write(fields, "RESOURCE_ID", resource?.uid);
  write(fields, "RESOURCE_NAME", resource?.name);
  write(fields, "RESOURCE_INITIALS", resourceInitials(resource));
  write(fields, "RESOURCE_GROUP", resource?.group);
  write(fields, "RESOURCE_TYPE", resource?.type);
  write(fields, "ASSIGNMENT_UNITS", financials.units);
  write(fields, "ASSIGNMENT_DELAY", financials.assignmentDelay);
  write(fields, "DURATION", financials.duration);
  write(fields, "ACTUAL_DURATION", actualDuration);
  write(fields, "REMAINING_DURATION", remainingDuration);
  write(fields, "COST_RATE_TABLE", financials.costRateTable);
  write(fields, "STANDARD_RATE", financials.standardRate);
  write(fields, "COST_PER_USE", financials.costPerUse);
  write(fields, "OVERTIME_RATE", financials.overtimeRate);
  write(fields, "WORK", financials.work);
  write(fields, "ACTUAL_WORK", financials.actualWork);
  write(fields, "REMAINING_WORK", financials.remainingWork);
  write(fields, "PERCENT_COMPLETE", percentComplete);
  write(fields, "PHYSICAL_PERCENT_COMPLETE", physicalPercentComplete);
  write(fields, "PERCENT_WORK_COMPLETE", percentWorkComplete);
  write(fields, "REGULAR_WORK", Math.max(0, financials.work - financials.overtimeWork));
  write(fields, "OVERTIME_WORK", financials.overtimeWork);
  write(fields, "ACTUAL_OVERTIME_WORK", financials.actualOvertimeWork);
  write(fields, "REMAINING_OVERTIME_WORK", financials.remainingOvertimeWork);
  write(fields, "COST", financials.cost);
  write(fields, "ACTUAL_COST", financials.actualCost);
  write(fields, "REMAINING_COST", financials.remainingCost);
  write(fields, "OVERTIME_COST", financials.overtimeCost);
  write(fields, "ACTUAL_OVERTIME_COST", financials.actualOvertimeCost);
  write(fields, "REMAINING_OVERTIME_COST", financials.remainingOvertimeCost);
  write(fields, "PEAK", financials.units);
  write(fields, "OVERALLOCATED", resourceLoadIndex?.overallocatedAssignmentKeys.has(assignmentLoadKey(assignment)) ?? financials.units > (resource?.availability ?? 100));
  write(fields, "START", dateIso(financials.start));
  write(fields, "FINISH", dateIso(financials.finish));
  write(fields, "ACTUAL_START", dateIso(actualStart));
  write(fields, "ACTUAL_FINISH", dateIso(actualFinish));
  copyAssignmentBaselineFromTask(fields, task?.mppFields, financials);
  materializeBudgetFields(fields);
  applyImportedBaselineVariances(fields, calendar);
  writeEarnedValueTotals(
    fields,
    earnedValueTotalsFromFields(fields, financials.cost, financials.actualCost, earnedValueProgressForTask(task)),
  );
  for (const column of columns) {
    if (column.fieldId.startsWith("TIMEPHASED_") && fields[column.fieldId] === undefined) {
      fields[column.fieldId] = [];
    }
  }
  return {
    ...assignment,
    cost: financials.cost,
    mppFields: {
      ...applyCustomLookupValidation(
        applyCustomFormulas(fields, customDefinitions.filter((definition) => definition.recordType === "assignment"), calendar),
        customDefinitions.filter((definition) => definition.recordType === "assignment"),
      ),
      __calculationEngineVersion: MPP_CALCULATION_ENGINE_VERSION,
    },
  };
}

function resourceAssignmentTimephasedFields(item: ResourceAssignmentFinancials): Record<string, unknown> {
  return {
    ...(item.assignment.mppFields ?? {}),
    START: dateIso(item.financials.start),
    FINISH: dateIso(item.financials.finish),
    WORK: item.financials.work,
    ACTUAL_WORK: item.financials.actualWork,
    REMAINING_WORK: item.financials.remainingWork,
    REGULAR_WORK: Math.max(0, item.financials.work - item.financials.overtimeWork),
    OVERTIME_WORK: item.financials.overtimeWork,
    ACTUAL_OVERTIME_WORK: item.financials.actualOvertimeWork,
    REMAINING_OVERTIME_WORK: item.financials.remainingOvertimeWork,
    COST: item.financials.cost,
    ACTUAL_COST: item.financials.actualCost,
    REMAINING_COST: item.financials.remainingCost,
    OVERTIME_COST: item.financials.overtimeCost,
    ACTUAL_OVERTIME_COST: item.financials.actualOvertimeCost,
    REMAINING_OVERTIME_COST: item.financials.remainingOvertimeCost,
  };
}

function additiveResourceTimephasedSourceField(fieldId: string): string | undefined {
  const baseField = timephasedBaseField(fieldId);
  if (baseField === "OVERALLOCATION" || baseField === "PERCENT_COMPLETE") return undefined;
  if (["PERCENT_ALLOCATION", "PEAK_UNITS", "REMAINING_AVAILABILITY", "UNIT_AVAILABILITY", "WORK_AVAILABILITY"].includes(baseField)) return undefined;
  if (timephasedRatioFields(baseField)) return undefined;
  return `TIMEPHASED_${baseField}`;
}

function buildResourceAssignmentTimephasedSeries(
  resource: Resource,
  fields: Record<string, unknown>,
  assignments: ResourceAssignmentFinancials[],
  fieldId: string,
  scale: TimephasedScale,
  calendar?: ProjectCalendar,
): Array<{ start: string; finish: string; value: unknown; cumulative?: unknown }> | undefined {
  const sourceFieldId = additiveResourceTimephasedSourceField(fieldId);
  if (!sourceFieldId || assignments.length === 0) return undefined;
  const start = readRecordDate(resource as unknown as Record<string, unknown>, fields, "START");
  const finish = readRecordDate(resource as unknown as Record<string, unknown>, fields, "FINISH");
  if (!start || !finish) return undefined;

  const bucketValues = new Map<string, number>();
  for (const item of assignments) {
    const assignmentFields = resourceAssignmentTimephasedFields(item);
    const assignmentSeries = buildTimephasedSeries(
      item.assignment,
      assignmentFields,
      sourceFieldId,
      scale,
      calendar,
      undefined,
      "assignment",
    );
    for (const entry of assignmentSeries) {
      const key = utcPeriodKey(new Date(entry.start), scale);
      bucketValues.set(key, (bucketValues.get(key) ?? 0) + toNumber(entry.value, 0));
    }
  }

  const total = toNumber(readCalculatedField(fields, timephasedTotalField(fieldId)), 0);
  const isRemainingCumulative = fieldId.includes("REMAINING_CUMULATIVE_");
  const isCumulative = !isRemainingCumulative && fieldId.includes("CUMULATIVE_");
  let cumulative = 0;
  return groupDaysByScale(eachDay(start, finish), scale).map((bucket) => {
    const bucketStart = startOfUtcDay(bucket[0]);
    const bucketFinish = endOfUtcDay(bucket[bucket.length - 1]);
    const bucketValue = bucketValues.get(utcPeriodKey(bucket[0], scale)) ?? 0;
    cumulative += bucketValue;
    const value = isRemainingCumulative
      ? Math.max(0, total - cumulative)
      : isCumulative
        ? cumulative
        : bucketValue;
    return {
      start: bucketStart.toISOString(),
      finish: bucketFinish.toISOString(),
      value,
      cumulative,
    };
  });
}

function withTimephasedPlaceholders<T extends { mppFields?: Record<string, unknown> }>(
  records: T[],
  columns: MppRecordColumn[],
  scale: TimephasedScale,
  calendar?: ProjectCalendar,
  resourceLoadIndex?: ResourceLoadIndex,
): T[] {
  const timephased = columns.filter((column) => column.fieldId.startsWith("TIMEPHASED_"));
  if (timephased.length === 0) return records;
  return records.map((record) => {
    const fields = { ...(record.mppFields ?? {}) };
    for (const column of timephased) {
      const existingValue = fields[column.fieldId];
      if (existingValue === undefined || (Array.isArray(existingValue) && existingValue.length === 0)) {
        fields[column.fieldId] = buildTimephasedSeries(
          record,
          fields,
          column.fieldId,
          scale,
          calendar,
          resourceLoadIndex,
          column.recordType ?? "task",
        );
      }
    }
    return { ...record, mppFields: fields };
  });
}

function readRecordDate(record: Record<string, unknown>, fields: Record<string, unknown>, fieldId: string): Date | undefined {
  const value = readCalculatedField(fields, fieldId) ?? record[fieldId.toLowerCase()] ?? record[fieldId];
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  const end = startOfUtcDay(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

function eachDay(start: Date, finish: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfUtcDay(start);
  const end = startOfUtcDay(finish);
  while (cursor.getTime() <= end.getTime()) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days.length ? days : [startOfUtcDay(start)];
}

function utcPeriodKey(day: Date, scale: TimephasedScale): string {
  if (scale === "month") {
    return `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (scale === "week") {
    const monday = startOfUtcDay(day);
    const dayOfWeek = monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate() - dayOfWeek + 1);
    return monday.toISOString().slice(0, 10);
  }
  return day.toISOString().slice(0, 10);
}

function groupDaysByScale(days: Date[], scale: TimephasedScale): Date[][] {
  const groups: Date[][] = [];
  let currentKey = "";
  for (const day of days) {
    const key = utcPeriodKey(day, scale);
    if (key !== currentKey) {
      groups.push([]);
      currentKey = key;
    }
    groups[groups.length - 1].push(day);
  }
  return groups;
}

function calendarDateForBucketDay(day: Date): Date {
  return new Date(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12, 0, 0, 0);
}

function timephasedTotalField(fieldId: string): string {
  const normalized = fieldId.replace(/^TIMEPHASED_/, "");
  if (normalized.startsWith("CUMULATIVE_")) return normalizeNumberedBaselineField(normalized.replace(/^CUMULATIVE_/, ""));
  if (normalized.startsWith("REMAINING_CUMULATIVE_")) return normalizeNumberedBaselineField(normalized.replace(/^REMAINING_CUMULATIVE_/, ""));
  if (normalized === "PERCENT_COMPLETE") return "PERCENT_COMPLETE";
  if (normalized === "OVERALLOCATION") return "OVERALLOCATED";
  return normalizeNumberedBaselineField(normalized);
}

function timephasedBaseField(fieldId: string): string {
  return normalizeNumberedBaselineField(fieldId
    .replace(/^TIMEPHASED_/, "")
    .replace(/^CUMULATIVE_/, "")
    .replace(/^REMAINING_CUMULATIVE_/, ""));
}

function normalizeNumberedBaselineField(fieldId: string): string {
  return fieldId.replace(/^BASELINE(\d+)_/, "BASELINE_$1_");
}

function timephasedRatioFields(baseField: string): { numerator: string; denominator: string; multiplier: number } | undefined {
  switch (baseField) {
    case "SPI":
      return { numerator: "BCWP", denominator: "BCWS", multiplier: 1 };
    case "CPI":
      return { numerator: "BCWP", denominator: "ACWP", multiplier: 1 };
    case "SV_PERCENT":
      return { numerator: "SV", denominator: "BCWS", multiplier: 100 };
    case "CV_PERCENT":
      return { numerator: "CV", denominator: "BCWP", multiplier: 100 };
    default:
      return undefined;
  }
}

function overallocationDateKeysForRecord(
  record: Record<string, unknown>,
  recordType: MppRecordColumn["recordType"],
  resourceLoadIndex?: ResourceLoadIndex,
): Set<string> {
  if (!resourceLoadIndex) return new Set<string>();
  if (recordType === "resource") {
    return resourceLoadIndex.overallocatedDatesByResourceId.get(toNumber(record.uid, Number.NaN)) ?? new Set<string>();
  }
  if (recordType === "assignment") {
    return resourceLoadIndex.overallocatedDatesByAssignmentKey.get(assignmentLoadKey(record as unknown as Assignment)) ?? new Set<string>();
  }
  return resourceLoadIndex.overallocatedDatesByTaskId.get(String(record.id)) ?? new Set<string>();
}

function buildTimephasedOverallocationSeries<T extends { mppFields?: Record<string, unknown> }>(
  record: T,
  fields: Record<string, unknown>,
  scale: TimephasedScale,
  recordType: MppRecordColumn["recordType"],
  resourceLoadIndex?: ResourceLoadIndex,
): Array<{ start: string; finish: string; value: boolean }> {
  const recordObject = record as Record<string, unknown>;
  const start = readRecordDate(recordObject, fields, "START");
  const finish = readRecordDate(recordObject, fields, "FINISH");
  if (!start || !finish) return [];

  const overallocatedDateKeys = overallocationDateKeysForRecord(recordObject, recordType, resourceLoadIndex);
  return groupDaysByScale(eachDay(start, finish), scale).map((bucket) => {
    const bucketStart = startOfUtcDay(bucket[0]);
    const bucketFinish = endOfUtcDay(bucket[bucket.length - 1]);
    return {
      start: bucketStart.toISOString(),
      finish: bucketFinish.toISOString(),
      value: bucket.some((day) => overallocatedDateKeys.has(day.toISOString().slice(0, 10))),
    };
  });
}

function buildActualFixedCostTimephasedSeries(
  fields: Record<string, unknown>,
  buckets: Date[][],
  bucketWeights: number[],
  distributionWeight: number,
): Array<{ start: string; finish: string; value: number; cumulative: number }> {
  const fixedCost = toNumber(readCalculatedField(fields, "FIXED_COST"), 0);
  const actualFixedCostValue = toNumber(readCalculatedField(fields, "ACTUAL_FIXED_COST"), 0);
  const accrual = normalizeFixedCostAccrual(readCalculatedField(fields, "FIXED_COST_ACCRUAL"));
  const progress = Math.max(0, Math.min(100, toNumber(readCalculatedField(fields, "PERCENT_COMPLETE"), 0)));
  let cumulative = 0;

  return buckets.map((bucket, index) => {
    const bucketStart = startOfUtcDay(bucket[0]);
    const bucketFinish = endOfUtcDay(bucket[bucket.length - 1]);
    let value = 0;

    if (accrual === "Start") {
      value = progress > 0 && index === 0 ? actualFixedCostValue : 0;
    } else if (accrual === "End") {
      value = progress >= 100 && index === buckets.length - 1 ? actualFixedCostValue : 0;
    } else if (fixedCost > 0 && distributionWeight > 0) {
      const elapsedWeight = distributionWeight * safeDivide(actualFixedCostValue, fixedCost);
      const priorWeight = bucketWeights.slice(0, index).reduce((sum, weight) => sum + weight, 0);
      const bucketWeight = bucketWeights[index] || 0;
      const consumedWeight = Math.max(0, Math.min(bucketWeight, elapsedWeight - priorWeight));
      value = fixedCost * safeDivide(consumedWeight, distributionWeight);
    }

    cumulative += value;
    return {
      start: bucketStart.toISOString(),
      finish: bucketFinish.toISOString(),
      value,
      cumulative,
    };
  });
}

function buildResourceAllocationTimephasedSeries<T extends { mppFields?: Record<string, unknown> }>(
  record: T,
  fields: Record<string, unknown>,
  fieldId: string,
  scale: TimephasedScale,
  calendar?: ProjectCalendar,
  resourceLoadIndex?: ResourceLoadIndex,
): Array<{ start: string; finish: string; value: number; cumulative: number }> | undefined {
  const normalizedFieldId = normalizeMppFieldId(fieldId);
  if (
    ![
      "TIMEPHASED_PERCENT_ALLOCATION",
      "TIMEPHASED_PEAK_UNITS",
      "TIMEPHASED_REMAINING_AVAILABILITY",
      "TIMEPHASED_UNIT_AVAILABILITY",
      "TIMEPHASED_WORK_AVAILABILITY",
    ].includes(normalizedFieldId)
  ) {
    return undefined;
  }

  const resource = record as Resource & Record<string, unknown>;
  const resourceId = toNumber(resource.uid, Number.NaN);
  if (!Number.isFinite(resourceId)) return [];

  const start = readRecordDate(resource, fields, "START");
  const finish = readRecordDate(resource, fields, "FINISH");
  if (!start || !finish) return [];

  const loadsByDate = resourceLoadIndex?.loadByResourceDate.get(resourceId) ?? new Map<string, number>();
  let cumulative = 0;
  return groupDaysByScale(eachDay(start, finish), scale).map((bucket) => {
    const bucketStart = startOfUtcDay(bucket[0]);
    const bucketFinish = endOfUtcDay(bucket[bucket.length - 1]);
    const loads = bucket.map((day) => loadsByDate.get(day.toISOString().slice(0, 10)) ?? 0);
    const availabilities = bucket.map((day) => availabilityForDate(resource, day));
    const totalLoad = loads.reduce((sum, value) => sum + value, 0);
    const totalAvailability = availabilities.reduce((sum, value) => sum + value, 0);
    const peakLoad = loads.reduce((max, value) => Math.max(max, value), 0);
    const remainingAvailability = safeDivide(totalAvailability - totalLoad, bucket.length);
    const unitAvailability = safeDivide(totalAvailability, bucket.length);
    const workAvailability = bucket.reduce((sum, day, index) => {
      const availability = availabilities[index] ?? 0;
      const hours = getCalendarMinutesForDate(calendarDateForBucketDay(day), calendar) / 60;
      return sum + hours * (availability / 100);
    }, 0);
    const value = normalizedFieldId === "TIMEPHASED_PERCENT_ALLOCATION"
      ? safeDivide(totalLoad, totalAvailability) * 100
      : normalizedFieldId === "TIMEPHASED_PEAK_UNITS"
        ? peakLoad
        : normalizedFieldId === "TIMEPHASED_UNIT_AVAILABILITY"
          ? unitAvailability
          : normalizedFieldId === "TIMEPHASED_WORK_AVAILABILITY"
            ? workAvailability
            : remainingAvailability;
    cumulative += value;
    return {
      start: bucketStart.toISOString(),
      finish: bucketFinish.toISOString(),
      value,
      cumulative,
    };
  });
}

function buildAssignmentAllocationTimephasedSeries<T extends { mppFields?: Record<string, unknown> }>(
  record: T,
  fields: Record<string, unknown>,
  fieldId: string,
  scale: TimephasedScale,
  resourceLoadIndex?: ResourceLoadIndex,
): Array<{ start: string; finish: string; value: number; cumulative: number }> | undefined {
  const normalizedFieldId = normalizeMppFieldId(fieldId);
  if (!["TIMEPHASED_PERCENT_ALLOCATION", "TIMEPHASED_PEAK_UNITS", "TIMEPHASED_REMAINING_AVAILABILITY"].includes(normalizedFieldId)) {
    return undefined;
  }

  const assignment = record as Assignment & Record<string, unknown>;
  const resourceId = toNumber(assignment.resourceId, Number.NaN);
  if (!Number.isFinite(resourceId)) return [];

  const start = readRecordDate(assignment, fields, "START");
  const finish = readRecordDate(assignment, fields, "FINISH");
  if (!start || !finish) return [];

  const loadsByDate = resourceLoadIndex?.loadByResourceDate.get(resourceId) ?? new Map<string, number>();
  const availabilityByDate = resourceLoadIndex?.availabilityByResourceDate.get(resourceId) ?? new Map<string, number>();
  const assignmentUnits = toNumber(
    readCalculatedField(fields, "ASSIGNMENT_UNITS") ?? assignment.units,
    100,
  );
  let cumulative = 0;

  return groupDaysByScale(eachDay(start, finish), scale).map((bucket) => {
    const bucketStart = startOfUtcDay(bucket[0]);
    const bucketFinish = endOfUtcDay(bucket[bucket.length - 1]);
    const totalLoad = bucket.reduce(
      (sum, day) => sum + (loadsByDate.get(day.toISOString().slice(0, 10)) ?? assignmentUnits),
      0,
    );
    const totalAvailability = bucket.reduce(
      (sum, day) => sum + (availabilityByDate.get(day.toISOString().slice(0, 10)) ?? 100),
      0,
    );
    const value = normalizedFieldId === "TIMEPHASED_PERCENT_ALLOCATION"
      ? roundCalculation(safeDivide(totalLoad, totalAvailability) * 100)
      : normalizedFieldId === "TIMEPHASED_PEAK_UNITS"
        ? assignmentUnits
        : safeDivide(totalAvailability - totalLoad, bucket.length);
    cumulative += value;
    return {
      start: bucketStart.toISOString(),
      finish: bucketFinish.toISOString(),
      value,
      cumulative,
    };
  });
}

function workContourKey(fields: Record<string, unknown>): string {
  return String(
    readCalculatedField(fields, "WORK_CONTOUR")
      ?? readCalculatedField(fields, "ASSIGNMENT_WORK_CONTOUR")
      ?? readCalculatedField(fields, "CONTOUR")
      ?? "flat",
  )
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function contourWeight(contour: string, index: number, total: number): number {
  if (total <= 1) return 1;
  const position = index / (total - 1);
  switch (contour) {
    case "frontloaded":
      return total - index;
    case "backloaded":
      return index + 1;
    case "bell":
      return 1 + Math.sin(Math.PI * position);
    case "turtle":
      return 2 - Math.sin(Math.PI * position);
    case "earlypeak":
      return 1 + Math.max(0, 1 - Math.abs(position - 0.25) / 0.25);
    case "latepeak":
      return 1 + Math.max(0, 1 - Math.abs(position - 0.75) / 0.25);
    case "doublepeak":
      return 1 + Math.max(
        0,
        1 - Math.min(Math.abs(position - 0.25), Math.abs(position - 0.75)) / 0.25,
      );
    default:
      return 1;
  }
}

function bucketDistributionWeights(
  days: Date[],
  buckets: Date[][],
  fields: Record<string, unknown>,
  calendar: ProjectCalendar | undefined,
): number[] {
  const normalizedCalendar = normalizeProjectCalendar(calendar ?? DEFAULT_PROJECT_CALENDAR);
  const workingFlags = days.map((day) => isProjectWorkingDay(calendarDateForBucketDay(day), normalizedCalendar));
  const eligibleDayIndexes = workingFlags
    .map((isWorking, index) => isWorking ? index : -1)
    .filter((index) => index >= 0);
  const distributionDayIndexes = eligibleDayIndexes.length ? eligibleDayIndexes : days.map((_, index) => index);
  const ordinalByDayIndex = new Map(distributionDayIndexes.map((dayIndex, ordinal) => [dayIndex, ordinal]));
  const contour = workContourKey(fields);
  const dayWeights = days.map((_, dayIndex) => {
    const ordinal = ordinalByDayIndex.get(dayIndex);
    if (ordinal === undefined) return 0;
    const minutes = getCalendarMinutesForDate(
      calendarDateForBucketDay(days[dayIndex]),
      normalizedCalendar,
    );
    return minutes * contourWeight(contour, ordinal, distributionDayIndexes.length);
  });

  let dayOffset = 0;
  return buckets.map((bucket) => {
    const weight = dayWeights
      .slice(dayOffset, dayOffset + bucket.length)
      .reduce((sum, value) => sum + value, 0);
    dayOffset += bucket.length;
    return weight;
  });
}

function buildTimephasedSeries<T extends { mppFields?: Record<string, unknown> }>(
  record: T,
  fields: Record<string, unknown>,
  fieldId: string,
  scale: TimephasedScale,
  calendar?: ProjectCalendar,
  resourceLoadIndex?: ResourceLoadIndex,
  recordType: MppRecordColumn["recordType"] = "task",
): Array<{ start: string; finish: string; value: unknown; cumulative?: unknown }> {
  const normalizedFieldId = normalizeMppFieldId(fieldId);
  if (normalizedFieldId === "TIMEPHASED_OVERALLOCATION") {
    return buildTimephasedOverallocationSeries(record, fields, scale, recordType, resourceLoadIndex);
  }

  const recordObject = record as Record<string, unknown>;
  const start = readRecordDate(recordObject, fields, "START");
  const finish = readRecordDate(recordObject, fields, "FINISH");
  if (!start || !finish) return [];

  if (recordType === "resource") {
    const resourceAllocationSeries = buildResourceAllocationTimephasedSeries(
      record,
      fields,
      fieldId,
      scale,
      calendar,
      resourceLoadIndex,
    );
    if (resourceAllocationSeries) return resourceAllocationSeries;
  }
  if (recordType === "assignment") {
    const assignmentAllocationSeries = buildAssignmentAllocationTimephasedSeries(
      record,
      fields,
      fieldId,
      scale,
      resourceLoadIndex,
    );
    if (assignmentAllocationSeries) return assignmentAllocationSeries;
  }

  const days = eachDay(start, finish);
  const buckets = groupDaysByScale(days, scale);
  const bucketWeights = bucketDistributionWeights(days, buckets, fields, calendar);
  const distributionWeight = bucketWeights.reduce((sum, weight) => sum + weight, 0) || days.length;
  if (normalizedFieldId === "TIMEPHASED_ACTUAL_FIXED_COST") {
    return buildActualFixedCostTimephasedSeries(fields, buckets, bucketWeights, distributionWeight);
  }
  const baseField = timephasedBaseField(fieldId);
  const ratioFields = timephasedRatioFields(baseField);
  if (ratioFields) {
    const numeratorTotal = toNumber(readCalculatedField(fields, ratioFields.numerator), 0);
    const denominatorTotal = toNumber(readCalculatedField(fields, ratioFields.denominator), 0);
    const numeratorPerWeight = numeratorTotal / distributionWeight;
    const denominatorPerWeight = denominatorTotal / distributionWeight;
    let cumulativeNumerator = 0;
    let cumulativeDenominator = 0;
    return buckets.map((bucket, index) => {
      const bucketStart = startOfUtcDay(bucket[0]);
      const bucketFinish = endOfUtcDay(bucket[bucket.length - 1]);
      const bucketWeight = bucketWeights[index] || 0;
      const bucketNumerator = numeratorPerWeight * bucketWeight;
      const bucketDenominator = denominatorPerWeight * bucketWeight;
      cumulativeNumerator += bucketNumerator;
      cumulativeDenominator += bucketDenominator;
      return {
        start: bucketStart.toISOString(),
        finish: bucketFinish.toISOString(),
        value: safeDivide(bucketNumerator, bucketDenominator) * ratioFields.multiplier,
        cumulative: safeDivide(cumulativeNumerator, cumulativeDenominator) * ratioFields.multiplier,
      };
    });
  }

  const totalField = timephasedTotalField(fieldId);
  const total = readCalculatedField(fields, totalField);
  const totalNumber = toNumber(total, 0);
  const perWeight = totalNumber / distributionWeight;
  let cumulative = 0;
  let elapsedWeight = 0;

  return buckets.map((bucket, index) => {
    const bucketStart = startOfUtcDay(bucket[0]);
    const bucketFinish = endOfUtcDay(bucket[bucket.length - 1]);
    const bucketWeight = bucketWeights[index] || 0;
    if (fieldId.includes("PERCENT_COMPLETE")) {
      const bucketValue = safeDivide(bucketWeight, distributionWeight) * totalNumber;
      elapsedWeight += bucketWeight;
      cumulative = (elapsedWeight / distributionWeight) * totalNumber;
      return {
        start: bucketStart.toISOString(),
        finish: bucketFinish.toISOString(),
        value: fieldId.includes("CUMULATIVE_") ? cumulative : bucketValue,
        cumulative,
      };
    }
    if (typeof total === "boolean") {
      return {
        start: bucketStart.toISOString(),
        finish: bucketFinish.toISOString(),
        value: total,
      };
    }
    const bucketValue = perWeight * bucketWeight;
    cumulative += bucketValue;
    const value = fieldId.includes("REMAINING_CUMULATIVE_")
      ? Math.max(0, totalNumber - cumulative)
      : fieldId.includes("CUMULATIVE_")
        ? cumulative
        : bucketValue;
    return {
      start: bucketStart.toISOString(),
      finish: bucketFinish.toISOString(),
      value,
      cumulative,
    };
  });
}

export function calculateMppFields(input: MppCalculationInput): MppCalculationResult {
  const calculatedAt = new Date().toISOString();
  const resources = input.resources ?? [];
  const assignments = input.assignments ?? [];
  const baselines = input.baselines ?? [];
  const customFieldDefinitions = input.customFieldDefinitions ?? [];
  const statusDate = parseDate(input.statusDate);
  const minutesPerDay = getCalendarMinutesPerDay(input.calendar);
  const hoursPerDay = minutesPerDay / 60;
  const children = buildChildren(input.tasks);
  const resourceLoadIndex = buildResourceLoadIndex(input.tasks, resources, assignments, input.calendar);

  let tasks = input.tasks.map((task) =>
    calculateTaskFields(
      task,
      input.tasks,
      resources,
      assignments,
      baselines,
      children,
      minutesPerDay,
      customFieldDefinitions,
      input.calendar,
      resourceLoadIndex,
      statusDate,
    ),
  );
  tasks = rollupSummaryTasks(tasks, children, customFieldDefinitions, input.calendar);

  const mppTaskColumns = enrichColumns(input.mppTaskColumns ?? [], customFieldDefinitions, calculatedAt);
  const mppResourceColumns = enrichColumns(input.mppResourceColumns ?? [], customFieldDefinitions, calculatedAt);
  const mppAssignmentColumns = enrichColumns(input.mppAssignmentColumns ?? [], customFieldDefinitions, calculatedAt);
  const timephasedScale = input.timephasedScale ?? "day";
  tasks = withTimephasedPlaceholders(tasks, mppTaskColumns, timephasedScale, input.calendar, resourceLoadIndex);
  const calculatedAssignments = withTimephasedPlaceholders(
    assignments.map((assignment) => calculateAssignmentFields(assignment, tasks, resources, mppAssignmentColumns, customFieldDefinitions, hoursPerDay, input.calendar, resourceLoadIndex)),
    mppAssignmentColumns,
    timephasedScale,
    input.calendar,
    resourceLoadIndex,
  );
  const calculatedResources = withTimephasedPlaceholders(
    resources.map((resource) => calculateResourceFields(resource, calculatedAssignments, tasks, mppResourceColumns, customFieldDefinitions, hoursPerDay, timephasedScale, input.calendar, resourceLoadIndex)),
    mppResourceColumns,
    timephasedScale,
    input.calendar,
    resourceLoadIndex,
  );

  return {
    tasks,
    resources: calculatedResources,
    assignments: calculatedAssignments,
    mppTaskColumns,
    mppResourceColumns,
    mppAssignmentColumns,
    customFieldDefinitions,
    calculatedAt,
    engineVersion: MPP_CALCULATION_ENGINE_VERSION,
  };
}
