import type {
  MppAssignmentColumn,
  MppRecordColumn,
  MppRecordType,
  MppResourceColumn,
  MppTaskColumn,
  MppCalculationSpec,
  RecordColumnSettings,
  ResourceColumnSettings,
  TaskColumnSettings,
} from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";
import {
  inferMppDataType,
  normalizeMppFieldId,
  resolveMppFieldDefinition,
} from "./fieldLabels";
import { getMppCalculatedFieldSpec } from "./calculatedFields";
import { getStandardMppColumns } from "./standardFields";

export interface RawMppTaskColumn {
  key?: string;
  fieldId?: string;
  sourceKey?: string;
  labelEn?: string;
  labelEs?: string;
  alias?: string;
  dataType?: string;
  group?: MppRecordColumn["group"];
  recordType?: MppRecordType;
  isCustom?: boolean;
  isCore?: boolean;
  isEditable?: boolean;
  width?: number;
  calculationSpec?: MppCalculationSpec;
}

type RecordWithMppFields = object & {
  mppFields?: Record<string, unknown>;
};

export const CORE_TASK_COLUMN_KEYS = [
  "id",
  "wbs",
  "name",
  "duration",
  "start",
  "finish",
  "predecessors",
  "progress",
  "critical",
] as const;

export const CORE_RESOURCE_COLUMN_KEYS = [
  "uid",
  "name",
  "type",
  "rate",
  "availability",
  "group",
] as const;

export const CORE_ASSIGNMENT_COLUMN_KEYS = [
  "taskId",
  "resourceId",
  "units",
  "cost",
] as const;

const RAW_CORE_SOURCE_KEYS: Record<MppRecordType, Set<string>> = {
  task: new Set([
    "UID",
    "ID",
    "WBS",
    "Name",
    "Duration",
    "DurationFormat",
    "Start",
    "Finish",
    "PredecessorLink",
    "PercentComplete",
    "Summary",
    "Milestone",
    "OutlineLevel",
    "Critical",
    "id",
    "name",
    "wbs",
    "duration",
    "start",
    "finish",
    "predecessors",
    "successors",
    "percentComplete",
    "isSummary",
    "isMilestone",
    "outlineLevel",
  ]),
  resource: new Set([
    "UID",
    "ID",
    "Name",
    "Type",
    "uid",
    "name",
    "type",
    "rate",
    "availability",
    "group",
    "assignments",
  ]),
  assignment: new Set([
    "UID",
    "TaskUID",
    "TaskID",
    "ResourceUID",
    "ResourceID",
    "Units",
    "Cost",
    "Work",
    "taskId",
    "resourceId",
    "units",
    "cost",
  ]),
};

const CORE_FIELD_IDS: Record<MppRecordType, Set<string>> = {
  task: new Set([
    "UNIQUE_ID",
    "ID",
    "WBS",
    "NAME",
    "DURATION",
    "DURATION_FORMAT",
    "START",
    "FINISH",
    "PREDECESSORS",
    "PREDECESSOR_LINK",
    "PERCENT_COMPLETE",
    "SUMMARY",
    "MILESTONE",
    "OUTLINE_LEVEL",
    "CRITICAL",
  ]),
  resource: new Set([
    "UNIQUE_ID",
    "ID",
    "NAME",
    "TYPE",
    "STANDARD_RATE",
    "MAX_UNITS",
    "GROUP",
  ]),
  assignment: new Set([
    "UNIQUE_ID",
    "TASK_UNIQUE_ID",
    "TASK_ID",
    "RESOURCE_UNIQUE_ID",
    "RESOURCE_ID",
    "ASSIGNMENT_UNITS",
    "UNITS",
    "COST",
    "WORK",
  ]),
};

const INTERNAL_SOURCE_KEYS = new Set([
  "mppFields",
  "matrixSource",
  "matrixSync",
  "__rowId",
]);

export const DEFAULT_TASK_COLUMN_SETTINGS: TaskColumnSettings = {
  visible: [...CORE_TASK_COLUMN_KEYS],
  widths: {},
  labelLocale: "es",
};

export const DEFAULT_RESOURCE_COLUMN_SETTINGS: ResourceColumnSettings = {
  visible: [...CORE_RESOURCE_COLUMN_KEYS],
  widths: {},
  labelLocale: "es",
};

