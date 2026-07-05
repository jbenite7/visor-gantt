"use client";

import { useCallback, useMemo, useState } from "react";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { GanttTask } from "@/components/gantt/types";
import { Link, DollarSign, Trash2, ArrowRight } from "lucide-react";

/* ── Category labels ── */
const CATEGORY_LABELS: Record<string, string> = {
  labor: "Mano de Obra",
  materials: "Materiales",
  equipment: "Equipo",
  subcontractors: "Subcontratistas",
  other: "Otro",
};

const CATEGORY_COLORS: Record<string, string> = {
  labor: "var(--aia-corp-dark)",
  materials: "var(--aia-const-dark)",
  equipment: "var(--aia-arch-dark)",
  subcontractors: "oklch(35% 0.1 300)",
  other: "var(--gray-600)",
};

const FORMAT_CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface BudgetMappingProps {
  budgetItems: BudgetItem[];
  tasks: GanttTask[];
  mappings: BudgetMapping[];
  onAddMapping?: (mapping: BudgetMapping) => void;
  onRemoveMapping?: (mapping: BudgetMapping) => void;
}

/* ── Panel styles ── */
const panelStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  background: "var(--color-bg-elevated)",
  borderRadius: "var(--radius-lg)",
  border: "1px solid var(--color-hairline)",
  boxShadow: "var(--shadow-sm)",
  overflow: "hidden",
  minWidth: 0,
};

const panelHeaderStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontFamily: "var(--font-montserrat)",
  fontWeight: 700,
  fontSize: "0.75rem",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  borderBottom: "1px solid var(--color-hairline)",
};

const listItemStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: "0.8rem",
  borderBottom: "1px solid var(--color-hairline)",
  cursor: "pointer",
  transition: "background 0.15s",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

