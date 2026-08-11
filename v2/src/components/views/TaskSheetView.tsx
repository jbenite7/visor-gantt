"use client";

import { useState, useCallback, useMemo } from "react";
import type { GanttTask } from "@/components/gantt/types";
import GanttTable from "@/components/gantt/table/GanttTable";
import { ArrowUpDown, Search } from "lucide-react";
import type { MppCustomFieldDefinition, MppTaskColumn, TaskColumnSettings } from "@/types/mppColumns";
import type { TaskFilterSettings, TaskFilterType, UILocale } from "@/types/ui";
import { t } from "@/lib/i18n";
import { filterTasks, normalizeTaskFilter } from "@/lib/gantt/taskFilters";

interface TaskSheetViewProps {
  tasks: GanttTask[];
  onUpdateTask?: (
    taskId: string | number,
    field: string,
    value: unknown,
  ) => void;
  selectedTaskIds?: (string | number)[];
  onTaskSelect?: (taskId: string | number, ctrlKey: boolean) => void;
  mppTaskColumns?: MppTaskColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
  columnSettings?: TaskColumnSettings;
  locale?: UILocale;
  onColumnSettingsChange?: (settings: TaskColumnSettings) => void;
  onLocaleChange?: (locale: UILocale) => void;
  taskFilter?: TaskFilterSettings;
  onTaskFilterChange?: (filter: TaskFilterSettings) => void;
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

type SortDirection = "asc" | "desc";

interface SortConfig {
  field: string;
  direction: SortDirection;
}

interface SortButtonConfig {
  field: string;
  labelEn: string;
  labelEs: string;
}

const SORT_BUTTONS: SortButtonConfig[] = [
  { field: "id", labelEn: "ID", labelEs: "ID" },
  { field: "wbs", labelEn: "WBS", labelEs: "EDT" },
  { field: "name", labelEn: "Name", labelEs: "Nombre" },
  { field: "duration", labelEn: "Duration", labelEs: "Duración" },
  { field: "start", labelEn: "Start", labelEs: "Comienzo" },
  { field: "finish", labelEn: "Finish", labelEs: "Fin" },
  { field: "progress", labelEn: "% Complete", labelEs: "% completado" },
];

const FILTER_OPTIONS: { value: TaskFilterType; labelKey: "allTasks" | "critical" | "nonCritical" | "milestones" | "summaries" }[] = [
  { value: "all", labelKey: "allTasks" },
  { value: "critical", labelKey: "critical" },
  { value: "non-critical", labelKey: "nonCritical" },
  { value: "milestones", labelKey: "milestones" },
  { value: "summaries", labelKey: "summaries" },
];

function compareValues(
  a: GanttTask,
  b: GanttTask,
  field: string,
  direction: SortDirection,
): number {
  let cmp = 0;

  switch (field) {
    case "id": {
      const aNum = typeof a.id === "number" ? a.id : parseInt(String(a.id), 10);
      const bNum = typeof b.id === "number" ? b.id : parseInt(String(b.id), 10);
      cmp = aNum - bNum;
      break;
    }
    case "wbs":
      cmp = (a.wbs ?? "").localeCompare(b.wbs ?? "", undefined, { numeric: true });
      break;
    case "name":
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      break;
    case "duration":
      cmp = a.duration - b.duration;
      break;
    case "start":
      cmp = a.start.getTime() - b.start.getTime();
      break;
    case "finish":
      cmp = a.finish.getTime() - b.finish.getTime();
      break;
    case "progress": {
      const aProg = a.percentComplete ?? a.progress;
      const bProg = b.percentComplete ?? b.progress;
      cmp = aProg - bProg;
      break;
    }
    default:
      cmp = 0;
  }

  return direction === "asc" ? cmp : -cmp;
}

/**
 * TaskSheetView — Full-width sortable/filterable task table.
 *
 * Wraps GanttTable in a full-width layout (no SplitPane / chart)
 * and adds sorting and filtering controls above the table.
 */
export default function TaskSheetView({
  tasks,
  onUpdateTask,
  selectedTaskIds,
  onTaskSelect,
  mppTaskColumns,
  customFieldDefinitions,
  columnSettings,
  locale = "es",
  onColumnSettingsChange,
  onLocaleChange,
  taskFilter,
  onTaskFilterChange,
  onIndentTask,
  onOutdentTask,
  onMoveTaskUp,
  onMoveTaskDown,
  onReorderTask,
  onInsertTask,
  onApplyStructureTemplate,
  onSmartPasteTasks,
}: TaskSheetViewProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "id",
    direction: "asc",
  });
  const [localTaskFilter, setLocalTaskFilter] = useState<TaskFilterSettings>({
    text: "",
    type: "all",
  });
  const normalizedTaskFilter = useMemo(
    () => normalizeTaskFilter(onTaskFilterChange ? taskFilter : localTaskFilter),
    [localTaskFilter, onTaskFilterChange, taskFilter],
  );

  const handleSort = useCallback((field: string) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);
  const updateTaskFilter = useCallback(
    (patch: Partial<TaskFilterSettings>) => {
      const next = { ...normalizedTaskFilter, ...patch };
      if (onTaskFilterChange) {
        onTaskFilterChange(next);
      } else {
        setLocalTaskFilter(next);
      }
    },
    [normalizedTaskFilter, onTaskFilterChange],
  );

  const processedTasks = useMemo(() => {
    // Filter first
    const filtered = filterTasks(tasks, normalizedTaskFilter);
    // Then sort
    return [...filtered].sort((a, b) =>
      compareValues(a, b, sortConfig.field, sortConfig.direction),
    );
  }, [tasks, normalizedTaskFilter, sortConfig]);

  return (
    <div
      data-testid="task-sheet-view"
      className="apple-module flex h-full flex-col"
    >
      {/* ── Filter & Sort Bar ── */}
      <div
        className="apple-subtoolbar flex-wrap"
      >
        {/* Text filter */}
        <label
          className="flex min-w-[220px] items-center gap-2 rounded-lg border px-3 py-1.5"
          style={{
            background: "var(--color-bg-elevated)",
            borderColor: "var(--color-hairline)",
          }}
        >
          <Search size={15} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder={t(locale, "filterByName")}
            value={normalizedTaskFilter.text}
            onChange={(e) => updateTaskFilter({ text: e.target.value })}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm"
            style={{
              color: "var(--color-text-strong)",
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              boxShadow: "none",
            }}
          />
        </label>

        {/* Type filter */}
        <select
          value={normalizedTaskFilter.type}
          onChange={(e) => updateTaskFilter({ type: e.target.value as TaskFilterType })}
          style={{
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-strong)",
            border: "1px solid var(--color-hairline)",
            borderRadius: "var(--radius-lg)",
            padding: "6px 10px",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(locale, opt.labelKey)}
            </option>
          ))}
        </select>

        {/* Sort buttons */}
        <span
          className="inline-flex items-center gap-1"
          style={{
            fontSize: "0.6875rem",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 500,
          }}
        >
          <ArrowUpDown size={13} />
          {t(locale, "sort")}:
        </span>
        {SORT_BUTTONS.map((btn) => {
          const isActive = sortConfig.field === btn.field;
          const arrow = isActive
            ? sortConfig.direction === "asc"
              ? " \u25B2"
              : " \u25BC"
            : "";
          return (
            <button
              key={btn.field}
              onClick={() => handleSort(btn.field)}
              style={{
                padding: "2px 8px",
                fontSize: "0.6875rem",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                fontWeight: isActive ? 600 : 400,
                border: `1px solid ${isActive ? "var(--aia-corp-main)" : "var(--color-hairline)"}`,
                borderRadius: "var(--radius-lg)",
                background: isActive ? "var(--aia-corp-main)" : "var(--color-bg-elevated)",
                color: isActive ? "var(--color-text-on-primary)" : "var(--color-text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                lineHeight: "1.4",
                boxShadow: isActive ? "0 8px 18px rgb(39 118 89 / 0.16)" : "var(--shadow-sm)",
              }}
            >
              {locale === "en" ? btn.labelEn : btn.labelEs}
              {arrow}
            </button>
          );
        })}

        {/* Task count */}
        <span
          className="apple-subtoolbar-count"
          style={{
            marginLeft: "auto",
          }}
        >
          {processedTasks.length} / {tasks.length} {t(locale, "tasks")}
        </span>
      </div>

      {/* ── Table (full width) ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <GanttTable
          tasks={processedTasks}
          selectedTaskIds={selectedTaskIds}
          onTaskSelect={onTaskSelect}
          onUpdateTask={onUpdateTask}
          mppTaskColumns={mppTaskColumns}
          customFieldDefinitions={customFieldDefinitions}
          columnSettings={columnSettings}
          locale={locale}
          onColumnSettingsChange={onColumnSettingsChange}
          onLocaleChange={onLocaleChange}
          taskFilter={normalizedTaskFilter}
          onTaskFilterChange={updateTaskFilter}
          showTaskFilterControls={false}
          onIndentTask={onIndentTask}
          onOutdentTask={onOutdentTask}
          onMoveTaskUp={onMoveTaskUp}
          onMoveTaskDown={onMoveTaskDown}
          onReorderTask={onReorderTask}
          onInsertTask={onInsertTask}
          onApplyStructureTemplate={onApplyStructureTemplate}
          onSmartPasteTasks={onSmartPasteTasks}
        />
      </div>
    </div>
  );
}
