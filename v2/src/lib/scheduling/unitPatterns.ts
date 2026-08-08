import type { GanttTask } from "@/components/gantt/types";
import { LOCATION_PATTERNS, extractLocation } from "./detection/location";

/**
 * Lista única de patrones de unidad de producción.
 *
 * Ya no se define aquí: vive en el motor de detección
 * (`detection/location.ts`), portado de PDC V2, que además de la etiqueta
 * devuelve un número ordenable y reconoce los sótanos —los 44 casos que
 * fallaban en el archivo real de obra—. Se conserva la exportación porque
 * `lob.ts` y `typicalUnit.ts` recorren la lista para limpiar nombres.
 */
export const UNIT_PATTERNS: Array<{ label: string; regex: RegExp }> =
  LOCATION_PATTERNS.map(({ label, regex }) => ({ label, regex }));

export interface UnitMatch {
  label: string;
  /** El texto tal cual salió del nombre. */
  value: string;
  /** Número ordenable. Los sótanos son negativos; la cubierta, 900. */
  numericValue: number;
}

export function extractUnitLabel(text: string): UnitMatch | null {
  const location = extractLocation(text);
  if (!location) return null;
  return {
    label: location.label,
    value: location.raw,
    numericValue: location.value,
  };
}

/**
 * Build the breadcrumb of ancestor summary task names for a given wbs,
 * derived from prefixes of its dotted wbs path (root → leaf).
 *
 * Moved here from `lob.ts` so it can be reused by `typicalUnit.ts`
 * without duplicating the implementation.
 */
export function buildWbsBreadcrumb(wbs: string | undefined, tasks: GanttTask[]): string[] {
  const parts = wbs?.split(".").map((part) => part.trim()).filter(Boolean) ?? [];
  if (parts.length <= 1) return [];

  const nameByWbs = new Map<string, string>();
  for (const task of tasks) {
    if (task.wbs) nameByWbs.set(task.wbs, task.name);
  }

  const breadcrumb: string[] = [];
  for (let depth = 1; depth < parts.length; depth += 1) {
    const ancestorWbs = parts.slice(0, depth).join(".");
    const name = nameByWbs.get(ancestorWbs);
    if (name) breadcrumb.push(name);
  }
  return breadcrumb;
}
