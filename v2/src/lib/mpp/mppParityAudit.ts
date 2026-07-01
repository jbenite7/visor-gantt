import type { MppRecordType } from "@/types/mppColumns";
import { normalizeMppFieldId } from "./fieldLabels";
import { getMppRecordValue } from "./recordValues";

export type MppParityStatus =
  | "match"
  | "missingImported"
  | "missingCalculated"
  | "mismatch"
  | "skipped";

export interface MppParityRecordLike {
  id?: unknown;
  uid?: unknown;
  UID?: unknown;
  uniqueId?: unknown;
  mppFields?: Record<string, unknown>;
}

export interface MppParityFieldResult {
  fieldId: string;
  status: MppParityStatus;
  importedValue?: unknown;
  calculatedValue?: unknown;
  difference?: number;
  reason?: string;
}

export interface MppParitySummary {
  total: number;
  match: number;
  missingImported: number;
  missingCalculated: number;
  mismatch: number;
  skipped: number;
}

export interface MppParityRecordResult {
  recordId: string;
  recordType: MppRecordType;
  fields: MppParityFieldResult[];
  summary: MppParitySummary;
}

export interface MppParityAuditResult {
  recordType: MppRecordType;
  records: MppParityRecordResult[];
  summary: MppParitySummary;
}

export interface MppParityAuditInput {
  recordType: MppRecordType;
  importedRecords: MppParityRecordLike[];
  calculatedRecords: MppParityRecordLike[];
  fields: string[];
  keyField?: string;
  skipFields?: string[];
  numericTolerance?: number;
  dateToleranceMs?: number;
  durationToleranceHours?: number;
}

const EMPTY_SUMMARY: MppParitySummary = {
  total: 0,
  match: 0,
  missingImported: 0,
  missingCalculated: 0,
  mismatch: 0,
  skipped: 0,
};

export function auditMppParity(input: MppParityAuditInput): MppParityAuditResult {
  const skipFields = new Set((input.skipFields ?? []).map(normalizeMppFieldId));
  const calculatedByKey = new Map(input.calculatedRecords.map((record) => [recordKey(record, input.keyField), record]));
  const importedKeys = new Set(input.importedRecords.map((record) => recordKey(record, input.keyField)));
  const importedResults = input.importedRecords.map((importedRecord) => {
    const recordId = recordKey(importedRecord, input.keyField);
    const calculatedRecord = calculatedByKey.get(recordId);
    const fields = input.fields.map((fieldId) => {
      const normalizedFieldId = normalizeMppFieldId(fieldId);
      if (skipFields.has(normalizedFieldId)) {
        return fieldResult(normalizedFieldId, "skipped", undefined, undefined, undefined, "Campo excluido de la auditoria");
      }
      if (!calculatedRecord) {
        return fieldResult(normalizedFieldId, "missingCalculated", getMppRecordValue(importedRecord, fieldId));
      }
      return compareField(importedRecord, calculatedRecord, normalizedFieldId, input);
    });

    return {
      recordId,
      recordType: input.recordType,
      fields,
      summary: summarize(fields),
    };
  });
  const extraCalculatedResults = input.calculatedRecords
    .filter((calculatedRecord) => !importedKeys.has(recordKey(calculatedRecord, input.keyField)))
    .map((calculatedRecord) => {
      const recordId = recordKey(calculatedRecord, input.keyField);
      const fields = input.fields.map((fieldId) => {
        const normalizedFieldId = normalizeMppFieldId(fieldId);
        if (skipFields.has(normalizedFieldId)) {
          return fieldResult(normalizedFieldId, "skipped", undefined, undefined, undefined, "Campo excluido de la auditoria");
        }
        return compareField({}, calculatedRecord, normalizedFieldId, input);
      });
      return {
        recordId,
        recordType: input.recordType,
        fields,
        summary: summarize(fields),
      };
    });
  const records = [...importedResults, ...extraCalculatedResults];

  return {
    recordType: input.recordType,
    records,
    summary: summarize(records.flatMap((record) => record.fields)),
  };
}

function compareField(
  importedRecord: MppParityRecordLike,
  calculatedRecord: MppParityRecordLike,
  normalizedFieldId: string,
  input: MppParityAuditInput,
): MppParityFieldResult {
  const importedValue = getMppRecordValue(importedRecord, normalizedFieldId);
  const calculatedValue = getMppRecordValue(calculatedRecord, normalizedFieldId);

  if (isBlank(importedValue) && isBlank(calculatedValue)) {
    return fieldResult(normalizedFieldId, "skipped", importedValue, calculatedValue, undefined, "Sin valor importado ni calculado");
  }
  if (isBlank(importedValue)) {
    return fieldResult(normalizedFieldId, "missingImported", importedValue, calculatedValue);
  }
  if (isBlank(calculatedValue)) {
    return fieldResult(normalizedFieldId, "missingCalculated", importedValue, calculatedValue);
  }

  const comparison = compareValues(importedValue, calculatedValue, normalizedFieldId, input);
  if (comparison.match) {
    return fieldResult(normalizedFieldId, "match", importedValue, calculatedValue, comparison.difference);
  }

  return fieldResult(
    normalizedFieldId,
    "mismatch",
    importedValue,
    calculatedValue,
    comparison.difference,
    comparison.reason,
  );
}

