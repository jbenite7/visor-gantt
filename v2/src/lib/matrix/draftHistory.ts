/**
 * El historial del borrador del editor de matriz.
 *
 * No es `runUndoable`: aquello opera sobre el proyecto persistido en
 * `ProjectContext`, y el borrador de la matriz es estado local de React que
 * todavía no forma parte del proyecto. Mezclarlos llenaría el historial
 * general de estados que nunca se guardaron.
 *
 * Se descarta al salir sin guardar, porque el borrador entero se descarta con
 * él. Al guardar, el conjunto entra al historial general como **un solo
 * cambio**, no como N pasos intermedios.
 *
 * Genérico a propósito: aquí no se sabe qué es un `MatrixPlan`, y así se
 * prueba entero sin construir uno.
 */
export const DRAFT_HISTORY_LIMIT = 50;

export interface DraftHistory<T> {
  past: T[];
  present: T | undefined;
  future: T[];
}

export function createDraftHistory<T>(present: T | undefined): DraftHistory<T> {
  return { past: [], present, future: [] };
}

export function commitDraftState<T>(
  history: DraftHistory<T>,
  next: T,
): DraftHistory<T> {
  // Sin borrador previo no hay nada que deshacer: crear el primer plan no es
  // un cambio sobre otro estado, es el punto de partida.
  if (history.present === undefined) {
    return { past: [], present: next, future: [] };
  }

  const past = [...history.past, history.present];
  return {
    past:
      past.length > DRAFT_HISTORY_LIMIT
        ? past.slice(past.length - DRAFT_HISTORY_LIMIT)
        : past,
    present: next,
    future: [],
  };
}

export function undoDraftState<T>(history: DraftHistory<T>): DraftHistory<T> {
  if (!canUndoDraft(history) || history.present === undefined) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoDraftState<T>(history: DraftHistory<T>): DraftHistory<T> {
  if (!canRedoDraft(history) || history.present === undefined) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

export function canUndoDraft<T>(history: DraftHistory<T>): boolean {
  return history.past.length > 0;
}

export function canRedoDraft<T>(history: DraftHistory<T>): boolean {
  return history.future.length > 0;
}
