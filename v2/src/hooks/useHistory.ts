"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { HistoryStack, type Command } from "@/lib/state/history";

/**
 * React hook wrapping HistoryStack.
 *
 * Uses `useRef` for the stack instance (stable across renders)
 * and `useState` for canUndo/canRedo (triggers re-renders on change).
 */
export function useHistory(maxStack?: number) {
  const historyRef = useRef<HistoryStack>(
    new HistoryStack(maxStack),
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const push = useCallback((command: Command) => {
    historyRef.current.push(command);
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const undo = useCallback((): string | null => {
    const description = historyRef.current.undo();
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
    return description;
  }, []);

  const redo = useCallback(() => {
    const didRedo = historyRef.current.redo();
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
    return didRedo;
  }, []);

  const clear = useCallback(() => {
    historyRef.current.clear();
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return useMemo(
    () => ({ push, undo, redo, clear, canUndo, canRedo }),
    [push, undo, redo, clear, canUndo, canRedo],
  );
}
