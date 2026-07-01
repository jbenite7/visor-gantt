import type { MppColumnDataType } from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";
import { normalizeMppFieldId } from "./fieldLabels";

export interface MppRecordLike {
  mppFields?: Record<string, unknown>;
}

export function getMppRecordValue(record: MppRecordLike, sourceKey: string): unknown {
  const direct = record.mppFields?.[sourceKey] ?? (record as Record<string, unknown>)[sourceKey];
  if (direct !== undefined) return direct;

  const normalizedSourceKey = normalizeMppFieldId(sourceKey);
  const entries = [
    ...Object.entries(record.mppFields ?? {}),
    ...Object.entries(record as Record<string, unknown>),
  ];
  return entries.find(([key]) => normalizeMppFieldId(key) === normalizedSourceKey)?.[1];
}

export function formatMppValue(
  value: unknown,
  dataType?: MppColumnDataType | string,
  locale: UILocale = "es",
): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") {
    if (locale === "en") return value ? "Yes" : "No";
    return value ? "Si" : "No";
  }
  if (Array.isArray(value)) return value.map((item) => formatMppValue(item, dataType, locale)).join(", ");
  if (value instanceof Date) return value.toLocaleDateString(locale === "en" ? "en-US" : "es-CO");
  if (typeof value === "object") return JSON.stringify(value);

  const type = String(dataType ?? "").toLowerCase();
  if (type === "date") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(locale === "en" ? "en-US" : "es-CO");
    }
  }

  return String(value);
}
