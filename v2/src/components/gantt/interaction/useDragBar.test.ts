/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useDragBar } from "./useDragBar";
import type { GanttViewport } from "../types";

describe("useDragBar", () => {
  const viewport: GanttViewport = {
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    scale: "day",
    columnWidth: 40,
  };

  describe("initial state", () => {
    it("starts with isDragging = false and neutral drag values", () => {
      const onMove = jest.fn();
      const { result } = renderHook(() => useDragBar({ viewport, onMove }));

      expect(result.current.dragState.isDragging).toBe(false);
      expect(result.current.dragState.taskId).toBeNull();
      expect(result.current.dragState.ghostX).toBe(0);
      expect(result.current.dragState.ghostY).toBe(0);
      expect(result.current.dragState.dayDelta).toBe(0);
    });
  });

  describe("drag start", () => {
    it("onDragStart sets isDragging and stores the taskId", () => {
      const onMove = jest.fn();
      const { result } = renderHook(() => useDragBar({ viewport, onMove }));

      act(() => {
        const mouseEvent = {
          clientX: 100,
          clientY: 50,
          preventDefault: jest.fn(),
        } as unknown as React.MouseEvent;
        result.current.onDragStart(42, mouseEvent);
      });

      expect(result.current.dragState.isDragging).toBe(true);
      expect(result.current.dragState.taskId).toBe(42);
      expect(result.current.dragState.dayDelta).toBe(0);
    });
  });

  describe("drag end", () => {
    it("onDragEnd invokes onMove with the accumulated dayDelta and resets state", () => {
      const onMove = jest.fn();
      const { result } = renderHook(() => useDragBar({ viewport, onMove }));

      // Start drag at x=100
      act(() => {
        const mouseEvent = {
          clientX: 100,
          clientY: 50,
          preventDefault: jest.fn(),
        } as unknown as React.MouseEvent;
        result.current.onDragStart(42, mouseEvent);
      });

      // Move mouse to x=200 → pixel delta = 100, dayDelta = round(100 / 40) = 3
      act(() => {
        window.dispatchEvent(new MouseEvent("mousemove", {
          clientX: 200,
          clientY: 50,
        }));
      });

      expect(result.current.dragState.dayDelta).toBe(3);

      // End drag → onMove should fire with (42, 3)
      act(() => {
        result.current.onDragEnd();
      });

      expect(onMove).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledWith(42, 3);
      expect(result.current.dragState.isDragging).toBe(false);
      expect(result.current.dragState.taskId).toBeNull();
    });

    it("uses quarter scale when converting drag pixels to day delta", () => {
      const onMove = jest.fn();
      const quarterViewport: GanttViewport = {
        ...viewport,
        scale: "quarter",
        columnWidth: 120,
      };
      const { result } = renderHook(() =>
        useDragBar({ viewport: quarterViewport, onMove }),
      );

      act(() => {
        const mouseEvent = {
          clientX: 100,
          clientY: 50,
          preventDefault: jest.fn(),
        } as unknown as React.MouseEvent;
        result.current.onDragStart(42, mouseEvent);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent("mousemove", {
          clientX: 220,
          clientY: 50,
        }));
      });

      expect(result.current.dragState.dayDelta).toBe(91);

      act(() => {
        result.current.onDragEnd();
      });

      expect(onMove).toHaveBeenCalledWith(42, 91);
    });
  });
});
