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
  displayValue?: React.ReactNode;
  type: EditableCellType;
  onCommit: (newValue: string) => void;
  align?: "left" | "right" | "center";
  sliderDisplayValue?: (value: string) => string;
  /** Extra content rendered before the value (e.g. WBSExpand + name). */
  prefix?: React.ReactNode;
  /** Whether the cell is non-editable (e.g. summary rows). */
  readOnly?: boolean;
  /** Restricciones nativas del input numérico o de fecha. */
  min?: string | number;
  step?: string | number;
}

/**
 * Inline editable cell — double-click to edit, Enter/Escape/Blur to commit/cancel.
 *
 * Renders a read-only display by default. On double-click, swaps to an
 * appropriate input type. Commits on Enter/Blur, cancels on Escape.
 */
export default function EditableCell({
  value,
  displayValue,
  type,
  onCommit,
  align = "left",
  sliderDisplayValue,
  prefix,
  readOnly = false,
  min,
  step: stepOverride,
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
      if (min !== undefined) {
        // El teclado numérico ya impide bajar del mínimo; la validación de
        // `editValidation` cubre el caso de escribirlo a mano.
        inputMode = "numeric";
      }
    } else if (type === "date") {
      inputType = "date";
    } else if (type === "slider") {
      inputType = "range";
      step = "0.01";
    }

    if (type === "slider") {
      return (
        <div className="gantt-editable-cell-slider">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className="gantt-editable-cell-slider__input"
            type="range"
            min="0"
            max="100"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={(e) => commit(e.currentTarget.value)}
            autoFocus
            data-testid="editable-cell"
          />
          <span className="gantt-editable-cell-slider__value">
            {sliderDisplayValue ? sliderDisplayValue(editValue) : `${editValue}%`}
          </span>
        </div>
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className="gantt-editable-cell-input"
        data-align={align}
        type={inputType}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(e) => commit(e.currentTarget.value)}
        autoFocus
        inputMode={inputMode}
        min={min}
        step={stepOverride ?? step}
        data-testid="editable-cell"
      />
    );
  }

  return (
    <div
      className="gantt-editable-cell"
      data-align={align}
      data-read-only={readOnly}
      onDoubleClick={handleDoubleClick}
      title={readOnly ? undefined : "Double-click to edit"}
      data-testid="editable-cell"
    >
      {prefix}
      <span className="gantt-editable-cell__value">{displayValue ?? value}</span>
    </div>
  );
}
