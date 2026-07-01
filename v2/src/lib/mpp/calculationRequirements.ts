import type { MppRecordType } from "@/types/mppColumns";
import { getMppCalculatedFieldSpec } from "./calculatedFields";
import type { MppCalculationCoverageStatus } from "./calculationCoverage";

export type MppCalculationRequirementStatus =
  | MppCalculationCoverageStatus
  | "missing";

export interface MppCalculationRequirement {
  recordType: MppRecordType;
  fieldId: string;
  expected: Exclude<MppCalculationRequirementStatus, "missing">;
  family: string;
}

export interface MppCalculationRequirementAudit {
  requirement: MppCalculationRequirement;
  actual: MppCalculationRequirementStatus;
  ok: boolean;
}

export interface MppCalculationRequirementFamilySummary {
  family: string;
  total: number;
  covered: number;
  missing: number;
  mismatched: number;
  byRecordType: Record<MppRecordType, number>;
}

function taskCalculated(fieldIds: string[], family: string): MppCalculationRequirement[] {
  return fieldIds.map((fieldId) => ({
    recordType: "task",
    fieldId,
    expected: "engineCalculated",
    family,
  }));
}

function recordCalculated(
  recordType: MppRecordType,
  fieldIds: string[],
  family: string,
): MppCalculationRequirement[] {
  return fieldIds.map((fieldId) => ({
    recordType,
    fieldId,
    expected: "engineCalculated",
    family,
  }));
}

function recordInput(
  recordType: MppRecordType,
  fieldIds: string[],
  family: string,
): MppCalculationRequirement[] {
  return fieldIds.map((fieldId) => ({
    recordType,
    fieldId,
    expected: "userInput",
    family,
  }));
}

function customFamily(
  recordType: MppRecordType,
  prefixes: string[],
  ranges: Record<string, number>,
): MppCalculationRequirement[] {
  return prefixes.flatMap((prefix) => (
    Array.from({ length: ranges[prefix] ?? 0 }, (_, index) => ({
      recordType,
      fieldId: `${prefix}${index + 1}`,
      expected: "customInput" as const,
      family: "Campos personalizados",
    }))
  ));
}

function enterpriseCustomFamily(recordType: MppRecordType): MppCalculationRequirement[] {
  return [
    ...customFamily(recordType, [
      "Enterprise Cost",
      "Enterprise Date",
      "Enterprise Duration",
      "Enterprise Flag",
      "Enterprise Number",
      "Enterprise Text",
    ], {
      "Enterprise Cost": 10,
      "Enterprise Date": 30,
      "Enterprise Duration": 10,
      "Enterprise Flag": 20,
      "Enterprise Number": 40,
      "Enterprise Text": 40,
    }),
    ...(recordType === "task"
      ? customFamily("task", ["Enterprise Task Outline Code"], { "Enterprise Task Outline Code": 30 })
      : []),
    ...(recordType === "resource" || recordType === "assignment"
      ? customFamily(recordType, ["Enterprise Resource Outline Code"], { "Enterprise Resource Outline Code": 29 })
      : []),
  ];
}

function baselineRequirements(recordType: MppRecordType): MppCalculationRequirement[] {
  const prefixes = ["Baseline", ...Array.from({ length: 11 }, (_, index) => `Baseline${index}`)];
  const core = prefixes.flatMap((prefix) => [
    `${prefix} Start`,
    `${prefix} Finish`,
    `${prefix} Duration`,
    `${prefix} Work`,
    `${prefix} Cost`,
    `${prefix} Budget Work`,
    `${prefix} Budget Cost`,
  ]);
  const estimated = Array.from({ length: 11 }, (_, index) => `Baseline${index}`).flatMap((prefix) => [
    `${prefix} Estimated Start`,
    `${prefix} Estimated Finish`,
    `${prefix} Estimated Duration`,
  ]);
  return recordCalculated(recordType, [...core, ...estimated], "Baseline y variancias");
}

const TASK_CUSTOM_REQUIREMENTS = [
  ...customFamily("task", [
    "Text", "Number", "Date", "Cost", "Duration", "Flag", "Start", "Finish", "Outline Code",
  ], {
    Text: 30,
    Number: 20,
    Date: 10,
    Cost: 10,
    Duration: 10,
    Flag: 20,
    Start: 10,
    Finish: 10,
    "Outline Code": 10,
  }),
  ...enterpriseCustomFamily("task"),
];

