import type { SaveStatus } from "./saveStatusLabel";

/**
 * ¿Hay que preguntar antes de cerrar?
 *
 * Solo si algo se puede perder. Preguntar siempre entrena al usuario a
 * ignorar el diálogo, que es como se pierde el trabajo de verdad.
 *
 * «Guardando» también cuenta: cerrar la pestaña corta la petición en vuelo.
 * «Error» también: lo último no llegó al servidor.
 */
export function shouldWarnBeforeUnload(state: {
  hasPendingChanges: boolean;
  saveStatus: SaveStatus;
}): boolean {
  if (state.saveStatus === "saving" || state.saveStatus === "error") return true;
  return state.hasPendingChanges;
}
