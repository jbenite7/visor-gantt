import { normalizeName } from "./normalize";

/**
 * Lo que el usuario corrige a mano, guardado para que el motor no vuelva a
 * equivocarse igual.
 *
 * Va **antes** que lo automático, no como último recurso. La razón está
 * medida en PDC V2: sobre 820 filas reales el emparejamiento por nombre
 * acierta una, y el texto engaña con seguridad — «carpintería metálica» se
 * parece a «carpintería en madera» y no son lo mismo. Una corrección humana
 * no se equivoca por parecido.
 *
 * El motor no sabe dónde se guarda esto: lo recibe y devuelve uno nuevo. Así
 * la persistencia vive fuera y este módulo se puede probar entero sin estado.
 */
export type DetectionKind = "ubicacion" | "sistema";

export interface DetectionCorrection {
  kind: DetectionKind;
  /** Nombre normalizado sobre el que se busca. */
  key: string;
  value: string;
  /** Por qué se corrigió. Sin esto, en seis meses nadie sabe si sigue haciendo falta. */
  note: string;
  recordedAt: string;
}

export interface DetectionDictionary {
  corrections: DetectionCorrection[];
}

export const EMPTY_DETECTION_DICTIONARY: DetectionDictionary = { corrections: [] };

export function lookupCorrection(
  dictionary: DetectionDictionary | undefined,
  kind: DetectionKind,
  name: string,
): DetectionCorrection | undefined {
  if (!dictionary) return undefined;
  const key = normalizeName(name);
  return dictionary.corrections.find(
    (correction) => correction.kind === kind && correction.key === key,
  );
}

export function rememberCorrection(
  dictionary: DetectionDictionary | undefined,
  input: {
    kind: DetectionKind;
    name: string;
    value: string;
    note: string;
    recordedAt: string;
  },
): DetectionDictionary {
  const correction: DetectionCorrection = {
    kind: input.kind,
    key: normalizeName(input.name),
    value: input.value,
    note: input.note,
    recordedAt: input.recordedAt,
  };

  const rest = (dictionary?.corrections ?? []).filter(
    (item) => !(item.kind === correction.kind && item.key === correction.key),
  );

  return { corrections: [...rest, correction] };
}
