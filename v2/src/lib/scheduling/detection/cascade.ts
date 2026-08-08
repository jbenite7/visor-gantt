import { normalizeName } from "./normalize";
import { bestMatchByTokens } from "./similarity";
import { lookupCorrection, type DetectionDictionary } from "./dictionary";

/**
 * De dónde salió una resolución. Se guarda con el resultado porque un motor
 * que no explica por qué acertó tampoco se puede auditar cuando falla.
 */
export type DetectionOrigin =
  | "diccionario"
  | "exacta"
  | "similitud"
  | "automatica"
  | "sin_resolver";

export interface SystemResolution {
  system: string | null;
  origin: DetectionOrigin;
  /** Puntuación de similitud, solo cuando el origen es «similitud». */
  score?: number;
  /** Frase en lenguaje de obra que explica la decisión. */
  evidence: string;
}

/**
 * Cascada portada de `AmarreCronogramaService::resolverCodigo` de PDC V2:
 * gana el primero que acierta, de lo más específico a lo más general.
 */
export function resolveSystem({
  name,
  candidates,
  dictionary,
  automatic,
}: {
  name: string;
  candidates: string[];
  dictionary?: DetectionDictionary;
  automatic?: () => string | null;
}): SystemResolution {
  const correction = lookupCorrection(dictionary, "sistema", name);
  if (correction) {
    return {
      system: correction.value,
      origin: "diccionario",
      evidence: `«${name}» se asigna a «${correction.value}» por una corrección guardada: ${correction.note}`,
    };
  }

  const normalized = normalizeName(name);
  const exact = candidates.find(
    (candidate) => normalizeName(candidate) === normalized,
  );
  if (exact) {
    return {
      system: exact,
      origin: "exacta",
      evidence: `«${name}» se llama igual que «${exact}».`,
    };
  }

  const similar = bestMatchByTokens(name, candidates, (candidate) => candidate);
  if (similar) {
    return {
      system: similar.candidate,
      origin: "similitud",
      score: similar.score,
      evidence: `«${name}» se parece a «${similar.candidate}» (${Math.round(similar.score * 100)} % de palabras en común).`,
    };
  }

  const automaticSystem = automatic?.() ?? null;
  if (automaticSystem) {
    return {
      system: automaticSystem,
      origin: "automatica",
      evidence: `«${name}» se clasificó como «${automaticSystem}» por las reglas de oficio.`,
    };
  }

  return {
    system: null,
    origin: "sin_resolver",
    evidence: `No se pudo asignar sistema a «${name}»: se probó el diccionario de correcciones, el nombre exacto, la similitud de palabras y las reglas de oficio.`,
  };
}
