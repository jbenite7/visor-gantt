/**
 * Vistas del proyecto.
 *
 * Nueve viven en el menú lateral; `tracking` y `taskSheet` se alcanzan por sus
 * presets de rol, y `network` y `matrix` por la paleta de comandos. `conflictos`
 * quedó absorbida en la vista «Problemas» y ya no se enruta por separado, pero
 * el valor se conserva porque proyectos guardados pueden traerlo en sus ajustes.
 */
export type ViewType =
  | "gantt"
  | "executive"
  | "tracking"
  | "taskSheet"
  | "network"
  | "resources"
  | "lob"
  | "matrix"
  | "scurve"
  | "bottlenecks"
  | "conflictos"
  | "unidadTipica"
  | "calendario"
  | "settings";
