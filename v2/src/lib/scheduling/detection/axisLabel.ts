import { normalizeName } from "./normalize";

/**
 * Una etiqueta de eje de la obra.
 *
 * En un mismo cronograma conviven tres formas de nombrar un eje: letras
 * (`A`…`K`), números (`03`, `07`) y series con prefijo (`DB4`, `DB08`). No
 * son el mismo eje escrito distinto: son **rejillas distintas** de partes
 * distintas de la obra. Por eso se guardan con su familia, y solo se
 * comparan índices dentro de la misma.
 */
export interface AxisLabel {
  /** «» para las letras sueltas, «#» para los números, el prefijo para las series. */
  family: string;
  index: number;
  raw: string;
}

const SINGLE_LETTER = /^([A-Z])$/;
const PLAIN_NUMBER = /^(\d{1,3})$/;
const PREFIXED = /^([A-Z]{1,3})(\d{1,3})$/;

export function parseAxisLabel(raw: string): AxisLabel | null {
  const text = normalizeName(raw);
  if (!text) return null;

  const letter = text.match(SINGLE_LETTER);
  if (letter) {
    return {
      family: "",
      index: letter[1].charCodeAt(0) - "A".charCodeAt(0) + 1,
      raw,
    };
  }

  const number = text.match(PLAIN_NUMBER);
  if (number) {
    return { family: "#", index: Number(number[1]), raw };
  }

  const prefixed = text.match(PREFIXED);
  if (prefixed) {
    return { family: prefixed[1], index: Number(prefixed[2]), raw };
  }

  return null;
}

/**
 * El orden entre familias, declarado a mano.
 *
 * No se ordena por el nombre de la familia porque «#» no es un nombre: es un
 * centinela inventado aquí para los ejes numerados. Ordenarlo como texto
 * dejaría el resultado a merced de un carácter elegido al azar.
 */
function familyRank(family: string): number {
  if (family === "") return 0; // las letras sueltas: la rejilla principal
  if (family === "#") return 2; // los ejes numerados, al final
  return 1; // las series con prefijo («DB»), en medio
}

/**
 * Ordena por familia y luego por índice.
 *
 * Comparar «A» con «03» no significa nada, y esto no finge que sí: agrupa por
 * familia y ordena dentro de cada una. Es lo único defendible sin conocer la
 * geometría real de la obra.
 */
export function compareAxisLabels(a: AxisLabel, b: AxisLabel): number {
  if (a.family !== b.family) {
    const rank = familyRank(a.family) - familyRank(b.family);
    if (rank !== 0) return rank;
    // Dos series con prefijo distinto: por nombre, que aquí sí es un nombre.
    return a.family < b.family ? -1 : 1;
  }
  return a.index - b.index;
}
