"use client";

import { ChevronRight, ChevronDown } from "lucide-react";

interface WBSExpandProps {
  /** Whether the subtree is expanded (visible). */
  isExpanded: boolean;
  /** Called when the toggle is clicked. */
  onClick?: () => void;
  /** WBS outline level (1 = top). Used for visual indentation. */
  level: number;
  /** Whether this is a summary task that can be toggled. */
  isSummary: boolean;
}

/**
 * WBSExpand — expand/collapse toggle for summary tasks in the WBS tree.
 *
 * Summary tasks render a clickable chevron (▶ collapsed / ▼ expanded).
 * Non-summary tasks render an empty spacer of the same width for alignment.
 */
export default function WBSExpand({
  isExpanded,
  onClick,
  level,
  isSummary,
}: WBSExpandProps) {
  const cappedLevel = Math.max(1, Math.min(level, 12));

  if (!isSummary) {
    // Empty spacer for alignment — same width as the toggle
    return (
      <span
        data-testid="wbs-expand"
        className="gantt-wbs-expand"
        data-level={cappedLevel}
        data-summary="false"
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      data-testid="wbs-expand"
      className="gantt-wbs-expand"
      data-level={cappedLevel}
      data-summary="true"
      data-expanded={isExpanded}
      role="button"
      tabIndex={0}
      aria-label={isExpanded ? "Collapse" : "Expand"}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick?.();
        }
      }}
    >
      {isExpanded ? (
        <ChevronDown className="gantt-wbs-expand__icon" aria-hidden />
      ) : (
        <ChevronRight className="gantt-wbs-expand__icon" aria-hidden />
      )}
    </span>
  );
}
