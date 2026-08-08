import { significantTokens } from "./normalize";

/**
 * Similitud mínima de nombre (Jaccard sobre palabras) para dar un
 * emparejamiento por bueno.
 *
 * Es el mismo 0,33 de `AmarreCronogramaService::SIMILITUD_MINIMA` de PDC V2,
 * y a propósito: con este valor «URBANISMO Y OBRAS EXTERIORES» (3 palabras)
 * alcanza «URBANISMO» (1 palabra) con 1/3 = 0,3333, que es el caso límite
 * que el umbral tiene que dejar pasar.
 */
export const SIMILARITY_THRESHOLD = 0.33;

export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const common = tokensA.filter((token) => setB.has(token)).length;
  if (common === 0) return 0;

  const union = new Set([...tokensA, ...tokensB]).size;
  return common / union;
}

/**
 * Candidato más parecido por palabras. Empate: gana el primero de la lista,
 * porque el orden que llega ya es el orden del cronograma.
 */
export function bestMatchByTokens<T>(
  name: string,
  candidates: T[],
  getName: (candidate: T) => string,
  threshold: number = SIMILARITY_THRESHOLD,
): { candidate: T; score: number } | null {
  let best: { candidate: T; score: number } | null = null;

  for (const candidate of candidates) {
    const score = jaccardSimilarity(name, getName(candidate));
    if (score > (best?.score ?? 0)) {
      best = { candidate, score };
    }
  }

  return best && best.score >= threshold ? best : null;
}