function compareValues(
  importedValue: unknown,
  calculatedValue: unknown,
  fieldId: string,
  input: MppParityAuditInput,
): { match: boolean; difference?: number; reason?: string } {
  const importedDuration = parseDurationValue(importedValue, fieldId);
  const calculatedDuration = parseDurationValue(calculatedValue, fieldId);
  if (isDurationField(fieldId) && importedDuration !== undefined && calculatedDuration !== undefined) {
    const difference = Math.abs(importedDuration.value - calculatedDuration.value);
    return {
      match: difference <= (input.durationToleranceHours ?? 1e-6),
      difference,
      reason: `Diferencia de duracion ${difference} ${importedDuration.unit}`,
    };
  }

  const importedDate = parseDateMs(importedValue);
  const calculatedDate = parseDateMs(calculatedValue);
  if (importedDate !== undefined && calculatedDate !== undefined) {
    const difference = Math.abs(importedDate - calculatedDate);
    return {
      match: difference <= (input.dateToleranceMs ?? 60_000),
      difference,
      reason: `Diferencia de fecha ${difference} ms`,
    };
  }

  const importedNumber = parseComparableNumber(importedValue);
  const calculatedNumber = parseComparableNumber(calculatedValue);
  if (importedNumber !== undefined && calculatedNumber !== undefined) {
    const difference = Math.abs(importedNumber - calculatedNumber);
    return {
      match: difference <= (input.numericTolerance ?? 1e-6),
      difference,
      reason: `Diferencia numerica ${difference}`,
    };
  }

  const importedBoolean = parseBoolean(importedValue);
  const calculatedBoolean = parseBoolean(calculatedValue);
  if (importedBoolean !== undefined && calculatedBoolean !== undefined) {
    return { match: importedBoolean === calculatedBoolean, reason: "Booleanos diferentes" };
  }

  const importedString = normalizeText(importedValue);
  const calculatedString = normalizeText(calculatedValue);
  return {
    match: importedString === calculatedString,
    reason: `Texto diferente: ${importedString} != ${calculatedString}`,
  };
}

function fieldResult(
  fieldId: string,
  status: MppParityStatus,
  importedValue?: unknown,
  calculatedValue?: unknown,
  difference?: number,
  reason?: string,
): MppParityFieldResult {
  return { fieldId, status, importedValue, calculatedValue, difference, reason };
}

function summarize(fields: MppParityFieldResult[]): MppParitySummary {
  return fields.reduce(
    (summary, field) => ({
      ...summary,
      total: summary.total + 1,
      [field.status]: summary[field.status] + 1,
    }),
    { ...EMPTY_SUMMARY },
  );
}

function recordKey(record: MppParityRecordLike, keyField?: string): string {
  if (keyField) return String(getMppRecordValue(record, keyField) ?? "");
  return String(
    getMppRecordValue(record, "UNIQUE_ID")
      ?? getMppRecordValue(record, "UID")
      ?? record.uniqueId
      ?? record.uid
      ?? record.id
      ?? "",
  );
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function parseComparableNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parseDateMs(value: unknown): number | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/\d{4}-\d{2}-\d{2}/.test(trimmed)) return undefined;
  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function parseDurationValue(value: unknown, fieldId: string): { value: number; unit: "hours" | "days" } | undefined {
  if (!isDurationField(fieldId)) return undefined;
  const unit = isWorkField(fieldId) ? "hours" : "days";
  if (typeof value === "number" && Number.isFinite(value)) return { value, unit };
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^P(?:T)?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (isoMatch) {
    const hours = Number(isoMatch[1] ?? 0) + Number(isoMatch[2] ?? 0) / 60 + Number(isoMatch[3] ?? 0) / 3600;
    return { value: unit === "hours" ? hours : hours / 8, unit };
  }
  const durationMatch = trimmed.match(/^(-?\d+(?:[.,]\d+)?)\s*(m|min|h|hr|hrs|d|day|days|w|wk|week|weeks)$/i);
  if (!durationMatch) return undefined;
  const amount = Number(durationMatch[1].replace(",", "."));
  if (!Number.isFinite(amount)) return undefined;
  const sourceUnit = durationMatch[2].toLowerCase();
  const hours = durationToHours(amount, sourceUnit);
  return { value: unit === "hours" ? hours : hours / 8, unit };
}

function durationToHours(amount: number, unit: string): number {
  if (unit.startsWith("m")) return amount / 60;
  if (unit.startsWith("h")) return amount;
  if (unit.startsWith("d") || unit === "day" || unit === "days") return amount * 8;
  return amount * 40;
}

function isDurationField(fieldId: string): boolean {
  return /(DURATION|WORK|SLACK|DELAY)$/.test(fieldId) || fieldId.includes("_WORK") || fieldId.includes("_DURATION");
}

function isWorkField(fieldId: string): boolean {
  return fieldId === "WORK" || fieldId.endsWith("_WORK") || fieldId.includes("_WORK_");
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["yes", "true", "si", "sí", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return undefined;
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}
