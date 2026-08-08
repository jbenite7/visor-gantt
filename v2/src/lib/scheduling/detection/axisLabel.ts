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
 * Ordena por familia y luego por índice.
 *
 * Comparar «A» con «03» no significa nada, y esto no finge que sí: agrupa por
 * familia y ordena dentro de cada una. Es lo único defendible sin conocer la
 * geometría real de la obra.
 */
export function compareAxisLabels(a: AxisLabel, b: AxisLabel): number {
  if (a.family !== b.family) return a.family < b.family ? -1 : 1;
  return a.index - b.index;
}
