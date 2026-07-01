import type {
  MppCalculationKind,
  MppRecordType,
} from "@/types/mppColumns";
import { normalizeMppFieldId } from "./fieldLabels";

export interface MppCalculatedFieldSpec {
  calculationKind: MppCalculationKind;
  dependencies: string[];
  isCalculated: boolean;
  isEditableWhenCalculated: boolean;
  sourceOfTruth: "engine" | "mppImport" | "user" | "customFormula";
}

const schedule = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "schedule",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const constraint = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "constraint",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const rollup = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "rollup",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const tracking = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "tracking",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const editableTracking = (dependencies: string[]): MppCalculatedFieldSpec => ({
  ...tracking(dependencies),
  isEditableWhenCalculated: true,
});

const work = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "work",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const cost = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "cost",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const baseline = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "baseline",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const earnedValue = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "earnedValue",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const timephased = (dependencies: string[]): MppCalculatedFieldSpec => ({
  calculationKind: "timephased",
  dependencies,
  isCalculated: true,
  isEditableWhenCalculated: false,
  sourceOfTruth: "engine",
});

const input = (dependencies: string[] = []): MppCalculatedFieldSpec => ({
  calculationKind: "input",
  dependencies,
  isCalculated: false,
  isEditableWhenCalculated: true,
  sourceOfTruth: "user",
});

const TASK_SCHEDULE_FIELDS = [
  "START", "FINISH", "DURATION", "EARLY_START", "EARLY_FINISH", "LATE_START", "LATE_FINISH",
  "TOTAL_SLACK", "FREE_SLACK", "START_SLACK", "FINISH_SLACK", "NEGATIVE_SLACK", "CRITICAL",
  "SUCCESSORS", "PREDECESSORS", "WBS_PREDECESSORS", "WBS_SUCCESSORS",
  "UNIQUE_ID_PREDECESSORS", "UNIQUE_ID_SUCCESSORS", "SCHEDULED_START", "SCHEDULED_FINISH",
  "SCHEDULED_DURATION", "PRELEVELED_START", "PRELEVELED_FINISH",
];

const TASK_CONSTRAINT_FIELDS = [
  "CONSTRAINT_TYPE", "CONSTRAINT_DATE", "DEADLINE", "TASK_CALENDAR",
  "IGNORE_RESOURCE_CALENDAR", "LEVELING_DELAY", "TASK_MODE",
];

const TASK_ROLLUP_FIELDS = [
  "ACTIVE", "SUMMARY", "MILESTONE", "OUTLINE_LEVEL", "OUTLINE_NUMBER", "WBS", "ROLLUP",
  "SUMMARY_PROGRESS", "TASK_SUMMARY_NAME",
];

const TASK_TRACKING_FIELDS = [
  "PERCENT_COMPLETE", "PERCENT_WORK_COMPLETE", "PHYSICAL_PERCENT_COMPLETE",
  "ACTUAL_START", "ACTUAL_FINISH", "ACTUAL_DURATION", "REMAINING_DURATION",
  "COMPLETE_THROUGH", "STOP", "RESUME", "STATUS", "STATUS_INDICATOR", "HEALTH",
];

const WORK_FIELDS = [
  "WORK", "ACTUAL_WORK", "REMAINING_WORK", "REGULAR_WORK", "OVERTIME_WORK",
  "ACTUAL_OVERTIME_WORK", "REMAINING_OVERTIME_WORK", "PEAK", "OVERALLOCATED",
];

const COST_FIELDS = [
  "COST", "ACTUAL_COST", "REMAINING_COST", "ACTUAL_FIXED_COST",
  "OVERTIME_COST",
  "ACTUAL_OVERTIME_COST", "REMAINING_OVERTIME_COST", "COST_VARIANCE",
];

const EARNED_VALUE_FIELDS = [
  "BCWS", "BCWP", "ACWP", "SV", "SV_PERCENT", "CV", "CV_PERCENT",
  "SPI", "CPI", "EAC", "VAC", "TCPI",
];

