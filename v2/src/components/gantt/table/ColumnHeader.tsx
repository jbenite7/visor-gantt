"use client";

import { useCallback, useRef } from "react";
import type { MppCalculationSpec } from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";
import { pickColumnLabel } from "@/lib/gantt/columnLabel";

interface ColumnHeaderProps {
  label: string;
  /** Forma corta declarada por la columna. Sin ella, no se abrevia. */
  shortLabel?: string;
  locale?: UILocale;
  width?: number;
  align?: "left" | "right" | "center";
  onResize?: (newWidth: number) => void;
  isResizable?: boolean;
  calculationSpec?: MppCalculationSpec;
}

const MIN_COLUMN_WIDTH = 50;

/**
 * Sticky header cell for the Gantt entry table.
 * Uses AIA corporate dark green background with Montserrat heading font.
 * Includes an optional resize handle on the right edge.
 */
export default function ColumnHeader({
  label,
  shortLabel,
  locale = "es",
  width,
  align = "left",
  onResize,
  isResizable = true,
  calculationSpec,
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

  const resizeLabel =
    locale === "en" ? `Resize column ${label}` : `Redimensionar columna ${label}`;
  /**
   * Abreviar por el ancho de esta columna, no por el del panel entero: una
   * columna ancha no tiene por qué encogerse porque otra sea estrecha (R2).
   */
  const displayLabel = pickColumnLabel({ label, shortLabel, width: width ?? 0 });

  const calculationTitle = calculationSpec
    ? [
        calculationSpec.isCalculated
          ? locale === "en"
            ? "Calculated"
            : "Calculada"
          : locale === "en"
            ? "Input"
            : "Entrada",
        locale === "en"
          ? `Origin: ${calculationSpec.sourceOfTruth ?? "import"}`
          : `Origen: ${calculationSpec.sourceOfTruth ?? "importación"}`,
        calculationSpec.formula
          ? `${locale === "en" ? "Formula" : "Formula"}: ${calculationSpec.formula}`
          : undefined,
        calculationSpec.lastCalculatedAt
          ? `${locale === "en" ? "Last calculation" : "Último cálculo"}: ${calculationSpec.lastCalculatedAt}`
          : undefined,
        calculationSpec.unsupportedReason,
      ]
        .filter(Boolean)
        .join(" | ")
    : undefined;

  // El nombre completo nunca se pierde: abreviar la cabecera no puede costar
  // saber de qué columna se trata.
  const title = calculationTitle ? `${label} | ${calculationTitle}` : label;

  return (
    <th
      ref={thRef}
      data-testid="column-header"
      data-full-label={label}
      className="gantt-column-header"
      data-align={align}
      title={title}
    >
      {displayLabel}

      {/* Resize Handle */}
      {isResizable && onResize && (
        <div
          role="separator"
          aria-label={resizeLabel}
          className="gantt-column-header__resize"
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  );
}