export default function BudgetMappingPanel({
  budgetItems,
  tasks,
  mappings,
  onAddMapping,
  onRemoveMapping,
}: BudgetMappingProps) {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | number | null>(
    null,
  );
  const [mappingAmount, setMappingAmount] = useState("");
  const [taskFilter, setTaskFilter] = useState("");

  /* ── Derived data ── */
  const mappedBudgetIds = useMemo(
    () => new Set(mappings.map((m) => m.budgetItemId)),
    [mappings],
  );

  const mappedTaskIds = useMemo(
    () => new Set(mappings.map((m) => m.taskId)),
    [mappings],
  );

  const filteredTasks = useMemo(() => {
    if (!taskFilter) return tasks;
    const lower = taskFilter.toLowerCase();
    return tasks.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        String(t.id).includes(lower),
    );
  }, [tasks, taskFilter]);

  const getMappingsForTask = useCallback(
    (taskId: string | number) => mappings.filter((m) => m.taskId === taskId),
    [mappings],
  );

  /* ── Create mapping ── */
  const handleMap = useCallback(() => {
    if (!selectedBudgetId || selectedTaskId === null || !onAddMapping) return;

    const amount = parseFloat(mappingAmount) || 0;
    if (amount <= 0) return;

    onAddMapping({
      budgetItemId: selectedBudgetId,
      taskId: selectedTaskId,
      amount,
    });

    // Reset selection
    setSelectedBudgetId(null);
    setSelectedTaskId(null);
    setMappingAmount("");
  }, [selectedBudgetId, selectedTaskId, mappingAmount, onAddMapping]);

  /* ── Total mapped amount for a budget item ── */
  const totalMapped = useCallback(
    (budgetId: string) =>
      mappings
        .filter((m) => m.budgetItemId === budgetId)
        .reduce((s, m) => s + m.amount, 0),
    [mappings],
  );

  return (
    <div
      data-testid="budget-mapping"
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
          Mapeo Presupuesto ↔ Tareas
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: "0.7rem",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-montserrat)",
          }}
        >
          {mappings.length} mapeos activos
        </span>
      </div>

      {/* ── Two-panel layout ── */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "12px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* ── Left Panel: Budget Items ── */}
        <div style={panelStyle}>
          <div
            style={{
              ...panelHeaderStyle,
              background: "var(--color-bg-surface)",
              color: "var(--color-text-strong)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <DollarSign size={14} />
            Items de Presupuesto ({budgetItems.length})
          </div>
          <div className="flex-1 overflow-auto">
            {budgetItems.length === 0 && (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--color-text-muted)",
                  fontStyle: "italic",
                  fontSize: "0.8rem",
                }}
              >
                No hay items de presupuesto. Importe un CSV en la vista de
                Presupuesto primero.
              </div>
            )}
            {budgetItems.map((item) => {
              const isSelected = selectedBudgetId === item.id;
              const isMapped = mappedBudgetIds.has(item.id);
              const mapped = totalMapped(item.id);
              const catColor =
                CATEGORY_COLORS[item.category] ?? "var(--gray-600)";

              return (
                <div
                  key={item.id}
                  data-testid="budget-item-row"
                  onClick={() =>
                    setSelectedBudgetId(isSelected ? null : item.id)
                  }
                  style={{
                    ...listItemStyle,
                    background: isSelected
                      ? "color-mix(in oklch, var(--aia-proj-xlight) 58%, var(--color-bg-elevated))"
                      : "var(--color-bg-elevated)",
                    borderLeft: `3px solid ${catColor}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {isMapped && (
                        <Link
                          size={12}
                          style={{ color: "var(--aia-proj-main)", flexShrink: 0 }}
                        />
                      )}
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--gray-800)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {item.subcategory ?? CATEGORY_LABELS[item.category]}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--gray-500)",
                        display: "flex",
                        gap: "8px",
                        marginTop: "2px",
                      }}
                    >
                      <span>{CATEGORY_LABELS[item.category]}</span>
                      <span>
                        {FORMAT_CURRENCY.format(item.budgetedAmount)}
                      </span>
                      {isMapped && (
                        <span style={{ color: "var(--aia-proj-main)" }}>
                          (mapeado: {FORMAT_CURRENCY.format(mapped)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right Panel: Tasks ── */}
        <div style={panelStyle}>
          <div
            style={{
              ...panelHeaderStyle,
              background: "var(--color-bg-surface)",
              color: "var(--color-text-strong)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ArrowRight size={14} />
            Tareas ({tasks.length})
          </div>

          {/* Filter */}
          <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--color-hairline)" }}>
            <input
              type="text"
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              placeholder="Filtrar tareas..."
              data-testid="task-filter-input"
              style={{
                width: "100%",
                padding: "4px 8px",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--radius-lg)",
                fontSize: "0.8rem",
                fontFamily: "var(--font-inter)",
                background: "var(--color-bg-elevated)",
              }}
            />
          </div>

          <div className="flex-1 overflow-auto">
            {filteredTasks.length === 0 && (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--color-text-muted)",
                  fontStyle: "italic",
                  fontSize: "0.8rem",
                }}
              >
                No hay tareas disponibles.
              </div>
            )}
            {filteredTasks.map((task) => {
              const isSelected = selectedTaskId === task.id;
              const isMapped = mappedTaskIds.has(task.id);
              const taskMappings = getMappingsForTask(task.id);

              return (
                <div
                  key={task.id}
                  data-testid="task-row"
                  onClick={() =>
                    setSelectedTaskId(isSelected ? null : task.id)
                  }
                  style={{
                    ...listItemStyle,
                    background: isSelected
                      ? "color-mix(in oklch, var(--aia-proj-xlight) 58%, var(--color-bg-elevated))"
                      : "var(--color-bg-elevated)",
                    borderLeft: task.isCritical
                      ? "3px solid var(--aia-alert-main)"
                      : "3px solid var(--color-hairline)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      {isMapped && (
                        <DollarSign
                          size={12}
                          style={{
                            color: "var(--aia-corp-main)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.75rem",
                          color: task.isCritical
                            ? "var(--aia-alert-main)"
                            : "var(--gray-800)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {task.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--gray-500)",
                        display: "flex",
                        gap: "8px",
                        marginTop: "2px",
                      }}
                    >
                      <span>ID: {task.id}</span>
                      <span>{task.duration}d</span>
                      {taskMappings.length > 0 && (
                        <span style={{ color: "var(--aia-corp-main)" }}>
                          {taskMappings.length} presupuesto(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mapping Controls ── */}
      {selectedBudgetId && selectedTaskId !== null && onAddMapping && (
        <div
          data-testid="mapping-controls"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            background: "color-mix(in oklch, var(--aia-proj-xlight) 58%, var(--color-bg-elevated))",
            borderTop: "1px solid var(--color-hairline)",
          }}
        >
          <ArrowRight
            size={16}
            style={{ color: "var(--aia-proj-main)", flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              color: "var(--gray-700)",
            }}
          >
            Mapear:
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-strong)",
              fontWeight: 600,
            }}
          >
            {
              budgetItems.find((b) => b.id === selectedBudgetId)?.subcategory ??
                budgetItems.find((b) => b.id === selectedBudgetId)?.category
            }
          </span>
          <ArrowRight size={14} style={{ color: "var(--gray-400)" }} />
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-strong)",
              fontWeight: 600,
            }}
          >
            {tasks.find((t) => t.id === selectedTaskId)?.name ??
              `Tarea ${String(selectedTaskId)}`}
          </span>
          <span style={{ color: "var(--gray-400)" }}>|</span>
          <label
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              color: "var(--gray-600)",
            }}
          >
            Monto:
          </label>
          <input
            type="number"
            value={mappingAmount}
            onChange={(e) => setMappingAmount(e.target.value)}
            placeholder="0"
            min={0}
            data-testid="mapping-amount-input"
            style={{
              width: "120px",
              padding: "4px 8px",
              border: "1px solid var(--aia-proj-main)",
              borderRadius: "var(--radius-lg)",
              fontSize: "0.8rem",
              fontFamily: "var(--font-montserrat)",
              background: "var(--color-bg-elevated)",
              textAlign: "right",
            }}
          />
          <button
            data-testid="map-button"
            onClick={handleMap}
            disabled={!mappingAmount || parseFloat(mappingAmount) <= 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 16px",
              border: "none",
              borderRadius: "var(--radius-lg)",
              background:
                mappingAmount && parseFloat(mappingAmount) > 0
                  ? "var(--aia-proj-main)"
                  : "var(--gray-300)",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              cursor:
                mappingAmount && parseFloat(mappingAmount) > 0
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            <Link size={14} />
            Mapear
          </button>
        </div>
      )}

      {/* ── Mappings List ── */}
      {mappings.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--color-hairline)",
            background: "var(--color-bg-surface-secondary)",
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 700,
              fontSize: "0.7rem",
              color: "var(--gray-600)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.05em",
              borderBottom: "1px solid var(--color-hairline)",
            }}
          >
            Mapeos Activos
          </div>
          <div
            className="overflow-auto"
            style={{ maxHeight: "180px" }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                fontSize: "0.75rem",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      padding: "4px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--gray-600)",
                      fontSize: "0.7rem",
                      borderBottom: "1px solid var(--color-hairline)",
                    }}
                  >
                    Presupuesto
                  </th>
                  <th
                    style={{
                      padding: "4px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--gray-600)",
                      fontSize: "0.7rem",
                      borderBottom: "1px solid var(--color-hairline)",
                    }}
                  >
                    Tarea
                  </th>
                  <th
                    style={{
                      padding: "4px 12px",
                      textAlign: "right",
                      fontWeight: 600,
                      color: "var(--gray-600)",
                      fontSize: "0.7rem",
                      borderBottom: "1px solid var(--color-hairline)",
                    }}
                  >
                    Monto
                  </th>
                  <th
                    style={{
                      padding: "4px 12px",
                      borderBottom: "1px solid var(--color-hairline)",
                    }}
                  ></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping, idx) => {
                  const budgetItem = budgetItems.find(
                    (b) => b.id === mapping.budgetItemId,
                  );
                  const task = tasks.find((t) => t.id === mapping.taskId);

                  return (
                    <tr
                      key={`${mapping.budgetItemId}-${mapping.taskId}`}
                      data-testid="mapping-row"
                      style={{
                        background:
                          idx % 2 === 0 ? "var(--color-bg-elevated)" : "var(--color-bg-surface-secondary)",
                      }}
                    >
                      <td
                        style={{
                          padding: "4px 12px",
                          color: "var(--gray-700)",
                        }}
                      >
                        {budgetItem?.subcategory ??
                          CATEGORY_LABELS[budgetItem?.category ?? "other"]}
                      </td>
                      <td
                        style={{
                          padding: "4px 12px",
                          color: "var(--gray-700)",
                        }}
                      >
                        {task?.name ?? `Tarea ${String(mapping.taskId)}`}
                      </td>
                      <td
                        style={{
                          padding: "4px 12px",
                          textAlign: "right",
                          fontFamily: "var(--font-montserrat)",
                          fontWeight: 600,
                          color: "var(--color-text-strong)",
                        }}
                      >
                        {FORMAT_CURRENCY.format(mapping.amount)}
                      </td>
                      <td style={{ padding: "4px 12px" }}>
                        {onRemoveMapping && (
                          <button
                            data-testid="remove-mapping-btn"
                            onClick={() => onRemoveMapping(mapping)}
                            style={{
                              padding: "2px 6px",
                              border: "1px solid var(--color-hairline)",
                              borderRadius: "var(--radius-lg)",
                              background: "var(--color-bg-elevated)",
                              color: "var(--aia-alert-main)",
                              cursor: "pointer",
                              fontSize: "0.7rem",
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
