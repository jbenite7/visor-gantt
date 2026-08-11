"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { BudgetCategory, BudgetItem } from "@/types/budget";
import { parseBudgetCSV, validateBudgetItem } from "@/lib/budget/budgetParser";
import { Upload, Plus, Trash2, Pencil } from "lucide-react";

/* ── Category palette (AIA-aligned) ── */
const CATEGORY_STYLES: Record<
  BudgetCategory,
  { label: string; bg: string; text: string }
> = {
  labor: {
    label: "Mano de Obra",
    bg: "var(--aia-corp-xlight)",
    text: "var(--aia-corp-dark)",
  },
  materials: {
    label: "Materiales",
    bg: "var(--aia-const-xlight)",
    text: "var(--aia-const-dark)",
  },
  equipment: {
    label: "Equipo",
    bg: "var(--aia-arch-xlight)",
    text: "var(--aia-arch-dark)",
  },
  subcontractors: {
    label: "Subcontratistas",
    bg: "oklch(92% 0.05 300)",
    text: "oklch(35% 0.1 300)",
  },
  other: {
    label: "Otro",
    bg: "var(--gray-100)",
    text: "var(--gray-600)",
  },
};

const CATEGORIES: BudgetCategory[] = [
  "labor",
  "materials",
  "equipment",
  "subcontractors",
  "other",
];

