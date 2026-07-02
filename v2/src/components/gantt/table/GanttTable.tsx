"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { MppCustomFieldDefinition, MppTaskColumn, TaskColumnSettings } from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";
import { t } from "@/lib/i18n";
import { getMppColumnLabel } from "@/lib/mpp/fieldLabels";
import { inspectMppField } from "@/lib/mpp/fieldInspector";
import {
  DEFAULT_TASK_COLUMN_SETTINGS,
  normalizeTaskColumnSettings,
} from "@/lib/mpp/taskColumns";
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
  mppTaskColumns?: MppTaskColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
  columnSettings?: TaskColumnSettings;
  locale?: UILocale;
  onColumnSettingsChange?: (settings: TaskColumnSettings) => void;
  onLocaleChange?: (locale: UILocale) => void;
}

/** Default column definitions for the MS Project-style Entry table. */
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", labelEn: "ID", labelEs: "ID", width: 50, align: "right", defaultVisible: true },
  { key: "uniqueId", label: "Id. único", labelEn: "Unique ID", labelEs: "Id. único", width: 90, align: "right", defaultVisible: true },
  { key: "wbs", label: "EDT", labelEn: "WBS", labelEs: "EDT", width: 80, align: "left", defaultVisible: true },
  { key: "name", label: "Actividad", labelEn: "Activity", labelEs: "Actividad", width: 220, align: "left", defaultVisible: true },
  { key: "summary", label: "Resumen", labelEn: "Summary", labelEs: "Resumen", width: 80, align: "center", defaultVisible: true },
  { key: "duration", label: "Duración", labelEn: "Duration", labelEs: "Duración", width: 90, align: "right", defaultVisible: true },
  { key: "start", label: "Comienzo", labelEn: "Start", labelEs: "Comienzo", width: 110, align: "left", defaultVisible: true },
  { key: "finish", label: "Fin", labelEn: "Finish", labelEs: "Fin", width: 110, align: "left", defaultVisible: true },
  { key: "predecessors", label: "Predecesora", labelEn: "Predecessor", labelEs: "Predecesora", width: 120, align: "left", defaultVisible: true },
  { key: "progress", label: "% completado", labelEn: "% Complete", labelEs: "% completado", width: 100, align: "right", defaultVisible: true },
  { key: "critical", label: "Crítica", labelEn: "Critical", labelEs: "Crítica", width: 80, align: "center", defaultVisible: true },
  { key: "budgetedCost", label: "Costo presupuestado", labelEn: "Budgeted Cost", labelEs: "Costo presupuestado", width: 140, align: "right", defaultVisible: false },
  { key: "actualCost", label: "Costo real", labelEn: "Actual Cost", labelEs: "Costo real", width: 110, align: "right", defaultVisible: false },
  { key: "variance", label: "Varianza", labelEn: "Variance", labelEs: "Varianza", width: 110, align: "right", defaultVisible: false },
];

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