function entries(fields: string[], spec: MppCalculatedFieldSpec): Array<[string, MppCalculatedFieldSpec]> {
  return fields.map((field) => [field, spec]);
}

const TASK_FIELD_SPECS = new Map<string, MppCalculatedFieldSpec>([
  ...entries(["ID", "UNIQUE_ID"], schedule(["TASK_ID"])),
  ...entries(TASK_SCHEDULE_FIELDS, schedule(["TASKS", "DEPENDENCIES", "CALENDAR", "CONSTRAINTS"])),
  ...entries(TASK_CONSTRAINT_FIELDS, constraint(["TASKS", "PROJECT_CALENDAR"])),
  ...entries(TASK_ROLLUP_FIELDS, rollup(["TASK_OUTLINE", "SUMMARY_CHILDREN"])),
  ["GROUP_BY_SUMMARY", rollup(["VIEW_GROUPING"])],
  ...entries(TASK_TRACKING_FIELDS, tracking(["TASK_DURATION", "PROGRESS", "BASELINE", "DEADLINE"])),
  ["ACTUAL_START", editableTracking(["PROGRESS", "ACTUALS"])],
  ["ACTUAL_FINISH", editableTracking(["PROGRESS", "ACTUALS"])],
  ["ACTUAL_DURATION", editableTracking(["TASK_DURATION", "PROGRESS", "ACTUALS"])],
  ["REMAINING_DURATION", editableTracking(["TASK_DURATION", "ACTUAL_DURATION", "PROGRESS"])],
  ["STOP", editableTracking(["TASK_DURATION", "PROGRESS", "CALENDAR", "SPLITS"])],
  ["RESUME", editableTracking(["TASK_DURATION", "PROGRESS", "CALENDAR", "SPLITS"])],
  ...entries(WORK_FIELDS, work(["ASSIGNMENTS", "RESOURCES", "TASK_DURATION", "PROGRESS", "RESOURCE_CALENDAR"])),
  ["ACTUAL_WORK", { ...work(["WORK", "PROGRESS", "ACTUALS"]), isEditableWhenCalculated: true }],
  ["REMAINING_WORK", { ...work(["WORK", "ACTUAL_WORK", "PROGRESS"]), isEditableWhenCalculated: true }],
  ...entries(["ASSIGNMENT_UNITS", "RESOURCE_NAMES", "RESOURCE_INITIALS", "RESOURCE_GROUP", "RESOURCE_TYPE"], work(["ASSIGNMENTS", "RESOURCES"])),
  ...entries(COST_FIELDS, cost(["ASSIGNMENTS", "RESOURCES", "TASK_DURATION", "PROGRESS", "FIXED_COST", "COST_RATE_TABLES"])),
  ...entries(["BUDGET_WORK", "BUDGET_COST"], baseline(["BASELINE", "BUDGET_VALUES"])),
  ...entries(EARNED_VALUE_FIELDS, earnedValue(["BASELINE", "PROGRESS", "PHYSICAL_PERCENT_COMPLETE", "ACTUAL_COST", "COST"])),
  ["TYPE", input(["WORK", "DURATION", "ASSIGNMENT_UNITS"])],
  ["EFFORT_DRIVEN", input(["RESOURCE_ASSIGNMENTS", "WORK", "DURATION"])],
  ["FIXED_COST", input()],
  ["FIXED_COST_ACCRUAL", input()],
  ["EARNED_VALUE_METHOD", input()],
  ["WORK_CONTOUR", input(["TIMEPHASED_WORK"])],
  ["COST_RATE_TABLE", input(["RESOURCE_RATES"])],
]);

