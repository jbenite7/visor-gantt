"use client";

import { useState, useRef, useCallback } from "react";

export type EditableCellType =
  | "text"
  | "number"
  | "date"
  | "slider"
  | "predecessors";

interface EditableCellProps {
  value: string | number;
  type: EditableCellType;
  onCommit: (newValue: string) => void;
  align?: "left" | "right" | "center";
  /** Extra content rendered before the value (e.g. WBSExpand + name). */
  prefix?: React.ReactNode;
  /** Whether the cell is non-editable (e.g. summary rows). */
  readOnly?: boolean;
}

/** Shared style for the editable input. */
const inputStyle: React.CSSProperties = {
  border: "2px solid var(--aia-proj-main)",
  background: "var(--aia-alabaster)",
  padding: "2px 4px",
  borderRadius: "3px",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  fontSize: "13px",
  lineHeight: "1.4",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

/**
 * Inline editable cell — double-click to edit, Enter/Escape/Blur to commit/cancel.
 *
 * Renders a read-only display by default. On double-click, swaps to an
 * appropriate input type. Commits on Enter/Blur, cancels on Escape.
 */
export default function EditableCell({
  value,
  type,
  onCommit,
  align = "left",
  prefix,
  readOnly = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const commit = useCallback((nextValue: string = editValue) => {
    setIsEditing(false);
    setEditValue(nextValue);
    onCommit(nextValue);
  }, [editValue, onCommit]);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(String(value));
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && type !== "predecessors") {
        e.preventDefault();
        commit((e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel, type]
  );

  const handleDoubleClick = useCallback(() => {
    if (readOnly) return;
    setEditValue(String(value));
    setIsEditing(true);
  }, [readOnly, value]);

  if (isEditing) {
    // Convert Date objects stored as ISO strings to yyyy-mm-dd for <input type="date">
    let inputType: string = type;
    let inputMode: "text" | "numeric" | "decimal" | undefined;
    let step: string | undefined;

    if (type === "number") {
      inputMode = "decimal";
      step = "any";
    } else if (type === "date") {
      inputType = "date";
    } else if (type === "slider") {
      inputType = "range";
    }

    if (type === "slider") {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            minWidth: 0,
          }}
        >
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="range"
            min="0"
            max="100"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={(e) => commit(e.currentTarget.value)}
            autoFocus
            style={{ flex: 1, minWidth: 0 }}
            data-testid="editable-cell"
          />
          <span style={{ fontSize: "11px", color: "var(--gray-600)", minWidth: "28px", textAlign: "right" }}>
            {editValue}%
          </span>
        </div>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={inputType}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(e) => commit(e.currentTarget.value)}
        autoFocus
        inputMode={inputMode}
        step={step}
        style={{
          ...inputStyle,
          textAlign: align,
        }}
        data-testid="editable-cell"
      />
    );
  }

  // Read-only display
  const displayStyle: React.CSSProperties = {
    textAlign: align,
    cursor: readOnly ? "default" : "text",
    minWidth: 0,
    width: "100%",
  };

  return (
    <div
      style={displayStyle}
      onDoubleClick={handleDoubleClick}
      title={readOnly ? undefined : "Double-click to edit"}
      data-testid="editable-cell"
    >
      {prefix}
      {prefix ? <span>{value}</span> : value}
    </div>
  );
}
