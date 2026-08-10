"use client";

import { useCallback, useMemo, useState } from "react";
import {
  canRedoDraft,
  canUndoDraft,
  commitDraftState,
  createDraftHistory,
  redoDraftState,
  undoDraftState,
  type DraftHistory,
} from "./draftHistory";

/**
 * La pila del borrador vestida de `useState`.
 *
 * `commitDraft` sustituye a `setDraft`: acepta el valor nuevo o la forma con
 * función, igual que `setState`, para que el editor no tenga que cambiar de
 * estilo en cada llamada. `resetDraft` es la puerta de atrás: recargar el
 * borrador desde el proyecto o descartarlo **tira la pila entera**, porque la
 * pila describe un borrador que ya no existe.
 */
export interface DraftHistoryHandle<T> {
  draft: T | undefined;
  commitDraft: (next: T | ((current: T | undefined) => T | undefined)) => void;
  resetDraft: (next: T | undefined) => void;
  undoDraft: () => void;
  redoDraft: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useDraftHistory<T>(
  initial: T | undefined,
): DraftHistoryHandle<T> {
  const [history, setHistory] = useState<DraftHistory<T>>(() =>
    createDraftHistory(initial),
  );

  const commitDraft = useCallback(
    (next: T | ((current: T | undefined) => T | undefined)) => {
      setHistory((current) => {
        const value =
          typeof next === "function"
            ? (next as (state: T | undefined) => T | undefined)(current.present)
            : next;
        if (value === undefined || value === current.present) return current;
        return commitDraftState(current, value);
      });
    },
    [],
  );

  const resetDraft = useCallback((next: T | undefined) => {
    setHistory(createDraftHistory(next));
  }, []);

  const undoDraft = useCallback(
    () => setHistory((current) => undoDraftState(current)),
    [],
  );
  const redoDraft = useCallback(
    () => setHistory((current) => redoDraftState(current)),
    [],
  );

  return useMemo(
    () => ({
      draft: history.present,
      commitDraft,
      resetDraft,
      undoDraft,
      redoDraft,
      canUndo: canUndoDraft(history),
      canRedo: canRedoDraft(history),
    }),
    [commitDraft, history, redoDraft, resetDraft, undoDraft],
  );
}
