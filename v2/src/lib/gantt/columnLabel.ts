/**
 * Título largo o forma corta, según el ancho que hay.
 *
 * Antes se recortaba con `text-overflow: ellipsis`, que parte la palabra a la
 * mitad: «Predeceso…» no es un encabezado, es un accidente. La abreviatura la
 * declara cada columna; aquí solo se decide cuál de las dos cabe.
 *
 * El ancho de carácter es una estimación deliberada, no una medición del DOM:
 * medir obligaría a montar la tabla para probar esta decisión, y la decisión
 * no depende del DOM. 7,2 px es el ancho medio de Montserrat 600 en mayúsculas
 * al tamaño del encabezado (`--gantt-column-header-font-size`).
 */
export const COLUMN_LABEL_CHAR_WIDTH = 7.2;

/** Los dos lados del `padding-inline` del encabezado. */
export const COLUMN_LABEL_PADDING = 16;

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
