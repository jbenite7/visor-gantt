"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { GanttViewport } from "../types";

/** Convert pixels to day delta based on viewport scale. */
function pixelsToDays(px: number, viewport: GanttViewport): number {
  const daysPerUnit =
    viewport.scale === "day" ? 1 : viewport.scale === "week" ? 7 : 30;
  return Math.round(px / (viewport.columnWidth / daysPerUnit));
}

export interface DragState {
  isDragging: boolean;
  taskId: string | number | null;
  ghostX: number;
  ghostY: number;
  dayDelta: number;
}

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  taskId: null,
  ghostX: 0,
  ghostY: 0,
  dayDelta: 0,
};

interface UseDragBarOptions {
  viewport: GanttViewport;
  onMove: (taskId: string | number, dayDelta: number) => void;
}

export function useDragBar({ viewport, onMove }: UseDragBarOptions) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);

  const startRef = useRef({ mouseX: 0, mouseY: 0 });
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      setDragState((prev) => {
        if (!prev.isDragging) return prev;
        const pixelDeltaX = e.clientX - startRef.current.mouseX;
        const pixelDeltaY = e.clientY - startRef.current.mouseY;
        const dayDelta = pixelsToDays(pixelDeltaX, viewport);
        return {
          ...prev,
          ghostX: pixelDeltaX,
          ghostY: pixelDeltaY,
          dayDelta,
        };
      });
    },
    [viewport],
  );

  const handleMouseUp = useCallback(() => {
    setDragState((prev) => {
      if (!prev.isDragging) return prev;
      if (prev.taskId !== null && prev.dayDelta !== 0) {
        onMoveRef.current(prev.taskId, prev.dayDelta);
      }
      return INITIAL_DRAG_STATE;
    });
  }, []);

  // Attach window listeners during drag
  useEffect(() => {
    if (!dragState.isDragging) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  const onDragStart = useCallback(
    (taskId: string | number, e: React.MouseEvent) => {
      e.preventDefault();
      startRef.current = { mouseX: e.clientX, mouseY: e.clientY };
      setDragState({
        isDragging: true,
        taskId,
        ghostX: 0,
        ghostY: 0,
        dayDelta: 0,
      });
    },
    [],
  );

  const onDragEnd = useCallback(() => {
    setDragState((prev) => {
      if (prev.taskId !== null && prev.dayDelta !== 0) {
        onMoveRef.current(prev.taskId, prev.dayDelta);
      }
      return INITIAL_DRAG_STATE;
    });
  }, []);

  return { dragState, onDragStart, onDragEnd };
}
