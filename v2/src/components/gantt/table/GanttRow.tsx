"use client";

import type { GanttTask, GanttDependency } from "@/components/gantt/types";
import { GANTT_ROW_HEIGHT } from "../layout";
import WBSExpand from "./WBSExpand";
import EditableCell from "./EditableCell";
import { createProjectDate, formatProjectDate, toDateInputValue } from "@/lib/date/projectDate";
import type { ColumnConfig } from "./ColumnSelector";
import type { UILocale } from "@/types/ui";
import { t } from "@/lib/i18n";
import { getMppRecordValue } from "@/lib/mpp/recordValues";

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
}

/** Format a Date to DD/MM/YYYY for Colombian locale. */
function formatDate(date: Date): string {
  return formatProjectDate(date);
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
function formatDependencies(dependencies: GanttDependency[]): string {
  if (dependencies.length === 0) return "";
  return dependencies
    .map((dep) => {
      const lag = dep.lag ? `${dep.lag > 0 ? "+" : ""}${dep.lag}d` : "";
      return `${dep.from}${dep.type}${lag}`;
    })
    .join(", ");
}

function formatUniqueId(task: GanttTask): string | number {
  const value = getMppRecordValue(task, "UNIQUE_ID");
  return typeof value === "string" || typeof value === "number" ? value : task.id;
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
  targetId: string | number
): GanttDependency[] {
  if (!raw.trim()) return [];

  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const result: GanttDependency[] = [];

  for (const entry of parts) {
    const match = entry.match(
      /^(\w+)(FS|SS|FF|SF)([+-]\d+)?d?$/i
    );
    if (!match) continue;

    const from = isNaN(Number(match[1])) ? match[1] : Number(match[1]);
    const type = match[2].toUpperCase() as GanttDependency["type"];
    const lag = match[3] ? parseInt(match[3], 10) : undefined;

    result.push({ from, to: targetId, type, lag });
  }

  return result;
}

/** Shared cell style for consistent alignment and padding. */
const cellStyle: React.CSSProperties = {
  padding: "0 10px",
  fontSize: "0.8125rem",
  lineHeight: "1.4",
  height: `${GANTT_ROW_HEIGHT}px`,
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
};

const FORMAT_CURRENCY = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

function formatProgressValue(value: unknown): string {
  const numericValue = typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(value);

  if (!Number.isFinite(numericValue)) return "0.00%";

  const clamped = Math.max(0, Math.min(100, numericValue));
  return `${clamped.toFixed(2)}%`;
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
}: GanttRowProps) {
  // ── Row background resolution ──
  // Priority: selected > summary > stripe
  let rowBg: string;
  if (isSelected) {
    rowBg = "var(--aia-proj-xlight)";
  } else if (task.isSummary) {
    rowBg = "var(--aia-corp-xlight)";
  } else {
    rowBg = index % 2 === 0 ? "var(--aia-alabaster)" : "var(--aia-linen)";
  }

  const rowStyle: React.CSSProperties = {
    background: rowBg,
    borderLeft: isSelected
      ? "3px solid var(--aia-proj-main)"
      : "3px solid transparent",
    cursor: "pointer",
    transition: "background 120ms ease",
    height: `${GANTT_ROW_HEIGHT}px`,
  };

  // ── Name cell: milestone icon + critical color ──
  const namePrefix = task.isMilestone ? "◆ " : "";
  const nameColor = task.isCritical
    ? "var(--aia-alert-main)"
    : task.isSummary
      ? "var(--gray-900)"
      : "inherit";

  const nameCellStyle: React.CSSProperties = {
    ...cellStyle,
    paddingLeft: "10px",
    fontWeight: task.isSummary ? 600 : 400,
    color: nameColor,
  };

  // ── Critical badge ──
  const criticalCellStyle: React.CSSProperties = {
    ...cellStyle,
    textAlign: "center",
    color: task.isCritical ? "var(--aia-alert-main)" : "inherit",
    fontWeight: task.isCritical ? 600 : 400,
  };

  // ── Progress display ──
  const progress = task.percentComplete ?? task.progress;

  // ── Editable: should we wrap cells in EditableCell? ──
  const canEdit = !!onUpdateTask;

  const renderCell = (column: ColumnConfig) => {
    switch (column.key) {
      case "id":
        return <td key={column.key} style={{ ...cellStyle, textAlign: "right" }}>{rowNumber}</td>;
      case "uniqueId":
        return <td key={column.key} style={{ ...cellStyle, textAlign: "right" }}>{formatUniqueId(task)}</td>;
      case "wbs":
        return <td key={column.key} style={cellStyle}>{task.wbs ?? ""}</td>;
      case "name":
        return <td key={column.key} style={nameCellStyle}>
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
      </td>;
      case "summary":
        return <td key={column.key} style={criticalCellStyle}>{task.isSummary ? t(locale, "yes") : ""}</td>;
      case "duration":
        return <td key={column.key} style={{ ...cellStyle, textAlign: "right" }}>
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
        return <td key={column.key} style={cellStyle}>
        {canEdit ? (
          <EditableCell
            value={toISODate(task.start)}
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
        return <td key={column.key} style={cellStyle}>
        {canEdit ? (
          <EditableCell
            value={toISODate(task.finish)}
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
      case "predecessors":
        return <td key={column.key} style={cellStyle}>
        {canEdit ? (
          <EditableCell
            value={formatDependencies(task.dependencies)}
            type="text"
            align="left"
            onCommit={(val) => {
              const deps = parsePredecessors(val, task.id);
              onUpdateTask!(task.id, "dependencies", deps);
            }}
          />
        ) : (
          <>{formatDependencies(task.dependencies)}</>
        )}
      </td>;
      case "progress":
        return <td key={column.key} style={{ ...cellStyle, textAlign: "right" }}>
        {canEdit ? (
          <EditableCell
            value={progress}
            type="slider"
            align="right"
            onCommit={(val) => {
              const num = parseInt(val, 10);
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
        return <td key={column.key} style={criticalCellStyle}>{task.isCritical ? t(locale, "yes") : ""}</td>;
      case "budgetedCost":
        return <td key={column.key} style={{ ...cellStyle, textAlign: "right" }}>
        {budgetedCost !== undefined && budgetedCost > 0
          ? FORMAT_CURRENCY.format(budgetedCost)
          : "\u2014"}
      </td>;
      case "actualCost":
        return <td key={column.key} style={{ ...cellStyle, textAlign: "right" }}>
        {actualCost !== undefined && actualCost > 0
          ? FORMAT_CURRENCY.format(actualCost)
          : "\u2014"}
      </td>;
      case "variance":
        return <td
        key={column.key}
        style={{
          ...cellStyle,
          textAlign: "right",
          color:
            variance !== undefined && variance !== 0
              ? variance > 0
                ? "var(--aia-proj-main)"
                : "var(--aia-alert-main)"
              : undefined,
          fontWeight: variance !== undefined && variance !== 0 ? 600 : 400,
        }}
      >
        {variance !== undefined ? FORMAT_CURRENCY.format(variance) : "\u2014"}
      </td>;
      default:
        if (canEdit && !column.readOnly && column.dataType !== "object") {
          const sourceKey = column.sourceKey ?? column.key.replace(/^mpp(?::task)?:/, "");
          const value = getMppCellValue(task, column);
          return (
            <td key={column.key} style={{ ...cellStyle, textAlign: column.align }}>
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
        return (
          <td key={column.key} style={{ ...cellStyle, textAlign: column.align }}>
            {formatGenericValue(getMppCellValue(task, column), column.dataType, locale)}
          </td>
        );
    }
  };

  return (
    <tr
      data-testid="gantt-row"
      data-task-id={task.id}
      style={rowStyle}
      onClick={(e) => onSelect?.(task.id, e.ctrlKey || e.metaKey)}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.background =
            "var(--aia-corp-xlight)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.background = rowBg;
        }
      }}
    >
      {columns.map(renderCell)}
    </tr>
  );
}
