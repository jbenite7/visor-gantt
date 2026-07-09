/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useResizeBar } from "./useResizeBar";
import type { GanttViewport } from "../types";

describe("useResizeBar", () => {
  const viewport: GanttViewport = {
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    scale: "quarter",
    columnWidth: 120,
  };

  it("uses quarter scale when converting resize pixels to day delta", () => {
    const onResize = jest.fn();
    const { result } = renderHook(() => useResizeBar({ viewport, onResize }));

    act(() => {
      const mouseEvent = {
        clientX: 100,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as unknown as React.MouseEvent;
      result.current.onResizeStart(42, "right", 10, mouseEvent);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", {
        clientX: 220,
      }));
    });

    expect(result.current.resizeState.dayDelta).toBe(91);
    expect(result.current.resizeState.newDuration).toBe(101);

    act(() => {
      result.current.onResizeEnd();
    });

    expect(onResize).toHaveBeenCalledWith(42, "right", 91);
  });
});
