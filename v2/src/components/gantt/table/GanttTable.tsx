"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  Blocks,
  ClipboardCopy,
  ClipboardPaste,
  CornerDownRight,
  Download,
  FolderPlus,
  IndentDecrease,
  IndentIncrease,
  ListPlus,
  Network,
  Percent,
  Search,
} from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import type { BudgetItem, BudgetMapping } from "@/types/budget";
import type { MppCustomFieldDefinition, MppTaskColumn, TaskColumnSettings } from "@/types/mppColumns";
import type { TaskFilterSettings, TaskFilterType, UILocale } from "@/types/ui";
import { t } from "@/lib/i18n";
import { filterTasks, normalizeTaskFilter } from "@/lib/gantt/taskFilters";
import { exportedScheduleFileName, tasksToExcelTsv } from "@/lib/gantt/scheduleExchange";
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
import DependencyPanel from "@/components/gantt/dependencies/DependencyPanel";

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
  taskFilter?: TaskFilterSettings;
  onTaskFilterChange?: (filter: TaskFilterSettings) => void;
  showTaskFilterControls?: boolean;
  onIndentTask?: (taskId: string | number) => void;
  onOutdentTask?: (taskId: string | number) => void;
  onMoveTaskUp?: (taskId: string | number) => void;
  onMoveTaskDown?: (taskId: string | number) => void;
  onReorderTask?: (
    taskId: string | number,
    targetTaskId: string | number,
    position: "before" | "after" | "child",
  ) => void;
  onInsertTask?: (options?: {
    afterTaskId?: string | number;
    parentTaskId?: string | number;
    kind?: "summary" | "task" | "milestone";
    name?: string;
  }) => void;
  onApplyStructureTemplate?: (
    templateId: "obra-gris-basica",
    options?: { afterTaskId?: string | number },
  ) => void;
  onSmartPasteTasks?: (
    rawText: string,
    options?: { afterTaskId?: string | number },
  ) => void;
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

