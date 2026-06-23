"use client";

import { useState, useCallback, useMemo } from "react";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import ColumnHeader from "./ColumnHeader";
import ColumnSelector from "./ColumnSelector";
import type { ColumnConfig } from "./ColumnSelector";
import GanttRow from "./GanttRow";

interface TaskBudgetData {
  budgetedCost?: number;
  actualCost?: number;
  variance?: number;
}

interface GanttTableProps {
  tasks: GanttTask[];
  onRowClick?: (task: GanttTask) => void;
  selectedTaskIds?: (string | number)[];
  onTaskSelect?: (taskId: string | number, ctrlKey: boolean) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onUpdateTask?: (
    taskId: string | number,
    field: string,
    value: unknown
  ) => void;
  budgetMappings?: BudgetMapping[];
  budgetItems?: BudgetItem[];
}

/** Default column definitions for the MS Project-style Entry table. */
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", width: 50, align: "right", defaultVisible: true },
  { key: "wbs", label: "WBS", width: 80, align: "left", defaultVisible: true },
  { key: "name", label: "Name", width: 200, align: "left", defaultVisible: true },
  { key: "duration", label: "Duration", width: 80, align: "right", defaultVisible: true },
  { key: "start", label: "Start", width: 100, align: "left", defaultVisible: true },
  { key: "finish", label: "Finish", width: 100, align: "left", defaultVisible: true },
  { key: "predecessors", label: "Predecessors", width: 100, align: "left", defaultVisible: true },
  { key: "progress", label: "% Complete", width: 80, align: "right", defaultVisible: true },
  { key: "critical", label: "Critical", width: 60, align: "center", defaultVisible: true },
  { key: "budgetedCost", label: "Costo Presupuestado", width: 120, align: "right", defaultVisible: false },
  { key: "actualCost", label: "Costo Real", width: 100, align: "right", defaultVisible: false },
  { key: "variance", label: "Varianza", width: 100, align: "right", defaultVisible: false },
];

const DEFAULT_VISIBLE_KEYS = DEFAULT_COLUMNS.map((c) => c.key);
const DEFAULT_WIDTHS: Record<string, number> = Object.fromEntries(
  DEFAULT_COLUMNS.map((c) => [c.key, c.width])
);

function getVisibleTasks(
  tasks: GanttTask[],
  collapsedIds: Set<string | number>,
): GanttTask[] {
  const visible: GanttTask[] = [];
  const collapsedStack: number[] = [];

  for (const task of tasks) {
    while (
      collapsedStack.length > 0 &&
      collapsedStack[collapsedStack.length - 1] >= task.outlineLevel
    ) {
      collapsedStack.pop();
    }

    if (task.isSummary && collapsedIds.has(task.id)) {
      collapsedStack.push(task.outlineLevel);
      visible.push(task);
    } else if (
      collapsedStack.length > 0 &&
      task.outlineLevel > collapsedStack[collapsedStack.length - 1]
    ) {
      continue;
    } else {
      visible.push(task);
    }
  }

  return visible;
}

function expandToLevel(
  tasks: GanttTask[],
  level: number,
): Set<string | number> {
  const collapsed = new Set<string | number>();
  for (const task of tasks) {
    if (task.isSummary && task.outlineLevel >= level) {
      collapsed.add(task.id);
    }
  }
  return collapsed;
}

const LEVEL_BUTTONS = [
  { label: "L1", level: 2 },
  { label: "L2", level: 3 },
  { label: "L3", level: 4 },
  { label: "All", level: 1 },
] as const;

const toolbarBtnStyle: React.CSSProperties = {
  padding: "2px 8px",
  fontSize: "0.6875rem",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  fontWeight: 500,
  border: "1px solid var(--gray-200)",
  borderRadius: "4px",
  background: "var(--aia-corp-xlight)",
  color: "var(--aia-corp-dark)",
  cursor: "pointer",
  lineHeight: "1.4",
  whiteSpace: "nowrap",
};

/**
 * GanttEntryTable — left-side table mirroring MS Project's Entry table.
 *
 * Renders task rows with WBS indentation, summary/milestone styling,
 * row striping, and a sticky header. Columns are configurable via
 * ColumnSelector with preferences persisted in localStorage.
 */
