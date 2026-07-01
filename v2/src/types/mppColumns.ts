import type { UILocale } from "./ui";

export type MppColumnDataType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "duration"
  | "currency"
  | "object";

export type MppRecordType = "task" | "resource" | "assignment";

export type MppCalculationKind =
  | "input"
  | "schedule"
  | "constraint"
  | "rollup"
  | "tracking"
  | "work"
  | "cost"
  | "baseline"
  | "earnedValue"
  | "timephased"
  | "customFormula"
  | "unsupportedFormula";

export interface MppCalculationSpec {
  calculationKind: MppCalculationKind;
  formula?: string;
  dependencies?: string[];
  rollupType?: "sum" | "min" | "max" | "weightedAverage" | "any" | "custom";
  isCalculated: boolean;
  isEditableWhenCalculated: boolean;
  lastCalculatedAt?: string;
  sourceOfTruth?: "engine" | "mppImport" | "user" | "customFormula";
  unsupportedReason?: string;
}

export interface MppRecordColumn {
  key: string;
  fieldId: string;
  sourceKey: string;
  labelEn: string;
  labelEs: string;
  alias?: string;
  dataType: MppColumnDataType;
  group: "basic" | "schedule" | "tracking" | "cost" | "custom" | "other";
  recordType?: MppRecordType;
  isCustom: boolean;
  isCore: boolean;
  isEditable: boolean;
  width?: number;
  calculationSpec?: MppCalculationSpec;
}

export type MppTaskColumn = MppRecordColumn;
export type MppResourceColumn = MppRecordColumn;
export type MppAssignmentColumn = MppRecordColumn;

export interface MppCustomFieldDefinition {
  fieldId: string;
  recordType: MppRecordType;
  alias?: string;
  dataType: MppColumnDataType;
  formula?: string;
  dependencies?: string[];
  rollupType?: string;
  lookupValues?: Array<string | number | boolean>;
  graphicalIndicators?: unknown;
  mask?: string;
  unsupportedFormula?: boolean;
  unsupportedReason?: string;
}

export interface RecordColumnSettings {
  visible: string[];
  widths: Record<string, number>;
  labelLocale: UILocale;
}

export type TaskColumnSettings = RecordColumnSettings;
export type ResourceColumnSettings = RecordColumnSettings;
export type AssignmentColumnSettings = RecordColumnSettings;