const TASK_FILTER_OPTIONS: Array<{
  value: TaskFilterType;
  labelKey: "allTasks" | "critical" | "nonCritical" | "milestones" | "summaries";
}> = [
  { value: "all", labelKey: "allTasks" },
  { value: "critical", labelKey: "critical" },
  { value: "non-critical", labelKey: "nonCritical" },
  { value: "milestones", labelKey: "milestones" },
  { value: "summaries", labelKey: "summaries" },
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

const hierarchyBtnStyle = (disabled = false): React.CSSProperties => ({
  width: "26px",
  height: "26px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--gray-200)",
  borderRadius: "4px",
  background: "var(--aia-corp-xlight)",
  color: "var(--aia-corp-dark)",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
});

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
  taskFilter,
  onTaskFilterChange,
  showTaskFilterControls = true,
  onIndentTask,
  onOutdentTask,
  onMoveTaskUp,
  onMoveTaskDown,
  onReorderTask,
  onInsertTask,
  onApplyStructureTemplate,
  onSmartPasteTasks,
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
  const [dependencyPanelTaskId, setDependencyPanelTaskId] = useState<string | number | undefined>();
  const [smartPasteOpen, setSmartPasteOpen] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState("");
  const [bulkProgressOpen, setBulkProgressOpen] = useState(false);
  const [bulkProgressValue, setBulkProgressValue] = useState("0");
  const [exportStatus, setExportStatus] = useState<"idle" | "copied" | "downloaded" | "error">("idle");
  const [draggedTaskId, setDraggedTaskId] = useState<string | number | undefined>();
  const [dropTarget, setDropTarget] = useState<{
    taskId: string | number;
    position: "before" | "after" | "child";
  } | undefined>();

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

  const filteredTasks = useMemo(
    () => filterTasks(tasks, taskFilter),
    [tasks, taskFilter],
  );
  const visibleTasks = useMemo(
    () => getVisibleTasks(filteredTasks, collapsedTaskIds),
    [filteredTasks, collapsedTaskIds],
  );
  const normalizedTaskFilter = useMemo(
    () => normalizeTaskFilter(taskFilter),
    [taskFilter],
  );
  const hasActiveTaskFilter =
    normalizedTaskFilter.text.trim() !== "" || normalizedTaskFilter.type !== "all";
  const updateTaskFilter = useCallback(
    (patch: Partial<TaskFilterSettings>) => {
      onTaskFilterChange?.({ ...normalizedTaskFilter, ...patch });
    },
    [normalizedTaskFilter, onTaskFilterChange],
  );
  const clearTaskFilter = useCallback(
    () => onTaskFilterChange?.({ text: "", type: "all" }),
    [onTaskFilterChange],
  );
  const selectedTaskId = selectedTaskIds?.[0];
  const hasSelection = selectedTaskId !== undefined;
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId),
    [selectedTaskId, tasks],
  );
  const selectedTasks = useMemo(() => {
    const selected = selectedTaskIds ?? [];
    return selected
      .map((taskId) => tasks.find((task) => task.id === taskId))
      .filter((task): task is GanttTask => Boolean(task));
  }, [selectedTaskIds, tasks]);
  const canBulkEditProgress = selectedTasks.length > 1 && !!onUpdateTask;
  const dependencyPanelTask = useMemo(
    () => tasks.find((task) => task.id === dependencyPanelTaskId),
    [dependencyPanelTaskId, tasks],
  );

  const handleInsertTask = useCallback(
    (kind: "summary" | "task", parentTaskId?: string | number) => {
      onInsertTask?.({
        kind,
        parentTaskId,
        afterTaskId: parentTaskId === undefined ? selectedTaskId : undefined,
        name: kind === "summary" ? "Nuevo capitulo" : "Nueva tarea",
      });
    },
    [onInsertTask, selectedTaskId],
  );
  const handleApplySmartPaste = useCallback(() => {
    if (!smartPasteText.trim()) return;
    onSmartPasteTasks?.(smartPasteText, { afterTaskId: selectedTaskId });
    setSmartPasteText("");
    setSmartPasteOpen(false);
  }, [onSmartPasteTasks, selectedTaskId, smartPasteText]);
  const handleApplyBulkProgress = useCallback(() => {
    if (!canBulkEditProgress || !onUpdateTask) return;
    const parsed = Number.parseFloat(bulkProgressValue);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(100, Math.max(0, parsed));
    selectedTasks.forEach((task) => onUpdateTask(task.id, "progress", clamped));
    setBulkProgressOpen(false);
  }, [bulkProgressValue, canBulkEditProgress, onUpdateTask, selectedTasks]);

  const exportText = useMemo(
    () => tasksToExcelTsv(visibleTasks),
    [visibleTasks],
  );

  const handleCopyExport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setExportStatus("copied");
    } catch {
      setExportStatus("error");
    }
  }, [exportText]);

  const handleDownloadExport = useCallback(() => {
    const blob = new Blob([exportText], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportedScheduleFileName();
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus("downloaded");
  }, [exportText]);

  const handleRowDragStart = useCallback(
    (taskId: string | number, event: React.DragEvent<HTMLTableRowElement>) => {
      if (!onReorderTask) return;
      setDraggedTaskId(taskId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(taskId));
    },
    [onReorderTask],
  );

  const getDropPosition = useCallback(
    (event: React.DragEvent<HTMLTableRowElement>): "before" | "after" | "child" => {
      const rect = event.currentTarget.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      if (offsetY < rect.height / 3) return "before";
      if (offsetY > (rect.height * 2) / 3) return "after";
      return "child";
    },
    [],
  );

  const handleRowDragOver = useCallback(
    (taskId: string | number, event: React.DragEvent<HTMLTableRowElement>) => {
      if (!onReorderTask || draggedTaskId === undefined || draggedTaskId === taskId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget({ taskId, position: getDropPosition(event) });
    },
    [draggedTaskId, getDropPosition, onReorderTask],
  );

  const handleRowDrop = useCallback(
    (taskId: string | number, event: React.DragEvent<HTMLTableRowElement>) => {
      if (!onReorderTask || draggedTaskId === undefined || draggedTaskId === taskId) return;
      event.preventDefault();
      const position = dropTarget?.taskId === taskId
        ? dropTarget.position
        : getDropPosition(event);
      onReorderTask(draggedTaskId, taskId, position);
      setDraggedTaskId(undefined);
      setDropTarget(undefined);
    },
    [draggedTaskId, dropTarget, getDropPosition, onReorderTask],
  );

  const handleRowDragEnd = useCallback(() => {
    setDraggedTaskId(undefined);
    setDropTarget(undefined);
  }, []);

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
        {onTaskFilterChange && showTaskFilterControls && (
          <>
            <div
              data-testid="gantt-task-filter"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                minWidth: 280,
                maxWidth: 460,
                flex: "1 1 320px",
                padding: "2px 8px",
                border: "1px solid var(--gray-200)",
                borderRadius: "999px",
                background: "var(--aia-alabaster)",
              }}
            >
              <Search size={13} color="var(--gray-500)" />
              <input
                data-testid="gantt-task-filter-input"
                type="search"
                value={normalizedTaskFilter.text}
                placeholder={t(effectiveLocale, "filterByName")}
                onChange={(event) => updateTaskFilter({ text: event.target.value })}
                style={{
                  flex: 1,
                  minWidth: 100,
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  color: "var(--gray-900)",
                  fontFamily: "var(--font-inter), system-ui, sans-serif",
                  fontSize: "0.75rem",
                }}
              />
              <select
                data-testid="gantt-task-filter-type"
                value={normalizedTaskFilter.type}
                onChange={(event) =>
                  updateTaskFilter({ type: event.target.value as TaskFilterType })
                }
                style={{
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  color: "var(--gray-700)",
                  fontFamily: "var(--font-inter), system-ui, sans-serif",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                {TASK_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(effectiveLocale, option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <span
              data-testid="gantt-task-filter-count"
              style={{
                fontSize: "0.6875rem",
                color: "var(--gray-500)",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              {visibleTasks.length} / {tasks.length} {t(effectiveLocale, "tasks")}
            </span>
            {hasActiveTaskFilter && (
              <button
                type="button"
                data-testid="gantt-task-filter-clear"
                style={toolbarBtnStyle}
                onClick={clearTaskFilter}
              >
                {effectiveLocale === "en" ? "Clear" : "Limpiar"}
              </button>
            )}
            <span
              style={{
                width: 1,
                height: 18,
                background: "var(--gray-200)",
                margin: "0 4px",
              }}
            />
          </>
        )}
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
        <span
          style={{
            width: 1,
            height: 18,
            background: "var(--gray-200)",
            margin: "0 4px",
          }}
        />
        <button
          type="button"
          data-testid="hierarchy-move-up"
          title={effectiveLocale === "en" ? "Move task up" : "Mover tarea arriba"}
          aria-label={effectiveLocale === "en" ? "Move task up" : "Mover tarea arriba"}
          disabled={!hasSelection || !onMoveTaskUp}
          style={hierarchyBtnStyle(!hasSelection || !onMoveTaskUp)}
          onClick={() => selectedTaskId !== undefined && onMoveTaskUp?.(selectedTaskId)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          data-testid="hierarchy-move-down"
          title={effectiveLocale === "en" ? "Move task down" : "Mover tarea abajo"}
          aria-label={effectiveLocale === "en" ? "Move task down" : "Mover tarea abajo"}
          disabled={!hasSelection || !onMoveTaskDown}
          style={hierarchyBtnStyle(!hasSelection || !onMoveTaskDown)}
          onClick={() => selectedTaskId !== undefined && onMoveTaskDown?.(selectedTaskId)}
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          data-testid="hierarchy-outdent"
          title={effectiveLocale === "en" ? "Outdent task" : "Bajar nivel de jerarquia"}
          aria-label={effectiveLocale === "en" ? "Outdent task" : "Bajar nivel de jerarquia"}
          disabled={!hasSelection || !onOutdentTask}
          style={hierarchyBtnStyle(!hasSelection || !onOutdentTask)}
          onClick={() => selectedTaskId !== undefined && onOutdentTask?.(selectedTaskId)}
        >
          <IndentDecrease size={14} />
        </button>
        <button
          type="button"
          data-testid="hierarchy-indent"
          title={effectiveLocale === "en" ? "Indent task" : "Subir nivel de jerarquia"}
          aria-label={effectiveLocale === "en" ? "Indent task" : "Subir nivel de jerarquia"}
          disabled={!hasSelection || !onIndentTask}
          style={hierarchyBtnStyle(!hasSelection || !onIndentTask)}
          onClick={() => selectedTaskId !== undefined && onIndentTask?.(selectedTaskId)}
        >
          <IndentIncrease size={14} />
        </button>
        <span
          style={{
            width: 1,
            height: 18,
            background: "var(--gray-200)",
            margin: "0 4px",
          }}
        />
        <button
          type="button"
          data-testid="hierarchy-add-chapter"
          title={effectiveLocale === "en" ? "Add chapter" : "Crear capitulo"}
          aria-label={effectiveLocale === "en" ? "Add chapter" : "Crear capitulo"}
          disabled={!onInsertTask}
          style={hierarchyBtnStyle(!onInsertTask)}
          onClick={() => handleInsertTask("summary")}
        >
          <FolderPlus size={14} />
        </button>
        <button
          type="button"
          data-testid="hierarchy-add-subchapter"
          title={effectiveLocale === "en" ? "Add subchapter" : "Crear subcapitulo"}
          aria-label={effectiveLocale === "en" ? "Add subchapter" : "Crear subcapitulo"}
          disabled={!hasSelection || !onInsertTask}
          style={hierarchyBtnStyle(!hasSelection || !onInsertTask)}
          onClick={() => selectedTaskId !== undefined && handleInsertTask("summary", selectedTaskId)}
        >
          <CornerDownRight size={14} />
        </button>
        <button
          type="button"
          data-testid="hierarchy-add-task"
          title={effectiveLocale === "en" ? "Add task" : "Crear tarea"}
          aria-label={effectiveLocale === "en" ? "Add task" : "Crear tarea"}
          disabled={!onInsertTask}
          style={hierarchyBtnStyle(!onInsertTask)}
          onClick={() => handleInsertTask("task")}
        >
          <ListPlus size={14} />
        </button>
        <button
          type="button"
          data-testid="hierarchy-apply-template"
          title={effectiveLocale === "en" ? "Apply construction template" : "Aplicar plantilla constructiva"}
          aria-label={effectiveLocale === "en" ? "Apply construction template" : "Aplicar plantilla constructiva"}
          disabled={!onApplyStructureTemplate}
          style={hierarchyBtnStyle(!onApplyStructureTemplate)}
          onClick={() =>
            onApplyStructureTemplate?.("obra-gris-basica", {
              afterTaskId: selectedTaskId,
            })
          }
        >
          <Blocks size={14} />
        </button>
        <button
          type="button"
          data-testid="smart-paste-open"
          title={effectiveLocale === "en" ? "Smart paste from Excel" : "Pegar desde Excel"}
          aria-label={effectiveLocale === "en" ? "Smart paste from Excel" : "Pegar desde Excel"}
          disabled={!onSmartPasteTasks}
          style={hierarchyBtnStyle(!onSmartPasteTasks)}
          onClick={() => setSmartPasteOpen((open) => !open)}
        >
          <ClipboardPaste size={14} />
        </button>
        <button
          type="button"
          data-testid="bulk-progress-open"
          title={effectiveLocale === "en" ? "Bulk update % complete" : "Actualizar % completado en lote"}
          aria-label={effectiveLocale === "en" ? "Bulk update % complete" : "Actualizar % completado en lote"}
          disabled={!canBulkEditProgress}
          style={hierarchyBtnStyle(!canBulkEditProgress)}
          onClick={() => setBulkProgressOpen((open) => !open)}
        >
          <Percent size={14} />
        </button>
        <button
          type="button"
          data-testid="excel-copy-export"
          title={effectiveLocale === "en" ? "Copy visible schedule for Excel" : "Copiar cronograma visible para Excel"}
          aria-label={effectiveLocale === "en" ? "Copy visible schedule for Excel" : "Copiar cronograma visible para Excel"}
          disabled={visibleTasks.length === 0}
          style={hierarchyBtnStyle(visibleTasks.length === 0)}
          onClick={() => void handleCopyExport()}
        >
          <ClipboardCopy size={14} />
        </button>
        <button
          type="button"
          data-testid="excel-download-export"
          title={effectiveLocale === "en" ? "Download visible schedule as TSV" : "Descargar cronograma visible como TSV"}
          aria-label={effectiveLocale === "en" ? "Download visible schedule as TSV" : "Descargar cronograma visible como TSV"}
          disabled={visibleTasks.length === 0}
          style={hierarchyBtnStyle(visibleTasks.length === 0)}
          onClick={handleDownloadExport}
        >
          <Download size={14} />
        </button>
        {exportStatus !== "idle" && (
          <span
            data-testid="excel-export-status"
            style={{
              fontSize: "0.6875rem",
              color: exportStatus === "error" ? "var(--aia-alert-main)" : "var(--color-text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {exportStatus === "copied"
              ? effectiveLocale === "en" ? "Copied" : "Copiado"
              : exportStatus === "downloaded"
                ? effectiveLocale === "en" ? "Downloaded" : "Descargado"
                : effectiveLocale === "en" ? "Clipboard unavailable" : "Portapapeles no disponible"}
          </span>
        )}
        <span
          style={{
            width: 1,
            height: 18,
            background: "var(--gray-200)",
            margin: "0 4px",
          }}
        />
        <button
          type="button"
          data-testid="dependency-panel-open"
          title={effectiveLocale === "en" ? "Open dependency panel" : "Abrir panel de dependencias"}
          aria-label={effectiveLocale === "en" ? "Open dependency panel" : "Abrir panel de dependencias"}
          disabled={!selectedTask || !onUpdateTask}
          style={hierarchyBtnStyle(!selectedTask || !onUpdateTask)}
          onClick={() => selectedTask && setDependencyPanelTaskId(selectedTask.id)}
        >
          <Network size={14} />
        </button>
      </div>

      {smartPasteOpen && (
        <div
          data-testid="smart-paste-panel"
          className="apple-section m-2 p-3"
          style={{ minWidth: tableMinWidth - 16 }}
        >
          <label className="block text-xs font-semibold text-[var(--color-text-strong)]">
            {effectiveLocale === "en"
              ? "Paste tabular tasks from Excel"
              : "Pega tareas tabuladas desde Excel"}
            <textarea
              data-testid="smart-paste-textarea"
              value={smartPasteText}
              onChange={(event) => setSmartPasteText(event.target.value)}
              placeholder={
                effectiveLocale === "en"
                  ? "Activity\tStart\tDuration\t% Complete\tLevel"
                  : "Actividad\tInicio\tDuración\t% completado\tNivel"
              }
              className="mt-2 h-20 w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] p-2 text-xs font-normal text-[var(--color-text-strong)] outline-none"
            />
          </label>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="smart-paste-cancel"
              className="apple-button-secondary rounded-lg px-3 py-1.5 text-xs font-semibold"
              onClick={() => {
                setSmartPasteText("");
                setSmartPasteOpen(false);
              }}
            >
              {effectiveLocale === "en" ? "Cancel" : "Cancelar"}
            </button>
            <button
              type="button"
              data-testid="smart-paste-apply"
              className="apple-button-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
              onClick={handleApplySmartPaste}
            >
              {effectiveLocale === "en" ? "Paste tasks" : "Pegar tareas"}
            </button>
          </div>
        </div>
      )}

      {bulkProgressOpen && (
        <div
          data-testid="bulk-progress-panel"
          className="apple-section m-2 p-3"
          style={{ minWidth: tableMinWidth - 16 }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-strong)]">
                {effectiveLocale === "en"
                  ? `Apply % complete to ${selectedTasks.length} selected tasks`
                  : `Aplicar % completado a ${selectedTasks.length} tareas seleccionadas`}
              </p>
              <p className="mt-1 text-[0.6875rem] text-[var(--color-text-secondary)]">
                {selectedTasks.slice(0, 4).map((task) => task.name).join(" · ")}
                {selectedTasks.length > 4 ? " · ..." : ""}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-strong)]">
              %
              <input
                data-testid="bulk-progress-input"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={bulkProgressValue}
                onChange={(event) => setBulkProgressValue(event.target.value)}
                className="w-24 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-right text-xs font-normal text-[var(--color-text-strong)] outline-none"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid="bulk-progress-cancel"
              className="apple-button-secondary rounded-lg px-3 py-1.5 text-xs font-semibold"
              onClick={() => setBulkProgressOpen(false)}
            >
              {effectiveLocale === "en" ? "Cancel" : "Cancelar"}
            </button>
            <button
              type="button"
              data-testid="bulk-progress-apply"
              className="apple-button-primary rounded-lg px-3 py-1.5 text-xs font-semibold"
              onClick={handleApplyBulkProgress}
            >
              {effectiveLocale === "en" ? "Apply" : "Aplicar"}
            </button>
          </div>
        </div>
      )}

      {dependencyPanelTask && onUpdateTask && (
        <DependencyPanel
          key={dependencyPanelTask.id}
          task={dependencyPanelTask}
          tasks={tasks}
          locale={effectiveLocale}
          onClose={() => setDependencyPanelTaskId(undefined)}
          onCommitPredecessors={(dependencies) =>
            onUpdateTask(dependencyPanelTask.id, "dependencies", dependencies)
          }
          onCommitSuccessors={(dependencies) =>
            onUpdateTask(dependencyPanelTask.id, "successors", dependencies)
          }
        />
      )}

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
                allTasks={tasks}
                draggable={!!onReorderTask}
                isDragging={draggedTaskId === task.id}
                dropPosition={dropTarget?.taskId === task.id ? dropTarget.position : undefined}
                onDragStart={(event) => handleRowDragStart(task.id, event)}
                onDragOver={(event) => handleRowDragOver(task.id, event)}
                onDrop={(event) => handleRowDrop(task.id, event)}
                onDragEnd={handleRowDragEnd}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