const LEVEL_BUTTONS: Array<{ label: string; labelEs: string; level: number }> = [
  { label: "L1", labelEs: "L1", level: 2 },
  { label: "L2", labelEs: "L2", level: 3 },
  { label: "L3", labelEs: "L3", level: 4 },
  { label: "All", labelEs: "Todo", level: 1 },
];

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
  selectedTaskIds,
  onTaskSelect,
  onUpdateTask,
  budgetMappings,
  budgetItems,
  mppTaskColumns = [],
  customFieldDefinitions = [],
  columnSettings,
  locale = "es",
  onColumnSettingsChange,
  onLocaleChange,
}: GanttTableProps) {
  const [localLocale, setLocalLocale] = useState<UILocale>(locale);
  const [localColumnSettings, setLocalColumnSettings] = useState<TaskColumnSettings>(
    () => normalizeTaskColumnSettings(columnSettings, locale),
  );

  useEffect(() => {
    setLocalLocale(locale);
  }, [locale]);

  useEffect(() => {
    setLocalColumnSettings(normalizeTaskColumnSettings(columnSettings, locale));
  }, [columnSettings, locale]);

  const isColumnSettingsControlled = !!onColumnSettingsChange;
  const effectiveLocale = onLocaleChange ? locale : localLocale;
  const effectiveColumnSettings = isColumnSettingsControlled
    ? columnSettings
    : localColumnSettings;

  const normalizedSettings = useMemo(
    () => normalizeTaskColumnSettings(effectiveColumnSettings, effectiveLocale),
    [effectiveColumnSettings, effectiveLocale],
  );
  const visibleColumns = normalizedSettings.visible;
  const columnWidths = useMemo(
    () => ({ ...DEFAULT_WIDTHS, ...normalizedSettings.widths }),
    [normalizedSettings.widths],
  );

  const allColumns = useMemo<ColumnConfig[]>(
    () => [
      ...DEFAULT_COLUMNS,
      ...mppTaskColumns.map((column) => ({
        key: column.key,
        label: getMppColumnLabel(column, effectiveLocale),
        labelEn: column.labelEn,
        labelEs: column.labelEs,
        width: column.width ?? 140,
        align:
          column.dataType === "number" || column.dataType === "currency" || column.dataType === "duration"
            ? "right"
            : column.dataType === "boolean"
              ? "center"
              : "left",
        defaultVisible: false,
        sourceKey: column.sourceKey,
        dataType: column.dataType,
        readOnly: !column.isEditable,
        group: column.group,
        calculationSpec: column.calculationSpec,
      } satisfies ColumnConfig)),
    ],
    [mppTaskColumns, effectiveLocale],
  );

  const fieldInspections = useMemo(() => {
    const inspections: Record<string, ReturnType<typeof inspectMppField>> = {};
    for (const column of mppTaskColumns) {
      let inspectionForColumn: ReturnType<typeof inspectMppField> | undefined;
      for (const task of tasks) {
        const inspection = inspectMppField({
          record: task,
          column,
          customFieldDefinitions,
          locale: effectiveLocale,
        });
        if (inspection.value !== undefined && inspection.value !== null && inspection.value !== "") {
          inspectionForColumn = inspection;
          break;
        }
      }
      if (!inspectionForColumn && tasks[0]) {
        inspectionForColumn = inspectMppField({
          record: tasks[0],
          column,
          customFieldDefinitions,
          locale: effectiveLocale,
        });
      }
      if (inspectionForColumn) {
        inspections[column.key] = inspectionForColumn;
      }
    }
    return inspections;
  }, [customFieldDefinitions, effectiveLocale, mppTaskColumns, tasks]);

  // Filter columns to only those that are visible
  const displayColumns = useMemo(
    () => allColumns.filter((col) => visibleColumns.includes(col.key)),
    [allColumns, visibleColumns]
  );

  // Total width of visible columns — table uses this as minWidth so it
  // expands beyond the pane instead of compressing columns to fit 100%.
  const tableMinWidth = useMemo(
    () => displayColumns.reduce((sum, col) => sum + (columnWidths[col.key] ?? col.width), 0),
    [displayColumns, columnWidths],
  );

  const applySettings = useCallback(
    (next: TaskColumnSettings) => {
      if (onColumnSettingsChange) {
        onColumnSettingsChange(next);
      } else {
        setLocalColumnSettings(next);
      }
    },
    [onColumnSettingsChange],
  );

  // Toggle a single column's visibility
  const handleToggle = useCallback(
    (key: string) => {
      const nextVisible = visibleColumns.includes(key)
        ? visibleColumns.filter((k) => k !== key)
        : [...visibleColumns, key].sort(
            (a, b) =>
              allColumns.findIndex((col) => col.key === a) -
              allColumns.findIndex((col) => col.key === b),
          );
      applySettings({ ...normalizedSettings, visible: nextVisible });
    },
    [allColumns, applySettings, normalizedSettings, visibleColumns]
  );

  // Reset to defaults
  const handleReset = useCallback(() => {
    applySettings({
      ...DEFAULT_TASK_COLUMN_SETTINGS,
      labelLocale: normalizedSettings.labelLocale,
    });
  }, [applySettings, normalizedSettings.labelLocale]);

  // Resize a column
  const handleResize = useCallback(
    (key: string, newWidth: number) => {
      applySettings({
        ...normalizedSettings,
        widths: { ...normalizedSettings.widths, [key]: newWidth },
      });
    },
    [applySettings, normalizedSettings]
  );

  const handleLocaleChange = useCallback(
    (nextLocale: UILocale) => {
      setLocalLocale(nextLocale);
      onLocaleChange?.(nextLocale);
      applySettings({ ...normalizedSettings, labelLocale: nextLocale });
    },
    [applySettings, normalizedSettings, onLocaleChange],
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
        position: "relative",
        minWidth: 0,
      }}
    >
      {/* Toolbar: Column Selector remains visible in the table panel even with horizontal scroll. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          zIndex: 10,
          height: "40px",
          padding: "6px 10px",
          borderBottom: "1px solid var(--gray-200)",
          background: "var(--aia-alabaster)",
          boxSizing: "border-box",
          pointerEvents: "none",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <ColumnSelector
            columns={allColumns}
            visibleColumns={visibleColumns}
            locale={effectiveLocale}
            onToggle={handleToggle}
            onReset={handleReset}
            onLocaleChange={handleLocaleChange}
            fieldInspections={fieldInspections}
          />
        </div>
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
          {t(effectiveLocale, "expand")}:
        </span>
        {LEVEL_BUTTONS.map((btn) => (
          <button
            key={btn.label}
            data-testid="expand-level-button"
            style={toolbarBtnStyle}
            onClick={() => handleExpandToLevel(btn.level)}
          >
            {effectiveLocale === "en" ? btn.label : btn.labelEs ?? btn.label}
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
                label={effectiveLocale === "en" ? col.labelEn ?? col.label : col.labelEs ?? col.label}
                locale={effectiveLocale}
                width={columnWidths[col.key] ?? col.width}
                align={col.align}
                calculationSpec={col.calculationSpec}
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
                rowNumber={index + 1}
                isSelected={selectedTaskIds?.includes(task.id) ?? false}
                onSelect={onTaskSelect}
                isExpanded={!collapsedTaskIds.has(task.id)}
                onToggleExpand={() => handleToggleExpand(task.id)}
                onUpdateTask={onUpdateTask}
                columns={displayColumns}
                locale={effectiveLocale}
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
