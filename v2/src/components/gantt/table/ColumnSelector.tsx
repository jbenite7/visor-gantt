"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Columns, Info } from "lucide-react";
import type { MppCalculationSpec } from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";
import { t } from "@/lib/i18n";
import type { MppFieldInspection } from "@/lib/mpp/fieldInspector";

/** Configuration for a single table column. */
export interface ColumnConfig {
  key: string;
  label: string;
  labelEn?: string;
  labelEs?: string;
  /**
   * Forma corta del título. Si no se declara, la columna no se abrevia — pero
   * tampoco se corta a mitad de palabra: se queda con el título completo.
   */
  shortLabelEs?: string;
  shortLabelEn?: string;
  width: number;
  align: "left" | "right" | "center";
  defaultVisible: boolean;
  sourceKey?: string;
  dataType?: string;
  readOnly?: boolean;
  group?: string;
  calculationSpec?: MppCalculationSpec;
}

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  visibleColumns: string[];
  locale: UILocale;
  onToggle: (key: string) => void;
  onReset: () => void;
  onLocaleChange: (locale: UILocale) => void;
  fieldInspections?: Record<string, MppFieldInspection>;
}

/**
 * Dropdown panel to show/hide Gantt table columns.
 * Uses AIA brand styling with gear icon toggle button.
 */
