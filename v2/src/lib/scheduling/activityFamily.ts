import type { GanttTask } from "@/components/gantt/types";

export type ActivityFamily =
  | "Estructura"
  | "Arquitectura"
  | "Redes MEP"
  | "Urbanismo"
  | "Preliminares";

export type FamilyMatchSource = "wbs" | "breadcrumb" | "name" | "none";

export interface ActivityFamilyResult {
  family: ActivityFamily | null;
  matchedBy: FamilyMatchSource;
  confidence: number;
  breadcrumbLevel: number | null;
  reviewReason?: string;
}

export interface ActivityFamilyContext {
  breadcrumb?: string[];
}

const FAMILY_RULES: Array<{ family: ActivityFamily; regex: RegExp }> = [
  { family: "Estructura", regex: /\b(?:estructura|cimentaci|columna|viga|losa|placa|pantalla|concreto|acero)/i },
  { family: "Arquitectura", regex: /\b(?:arquitectur|mamposter|acabado|enchape|pintura|carpinter|fachada|muro|piso ceramic)/i },
  { family: "Redes MEP", regex: /\b(?:mep|hidraul|sanitar|electric|ventilaci|aire acondicionado|gas|red(?:es)? interior)/i },
  { family: "Urbanismo", regex: /\b(?:urbanismo|via|vias|zona(?:s)? comun|exterior|paisajismo|andenes?)/i },
  { family: "Preliminares", regex: /\b(?:preliminar|descapote|localizaci|campamento|cerramiento|demolici)/i },
];

const AMBIGUOUS_WORDS = /\b(?:piso|torre|staff|retiro|ejes?|zona)\b/i;

const HIGH_CONFIDENCE = 0.9;
const NAME_CONFIDENCE = 0.75;
const TIE_CONFIDENCE = 0.4;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchFamilies(text: string): ActivityFamily[] {
  const normalized = normalize(text);
  return FAMILY_RULES.filter((rule) => rule.regex.test(normalized)).map(
    (rule) => rule.family,
  );
}

export function classifyActivityFamily(
  task: GanttTask,
  context: ActivityFamilyContext = {},
): ActivityFamilyResult {
  const breadcrumb = context.breadcrumb ?? [];

  for (let level = breadcrumb.length - 1; level >= 0; level -= 1) {
    const matches = matchFamilies(breadcrumb[level]);
    if (matches.length === 1) {
      return {
        family: matches[0],
        matchedBy: "breadcrumb",
        confidence: HIGH_CONFIDENCE,
        breadcrumbLevel: level,
      };
    }
  }

  const wbsMatches = task.wbs ? matchFamilies(task.wbs) : [];
  if (wbsMatches.length === 1) {
    return {
      family: wbsMatches[0],
      matchedBy: "wbs",
      confidence: HIGH_CONFIDENCE,
      breadcrumbLevel: null,
    };
  }

  const nameMatches = matchFamilies(task.name);

  if (nameMatches.length === 1) {
    return {
      family: nameMatches[0],
      matchedBy: "name",
      confidence: NAME_CONFIDENCE,
      breadcrumbLevel: null,
    };
  }

  if (nameMatches.length > 1) {
    return {
      family: null,
      matchedBy: "none",
      confidence: TIE_CONFIDENCE,
      breadcrumbLevel: null,
      reviewReason: `El nombre coincide con varias familias (${nameMatches.join(", ")}). Revisa la clasificacion manualmente.`,
    };
  }

  if (AMBIGUOUS_WORDS.test(normalize(task.name))) {
    return {
      family: null,
      matchedBy: "none",
      confidence: 0,
      breadcrumbLevel: null,
      reviewReason:
        "El nombre solo contiene una referencia de ubicacion. Falta clasificacion por WBS o capitulo.",
    };
  }

  return {
    family: null,
    matchedBy: "none",
    confidence: 0,
    breadcrumbLevel: null,
    reviewReason: "Ninguna regla de familia coincide. Revisa la clasificacion manualmente.",
  };
}
