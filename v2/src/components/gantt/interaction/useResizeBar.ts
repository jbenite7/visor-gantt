"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { GanttViewport } from "../types";

const MIN_DURATION = 1;

/** Convert pixels to day delta based on viewport scale. */
function pixelsToDays(px: number, viewport: GanttViewport): number {
  const daysPerUnit =
    viewport.scale === "day" ? 1 : viewport.scale === "week" ? 7 : 30;
  return Math.round(px / (viewport.columnWidth / daysPerUnit));
}

export interface ResizeState {
  isResizing: boolean;
  taskId: string | number | null;
  edge: "left" | "right" | null;
  dayDelta: number;
  newDuration: number;
}

const INITIAL_RESIZE_STATE: ResizeState = {
  isResizing: false,
  taskId: null,
  edge: null,
  dayDelta: 0,
  newDuration: 0,
};

interface UseResizeBarOptions {
  viewport: GanttViewport;
  onResize: (
    taskId: string | number,
    edge: "left" | "right",
    dayDelta: number,
  ) => void;
}

export function useResizeBar({ viewport, onResize }: UseResizeBarOptions) {
  const [resizeState, setResizeState] =
    useState<ResizeState>(INITIAL_RESIZE_STATE);

  const startRef = useRef({
    mouseX: 0,
    originalDuration: 0,
  });
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      setResizeState((prev) => {
        if (!prev.isResizing || !prev.edge) return prev;
        const pixelDelta = e.clientX - startRef.current.mouseX;
        const dayDelta = pixelsToDays(pixelDelta, viewport);

        let newDuration: number;
        if (prev.edge === "right") {
          newDuration = Math.max(
            MIN_DURATION,
            startRef.current.originalDuration + dayDelta,
          );
        } else {
          newDuration = Math.max(
            MIN_DURATION,
            startRef.current.originalDuration - dayDelta,
          );
        }

        return { ...prev, dayDelta, newDuration };
      });
    },
    [viewport],
  );

  const handleMouseUp = useCallback(() => {
    setResizeState((prev) => {
      if (!prev.isResizing || !prev.taskId || !prev.edge) return prev;
      if (prev.dayDelta !== 0) {
        onResizeRef.current(prev.taskId, prev.edge, prev.dayDelta);
      }
      return INITIAL_RESIZE_STATE;
    });
  }, []);

  // Attach window listeners during resize
  useEffect(() => {
    if (!resizeState.isResizing) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizeState.isResizing, handleMouseMove, handleMouseUp]);

  const onResizeStart = useCallback(
    (
      taskId: string | number,
      edge: "left" | "right",
      originalDuration: number,
      e: React.MouseEvent,
    ) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent drag-to-move from firing
      startRef.current = { mouseX: e.clientX, originalDuration };
      setResizeState({
        isResizing: true,
        taskId,
        edge,
        dayDelta: 0,
        newDuration: originalDuration,
      });
    },
    [],
  );

  const onResizeEnd = useCallback(() => {
    setResizeState((prev) => {
      if (!prev.taskId || !prev.edge) return prev;
      if (prev.dayDelta !== 0) {
        onResizeRef.current(prev.taskId, prev.edge, prev.dayDelta);
      }
      return INITIAL_RESIZE_STATE;
    });
  }, []);

  return { resizeState, onResizeStart, onResizeEnd };
}
