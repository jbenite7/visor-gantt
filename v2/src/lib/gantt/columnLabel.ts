/**
 * Título largo o forma corta, según el ancho que hay.
 *
 * Antes se recortaba con `text-overflow: ellipsis`, que parte la palabra a la
 * mitad: «Predeceso…» no es un encabezado, es un accidente. La abreviatura la
 * declara cada columna; aquí solo se decide cuál de las dos cabe.
 *
 * El ancho de carácter es una estimación deliberada, no una medición del DOM:
 * medir obligaría a montar la tabla para probar esta decisión, y la decisión
 * no depende del DOM.
 *
 * Las dos constantes están **medidas en producción** sobre el encabezado real
 * (600 12px, `text-transform: uppercase`, `letter-spacing: 0.48px`): el ancho
 * medio por carácter de «Predecesoras» es 6,76 px, y sumarle el interletraje
 * da 7,24. El `padding-inline` es de 10 px por lado, no de 8: usar 16 hacía
 * creer que cabían 4 px que no existen, y un título que se pasa por 4 px es
 * exactamente el que se corta a mitad de palabra.
 */
export const COLUMN_LABEL_CHAR_WIDTH = 7.2;

/** Los dos lados del `padding-inline` del encabezado: 10 px cada uno, medidos. */
export const COLUMN_LABEL_PADDING = 20;

export function pickColumnLabel(input: {
  label: string;
  shortLabel?: string;
  width: number;
  charWidth?: number;
}): string {
  const { label, shortLabel, width } = input;
  if (!shortLabel || shortLabel === label) return label;
  // Ancho desconocido: no hay motivo para degradar el título.
  if (!Number.isFinite(width) || width <= 0) return label;

  const charWidth = input.charWidth ?? COLUMN_LABEL_CHAR_WIDTH;
  const available = width - COLUMN_LABEL_PADDING;
  return label.length * charWidth <= available ? label : shortLabel;
}
