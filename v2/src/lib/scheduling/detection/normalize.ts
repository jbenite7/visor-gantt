/**
 * Normalización compartida por todo el motor de detección.
 *
 * Es el puerto de `MaestroInsumosService::normalizar` de PDC V2 (`lps-aia`):
 * mayúsculas, sin tildes, sin espacios de más. Presupuesto y cronograma
 * escriben el mismo oficio de cinco maneras distintas; sin este paso, la
 * comparación mide ortografía en vez de significado.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Palabras que no distinguen un oficio de otro. Las de una o dos letras
 * («Y», «DE», «EN») se filtran por longitud; estas son las que sobreviven
 * a ese filtro. Copiadas de `AmarreCronogramaService::VACIAS`.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "DEL",
  "LOS",
  "LAS",
  "CON",
  "PARA",
  "POR",
  "SIN",
  "SUS",
  "QUE",
]);

export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palabras significativas de un nombre: sin puntuación, sin partículas y
 * sin repetidos. Es la unidad de medida de la similitud de Jaccard.
 */
export function significantTokens(raw: string): string[] {
  const words = normalizeName(raw)
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return [...new Set(words)];
}
