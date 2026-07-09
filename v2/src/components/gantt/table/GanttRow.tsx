"use client";

import type { GanttTask, GanttDependency } from "@/components/gantt/types";
import WBSExpand from "./WBSExpand";
import EditableCell from "./EditableCell";
import DependencyPopover from "@/components/gantt/dependencies/DependencyPopover";
import { createProjectDate, formatProjectDate, toDateInputValue } from "@/lib/date/projectDate";
import type { ColumnConfig } from "./ColumnSelector";
import type { UILocale } from "@/types/ui";
import { t } from "@/lib/i18n";
import { getMppRecordValue } from "@/lib/mpp/recordValues";
import { dependencyTokenForTaskId, findTaskByRowId, taskRowId } from "@/lib/gantt/taskIds";

interface GanttRowProps {
  task: GanttTask;
  index: number;
  rowNumber: number;
  onSelect?: (taskId: string | number, ctrlKey: boolean) => void;
  isSelected: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onUpdateTask?: (
    taskId: string | number,
    field: string,
    value: unknown
  ) => void;
  columns: ColumnConfig[];
  locale: UILocale;
  budgetedCost?: number;
  actualCost?: number;
  variance?: number;
  allTasks?: GanttTask[];
  draggable?: boolean;
  isDragging?: boolean;
  dropPosition?: "before" | "after" | "child";
  onDragStart?: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLTableRowElement>) => void;
  onMouseDown?: (event: React.MouseEvent<HTMLTableRowElement>) => void;
}

/** Format a Date to DD/MM/YYYY for Colombian locale. */
function formatDate(date: Date): string {
  return formatProjectDate(date);
}

function formatCompactDate(date: Date): string {
  return formatProjectDate(date, {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
    .replace(/\./g, "")
    .replace(/\s+de\s+/g, " ");
}

/** Convert a Date to yyyy-mm-dd string for <input type="date">. */
function toISODate(date: Date): string {
  return toDateInputValue(date);
}

/** Convert yyyy-mm-dd string back to a Date (local time, no timezone shift). */
function fromISODate(iso: string): Date {
  return createProjectDate(iso);
}

/** Format dependencies array into compact string like "1FS,2SS+5d". */
function formatDependencies(dependencies: GanttDependency[], tasks: GanttTask[]): string {
  if (dependencies.length === 0) return "";
  return dependencies
    .map((dep) => dependencyTokenForTaskId(tasks, dep.from, dep.type, dep.lag))
    .join(", ");
}

function renderDependencyDisplay(value: string, locale: UILocale) {
  if (!value) {
    return (
      <span className="gantt-row-predecessor-empty">
        {locale === "en" ? "No pred." : "Sin pred."}
      </span>
    );
  }

  return (
    <span className="gantt-row-predecessor-list">
      {value.split(", ").map((token) => (
        <span className="gantt-row-predecessor-token" key={token}>
          {token}
        </span>
      ))}
    </span>
  );
}

function numericRecordValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value);
  }
  return undefined;
}

function formatUniqueId(task: GanttTask, fallback: number): number {
  const value = getMppRecordValue(task, "UNIQUE_ID");
  return numericRecordValue(value) ?? fallback;
}

/**
 * Parse a predecessor string like "1FS,2SS+5d,3FF-2d" into GanttDependency[].
 *
 * Format per entry: <taskId><type>[+/-<lag>d]
 * - type: FS, SS, FF, SF
 * - lag: optional integer days (e.g. +5, -2)
 */
function parsePredecessors(
  raw: string,
  targetId: string | number,
  tasks: GanttTask[],
): GanttDependency[] {
  if (!raw.trim()) return [];

  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const result: GanttDependency[] = [];

  for (const entry of parts) {
    const match = entry.match(
      /^(\w+)(FS|SS|FF|SF)([+-]\d+)?d?$/i
    );
    if (!match) continue;

    const rawFrom = isNaN(Number(match[1])) ? match[1] : Number(match[1]);
    const source = findTaskByRowId(tasks, rawFrom);
    if (!source) continue;
    const type = match[2].toUpperCase() as GanttDependency["type"];
    const lag = match[3] ? parseInt(match[3], 10) : undefined;

    result.push({ from: source.id, to: targetId, type, lag });
  }

  return result;
}

const FORMAT_CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

function formatProgressValue(value: unknown): string {
  return `${formatProgressNumber(value)}%`;
}

function formatProgressNumber(value: unknown): string {
  const numericValue = typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(value);

  if (!Number.isFinite(numericValue)) return "0";

  const clamped = Math.max(0, Math.min(100, numericValue));
  return clamped.toFixed(2).replace(/\.?0+$/, "");
}

function formatGenericValue(value: unknown, dataType: string | undefined, locale: UILocale): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) return formatDate(value);
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" && item !== null
          ? JSON.stringify(item)
          : String(item),
      )
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? t(locale, "yes") : "";
  if (dataType === "currency" && typeof value === "number") {
    return FORMAT_CURRENCY.format(value);
  }
  return String(value);
}

