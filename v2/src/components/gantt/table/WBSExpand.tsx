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
  const indent = (level - 1) * 20;

  if (!isSummary) {
    // Empty spacer for alignment — same width as the toggle
    return (
      <span
        data-testid="wbs-expand"
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 16,
          height: 16,
          marginLeft: indent,
        }}
      />
    );
  }

  return (
    <span
      data-testid="wbs-expand"
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        marginLeft: indent,
        cursor: "pointer",
        color: "var(--aia-corp-dark)",
        flexShrink: 0,
        verticalAlign: "middle",
      }}
    >
      {isExpanded ? (
        <ChevronDown size={14} strokeWidth={2} />
      ) : (
        <ChevronRight size={14} strokeWidth={2} />
      )}
    </span>
  );
}
