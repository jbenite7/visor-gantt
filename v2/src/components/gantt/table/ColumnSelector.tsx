"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
        : `Origen: ${spec.sourceOfTruth ?? "importacion"}`,
    ];
    if (spec.formula) pieces.push(`${locale === "en" ? "Formula" : "Formula"}: ${spec.formula}`);
    if (spec.lastCalculatedAt) pieces.push(`${locale === "en" ? "Last calculation" : "Ultimo calculo"}: ${spec.lastCalculatedAt}`);
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

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Toggle Button */}
      <button
        ref={buttonRef}
        data-testid="column-selector"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t(locale, "toggleColumns")}
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
            maxHeight: "min(70vh, 620px)",
            overflowY: "auto",
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
              {t(locale, "columns")}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              padding: "4px 14px 8px",
              borderBottom: "1px solid rgba(74, 124, 100, 0.15)",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "var(--aia-corp-mid)",
              }}
            >
              {t(locale, "language")}
            </span>
            <div style={{ display: "inline-flex", gap: "2px" }}>
              {(["es", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onLocaleChange(option)}
                  style={{
                    padding: "3px 8px",
                    border: "1px solid var(--aia-corp-mid)",
                    borderRadius: "4px",
                    background: locale === option ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
                    color: locale === option ? "white" : "var(--color-text-strong)",
                    cursor: "pointer",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                  }}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
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
                background: allVisible ? "transparent" : "var(--color-bg-elevated)",
                color: allVisible ? "var(--gray-400)" : "var(--color-text-strong)",
                cursor: allVisible ? "default" : "pointer",
                opacity: allVisible ? 0.5 : 1,
              }}
            >
              {t(locale, "all")}
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
                background: noneVisible ? "transparent" : "var(--color-bg-elevated)",
                color: noneVisible ? "var(--gray-400)" : "var(--color-text-strong)",
                cursor: noneVisible ? "default" : "pointer",
                opacity: noneVisible ? 0.5 : 1,
              }}
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0 8px 0 14px",
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
                <label
                  role="menuitemcheckbox"
                  aria-checked={isVisible}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flex: 1,
                    minWidth: 0,
                    padding: "6px 0",
                    cursor: "pointer",
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
                  <span
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {columnLabel(col)}
                  </span>
                </label>
                <button
                  type="button"
                  aria-label={`${locale === "en" ? "Inspect column" : "Inspeccionar columna"} ${columnLabel(col)}`}
                  onClick={() => setSelectedColumnKey(col.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    border: "1px solid transparent",
                    borderRadius: "4px",
                    background: selectedColumnKey === col.key ? "var(--aia-corp-xlight)" : "transparent",
                    color: selectedColumnKey === col.key ? "var(--aia-corp-dark)" : "var(--aia-corp-mid)",
                    cursor: "pointer",
                    flex: "0 0 auto",
                  }}
                >
                  <Info size={14} />
                </button>
              </div>
            );
          })}

          {selectedColumn && (
            <div
              data-testid="field-inspector"
              style={{
                margin: "8px 10px 4px",
                padding: "10px",
                border: "1px solid rgba(74, 124, 100, 0.25)",
                borderRadius: "6px",
                background: "var(--color-bg-elevated)",
              }}
            >
              <div
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--aia-corp-mid)",
                  marginBottom: "6px",
                }}
              >
                {locale === "en" ? "Field inspector" : "Inspector de campo"}
              </div>
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(84px, 0.45fr) minmax(0, 1fr)",
                  gap: "5px 8px",
                  margin: 0,
                  fontSize: "0.75rem",
                  lineHeight: 1.35,
                }}
              >
                {(selectedInspection ? inspectionRows(selectedInspection) : metadataRows(selectedColumn)).map((row) => (
                  <div key={`${row.label}-${row.value}`} style={{ display: "contents" }}>
                    <dt style={{ color: "var(--aia-corp-mid)", fontWeight: 600 }}>
                      {row.label}
                    </dt>
                    <dd
                      style={{
                        margin: 0,
                        color: "var(--color-text-strong)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

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
                background: "var(--color-bg-elevated)",
                color: "var(--color-text-strong)",
                cursor: "pointer",
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--aia-corp-xlight)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--color-bg-elevated)";
              }}
            >
              {t(locale, "reset")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