export const MPP_CALCULATION_REQUIREMENTS: MppCalculationRequirement[] = [
  ...taskCalculated([
    "Start", "Finish", "Duration", "Early Start", "Early Finish", "Late Start", "Late Finish",
    "Total Slack", "Free Slack", "Start Slack", "Finish Slack", "Negative Slack", "Critical",
    "Successors", "Predecessors", "WBS Predecessors", "WBS Successors",
    "Unique ID Predecessors", "Unique ID Successors",
  ], "Cronograma CPM"),
  ...taskCalculated([
    "Constraint Type", "Constraint Date", "Deadline", "Task Calendar", "Ignore Resource Calendar",
    "Leveling Delay", "Preleveled Start", "Preleveled Finish", "Scheduled Start", "Scheduled Finish",
    "Scheduled Duration", "Task Mode",
  ], "Restricciones y calendario"),
  ...taskCalculated([
    "Summary", "Milestone", "Outline Level", "Outline Number", "WBS", "Rollup",
    "Group By Summary", "Summary Progress", "Task Summary Name",
  ], "Resumen/WBS"),
  ...taskCalculated([
    "% Complete", "% Work Complete", "Physical % Complete", "Actual Start", "Actual Finish",
    "Actual Duration", "Remaining Duration", "Complete Through", "Stop", "Resume",
    "Status", "Status Indicator", "Health",
  ], "Progreso/tracking"),
  ...taskCalculated([
    "Work", "Actual Work", "Remaining Work", "Regular Work", "Overtime Work",
    "Actual Overtime Work", "Remaining Overtime Work", "Peak", "Overallocated",
    "Assignment Units", "Resource Names", "Resource Initials", "Resource Group", "Resource Type",
  ], "Trabajo y recursos"),
  ...recordInput("task", [
    "Fixed Cost", "Fixed Cost Accrual", "Type", "Effort Driven", "Earned Value Method",
    "Work Contour", "Cost Rate Table",
  ], "Entradas base"),
  ...taskCalculated([
    "Cost", "Actual Cost", "Remaining Cost", "Actual Fixed Cost", "Overtime Cost",
    "Actual Overtime Cost", "Remaining Overtime Cost", "Cost Variance",
  ], "Costos"),
  ...baselineRequirements("task"),
  ...taskCalculated([
    "Start Variance", "Finish Variance", "Duration Variance", "Work Variance", "Cost Variance",
  ], "Baseline y variancias"),
  ...taskCalculated([
    "BCWS", "BCWP", "ACWP", "SV", "SV%", "CV", "CV%", "SPI", "CPI", "EAC", "VAC", "TCPI",
  ], "Valor ganado"),
  ...taskCalculated([
    "Work (Timephased)", "Actual Work (Timephased)", "Cost (Timephased)", "Actual Cost (Timephased)",
    "Baseline Work (Timephased)", "Baseline Cost (Timephased)", "Cumulative Work (Timephased)",
    "Cumulative Cost (Timephased)", "Remaining Cumulative Work (Timephased)",
    "Overallocation (Timephased)", "% Complete (Timephased)", "SV (Timephased)", "CV (Timephased)",
    "SPI (Timephased)", "CPI (Timephased)",
  ], "Timephased"),
  ...recordCalculated("resource", [
    "Work", "Actual Work", "Remaining Work", "Regular Work", "Overtime Work", "Actual Overtime Work",
    "Remaining Overtime Work", "Peak", "Overallocated", "Cost", "Actual Cost", "Remaining Cost",
    "BCWS", "BCWP", "ACWP", "SV", "CV", "SPI", "CPI",
  ], "Recursos"),
  ...recordInput("resource", [
    "Standard Rate", "Overtime Rate", "Cost Per Use", "Max Units", "Work Contour", "Cost Rate Table",
  ], "Entradas base"),
  ...baselineRequirements("resource"),
  ...recordCalculated("assignment", [
    "Start", "Finish", "Actual Start", "Actual Finish", "Actual Duration", "Remaining Duration",
    "% Work Complete", "Work", "Actual Work", "Remaining Work", "Regular Work", "Overtime Work",
    "Actual Overtime Work", "Remaining Overtime Work", "Peak", "Overallocated", "Cost", "Actual Cost",
    "Remaining Cost", "BCWS", "BCWP", "ACWP", "SV", "CV", "SPI", "CPI",
  ], "Asignaciones"),
  ...recordInput("assignment", ["Assignment Units", "Cost Rate Table", "Work Contour"], "Entradas base"),
  ...baselineRequirements("assignment"),
  ...TASK_CUSTOM_REQUIREMENTS,
  ...enterpriseCustomFamily("resource"),
  ...enterpriseCustomFamily("assignment"),
];

function actualRequirementStatus(requirement: MppCalculationRequirement): MppCalculationRequirementStatus {
  const spec = getMppCalculatedFieldSpec(requirement.fieldId, requirement.recordType);
  if (!spec) return "missing";
  if (spec.isCalculated) return "engineCalculated";
  return requirement.expected === "customInput" ? "customInput" : "userInput";
}

export function auditMppCalculationRequirements(): MppCalculationRequirementAudit[] {
  return MPP_CALCULATION_REQUIREMENTS.map((requirement) => {
    const actual = actualRequirementStatus(requirement);
    return {
      requirement,
      actual,
      ok: actual === requirement.expected,
    };
  });
}

export function summarizeMppCalculationRequirements(
  audit: MppCalculationRequirementAudit[] = auditMppCalculationRequirements(),
): MppCalculationRequirementFamilySummary[] {
  const summaries = audit.reduce<Map<string, MppCalculationRequirementFamilySummary>>((map, item) => {
    const existing = map.get(item.requirement.family) ?? {
      family: item.requirement.family,
      total: 0,
      covered: 0,
      missing: 0,
      mismatched: 0,
      byRecordType: {
        task: 0,
        resource: 0,
        assignment: 0,
      },
    };

    existing.total += 1;
    existing.byRecordType[item.requirement.recordType] += 1;
    if (item.ok) {
      existing.covered += 1;
    } else if (item.actual === "missing") {
      existing.missing += 1;
    } else {
      existing.mismatched += 1;
    }

    map.set(item.requirement.family, existing);
    return map;
  }, new Map());

  return Array.from(summaries.values()).sort((left, right) =>
    left.family.localeCompare(right.family, "es"),
  );
}