const RESOURCE_FIELD_SPECS = new Map<string, MppCalculatedFieldSpec>([
  ...entries(["ID", "UNIQUE_ID"], schedule(["RESOURCE_ID"])),
  ["START", schedule(["ASSIGNMENTS", "TASKS"])],
  ["FINISH", schedule(["ASSIGNMENTS", "TASKS"])],
  ["AVAILABLE_FROM", constraint(["RESOURCE_AVAILABILITY_PERIODS"])],
  ["AVAILABLE_TO", constraint(["RESOURCE_AVAILABILITY_PERIODS"])],
  ["INITIALS", work(["RESOURCE_NAME"])],
  ...entries(["ACTUAL_START", "ACTUAL_FINISH", "PERCENT_WORK_COMPLETE"], tracking(["ASSIGNMENTS", "ACTUAL_WORK", "WORK"])),
  ...entries(WORK_FIELDS, work(["ASSIGNMENTS", "TASKS", "RESOURCE_CALENDAR"])),
  ...entries(COST_FIELDS, cost(["ASSIGNMENTS", "TASKS", "COST_RATE_TABLES"])),
  ...entries(["BUDGET_WORK", "BUDGET_COST"], baseline(["BASELINE", "BUDGET_VALUES"])),
  ...entries(EARNED_VALUE_FIELDS, earnedValue(["ASSIGNMENTS", "TASKS", "BASELINE", "ACTUAL_COST"])),
  ["STANDARD_RATE", input()],
  ["OVERTIME_RATE", input()],
  ["COST_PER_USE", input()],
  ["MAX_UNITS", input()],
  ["WORK_CONTOUR", input(["TIMEPHASED_WORK"])],
  ["COST_RATE_TABLE", input(["RESOURCE_RATES"])],
  ["ACCRUE_AT", input(["COST_ACCRUAL"])],
  ["GROUP", input()],
  ["TYPE", input()],
]);

const ASSIGNMENT_FIELD_SPECS = new Map<string, MppCalculatedFieldSpec>([
  ...entries(["ID", "UNIQUE_ID"], schedule(["ASSIGNMENT_ROW"])),
  ["TASK_ID", schedule(["ASSIGNMENT_TASK"])],
  ["TASK_NAME", schedule(["ASSIGNMENT_TASK"])],
  ...entries(["TASK_OUTLINE_NUMBER", "TASK_SUMMARY_NAME", "WBS", "OUTLINE_LEVEL"], rollup(["ASSIGNMENT_TASK", "TASK_OUTLINE"])),
  ["CRITICAL", schedule(["ASSIGNMENT_TASK", "TASK_SCHEDULE"])],
  ["RESOURCE_ID", schedule(["ASSIGNMENT_RESOURCE"])],
  ["RESOURCE_NAME", schedule(["ASSIGNMENT_RESOURCE"])],
  ...entries(["RESOURCE_INITIALS", "RESOURCE_GROUP", "RESOURCE_TYPE"], work(["ASSIGNMENT_RESOURCE"])),
  ["START", schedule(["TASK_START"])],
  ["FINISH", schedule(["TASK_FINISH"])],
  ...entries(
    ["ACTUAL_START", "ACTUAL_FINISH", "ACTUAL_DURATION", "REMAINING_DURATION", "PERCENT_WORK_COMPLETE"],
    tracking(["ASSIGNMENT_DURATION", "ASSIGNMENT_WORK", "ACTUAL_WORK", "REMAINING_WORK"]),
  ),
  ["ASSIGNMENT_DELAY", schedule(["TASK_START", "ASSIGNMENT_START", "CALENDAR"])],
  ...entries(WORK_FIELDS, work(["ASSIGNMENT_UNITS", "TASK_DURATION", "PROGRESS", "RESOURCE_CALENDAR"])),
  ["ACTUAL_WORK", { ...work(["ASSIGNMENT_UNITS", "TASK_DURATION", "PROGRESS", "RESOURCE_CALENDAR"]), isEditableWhenCalculated: true }],
  ["REMAINING_WORK", { ...work(["ASSIGNMENT_UNITS", "TASK_DURATION", "PROGRESS", "RESOURCE_CALENDAR"]), isEditableWhenCalculated: true }],
  ...entries(COST_FIELDS, cost(["ASSIGNMENT_UNITS", "TASK_DURATION", "PROGRESS", "RESOURCE_RATES", "COST_RATE_TABLE"])),
  ...entries(["BUDGET_WORK", "BUDGET_COST"], baseline(["BASELINE", "BUDGET_VALUES"])),
  ...entries(EARNED_VALUE_FIELDS, earnedValue(["ASSIGNMENT_TASK", "BASELINE", "ACTUAL_COST"])),
  ["STANDARD_RATE", cost(["RESOURCE_RATES", "COST_RATE_TABLE"])],
  ["OVERTIME_RATE", cost(["RESOURCE_RATES", "COST_RATE_TABLE"])],
  ["COST_PER_USE", cost(["RESOURCE_RATES", "COST_RATE_TABLE"])],
  ["ASSIGNMENT_UNITS", input()],
  ["COST_RATE_TABLE", input()],
  ["WORK_CONTOUR", input(["TIMEPHASED_WORK"])],
]);

