"use client";

import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from "react";

/** Props for the SplitPane component. */
interface SplitPaneProps {
  /** Content rendered in the left pane (typically GanttTable). */
  left: React.ReactNode;
  /** Content rendered in the right pane (typically GanttChart). */
  right: React.ReactNode;
  /** Initial split position as percentage (0-100). Default: 40. */
  defaultSplit?: number;
}

/** Imperative handle exposed by SplitPane via ref. */
export interface SplitPaneRef {
  /** Ref to the left pane's scroll container div. */
  leftScrollRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to the right pane's scroll container div. */
  rightScrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * A resizable horizontal split pane with vertical and horizontal scroll synchronization.
 *
 * Both panes scroll vertically and horizontally in sync.
 * Exposes scroll container refs via forwardRef for scroll-to-task behavior.
 */
const SplitPane = forwardRef<SplitPaneRef, SplitPaneProps>(function SplitPane(
  { left, right, defaultSplit = 40 },
  ref,
) {
  const [splitRatio, setSplitRatio] = useState(defaultSplit);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isScrollingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    leftScrollRef,
    rightScrollRef,
  }));

  const clampRatio = useCallback((value: number): number => {
    return Math.min(80, Math.max(20, value));
  }, []);

  const handleMouseDown = useCallback(() => {
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const percentage = (offsetX / rect.width) * 100;
      setSplitRatio(clampRatio(percentage));
    },
    [clampRatio],
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  // Attach global listeners once on the first mousedown
  const handleDividerMouseDown = useCallback(() => {
    handleMouseDown();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  const handleLeftScroll = useCallback(() => {
    if (isScrollingRef.current || !leftScrollRef.current || !rightScrollRef.current) return;
    isScrollingRef.current = true;
    requestAnimationFrame(() => {
      if (rightScrollRef.current && leftScrollRef.current) {
        rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
      }
      isScrollingRef.current = false;
    });
  }, []);

  const handleRightScroll = useCallback(() => {
    if (isScrollingRef.current || !leftScrollRef.current || !rightScrollRef.current) return;
    isScrollingRef.current = true;
    requestAnimationFrame(() => {
      if (leftScrollRef.current && rightScrollRef.current) {
        leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
      }
      isScrollingRef.current = false;
    });
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="split-pane"
      className="flex h-full w-full overflow-hidden"
    >
      {/* Left Pane */}
      <div
        ref={leftScrollRef}
        onScroll={handleLeftScroll}
        className="overflow-y-auto overflow-x-hidden shrink-0"
        style={{ width: `${splitRatio}%` }}
      >
        {left}
      </div>

      {/* Divider */}
      <div
        data-testid="split-divider"
        role="separator"
        tabIndex={0}
        onMouseDown={handleDividerMouseDown}
        onKeyDown={(e) => {
          const step = 2;
          if (e.key === "ArrowLeft") {
            setSplitRatio((prev) => clampRatio(prev - step));
          } else if (e.key === "ArrowRight") {
            setSplitRatio((prev) => clampRatio(prev + step));
          }
        }}
        className="w-1.5 shrink-0 cursor-col-resize transition-colors duration-150 hover:bg-[var(--aia-corp-main)] bg-[var(--aia-corp-mid)]"
        aria-valuenow={Math.round(splitRatio)}
        aria-valuemin={20}
        aria-valuemax={80}
        aria-label="Resize split pane"
      />

      {/* Right Pane */}
      <div
        ref={rightScrollRef}
        onScroll={handleRightScroll}
        className="overflow-y-auto overflow-x-hidden flex-1 min-w-0"
      >
        {right}
      </div>
    </div>
  );
});

export default SplitPane;