const FORMAT_CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface BudgetTableProps {
  items: BudgetItem[];
  onAddItem?: (item: BudgetItem) => void;
  onUpdateItem?: (item: BudgetItem) => void;
  onDeleteItem?: (id: string) => void;
  onImportCSV?: (items: BudgetItem[]) => void;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ── Summary Bar ── */
function SummaryBar({ items }: { items: BudgetItem[] }) {
  const summary = useMemo(() => {
    const totals: Record<
      BudgetCategory,
      { budgeted: number; spent: number }
    > = {
      labor: { budgeted: 0, spent: 0 },
      materials: { budgeted: 0, spent: 0 },
      equipment: { budgeted: 0, spent: 0 },
      subcontractors: { budgeted: 0, spent: 0 },
      other: { budgeted: 0, spent: 0 },
    };
    for (const item of items) {
      totals[item.category].budgeted += item.budgetedAmount;
      totals[item.category].spent += item.spentAmount;
    }
    return totals;
  }, [items]);

  const grandBudgeted = useMemo(
    () => items.reduce((s, i) => s + i.budgetedAmount, 0),
    [items],
  );
  const grandSpent = useMemo(
    () => items.reduce((s, i) => s + i.spentAmount, 0),
    [items],
  );
  const grandVariance = grandBudgeted - grandSpent;

  return (
    <div
      data-testid="budget-summary"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "8px 12px",
        background: "var(--color-bg-glass)",
        borderBottom: "1px solid var(--color-hairline)",
        fontSize: "0.75rem",
        fontFamily: "var(--font-montserrat)",
      }}
    >
      {/* Grand totals */}
      <div style={{ fontWeight: 700, marginRight: "12px" }}>
        <span style={{ color: "var(--gray-600)" }}>Total: </span>
        <span>{FORMAT_CURRENCY.format(grandBudgeted)}</span>
        <span style={{ margin: "0 6px", color: "var(--gray-400)" }}>/</span>
        <span>Gastado: {FORMAT_CURRENCY.format(grandSpent)}</span>
        <span style={{ margin: "0 6px", color: "var(--gray-400)" }}>/</span>
        <span
          style={{ color: grandVariance >= 0 ? "var(--aia-corp-main)" : "var(--aia-alert-main)" }}
        >
          Variación: {FORMAT_CURRENCY.format(grandVariance)}
        </span>
      </div>

      {/* Per-category summaries */}
      {CATEGORIES.map((cat) => {
        const t = summary[cat];
        if (t.budgeted === 0 && t.spent === 0) return null;
        const style = CATEGORY_STYLES[cat];
        const variance = t.budgeted - t.spent;
        return (
          <div
            key={cat}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              background: style.bg,
              color: style.text,
            }}
          >
            <span style={{ fontWeight: 600 }}>{style.label}:</span>
            <span>{FORMAT_CURRENCY.format(t.budgeted)}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span>{FORMAT_CURRENCY.format(t.spent)}</span>
            <span
              style={{
                fontWeight: 600,
                color:
                  variance >= 0 ? "var(--aia-corp-dark)" : "var(--aia-alert-main)",
              }}
            >
              ({variance >= 0 ? "+" : ""}
              {FORMAT_CURRENCY.format(variance)})
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Inline Add Form ── */
function AddItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: BudgetItem) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<BudgetCategory>("labor");
  const [subcategory, setSubcategory] = useState("");
  const [budgeted, setBudgeted] = useState("");
  const [spent, setSpent] = useState("0");
  const [period, setPeriod] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = useCallback(() => {
    const item: Partial<BudgetItem> = {
      category,
      subcategory: subcategory || undefined,
      budgetedAmount: parseFloat(budgeted) || 0,
      spentAmount: parseFloat(spent) || 0,
      period: period || undefined,
    };
    const validationErrors = validateBudgetItem(item);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onAdd({
      id: generateId(),
      category,
      subcategory: subcategory || undefined,
      budgetedAmount: parseFloat(budgeted) || 0,
      spentAmount: parseFloat(spent) || 0,
      period: period || undefined,
      mappedTaskIds: [],
    });
  }, [category, subcategory, budgeted, spent, period, onAdd]);

  const inputStyle: React.CSSProperties = {
    padding: "4px 8px",
    border: "1px solid var(--color-hairline)",
    borderRadius: "var(--radius-lg)",
    fontSize: "0.8rem",
    fontFamily: "var(--font-inter)",
    background: "var(--color-bg-elevated)",
  };

  return (
    <tr data-testid="add-item-form" style={{ background: "color-mix(in oklch, var(--aia-corp-xlight) 54%, var(--color-bg-elevated))" }}>
      <td style={{ padding: "6px 8px" }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as BudgetCategory)}
          style={{ ...inputStyle, width: "100%" }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_STYLES[cat].label}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="text"
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          placeholder="Subcategoría"
          style={{ ...inputStyle, width: "100%" }}
        />
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="number"
          value={budgeted}
          onChange={(e) => setBudgeted(e.target.value)}
          placeholder="0"
          min={0}
          style={{ ...inputStyle, width: "100%", textAlign: "right" }}
        />
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="number"
          value={spent}
          onChange={(e) => setSpent(e.target.value)}
          placeholder="0"
          min={0}
          style={{ ...inputStyle, width: "100%", textAlign: "right" }}
        />
      </td>
      <td style={{ padding: "6px 8px", textAlign: "right" }}>—</td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="text"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          placeholder="ej. Q1-2026"
          style={{ ...inputStyle, width: "100%" }}
        />
      </td>
      <td style={{ padding: "6px 8px" }}>—</td>
      <td style={{ padding: "6px 8px", display: "flex", gap: "4px" }}>
        <button
          data-testid="add-item-confirm"
          onClick={handleSubmit}
          style={{
            padding: "4px 10px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: "var(--aia-corp-main)",
            color: "var(--color-text-on-primary)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-montserrat)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Agregar
        </button>
        <button
          data-testid="add-item-cancel"
          onClick={onCancel}
          style={{
            padding: "4px 10px",
            border: "1px solid var(--color-hairline)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-muted)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-montserrat)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </td>
      {errors.length > 0 && (
        <td
          colSpan={9}
          style={{
            padding: "0 8px 6px",
            fontSize: "0.7rem",
            color: "var(--aia-alert-main)",
          }}
        >
          {errors.join(" | ")}
        </td>
      )}
    </tr>
  );
}

/* ── Editable Row ── */
function EditableRow({
  item,
  onSave,
  onCancel,
}: {
  item: BudgetItem;
  onSave: (item: BudgetItem) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(item.category);
  const [subcategory, setSubcategory] = useState(item.subcategory ?? "");
  const [budgeted, setBudgeted] = useState(item.budgetedAmount.toString());
  const [spent, setSpent] = useState(item.spentAmount.toString());
  const [period, setPeriod] = useState(item.period ?? "");

  const handleSave = useCallback(() => {
    onSave({
      ...item,
      category,
      subcategory: subcategory || undefined,
      budgetedAmount: parseFloat(budgeted) || 0,
      spentAmount: parseFloat(spent) || 0,
      period: period || undefined,
    });
  }, [item, category, subcategory, budgeted, spent, period, onSave]);

  const inputStyle: React.CSSProperties = {
    padding: "4px 8px",
    border: "1px solid var(--color-hairline)",
    borderRadius: "var(--radius-lg)",
    fontSize: "0.8rem",
    fontFamily: "var(--font-inter)",
    background: "var(--color-bg-elevated)",
  };

  return (
    <tr
      data-testid="edit-row"
      style={{ background: "color-mix(in oklch, var(--aia-proj-xlight) 58%, var(--color-bg-elevated))" }}
    >
      <td style={{ padding: "6px 8px" }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as BudgetCategory)}
          style={{ ...inputStyle, width: "100%" }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_STYLES[cat].label}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="text"
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          style={{ ...inputStyle, width: "100%" }}
        />
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="number"
          value={budgeted}
          onChange={(e) => setBudgeted(e.target.value)}
          min={0}
          style={{ ...inputStyle, width: "100%", textAlign: "right" }}
        />
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="number"
          value={spent}
          onChange={(e) => setSpent(e.target.value)}
          min={0}
          style={{ ...inputStyle, width: "100%", textAlign: "right" }}
        />
      </td>
      <td style={{ padding: "6px 8px", textAlign: "right" }}>
        {FORMAT_CURRENCY.format(
          (parseFloat(budgeted) || 0) - (parseFloat(spent) || 0),
        )}
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="text"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ ...inputStyle, width: "100%" }}
        />
      </td>
      <td style={{ padding: "6px 8px", fontSize: "0.75rem", color: "var(--gray-500)" }}>
        {item.mappedTaskIds.length} tareas
      </td>
      <td style={{ padding: "6px 8px", display: "flex", gap: "4px" }}>
        <button
          data-testid="edit-save"
          onClick={handleSave}
          style={{
            padding: "4px 10px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: "var(--aia-corp-main)",
            color: "var(--color-text-on-primary)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-montserrat)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Guardar
        </button>
        <button
          data-testid="edit-cancel"
          onClick={onCancel}
          style={{
            padding: "4px 10px",
                          border: "1px solid var(--color-hairline)",
                          borderRadius: "var(--radius-lg)",
                          background: "var(--color-bg-elevated)",
                          color: "var(--color-text-muted)",
            fontSize: "0.75rem",
            fontFamily: "var(--font-montserrat)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </td>
    </tr>
  );
}

/* ── Main BudgetTable ── */
export default function BudgetTable({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onImportCSV,
}: BudgetTableProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImportCSV) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === "string") {
          const parsed = parseBudgetCSV(text);
          onImportCSV(parsed);
        }
      };
      reader.readAsText(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onImportCSV],
  );

  const handleAddItem = useCallback(
    (item: BudgetItem) => {
      onAddItem?.(item);
      setShowAddForm(false);
    },
    [onAddItem],
  );

  const handleSaveEdit = useCallback(
    (item: BudgetItem) => {
      onUpdateItem?.(item);
      setEditingId(null);
    },
    [onUpdateItem],
  );

  const handleDelete = useCallback(() => {
    if (selectedId && onDeleteItem) {
      onDeleteItem(selectedId);
      setSelectedId(null);
    }
  }, [selectedId, onDeleteItem]);

  const handleRowDoubleClick = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleRowClick = useCallback(
    (id: string) => {
      setSelectedId((prev) => (prev === id ? null : id));
    },
    [],
  );

  const thStyle: React.CSSProperties = {
    padding: "8px",
    textAlign: "left",
    fontSize: "0.7rem",
    fontFamily: "var(--font-montserrat)",
    fontWeight: 700,
    color: "var(--color-text-strong)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--color-hairline)",
    whiteSpace: "nowrap" as const,
    userSelect: "none" as const,
  };

  return (
    <div
      data-testid="budget-table"
      className="apple-module flex h-full flex-col"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {/* ── Toolbar ── */}
      <div
        className="apple-subtoolbar"
      >
        <span
          style={{
            fontFamily: "var(--font-montserrat)",
            fontWeight: 700,
            fontSize: "0.8rem",
            color: "var(--color-text-strong)",
          }}
        >
          Presupuesto
        </span>

        <div style={{ flex: 1 }} />

        {/* Import CSV */}
        {onImportCSV && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileImport}
              style={{ display: "none" }}
              data-testid="csv-file-input"
            />
            <button
              data-testid="import-csv-btn"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 12px",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--radius-lg)",
                background: "var(--color-bg-elevated)",
                color: "var(--color-text-strong)",
                fontSize: "0.75rem",
                fontFamily: "var(--font-montserrat)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Upload size={14} />
              Importar CSV
            </button>
          </>
        )}

        {/* Add Item */}
        {onAddItem && (
          <button
            data-testid="add-item-btn"
            onClick={() => setShowAddForm((prev) => !prev)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 12px",
              border: "none",
              borderRadius: "var(--radius-lg)",
              background: "var(--aia-corp-main)",
              color: "var(--color-text-on-primary)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            Agregar Item
          </button>
        )}

        {/* Delete */}
        {onDeleteItem && selectedId && (
          <button
            data-testid="delete-item-btn"
            onClick={handleDelete}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 12px",
              border: "1px solid var(--aia-alert-main)",
              borderRadius: "var(--radius-lg)",
              background: "var(--aia-alert-xlight)",
              color: "var(--aia-alert-main)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        )}
      </div>

      {/* ── Summary Bar ── */}
      <SummaryBar items={items} />

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: "0.8rem",
          }}
        >
          <thead>
            <tr className="apple-grid-header">
              <th style={thStyle}>Categoría</th>
              <th style={thStyle}>Subcategoría</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Presupuestado</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Gastado</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Variación</th>
              <th style={thStyle}>Período</th>
              <th style={thStyle}>Tareas</th>
              <th style={thStyle}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* Add form */}
            {showAddForm && (
              <AddItemForm
                onAdd={handleAddItem}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            {/* Data rows */}
            {items.length === 0 && !showAddForm && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                  }}
                >
                  No hay items de presupuesto. Importe un CSV o agregue items
                  manualmente.
                </td>
              </tr>
            )}

            {items.map((item, index) => {
              const catStyle = CATEGORY_STYLES[item.category];
              const variance = item.budgetedAmount - item.spentAmount;
              const isEditing = editingId === item.id;
              const isSelected = selectedId === item.id;

              if (isEditing) {
                return (
                  <EditableRow
                    key={item.id}
                    item={item}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }

              return (
                <tr
                  key={item.id}
                  data-testid="budget-row"
                  onDoubleClick={() => handleRowDoubleClick(item.id)}
                  onClick={() => handleRowClick(item.id)}
                  style={{
                    background: isSelected
                      ? "color-mix(in oklch, var(--aia-corp-xlight) 58%, var(--color-bg-elevated))"
                      : index % 2 === 0
                        ? "var(--color-bg-elevated)"
                        : "var(--color-bg-surface-secondary)",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--color-hairline)",
                    transition: "background 0.15s",
                  }}
                >
                  <td style={{ padding: "6px 8px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: catStyle.bg,
                        color: catStyle.text,
                        fontSize: "0.7rem",
                        fontFamily: "var(--font-montserrat)",
                        fontWeight: 600,
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      {catStyle.label}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--gray-600)",
                    }}
                  >
                    {item.subcategory ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      fontFamily: "var(--font-montserrat)",
                      fontWeight: 600,
                    }}
                  >
                    {FORMAT_CURRENCY.format(item.budgetedAmount)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      fontFamily: "var(--font-montserrat)",
                    }}
                  >
                    {FORMAT_CURRENCY.format(item.spentAmount)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      fontFamily: "var(--font-montserrat)",
                      fontWeight: 600,
                      color:
                        variance >= 0
                          ? "var(--aia-corp-main)"
                          : "var(--aia-alert-main)",
                    }}
                  >
                    {variance >= 0 ? "+" : ""}
                    {FORMAT_CURRENCY.format(variance)}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      color: "var(--gray-500)",
                      fontSize: "0.75rem",
                    }}
                  >
                    {item.period ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      fontSize: "0.75rem",
                      color: "var(--gray-500)",
                      textAlign: "center",
                    }}
                  >
                    {item.mappedTaskIds.length > 0 ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "2px",
                          color: "var(--aia-proj-main)",
                        }}
                      >
                        <Pencil size={12} />
                        {item.mappedTaskIds.length}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <button
                      data-testid="edit-row-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowDoubleClick(item.id);
                      }}
                      style={{
                        padding: "2px 6px",
                        border: "1px solid var(--color-hairline)",
                        borderRadius: "var(--radius-lg)",
                        background: "var(--color-bg-elevated)",
                        color: "var(--color-text-muted)",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