function getMppCellValue(task: GanttTask, column: ColumnConfig): unknown {
  const key = column.sourceKey ?? column.key.replace(/^mpp:/, "");
  return getMppRecordValue(task, key);
}

function getMppEditValue(value: unknown, dataType: string | undefined): string | number {
  if (dataType === "date") {
    if (value instanceof Date) return toISODate(value);
    if (typeof value === "string" && value) return value.slice(0, 10);
    return "";
  }
  if (["number", "currency", "duration"].includes(dataType ?? "")) {
    const parsed = typeof value === "number" ? value : Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return value == null ? "" : String(value);
}

function parseMppEditValue(raw: string, dataType: string | undefined): unknown {
  if (dataType === "date") return raw ? createProjectDate(raw).toISOString() : "";
  if (["number", "currency", "duration"].includes(dataType ?? "")) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (dataType === "boolean") return ["true", "1", "yes", "si", "sí"].includes(raw.toLowerCase());
  return raw;
}

function mppEditableCellType(dataType: string | undefined): "text" | "number" | "date" {
  if (dataType === "date") return "date";
  if (["number", "currency", "duration"].includes(dataType ?? "")) return "number";
  return "text";
}

function cellAttributes(
  align: "left" | "right" | "center" = "left",
  modifier?: string,
) {
  return {
    className: modifier ? `gantt-row-cell ${modifier}` : "gantt-row-cell",
    "data-align": align,
  };
}

/**
 * Single row in the Gantt entry table.
 * Handles WBS indentation, summary/milestone styling, row striping, selection.
 * Inline editing for: Name, Duration, Start, Finish, Predecessors, % Complete.
 */
export default function GanttRow({
  task,
  index,
  rowNumber,
  onSelect,
  isSelected,
  isExpanded = true,
  onToggleExpand,
  onUpdateTask,
  columns,
  locale,
  budgetedCost,
  actualCost,
  variance,
  allTasks = [],
  draggable = false,
  isDragging = false,
  dropPosition,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMouseDown,
}: GanttRowProps) {
  // ── Name cell: milestone icon + critical color ──
  const namePrefix = task.isMilestone ? "◆ " : "";

  // ── Progress display ──
  const progress = task.percentComplete ?? task.progress;

  // ── Editable: should we wrap cells in EditableCell? ──
  const canEdit = !!onUpdateTask;

  const renderCell = (column: ColumnConfig) => {
    switch (column.key) {
      case "id":
        return <td key={column.key} {...cellAttributes("right")}>{taskRowId(task, rowNumber)}</td>;
      case "uniqueId":
        return <td key={column.key} {...cellAttributes("right")}>{formatUniqueId(task, rowNumber)}</td>;
      case "wbs":
        return <td key={column.key} {...cellAttributes()}>{task.wbs ?? ""}</td>;
      case "name":
        return (
          <td
            key={column.key}
            {...cellAttributes("left", "gantt-row-cell--name")}
            data-summary={task.isSummary}
            data-critical={task.isCritical}
          >
        {canEdit ? (
          <EditableCell
            value={`${namePrefix}${task.name}`}
            type="text"
            align="left"
            readOnly={false}
            prefix={
              <WBSExpand
                isExpanded={isExpanded}
                onClick={onToggleExpand}
                level={task.outlineLevel}
                isSummary={task.isSummary}
              />
            }
            onCommit={(val) => onUpdateTask!(task.id, "name", val)}
          />
        ) : (
          <>
            <WBSExpand
              isExpanded={isExpanded}
              onClick={onToggleExpand}
              level={task.outlineLevel}
              isSummary={task.isSummary}
            />
            <span>
              {namePrefix}
              {task.name}
            </span>
          </>
        )}
      </td>
        );
      case "summary":
        return (
          <td
            key={column.key}
            {...cellAttributes("center", "gantt-row-cell--critical")}
            data-critical={task.isCritical}
          >
            {task.isSummary ? t(locale, "yes") : ""}
          </td>
        );
      case "duration":
        return <td key={column.key} {...cellAttributes("right")}>
        {canEdit ? (
          <EditableCell
            value={task.duration}
            type="number"
            align="right"
            onCommit={(val) => {
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0) {
                onUpdateTask!(task.id, "duration", num);
              }
            }}
          />
        ) : (
          <>{task.duration}d</>
        )}
      </td>;
      case "start":
        return <td key={column.key} {...cellAttributes("left", "gantt-row-cell--date")}>
        {canEdit ? (
          <EditableCell
            value={toISODate(task.start)}
            displayValue={formatCompactDate(task.start)}
            type="date"
            align="left"
            onCommit={(val) => {
              const d = fromISODate(val);
              if (!isNaN(d.getTime())) {
                onUpdateTask!(task.id, "start", d);
              }
            }}
          />
        ) : (
          <>{formatDate(task.start)}</>
        )}
      </td>;
      case "finish":
        return <td key={column.key} {...cellAttributes("left", "gantt-row-cell--date")}>
        {canEdit ? (
          <EditableCell
            value={toISODate(task.finish)}
            displayValue={formatCompactDate(task.finish)}
            type="date"
            align="left"
            onCommit={(val) => {
              const d = fromISODate(val);
              if (!isNaN(d.getTime())) {
                onUpdateTask!(task.id, "finish", d);
              }
            }}
          />
        ) : (
          <>{formatDate(task.finish)}</>
        )}
      </td>;
      case "predecessors": {
        const predecessorValue = formatDependencies(task.dependencies, allTasks);
        return <td key={column.key} {...cellAttributes("left", "gantt-row-cell--predecessors")}>
        {canEdit ? (
          <div className="gantt-row-dependencies">
            <div className="gantt-row-dependencies__editor">
              <EditableCell
                value={predecessorValue}
                displayValue={renderDependencyDisplay(predecessorValue, locale)}
                type="text"
                align="left"
                onCommit={(val) => {
                  const deps = parsePredecessors(val, task.id, allTasks);
                  onUpdateTask!(task.id, "dependencies", deps);
                }}
              />
            </div>
            <DependencyPopover
              task={task}
              tasks={allTasks}
              locale={locale}
              onCommit={(deps) => onUpdateTask!(task.id, "dependencies", deps)}
            />
          </div>
        ) : (
          renderDependencyDisplay(predecessorValue, locale)
        )}
      </td>;
      }
      case "progress":
        return <td key={column.key} {...cellAttributes("right")}>
        {canEdit ? (
          <EditableCell
            value={progress}
            displayValue={formatProgressNumber(progress)}
            type="slider"
            align="right"
            sliderDisplayValue={formatProgressValue}
            onCommit={(val) => {
              const num = parseFloat(val);
              if (!isNaN(num) && num >= 0 && num <= 100) {
                onUpdateTask!(task.id, "progress", num);
              }
            }}
          />
        ) : (
          <>{formatProgressValue(progress)}</>
        )}
      </td>;
      case "critical":
        return (
          <td
            key={column.key}
            {...cellAttributes("center", "gantt-row-cell--critical")}
            data-critical={task.isCritical}
          >
            {task.isCritical ? t(locale, "yes") : ""}
          </td>
        );
      case "budgetedCost":
        return <td key={column.key} {...cellAttributes("right")}>
        {budgetedCost !== undefined && budgetedCost > 0
          ? FORMAT_CURRENCY.format(budgetedCost)
          : "\u2014"}
      </td>;
      case "actualCost":
        return <td key={column.key} {...cellAttributes("right")}>
        {actualCost !== undefined && actualCost > 0
          ? FORMAT_CURRENCY.format(actualCost)
          : "\u2014"}
      </td>;
      case "variance":
        return <td
        key={column.key}
        {...cellAttributes("right", "gantt-row-cell--variance")}
        data-variance={
          variance === undefined || variance === 0
            ? "neutral"
            : variance > 0
              ? "positive"
              : "negative"
        }
      >
        {variance !== undefined ? FORMAT_CURRENCY.format(variance) : "\u2014"}
      </td>;
      default:
        if (canEdit && !column.readOnly && column.dataType !== "object") {
          const sourceKey = column.sourceKey ?? column.key.replace(/^mpp(?::task)?:/, "");
          const value = getMppCellValue(task, column);
          return (
            <td key={column.key} {...cellAttributes(column.align)}>
              <EditableCell
                value={getMppEditValue(value, column.dataType)}
                type={mppEditableCellType(column.dataType)}
                align={column.align}
                onCommit={(val) => {
                  onUpdateTask!(task.id, `mppFields:${sourceKey}`, parseMppEditValue(val, column.dataType));
                }}
              />
            </td>
          );
        }
        if (column.dataType === "date") {
          return (
            <td key={column.key} {...cellAttributes(column.align, "gantt-row-cell--date")}>
              {formatGenericValue(getMppCellValue(task, column), column.dataType, locale)}
            </td>
          );
        }
        return (
          <td key={column.key} {...cellAttributes(column.align)}>
            {formatGenericValue(getMppCellValue(task, column), column.dataType, locale)}
          </td>
        );
    }
  };

  return (
    <tr
      data-testid="gantt-row"
      data-task-id={task.id}
      className="gantt-row"
      data-selected={isSelected}
      data-summary={task.isSummary}
      data-stripe={index % 2 === 0 ? "even" : "odd"}
      data-draggable={draggable}
      data-dragging={isDragging}
      data-drop-position={dropPosition}
      draggable={draggable}
      aria-grabbed={isDragging || undefined}
      onClick={(e) => onSelect?.(task.id, e.ctrlKey || e.metaKey)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseDown={onMouseDown}
    >
      {columns.map(renderCell)}
    </tr>
  );
}
