"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/** Dependency type derived from edge connections. */
export type DepEdge = "left" | "right";

export interface DepCreationState {
  /** Whether a dependency drag is in progress. */
  isCreating: boolean;
  /** ID of the task where the drag started. */
  fromTaskId: string | number | null;
  /** Which edge the drag started from. */
  fromEdge: DepEdge | null;
  /** Current mouse X position (chart-relative). */
  mouseX: number;
  /** Current mouse Y position (chart-relative). */
  mouseY: number;
  /** ID of the task the mouse is currently hovering over. */
  hoverTaskId: string | number | null;
}

const INITIAL_STATE: DepCreationState = {
  isCreating: false,
  fromTaskId: null,
  fromEdge: null,
  mouseX: 0,
  mouseY: 0,
  hoverTaskId: null,
};

/**
 * Determine the dependency type based on source and target edge connections.
 *
 *   right edge (finish) → left edge (start) = FS
 *   right edge → right edge = FF
 *   left edge (start) → left edge = SS
 *   left edge → right edge = SF
 */
function inferDepType(
  fromEdge: DepEdge,
  toEdge: DepEdge,
): "FS" | "SS" | "FF" | "SF" {
  if (fromEdge === "right" && toEdge === "left") return "FS";
  if (fromEdge === "right" && toEdge === "right") return "FF";
  if (fromEdge === "left" && toEdge === "left") return "SS";
  return "SF"; // left → right
}

/**
 * Traverse DOM upward from an element to find the nearest [data-task-id].
 * Returns the task ID or null if not found.
 */
function findTaskIdFromElement(el: Element | null): string | number | null {
  let current: Element | null = el;
  while (current) {
    const taskId = current.getAttribute("data-task-id");
    if (taskId !== null) {
      // Try to parse as number, fall back to string
      const num = Number(taskId);
      return Number.isNaN(num) ? taskId : num;
    }
    current = current.parentElement;
  }
  return null;
}

interface UseCreateDependencyReturn {
  depState: DepCreationState;
  onDepStart: (
    taskId: string | number,
    edge: DepEdge,
    event: React.MouseEvent,
  ) => void;
  onDepMove: (event: React.MouseEvent) => void;
  onDepEnd: (
    targetTaskId: string | number,
    targetEdge: DepEdge,
  ) => void;
  onDepCancel: () => void;
}

/**
 * Custom hook for creating Gantt dependencies by dragging between connection points.
 *
 * Usage:
 *   const { depState, onDepStart, onDepMove, onDepEnd, onDepCancel } =
 *     useCreateDependency(onCreate);
 *
 * @param onCreate  Callback invoked when a valid dependency is created.
 *                  Receives (fromId, toId, type).
 */
export function useCreateDependency(
  onCreate?: (
    fromId: string | number,
    toId: string | number,
    type: "FS" | "SS" | "FF" | "SF",
  ) => void,
): UseCreateDependencyReturn {
  const [depState, setDepState] = useState<DepCreationState>(INITIAL_STATE);
  const stateRef = useRef(depState);

  useEffect(() => {
    stateRef.current = depState;
  }, [depState]);

  // Cancel on Escape key
  useEffect(() => {
    if (!depState.isCreating) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDepState(INITIAL_STATE);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [depState.isCreating]);

  const onDepStart = useCallback(
    (
      taskId: string | number,
      edge: DepEdge,
      event: React.MouseEvent,
    ) => {
      event.stopPropagation();
      event.preventDefault();

      // Get SVG-relative coordinates
      const svg = (event.target as Element).closest("svg");
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      setDepState({
        isCreating: true,
        fromTaskId: taskId,
        fromEdge: edge,
        mouseX: svgPt.x,
        mouseY: svgPt.y,
        hoverTaskId: null,
      });
    },
    [],
  );

  const onDepMove = useCallback((event: React.MouseEvent) => {
    if (!stateRef.current.isCreating) return;

    const svg = (event.target as Element).closest("svg");
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    // Detect which task bar the mouse is over
    const elUnder = document.elementFromPoint(event.clientX, event.clientY);
    const hoverTaskId = findTaskIdFromElement(elUnder);

    setDepState((prev) => ({
      ...prev,
      mouseX: svgPt.x,
      mouseY: svgPt.y,
      hoverTaskId,
    }));
  }, []);

  const onDepEnd = useCallback(
    (targetTaskId: string | number, targetEdge: DepEdge) => {
      const state = stateRef.current;
      if (!state.isCreating || state.fromTaskId === null || state.fromEdge === null) {
        setDepState(INITIAL_STATE);
        return;
      }

      // Don't create self-dependency
      if (targetTaskId === state.fromTaskId) {
        setDepState(INITIAL_STATE);
        return;
      }

      const type = inferDepType(state.fromEdge, targetEdge);
      onCreate?.(state.fromTaskId, targetTaskId, type);
      setDepState(INITIAL_STATE);
    },
    [onCreate],
  );

  const onDepCancel = useCallback(() => {
    setDepState(INITIAL_STATE);
  }, []);

  return { depState, onDepStart, onDepMove, onDepEnd, onDepCancel };
}
