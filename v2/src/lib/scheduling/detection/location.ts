import { normalizeName } from "./normalize";

/**
 * Ubicación detectada en un nombre de tarea.
 *
 * `value` es lo que hoy falta en visor-gantt y lo que aporta el extractor de
 * PDC V2 (`ActivityMatcherService::extractLocationValue`): un número
 * **ordenable**. Sin él, «SÓTANO 3» se ordena como texto y acaba después del
 * «PISO 12», que es justo al revés de como se construye una obra.
 */
export interface LocationMatch {
  /** Etiqueta para agrupar y mostrar: «Piso», «Sótano», «Torre»… */
  label: string;
  /** El texto tal cual salió del nombre. */
  raw: string;
  /** Número ordenable. Los sótanos son negativos. */
  value: number;
}

export interface LocationPattern {
  label: string;
  regex: RegExp;
  valueOf: (match: RegExpMatchArray) => number;
}

const numeric = (match: RegExpMatchArray): number => Number(match[1]);

/**
 * Patrones en orden de prioridad: gana el primero que acierta.
 *
 * Todos llevan la bandera `i` aunque `extractLocation` ya normalice a
 * mayúsculas: `lob.ts` los reutiliza tal cual sobre texto ya en minúsculas
 * para limpiar el nombre de la actividad. Sin `i`, ahí no casaría ninguno.
 */
export const LOCATION_PATTERNS: LocationPattern[] = [
  {
    label: "Piso",
    regex: /\b(?:PISO|NIVEL|PLANTA)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Etapa",
    regex: /\b(?:ETAPA|FASE)\s*[-#:]?\s*(\d+)\b/i,
    valueOf: numeric,
  },
  {
    label: "Sótano",
    regex: /\bSOTANO\s*[-#:]?\s*(\d+)\b/i,
    valueOf: (match) => -Number(match[1]),
  },
];

export function extractLocation(text: string): LocationMatch | null {
  const normalized = normalizeName(text);
  for (const pattern of LOCATION_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (!match) continue;
    const value = pattern.valueOf(match);
    if (!Number.isFinite(value)) continue;
    return { label: pattern.label, raw: match[1] ?? match[0], value };
  }
  return null;
}
