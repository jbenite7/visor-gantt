"use client";

import { useCallback, useRef } from "react";

interface ColumnHeaderProps {
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
  onResize?: (newWidth: number) => void;
  isResizable?: boolean;
}

const MIN_COLUMN_WIDTH = 50;

/**
 * Sticky header cell for the Gantt entry table.
 * Uses AIA corporate dark green background with Montserrat heading font.
 * Includes an optional resize handle on the right edge.
 */
export default function ColumnHeader({
  label,
  width,
  align = "left",
  onResize,
  isResizable = true,
}: ColumnHeaderProps) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isResizable || !onResize || !thRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      startXRef.current = e.clientX;
      startWidthRef.current = thRef.current.offsetWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + delta);
        onResize(newWidth);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [isResizable, onResize]
  );

  const widthPx = width ? `${width}px` : "auto";

  return (
    <th
      ref={thRef}
      data-testid="column-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        width: widthPx,
        minWidth: widthPx,
        textAlign: align,
        padding: "8px 10px",
        fontFamily: "var(--font-montserrat), system-ui, sans-serif",
        fontWeight: 600,
        fontSize: "0.75rem",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#ffffff",
        background: "var(--aia-corp-dark)",
        borderBottom: "2px solid var(--aia-corp-main)",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {label}

      {/* Resize Handle */}
      {isResizable && onResize && (
        <div
          role="separator"
          aria-label={`Resize ${label} column`}
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "6px",
            height: "100%",
            cursor: "col-resize",
            background: "transparent",
            transition: "background 150ms ease",
            zIndex: 11,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--aia-corp-main)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        />
      )}
    </th>
  );
}