const FIELD_SPECS: Record<MppRecordType, Map<string, MppCalculatedFieldSpec>> = {
  task: TASK_FIELD_SPECS,
  resource: RESOURCE_FIELD_SPECS,
  assignment: ASSIGNMENT_FIELD_SPECS,
};

function numberedBaselineSpec(fieldId: string): MppCalculatedFieldSpec | undefined {
  if (/^BASELINE(?:_\d+)?_(?:START|FINISH|DURATION|WORK|COST|BUDGET_WORK|BUDGET_COST)$/.test(fieldId)) {
    return baseline(["BASELINES", "TASKS"]);
  }
  if (/^BASELINE_\d+_ESTIMATED_(?:START|FINISH|DURATION)$/.test(fieldId)) {
    return baseline(["BASELINES", "SCHEDULED_VALUES"]);
  }
  if (/^(?:START|FINISH|DURATION|WORK|COST)_VARIANCE$/.test(fieldId)) {
    return baseline(["BASELINE", "CURRENT_VALUES"]);
  }
  return undefined;
}

function timephasedSpec(fieldId: string, recordType: MppRecordType): MppCalculatedFieldSpec | undefined {
  if (!fieldId.startsWith("TIMEPHASED_")) return undefined;
  const dependencies = recordType === "task"
    ? ["TASK_START", "TASK_FINISH", "FIELD_TOTAL", "TIMEPHASED_SCALE"]
    : recordType === "resource"
      ? ["RESOURCE_ASSIGNMENTS", "FIELD_TOTAL", "TIMEPHASED_SCALE"]
      : ["ASSIGNMENT_START", "ASSIGNMENT_FINISH", "FIELD_TOTAL", "TIMEPHASED_SCALE"];
  return timephased(dependencies);
}

function customFieldSpec(fieldId: string): MppCalculatedFieldSpec | undefined {
  if (
    /^(?:TEXT|NUMBER|DATE|COST|DURATION|FLAG|START|FINISH|OUTLINE_CODE)_\d+$/.test(fieldId)
    || /^ENTERPRISE_(?:TEXT|NUMBER|DATE|COST|DURATION|FLAG|TASK_OUTLINE_CODE|RESOURCE_OUTLINE_CODE)_\d+$/.test(fieldId)
  ) {
    return input(["CUSTOM_FIELD_VALUE"]);
  }
  return undefined;
}

function normalizeCalculatedFieldId(fieldId: string): string {
  const trimmed = fieldId.trim();
  const timephasedMatch = trimmed.match(/^(.*)\s+\((?:Timephased|por fases temporales)\)$/i);
  if (timephasedMatch) {
    return `TIMEPHASED_${normalizeMppFieldId(timephasedMatch[1].replace(/%/g, " Percent "))}`;
  }
  return normalizeMppFieldId(trimmed.replace(/%/g, " Percent "))
    .replace(/^BASELINE(\d+)_(.+)$/, "BASELINE_$1_$2");
}

export function getMppCalculatedFieldSpec(
  fieldId: string,
  recordType: MppRecordType = "task",
): MppCalculatedFieldSpec | undefined {
  const normalized = normalizeCalculatedFieldId(fieldId);
  return FIELD_SPECS[recordType].get(normalized)
    ?? numberedBaselineSpec(normalized)
    ?? timephasedSpec(normalized, recordType)
    ?? customFieldSpec(normalized);
}
