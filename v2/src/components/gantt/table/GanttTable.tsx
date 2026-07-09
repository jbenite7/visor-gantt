"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
const HORIZONTAL_HIERARCHY_DRAG_THRESHOLD = 36;
const COMPACT_GANTT_COLUMNS = new Set([
  "id",
  "uniqueId",
  "wbs",
  "name",
  "duration",
  "progress",
]);
const BALANCED_GANTT_COLUMNS = new Set([
  "id",
  "uniqueId",
  "wbs",
  "name",
  "duration",
  "predecessors",
  "progress",
  "critical",
]);
const COMPACT_COLUMN_LABELS: Record<string, { en: string; es: string }> = {
  id: { en: "ID", es: "ID" },
  uniqueId: { en: "UID", es: "UID" },
  wbs: { en: "WBS", es: "EDT" },
  name: { en: "Activity", es: "Actividad" },
  duration: { en: "Dur.", es: "Dur." },
  predecessors: { en: "Pred.", es: "Pred." },
  progress: { en: "%", es: "%" },
  critical: { en: "Crit.", es: "Crit." },
};
const GANTT_TABLE_RIBBON_HOST_ID = "gantt-table-ribbon-host";

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
  const tableRootRef = useRef<HTMLDivElement | null>(null);
  const [tablePanelWidth, setTablePanelWidth] = useState(0);
  const [ribbonHost, setRibbonHost] = useState<HTMLElement | null>(null);

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

  const responsiveVisibleColumns = useMemo(() => {
    const preferredKeys =
      tablePanelWidth > 0 && tablePanelWidth < 360
        ? COMPACT_GANTT_COLUMNS
        : tablePanelWidth > 0 && tablePanelWidth < 560
          ? BALANCED_GANTT_COLUMNS
          : undefined;

    if (!preferredKeys) return visibleColumns;

    const compactVisible = visibleColumns.filter((key) => preferredKeys.has(key));
    return compactVisible.length > 0 ? compactVisible : visibleColumns;
  }, [tablePanelWidth, visibleColumns]);

  const displayColumns = useMemo(
    () => allColumns.filter((col) => responsiveVisibleColumns.includes(col.key)),
    [allColumns, responsiveVisibleColumns]
  );
  const displayColumnTotalWidth = useMemo(
    () =>
      displayColumns.reduce(
        (total, column) => total + (columnWidths[column.key] ?? column.width),
        0,
      ),
    [columnWidths, displayColumns],
  );
  const useCompactColumnLabels = tablePanelWidth > 0 && tablePanelWidth < 560;

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
  const rowDragStartXRef = useRef<number | undefined>(undefined);
  const rowMouseDragRef = useRef<{
    taskId: string | number;
    startX: number;
    startY: number;
  } | undefined>(undefined);

  useEffect(() => {
    const root = tableRootRef.current;
    if (!root) return;

    const updateWidth = () => {
      setTablePanelWidth(root.getBoundingClientRect().width);
    };

    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setRibbonHost(document.getElementById(GANTT_TABLE_RIBBON_HOST_ID));
  }, []);

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
  const handleExpandAll = useCallback(() => {
    setCollapsedTaskIds(new Set());
  }, []);
  const handleCollapseAll = useCallback(() => {
    setCollapsedTaskIds(new Set(tasks.filter((task) => task.isSummary).map((task) => task.id)));
  }, [tasks]);

  const filteredTasks = useMemo(
    () => filterTasks(tasks, taskFilter),
    [tasks, taskFilter],
  );
  const visibleTasks = useMemo(
    () => getVisibleTasks(filteredTasks, collapsedTaskIds),
    [filteredTasks, collapsedTaskIds],
  );
  const levelButtons = useMemo(() => {
    const maxLevel = Math.max(1, ...tasks.map((task) => task.outlineLevel || 1));
    return Array.from({ length: maxLevel }, (_, index) => ({
      label: `L${index + 1}`,
      level: index + 2,
    }));
  }, [tasks]);
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
      if (!onReorderTask && !onIndentTask && !onOutdentTask) return;
      setDraggedTaskId(taskId);
      rowDragStartXRef.current = event.clientX;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(taskId));
    },
    [onIndentTask, onOutdentTask, onReorderTask],
  );

  const applyHorizontalHierarchyDrag = useCallback(
    (taskId: string | number, deltaX: number): boolean => {
      if (deltaX >= HORIZONTAL_HIERARCHY_DRAG_THRESHOLD && onIndentTask) {
        onIndentTask(taskId);
        return true;
      }
      if (deltaX <= -HORIZONTAL_HIERARCHY_DRAG_THRESHOLD && onOutdentTask) {
        onOutdentTask(taskId);
        return true;
      }
      return false;
    },
    [onIndentTask, onOutdentTask],
  );

  const handleRowMouseDown = useCallback(
    (taskId: string | number, event: React.MouseEvent<HTMLTableRowElement>) => {
      if (!onIndentTask && !onOutdentTask) return;
      if (event.button !== 0) return;
      rowMouseDragRef.current = {
        taskId,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [onIndentTask, onOutdentTask],
  );

  useEffect(() => {
    const handleWindowMouseUp = (event: MouseEvent) => {
      const current = rowMouseDragRef.current;
      if (!current) return;
      rowMouseDragRef.current = undefined;

      const deltaX = event.clientX - current.startX;
      const deltaY = event.clientY - current.startY;
      if (Math.abs(deltaX) < HORIZONTAL_HIERARCHY_DRAG_THRESHOLD) return;
      if (Math.abs(deltaX) < Math.abs(deltaY)) return;
      applyHorizontalHierarchyDrag(current.taskId, deltaX);
    };

    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [applyHorizontalHierarchyDrag]);

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
      if (draggedTaskId === undefined) return;
      const dragDeltaX = rowDragStartXRef.current === undefined
        ? 0
        : event.clientX - rowDragStartXRef.current;
      if (applyHorizontalHierarchyDrag(draggedTaskId, dragDeltaX)) {
        event.preventDefault();
        setDraggedTaskId(undefined);
        setDropTarget(undefined);
        rowDragStartXRef.current = undefined;
        rowMouseDragRef.current = undefined;
        return;
      }
      if (!onReorderTask || draggedTaskId === taskId) return;
      event.preventDefault();
      const position = dropTarget?.taskId === taskId
        ? dropTarget.position
        : getDropPosition(event);
      onReorderTask(draggedTaskId, taskId, position);
      setDraggedTaskId(undefined);
      setDropTarget(undefined);
      rowDragStartXRef.current = undefined;
      rowMouseDragRef.current = undefined;
    },
    [applyHorizontalHierarchyDrag, draggedTaskId, dropTarget, getDropPosition, onReorderTask],
  );

  const handleRowDragEnd = useCallback(() => {
    setDraggedTaskId(undefined);
    setDropTarget(undefined);
    rowDragStartXRef.current = undefined;
    rowMouseDragRef.current = undefined;
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

  const toolsRibbon = (
    <div
      className="gantt-table-ribbon"
      data-testid="gantt-table-tools-ribbon"
      role="toolbar"
      aria-label={effectiveLocale === "en" ? "Table tools" : "Herramientas de tabla"}
    >
      <div className="gantt-table-ribbon__group gantt-table-ribbon__group--expand">
        <span className="gantt-table-ribbon__label">{t(effectiveLocale, "expand")}</span>
        {levelButtons.length <= 2 ? (
          levelButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              data-testid="expand-level-button"
              className="gantt-table-tools__text-button gantt-table-ribbon__text-button"
              onClick={() => handleExpandToLevel(btn.level)}
            >
              {btn.label}
            </button>
          ))
        ) : (
          <select
            data-testid="expand-level-select"
            className="gantt-table-ribbon__select"
            value=""
            aria-label={effectiveLocale === "en" ? "Expand to level" : "Expandir a nivel"}
            onChange={(event) => {
              const level = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(level)) {
                handleExpandToLevel(level);
              }
            }}
          >
            <option value="" disabled>
              {effectiveLocale === "en" ? "Level" : "Nivel"}
            </option>
            {levelButtons.map((btn) => (
              <option key={btn.label} value={btn.level}>
                {btn.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          data-testid="expand-all-button"
          className="gantt-table-tools__text-button gantt-table-ribbon__text-button"
          onClick={handleExpandAll}
        >
          {effectiveLocale === "en" ? "All" : "Todo"}
        </button>
        <button
          type="button"
          data-testid="collapse-all-button"
          className="gantt-table-tools__text-button gantt-table-ribbon__text-button"
          onClick={handleCollapseAll}
        >
          {effectiveLocale === "en" ? "Collapse" : "Colapsar"}
        </button>
      </div>
      <span className="gantt-table-ribbon__divider" aria-hidden />
      <div className="gantt-table-ribbon__group">
        <span className="gantt-table-ribbon__label">
          {effectiveLocale === "en" ? "Hierarchy" : "Jerarquía"}
        </span>
        <button
          type="button"
          data-testid="hierarchy-move-up"
          title={effectiveLocale === "en" ? "Move task up" : "Mover tarea arriba"}
          aria-label={effectiveLocale === "en" ? "Move task up" : "Mover tarea arriba"}
          disabled={!hasSelection || !onMoveTaskUp}
          className="gantt-table-toolbar__icon-button"
          onClick={() => selectedTaskId !== undefined && onMoveTaskUp?.(selectedTaskId)}
        >
          <ArrowUp className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="hierarchy-move-down"
          title={effectiveLocale === "en" ? "Move task down" : "Mover tarea abajo"}
          aria-label={effectiveLocale === "en" ? "Move task down" : "Mover tarea abajo"}
          disabled={!hasSelection || !onMoveTaskDown}
          className="gantt-table-toolbar__icon-button"
          onClick={() => selectedTaskId !== undefined && onMoveTaskDown?.(selectedTaskId)}
        >
          <ArrowDown className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="hierarchy-outdent"
          title={effectiveLocale === "en" ? "Outdent task" : "Bajar nivel de jerarquia"}
          aria-label={effectiveLocale === "en" ? "Outdent task" : "Bajar nivel de jerarquia"}
          disabled={!hasSelection || !onOutdentTask}
          className="gantt-table-toolbar__icon-button"
          onClick={() => selectedTaskId !== undefined && onOutdentTask?.(selectedTaskId)}
        >
          <IndentDecrease className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="hierarchy-indent"
          title={effectiveLocale === "en" ? "Indent task" : "Subir nivel de jerarquia"}
          aria-label={effectiveLocale === "en" ? "Indent task" : "Subir nivel de jerarquia"}
          disabled={!hasSelection || !onIndentTask}
          className="gantt-table-toolbar__icon-button"
          onClick={() => selectedTaskId !== undefined && onIndentTask?.(selectedTaskId)}
        >
          <IndentIncrease className="gantt-table-toolbar__icon" aria-hidden />
        </button>
      </div>
      <span className="gantt-table-ribbon__divider" aria-hidden />
      <div className="gantt-table-ribbon__group">
        <span className="gantt-table-ribbon__label">
          {effectiveLocale === "en" ? "Create" : "Crear"}
        </span>
        <button
          type="button"
          data-testid="hierarchy-add-chapter"
          title={effectiveLocale === "en" ? "Add chapter" : "Crear capitulo"}
          aria-label={effectiveLocale === "en" ? "Add chapter" : "Crear capitulo"}
          disabled={!onInsertTask}
          className="gantt-table-toolbar__icon-button"
          onClick={() => handleInsertTask("summary")}
        >
          <FolderPlus className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="hierarchy-add-subchapter"
          title={effectiveLocale === "en" ? "Add subchapter" : "Crear subcapitulo"}
          aria-label={effectiveLocale === "en" ? "Add subchapter" : "Crear subcapitulo"}
          disabled={!hasSelection || !onInsertTask}
          className="gantt-table-toolbar__icon-button"
          onClick={() => selectedTaskId !== undefined && handleInsertTask("summary", selectedTaskId)}
        >
          <CornerDownRight className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="hierarchy-add-task"
          title={effectiveLocale === "en" ? "Add task" : "Crear tarea"}
          aria-label={effectiveLocale === "en" ? "Add task" : "Crear tarea"}
          disabled={!onInsertTask}
          className="gantt-table-toolbar__icon-button"
          onClick={() => handleInsertTask("task")}
        >
          <ListPlus className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="hierarchy-apply-template"
          title={effectiveLocale === "en" ? "Apply construction template" : "Aplicar plantilla constructiva"}
          aria-label={effectiveLocale === "en" ? "Apply construction template" : "Aplicar plantilla constructiva"}
          disabled={!onApplyStructureTemplate}
          className="gantt-table-toolbar__icon-button"
          onClick={() =>
            onApplyStructureTemplate?.("obra-gris-basica", {
              afterTaskId: selectedTaskId,
            })
          }
        >
          <Blocks className="gantt-table-toolbar__icon" aria-hidden />
        </button>
      </div>
      <span className="gantt-table-ribbon__divider" aria-hidden />
      <div className="gantt-table-ribbon__group gantt-table-ribbon__group--data">
        <span className="gantt-table-ribbon__label">
          {effectiveLocale === "en" ? "Data" : "Datos"}
        </span>
        <button
          type="button"
          data-testid="smart-paste-open"
          title={effectiveLocale === "en" ? "Smart paste from Excel" : "Pegar desde Excel"}
          aria-label={effectiveLocale === "en" ? "Smart paste from Excel" : "Pegar desde Excel"}
          disabled={!onSmartPasteTasks}
          className="gantt-table-toolbar__icon-button"
          onClick={() => setSmartPasteOpen((open) => !open)}
        >
          <ClipboardPaste className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="bulk-progress-open"
          title={effectiveLocale === "en" ? "Bulk update % complete" : "Actualizar % completado en lote"}
          aria-label={effectiveLocale === "en" ? "Bulk update % complete" : "Actualizar % completado en lote"}
          disabled={!canBulkEditProgress}
          className="gantt-table-toolbar__icon-button"
          onClick={() => setBulkProgressOpen((open) => !open)}
        >
          <Percent className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="excel-copy-export"
          title={effectiveLocale === "en" ? "Copy visible schedule for Excel" : "Copiar cronograma visible para Excel"}
          aria-label={effectiveLocale === "en" ? "Copy visible schedule for Excel" : "Copiar cronograma visible para Excel"}
          disabled={visibleTasks.length === 0}
          className="gantt-table-toolbar__icon-button"
          onClick={() => void handleCopyExport()}
        >
          <ClipboardCopy className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="excel-download-export"
          title={effectiveLocale === "en" ? "Download visible schedule as TSV" : "Descargar cronograma visible como TSV"}
          aria-label={effectiveLocale === "en" ? "Download visible schedule as TSV" : "Descargar cronograma visible como TSV"}
          disabled={visibleTasks.length === 0}
          className="gantt-table-toolbar__icon-button"
          onClick={handleDownloadExport}
        >
          <Download className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        <button
          type="button"
          data-testid="dependency-panel-open"
          title={effectiveLocale === "en" ? "Open dependency panel" : "Abrir panel de dependencias"}
          aria-label={effectiveLocale === "en" ? "Open dependency panel" : "Abrir panel de dependencias"}
          disabled={!selectedTask || !onUpdateTask}
          className="gantt-table-toolbar__icon-button"
          onClick={() => selectedTask && setDependencyPanelTaskId(selectedTask.id)}
        >
          <Network className="gantt-table-toolbar__icon" aria-hidden />
        </button>
        {exportStatus !== "idle" && (
          <span
            data-testid="excel-export-status"
            className="gantt-table-ribbon__status"
            data-status={exportStatus}
          >
            {exportStatus === "copied"
              ? effectiveLocale === "en" ? "Copied" : "Copiado"
              : exportStatus === "downloaded"
                ? effectiveLocale === "en" ? "Downloaded" : "Descargado"
                : effectiveLocale === "en" ? "Clipboard unavailable" : "Portapapeles no disponible"}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      data-testid="gantt-table"
      ref={tableRootRef}
      className="gantt-table-shell"
    >
      {ribbonHost ? (
        createPortal(toolsRibbon, ribbonHost)
      ) : (
        <div className="gantt-table-ribbon-local">{toolsRibbon}</div>
      )}
      <div
        data-testid="expand-level-toolbar"
        className="gantt-table-toolbar"
      >
        {onTaskFilterChange && showTaskFilterControls && (
          <>
            <div
              data-testid="gantt-task-filter"
              className="gantt-table-toolbar__filter"
            >
              <Search className="gantt-table-toolbar__filter-icon" aria-hidden />
              <input
                data-testid="gantt-task-filter-input"
                type="search"
                value={normalizedTaskFilter.text}
                placeholder={t(effectiveLocale, "filterByName")}
                onChange={(event) => updateTaskFilter({ text: event.target.value })}
                className="gantt-table-toolbar__filter-input"
              />
              <select
                data-testid="gantt-task-filter-type"
                value={normalizedTaskFilter.type}
                onChange={(event) =>
                  updateTaskFilter({ type: event.target.value as TaskFilterType })
                }
                className="gantt-table-toolbar__filter-type"
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
              className="gantt-table-toolbar__count"
            >
              {visibleTasks.length} / {tasks.length}
            </span>
            {hasActiveTaskFilter && (
              <button
                type="button"
                data-testid="gantt-task-filter-clear"
                className="gantt-table-toolbar__text-button"
                onClick={clearTaskFilter}
              >
                {effectiveLocale === "en" ? "Clear" : "Limpiar"}
              </button>
            )}
          </>
        )}
        <div className="gantt-table-toolbar__column-selector">
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

      {smartPasteOpen && (
        <div
          data-testid="smart-paste-panel"
          className="apple-section m-2 p-3"
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
        className="gantt-task-table"
      >
        <colgroup>
          {displayColumns.map((column) => (
            <col
              key={column.key}
              width={`${((columnWidths[column.key] ?? column.width) / displayColumnTotalWidth) * 100}%`}
            />
          ))}
        </colgroup>
        {/* ── Sticky Header ── */}
        <thead className="gantt-task-table__head">
          <tr>
            {displayColumns.map((col) => {
              const label =
                useCompactColumnLabels && COMPACT_COLUMN_LABELS[col.key]
                  ? COMPACT_COLUMN_LABELS[col.key][effectiveLocale]
                  : effectiveLocale === "en"
                    ? col.labelEn ?? col.label
                    : col.labelEs ?? col.label;
              return (
                <ColumnHeader
                  key={col.key}
                  label={label}
                  locale={effectiveLocale}
                  width={columnWidths[col.key] ?? col.width}
                  align={col.align}
                  calculationSpec={col.calculationSpec}
                  onResize={(newWidth) => handleResize(col.key, newWidth)}
                />
              );
            })}
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
                draggable={!!onReorderTask || !!onIndentTask || !!onOutdentTask}
                isDragging={draggedTaskId === task.id}
                dropPosition={dropTarget?.taskId === task.id ? dropTarget.position : undefined}
                onDragStart={(event) => handleRowDragStart(task.id, event)}
                onDragOver={(event) => handleRowDragOver(task.id, event)}
                onDrop={(event) => handleRowDrop(task.id, event)}
                onDragEnd={handleRowDragEnd}
                onMouseDown={(event) => handleRowMouseDown(task.id, event)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
