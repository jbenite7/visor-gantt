import type {
  MppCalculationKind,
  MppColumnDataType,
  MppCustomFieldDefinition,
  MppRecordColumn,
  MppRecordType,
} from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";
import { normalizeMppFieldId } from "./fieldLabels";

export type MppFieldInspectionErrorKind = "formula" | "lookup" | "unsupported";

export interface MppFieldInspectionError {
  kind: MppFieldInspectionErrorKind;
  message: string;
}

export interface MppFieldInspection {
  fieldId: string;
  label: string;
  value: unknown;
  dataType: MppColumnDataType;
  recordType?: MppRecordType;
  isEditable: boolean;
  isCalculated: boolean;
  calculationKind: MppCalculationKind;
  sourceOfTruth?: "engine" | "mppImport" | "user" | "customFormula";
  formula?: string;
  dependencies?: string[];
  rollupType?: string;
  lastCalculatedAt?: string;
  lookupValues?: Array<string | number | boolean>;
  graphicalIndicators?: unknown;
  errors: MppFieldInspectionError[];
}

interface InspectMppFieldInput {
  record: object & {
    mppFields?: Record<string, unknown>;
  };
  column: MppRecordColumn;
  customFieldDefinitions?: MppCustomFieldDefinition[];
  locale?: UILocale;
}

function readRecordField(
  record: InspectMppFieldInput["record"],
  column: MppRecordColumn,
): unknown {
  const normalizedFieldId = normalizeMppFieldId(column.fieldId);
  const recordObject = record as Record<string, unknown>;
  const candidates = [
    column.fieldId,
    column.sourceKey,
    normalizedFieldId,
  ].filter(Boolean);

  for (const key of candidates) {
    const value = record.mppFields?.[key] ?? recordObject[key];
    if (value !== undefined) return value;
  }

  const entries = [
    ...Object.entries(record.mppFields ?? {}),
    ...Object.entries(recordObject),
  ];
  return entries.find(([key]) => normalizeMppFieldId(key) === normalizedFieldId)?.[1];
}

function readMaterializedError(
  fields: Record<string, unknown>,
  fieldId: string,
  suffix: string,
): string | undefined {
  const errorFieldId = `${normalizeMppFieldId(fieldId)}_${suffix}`;
  const value = fields[errorFieldId];
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

function customDefinitionFor(
  column: MppRecordColumn,
  customFieldDefinitions: MppCustomFieldDefinition[],
): MppCustomFieldDefinition | undefined {
  const fieldId = normalizeMppFieldId(column.fieldId);
  return customFieldDefinitions.find((definition) => (
    normalizeMppFieldId(definition.fieldId) === fieldId &&
    (!column.recordType || definition.recordType === column.recordType)
  ));
}

export function inspectMppField({
  record,
  column,
  customFieldDefinitions = [],
  locale = "es",
}: InspectMppFieldInput): MppFieldInspection {
  const fieldId = normalizeMppFieldId(column.fieldId);
  const definition = customDefinitionFor(column, customFieldDefinitions);
  const calculationSpec = column.calculationSpec;
  const fields = record.mppFields ?? {};
  const errors: MppFieldInspectionError[] = [];
  const unsupportedReason = calculationSpec?.unsupportedReason;
  const formulaError = readMaterializedError(fields, fieldId, "FORMULA_ERROR");
  const lookupError = readMaterializedError(fields, fieldId, "LOOKUP_ERROR");

  if (unsupportedReason) {
    errors.push({
      kind: "unsupported",
      message: unsupportedReason,
    });
  }
  if (formulaError) {
    errors.push({
      kind: "formula",
      message: formulaError,
    });
  }
  if (lookupError) {
    errors.push({
      kind: "lookup",
      message: lookupError,
    });
  }

  return {
    fieldId,
    label: locale === "en" ? column.labelEn : column.labelEs,
    value: readRecordField(record, column),
    dataType: column.dataType,
    recordType: column.recordType,
    isEditable: column.isEditable,
    isCalculated: calculationSpec?.isCalculated ?? false,
    calculationKind: calculationSpec?.calculationKind ?? "input",
    sourceOfTruth: calculationSpec?.sourceOfTruth,
    formula: calculationSpec?.formula ?? definition?.formula,
    dependencies: calculationSpec?.dependencies ?? definition?.dependencies,
    rollupType: calculationSpec?.rollupType ?? definition?.rollupType,
    lastCalculatedAt: calculationSpec?.lastCalculatedAt,
    lookupValues: definition?.lookupValues,
    graphicalIndicators: definition?.graphicalIndicators,
    errors,
  };
}
