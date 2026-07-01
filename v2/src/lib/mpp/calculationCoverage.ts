import type {
  MppCalculationKind,
  MppRecordType,
} from "@/types/mppColumns";
import { getMppCalculatedFieldSpec } from "./calculatedFields";
import { getStandardMppColumns } from "./standardFields";

export type MppCalculationCoverageStatus =
  | "engineCalculated"
  | "userInput"
  | "customInput"
  | "passiveImport";

export interface MppCalculationCoverageEntry {
  recordType: MppRecordType;
  fieldId: string;
  labelEn: string;
  labelEs: string;
  status: MppCalculationCoverageStatus;
  calculationKind?: MppCalculationKind;
  dependencies: string[];
  isCalculated: boolean;
  isEditable: boolean;
  sourceOfTruth: "engine" | "mppImport" | "user" | "customFormula";
}

export interface MppCalculationCoverageSummary {
  recordType: MppRecordType;
  total: number;
  engineCalculated: number;
  userInput: number;
  customInput: number;
  passiveImport: number;
}

function coverageStatus(
  column: ReturnType<typeof getStandardMppColumns>[number],
  spec: ReturnType<typeof getMppCalculatedFieldSpec>,
): MppCalculationCoverageStatus {
  if (spec?.isCalculated) return "engineCalculated";
  if (column.isCustom) return "customInput";
  if (spec?.sourceOfTruth === "user") return "userInput";
  return "passiveImport";
}

export function getMppCalculationCoverage(recordType: MppRecordType): MppCalculationCoverageEntry[] {
  return getStandardMppColumns(recordType).map((column) => {
    const fieldId = column.fieldId ?? column.sourceKey ?? column.key ?? "";
    const spec = getMppCalculatedFieldSpec(fieldId, recordType);
    const status = coverageStatus(column, spec);
    const isEditable = spec
      ? !spec.isCalculated || spec.isEditableWhenCalculated
      : Boolean(column.isEditable);

    return {
      recordType,
      fieldId,
      labelEn: column.labelEn ?? column.fieldId ?? column.sourceKey ?? "",
      labelEs: column.labelEs ?? column.labelEn ?? column.fieldId ?? column.sourceKey ?? "",
      status,
      calculationKind: spec?.calculationKind,
      dependencies: spec?.dependencies ?? [],
      isCalculated: spec?.isCalculated ?? false,
      isEditable,
      sourceOfTruth: spec?.sourceOfTruth ?? (column.isEditable ? "user" : "mppImport"),
    };
  });
}

export function summarizeMppCalculationCoverage(
  recordType: MppRecordType,
): MppCalculationCoverageSummary {
  const entries = getMppCalculationCoverage(recordType);
  return entries.reduce<MppCalculationCoverageSummary>((summary, entry) => ({
    ...summary,
    [entry.status]: summary[entry.status] + 1,
  }), {
    recordType,
    total: entries.length,
    engineCalculated: 0,
    userInput: 0,
    customInput: 0,
    passiveImport: 0,
  });
}

export function getAllMppCalculationCoverage(): MppCalculationCoverageEntry[] {
  return [
    ...getMppCalculationCoverage("task"),
    ...getMppCalculationCoverage("resource"),
    ...getMppCalculationCoverage("assignment"),
  ];
}
