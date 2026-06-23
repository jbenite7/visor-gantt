"use client";

import { useState, useCallback, useMemo } from "react";
import type { GanttTask } from "@/components/gantt/types";
import GanttTable from "@/components/gantt/table/GanttTable";

interface TaskSheetViewProps {
  tasks: GanttTask[];
  onUpdateTask?: (
    taskId: string | number,
    field: string,
    value: unknown,
  ) => void;
  selectedTaskIds?: (string | number)[];
  onTaskSelect?: (taskId: string | number, ctrlKey: boolean) => void;
}

type SortDirection = "asc" | "desc";

interface SortConfig {
  field: string;
  direction: SortDirection;
}

type FilterType = "all" | "critical" | "non-critical" | "milestones" | "summaries";

interface SortButtonConfig {
  field: string;
  label: string;
}

const SORT_BUTTONS: SortButtonConfig[] = [
  { field: "id", label: "ID" },
  { field: "wbs", label: "WBS" },
  { field: "name", label: "Name" },
  { field: "duration", label: "Duration" },
  { field: "start", label: "Start" },
  { field: "finish", label: "Finish" },
  { field: "progress", label: "% Complete" },
];

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "non-critical", label: "Non-critical" },
  { value: "milestones", label: "Milestones" },
  { value: "summaries", label: "Summaries" },
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

function filterTask(
  task: GanttTask,
  filterText: string,
  filterType: FilterType,
): boolean {
  // Text filter (case-insensitive name match)
  if (filterText) {
    const query = filterText.toLowerCase();
    if (!task.name.toLowerCase().includes(query)) {
      return false;
    }
  }

  // Type filter
  switch (filterType) {
    case "critical":
      return task.isCritical;
    case "non-critical":
      return !task.isCritical && !task.isMilestone && !task.isSummary;
    case "milestones":
      return task.isMilestone;
    case "summaries":
      return task.isSummary;
    default:
      return true;
  }
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
}: TaskSheetViewProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "id",
    direction: "asc",
  });
  const [filterText, setFilterText] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const handleSort = useCallback((field: string) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const processedTasks = useMemo(() => {
    // Filter first
    const filtered = tasks.filter((t) => filterTask(t, filterText, filterType));
    // Then sort
    return [...filtered].sort((a, b) =>
      compareValues(a, b, sortConfig.field, sortConfig.direction),
    );
  }, [tasks, filterText, filterType, sortConfig]);

  return (
    <div
      data-testid="task-sheet-view"
      className="flex flex-col h-full"
    >
      {/* ── Filter & Sort Bar ── */}
      <div
        style={{
          background: "var(--aia-corp-dark)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--aia-corp-mid)",
        }}
      >
        {/* Text filter */}
        <input
          type="text"
          placeholder="Filter by name..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            background: "var(--aia-alabaster)",
            color: "var(--aia-corp-dark)",
            border: "1px solid var(--aia-corp-mid)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            outline: "none",
            minWidth: "180px",
          }}
        />

        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          style={{
            background: "var(--aia-alabaster)",
            color: "var(--aia-corp-dark)",
            border: "1px solid var(--aia-corp-mid)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "20px",
            background: "var(--aia-corp-mid)",
            opacity: 0.5,
          }}
        />

        {/* Sort buttons */}
        <span
          style={{
            fontSize: "0.6875rem",
            color: "var(--aia-corp-light)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontWeight: 500,
          }}
        >
          Sort:
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
                border: `1px solid ${isActive ? "var(--aia-corp-light)" : "var(--aia-corp-mid)"}`,
                borderRadius: "var(--radius-sm)",
                background: isActive ? "var(--aia-corp-main)" : "transparent",
                color: isActive ? "#ffffff" : "var(--aia-corp-light)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                lineHeight: "1.4",
              }}
            >
              {btn.label}
              {arrow}
            </button>
          );
        })}

        {/* Task count */}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.75rem",
            color: "var(--aia-corp-light)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          {processedTasks.length} / {tasks.length} tasks
        </span>
      </div>

      {/* ── Table (full width) ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <GanttTable
          tasks={processedTasks}
          selectedTaskIds={selectedTaskIds}
          onTaskSelect={onTaskSelect}
          onUpdateTask={onUpdateTask}
        />
      </div>
    </div>
  );
}