export const DEFAULT_ASSIGNMENT_COLUMN_SETTINGS: RecordColumnSettings = {
  visible: [...CORE_ASSIGNMENT_COLUMN_KEYS],
  widths: {},
  labelLocale: "es",
};

function isCoreSourceKey(
  sourceKey: string,
  raw?: RawMppTaskColumn,
  recordType: MppRecordType = "task",
): boolean {
  if (raw?.isCore) return true;
  return RAW_CORE_SOURCE_KEYS[recordType].has(sourceKey) ||
    CORE_FIELD_IDS[recordType].has(normalizeMppFieldId(raw?.fieldId ?? sourceKey));
}

function normalizeDataType(dataType: unknown): MppRecordColumn["dataType"] {
  const value = String(dataType ?? "").toLowerCase();
  if (value.includes("date")) return "date";
  if (value.includes("duration")) return "duration";
  if (value.includes("currency") || value.includes("cost")) return "currency";
  if (value.includes("bool")) return "boolean";
  if (value.includes("number") || value.includes("integer") || value.includes("numeric")) return "number";
  if (value.includes("object") || value.includes("list")) return "object";
  return "string";
}

function firstPresentValue(records: RecordWithMppFields[], sourceKey: string): unknown {
  const normalizedSourceKey = normalizeMppFieldId(sourceKey);
  for (const record of records) {
    const direct = record.mppFields?.[sourceKey] ?? (record as Record<string, unknown>)[sourceKey];
    if (direct !== undefined && direct !== null && direct !== "") return direct;
    const entries = [
      ...Object.entries(record.mppFields ?? {}),
      ...Object.entries(record as Record<string, unknown>),
    ];
    const matched = entries.find(([key, value]) =>
      normalizeMppFieldId(key) === normalizedSourceKey &&
      value !== undefined &&
      value !== null &&
      value !== "",
    );
    const value = matched?.[1];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function toColumn(
  sourceKey: string,
  records: RecordWithMppFields[],
  raw?: RawMppTaskColumn,
  recordType: MppRecordType = "task",
): MppRecordColumn {
  const fieldId = normalizeMppFieldId(raw?.fieldId ?? sourceKey);
  const definition = resolveMppFieldDefinition(
    fieldId,
    raw?.labelEn ?? raw?.sourceKey ?? sourceKey,
    raw?.alias,
  );
  const isCore = isCoreSourceKey(sourceKey, raw, recordType);
  const isCustom = raw?.isCustom ?? definition.group === "custom";
  const catalogSpec = getMppCalculatedFieldSpec(fieldId, recordType);
  const calculationSpec = raw?.calculationSpec ?? catalogSpec;
  const isEditable = calculationSpec
    ? !calculationSpec.isCalculated || calculationSpec.isEditableWhenCalculated
    : raw?.isEditable ?? (isCustom && !raw?.calculationSpec?.formula);

  return {
    key: raw?.key ?? (recordType === "task" ? `mpp:${sourceKey}` : `mpp:${recordType}:${sourceKey}`),
    fieldId,
    sourceKey,
    labelEn: raw?.labelEn?.trim() || definition.en,
    labelEs: raw?.labelEs?.trim() || definition.es,
    alias: raw?.alias,
    dataType: raw?.dataType
      ? normalizeDataType(raw.dataType)
      : inferMppDataType(firstPresentValue(records, sourceKey), fieldId),
    group: raw?.group ?? definition.group,
    recordType: raw?.recordType ?? recordType,
    isCustom,
    isCore,
    isEditable,
    width: raw?.width ?? definition.width,
    calculationSpec,
  };
}

export function buildMppRecordColumnsFromRecords(
  records: RecordWithMppFields[],
  availableColumns?: string[],
  rawColumns?: RawMppTaskColumn[],
  recordType: MppRecordType = "task",
): MppRecordColumn[] {
  const bySourceKey = new Map<string, RawMppTaskColumn>();
  const byFieldId = new Map<string, RawMppTaskColumn>();
  for (const raw of [...getStandardMppColumns(recordType), ...(rawColumns ?? [])]) {
    const sourceKey = raw.sourceKey ?? raw.key ?? raw.fieldId;
    if (sourceKey) bySourceKey.set(sourceKey, raw);
    if (raw.fieldId) byFieldId.set(normalizeMppFieldId(raw.fieldId), raw);
  }

  const sourceKeys = new Set<string>();
  for (const raw of getStandardMppColumns(recordType)) {
    if (raw.sourceKey) sourceKeys.add(raw.sourceKey);
  }
  for (const key of availableColumns ?? []) {
    sourceKeys.add(key);
  }
  for (const record of records) {
    for (const key of Object.keys(record)) {
      sourceKeys.add(key);
    }
    for (const key of Object.keys(record.mppFields ?? {})) {
      sourceKeys.add(key);
    }
  }
  for (const sourceKey of bySourceKey.keys()) {
    sourceKeys.add(sourceKey);
  }

  const columnsByFieldId = new Map<string, MppRecordColumn>();
  for (const sourceKey of [...sourceKeys]
    .filter((sourceKey) => !INTERNAL_SOURCE_KEYS.has(sourceKey))
    .filter((sourceKey) => !isCoreSourceKey(sourceKey, bySourceKey.get(sourceKey), recordType))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const fieldId = normalizeMppFieldId(bySourceKey.get(sourceKey)?.fieldId ?? sourceKey);
    const raw = bySourceKey.get(sourceKey) ?? byFieldId.get(fieldId);
    const column = toColumn(sourceKey, records, raw, recordType);
    const previous = columnsByFieldId.get(column.fieldId);
    if (!previous || raw?.alias || previous.sourceKey === previous.fieldId) {
      columnsByFieldId.set(column.fieldId, column);
    }
  }

  return [...columnsByFieldId.values()].sort((a, b) =>
    a.labelEn.localeCompare(b.labelEn, undefined, { numeric: true }),
  );
}

export function buildMppTaskColumnsFromTasks(
  tasks: RecordWithMppFields[],
  availableColumns?: string[],
  rawColumns?: RawMppTaskColumn[],
): MppTaskColumn[] {
  return buildMppRecordColumnsFromRecords(tasks, availableColumns, rawColumns, "task");
}

export function buildMppResourceColumnsFromResources(
  resources: RecordWithMppFields[],
  availableColumns?: string[],
  rawColumns?: RawMppTaskColumn[],
): MppResourceColumn[] {
  return buildMppRecordColumnsFromRecords(resources, availableColumns, rawColumns, "resource");
}

export function buildMppAssignmentColumnsFromAssignments(
  assignments: RecordWithMppFields[],
  availableColumns?: string[],
  rawColumns?: RawMppTaskColumn[],
): MppAssignmentColumn[] {
  return buildMppRecordColumnsFromRecords(assignments, availableColumns, rawColumns, "assignment");
}

function normalizeRecordColumnSettings(
  settings: Partial<RecordColumnSettings> | undefined,
  locale: UILocale = "es",
  defaultVisible: readonly string[],
): RecordColumnSettings {
  return {
    visible: Array.isArray(settings?.visible)
      ? settings.visible
      : [...defaultVisible],
    widths:
      settings?.widths && typeof settings.widths === "object"
        ? settings.widths
        : {},
    labelLocale: settings?.labelLocale === "en" ? "en" : locale,
  };
}

export function normalizeTaskColumnSettings(
  settings: Partial<TaskColumnSettings> | undefined,
  locale: UILocale = "es",
): TaskColumnSettings {
  return normalizeRecordColumnSettings(settings, locale, CORE_TASK_COLUMN_KEYS);
}

export function normalizeResourceColumnSettings(
  settings: Partial<ResourceColumnSettings> | undefined,
  locale: UILocale = "es",
): ResourceColumnSettings {
  return normalizeRecordColumnSettings(settings, locale, CORE_RESOURCE_COLUMN_KEYS);
}

export function normalizeAssignmentColumnSettings(
  settings: Partial<RecordColumnSettings> | undefined,
  locale: UILocale = "es",
): RecordColumnSettings {
  return normalizeRecordColumnSettings(settings, locale, CORE_ASSIGNMENT_COLUMN_KEYS);
}
