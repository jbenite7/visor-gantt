import type { GanttTask } from "@/components/gantt/types";

/**
 * Single, shared list of patterns used to detect a "production unit"
 * (piso, torre, zona, etc.) inside an activity name or WBS code.
 *
 * This used to be duplicated with different contents in `lob.ts` and
 * `typicalUnit.ts`. Keep this the ONLY definition in the project.
 *
 * Note: a lone single-letter pattern like `(?:n|p)\s*(\d+)` was
 * intentionally dropped during unification — a single letter is too
 * prone to false positives (matches inside unrelated words such as
 * "pintura" or "nivelacion" once punctuation/spacing varies). "n" is
 * only kept merged into the "Piso" pattern, alongside its full-word
 * synonyms (piso|nivel|planta), which keeps the useful "N1"/"N-2"
 * shorthand without matching a bare "p".
 */
export const UNIT_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "Piso", regex: /\b(?:piso|nivel|planta|n)\s*[-#:]?\s*([a-z]?\d+)\b/i },
  { label: "Torre", regex: /\b(?:torre|bloque)\s*[-#:]?\s*([a-z0-9]+)\b/i },
  { label: "Apartamento", regex: /\b(?:apartamento|apto|unidad)\s*[-#:]?\s*([a-z0-9]+)\b/i },
  { label: "Zona", regex: /\b(?:zona|sector|area)\s*([a-z0-9]+)\b/i },
  { label: "Lote", regex: /\b(?:lote|manzana)\s*([a-z0-9]+)\b/i },
  { label: "Tramo", regex: /\b(?:tramo|frente)\s*([a-z0-9]+)\b/i },
  { label: "Etapa", regex: /\b(?:etapa|fase)\s*([a-z0-9]+)\b/i },
];

export interface UnitMatch {
  label: string;
  value: string;
}

/**
 * Simple extraction: returns the first matching unit label/value pair
 * found in `text`, or null if none of the patterns match.
 */
export function extractUnitLabel(text: string): UnitMatch | null {
  const normalized = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const pattern of UNIT_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (match?.[1]) {
      return { label: pattern.label, value: match[1].toUpperCase() };
    }
  }
  return null;
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