export default function GanttTable({
  tasks,
  onRowClick,
  selectedTaskIds,
  onTaskSelect,
  onUpdateTask,
  budgetMappings,
  budgetItems,
}: GanttTableProps) {
  // Persist column preferences to localStorage
  const [visibleColumns, setVisibleColumns] = useLocalStorage<string[]>(
    "gantt-visible-columns",
    DEFAULT_VISIBLE_KEYS
  );
  const [columnWidths, setColumnWidths] = useLocalStorage<Record<string, number>>(
    "gantt-column-widths",
    DEFAULT_WIDTHS
  );

  // Filter columns to only those that are visible
  const displayColumns = useMemo(
    () => DEFAULT_COLUMNS.filter((col) => visibleColumns.includes(col.key)),
    [visibleColumns]
  );

  // Total width of visible columns — table uses this as minWidth so it
  // expands beyond the pane instead of compressing columns to fit 100%.
  const tableMinWidth = useMemo(
    () => displayColumns.reduce((sum, col) => sum + (columnWidths[col.key] ?? col.width), 0),
    [displayColumns, columnWidths],
  );

  // Toggle a single column's visibility
  const handleToggle = useCallback(
    (key: string) => {
      setVisibleColumns((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key);
        }
        // Re-insert in original order
        const allKeys = DEFAULT_COLUMNS.map((c) => c.key);
        const next = [...prev, key];
        return next.sort((a, b) => allKeys.indexOf(a) - allKeys.indexOf(b));
      });
    },
    [setVisibleColumns]
  );

  // Reset to defaults
  const handleReset = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE_KEYS);
    setColumnWidths(DEFAULT_WIDTHS);
  }, [setVisibleColumns, setColumnWidths]);

  // Resize a column
  const handleResize = useCallback(
    (key: string, newWidth: number) => {
      setColumnWidths((prev) => ({ ...prev, [key]: newWidth }));
    },
    [setColumnWidths]
  );

  const [collapsedTaskIds, setCollapsedTaskIds] = useState<
    Set<string | number>
  >(new Set());

  const handleToggleExpand = useCallback((taskId: string | number) => {
    setCollapsedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleExpandToLevel = useCallback(
    (level: number) => {
      setCollapsedTaskIds(expandToLevel(tasks, level));
    },
    [tasks],
  );

  const visibleTasks = useMemo(
    () => getVisibleTasks(tasks, collapsedTaskIds),
    [tasks, collapsedTaskIds],
  );

  const budgetData = useMemo(() => {
    if (!budgetMappings && !budgetItems) return new Map<string | number, TaskBudgetData>();
    const map = new Map<string | number, TaskBudgetData>();

    if (budgetMappings) {
      for (const mapping of budgetMappings) {
        const existing = map.get(mapping.taskId) ?? {};
        existing.budgetedCost = (existing.budgetedCost ?? 0) + mapping.amount;
        map.set(mapping.taskId, existing);
      }
    }

    if (budgetItems) {
      for (const item of budgetItems) {
        if (item.mappedTaskIds.length === 0) continue;
        const spentPerTask = item.spentAmount / item.mappedTaskIds.length;
        for (const taskId of item.mappedTaskIds) {
          const existing = map.get(taskId) ?? {};
          existing.actualCost = (existing.actualCost ?? 0) + spentPerTask;
          map.set(taskId, existing);
        }
      }
    }

    for (const [taskId, data] of map) {
      if (data.budgetedCost !== undefined && data.actualCost !== undefined) {
        data.variance = data.budgetedCost - data.actualCost;
      } else if (data.budgetedCost !== undefined) {
        data.variance = data.budgetedCost;
      }
      map.set(taskId, data);
    }

    return map;
  }, [budgetMappings, budgetItems]);

  return (
    <div
      data-testid="gantt-table"
      style={{
        background: "var(--color-bg-surface)",
        borderRight: "1px solid var(--gray-200)",
      }}
    >
      {/* Toolbar: Column Selector — minWidth matches table so it doesn't create extra scroll space */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "flex-end",
          padding: "6px 10px",
          borderBottom: "1px solid var(--gray-200)",
          background: "var(--aia-alabaster)",
          minWidth: tableMinWidth,
        }}
      >
        <ColumnSelector
          columns={DEFAULT_COLUMNS}
          visibleColumns={visibleColumns}
          onToggle={handleToggle}
          onReset={handleReset}
        />
      </div>

      <div
        data-testid="expand-level-toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 9,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 10px",
          borderBottom: "1px solid var(--gray-200)",
          background: "var(--color-bg-surface)",
          minWidth: tableMinWidth,
        }}
      >
        <span
          style={{
            fontSize: "0.6875rem",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            color: "var(--gray-500)",
            marginRight: "2px",
          }}
        >
          Expand:
        </span>
        {LEVEL_BUTTONS.map((btn) => (
          <button
            key={btn.label}
            data-testid="expand-level-button"
            style={toolbarBtnStyle}
            onClick={() => handleExpandToLevel(btn.level)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <table
        style={{
          minWidth: tableMinWidth,
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        {/* ── Sticky Header ── */}
        <thead style={{ position: "sticky", top: 0, zIndex: 8, background: "var(--color-bg-surface)" }}>
          <tr>
            {displayColumns.map((col) => (
              <ColumnHeader
                key={col.key}
                label={col.label}
                width={columnWidths[col.key] ?? col.width}
                align={col.align}
                onResize={(newWidth) => handleResize(col.key, newWidth)}
              />
            ))}
          </tr>
        </thead>

        {/* ── Task Rows ── */}
        <tbody>
          {visibleTasks.map((task, index) => {
            const taskBudget = budgetData.get(task.id);
            return (
              <GanttRow
                key={task.id}
                task={task}
                index={index}
                isSelected={selectedTaskIds?.includes(task.id) ?? false}
                onSelect={onTaskSelect}
                isExpanded={!collapsedTaskIds.has(task.id)}
                onToggleExpand={() => handleToggleExpand(task.id)}
                onUpdateTask={onUpdateTask}
                budgetedCost={taskBudget?.budgetedCost}
                actualCost={taskBudget?.actualCost}
                variance={taskBudget?.variance}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
