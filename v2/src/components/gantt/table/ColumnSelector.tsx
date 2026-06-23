"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Columns } from "lucide-react";

/** Configuration for a single table column. */
export interface ColumnConfig {
  key: string;
  label: string;
  width: number;
  align: "left" | "right" | "center";
  defaultVisible: boolean;
}

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  visibleColumns: string[];
  onToggle: (key: string) => void;
  onReset: () => void;
}

/**
 * Dropdown panel to show/hide Gantt table columns.
 * Uses AIA brand styling with gear icon toggle button.
 */
export default function ColumnSelector({
  columns,
  visibleColumns,
  onToggle,
  onReset,
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [isOpen, handleOutsideClick]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const allVisible = visibleColumns.length === columns.length;
  const noneVisible = visibleColumns.length === 0;

  const handleSelectAll = () => {
    for (const col of columns) {
      if (!visibleColumns.includes(col.key)) {
        onToggle(col.key);
      }
    }
  };

  const handleDeselectAll = () => {
    for (const col of visibleColumns) {
      onToggle(col);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Toggle Button */}
      <button
        ref={buttonRef}
        data-testid="column-selector"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle column selector"
        aria-expanded={isOpen}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          border: "1px solid var(--aia-corp-mid)",
          borderRadius: "6px",
          background: isOpen ? "var(--aia-corp-xlight)" : "transparent",
          color: isOpen ? "var(--aia-corp-dark)" : "var(--aia-corp-mid)",
          cursor: "pointer",
          transition: "all 150ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--aia-corp-xlight)";
          e.currentTarget.style.color = "var(--aia-corp-dark)";
          e.currentTarget.style.borderColor = "var(--aia-corp-main)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isOpen
            ? "var(--aia-corp-xlight)"
            : "transparent";
          e.currentTarget.style.color = isOpen
            ? "var(--aia-corp-dark)"
            : "var(--aia-corp-mid)";
          e.currentTarget.style.borderColor = "var(--aia-corp-mid)";
        }}
      >
        <Columns size={16} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          data-testid="column-selector-panel"
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            minWidth: "220px",
            background: "var(--aia-alabaster)",
            border: "1px solid var(--aia-corp-mid)",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(26, 60, 42, 0.15)",
            padding: "8px 0",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "6px 14px 8px",
              borderBottom: "1px solid var(--aia-corp-mid)",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--aia-corp-mid)",
              }}
            >
              Columns
            </span>
          </div>

          {/* Select All / Deselect All */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "4px 14px 8px",
              borderBottom: "1px solid rgba(74, 124, 100, 0.15)",
              marginBottom: "4px",
            }}
          >
            <button
              onClick={handleSelectAll}
              disabled={allVisible}
              style={{
                flex: 1,
                fontSize: "0.6875rem",
                fontWeight: 500,
                padding: "4px 8px",
                border: "1px solid var(--aia-corp-mid)",
                borderRadius: "4px",
                background: allVisible ? "transparent" : "white",
                color: allVisible ? "var(--gray-400)" : "var(--aia-corp-dark)",
                cursor: allVisible ? "default" : "pointer",
                opacity: allVisible ? 0.5 : 1,
              }}
            >
              All
            </button>
            <button
              onClick={handleDeselectAll}
              disabled={noneVisible}
              style={{
                flex: 1,
                fontSize: "0.6875rem",
                fontWeight: 500,
                padding: "4px 8px",
                border: "1px solid var(--aia-corp-mid)",
                borderRadius: "4px",
                background: noneVisible ? "transparent" : "white",
                color: noneVisible ? "var(--gray-400)" : "var(--aia-corp-dark)",
                cursor: noneVisible ? "default" : "pointer",
                opacity: noneVisible ? 0.5 : 1,
              }}
            >
              None
            </button>
          </div>

          {/* Column Checkboxes */}
          {columns.map((col) => {
            const isVisible = visibleColumns.includes(col.key);
            return (
              <label
                key={col.key}
                role="menuitemcheckbox"
                aria-checked={isVisible}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  color: "var(--aia-corp-dark)",
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(74, 124, 100, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => onToggle(col.key)}
                  style={{
                    width: "14px",
                    height: "14px",
                    accentColor: "var(--aia-corp-main)",
                    cursor: "pointer",
                    margin: 0,
                  }}
                />
                <span>{col.label}</span>
              </label>
            );
          })}

          {/* Reset Button */}
          <div
            style={{
              padding: "8px 14px 4px",
              borderTop: "1px solid rgba(74, 124, 100, 0.15)",
              marginTop: "4px",
            }}
          >
            <button
              onClick={() => {
                onReset();
                setIsOpen(false);
              }}
              style={{
                width: "100%",
                fontSize: "0.75rem",
                fontWeight: 500,
                padding: "6px 10px",
                border: "1px solid var(--aia-corp-mid)",
                borderRadius: "4px",
                background: "white",
                color: "var(--aia-corp-dark)",
                cursor: "pointer",
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--aia-corp-xlight)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
              }}
            >
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