export default function ColumnSelector({
  columns,
  visibleColumns,
  locale,
  onToggle,
  onReset,
  onLocaleChange,
  fieldInspections,
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | undefined>();
  const [panelPosition, setPanelPosition] = useState({
    top: 0,
    left: 0,
    ready: false,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const cssLength = useCallback((name: string, fallbackPx: number) => {
    if (typeof window === "undefined") return fallbackPx;
    const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!raw) return fallbackPx;
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.width = raw;
    document.body.appendChild(probe);
    const value = probe.getBoundingClientRect().width;
    probe.remove();
    return Number.isFinite(value) && value > 0 ? value : fallbackPx;
  }, []);

  const updatePanelPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    const trigger = buttonRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || panelRect.width;
    const panelHeight = panel.offsetHeight || panelRect.height;
    const offset = cssLength("--gantt-column-selector-panel-offset", 6);
    const margin = cssLength("--gantt-column-selector-viewport-margin", 12);
    const maxLeft = window.innerWidth - panelWidth - margin;
    const preferredLeft = triggerRect.right - panelWidth;
    const maxTop = window.innerHeight - panelHeight - margin;
    const preferredTop = triggerRect.bottom + offset;
    const nextLeft = Math.max(margin, Math.min(preferredLeft, Math.max(margin, maxLeft)));
    const nextTop = Math.max(margin, Math.min(preferredTop, Math.max(margin, maxTop)));

    setPanelPosition((current) => {
      if (
        current.ready &&
        Math.abs(current.top - nextTop) < 1 &&
        Math.abs(current.left - nextLeft) < 1
      ) {
        return current;
      }

      return { top: nextTop, left: nextLeft, ready: true };
    });
  }, [cssLength]);

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

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePanelPosition();
    const frame = window.requestAnimationFrame(updatePanelPosition);

    return () => window.cancelAnimationFrame(frame);
  }, [columns.length, isOpen, selectedColumnKey, updatePanelPosition]);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition]);

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
  const selectedColumn = columns.find((column) => column.key === selectedColumnKey);
  const selectedInspection = selectedColumn ? fieldInspections?.[selectedColumn.key] : undefined;

  const columnLabel = (column: ColumnConfig): string =>
    locale === "en" ? column.labelEn ?? column.label : column.labelEs ?? column.label;

  const describeColumn = (column: ColumnConfig): string => {
    const spec = column.calculationSpec;
    if (!spec) return column.readOnly ? "Solo lectura" : "Editable";

    const pieces = [
      spec.isCalculated
        ? locale === "en"
          ? "Calculated"
          : "Calculada"
        : locale === "en"
          ? "Input"
          : "Entrada",
      locale === "en"
        ? `Origin: ${spec.sourceOfTruth ?? "import"}`
        : `Origen: ${spec.sourceOfTruth ?? "importación"}`,
    ];
    if (spec.formula) pieces.push(`${locale === "en" ? "Formula" : "Formula"}: ${spec.formula}`);
    if (spec.lastCalculatedAt) pieces.push(`${locale === "en" ? "Last calculation" : "Último cálculo"}: ${spec.lastCalculatedAt}`);
    if (spec.unsupportedReason) pieces.push(spec.unsupportedReason);
    return pieces.join(" | ");
  };

  const metadataRows = (column: ColumnConfig) => {
    const spec = column.calculationSpec;
    return [
      {
        label: locale === "en" ? "Field" : "Campo",
        value: columnLabel(column),
      },
      {
        label: locale === "en" ? "Value type" : "Tipo de valor",
        value: column.dataType ?? "string",
      },
      {
        label: locale === "en" ? "Editability" : "Editabilidad",
        value: column.readOnly || spec?.isEditableWhenCalculated === false
          ? locale === "en" ? "Read only" : "Solo lectura"
          : locale === "en" ? "Editable" : "Editable",
      },
      {
        label: locale === "en" ? "Origin" : "Origen",
        value: spec?.sourceOfTruth ?? (column.readOnly ? "mppImport" : "user"),
      },
      spec?.calculationKind
        ? {
            label: locale === "en" ? "Calculation" : "Cálculo",
            value: spec.calculationKind,
          }
        : undefined,
      spec?.formula
        ? {
            label: "Formula",
            value: spec.formula,
          }
        : undefined,
      spec?.dependencies?.length
        ? {
            label: locale === "en" ? "Dependencies" : "Dependencias",
            value: spec.dependencies.join(", "),
          }
        : undefined,
      spec?.lastCalculatedAt
        ? {
            label: locale === "en" ? "Last calculation" : "Último cálculo",
            value: spec.lastCalculatedAt,
          }
        : undefined,
      spec?.unsupportedReason
        ? {
            label: locale === "en" ? "Error" : "Error",
            value: spec.unsupportedReason,
          }
        : undefined,
    ].filter((row): row is { label: string; value: string } => Boolean(row?.value));
  };

  const inspectionRows = (inspection: MppFieldInspection) => {
    const rows = [
      {
        label: locale === "en" ? "Field" : "Campo",
        value: inspection.label,
      },
      {
        label: locale === "en" ? "Value" : "Valor",
        value: inspection.value === undefined || inspection.value === null || inspection.value === ""
          ? "-"
          : String(inspection.value),
      },
      {
        label: locale === "en" ? "Value type" : "Tipo de valor",
        value: inspection.dataType,
      },
      {
        label: locale === "en" ? "Editability" : "Editabilidad",
        value: inspection.isEditable
          ? locale === "en" ? "Editable" : "Editable"
          : locale === "en" ? "Read only" : "Solo lectura",
      },
      {
        label: locale === "en" ? "Origin" : "Origen",
        value: inspection.sourceOfTruth ?? (inspection.isEditable ? "user" : "mppImport"),
      },
      inspection.calculationKind
        ? {
            label: locale === "en" ? "Calculation" : "Cálculo",
            value: inspection.calculationKind,
          }
        : undefined,
      inspection.formula
        ? {
            label: "Formula",
            value: inspection.formula,
          }
        : undefined,
      inspection.dependencies?.length
        ? {
            label: locale === "en" ? "Dependencies" : "Dependencias",
            value: inspection.dependencies.join(", "),
          }
        : undefined,
      inspection.rollupType
        ? {
            label: "Rollup",
            value: inspection.rollupType,
          }
        : undefined,
      inspection.lastCalculatedAt
        ? {
            label: locale === "en" ? "Last calculation" : "Último cálculo",
            value: inspection.lastCalculatedAt,
          }
        : undefined,
      inspection.lookupValues?.length
        ? {
            label: locale === "en" ? "Lookup values" : "Valores lookup",
            value: inspection.lookupValues.map(String).join(", "),
          }
        : undefined,
      inspection.errors.length
        ? {
            label: locale === "en" ? "Errors" : "Errores",
            value: inspection.errors.map((error) => error.message).join(" | "),
          }
        : undefined,
    ];
    return rows.filter((row): row is { label: string; value: string } => Boolean(row?.value));
  };

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

  const handleTriggerClick = () => {
    setPanelPosition((current) => ({ ...current, ready: false }));
    setIsOpen((prev) => !prev);
  };

  const panelStyle = {
    "--gantt-column-selector-panel-top": `${panelPosition.top}px`,
    "--gantt-column-selector-panel-left": `${panelPosition.left}px`,
  } as CSSProperties;

  const panel = isOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={panelRef}
          data-testid="column-selector-panel"
          data-positioned={panelPosition.ready}
          role="menu"
          className="gantt-column-selector__panel"
          style={panelStyle}
        >
          {/* Header */}
          <div className="gantt-column-selector__header">
            <span className="gantt-column-selector__eyebrow">
              {t(locale, "columns")}
            </span>
          </div>

          <div className="gantt-column-selector__section gantt-column-selector__section--row">
            <span className="gantt-column-selector__label">
              {t(locale, "language")}
            </span>
            <div className="gantt-column-selector__segmented">
              {(["es", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="gantt-column-selector__segmented-button"
                  data-active={locale === option}
                  onClick={() => onLocaleChange(option)}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Select All / Deselect All */}
          <div className="gantt-column-selector__section gantt-column-selector__actions">
            <button
              onClick={handleSelectAll}
              disabled={allVisible}
              className="gantt-column-selector__action"
            >
              {t(locale, "all")}
            </button>
            <button
              onClick={handleDeselectAll}
              disabled={noneVisible}
              className="gantt-column-selector__action"
            >
              {t(locale, "none")}
            </button>
          </div>

          {/* Column Checkboxes */}
          {columns.map((col) => {
            const isVisible = visibleColumns.includes(col.key);
            return (
              <div
                key={col.key}
                title={describeColumn(col)}
                className="gantt-column-selector__column-row"
              >
                <label
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  className="gantt-column-selector__column-label"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggle(col.key)}
                    className="gantt-column-selector__checkbox"
                  />
                  <span className="gantt-column-selector__column-name">
                    {columnLabel(col)}
                  </span>
                </label>
                <button
                  type="button"
                  aria-label={`${locale === "en" ? "Inspect column" : "Inspeccionar columna"} ${columnLabel(col)}`}
                  onClick={() => setSelectedColumnKey(col.key)}
                  className="gantt-column-selector__inspect-button"
                  data-active={selectedColumnKey === col.key}
                >
                  <Info className="gantt-column-selector__inspect-icon" aria-hidden />
                </button>
              </div>
            );
          })}

          {selectedColumn && (
            <div
              data-testid="field-inspector"
              className="gantt-column-selector__inspector"
            >
              <div className="gantt-column-selector__inspector-title">
                {locale === "en" ? "Field inspector" : "Inspector de campo"}
              </div>
              <dl className="gantt-column-selector__inspector-grid">
                {(selectedInspection ? inspectionRows(selectedInspection) : metadataRows(selectedColumn)).map((row) => (
                  <div key={`${row.label}-${row.value}`} className="gantt-column-selector__inspector-row">
                    <dt className="gantt-column-selector__inspector-term">
                      {row.label}
                    </dt>
                    <dd className="gantt-column-selector__inspector-definition">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Reset Button */}
          <div className="gantt-column-selector__footer">
            <button
              onClick={() => {
                onReset();
                setIsOpen(false);
              }}
              className="gantt-column-selector__reset"
            >
              {t(locale, "reset")}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="gantt-column-selector">
      {/* Toggle Button */}
      <button
        ref={buttonRef}
        data-testid="column-selector"
        className="gantt-column-selector__trigger"
        data-open={isOpen}
        onClick={handleTriggerClick}
        aria-label={t(locale, "toggleColumns")}
        aria-expanded={isOpen}
      >
        <Columns className="gantt-column-selector__trigger-icon" aria-hidden />
      </button>

      {panel}
    </div>
  );
}
